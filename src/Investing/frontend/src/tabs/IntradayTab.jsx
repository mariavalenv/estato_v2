import { useState, useEffect, useCallback } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'

const tooltipStyle = {
  contentStyle: { backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 },
}

function KPI({ label, value, sub, color }) {
  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
      <p className="text-slate-400 text-xs uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-bold mt-1 truncate ${color ?? 'text-white'}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function Badge({ children, color }) {
  const cls = {
    green:  'bg-green-900/40 text-green-400 border-green-700',
    red:    'bg-red-900/40   text-red-400   border-red-700',
    amber:  'bg-amber-900/40 text-amber-400 border-amber-700',
    slate:  'bg-slate-700   text-slate-300  border-slate-600',
  }[color ?? 'slate']
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded border ${cls}`}>
      {children}
    </span>
  )
}

const fmtUSD = (n) => {
  const abs = Math.abs(n)
  const str = abs.toLocaleString('en-US', { minimumFractionDigits: 2 })
  return n < 0 ? `-$${str}` : `$${str}`
}
const fmtPct = (n) => `${(n * 100).toFixed(2)}%`
const fmtTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

export default function IntradayTab() {
  const [status,   setStatus]   = useState(null)
  const [latest,   setLatest]   = useState(null)
  const [log,      setLog]      = useState([])
  const [dryRun,   setDryRun]   = useState(true)
  const [loading,  setLoading]  = useState(false)

  const fetchAll = useCallback(async () => {
    try {
      const [s, l, lg] = await Promise.all([
        fetch('/api/intraday/status').then(r => r.json()),
        fetch('/api/intraday/latest').then(r => r.json()),
        fetch('/api/intraday/log?limit=50').then(r => r.json()),
      ])
      setStatus(s)
      setLatest(Object.keys(l).length ? l : null)
      setLog(lg)
    } catch { /* backend not ready */ }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Poll every 10s while loop is running
  useEffect(() => {
    if (!status?.running) return
    const id = setInterval(fetchAll, 10_000)
    return () => clearInterval(id)
  }, [status?.running, fetchAll])

  const handleStart = async () => {
    setLoading(true)
    await fetch('/api/intraday/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dry_run: dryRun }),
    })
    await fetchAll()
    setLoading(false)
  }

  const handleStop = async () => {
    await fetch('/api/intraday/stop', { method: 'POST' })
    await fetchAll()
  }

  const handleRunCycle = async () => {
    setLoading(true)
    await fetch('/api/intraday/cycle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dry_run: dryRun }),
    })
    await fetchAll()
    setLoading(false)
  }

  const handleClearLog = async () => {
    if (!window.confirm('Clear all intraday logs?')) return
    await fetch('/api/intraday/log', { method: 'DELETE' })
    setLog([])
    setLatest(null)
  }

  // P&L chart data — one point per cycle
  const pnlChart = log
    .filter(c => c.status === 'completed')
    .map(c => ({
      time:    fmtTime(c.timestamp),
      pnl:     c.daily_pnl ?? 0,
      pnlPct:  (c.daily_pnl_pct ?? 0) * 100,
    }))

  const intraSignals = latest?.intraday_signals ?? {}
  const pairsSignals = latest?.pairs_signals    ?? []
  const latestOrders = latest?.orders           ?? []
  const dailyPnl     = latest?.daily_pnl        ?? 0
  const dailyPnlPct  = latest?.daily_pnl_pct    ?? 0
  const equity       = latest?.equity           ?? 0
  const killSwitch   = latest?.kill_switch      ?? false
  const cyclesTotal  = log.filter(c => c.status === 'completed').length

  const marketOpen = status?.market_open ?? false
  const isRunning  = status?.running     ?? false

  return (
    <div className="space-y-5">

      {/* ── Header bar ── */}
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`h-2.5 w-2.5 rounded-full ${marketOpen ? 'bg-green-400 animate-pulse' : 'bg-slate-500'}`} />
          <span className="text-sm font-medium text-white">
            NYSE {marketOpen ? 'OPEN' : 'CLOSED'}
          </span>
          {!marketOpen && status?.minutes_to_open != null && (
            <span className="text-slate-400 text-xs">opens in {status.minutes_to_open} min</span>
          )}
          {isRunning && (
            <Badge color="green">Loop active · every {status.cycle_interval_mins}min</Badge>
          )}
          {killSwitch && (
            <Badge color="red">Kill switch triggered</Badge>
          )}
          {latest?.simulated && (
            <Badge color="amber">Simulated · no Alpaca</Badge>
          )}
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-sm text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={e => setDryRun(e.target.checked)}
              className="accent-blue-500 cursor-pointer"
            />
            Dry Run
          </label>

          {!isRunning ? (
            <button
              onClick={handleStart}
              disabled={loading}
              className="bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
            >
              ▶ Start Loop
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="bg-red-600 hover:bg-red-500 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
            >
              ■ Stop Loop
            </button>
          )}

          <button
            onClick={handleRunCycle}
            disabled={loading || isRunning}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
          >
            ⚡ Run Cycle
          </button>

          <button
            onClick={handleClearLog}
            className="text-slate-500 hover:text-red-400 text-sm px-2 py-1.5 rounded transition-colors"
            title="Clear intraday log"
          >
            🗑
          </button>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPI
          label="Daily P&L"
          value={fmtUSD(dailyPnl)}
          sub={fmtPct(Math.abs(dailyPnlPct))}
          color={dailyPnl >= 0 ? 'text-green-400' : 'text-red-400'}
        />
        <KPI label="Portfolio Equity" value={fmtUSD(equity)} />
        <KPI label="Cycles Today" value={cyclesTotal} sub="completed cycles" />
        <KPI
          label="Orders Today"
          value={log.reduce((s, c) => s + (c.orders?.length ?? 0), 0)}
          sub={dryRun ? 'dry run' : 'live'}
        />
      </div>

      {/* ── P&L chart ── */}
      {pnlChart.length > 1 && (
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h2 className="text-white font-semibold mb-4">Intraday P&L</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={pnlChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={v => `$${v}`} />
              <Tooltip
                {...tooltipStyle}
                formatter={(v) => [`$${v.toFixed(2)}`, 'P&L']}
              />
              <ReferenceLine y={0} stroke="#475569" strokeDasharray="4 4" />
              <Line
                type="monotone"
                dataKey="pnl"
                stroke={dailyPnl >= 0 ? '#22c55e' : '#ef4444'}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* ── Intraday signals ── */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h2 className="text-white font-semibold mb-3">Intraday Signals</h2>
          {Object.keys(intraSignals).length === 0 ? (
            <p className="text-slate-500 text-sm">No signals yet — run a cycle.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-slate-700 text-left">
                  <th className="py-1.5 pr-3">Ticker</th>
                  <th className="py-1.5 pr-3">Signal</th>
                  <th className="py-1.5">Action</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(intraSignals)
                  .sort(([, a], [, b]) => b - a)
                  .map(([ticker, sig]) => (
                    <tr key={ticker} className="border-b border-slate-700/50">
                      <td className="py-1.5 pr-3 font-medium text-white">{ticker}</td>
                      <td className="py-1.5 pr-3 font-mono"
                        style={{ color: sig > 0 ? '#22c55e' : sig < 0 ? '#ef4444' : '#94a3b8' }}>
                        {sig >= 0 ? '+' : ''}{sig.toFixed(3)}
                      </td>
                      <td className="py-1.5">
                        {sig > 0.1
                          ? <Badge color="green">BUY</Badge>
                          : sig < -0.1
                            ? <Badge color="red">AVOID</Badge>
                            : <Badge color="slate">HOLD</Badge>
                        }
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Pairs arb ── */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h2 className="text-white font-semibold mb-3">Pairs Arbitrage</h2>
          {pairsSignals.length === 0 ? (
            <p className="text-slate-500 text-sm">
              No pairs opportunities detected (|z-score| &lt; entry threshold).
            </p>
          ) : (
            <div className="space-y-3">
              {pairsSignals.map((p, i) => (
                <div key={i} className="bg-slate-700/50 rounded-lg p-3 text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-white">
                      {p.ticker_a} / {p.ticker_b}
                    </span>
                    <span className="font-mono text-xs"
                      style={{ color: p.zscore > 0 ? '#ef4444' : '#22c55e' }}>
                      z = {p.zscore >= 0 ? '+' : ''}{p.zscore.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Badge color={p.action_a === 'buy' ? 'green' : 'red'}>
                      {p.action_a.toUpperCase()} {p.ticker_a}
                    </Badge>
                    <Badge color={p.action_b === 'buy' ? 'green' : 'red'}>
                      {p.action_b.toUpperCase()} {p.ticker_b}
                    </Badge>
                    <span className="text-slate-400 text-xs self-center">
                      strength {(p.strength * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Latest orders ── */}
      {latestOrders.length > 0 && (
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h2 className="text-white font-semibold mb-3">Last Cycle Orders</h2>
          <div className="flex flex-wrap gap-2">
            {latestOrders.map((o, i) => (
              <div key={i} className="bg-slate-700 rounded-lg px-3 py-2 text-sm flex items-center gap-2">
                <Badge color={o.side === 'buy' ? 'green' : 'red'}>
                  {o.side.toUpperCase()}
                </Badge>
                <span className="font-medium text-white">{o.ticker}</span>
                <span className="font-mono text-slate-300">{fmtUSD(o.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Cycle log ── */}
      {log.length > 0 && (
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h2 className="text-white font-semibold mb-3">Cycle Log</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-slate-700 text-left">
                  <th className="py-2 pr-4">Time</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4 text-right">Daily P&L</th>
                  <th className="py-2 pr-4 text-right">Orders</th>
                  <th className="py-2 pr-4">Pairs</th>
                  <th className="py-2">Mode</th>
                </tr>
              </thead>
              <tbody>
                {[...log].reverse().slice(0, 30).map((c, i) => {
                  const pnl    = c.daily_pnl ?? 0
                  const status = c.status
                  return (
                    <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                      <td className="py-1.5 pr-4 text-slate-300 whitespace-nowrap font-mono text-xs">
                        {fmtTime(c.timestamp)}
                      </td>
                      <td className="py-1.5 pr-4">
                        {status === 'completed'    && <Badge color="green">✓ Done</Badge>}
                        {status === 'market_closed' && <Badge color="slate">Closed</Badge>}
                        {status === 'kill_switch'   && <Badge color="red">Kill switch</Badge>}
                        {status === 'error'         && <Badge color="red">Error</Badge>}
                      </td>
                      <td className="py-1.5 pr-4 text-right font-mono"
                        style={{ color: pnl >= 0 ? '#22c55e' : '#ef4444' }}>
                        {fmtUSD(pnl)}
                      </td>
                      <td className="py-1.5 pr-4 text-right text-slate-300">
                        {c.orders?.length ?? 0}
                      </td>
                      <td className="py-1.5 pr-4 text-slate-300">
                        {c.pairs_signals?.length ?? 0}
                      </td>
                      <td className="py-1.5">
                        <span className={`text-xs ${c.dry_run ? 'text-amber-400' : 'text-green-400'}`}>
                          {c.dry_run ? 'Dry' : 'Live'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {log.length === 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-10 text-center">
          <p className="text-4xl mb-3">⚡</p>
          <p className="text-slate-300 font-medium">No intraday cycles yet</p>
          <p className="text-slate-500 text-sm mt-1">
            Click <span className="text-white font-medium">▶ Start Loop</span> to begin
            trading every {status?.cycle_interval_mins ?? 15} minutes during market hours,
            or <span className="text-white font-medium">⚡ Run Cycle</span> to run once now.
          </p>
        </div>
      )}
    </div>
  )
}
