import { useState, useEffect, useCallback } from 'react'
import SignalsTab   from './tabs/SignalsTab'
import PortfolioTab from './tabs/PortfolioTab'
import OrdersTab    from './tabs/OrdersTab'
import HistoryTab   from './tabs/HistoryTab'
import MacroTab     from './tabs/MacroTab'
import ResearchTab  from './tabs/ResearchTab'
import IntradayTab  from './tabs/IntradayTab'
import BacktestTab  from './tabs/BacktestTab'

const TABS        = ['Intraday', 'Backtest', 'Signals', 'Portfolio', 'Orders', 'History', 'Macro', 'Research']
const ALWAYS_SHOW = new Set(['Intraday', 'Backtest', 'Research'])

function KPICard({ label, value, sub, trend }) {
  const subColor =
    trend === 'up'   ? 'text-green-400' :
    trend === 'down' ? 'text-red-400'   : 'text-slate-400'
  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
      <p className="text-slate-400 text-xs uppercase tracking-wide">{label}</p>
      <p className="text-xl font-bold text-white mt-1 truncate">{value}</p>
      {sub && <p className={`text-xs mt-1 ${subColor}`}>{sub}</p>}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-10 text-center">
      <p className="text-4xl mb-3">📊</p>
      <p className="text-slate-300 font-medium">No daily runs yet</p>
      <p className="text-slate-500 text-sm mt-1">
        Click <span className="text-white font-medium">▶ Run Now</span> in the header to start the first cycle.
      </p>
    </div>
  )
}

function Spinner() {
  return (
    <span className="inline-block h-4 w-4 rounded-full border-2 border-slate-600 border-t-blue-400 animate-spin" />
  )
}

export default function App() {
  const [runs,      setRuns]      = useState([])
  const [config,    setConfig]    = useState(null)
  const [status,    setStatus]    = useState({ running: false, error: null })
  const [activeTab, setActiveTab] = useState('Intraday')
  const [dryRun,    setDryRun]    = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const [runsRes, configRes, statusRes] = await Promise.all([
        fetch('/api/runs'),
        fetch('/api/config'),
        fetch('/api/status'),
      ])
      setRuns(await runsRes.json())
      setConfig(await configRes.json())
      setStatus(await statusRes.json())
    } catch {/* backend not ready yet */}
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Poll every 5 s while a run is in progress
  useEffect(() => {
    if (!status.running) return
    const id = setInterval(fetchData, 5000)
    return () => clearInterval(id)
  }, [status.running, fetchData])

  const handleRun = async () => {
    await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dry_run: dryRun }),
    })
    setStatus(s => ({ ...s, running: true }))
    fetchData()
  }

  const handleClear = async () => {
    if (!window.confirm('Clear all run history? This cannot be undone.')) return
    await fetch('/api/runs', { method: 'DELETE' })
    setRuns([])
  }

  const latest     = runs[runs.length - 1]
  const equity     = latest?.equity ?? 0
  const simulated  = latest?.simulated ?? false
  const invested   = latest ? Object.values(latest.allocations ?? {}).reduce((a, b) => a + b, 0) : 0
  const cash       = equity - invested
  const orders     = latest?.orders ?? []
  const macro      = latest?.poly_macro_score ?? 0

  const fmt = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans">

      {/* ── Header ── */}
      <header className="sticky top-0 z-20 border-b border-slate-700 bg-slate-900/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <h1 className="text-lg font-bold whitespace-nowrap">📈 Investment Dashboard</h1>
            {latest && (
              <span className="hidden sm:block text-slate-400 text-sm truncate">
                Last run: {new Date(latest.timestamp).toLocaleString()}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {status.running && (
              <span className="flex items-center gap-2 text-amber-400 text-sm">
                <Spinner /> Running…
              </span>
            )}

            <label className="flex items-center gap-1.5 text-sm text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={dryRun}
                onChange={e => setDryRun(e.target.checked)}
                className="accent-blue-500 cursor-pointer"
              />
              Dry Run
            </label>

            <button
              onClick={handleRun}
              disabled={status.running}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed
                         text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
            >
              {status.running ? 'Running…' : '▶ Run Now'}
            </button>

            <button
              onClick={handleClear}
              className="text-slate-500 hover:text-red-400 text-sm px-2 py-1.5 rounded transition-colors"
              title="Clear history"
            >
              🗑
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">

        {/* ── KPI row ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          <KPICard
            label="Portfolio Equity"
            value={`$${fmt(equity)}`}
            sub={simulated ? 'simulated (no Alpaca)' : undefined}
            trend={simulated ? undefined : undefined}
          />
          <KPICard
            label="Invested"
            value={`$${fmt(invested)}`}
            sub={equity ? `${((invested / equity) * 100).toFixed(1)}% of equity` : '—'}
          />
          <KPICard
            label="Cash Reserve"
            value={`$${fmt(cash)}`}
            sub={equity ? `${((cash / equity) * 100).toFixed(1)}% of equity` : '—'}
          />
          <KPICard
            label="Orders This Run"
            value={orders.length}
            sub={latest ? (latest.dry_run ? 'dry run' : 'live') : '—'}
          />
          <KPICard
            label="Macro Score"
            value={latest ? `${macro >= 0 ? '+' : ''}${macro.toFixed(3)}` : 'N/A'}
            sub={latest ? (macro > 0 ? 'Bullish' : 'Bearish') : '—'}
            trend={macro > 0 ? 'up' : 'down'}
          />
        </div>

        {/* ── Error banner ── */}
        {status.error && (
          <div className="bg-red-900/30 border border-red-700 rounded-xl px-4 py-3 text-red-300 text-sm">
            <strong>Error:</strong> {status.error}
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="flex gap-0.5 border-b border-slate-700 overflow-x-auto">
          {TABS.map(tab => (
            (ALWAYS_SHOW.has(tab) || runs.length > 0) && (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2.5 text-sm font-medium whitespace-nowrap transition-colors rounded-t-lg
                  ${activeTab === tab
                    ? 'bg-slate-800 text-white border border-b-slate-800 border-slate-700'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                  }`}
              >
                {tab}
              </button>
            )
          ))}
        </div>

        <div>
          {activeTab === 'Intraday'  && <IntradayTab />}
          {activeTab === 'Backtest'  && <BacktestTab />}
          {activeTab === 'Signals'   && (runs.length > 0
            ? <SignalsTab   run={latest} />
            : <EmptyState />
          )}
          {activeTab === 'Portfolio' && (runs.length > 0
            ? <PortfolioTab run={latest} />
            : <EmptyState />
          )}
          {activeTab === 'Orders'    && (runs.length > 0
            ? <OrdersTab    runs={runs} />
            : <EmptyState />
          )}
          {activeTab === 'History'   && (runs.length > 0
            ? <HistoryTab   runs={runs} />
            : <EmptyState />
          )}
          {activeTab === 'Macro'     && (runs.length > 0
            ? <MacroTab     runs={runs} config={config} />
            : <EmptyState />
          )}
          {activeTab === 'Research'  && <ResearchTab />}
        </div>
      </main>
    </div>
  )
}
