import { useState, useEffect, useCallback } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, ReferenceLine, Legend,
} from 'recharts'

const API = '/api'

const STAGE_LABELS = {
  '1_hypothesis': 'Hypothesis Formation',
  '2_features':   'Feature Discovery',
  '3_validation': 'Signal Validation',
  '4_model':      'Model Construction',
  '5_backtest':   'Backtesting',
  '6_robustness': 'Robustness Testing',
  '7_regimes':    'Regime Validation',
  '8_portfolio':  'Portfolio Construction',
  '9_capacity':   'Capacity Analysis',
}

const STAGE_DESC = {
  '1_hypothesis': 'Economic rationale for each alpha signal',
  '2_features':   'Price-based features computed without look-ahead bias',
  '3_validation': 'IC analysis: rank correlation of signal vs. forward returns',
  '4_model':      'Composite signal via equal-weighted cross-sectional z-scores',
  '5_backtest':   'Monthly rebalancing with 10 bps transaction costs',
  '6_robustness': 'Walk-forward, noise injection, and permutation tests',
  '7_regimes':    'Dot-com, GFC, COVID, rate-rising regime performance',
  '8_portfolio':  'Volatility-scaled, 5% max position, 15% vol target',
  '9_capacity':   'Market-impact simulation from $10M to $1B AUM',
}

const tooltipStyle = {
  contentStyle: { backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 },
  labelStyle: { color: '#e2e8f0' },
}

// ─── Small reusable components ────────────────────────────────────────────

function StatusBadge({ status }) {
  const map = {
    passed:  'bg-green-900/50 text-green-400 border-green-700',
    partial: 'bg-amber-900/50 text-amber-400 border-amber-700',
    failed:  'bg-red-900/50   text-red-400   border-red-700',
    running: 'bg-blue-900/50  text-blue-400  border-blue-700',
    error:   'bg-red-900/50   text-red-400   border-red-700',
    no_data: 'bg-slate-700    text-slate-400 border-slate-600',
  }
  const cls = map[status] ?? map.no_data
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium uppercase ${cls}`}>
      {status ?? '—'}
    </span>
  )
}

function PassFail({ passed }) {
  return passed
    ? <span className="text-green-400 font-bold">✓ Pass</span>
    : <span className="text-red-400   font-bold">✗ Fail</span>
}

function Card({ title, children, action }) {
  return (
    <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  )
}

function MetricRow({ label, value, threshold, passed, format = 'pct' }) {
  const fmt = (v) => {
    if (v === null || v === undefined) return '—'
    if (format === 'pct')    return `${(v * 100).toFixed(1)}%`
    if (format === 'float2') return v.toFixed(2)
    if (format === 'float4') return v.toFixed(4)
    return String(v)
  }
  return (
    <tr className="border-b border-slate-700/50 hover:bg-slate-700/30">
      <td className="py-2 px-3 text-slate-300 text-sm">{label}</td>
      <td className="py-2 px-3 text-right font-mono text-white text-sm">{fmt(value)}</td>
      <td className="py-2 px-3 text-right text-slate-500 text-sm">{fmt(threshold)}</td>
      <td className="py-2 px-3 text-right text-sm">{passed !== undefined ? <PassFail passed={passed} /> : '—'}</td>
    </tr>
  )
}

// ─── Section components ───────────────────────────────────────────────────

function PipelineOverview({ stages }) {
  return (
    <Card title="Pipeline Status — 9 Stages">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {Object.entries(STAGE_LABELS).map(([key, label]) => {
          const stage = stages?.[key]
          const status = stage?.status ?? 'pending'
          return (
            <div key={key} className="bg-slate-700/50 rounded-lg p-3 border border-slate-600">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-white text-sm font-medium">{label}</p>
                  <p className="text-slate-400 text-xs mt-0.5">{STAGE_DESC[key]}</p>
                </div>
                <StatusBadge status={status} />
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function AcceptanceCriteria({ acceptance }) {
  if (!acceptance?.criteria) return null
  const { criteria, all_passed } = acceptance

  const fmtMap = {
    annualized_return:      'pct',
    sharpe_ratio:           'float2',
    sortino_ratio:          'float2',
    profit_factor:          'float2',
    max_drawdown:           'pct',
    oos_sharpe_degradation: 'pct',
    wf_profitable_pct:      'pct',
  }

  return (
    <Card title="Acceptance Criteria">
      <div className="flex items-center gap-3 mb-4">
        <StatusBadge status={all_passed ? 'passed' : 'partial'} />
        <span className="text-slate-400 text-sm">
          {Object.values(criteria).filter(c => c.passed).length} /
          {Object.values(criteria).length} criteria met
        </span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-slate-400 border-b border-slate-700">
            <th className="text-left py-2 px-3">Criterion</th>
            <th className="text-right py-2 px-3">Actual</th>
            <th className="text-right py-2 px-3">Threshold</th>
            <th className="text-right py-2 px-3">Result</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(criteria).map(([key, c]) => (
            <MetricRow
              key={key}
              label={c.label}
              value={c.value}
              threshold={c.threshold}
              passed={c.passed}
              format={fmtMap[key] ?? 'float2'}
            />
          ))}
        </tbody>
      </table>
    </Card>
  )
}

function SignalValidation({ validation }) {
  if (!validation) return null
  const signals = Object.entries(validation)

  return (
    <Card title="Signal Validation — Information Coefficient Analysis">
      <div className="overflow-x-auto mb-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-400 border-b border-slate-700">
              <th className="text-left py-2 px-3">Signal</th>
              <th className="text-right py-2 px-3">Mean IC</th>
              <th className="text-right py-2 px-3">IC/IR</th>
              <th className="text-right py-2 px-3">t-stat</th>
              <th className="text-right py-2 px-3">p-value</th>
              <th className="text-right py-2 px-3">% Positive</th>
              <th className="text-right py-2 px-3">Result</th>
            </tr>
          </thead>
          <tbody>
            {signals.map(([sig, v]) => (
              <tr key={sig} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                <td className="py-2 px-3 font-medium text-white capitalize">
                  {sig.replace(/_/g, ' ')}
                </td>
                <td className="py-2 px-3 text-right font-mono"
                  style={{ color: (v.mean_ic ?? 0) > 0 ? '#22c55e' : '#ef4444' }}>
                  {v.mean_ic != null ? v.mean_ic.toFixed(4) : '—'}
                </td>
                <td className="py-2 px-3 text-right text-slate-300 font-mono">
                  {v.ic_ir != null ? v.ic_ir.toFixed(4) : '—'}
                </td>
                <td className="py-2 px-3 text-right text-slate-300 font-mono">
                  {v.t_stat != null ? v.t_stat.toFixed(2) : '—'}
                </td>
                <td className="py-2 px-3 text-right text-slate-400 font-mono">
                  {v.p_value != null ? v.p_value.toFixed(3) : '—'}
                </td>
                <td className="py-2 px-3 text-right text-slate-300 font-mono">
                  {v.pct_positive != null ? `${(v.pct_positive * 100).toFixed(0)}%` : '—'}
                </td>
                <td className="py-2 px-3 text-right">
                  {v.passed !== undefined ? <PassFail passed={v.passed} /> : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* IC bar chart */}
      <h4 className="text-slate-300 text-sm font-medium mb-3">Mean IC by Signal</h4>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={signals.map(([k, v]) => ({ name: k.replace(/_/g, ' '), ic: v.mean_ic ?? 0 }))}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} />
          <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <Tooltip {...tooltipStyle} formatter={v => [v.toFixed(4), 'Mean IC']} />
          <ReferenceLine y={0} stroke="#475569" />
          <Bar dataKey="ic" radius={[3, 3, 0, 0]}>
            {signals.map(([, v], i) => (
              <Cell key={i} fill={(v.mean_ic ?? 0) > 0 ? '#22c55e' : '#ef4444'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  )
}

function BacktestSection({ backtest, portfolio }) {
  const src = portfolio?.equity_curve?.length ? portfolio : backtest
  const curve = src?.equity_curve ?? []
  const metrics = portfolio ?? backtest ?? {}

  const metricItems = [
    { label: 'Annualised Return', key: 'annualized_return', fmt: v => `${(v * 100).toFixed(1)}%` },
    { label: 'Sharpe Ratio',      key: 'sharpe_ratio',      fmt: v => v.toFixed(2) },
    { label: 'Sortino Ratio',     key: 'sortino_ratio',     fmt: v => v.toFixed(2) },
    { label: 'Max Drawdown',      key: 'max_drawdown',      fmt: v => `${(v * 100).toFixed(1)}%` },
    { label: 'Profit Factor',     key: 'profit_factor',     fmt: v => v.toFixed(2) },
    { label: 'Win Rate',          key: 'win_rate',          fmt: v => `${(v * 100).toFixed(1)}%` },
    { label: 'Total Return',      key: 'total_return',      fmt: v => `${(v * 100).toFixed(1)}%` },
  ]

  return (
    <Card title="Portfolio Backtest — Equity Curve">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {metricItems.slice(0, 4).map(m => (
          <div key={m.key} className="bg-slate-700/50 rounded-lg p-3">
            <p className="text-slate-400 text-xs">{m.label}</p>
            <p className={`text-lg font-bold mt-1 ${
              m.key === 'max_drawdown' ? 'text-red-400' :
              m.key === 'annualized_return' || m.key === 'sharpe_ratio' ? 'text-green-400' :
              'text-white'
            }`}>
              {metrics[m.key] != null ? m.fmt(metrics[m.key]) : '—'}
            </p>
          </div>
        ))}
      </div>

      {curve.length > 0 && (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={curve}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }}
              tickFormatter={d => d.slice(0, 7)} interval="preserveStartEnd" />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickFormatter={v => `${((v - 1) * 100).toFixed(0)}%`} />
            <Tooltip
              {...tooltipStyle}
              formatter={v => [`${((v - 1) * 100).toFixed(2)}%`, 'Cumulative Return']}
            />
            <ReferenceLine y={1} stroke="#475569" strokeDasharray="4 4" />
            <Line type="monotone" dataKey="value" stroke="#3b82f6"
              strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </Card>
  )
}

function RobustnessSection({ robustness }) {
  if (!robustness) return null
  const { walk_forward, noise_test, permutation } = robustness
  const windows = walk_forward?.windows ?? []

  return (
    <Card title="Robustness Testing">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <div className="bg-slate-700/50 rounded-lg p-4">
          <p className="text-slate-400 text-xs mb-1">Walk-Forward Win Rate</p>
          <p className="text-2xl font-bold text-white">
            {walk_forward?.wf_profitable_pct != null
              ? `${(walk_forward.wf_profitable_pct * 100).toFixed(0)}%` : '—'}
          </p>
          <p className="text-slate-400 text-xs mt-1">{walk_forward?.n_windows ?? 0} windows</p>
        </div>
        <div className="bg-slate-700/50 rounded-lg p-4">
          <p className="text-slate-400 text-xs mb-1">Noise Injection</p>
          <p className="text-2xl font-bold text-white">
            {noise_test?.degradation != null
              ? `${(noise_test.degradation * 100).toFixed(0)}% degradation` : '—'}
          </p>
          <p className="text-xs mt-1">{noise_test?.passed != null ? <PassFail passed={noise_test.passed} /> : '—'}</p>
        </div>
        <div className="bg-slate-700/50 rounded-lg p-4">
          <p className="text-slate-400 text-xs mb-1">Permutation Test</p>
          <p className="text-2xl font-bold text-white">
            {permutation?.p_value != null ? `p = ${permutation.p_value.toFixed(3)}` : '—'}
          </p>
          <p className="text-xs mt-1">{permutation?.passed != null ? <PassFail passed={permutation.passed} /> : '—'}</p>
        </div>
      </div>

      {windows.length > 0 && (
        <>
          <h4 className="text-slate-300 text-sm font-medium mb-3">Walk-Forward: IS vs OOS Sharpe</h4>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={windows}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="window" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
              <ReferenceLine y={0} stroke="#475569" />
              <Bar dataKey="is_sharpe"  name="In-Sample"     fill="#3b82f6" radius={[3,3,0,0]} />
              <Bar dataKey="oos_sharpe" name="Out-of-Sample" fill="#22c55e" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </>
      )}
    </Card>
  )
}

function RegimeSection({ regimes }) {
  if (!regimes) return null

  const REGIME_LABELS = {
    dot_com_crash:   'Dot-com Crash (2000–02)',
    gfc:             'GFC (2008–09)',
    gfc_recovery:    'GFC Recovery (2009–10)',
    covid_crash:     'COVID Crash (Feb–Mar 2020)',
    covid_recovery:  'COVID Recovery (2020–21)',
    rate_rising_2022:'Rate Rising (2022)',
    bull_2017_2019:  'Bull Market (2017–19)',
  }

  const chartData = Object.entries(regimes)
    .filter(([, v]) => v.status === 'tested' && v.sharpe_ratio != null)
    .map(([k, v]) => ({
      name:   REGIME_LABELS[k] ?? k,
      sharpe: v.sharpe_ratio,
      ret:    v.annualized_return,
    }))

  return (
    <Card title="Market Regime Validation">
      {chartData.length > 0 && (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 150, right: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
            <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <YAxis type="category" dataKey="name" tick={{ fill: '#e2e8f0', fontSize: 11 }} width={145} />
            <Tooltip {...tooltipStyle} formatter={v => [v.toFixed(2), 'Sharpe']} />
            <ReferenceLine x={0} stroke="#475569" />
            <Bar dataKey="sharpe" radius={[0, 4, 4, 0]}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={d.sharpe >= 0 ? '#22c55e' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
      <table className="w-full text-sm mt-4">
        <thead>
          <tr className="text-slate-400 border-b border-slate-700">
            <th className="text-left py-2 px-3">Regime</th>
            <th className="text-right py-2 px-3">Ann. Return</th>
            <th className="text-right py-2 px-3">Sharpe</th>
            <th className="text-right py-2 px-3">Max DD</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(regimes).map(([k, v]) => (
            <tr key={k} className="border-b border-slate-700/50 hover:bg-slate-700/30">
              <td className="py-2 px-3 text-slate-300">{REGIME_LABELS[k] ?? k}</td>
              <td className="py-2 px-3 text-right font-mono"
                style={{ color: (v.annualized_return ?? 0) >= 0 ? '#22c55e' : '#ef4444' }}>
                {v.annualized_return != null ? `${(v.annualized_return * 100).toFixed(1)}%` : v.status}
              </td>
              <td className="py-2 px-3 text-right font-mono text-slate-300">
                {v.sharpe_ratio != null ? v.sharpe_ratio.toFixed(2) : '—'}
              </td>
              <td className="py-2 px-3 text-right font-mono text-red-400">
                {v.max_drawdown != null ? `${(v.max_drawdown * 100).toFixed(1)}%` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

function CapacitySection({ capacity }) {
  const levels = capacity?.levels ?? []
  const maxViable = capacity?.max_viable_aum_m

  return (
    <Card title={`Capacity Analysis — Max viable AUM: $${maxViable ?? '?'}M`}>
      {levels.length > 0 && (
        <>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={levels}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="capital_m" tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickFormatter={v => `$${v}M`} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip
                {...tooltipStyle}
                labelFormatter={v => `$${v}M AUM`}
                formatter={v => [v.toFixed(2), 'Adj. Sharpe']}
              />
              <ReferenceLine y={0.8} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'min threshold', fill: '#f59e0b', fontSize: 10 }} />
              <Line type="monotone" dataKey="adj_sharpe" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>

          <table className="w-full text-sm mt-4">
            <thead>
              <tr className="text-slate-400 border-b border-slate-700">
                <th className="text-right py-2 px-3">AUM</th>
                <th className="text-right py-2 px-3">Participation</th>
                <th className="text-right py-2 px-3">Impact Cost (ann.)</th>
                <th className="text-right py-2 px-3">Adj. Return</th>
                <th className="text-right py-2 px-3">Adj. Sharpe</th>
                <th className="text-right py-2 px-3">Viable</th>
              </tr>
            </thead>
            <tbody>
              {levels.map((r, i) => (
                <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                  <td className="py-2 px-3 text-right font-mono text-white">${r.capital_m}M</td>
                  <td className="py-2 px-3 text-right font-mono text-slate-300">
                    {(r.participation_rate * 100).toFixed(2)}%
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-red-400">
                    {(r.impact_cost_ann * 100).toFixed(2)}%
                  </td>
                  <td className="py-2 px-3 text-right font-mono"
                    style={{ color: r.adj_return >= 0 ? '#22c55e' : '#ef4444' }}>
                    {(r.adj_return * 100).toFixed(1)}%
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-slate-300">
                    {r.adj_sharpe.toFixed(2)}
                  </td>
                  <td className="py-2 px-3 text-right">
                    {r.viable
                      ? <span className="text-green-400 text-xs font-bold">✓ Yes</span>
                      : <span className="text-red-400   text-xs font-bold">✗ No</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Card>
  )
}

function HypothesesSection({ hypotheses }) {
  if (!hypotheses?.length) return null
  return (
    <Card title="Alpha Hypotheses — Economic Rationale">
      <div className="space-y-4">
        {hypotheses.map((h, i) => (
          <div key={i} className="border border-slate-600 rounded-lg p-4">
            <div className="flex items-start justify-between gap-3">
              <h4 className="text-white font-medium">{h.name}</h4>
              <span className="text-xs text-blue-400 bg-blue-900/30 px-2 py-0.5 rounded-full whitespace-nowrap">
                {h.signal_id}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <p className="text-slate-500 uppercase tracking-wide mb-1">Inefficiency</p>
                <p className="text-slate-300">{h.inefficiency}</p>
              </div>
              <div>
                <p className="text-slate-500 uppercase tracking-wide mb-1">Persistence</p>
                <p className="text-slate-300">{h.persistence}</p>
              </div>
              <div>
                <p className="text-slate-500 uppercase tracking-wide mb-1">Arbitrage Limit</p>
                <p className="text-slate-300">{h.arbitrage_limit}</p>
              </div>
            </div>
            <p className="text-slate-600 text-xs mt-3">
              {h.references?.join(' · ')}
            </p>
          </div>
        ))}
      </div>
    </Card>
  )
}

function KillSwitch({ killSwitch }) {
  if (!killSwitch) return null
  return (
    <div className={`rounded-xl p-4 border flex items-start gap-3 ${
      killSwitch.active
        ? 'bg-red-900/30 border-red-700'
        : 'bg-green-900/20 border-green-800'
    }`}>
      <span className="text-2xl">{killSwitch.active ? '🚨' : '🟢'}</span>
      <div>
        <p className={`font-semibold ${killSwitch.active ? 'text-red-300' : 'text-green-400'}`}>
          Kill Switch: {killSwitch.active ? 'ACTIVE' : 'Inactive'}
        </p>
        {killSwitch.signals?.length > 0 ? (
          <ul className="mt-1 space-y-1">
            {killSwitch.signals.map((s, i) => (
              <li key={i} className="text-sm text-red-300">
                <strong>{s.rule}</strong> — {s.reason}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-400 text-sm mt-0.5">All monitoring thresholds within limits.</p>
        )}
      </div>
    </div>
  )
}

// ─── Main Tab ─────────────────────────────────────────────────────────────

export default function ResearchTab() {
  const [research,   setResearch]   = useState(null)
  const [resStatus,  setResStatus]  = useState({ running: false, error: null })
  const [turboMode,  setTurboMode]  = useState(false)
  const [quickMode,  setQuickMode]  = useState(false)
  const [section,    setSection]    = useState('overview')

  const fetchResearch = useCallback(async () => {
    try {
      const [resRes, statusRes] = await Promise.all([
        fetch(`${API}/research`),
        fetch(`${API}/research/status`),
      ])
      const data = await resRes.json()
      if (data && Object.keys(data).length) setResearch(data)
      setResStatus(await statusRes.json())
    } catch { /* backend not ready */ }
  }, [])

  useEffect(() => { fetchResearch() }, [fetchResearch])

  useEffect(() => {
    if (!resStatus.running) return
    const id = setInterval(fetchResearch, 8000)
    return () => clearInterval(id)
  }, [resStatus.running, fetchResearch])

  const handleRun = async () => {
    await fetch(`${API}/research/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quick_mode: quickMode, turbo_mode: turboMode }),
    })
    setResStatus(s => ({ ...s, running: true }))
    fetchResearch()
  }

  const stages    = research?.stages ?? {}
  const hypotheses = stages['1_hypothesis']?.hypotheses ?? []
  const validation = stages['3_validation']?.signals
  const backtest   = stages['5_backtest']?.metrics
  const robustness = stages['6_robustness']
  const regimes    = stages['7_regimes']?.regimes
  const portfolio  = stages['8_portfolio']?.metrics
  const capacity   = stages['9_capacity']?.analysis

  const SECTIONS = ['overview', 'hypotheses', 'signals', 'backtest', 'robustness', 'regimes', 'capacity']

  return (
    <div className="space-y-5">

      {/* Header controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-800 rounded-xl p-4 border border-slate-700">
        <div>
          <h2 className="text-white font-bold text-lg">Quantitative Research Pipeline</h2>
          <p className="text-slate-400 text-sm mt-0.5">
            Institutional-grade 9-stage alpha discovery framework
          </p>
          {research?.timestamp && (
            <p className="text-slate-500 text-xs mt-1 flex items-center gap-2">
              Last run: {new Date(research.timestamp).toLocaleString()}
              {research?.status && <StatusBadge status={research.status} />}
              {research?.mode && (
                <span className="px-2 py-0.5 bg-slate-700 text-slate-300 rounded-full text-xs">
                  {research.mode === 'turbo' ? '⚡ turbo' : research.mode}
                </span>
              )}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {resStatus.running && (
            <span className="flex items-center gap-2 text-amber-400 text-sm">
              <span className="animate-pulse h-2 w-2 rounded-full bg-amber-400 inline-block" />
              Running pipeline…
            </span>
          )}
          <div className="flex items-center gap-3 text-sm text-slate-300">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="radio" name="mode" checked={!quickMode && !turboMode}
                onChange={() => { setTurboMode(false); setQuickMode(false) }}
                className="accent-purple-500" />
              <span>Full <span className="text-slate-500 text-xs">(~10m)</span></span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="radio" name="mode" checked={quickMode && !turboMode}
                onChange={() => { setTurboMode(false); setQuickMode(true) }}
                className="accent-purple-500" />
              <span>Quick <span className="text-slate-500 text-xs">(~3m)</span></span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="radio" name="mode" checked={turboMode}
                onChange={() => { setTurboMode(true); setQuickMode(false) }}
                className="accent-purple-500" />
              <span>Turbo ⚡ <span className="text-slate-500 text-xs">(~1m)</span></span>
            </label>
          </div>
          <button
            onClick={handleRun}
            disabled={resStatus.running}
            className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40
                       text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {resStatus.running ? 'Running…' : '▶ Run Research'}
          </button>
        </div>
      </div>

      {!research && !resStatus.running && (
        <div className="bg-slate-800 rounded-xl p-10 border border-slate-700 text-center">
          <p className="text-4xl mb-3">🔬</p>
          <p className="text-slate-300 font-medium">No research results yet</p>
          <p className="text-slate-500 text-sm mt-1">
            Click <span className="text-white font-medium">▶ Run Research</span> to execute the 9-stage pipeline.
          </p>
          <p className="text-slate-600 text-xs mt-2">
            Full run: ~5–10 min. Quick Mode: ~2–3 min.
          </p>
        </div>
      )}

      {research && (
        <>
          <KillSwitch killSwitch={research.kill_switch} />

          {/* Section nav */}
          <div className="flex gap-1 flex-wrap">
            {SECTIONS.map(s => (
              <button key={s} onClick={() => setSection(s)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors capitalize ${
                  section === s
                    ? 'bg-purple-700 text-white'
                    : 'bg-slate-700 text-slate-400 hover:text-white'
                }`}>
                {s}
              </button>
            ))}
          </div>

          {section === 'overview'    && <>
            <PipelineOverview stages={stages} />
            <AcceptanceCriteria acceptance={research.acceptance} />
          </>}
          {section === 'hypotheses'  && <HypothesesSection hypotheses={hypotheses} />}
          {section === 'signals'     && <SignalValidation validation={validation} />}
          {section === 'backtest'    && <BacktestSection backtest={backtest} portfolio={portfolio} />}
          {section === 'robustness'  && <RobustnessSection robustness={robustness} />}
          {section === 'regimes'     && <RegimeSection regimes={regimes} />}
          {section === 'capacity'    && <CapacitySection capacity={capacity} />}
        </>
      )}
    </div>
  )
}
