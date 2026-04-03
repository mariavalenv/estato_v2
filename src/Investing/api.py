"""
FastAPI backend for the Investment Dashboard.
Wraps invest.py and exposes REST endpoints consumed by the React frontend.

Run with:
    uvicorn api:app --reload --port 8000
"""

import json
import os
import threading
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from invest import CONFIG, RUNS_LOG_FILE, run_daily
from quant_engine import load_latest_research, run_research_pipeline
from intraday_engine import (
    start_intraday_loop, stop_intraday_loop, get_intraday_status,
    run_intraday_cycle, load_intraday_log, INTRADAY_LOG_FILE,
)
from backtest_engine import (
    run_backtest, run_parameter_sweep, load_backtest_results, load_sweep_results,
    BacktestConfig, BACKTEST_FILE,
)

app = FastAPI(title="Investment Dashboard API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # allows any localhost port — safe for local dev
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Run state ────────────────────────────────────────────────────────────────

_running = False
_run_error: Optional[str] = None

_research_running = False
_research_error: Optional[str] = None


def _load_runs() -> list:
    if not os.path.exists(RUNS_LOG_FILE):
        return []
    try:
        with open(RUNS_LOG_FILE) as f:
            return json.load(f)
    except Exception:
        return []


# ── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/api/runs")
def get_runs():
    """Return all historical run results."""
    return _load_runs()


@app.get("/api/runs/latest")
def get_latest_run():
    """Return the most recent run result."""
    runs = _load_runs()
    return runs[-1] if runs else {}


@app.get("/api/status")
def get_status():
    """Return whether a run is currently in progress."""
    return {"running": _running, "error": _run_error}


@app.get("/api/config")
def get_config():
    """Return the current algorithm configuration."""
    return {
        "universe":          CONFIG.universe,
        "polymarket_slugs":  CONFIG.polymarket_slugs,
        "twitter_weight":    CONFIG.twitter_weight,
        "polymarket_weight": CONFIG.polymarket_weight,
        "momentum_weight":   CONFIG.momentum_weight,
        "max_position_pct":  CONFIG.max_position_pct,
        "cash_reserve_pct":  CONFIG.cash_reserve_pct,
        "tweet_count":       CONFIG.tweet_count,
    }


class RunRequest(BaseModel):
    dry_run: bool = True


@app.post("/api/run")
def trigger_run(body: RunRequest):
    """Trigger a new daily investment cycle in the background."""
    global _running, _run_error
    if _running:
        raise HTTPException(status_code=409, detail="A run is already in progress.")

    _running = True
    _run_error = None

    def _bg():
        global _running, _run_error
        try:
            run_daily(dry_run=body.dry_run)
        except Exception as e:
            _run_error = str(e)
        finally:
            _running = False

    threading.Thread(target=_bg, daemon=True).start()
    return {"message": "Run started", "dry_run": body.dry_run}


@app.delete("/api/runs")
def clear_runs():
    """Delete the entire run history log."""
    if os.path.exists(RUNS_LOG_FILE):
        os.remove(RUNS_LOG_FILE)
    return {"message": "Run history cleared."}


# ── Research endpoints ───────────────────────────────────────────────────────

@app.get("/api/research")
def get_research():
    """Return the latest quantitative research pipeline results."""
    return load_latest_research()


@app.get("/api/research/status")
def get_research_status():
    return {"running": _research_running, "error": _research_error}


class ResearchRequest(BaseModel):
    quick_mode: bool = False
    turbo_mode: bool = False


@app.post("/api/research/run")
def trigger_research(body: ResearchRequest):
    """Run the full 9-stage quantitative research pipeline in the background."""
    global _research_running, _research_error
    if _research_running:
        raise HTTPException(status_code=409, detail="Research pipeline is already running.")

    _research_running = True
    _research_error   = None

    def _bg():
        global _research_running, _research_error
        try:
            run_research_pipeline(
                CONFIG.universe,
                quick_mode=body.quick_mode,
                turbo_mode=body.turbo_mode,
            )
        except Exception as e:
            _research_error = str(e)
        finally:
            _research_running = False

    threading.Thread(target=_bg, daemon=True).start()
    mode = "turbo" if body.turbo_mode else "quick" if body.quick_mode else "full"
    return {"message": f"Research pipeline started ({mode} mode)"}


# ── Intraday trading endpoints ───────────────────────────────────────────────

@app.get("/api/intraday/status")
def intraday_status():
    """Return intraday loop status and market hours."""
    return get_intraday_status()


@app.get("/api/intraday/log")
def intraday_log(limit: int = 100):
    """Return recent intraday cycle results."""
    return load_intraday_log(limit=limit)


@app.get("/api/intraday/latest")
def intraday_latest():
    """Return the most recent intraday cycle result."""
    records = load_intraday_log(limit=1)
    return records[0] if records else {}


class IntradayRequest(BaseModel):
    dry_run: bool = True


@app.post("/api/intraday/start")
def start_intraday(body: IntradayRequest):
    """Start the continuous intraday trading loop."""
    start_intraday_loop(dry_run=body.dry_run)
    return {"message": "Intraday trading loop started", "dry_run": body.dry_run}


@app.post("/api/intraday/stop")
def stop_intraday():
    """Stop the intraday trading loop."""
    stop_intraday_loop()
    return {"message": "Intraday trading loop stop requested"}


@app.post("/api/intraday/cycle")
def run_single_intraday_cycle(body: IntradayRequest):
    """Run a single intraday cycle immediately (foreground)."""
    result = run_intraday_cycle(dry_run=body.dry_run)
    return result


@app.delete("/api/intraday/log")
def clear_intraday_log():
    """Clear the intraday cycle log."""
    if os.path.exists(INTRADAY_LOG_FILE):
        os.remove(INTRADAY_LOG_FILE)
    return {"message": "Intraday log cleared."}


# ── Backtest endpoints ───────────────────────────────────────────────────────

_backtest_running = False
_backtest_error: Optional[str] = None


@app.get("/api/backtest")
def get_backtest():
    """Return the latest backtest results."""
    return load_backtest_results()


@app.get("/api/backtest/sweep")
def get_sweep():
    """Return the latest parameter sweep results."""
    return load_sweep_results()


@app.get("/api/backtest/status")
def get_backtest_status():
    return {"running": _backtest_running, "error": _backtest_error}


class BacktestRequest(BaseModel):
    lookback_days:    int   = 365
    initial_capital:  float = 100_000.0
    rsi_oversold:     float = 35.0
    zscore_entry:     float = 1.5


@app.post("/api/backtest/run")
def trigger_backtest(body: BacktestRequest):
    """Run a full historical backtest in the background."""
    global _backtest_running, _backtest_error
    if _backtest_running:
        raise HTTPException(status_code=409, detail="Backtest already running.")

    _backtest_running = True
    _backtest_error   = None

    def _bg():
        global _backtest_running, _backtest_error
        try:
            cfg = BacktestConfig(
                lookback_days=body.lookback_days,
                initial_capital=body.initial_capital,
                rsi_oversold=body.rsi_oversold,
                zscore_entry=body.zscore_entry,
            )
            run_backtest(cfg)
        except Exception as e:
            _backtest_error = str(e)
        finally:
            _backtest_running = False

    threading.Thread(target=_bg, daemon=True).start()
    return {"message": f"Backtest started ({body.lookback_days}d lookback)"}


class SweepRequest(BaseModel):
    lookback_days:   int   = 180
    initial_capital: float = 100_000.0


@app.post("/api/backtest/sweep")
def trigger_sweep(body: SweepRequest):
    """Run a parameter optimisation sweep in the background."""
    global _backtest_running, _backtest_error
    if _backtest_running:
        raise HTTPException(status_code=409, detail="Backtest already running.")

    _backtest_running = True
    _backtest_error   = None

    def _bg():
        global _backtest_running, _backtest_error
        try:
            run_parameter_sweep(
                lookback_days=body.lookback_days,
                initial_capital=body.initial_capital,
            )
        except Exception as e:
            _backtest_error = str(e)
        finally:
            _backtest_running = False

    threading.Thread(target=_bg, daemon=True).start()
    return {"message": "Parameter sweep started"}


@app.delete("/api/backtest")
def clear_backtest():
    if os.path.exists(BACKTEST_FILE):
        os.remove(BACKTEST_FILE)
    return {"message": "Backtest results cleared."}


# ── Serve built React app in production ─────────────────────────────────────
# Uncomment after running `npm run build` in frontend/:
#
# app.mount("/", StaticFiles(directory="frontend/dist", html=True), name="static")
