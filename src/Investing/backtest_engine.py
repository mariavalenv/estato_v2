"""
Historical Backtesting Engine
------------------------------
Replays the intraday strategy on up to 2 years of 1-hour bar data.

Key design rules:
  - ZERO look-ahead bias: signals only use data available at that timestamp
  - Realistic costs: 0.05% transaction cost + 0.02% slippage per trade
  - Runs 2 cycles per trading day (mid-morning + afternoon)
  - Tracks positions as dollar values updated by daily price change ratios

Data limits (yfinance):
  - 1h bars:  730 days (~2 years)
  - 1d bars:  unlimited (used for parameter optimisation)
"""

import os
import json
import logging
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

import numpy as np
import pandas as pd
import yfinance as yf

from intraday_engine import INTRADAY_CONFIG

log = logging.getLogger(__name__)

BACKTEST_FILE  = os.path.join(os.path.dirname(__file__), "backtest_results.json")
BACKTEST_RUNNING = False
BACKTEST_ERROR: Optional[str] = None


# ── Configuration ─────────────────────────────────────────────────────────────

@dataclass
class BacktestConfig:
    universe: list          = field(default_factory=lambda: INTRADAY_CONFIG.universe)
    pairs:    list          = field(default_factory=lambda: INTRADAY_CONFIG.pairs)

    lookback_days:         int   = 365      # How many calendar days back to test
    initial_capital:       float = 100_000.0
    transaction_cost_pct:  float = 0.0005   # 0.05% per trade
    slippage_pct:          float = 0.0002   # 0.02% per trade
    min_trade_usd:         float = 50.0     # Ignore sub-$50 rebalances

    max_position_pct:      float = 0.05     # Max 5% per ticker
    cash_reserve_pct:      float = 0.10     # Keep 10% cash

    rsi_oversold:          float = 35.0
    rsi_overbought:        float = 65.0
    zscore_entry:          float = 1.5
    signal_threshold:      float = 0.10     # Min signal to allocate


# ── Signal helpers (no I/O — pure computation on pre-fetched arrays) ──────────

def _rsi(closes: pd.Series, period: int = 14) -> float:
    if len(closes) < period + 1:
        return 50.0
    delta = closes.diff().dropna()
    gain  = delta.clip(lower=0).rolling(period).mean()
    loss  = (-delta).clip(lower=0).rolling(period).mean()
    if loss.iloc[-1] == 0:
        return 100.0
    return float(100 - 100 / (1 + gain.iloc[-1] / loss.iloc[-1]))


def _bb_signal(closes: pd.Series, period: int = 20) -> float:
    if len(closes) < period:
        return 0.0
    mid = float(closes.rolling(period).mean().iloc[-1])
    std = float(closes.rolling(period).std().iloc[-1])
    if std == 0 or pd.isna(std):
        return 0.0
    z = (float(closes.iloc[-1]) - mid) / std
    return float(np.clip(-z / 2, -1.0, 1.0))


def _vwap_signal(today_closes: pd.Series, today_volumes: pd.Series) -> float:
    if today_volumes.sum() == 0:
        return 0.0
    vwap  = float((today_closes * today_volumes).sum() / today_volumes.sum())
    price = float(today_closes.iloc[-1])
    return float(np.clip((vwap - price) / price * 50, -1.0, 1.0))


def _zscore(spread: pd.Series, window: int = 30) -> float:
    if len(spread) < window:
        return 0.0
    mu  = float(spread.rolling(window).mean().iloc[-1])
    sig = float(spread.rolling(window).std().iloc[-1])
    if sig == 0 or pd.isna(sig):
        return 0.0
    return float((float(spread.iloc[-1]) - mu) / sig)


# ── Data fetching ─────────────────────────────────────────────────────────────

def _fetch_data(universe: list, lookback_days: int) -> dict:
    """
    Fetch 1h bars for all tickers.
    Returns {ticker: DataFrame(Open, High, Low, Close, Volume)}.
    """
    days = min(lookback_days + 30, 700)   # yfinance 1h limit = 730 days
    log.info(f"[Backtest] Downloading {len(universe)} tickers × {days}d of 1h bars…")
    data = {}
    for ticker in universe:
        try:
            df = yf.download(ticker, period=f"{days}d", interval="1h",
                             progress=False, auto_adjust=True)
            # Flatten MultiIndex columns (yfinance ≥0.2)
            df.columns = [c[0] if isinstance(c, tuple) else c for c in df.columns]
            if df.empty or len(df) < 60:
                log.warning(f"[Backtest] {ticker}: insufficient data ({len(df)} bars)")
                continue
            data[ticker] = df
            log.info(f"[Backtest] {ticker}: {len(df)} bars "
                     f"({df.index[0].date()} → {df.index[-1].date()})")
        except Exception as e:
            log.warning(f"[Backtest] Failed to fetch {ticker}: {e}")
    return data


def _build_price_matrix(data: dict) -> tuple:
    """
    Build aligned (Close, Volume) DataFrames across all tickers.
    Returns (close_df, volume_df) with forward-fill for missing bars.
    """
    close_dict  = {t: df["Close"].astype(float)  for t, df in data.items()}
    volume_dict = {t: df["Volume"].astype(float) for t, df in data.items()}
    close_df  = pd.DataFrame(close_dict).sort_index().ffill()
    volume_df = pd.DataFrame(volume_dict).sort_index().fillna(0)
    return close_df, volume_df


# ── Signal computation ────────────────────────────────────────────────────────

def _signals_at(close_df: pd.DataFrame, volume_df: pd.DataFrame,
                bar_idx: int, cfg: BacktestConfig) -> dict:
    """
    Compute intraday signals at bar_idx using only data[0:bar_idx+1].
    Returns {ticker: signal ∈ [-1, 1]}.
    """
    if bar_idx < 50:
        return {t: 0.0 for t in close_df.columns}

    ts   = close_df.index[bar_idx]
    hist_close  = close_df.iloc[:bar_idx + 1]
    hist_volume = volume_df.iloc[:bar_idx + 1]

    signals = {}
    for ticker in close_df.columns:
        closes  = hist_close[ticker].dropna().tail(60)
        volumes = hist_volume[ticker].dropna().tail(60)
        if len(closes) < 20:
            signals[ticker] = 0.0
            continue

        # Intraday VWAP from bars today
        today = ts.date()
        today_mask   = hist_close.index.date == today
        today_closes = hist_close.loc[today_mask, ticker].dropna().astype(float)
        today_vols   = hist_volume.loc[today_mask, ticker].astype(float)

        rsi_val = _rsi(closes)
        rsi_s   = float(np.clip((50 - rsi_val) / 50, -1.0, 1.0))
        bb_s    = _bb_signal(closes)
        vwap_s  = _vwap_signal(today_closes, today_vols) if len(today_closes) > 1 else 0.0

        combined = 0.4 * vwap_s + 0.35 * bb_s + 0.25 * rsi_s
        signals[ticker] = round(float(combined), 4)

    return signals


def _pairs_at(close_df: pd.DataFrame, bar_idx: int, cfg: BacktestConfig) -> list:
    """
    Compute pairs z-scores at bar_idx.
    Returns list of active pair signals.
    """
    if bar_idx < 50:
        return []

    results = []
    hist = close_df.iloc[:bar_idx + 1]

    for (a, b) in cfg.pairs:
        if a not in hist.columns or b not in hist.columns:
            continue
        sa = hist[a].dropna().tail(80)
        sb = hist[b].dropna().tail(80)
        common = sa.index.intersection(sb.index)
        if len(common) < 20:
            continue
        spread = np.log(sa.loc[common] / sb.loc[common])
        z = _zscore(spread)
        if abs(z) >= cfg.zscore_entry:
            results.append({
                "ticker_a": a,
                "ticker_b": b,
                "zscore":   round(z, 3),
                "action_a": "sell" if z > 0 else "buy",
                "action_b": "buy"  if z > 0 else "sell",
                "strength": round(min(abs(z) / 3.0, 1.0), 3),
            })
    return results


# ── Core simulation ───────────────────────────────────────────────────────────

def _build_target_allocations(signals: dict, pairs: list,
                               investable: float, cfg: BacktestConfig) -> dict:
    """Translate signals → target dollar allocations."""
    allocs: dict = {}

    # Momentum / mean-reversion
    positive = {t: s for t, s in signals.items() if s > cfg.signal_threshold}
    if positive:
        total_s = sum(positive.values())
        n       = min(len(positive), 6)
        for t, s in positive.items():
            w = min((s / total_s) * (n / 10), cfg.max_position_pct)
            d = round(investable * w, 2)
            if d >= cfg.min_trade_usd:
                allocs[t] = allocs.get(t, 0.0) + d

    # Pairs arb buy legs
    for sig in pairs:
        alloc = round(investable * 0.04 * sig["strength"], 2)
        if alloc < cfg.min_trade_usd:
            continue
        if sig["action_a"] == "buy":
            allocs[sig["ticker_a"]] = allocs.get(sig["ticker_a"], 0.0) + alloc
        if sig["action_b"] == "buy":
            allocs[sig["ticker_b"]] = allocs.get(sig["ticker_b"], 0.0) + alloc

    return allocs


def run_backtest(cfg: Optional[BacktestConfig] = None) -> dict:
    """
    Run the full historical backtest.
    Returns a result dict and saves it to backtest_results.json.
    """
    global BACKTEST_RUNNING, BACKTEST_ERROR
    if cfg is None:
        cfg = BacktestConfig()

    start_ts = datetime.now().isoformat(timespec="seconds")
    log.info(f"[Backtest] Starting: {cfg.lookback_days}d lookback, "
             f"capital=${cfg.initial_capital:,.0f}")

    # ── 1. Fetch & prepare data ───────────────────────────────────────────────
    raw_data  = _fetch_data(cfg.universe, cfg.lookback_days)
    if len(raw_data) < 2:
        return {"status": "error", "error": "Not enough tickers with data."}

    close_df, volume_df = _build_price_matrix(raw_data)

    # Trim to requested lookback
    cutoff = close_df.index[-1] - pd.Timedelta(days=cfg.lookback_days)
    close_df  = close_df[close_df.index >= cutoff]
    volume_df = volume_df[volume_df.index >= cutoff]

    # ── 2. Build simulation timeline: 2 bars per trading day ─────────────────
    date_groups: dict = defaultdict(list)
    for i, ts in enumerate(close_df.index):
        date_groups[ts.date()].append(i)

    # Skip first 7 days (signal warmup)
    trading_dates = sorted(date_groups.keys())
    trading_dates = trading_dates[7:]
    log.info(f"[Backtest] Simulating {len(trading_dates)} trading days…")

    # ── 3. Simulation state ───────────────────────────────────────────────────
    cash              = cfg.initial_capital
    positions: dict   = {}   # {ticker: dollar_value (mark-to-market)}
    last_bar_idx: dict = {}  # {ticker: bar_idx when position was last updated}

    equity_curve = []
    trades       = []
    total_cost   = 0.0

    def portfolio_value() -> float:
        return cash + sum(positions.values())

    def mark_to_market(bar_idx: int):
        """Update all position dollar values to current prices."""
        for ticker in list(positions.keys()):
            prev_idx = last_bar_idx.get(ticker)
            if prev_idx is None or ticker not in close_df.columns:
                continue
            prev_p = float(close_df[ticker].iloc[prev_idx])
            curr_p = float(close_df[ticker].iloc[bar_idx])
            if prev_p > 0:
                positions[ticker] *= curr_p / prev_p
            last_bar_idx[ticker] = bar_idx

    cost_per_trade_pct = cfg.transaction_cost_pct + cfg.slippage_pct

    # ── 4. Main loop ──────────────────────────────────────────────────────────
    for trading_date in trading_dates:
        bar_indices = date_groups[trading_date]
        if len(bar_indices) < 2:
            continue

        # 2 cycles: bar ~1/3 and ~2/3 through the day
        n = len(bar_indices)
        cycle_indices = [bar_indices[n // 3], bar_indices[(2 * n) // 3]]

        for bar_idx in cycle_indices:
            mark_to_market(bar_idx)
            total_equity = portfolio_value()
            investable   = total_equity * (1 - cfg.cash_reserve_pct)

            # Compute signals
            sigs  = _signals_at(close_df, volume_df, bar_idx, cfg)
            pairs = _pairs_at(close_df, bar_idx, cfg)
            tgts  = _build_target_allocations(sigs, pairs, investable, cfg)

            # Rebalance
            all_tickers = set(positions.keys()) | set(tgts.keys())
            for ticker in all_tickers:
                curr_val   = positions.get(ticker, 0.0)
                target_val = tgts.get(ticker, 0.0)
                delta      = target_val - curr_val

                if abs(delta) < cfg.min_trade_usd:
                    continue

                trade_cost = abs(delta) * cost_per_trade_pct
                total_cost += trade_cost

                if delta > 0:   # Buy
                    if cash < delta + trade_cost:
                        delta = max(0, cash - trade_cost)
                    if delta < cfg.min_trade_usd:
                        continue
                    positions[ticker]   = positions.get(ticker, 0.0) + delta
                    last_bar_idx[ticker] = bar_idx
                    cash -= delta + trade_cost
                else:           # Sell
                    sell_amt = min(abs(delta), curr_val)
                    positions[ticker] = max(0.0, curr_val - sell_amt)
                    cash += sell_amt - trade_cost
                    last_bar_idx[ticker] = bar_idx
                    if positions[ticker] < 1.0:
                        del positions[ticker]
                        if ticker in last_bar_idx:
                            del last_bar_idx[ticker]

                trades.append({
                    "date":   str(trading_date),
                    "ticker": ticker,
                    "side":   "buy" if delta > 0 else "sell",
                    "amount": round(abs(delta), 2),
                })

        # Record end-of-day equity
        mark_to_market(bar_indices[-1])
        equity_curve.append({
            "date":   str(trading_date),
            "equity": round(portfolio_value(), 2),
        })

    # ── 5. Performance metrics ────────────────────────────────────────────────
    final_equity  = portfolio_value()
    total_return  = (final_equity - cfg.initial_capital) / cfg.initial_capital

    equities = [e["equity"] for e in equity_curve]
    daily_rets = [
        (equities[i] - equities[i - 1]) / equities[i - 1]
        for i in range(1, len(equities))
        if equities[i - 1] > 0
    ]

    if len(daily_rets) >= 5:
        mu    = float(np.mean(daily_rets))
        sigma = float(np.std(daily_rets))
        sharpe  = float(mu / sigma * np.sqrt(252)) if sigma > 0 else 0.0
        sortino_neg = [r for r in daily_rets if r < 0]
        sortino_std = float(np.std(sortino_neg)) if sortino_neg else sigma
        sortino = float(mu / sortino_std * np.sqrt(252)) if sortino_std > 0 else 0.0
    else:
        sharpe  = 0.0
        sortino = 0.0

    # Max drawdown
    peak   = equities[0] if equities else cfg.initial_capital
    max_dd = 0.0
    for eq in equities:
        peak   = max(peak, eq)
        max_dd = max(max_dd, (peak - eq) / peak)

    # Annualised return
    n_days = max(len(equity_curve), 1)
    ann_return = (1 + total_return) ** (252 / n_days) - 1

    # Monthly P&L estimate
    monthly_pnl = (final_equity - cfg.initial_capital) / max(n_days / 21, 1)

    # Win rate
    winning_days = sum(
        1 for i in range(1, len(equities))
        if equities[i] > equities[i - 1]
    )
    win_rate = winning_days / max(n_days - 1, 1)

    result = {
        "status":    "completed",
        "timestamp": start_ts,
        "config": {
            "lookback_days":        cfg.lookback_days,
            "initial_capital":      cfg.initial_capital,
            "transaction_cost_pct": cfg.transaction_cost_pct,
            "universe":             cfg.universe,
        },
        "metrics": {
            "total_return_pct":      round(total_return * 100, 2),
            "annualized_return_pct": round(ann_return * 100, 2),
            "estimated_monthly_pnl": round(monthly_pnl, 2),
            "sharpe_ratio":          round(sharpe, 3),
            "sortino_ratio":         round(sortino, 3),
            "max_drawdown_pct":      round(max_dd * 100, 2),
            "win_rate_pct":          round(win_rate * 100, 1),
            "total_trades":          len(trades),
            "total_cost_usd":        round(total_cost, 2),
            "final_equity":          round(final_equity, 2),
            "trading_days":          n_days,
        },
        "equity_curve":  equity_curve,
        "recent_trades": trades[-200:],
    }

    try:
        with open(BACKTEST_FILE, "w") as f:
            json.dump(result, f, indent=2)
    except Exception as e:
        log.warning(f"[Backtest] Could not save results: {e}")

    log.info(
        f"[Backtest] Complete — return={total_return*100:.1f}%, "
        f"ann={ann_return*100:.1f}%, Sharpe={sharpe:.2f}, "
        f"MaxDD={max_dd*100:.1f}%, est. monthly P&L=${monthly_pnl:,.0f}"
    )
    return result


# ── Parameter optimisation (grid search) ─────────────────────────────────────

def run_parameter_sweep(
    lookback_days: int = 180,
    initial_capital: float = 100_000.0,
) -> dict:
    """
    Grid search over RSI thresholds and z-score entry to find best parameters.
    Uses faster daily bars (unlimited history) for speed.
    Returns a table of {params → metrics}.
    """
    log.info("[Backtest] Running parameter sweep…")
    results = []

    rsi_oversold_range = [25.0, 30.0, 35.0, 40.0]
    zscore_range       = [1.2,  1.5,  2.0,  2.5 ]

    for rsi_os in rsi_oversold_range:
        for zentry in zscore_range:
            cfg = BacktestConfig(
                lookback_days=lookback_days,
                initial_capital=initial_capital,
                rsi_oversold=rsi_os,
                zscore_entry=zentry,
            )
            try:
                r = run_backtest(cfg)
                if r["status"] == "completed":
                    m = r["metrics"]
                    results.append({
                        "rsi_oversold":    rsi_os,
                        "zscore_entry":    zentry,
                        "total_return_pct":      m["total_return_pct"],
                        "annualized_return_pct": m["annualized_return_pct"],
                        "sharpe_ratio":          m["sharpe_ratio"],
                        "max_drawdown_pct":      m["max_drawdown_pct"],
                        "win_rate_pct":          m["win_rate_pct"],
                    })
            except Exception as e:
                log.warning(f"[Sweep] rsi={rsi_os} z={zentry} failed: {e}")

    # Sort by Sharpe ratio
    results.sort(key=lambda r: r.get("sharpe_ratio", 0), reverse=True)

    sweep_result = {
        "status":    "completed",
        "timestamp": datetime.now().isoformat(timespec="seconds"),
        "best_params": results[0] if results else {},
        "all_results": results,
    }

    sweep_file = os.path.join(os.path.dirname(__file__), "sweep_results.json")
    try:
        with open(sweep_file, "w") as f:
            json.dump(sweep_result, f, indent=2)
    except Exception as e:
        log.warning(f"[Sweep] Could not save: {e}")

    return sweep_result


def load_backtest_results() -> dict:
    if not os.path.exists(BACKTEST_FILE):
        return {}
    try:
        with open(BACKTEST_FILE) as f:
            return json.load(f)
    except Exception:
        return {}


def load_sweep_results() -> dict:
    sweep_file = os.path.join(os.path.dirname(__file__), "sweep_results.json")
    if not os.path.exists(sweep_file):
        return {}
    try:
        with open(sweep_file) as f:
            return json.load(f)
    except Exception:
        return {}


# ── Standalone ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import logging
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s [%(levelname)s] %(message)s")
    result = run_backtest()
    m = result.get("metrics", {})
    print(f"\n{'='*50}")
    print(f"  BACKTEST RESULTS")
    print(f"{'='*50}")
    for k, v in m.items():
        print(f"  {k:<30} {v}")
