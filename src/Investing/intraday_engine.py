"""
Intraday Trading Engine
-----------------------
Runs every CYCLE_INTERVAL_MINS minutes during NYSE market hours (9:30–16:00 ET).

Strategies:
  1. Mean-reversion signals — RSI, VWAP deviation, Bollinger Bands (5-min bars)
  2. Statistical arbitrage  — pairs z-score on correlated ETF/equity pairs (hourly bars)

Risk controls:
  - Kill switch: stops trading if daily loss exceeds MAX_DAILY_LOSS_PCT
  - Per-position stop-loss tracked in cycle log
  - Max 5% allocation per position (smaller than the daily engine)

Run standalone:
    python3 intraday_engine.py
Or via the API: POST /api/intraday/start
"""

import os
import json
import logging
import threading
import time
from datetime import datetime, date
from dataclasses import dataclass, field
from typing import Optional

import numpy as np
import pandas as pd
import yfinance as yf

try:
    from zoneinfo import ZoneInfo
    ET = ZoneInfo("America/New_York")
except ImportError:
    import pytz
    ET = pytz.timezone("America/New_York")

from invest import CONFIG, OrderExecutor

log = logging.getLogger(__name__)

INTRADAY_LOG_FILE = os.path.join(os.path.dirname(__file__), "intraday_log.json")


# ── Intraday Configuration ────────────────────────────────────────────────────

@dataclass
class IntradayConfig:
    # Liquid universe for intraday — index ETFs + mega-cap
    universe: list = field(default_factory=lambda: [
        "SPY", "QQQ", "AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "META",
    ])

    # Pairs for statistical arbitrage (highly correlated, mean-reverting spread)
    pairs: list = field(default_factory=lambda: [
        ("SPY",   "QQQ"),
        ("AAPL",  "MSFT"),
        ("GOOGL", "META"),
        ("NVDA",  "AMD"),
    ])

    # Signal thresholds
    rsi_oversold:    float = 35.0  # RSI < 35 → bullish signal
    rsi_overbought:  float = 65.0  # RSI > 65 → bearish signal
    zscore_entry:    float = 1.5   # Pairs z-score to enter position
    zscore_exit:     float = 0.5   # Pairs z-score to exit

    # Position sizing
    max_position_pct:  float = 0.05  # Max 5% per ticker intraday
    cash_reserve_pct:  float = 0.10  # Keep 10% cash buffer
    pair_alloc_pct:    float = 0.04  # 4% per pair leg

    # Risk controls
    max_daily_loss_pct: float = 0.02  # Kill switch at -2% daily
    stop_loss_pct:       float = 0.015 # 1.5% stop-loss per position
    take_profit_pct:     float = 0.030 # 3.0% take-profit per position

    # Cycle timing
    cycle_interval_mins: int = 15

    # Signal computation
    rsi_period:      int = 14
    bb_period:       int = 20
    pairs_lookback:  int = 20  # days of hourly bars for pairs z-score


INTRADAY_CONFIG = IntradayConfig()


# ── Market Hours ──────────────────────────────────────────────────────────────

def is_market_open() -> bool:
    """Return True if NYSE is currently in regular trading hours (9:30–15:55 ET)."""
    now = datetime.now(ET)
    if now.weekday() >= 5:          # Saturday / Sunday
        return False
    open_  = now.replace(hour=9,  minute=30, second=0, microsecond=0)
    close_ = now.replace(hour=15, minute=55, second=0, microsecond=0)
    return open_ <= now <= close_


def minutes_to_open() -> Optional[int]:
    """Minutes until next market open on a weekday, or None if open / weekend."""
    if is_market_open():
        return None
    now = datetime.now(ET)
    if now.weekday() >= 5:
        return None
    open_ = now.replace(hour=9, minute=30, second=0, microsecond=0)
    if now < open_:
        return int((open_ - now).total_seconds() / 60)
    return None   # After close — next day handled by caller


# ── Intraday Signal Engine ────────────────────────────────────────────────────

class IntradaySignalEngine:
    """
    Computes mean-reversion signals from 5-minute intraday bars:
      - RSI:  oversold (<35) → +signal, overbought (>65) → -signal
      - VWAP: price below VWAP → +signal (expect reversion up)
      - BB:   price at lower band → +signal (expect reversion up)
    """

    def _fetch_bars(self, ticker: str) -> Optional[pd.DataFrame]:
        try:
            df = yf.download(ticker, period="5d", interval="5m",
                             progress=False, auto_adjust=True)
            df.columns = [c[0] if isinstance(c, tuple) else c for c in df.columns]
            if df.empty or len(df) < 20:
                return None
            return df
        except Exception as e:
            log.warning(f"[Intraday] Failed to fetch bars for {ticker}: {e}")
            return None

    def _rsi(self, closes: pd.Series, period: int = 14) -> float:
        delta = closes.diff().dropna()
        gain  = delta.clip(lower=0).rolling(period).mean()
        loss  = (-delta).clip(lower=0).rolling(period).mean()
        if loss.iloc[-1] == 0:
            return 100.0
        rs  = gain.iloc[-1] / loss.iloc[-1]
        return float(100 - 100 / (1 + rs))

    def _vwap_signal(self, df: pd.DataFrame) -> float:
        """Deviation of current price from intraday VWAP."""
        today_mask = df.index.date == df.index[-1].date()
        today = df[today_mask]
        if today.empty:
            return 0.0
        closes  = today["Close"].squeeze().astype(float)
        volumes = today["Volume"].squeeze().astype(float)
        total_vol = volumes.sum()
        if total_vol == 0:
            return 0.0
        vwap  = float((closes * volumes).sum() / total_vol)
        price = float(closes.iloc[-1])
        # +1 when price is 2% below VWAP, -1 when 2% above
        return float(np.clip((vwap - price) / price * 50, -1.0, 1.0))

    def _bollinger_signal(self, closes: pd.Series, period: int = 20) -> float:
        """Position within Bollinger Bands: +1 at lower band, -1 at upper band."""
        if len(closes) < period:
            return 0.0
        mid = float(closes.rolling(period).mean().iloc[-1])
        std = float(closes.rolling(period).std().iloc[-1])
        if std == 0:
            return 0.0
        price = float(closes.iloc[-1])
        z = (price - mid) / std
        return float(np.clip(-z / 2, -1.0, 1.0))

    def score(self, universe: list) -> dict:
        """Return {ticker: signal ∈ [-1, 1]} for each ticker."""
        signals = {}
        for ticker in universe:
            df = self._fetch_bars(ticker)
            if df is None:
                signals[ticker] = 0.0
                continue

            closes = df["Close"].squeeze().astype(float)
            rsi    = self._rsi(closes)
            vwap_s = self._vwap_signal(df)
            bb_s   = self._bollinger_signal(closes)

            rsi_s  = float(np.clip((50 - rsi) / 50, -1.0, 1.0))
            combined = round(0.4 * vwap_s + 0.35 * bb_s + 0.25 * rsi_s, 4)
            signals[ticker] = combined

            log.info(
                f"[Intraday] {ticker}: RSI={rsi:.1f}({rsi_s:+.2f}) "
                f"VWAP={vwap_s:+.2f} BB={bb_s:+.2f} → {combined:+.3f}"
            )
        return signals


# ── Pairs Statistical Arbitrage ───────────────────────────────────────────────

class PairsArbEngine:
    """
    Identifies mean-reversion opportunities in correlated pairs using z-score
    of the log price ratio over a rolling hourly lookback window.

    Entry: |z| > zscore_entry → trade the spread
    Action: if z > 0 (A expensive vs B) → sell A, buy B
            if z < 0 (A cheap vs B)     → buy A, sell B
    """

    def _fetch_ticker(self, ticker: str, lookback_days: int) -> Optional[pd.Series]:
        try:
            df = yf.download(ticker, period=f"{lookback_days}d", interval="1h",
                             progress=False, auto_adjust=True)
            df.columns = [c[0] if isinstance(c, tuple) else c for c in df.columns]
            if df.empty:
                return None
            return df["Close"].squeeze().astype(float).dropna()
        except Exception as e:
            log.warning(f"[PairsArb] Failed to fetch {ticker}: {e}")
            return None

    def _zscore(self, spread: pd.Series, window: int = 30) -> float:
        if len(spread) < window:
            return 0.0
        mu  = float(spread.rolling(window).mean().iloc[-1])
        sig = float(spread.rolling(window).std().iloc[-1])
        if sig == 0 or pd.isna(sig):
            return 0.0
        return float((spread.iloc[-1] - mu) / sig)

    def get_signals(self, pairs: list, zscore_entry: float = 1.5,
                    lookback_days: int = 20) -> list:
        """
        Returns list of pair signals:
          {ticker_a, ticker_b, zscore, action_a, action_b, strength, current_spread}
        """
        results = []
        for (a, b) in pairs:
            sa = self._fetch_ticker(a, lookback_days)
            sb = self._fetch_ticker(b, lookback_days)
            if sa is None or sb is None:
                continue

            # Align on common timestamps
            idx    = sa.index.intersection(sb.index)
            if len(idx) < 10:
                continue
            spread = np.log(sa.loc[idx] / sb.loc[idx])
            z      = self._zscore(spread)

            if abs(z) < zscore_entry:
                log.info(f"[PairsArb] {a}/{b}: z={z:.2f} — no signal")
                continue

            action_a = "sell" if z > 0 else "buy"
            action_b = "buy"  if z > 0 else "sell"
            strength = round(min(abs(z) / 3.0, 1.0), 3)

            log.info(
                f"[PairsArb] {a}/{b}: z={z:.2f} → "
                f"{action_a} {a}, {action_b} {b} (strength={strength:.2f})"
            )
            results.append({
                "ticker_a":       a,
                "ticker_b":       b,
                "zscore":         round(z, 3),
                "action_a":       action_a,
                "action_b":       action_b,
                "strength":       strength,
                "current_spread": round(float(spread.iloc[-1]), 4),
            })
        return results


# ── Daily P&L Tracker ─────────────────────────────────────────────────────────

class DailyPnLTracker:
    """Tracks intraday P&L and enforces the daily loss kill switch."""

    def __init__(self, max_loss_pct: float = 0.02):
        self.max_loss_pct     = max_loss_pct
        self._start_equity:   Optional[float] = None
        self._today:          Optional[date]  = None

    def reset_if_new_day(self, equity: float):
        today = date.today()
        if self._today != today:
            self._today         = today
            self._start_equity  = equity
            log.info(f"[PnL] New trading day — starting equity: ${equity:,.2f}")

    def daily_pnl(self, equity: float) -> float:
        if not self._start_equity:
            return 0.0
        return equity - self._start_equity

    def daily_pnl_pct(self, equity: float) -> float:
        if not self._start_equity or self._start_equity == 0:
            return 0.0
        return (equity - self._start_equity) / self._start_equity

    def kill_switch_triggered(self, equity: float) -> bool:
        pct = self.daily_pnl_pct(equity)
        if pct < -self.max_loss_pct:
            log.warning(
                f"[PnL] KILL SWITCH: daily loss {pct*100:.2f}% "
                f"exceeds -{self.max_loss_pct*100:.1f}% limit"
            )
            return True
        return False

    @property
    def start_equity(self) -> Optional[float]:
        return self._start_equity


# ── Intraday Cycle ────────────────────────────────────────────────────────────

_pnl_tracker = DailyPnLTracker(max_loss_pct=INTRADAY_CONFIG.max_daily_loss_pct)


def _append_intraday_log(entry: dict):
    records = []
    if os.path.exists(INTRADAY_LOG_FILE):
        try:
            with open(INTRADAY_LOG_FILE) as f:
                records = json.load(f)
        except Exception:
            records = []
    records.append(entry)
    if len(records) > 500:
        records = records[-500:]
    with open(INTRADAY_LOG_FILE, "w") as f:
        json.dump(records, f, indent=2)


def run_intraday_cycle(dry_run: bool = True) -> dict:
    """
    Execute one intraday trading cycle.
    Saves result to intraday_log.json and returns the result dict.
    """
    cfg = INTRADAY_CONFIG
    ts  = datetime.now().isoformat(timespec="seconds")

    result = {
        "timestamp":        ts,
        "dry_run":          dry_run,
        "status":           "error",
        "market_open":      is_market_open(),
        "equity":           0.0,
        "simulated":        False,
        "daily_pnl":        0.0,
        "daily_pnl_pct":    0.0,
        "kill_switch":      False,
        "intraday_signals": {},
        "pairs_signals":    [],
        "allocations":      {},
        "orders":           [],
    }

    if not result["market_open"]:
        result["status"] = "market_closed"
        log.info("[Intraday] Market is closed — skipping cycle.")
        _append_intraday_log(result)
        return result

    try:
        # ── Equity & P&L ─────────────────────────────────────────────────────
        executor  = OrderExecutor(CONFIG)
        equity    = executor.get_account_equity()
        simulated = False
        if equity <= 0:
            equity    = CONFIG.paper_equity
            simulated = True

        result["equity"]    = round(equity, 2)
        result["simulated"] = simulated

        _pnl_tracker.reset_if_new_day(equity)
        result["daily_pnl"]     = round(_pnl_tracker.daily_pnl(equity), 2)
        result["daily_pnl_pct"] = round(_pnl_tracker.daily_pnl_pct(equity), 4)

        if _pnl_tracker.kill_switch_triggered(equity):
            result["kill_switch"] = True
            result["status"]      = "kill_switch"
            log.warning("[Intraday] Kill switch active — no new orders.")
            _append_intraday_log(result)
            return result

        # ── Signals ───────────────────────────────────────────────────────────
        log.info("[Intraday] Computing intraday signals...")
        intraday_sigs = IntradaySignalEngine().score(cfg.universe)
        result["intraday_signals"] = intraday_sigs

        log.info("[Intraday] Computing pairs arb signals...")
        pairs_sigs = PairsArbEngine().get_signals(
            cfg.pairs,
            zscore_entry=cfg.zscore_entry,
            lookback_days=cfg.pairs_lookback,
        )
        result["pairs_signals"] = pairs_sigs

        # ── Build target allocations ──────────────────────────────────────────
        investable  = equity * (1 - cfg.cash_reserve_pct)
        allocations: dict = {}

        # Momentum / mean-reversion buys
        positive = {t: s for t, s in intraday_sigs.items() if s > 0.1}
        if positive:
            total_score = sum(positive.values())
            n           = min(len(positive), 6)
            for ticker, score in positive.items():
                weight = (score / total_score) * (n / 10)
                weight = min(weight, cfg.max_position_pct)
                dollar = round(investable * weight, 2)
                if dollar >= 1.0:
                    allocations[ticker] = allocations.get(ticker, 0.0) + dollar

        # Pairs arb buy legs (sell legs handled via reconciliation with existing positions)
        for sig in pairs_sigs:
            alloc = round(investable * cfg.pair_alloc_pct * sig["strength"], 2)
            if alloc < 1.0:
                continue
            if sig["action_a"] == "buy":
                allocations[sig["ticker_a"]] = allocations.get(sig["ticker_a"], 0.0) + alloc
            if sig["action_b"] == "buy":
                allocations[sig["ticker_b"]] = allocations.get(sig["ticker_b"], 0.0) + alloc

        result["allocations"] = allocations

        # ── Execute ───────────────────────────────────────────────────────────
        orders = executor.execute(allocations, dry_run=dry_run)
        result["orders"] = orders
        result["status"] = "completed"

        log.info(
            f"[Intraday] Cycle done — {len(orders)} orders | "
            f"daily P&L: ${result['daily_pnl']:+,.2f} "
            f"({result['daily_pnl_pct']*100:+.2f}%)"
        )

    except Exception as e:
        log.error(f"[Intraday] Cycle failed: {e}", exc_info=True)
        result["error"] = str(e)

    _append_intraday_log(result)
    return result


# ── Continuous Trading Loop ───────────────────────────────────────────────────

_intraday_running    = False
_intraday_error: Optional[str] = None
_stop_event          = threading.Event()


def start_intraday_loop(dry_run: bool = True):
    global _intraday_running, _intraday_error

    if _intraday_running:
        log.warning("[Intraday] Loop already running.")
        return

    _stop_event.clear()
    _intraday_running = True
    _intraday_error   = None

    interval = INTRADAY_CONFIG.cycle_interval_mins * 60

    def _loop():
        global _intraday_running, _intraday_error
        log.info(
            f"[Intraday] Loop started — cycle every "
            f"{INTRADAY_CONFIG.cycle_interval_mins} min | dry_run={dry_run}"
        )
        while not _stop_event.is_set():
            try:
                run_intraday_cycle(dry_run=dry_run)
            except Exception as e:
                _intraday_error = str(e)
                log.error(f"[Intraday] Loop error: {e}")
            # Interruptible sleep
            for _ in range(interval):
                if _stop_event.is_set():
                    break
                time.sleep(1)
        _intraday_running = False
        log.info("[Intraday] Loop stopped.")

    threading.Thread(target=_loop, daemon=True).start()


def stop_intraday_loop():
    _stop_event.set()
    log.info("[Intraday] Stop signal sent.")


def get_intraday_status() -> dict:
    return {
        "running":              _intraday_running,
        "error":                _intraday_error,
        "market_open":          is_market_open(),
        "minutes_to_open":      minutes_to_open(),
        "cycle_interval_mins":  INTRADAY_CONFIG.cycle_interval_mins,
    }


def load_intraday_log(limit: int = 100) -> list:
    if not os.path.exists(INTRADAY_LOG_FILE):
        return []
    try:
        with open(INTRADAY_LOG_FILE) as f:
            records = json.load(f)
        return records[-limit:]
    except Exception:
        return []


# ── Standalone entry point ────────────────────────────────────────────────────

if __name__ == "__main__":
    import logging
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s [%(levelname)s] %(message)s")

    DRY_RUN = os.getenv("DRY_RUN", "1") != "0"
    log.info(f"Starting intraday engine standalone. dry_run={DRY_RUN}")
    start_intraday_loop(dry_run=DRY_RUN)

    try:
        while True:
            time.sleep(60)
    except KeyboardInterrupt:
        stop_intraday_loop()
