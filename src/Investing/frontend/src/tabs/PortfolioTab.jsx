import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'

const COLORS = [
  '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ef4444',
  '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#14b8a6',
]

const tooltipStyle = {
  contentStyle: { backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 },
}

const Card = ({ title, children }) => (
  <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
    <h2 className="text-white font-semibold mb-4">{title}</h2>
    {children}
  </div>
)

export default function PortfolioTab({ run }) {
  const simulated = run?.simulated ?? false
  const allocs  = run?.allocations ?? {}
  const entries = Object.entries(allocs)
    .map(([ticker, amount], i) => ({ ticker, amount, color: COLORS[i % COLORS.length] }))
    .sort((a, b) => b.amount - a.amount)

  const total = entries.reduce((s, e) => s + e.amount, 0)
  const fmt   = (n) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`

  if (!entries.length) {
    return (
      <div className="bg-slate-800 rounded-xl p-10 border border-slate-700 text-center">
        <p className="text-4xl mb-3">💵</p>
        <p className="text-slate-300 font-medium">Full cash position</p>
        <p className="text-slate-500 text-sm mt-1">All signals were negative — no allocation generated.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {simulated && (
        <div className="bg-amber-900/30 border border-amber-700 rounded-xl px-4 py-3 text-amber-300 text-sm">
          <strong>Simulated portfolio</strong> — Alpaca credentials not configured.
          Allocations are based on a paper equity of ${run.equity.toLocaleString('en-US', { minimumFractionDigits: 2 })}.
          Set <code className="bg-amber-900/40 px-1 rounded">ALPACA_API_KEY</code> and <code className="bg-amber-900/40 px-1 rounded">ALPACA_SECRET_KEY</code> in your <code className="bg-amber-900/40 px-1 rounded">.env</code> to use a real account.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Donut chart */}
        <Card title="Allocation Breakdown">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={entries}
                dataKey="amount"
                nameKey="ticker"
                innerRadius={70}
                outerRadius={110}
                paddingAngle={3}
                label={({ ticker, percent }) => `${ticker} ${(percent * 100).toFixed(0)}%`}
                labelLine={{ stroke: '#475569' }}
              >
                {entries.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip
                {...tooltipStyle}
                formatter={(v) => [fmt(v), 'Allocation']}
              />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        {/* Dollar bar chart */}
        <Card title="Dollar Allocation">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={entries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="ticker" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={v => `$${v}`} />
              <Tooltip
                {...tooltipStyle}
                formatter={(v) => [fmt(v), 'Allocation']}
              />
              <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                {entries.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Allocation table */}
      <Card title="Allocation Table">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-400 border-b border-slate-700">
              <th className="text-left py-2 px-3">Ticker</th>
              <th className="text-right py-2 px-3">Amount</th>
              <th className="text-right py-2 px-3">Weight</th>
              <th className="py-2 px-3 w-40">Bar</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.ticker} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                <td className="py-2 px-3">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                    <span className="font-medium text-white">{e.ticker}</span>
                  </span>
                </td>
                <td className="py-2 px-3 text-right font-mono text-white">{fmt(e.amount)}</td>
                <td className="py-2 px-3 text-right text-slate-300">
                  {((e.amount / total) * 100).toFixed(1)}%
                </td>
                <td className="py-2 px-3">
                  <div className="bg-slate-700 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full transition-all"
                      style={{ width: `${(e.amount / total) * 100}%`, backgroundColor: e.color }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
