import { useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'

const COLORS = [
  '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ef4444',
  '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#14b8a6',
]

const STATUS_LABEL = {
  completed: '🟢 Completed',
  error:     '🔴 Error',
  no_equity: '🟡 No Equity',
}

const tooltipStyle = {
  contentStyle: { backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 },
}

const fmt = (n) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`

export default function HistoryTab({ runs }) {
  const [scoreKey, setScoreKey] = useState('combined_score')

  if (runs.length < 2) {
    return (
      <div className="bg-slate-800 rounded-xl p-10 border border-slate-700 text-center">
        <p className="text-4xl mb-3">📅</p>
        <p className="text-slate-300 font-medium">Need at least 2 runs</p>
        <p className="text-slate-500 text-sm mt-1">History charts appear after multiple runs.</p>
      </div>
    )
  }

  const tickers   = runs[0]?.signals?.map(s => s.ticker) ?? []
  const chartData = runs.map(run => {
    const row = { date: new Date(run.timestamp).toLocaleDateString() }
    for (const s of (run.signals ?? [])) row[s.ticker] = s[scoreKey]
    return row
  })

  const scoreOptions = [
    { value: 'combined_score',  label: 'Combined Score' },
    { value: 'twitter_score',   label: 'Twitter Score'  },
    { value: 'momentum_score',  label: 'Momentum Score' },
  ]

  const runLog = [...runs].reverse().map(run => ({
    ts:       new Date(run.timestamp).toLocaleString(),
    status:   STATUS_LABEL[run.status] ?? run.status,
    equity:   fmt(run.equity ?? 0),
    invested: fmt(Object.values(run.allocations ?? {}).reduce((a, b) => a + b, 0)),
    orders:   run.orders?.length ?? 0,
    macro:    run.poly_macro_score >= 0
                ? `+${run.poly_macro_score.toFixed(3)}`
                : run.poly_macro_score.toFixed(3),
    macroPct: run.poly_macro_score,
    mode:     run.dry_run ? 'Dry' : 'Live',
  }))

  return (
    <div className="space-y-5">

      {/* Score trend */}
      <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold">Score Over Time</h2>
          <select
            value={scoreKey}
            onChange={e => setScoreKey(e.target.value)}
            className="bg-slate-700 border border-slate-600 text-white text-sm rounded-lg px-3 py-1.5"
          >
            {scoreOptions.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
            <ReferenceLine y={0} stroke="#475569" strokeDasharray="4 4" />
            {tickers.map((ticker, i) => (
              <Line
                key={ticker}
                type="monotone"
                dataKey={ticker}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Run log */}
      <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
        <h2 className="text-white font-semibold mb-4">Run Log</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-700">
                <th className="text-left  py-2 px-3">Timestamp</th>
                <th className="text-left  py-2 px-3">Status</th>
                <th className="text-right py-2 px-3">Equity</th>
                <th className="text-right py-2 px-3">Invested</th>
                <th className="text-right py-2 px-3">Orders</th>
                <th className="text-right py-2 px-3">Macro</th>
                <th className="text-left  py-2 px-3">Mode</th>
              </tr>
            </thead>
            <tbody>
              {runLog.map((r, i) => (
                <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                  <td className="py-2 px-3 text-slate-300 whitespace-nowrap">{r.ts}</td>
                  <td className="py-2 px-3 whitespace-nowrap">{r.status}</td>
                  <td className="py-2 px-3 text-right font-mono text-white">{r.equity}</td>
                  <td className="py-2 px-3 text-right font-mono text-white">{r.invested}</td>
                  <td className="py-2 px-3 text-right text-slate-300">{r.orders}</td>
                  <td className="py-2 px-3 text-right font-mono"
                    style={{ color: r.macroPct >= 0 ? '#22c55e' : '#ef4444' }}>
                    {r.macro}
                  </td>
                  <td className="py-2 px-3">
                    <span className={`text-xs ${r.mode === 'Dry' ? 'text-amber-400' : 'text-green-400'}`}>
                      {r.mode}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
