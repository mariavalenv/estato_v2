"""
Daily Investment Algorithm
--------------------------
Associate IB-style daily allocation engine driven by:
  1. Twitter/X sentiment analysis (via tweepy + VADER/FinBERT)
  2. Polymarket prediction market signals
  3. A risk-weighted, no-leverage long-only portfolio

Architecture:
  TwitterSentimentSignal  ─┐
  PolymarketSignal        ─┤─► SignalAggregator ─► PortfolioAllocator ─► OrderExecutor
  PriceContext            ─┘

Dependencies:
  pip install tweepy requests vaderSentiment transformers torch
              yfinance alpaca-trade-api schedule python-dotenv pandas numpy
"""

import os
import json
import time
import logging
import schedule
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from typing import Optional
from dotenv import load_dotenv

# Sentiment
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

# Market data
import yfinance as yf

# Broker (paper-trading by default via Alpaca)
import alpaca_trade_api as tradeapi

# Twitter
import tweepy

# HTTP
import requests

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────

@dataclass
class Config:
    # Twitter / X API v2
    twitter_bearer_token: str = os.getenv("TWITTER_BEARER_TOKEN", "")

    # Alpaca paper-trading (set ALPACA_LIVE=1 for live)
    alpaca_api_key: str    = os.getenv("ALPACA_API_KEY", "")
    alpaca_secret_key: str = os.getenv("ALPACA_SECRET_KEY", "")
    alpaca_base_url: str   = (
        "https://api.alpaca.markets"
        if os.getenv("ALPACA_LIVE") == "1"
        else "https://paper-api.alpaca.markets"
    )

    # Universe of tickers to consider
    universe: list = field(default_factory=lambda: [
        "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA",
        "TSLA", "META", "JPM", "SPY", "QQQ",
    ])

    # Polymarket event slugs to monitor (macro risk signals)
    # Find slugs at https://polymarket.com/markets
    polymarket_slugs: list = field(default_factory=lambda: [
        "will-the-fed-cut-rates-in-2025",
        "will-us-enter-recession-2025",
        "will-sp500-end-2025-above-6000",
    ])

    # Portfolio constraints
    max_position_pct: float = 0.15   # Max 15 % per ticker
    min_position_pct: float = 0.01   # Min 1 % to bother buying
    cash_reserve_pct: float = 0.05   # Keep 5 % cash buffer

    # Signal weights
    twitter_weight:    float = 0.45
    polymarket_weight: float = 0.25
    momentum_weight:   float = 0.30

    # Sentiment tweet count per ticker
    tweet_count: int = 50

    # Sentiment rolling window (days)
    sentiment_window: int = 1

    # Fallback paper equity when Alpaca credentials are not configured
    paper_equity: float = float(os.getenv("PAPER_EQUITY", "100000"))


CONFIG = Config()


# ─────────────────────────────────────────────
# Data Classes
# ─────────────────────────────────────────────

@dataclass
class TickerSignal:
    ticker: str
    twitter_score: float   = 0.0   # [-1, 1]
    polymarket_score: float = 0.0  # [-1, 1] macro risk adjustment
    momentum_score: float  = 0.0   # [-1, 1]
    combined_score: float  = 0.0   # final weighted score
    confidence: float      = 0.0   # [0, 1]


# ─────────────────────────────────────────────
# 1. Twitter Sentiment Signal
# ─────────────────────────────────────────────

class TwitterSentimentSignal:
    """
    Queries recent tweets mentioning each ticker using Twitter API v2,
    scores them with VADER (fast, finance-tuned) and returns a
    normalised sentiment score in [-1, 1].

    Note: For production, swap VADER for FinBERT (HuggingFace):
      from transformers import pipeline
      finbert = pipeline("text-classification",
                         model="ProsusAI/finbert")
    """

    def __init__(self, bearer_token: str):
        self.client = tweepy.Client(bearer_token=bearer_token, wait_on_rate_limit=True)
        self.vader  = SentimentIntensityAnalyzer()

    def score_ticker(self, ticker: str, count: int = 50) -> tuple[float, float]:
        """Return (sentiment_score, confidence)."""
        query = f"${ticker} lang:en -is:retweet -is:reply"
        try:
            resp = self.client.search_recent_tweets(
                query=query,
                max_results=min(count, 100),
                tweet_fields=["created_at", "public_metrics"],
            )
        except Exception as e:
            log.warning(f"Twitter API error for {ticker}: {e}")
            return 0.0, 0.0

        if not resp or not resp.data:
            log.info(f"No tweets found for ${ticker}")
            return 0.0, 0.0

        scores = []
        weights = []
        for tweet in resp.data:
            vs = self.vader.polarity_scores(tweet.text)
            compound = vs["compound"]  # [-1, 1]
            # Weight by engagement (likes + retweets), floor at 1
            metrics = tweet.public_metrics or {}
            engagement = (
                metrics.get("like_count", 0) +
                metrics.get("retweet_count", 0) * 2 +
                metrics.get("reply_count", 0)
            )
            weight = max(1, engagement)
            scores.append(compound * weight)
            weights.append(weight)

        total_weight = sum(weights)
        if total_weight == 0:
            return 0.0, 0.0

        weighted_avg = sum(scores) / total_weight
        # Confidence scales with tweet volume (saturates at tweet_count)
        confidence = min(len(resp.data) / count, 1.0)
        return float(weighted_avg), float(confidence)

    def run(self, universe: list, count: int = 50) -> dict[str, tuple[float, float]]:
        results = {}
        for ticker in universe:
            score, conf = self.score_ticker(ticker, count)
            log.info(f"[Twitter] {ticker}: score={score:.3f}, conf={conf:.2f}")
            results[ticker] = (score, conf)
            time.sleep(1)  # Be polite to the rate limiter
        return results


# ─────────────────────────────────────────────
# 2. Polymarket Signal
# ─────────────────────────────────────────────

class PolymarketSignal:
    """
    Reads Polymarket prediction market probabilities via their public API.
    Maps macro event outcomes to a portfolio-level risk adjustment:
      - Recession risk ↑  → reduce equity exposure score
      - Rate cut prob ↑   → slightly bullish for growth stocks
      - S&P 500 target ↑  → bullish signal
    """

    GAMMA_BASE = "https://gamma-api.polymarket.com"
    CLOB_BASE  = "https://clob.polymarket.com"

    def fetch_market(self, slug: str) -> Optional[dict]:
        """Fetch market data by slug from Gamma API."""
        try:
            url = f"{self.GAMMA_BASE}/markets?slug={slug}"
            resp = requests.get(url, timeout=10)
            resp.raise_for_status()
            data = resp.json()
            return data[0] if data else None
        except Exception as e:
            log.warning(f"Polymarket fetch failed for '{slug}': {e}")
            return None

    def get_yes_probability(self, slug: str) -> Optional[float]:
        """Return the YES probability [0, 1] for a binary market."""
        market = self.fetch_market(slug)
        if not market:
            return None
        # outcomePrices is a JSON-encoded list e.g. '["0.62", "0.38"]'
        try:
            prices = market.get("outcomePrices", "[]")
            if isinstance(prices, str):
                import json
                prices = json.loads(prices)
            yes_prob = float(prices[0])
            return yes_prob
        except (IndexError, ValueError, TypeError) as e:
            log.warning(f"Could not parse outcome prices for {slug}: {e}")
            return None

    def macro_risk_score(self, slugs: list) -> float:
        """
        Combine Polymarket signals into a single macro risk score in [-1, 1].
        Positive = macro tailwind for equities.
        Negative = macro headwind.
        """
        signals = []
        for slug in slugs:
            prob = self.get_yes_probability(slug)
            if prob is None:
                continue

            # Classify each slug by its directional impact on equities
            if "recession" in slug:
                # Higher recession probability → bearish adjustment
                signals.append(-prob)
                log.info(f"[Polymarket] Recession prob={prob:.2f} → equity signal={-prob:.2f}")
            elif "rate-cut" in slug or "fed-cut" in slug:
                # Rate cuts are generally positive for risk assets
                signals.append(prob * 0.5)
                log.info(f"[Polymarket] Rate-cut prob={prob:.2f} → equity signal={prob*0.5:.2f}")
            elif "sp500" in slug or "spx" in slug:
                # Direct market level bet — map 0.5 neutral, 1 = bullish
                adjusted = (prob - 0.5) * 2  # centre at zero
                signals.append(adjusted)
                log.info(f"[Polymarket] SPX bet prob={prob:.2f} → equity signal={adjusted:.2f}")
            else:
                # Unknown market: treat as weak bullish if >50 %
                adjusted = (prob - 0.5)
                signals.append(adjusted)
                log.info(f"[Polymarket] {slug} prob={prob:.2f} → equity signal={adjusted:.2f}")

            time.sleep(0.5)

        if not signals:
            return 0.0
        return float(np.mean(signals))


# ─────────────────────────────────────────────
# 3. Price Momentum Signal
# ─────────────────────────────────────────────

class MomentumSignal:
    """
    Classic 1-month / 3-month price momentum (risk-adjusted).
    Normalised to [-1, 1] across the universe on each run.
    """

    def score(self, universe: list) -> dict[str, float]:
        end   = datetime.today()
        start = end - timedelta(days=90)

        raw_scores = {}
        for ticker in universe:
            try:
                hist = yf.download(ticker, start=start, end=end,
                                   progress=False, auto_adjust=True)
                if hist.empty or len(hist) < 10:
                    raw_scores[ticker] = 0.0
                    continue

                closes = hist["Close"].squeeze()
                # 1M return
                ret_1m = (closes.iloc[-1] / closes.iloc[-21] - 1) if len(closes) >= 21 else 0
                # 3M return
                ret_3m = (closes.iloc[-1] / closes.iloc[0]  - 1)
                # Volatility-adjusted momentum (Sharpe-like)
                daily_ret = closes.pct_change().dropna()
                vol = daily_ret.std() * np.sqrt(252) if len(daily_ret) > 1 else 1
                vol = max(vol, 0.05)  # Floor at 5 % annualised
                score = (0.4 * ret_1m + 0.6 * ret_3m) / vol
                raw_scores[ticker] = float(score)
            except Exception as e:
                log.warning(f"Momentum error for {ticker}: {e}")
                raw_scores[ticker] = 0.0

        # Cross-sectional z-score then clip to [-1, 1]
        values = np.array(list(raw_scores.values()))
        if values.std() > 0:
            z = (values - values.mean()) / values.std()
            z = np.clip(z, -1, 1)
        else:
            z = np.zeros_like(values)

        return {t: float(z[i]) for i, t in enumerate(raw_scores)}


# ─────────────────────────────────────────────
# 4. Signal Aggregator
# ─────────────────────────────────────────────

class SignalAggregator:
    def __init__(self, config: Config):
        self.cfg = config

    def aggregate(
        self,
        twitter_signals:    dict[str, tuple[float, float]],
        polymarket_score:   float,
        momentum_signals:   dict[str, float],
    ) -> list[TickerSignal]:

        results = []
        for ticker in self.cfg.universe:
            tw_score, tw_conf = twitter_signals.get(ticker, (0.0, 0.5))
            mom_score = momentum_signals.get(ticker, 0.0)

            # Polymarket adjusts ALL tickers equally (it's a macro signal)
            poly_score = polymarket_score

            combined = (
                self.cfg.twitter_weight    * tw_score   +
                self.cfg.polymarket_weight * poly_score +
                self.cfg.momentum_weight   * mom_score
            )

            # Confidence: blend tweet confidence with signal agreement
            signs = [np.sign(x) for x in [tw_score, poly_score, mom_score] if x != 0]
            agreement = (signs.count(np.sign(combined)) / max(len(signs), 1))
            confidence = tw_conf * 0.6 + agreement * 0.4

            results.append(TickerSignal(
                ticker=ticker,
                twitter_score=tw_score,
                polymarket_score=poly_score,
                momentum_score=mom_score,
                combined_score=round(combined, 4),
                confidence=round(confidence, 3),
            ))

        results.sort(key=lambda s: s.combined_score, reverse=True)
        return results


# ─────────────────────────────────────────────
# 5. Portfolio Allocator  (no leverage, long-only)
# ─────────────────────────────────────────────

class PortfolioAllocator:
    """
    Converts ranked signals into target dollar allocations.
    Rules:
      - Long-only, no leverage (total allocation ≤ available equity)
      - Positive signals only get allocation
      - Score-proportional sizing, capped at max_position_pct
      - Minimum cash buffer maintained
    """

    def __init__(self, config: Config):
        self.cfg = config

    def allocate(self, signals: list[TickerSignal], total_equity: float) -> dict[str, float]:
        investable = total_equity * (1 - self.cfg.cash_reserve_pct)
        positive   = [s for s in signals if s.combined_score > 0]

        if not positive:
            log.info("No positive signals — staying in cash.")
            return {}

        # Score-weighted raw weights
        total_score = sum(s.combined_score * s.confidence for s in positive)
        raw_weights = {
            s.ticker: (s.combined_score * s.confidence) / total_score
            for s in positive
        }

        # Cap at max_position_pct and drop below min
        capped = {}
        for ticker, w in raw_weights.items():
            w = min(w, self.cfg.max_position_pct)
            if w >= self.cfg.min_position_pct:
                capped[ticker] = w

        # Renormalise after capping
        total_capped = sum(capped.values())
        if total_capped == 0:
            return {}

        allocations = {}
        for ticker, w in capped.items():
            dollar_amt = investable * (w / total_capped)
            allocations[ticker] = round(dollar_amt, 2)

        return allocations


# ─────────────────────────────────────────────
# 6. Order Executor (Alpaca)
# ─────────────────────────────────────────────

class OrderExecutor:
    """
    Reconciles target allocations with current Alpaca positions
    and places fractional market orders at the next market open.
    Uses Alpaca paper-trading by default.
    """

    def __init__(self, config: Config):
        try:
            self.api = tradeapi.REST(
                config.alpaca_api_key,
                config.alpaca_secret_key,
                config.alpaca_base_url,
                api_version="v2",
            )
        except Exception as e:
            log.warning(f"Alpaca client init failed: {e}")
            self.api = None

    def get_current_positions(self) -> dict[str, float]:
        """Returns {ticker: market_value_usd}."""
        if not self.api:
            return {}
        try:
            positions = self.api.list_positions()
            return {p.symbol: float(p.market_value) for p in positions}
        except Exception as e:
            log.error(f"Could not fetch positions: {e}")
            return {}

    def get_account_equity(self) -> float:
        if not self.api:
            return 0.0
        try:
            account = self.api.get_account()
            return float(account.equity)
        except Exception as e:
            log.error(f"Could not fetch account equity: {e}")
            return 0.0

    def execute(self, target_allocations: dict[str, float], dry_run: bool = True) -> list[dict]:
        current = self.get_current_positions()
        all_tickers = set(current) | set(target_allocations)

        orders = []
        for ticker in all_tickers:
            target_usd  = target_allocations.get(ticker, 0.0)
            current_usd = current.get(ticker, 0.0)
            delta_usd   = target_usd - current_usd

            if abs(delta_usd) < 1.0:  # Ignore sub-$1 rebalances
                continue

            side = "buy" if delta_usd > 0 else "sell"
            orders.append({"ticker": ticker, "side": side, "amount": abs(round(delta_usd, 2))})

        log.info(f"\n{'='*50}")
        log.info(f"  DAILY INVESTMENT RUN — {datetime.now().strftime('%Y-%m-%d %H:%M')}")
        log.info(f"{'='*50}")
        for o in orders:
            log.info(f"  {o['side'].upper():4s} ${o['amount']:>10.2f} of {o['ticker']}")

        if dry_run:
            log.info("[DRY RUN] No orders submitted.")
            return orders

        for o in orders:
            try:
                self.api.submit_order(
                    symbol=o["ticker"],
                    notional=o["amount"],
                    side=o["side"],
                    type="market",
                    time_in_force="day",
                )
                log.info(f"Order submitted: {o['side']} ${o['amount']} of {o['ticker']}")
            except Exception as e:
                log.error(f"Order failed for {o['ticker']}: {e}")

        return orders


# ─────────────────────────────────────────────
# 7. Main Daily Run Loop
# ─────────────────────────────────────────────

RUNS_LOG_FILE = os.path.join(os.path.dirname(__file__), "runs_log.json")


def _append_run_log(entry: dict):
    """Append a run result entry to the persistent JSON log."""
    runs = []
    if os.path.exists(RUNS_LOG_FILE):
        try:
            with open(RUNS_LOG_FILE) as f:
                runs = json.load(f)
        except (json.JSONDecodeError, OSError):
            runs = []
    runs.append(entry)
    with open(RUNS_LOG_FILE, "w") as f:
        json.dump(runs, f, indent=2)


def run_daily(dry_run: bool = True) -> dict:
    """
    Execute one full daily investment cycle.
    Returns a structured result dict and persists it to runs_log.json.
    """
    run_ts = datetime.now().isoformat(timespec="seconds")
    log.info("Starting daily investment run...")

    result = {
        "timestamp": run_ts,
        "dry_run": dry_run,
        "status": "error",
        "equity": 0.0,
        "simulated": False,
        "poly_macro_score": 0.0,
        "signals": [],
        "allocations": {},
        "orders": [],
    }

    try:
        # --- Initialise components ---
        twitter    = TwitterSentimentSignal(CONFIG.twitter_bearer_token) if CONFIG.twitter_bearer_token else None
        poly       = PolymarketSignal()
        momentum   = MomentumSignal()
        aggregator = SignalAggregator(CONFIG)
        executor   = OrderExecutor(CONFIG)

        # --- Gather signals ---
        if twitter:
            log.info("Fetching Twitter sentiment signals...")
            twitter_signals = twitter.run(CONFIG.universe, count=CONFIG.tweet_count)
        else:
            log.warning("No TWITTER_BEARER_TOKEN configured — skipping Twitter signals.")
            twitter_signals = {t: (0.0, 0.0) for t in CONFIG.universe}

        log.info("Fetching Polymarket macro signals...")
        poly_score = poly.macro_risk_score(CONFIG.polymarket_slugs)
        result["poly_macro_score"] = round(poly_score, 4)
        log.info(f"Polymarket macro score: {poly_score:.3f}")

        log.info("Computing momentum signals...")
        mom_signals = momentum.score(CONFIG.universe)

        # --- Aggregate ---
        signals = aggregator.aggregate(twitter_signals, poly_score, mom_signals)
        result["signals"] = [
            {
                "ticker":           s.ticker,
                "twitter_score":    s.twitter_score,
                "polymarket_score": s.polymarket_score,
                "momentum_score":   s.momentum_score,
                "combined_score":   s.combined_score,
                "confidence":       s.confidence,
            }
            for s in signals
        ]

        log.info("\nSignal Summary:")
        log.info(f"  {'Ticker':<8} {'Twitter':>8} {'Poly':>8} {'Momentum':>10} {'Combined':>10} {'Confidence':>12}")
        for s in signals:
            log.info(
                f"  {s.ticker:<8} {s.twitter_score:>8.3f} {s.polymarket_score:>8.3f} "
                f"{s.momentum_score:>10.3f} {s.combined_score:>10.3f} {s.confidence:>12.3f}"
            )

        # --- Allocate ---
        equity = executor.get_account_equity()
        simulated = False
        if equity <= 0:
            equity = CONFIG.paper_equity
            simulated = True
            log.warning(
                f"Alpaca account equity unavailable. Using simulated equity ${equity:,.2f}."
            )
        result["equity"] = round(equity, 2)
        result["simulated"] = simulated

        allocator = PortfolioAllocator(CONFIG)
        allocations = allocator.allocate(signals, equity)
        result["allocations"] = allocations

        log.info(f"\nTarget Allocations (total equity: ${equity:,.2f}):")
        for ticker, amt in allocations.items():
            log.info(f"  {ticker:<8} ${amt:>10,.2f}")

        # --- Execute ---
        orders = executor.execute(allocations, dry_run=dry_run)
        result["orders"]  = orders
        result["status"]  = "completed"

    except Exception as e:
        log.error(f"run_daily failed: {e}", exc_info=True)
        result["error"] = str(e)

    _append_run_log(result)
    log.info("Daily run complete.\n")
    return result


def main():
    # Set dry_run=False to submit real/paper orders
    DRY_RUN = os.getenv("DRY_RUN", "1") != "0"

    log.info(f"Investment bot started. dry_run={DRY_RUN}")
    log.info(f"Universe: {CONFIG.universe}")
    log.info(f"Scheduled daily at 09:35 ET (after open volatility settles)")

    # Run once immediately on start
    run_daily(dry_run=DRY_RUN)

    # Then schedule every trading day at 09:35
    schedule.every().day.at("09:35").do(run_daily, dry_run=DRY_RUN)

    while True:
        schedule.run_pending()
        time.sleep(60)


if __name__ == "__main__":
    main()
