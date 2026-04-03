"""
Investment Dashboard — Streamlit app
Visualises reports from invest.py: signals, allocations, orders, and run history.

Run with:
    streamlit run app.py
"""

import json
import os
import threading
from datetime import datetime

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

from invest import CONFIG, RUNS_LOG_FILE, run_daily

# ─────────────────────────────────────────────
# Page config
# ─────────────────────────────────────────────

st.set_page_config(
    page_title="Investment Dashboard",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

def load_runs() -> list[dict]:
    if not os.path.exists(RUNS_LOG_FILE):
        return []
    try:
        with open(RUNS_LOG_FILE) as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return []


def fmt_usd(val: float) -> str:
    return f"${val:,.2f}"


def score_color(val: float) -> str:
    if val > 0.1:
        return "green"
    if val < -0.1:
        return "red"
    return "gray"


STATUS_BADGE = {
    "completed":  "🟢 Completed",
    "error":      "🔴 Error",
    "no_equity":  "🟡 No Equity",
}

# ─────────────────────────────────────────────
# Session state
# ─────────────────────────────────────────────

if "running" not in st.session_state:
    st.session_state.running = False
if "run_log_lines" not in st.session_state:
    st.session_state.run_log_lines = []


def _bg_run(dry_run: bool):
    """Called in a background thread so the UI stays responsive."""
    result = run_daily(dry_run=dry_run)
    st.session_state.running = False
    st.session_state.last_result = result


# ─────────────────────────────────────────────
# Sidebar
# ─────────────────────────────────────────────

with st.sidebar:
    st.title("📈 Investment Bot")
    st.divider()

    dry_run = st.toggle("Dry Run (no orders submitted)", value=True)

    run_btn = st.button(
        "▶  Run Now",
        type="primary",
        disabled=st.session_state.running,
        use_container_width=True,
    )

    if run_btn and not st.session_state.running:
        st.session_state.running = True
        t = threading.Thread(target=_bg_run, args=(dry_run,), daemon=True)
        t.start()
        st.rerun()

    if st.session_state.running:
        with st.spinner("Running... this takes a minute"):
            st.info("Fetching signals from Twitter, Polymarket & yFinance...")

    st.divider()
    st.subheader("Config")
    st.caption(f"**Universe** ({len(CONFIG.universe)} tickers)")
    st.code(" | ".join(CONFIG.universe))
    st.caption("**Signal Weights**")
    st.write(f"- Twitter: {CONFIG.twitter_weight:.0%}")
    st.write(f"- Polymarket: {CONFIG.polymarket_weight:.0%}")
    st.write(f"- Momentum: {CONFIG.momentum_weight:.0%}")
    st.caption("**Constraints**")
    st.write(f"- Max position: {CONFIG.max_position_pct:.0%}")
    st.write(f"- Cash reserve: {CONFIG.cash_reserve_pct:.0%}")
    st.write(f"- No leverage / long-only")
    st.divider()
    if st.button("Clear all run history", type="secondary", use_container_width=True):
        if os.path.exists(RUNS_LOG_FILE):
            os.remove(RUNS_LOG_FILE)
        st.rerun()

# ─────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────

runs = load_runs()

# Header
col_title, col_meta = st.columns([3, 1])
with col_title:
    st.title("Investment Dashboard")
with col_meta:
    if runs:
        last = runs[-1]
        ts = datetime.fromisoformat(last["timestamp"]).strftime("%b %d, %Y  %H:%M")
        st.metric("Last Run", ts)
        st.caption(STATUS_BADGE.get(last.get("status", ""), last.get("status", "")))

st.divider()

if not runs:
    st.info("No runs yet. Hit **Run Now** in the sidebar to execute the first cycle.")
    st.stop()

# ─────────────────────────────────────────────
# Top KPI row (latest run)
# ─────────────────────────────────────────────

latest = runs[-1]
signals_df = pd.DataFrame(latest.get("signals", []))
allocs     = latest.get("allocations", {})
orders     = latest.get("orders", [])
equity     = latest.get("equity", 0.0)
poly_score = latest.get("poly_macro_score", 0.0)
invested   = sum(allocs.values())
cash       = equity - invested

k1, k2, k3, k4, k5 = st.columns(5)
k1.metric("Portfolio Equity",   fmt_usd(equity))
k2.metric("Invested",           fmt_usd(invested),  f"{invested/equity:.1%} of equity" if equity else "")
k3.metric("Cash Reserve",       fmt_usd(cash),      f"{cash/equity:.1%} of equity" if equity else "")
k4.metric("Orders This Run",    len(orders),        "dry run" if latest.get("dry_run") else "live")
k5.metric("Macro Score (Poly)", f"{poly_score:+.3f}", "bullish" if poly_score > 0 else "bearish")

st.divider()

# ─────────────────────────────────────────────
# Tabs
# ─────────────────────────────────────────────

tab_signals, tab_portfolio, tab_orders, tab_history, tab_macro = st.tabs([
    "📊 Signals",
    "🥧 Portfolio",
    "📋 Orders",
    "📅 History",
    "🌐 Macro (Polymarket)",
])


# ── Tab 1: Signals ────────────────────────────

with tab_signals:
    if signals_df.empty:
        st.warning("No signal data in the latest run.")
    else:
        # Horizontal bar chart – combined score
        fig = px.bar(
            signals_df.sort_values("combined_score"),
            x="combined_score",
            y="ticker",
            color="combined_score",
            color_continuous_scale=["#d73027", "#f0f0f0", "#1a9850"],
            color_continuous_midpoint=0,
            orientation="h",
            title="Combined Signal Score by Ticker",
            labels={"combined_score": "Score", "ticker": ""},
            height=420,
        )
        fig.update_layout(coloraxis_showscale=False, showlegend=False)
        st.plotly_chart(fig, use_container_width=True)

        # Signal breakdown chart (grouped)
        melt = signals_df.melt(
            id_vars="ticker",
            value_vars=["twitter_score", "polymarket_score", "momentum_score"],
            var_name="signal",
            value_name="score",
        )
        melt["signal"] = melt["signal"].str.replace("_score", "").str.title()
        fig2 = px.bar(
            melt,
            x="ticker",
            y="score",
            color="signal",
            barmode="group",
            title="Signal Breakdown per Ticker",
            color_discrete_map={
                "Twitter":     "#1d9bf0",
                "Polymarket":  "#7c3aed",
                "Momentum":    "#f59e0b",
            },
            height=380,
        )
        fig2.add_hline(y=0, line_dash="dot", line_color="gray")
        st.plotly_chart(fig2, use_container_width=True)

        # Detail table
        st.subheader("Signal Detail Table")
        display = signals_df.copy()
        for col in ["twitter_score", "polymarket_score", "momentum_score", "combined_score"]:
            display[col] = display[col].map(lambda x: f"{x:+.4f}")
        display["confidence"] = display["confidence"].map(lambda x: f"{x:.1%}")
        display.columns = ["Ticker", "Twitter", "Polymarket", "Momentum", "Combined", "Confidence"]
        st.dataframe(display, use_container_width=True, hide_index=True)


# ── Tab 2: Portfolio ──────────────────────────

with tab_portfolio:
    if not allocs:
        st.warning("No allocation data — all signals were negative (cash position).")
    else:
        alloc_df = pd.DataFrame([
            {"Ticker": k, "Allocation ($)": v, "Weight": v / invested}
            for k, v in allocs.items()
        ]).sort_values("Allocation ($)", ascending=False)

        col_pie, col_bar = st.columns(2)

        with col_pie:
            fig = px.pie(
                alloc_df,
                names="Ticker",
                values="Allocation ($)",
                title="Target Allocation",
                hole=0.45,
                color_discrete_sequence=px.colors.qualitative.Set2,
            )
            fig.update_traces(textinfo="label+percent")
            fig.update_layout(showlegend=False)
            st.plotly_chart(fig, use_container_width=True)

        with col_bar:
            fig2 = px.bar(
                alloc_df,
                x="Ticker",
                y="Allocation ($)",
                title="Dollar Allocation",
                text="Allocation ($)",
                color="Allocation ($)",
                color_continuous_scale="Blues",
            )
            fig2.update_traces(texttemplate="$%{text:,.0f}", textposition="outside")
            fig2.update_layout(coloraxis_showscale=False)
            st.plotly_chart(fig2, use_container_width=True)

        st.subheader("Allocation Table")
        alloc_df["Allocation ($)"] = alloc_df["Allocation ($)"].map(fmt_usd)
        alloc_df["Weight"]         = alloc_df["Weight"].map(lambda x: f"{x:.1%}")
        st.dataframe(alloc_df, use_container_width=True, hide_index=True)


# ── Tab 3: Orders ─────────────────────────────

with tab_orders:
    st.subheader(f"Orders — {datetime.fromisoformat(latest['timestamp']).strftime('%b %d, %Y  %H:%M')}")
    st.caption("dry run — no orders submitted" if latest.get("dry_run") else "live orders submitted")

    if not orders:
        st.info("No orders generated (all positions already at target or no signals).")
    else:
        orders_df = pd.DataFrame(orders)
        orders_df["amount"] = orders_df["amount"].map(fmt_usd)
        orders_df["side"]   = orders_df["side"].str.upper()
        orders_df.columns   = ["Ticker", "Side", "Amount"]

        # Colour BUY green / SELL red
        def highlight_side(row):
            color = "#d4edda" if row["Side"] == "BUY" else "#f8d7da"
            return [f"background-color: {color}"] * len(row)

        st.dataframe(
            orders_df.style.apply(highlight_side, axis=1),
            use_container_width=True,
            hide_index=True,
        )

    # All historical orders
    st.divider()
    st.subheader("All Historical Orders")
    all_orders = []
    for run in runs:
        for o in run.get("orders", []):
            all_orders.append({
                "Date":   datetime.fromisoformat(run["timestamp"]).strftime("%Y-%m-%d"),
                "Time":   datetime.fromisoformat(run["timestamp"]).strftime("%H:%M"),
                "Ticker": o["ticker"],
                "Side":   o["side"].upper(),
                "Amount": fmt_usd(o["amount"]),
                "Mode":   "Dry" if run.get("dry_run") else "Live",
            })
    if all_orders:
        hist_df = pd.DataFrame(all_orders)

        def highlight_side2(row):
            color = "#d4edda" if row["Side"] == "BUY" else "#f8d7da"
            return [f"background-color: {color}"] * len(row)

        st.dataframe(
            pd.DataFrame(all_orders).style.apply(highlight_side2, axis=1),
            use_container_width=True,
            hide_index=True,
        )
    else:
        st.info("No orders across any run yet.")


# ── Tab 4: History ────────────────────────────

with tab_history:
    if len(runs) < 2:
        st.info("Need at least 2 runs to show history trends.")
    else:
        # Build time-series of combined scores per ticker
        rows = []
        for run in runs:
            ts = datetime.fromisoformat(run["timestamp"])
            for s in run.get("signals", []):
                rows.append({
                    "Date":    ts,
                    "Ticker":  s["ticker"],
                    "Combined Score":  s["combined_score"],
                    "Twitter Score":   s["twitter_score"],
                    "Momentum Score":  s["momentum_score"],
                })
        hist_df = pd.DataFrame(rows)

        all_tickers = hist_df["Ticker"].unique().tolist()
        selected    = st.multiselect("Tickers to display", all_tickers, default=all_tickers[:5])
        filtered    = hist_df[hist_df["Ticker"].isin(selected)]

        score_col = st.selectbox(
            "Score to plot",
            ["Combined Score", "Twitter Score", "Momentum Score"],
        )

        fig = px.line(
            filtered,
            x="Date",
            y=score_col,
            color="Ticker",
            markers=True,
            title=f"{score_col} Over Time",
            height=400,
        )
        fig.add_hline(y=0, line_dash="dot", line_color="gray")
        st.plotly_chart(fig, use_container_width=True)

    # Run log table
    st.subheader("Run Log")
    run_log_rows = []
    for run in reversed(runs):
        ts = datetime.fromisoformat(run["timestamp"]).strftime("%Y-%m-%d  %H:%M")
        run_log_rows.append({
            "Timestamp":     ts,
            "Status":        STATUS_BADGE.get(run.get("status", ""), run.get("status", "")),
            "Equity":        fmt_usd(run.get("equity", 0)),
            "Invested":      fmt_usd(sum(run.get("allocations", {}).values())),
            "Orders":        len(run.get("orders", [])),
            "Macro Score":   f"{run.get('poly_macro_score', 0):+.3f}",
            "Mode":          "Dry" if run.get("dry_run") else "Live",
        })
    st.dataframe(pd.DataFrame(run_log_rows), use_container_width=True, hide_index=True)


# ── Tab 5: Macro (Polymarket) ─────────────────

with tab_macro:
    st.subheader("Polymarket Macro Signals")
    st.caption("Live probabilities are fetched on each run. Shown here from the latest run.")

    # Extract poly scores per run
    poly_rows = []
    for run in runs:
        poly_rows.append({
            "Date":        datetime.fromisoformat(run["timestamp"]).strftime("%Y-%m-%d"),
            "Macro Score": run.get("poly_macro_score", 0.0),
        })
    poly_df = pd.DataFrame(poly_rows)

    if not poly_df.empty:
        fig = px.bar(
            poly_df,
            x="Date",
            y="Macro Score",
            title="Polymarket Macro Score per Run",
            color="Macro Score",
            color_continuous_scale=["#d73027", "#f0f0f0", "#1a9850"],
            color_continuous_midpoint=0,
        )
        fig.add_hline(y=0, line_dash="dot", line_color="gray")
        fig.update_layout(coloraxis_showscale=False)
        st.plotly_chart(fig, use_container_width=True)

    st.subheader("Monitored Polymarket Markets")
    for slug in CONFIG.polymarket_slugs:
        label = slug.replace("-", " ").title()
        link  = f"https://polymarket.com/event/{slug}"
        direction = (
            "Bearish" if "recession" in slug
            else "Bullish" if ("rate-cut" in slug or "sp500" in slug)
            else "Contextual"
        )
        badge = "🔴" if direction == "Bearish" else "🟢" if direction == "Bullish" else "🟡"
        st.markdown(f"{badge} **[{label}]({link})** — *{direction} signal*")

    st.divider()
    st.caption(
        "Polymarket is a prediction market. Probabilities reflect crowd beliefs, "
        "not guaranteed outcomes. This is for informational use only."
    )

# ─────────────────────────────────────────────
# Auto-refresh while a run is in progress
# ─────────────────────────────────────────────

if st.session_state.running:
    import time
    time.sleep(5)
    st.rerun()
