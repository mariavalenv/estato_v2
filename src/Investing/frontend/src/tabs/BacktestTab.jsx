import { useState, useEffect, useCallback } from 'react'
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'

const tooltipStyle = {
  contentStyle: { backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 },
}

const fmt = (n) => n?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '—'
const fmtPct  = (n) => n != null ? `${n >= 0 ? '+' : ''}${n.toFixed(2)}%` : '—'
const fmtSign = (n) => n != null ? `${n >= 0 ? '+' : ''}$${fmt(Math.abs(n))}` : '—'

function MetricCard({ label, value, color, sub }) {
  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
      <p className="text-slate-400 text-xs uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-bold mt-1 ${color ?? 'text-white'}`}>{value ?? '—'}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
      <h2 className="text-white font-semibold mb-4">{title}</h2>
      {children}
    </div>
  )
}

export default function BacktestTab() {
  const [results,  setResults]  = useState(null)
  const [sweep,    setSweep]    = useState(null)
  const [status,   setStatus]   = useState({ running: false, error: null })

  // Form state
  const [lookback, setLookback] = useState(365)
  const [capital,  setCapital]  = useState(100000)
  const [rsiOS,    setRsiOS]    = useState(35)
  const [zEntry,   setZEntry]   = useState(1.5)

  const fetchAll = useCallback(async () => {
    try {
      const [r, s, st] = await Promise.all([
        fetch('/api/backtest').then(x => x.json()),
        fetch('/api/backtest/sweep').then(x => x.json()),
        fetch('/api/backtest/status').then(x => x.json()),
      ])
      setResults(Object.keys(r).length ? r : null)
      setSweep(Object.keys(s).length ? s : null)
      setStatus(st)
    } catch { /* backend not ready */ }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  useEffect(() => {
    if (!status.running) return
    const id = setInterval(fetchAll, 6000)
    return () => clearInterval(id)
  }, [status.running, fetchAll])

  const handleRun = async () => {
    await fetch('/api/backtest/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lookback_days:   lookback,
        initial_capital: capital,
        rsi_oversold:    rsiOS,
        zscore_entry:    zEntry,
      }),
    })
    setStatus(s => ({ ...s, running: true }))
    setTimeout(fetchAll, 1000)
  }

  const handleSweep = async () => {
    await fetch('/api/backtest/sweep', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lookback_days: Math.min(lookback, 180), initial_capital: capital }),
    })
    setStatus(s => ({ ...s, running: true }))
    setTimeout(fetchAll, 1000)
  }

  const handleClear = async () => {
    if (!window.confirm('Clear backtest results?')) return
    await fetch('/api/backtest', { method: 'DELETE' })
    setResults(null)
  }

  const m  = results?.metrics ?? {}
  const ec = results?.equity_curve ?? []

  // Format equity curve for chart — downsample if large
  const step      = Math.max(1, Math.floor(ec.length / 120))
  const chartData = ec.filter((_, i) => i % step === 0).map(d => ({
    date:   d.date?.slice(5),   // "MM-DD"
    equity: d.equity,
    gain:   d.equity - (results?.config?.initial_capital ?? 100000),
  }))

  const returnColor = (m.total_return_pct ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'

  return (
    <div className="space-y-5">

      {/* ── Controls ── */}
      <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
        <h2 className="text-white font-semibold mb-4">Run Historical Backtest</h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <label className="block">
            <span className="text-slate-400 text-xs">Lookback (days)</span>
            <select
              value={lookback}
              onChange={e => setLookback(Number(e.target.value))}
              className="mt-1 w-full bg-slate-700 border border-slate-600 text-white text-sm rounded-lg px-3 py-1.5"
            >
              <option value={90}>90 days (3 months)</option>
              <option value={180}>180 days (6 months)</option>
              <option value={365}>365 days (1 year)</option>
              <option value={730}>730 days (2 years)</option>
            </select>
          </label>

          <label className="block">
            <span className="text-slate-400 text-xs">Starting Capital</span>
            <select
              value={capital}
              onChange={e => setCapital(Number(e.target.value))}
              className="mt-1 w-full bg-slate-700 border border-slate-600 text-white text-sm rounded-lg px-3 py-1.5"
            >
              <option value={25000}>$25,000</option>
              <option value={50000}>$50,000</option>
              <option value={100000}>$100,000</option>
              <option value={250000}>$250,000</option>
              <option value={500000}>$500,000</option>
            </select>
          </label>

          <label className="block">
            <span className="text-slate-400 text-xs">RSI Oversold level</span>
            <select
              value={rsiOS}
              onChange={e => setRsiOS(Number(e.target.value))}
              className="mt-1 w-full bg-slate-700 border border-slate-600 text-white text-sm rounded-lg px-3 py-1.5"
            >
              <option value={25}>25 (aggressive)</option>
              <option value={30}>30</option>
              <option value={35}>35 (default)</option>
              <option value={40}>40 (conservative)</option>
            </select>
          </label>

          <label className="block">
            <span className="text-slate-400 text-xs">Pairs Z-score entry</span>
            <select
              value={zEntry}
              onChange={e => setZEntry(Number(e.target.value))}
              className="mt-1 w-full bg-slate-700 border border-slate-600 text-white text-sm rounded-lg px-3 py-1.5"
            >
              <option value={1.2}>1.2 (aggressive)</option>
              <option value={1.5}>1.5 (default)</option>
              <option value={2.0}>2.0</option>
              <option value={2.5}>2.5 (conservative)</option>
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleRun}
            disabled={status.running}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
          >
            {status.running ? '⏳ Running…' : '▶ Run Backtest'}
          </button>

          <button
            onClick={handleSweep}
            disabled={status.running}
            className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
          >
            🔍 Optimise Parameters
          </button>

          {results && (
            <button
              onClick={handleClear}
              className="text-slate-500 hover:text-red-400 text-sm px-3 py-2 rounded transition-colors"
            >
              🗑 Clear
            </button>
          )}

          {status.running && (
            <span className="text-amber-400 text-sm animate-pulse">
              Downloading historical data & simulating… (this takes 1–5 min)
            </span>
          )}

          {status.error && (
            <span className="text-red-400 text-sm">Error: {status.error}</span>
          )}
        </div>

        <p className="text-slate-500 text-xs mt-3">
          Data source: Yahoo Finance 1-hour bars (max 2 years).
          Costs: 0.05% transaction + 0.02% slippage per trade. No look-ahead bias.
        </p>
      </div>

      {/* ── Empty state ── */}
      {!results && !status.running && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-10 text-center">
          <p className="text-4xl mb-3">📈</p>
          <p className="text-slate-300 font-medium">No backtest results yet</p>
          <p className="text-slate-500 text-sm mt-1">
            Configure the parameters above and click <span className="text-white font-medium">▶ Run Backtest</span>.
          </p>
        </div>
      )}

      {results && (
        <>
          {/* ── Metrics ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard
              label="Total Return"
              value={fmtPct(m.total_return_pct)}
              color={returnColor}
              sub={`${m.trading_days ?? '?'} trading days`}
            />
            <MetricCard
              label="Ann. Return"
              value={fmtPct(m.annualized_return_pct)}
              color={(m.annualized_return_pct ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}
            />
            <MetricCard
              label="Est. Monthly P&L"
              value={fmtSign(m.estimated_monthly_pnl)}
              color={(m.estimated_monthly_pnl ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}
              sub={`on $${(results?.config?.initial_capital ?? 0).toLocaleString()} capital`}
            />
            <MetricCard
              label="Final Equity"
              value={`$${fmt(m.final_equity)}`}
              sub={`started $${(results?.config?.initial_capital ?? 0).toLocaleString()}`}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard
              label="Sharpe Ratio"
              value={m.sharpe_ratio?.toFixed(3)}
              color={(m.sharpe_ratio ?? 0) >= 1 ? 'text-green-400' : (m.sharpe_ratio ?? 0) >= 0.5 ? 'text-amber-400' : 'text-red-400'}
              sub="≥1.0 = good"
            />
            <MetricCard
              label="Sortino Ratio"
              value={m.sortino_ratio?.toFixed(3)}
              color={(m.sortino_ratio ?? 0) >= 1 ? 'text-green-400' : 'text-slate-300'}
            />
            <MetricCard
              label="Max Drawdown"
              value={`-${m.max_drawdown_pct?.toFixed(2)}%`}
              color={(m.max_drawdown_pct ?? 0) < 10 ? 'text-green-400' : (m.max_drawdown_pct ?? 0) < 20 ? 'text-amber-400' : 'text-red-400'}
              sub="< 10% = great"
            />
            <MetricCard
              label="Win Rate"
              value={`${m.win_rate_pct?.toFixed(1)}%`}
              color={(m.win_rate_pct ?? 0) >= 55 ? 'text-green-400' : 'text-slate-300'}
              sub={`${m.total_trades ?? 0} total trades`}
            />
          </div>

          {/* ── Equity curve ── */}
          {chartData.length > 2 && (
            <Section title="Portfolio Equity Curve">
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip
                    {...tooltipStyle}
                    formatter={v => [`$${fmt(v)}`, 'Equity']}
                  />
                  <ReferenceLine
                    y={results?.config?.initial_capital}
                    stroke="#475569"
                    strokeDasharray="4 4"
                    label={{ value: 'Start', fill: '#64748b', fontSize: 10 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="equity"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="url(#eqGrad)"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Section>
          )}

          {/* ── Recent trades ── */}
          {results.recent_trades?.length > 0 && (
            <Section title={`Recent Trades (last ${Math.min(results.recent_trades.length, 50)})`}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-700 text-left">
                      <th className="py-2 pr-4">Date</th>
                      <th className="py-2 pr-4">Ticker</th>
                      <th className="py-2 pr-4">Side</th>
                      <th className="py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...results.recent_trades].reverse().slice(0, 50).map((t, i) => (
                      <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                        <td className="py-1.5 pr-4 text-slate-400 text-xs font-mono">{t.date}</td>
                        <td className="py-1.5 pr-4 font-medium text-white">{t.ticker}</td>
                        <td className="py-1.5 pr-4">
                          <span className={`text-xs font-medium ${t.side === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                            {t.side.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-1.5 text-right font-mono text-slate-300">
                          ${fmt(t.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}
        </>
      )}

      {/* ── Parameter sweep results ── */}
      {sweep?.all_results?.length > 0 && (
        <Section title="Parameter Optimisation Results (sorted by Sharpe Ratio)">
          {sweep.best_params && (
            <div className="bg-blue-900/30 border border-blue-700 rounded-lg px-4 py-2 mb-4 text-sm text-blue-200">
              <strong>Best parameters:</strong> RSI oversold={sweep.best_params.rsi_oversold},
              Z-score entry={sweep.best_params.zscore_entry} →
              Sharpe={sweep.best_params.sharpe_ratio?.toFixed(3)},
              Return={fmtPct(sweep.best_params.total_return_pct)}
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-slate-700 text-left">
                  <th className="py-2 pr-4">RSI Oversold</th>
                  <th className="py-2 pr-4">Z-score Entry</th>
                  <th className="py-2 pr-4 text-right">Total Return</th>
                  <th className="py-2 pr-4 text-right">Ann. Return</th>
                  <th className="py-2 pr-4 text-right">Sharpe</th>
                  <th className="py-2 pr-4 text-right">Max DD</th>
                  <th className="py-2 text-right">Win Rate</th>
                </tr>
              </thead>
              <tbody>
                {sweep.all_results.map((r, i) => (
                  <tr key={i}
                    className={`border-b border-slate-700/50 hover:bg-slate-700/20
                      ${i === 0 ? 'bg-blue-900/20' : ''}`}
                  >
                    <td className="py-1.5 pr-4 font-medium text-white">{r.rsi_oversold}</td>
                    <td className="py-1.5 pr-4 text-white">{r.zscore_entry}</td>
                    <td className="py-1.5 pr-4 text-right font-mono"
                      style={{ color: r.total_return_pct >= 0 ? '#22c55e' : '#ef4444' }}>
                      {fmtPct(r.total_return_pct)}
                    </td>
                    <td className="py-1.5 pr-4 text-right font-mono"
                      style={{ color: r.annualized_return_pct >= 0 ? '#22c55e' : '#ef4444' }}>
                      {fmtPct(r.annualized_return_pct)}
                    </td>
                    <td className="py-1.5 pr-4 text-right font-mono text-slate-300">
                      {r.sharpe_ratio?.toFixed(3)}
                    </td>
                    <td className="py-1.5 pr-4 text-right font-mono"
                      style={{ color: r.max_drawdown_pct < 10 ? '#22c55e' : r.max_drawdown_pct < 20 ? '#f59e0b' : '#ef4444' }}>
                      -{r.max_drawdown_pct?.toFixed(1)}%
                    </td>
                    <td className="py-1.5 text-right font-mono text-slate-300">
                      {r.win_rate_pct?.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </div>
  )
}
