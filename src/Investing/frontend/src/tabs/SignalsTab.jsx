import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine, Legend,
} from 'recharts'

const scoreColor = (v) =>
  v >  0.05 ? '#22c55e' :
  v < -0.05 ? '#ef4444' : '#94a3b8'

const Card = ({ title, children }) => (
  <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
    <h2 className="text-white font-semibold mb-4">{title}</h2>
    {children}
  </div>
)

const tooltipStyle = {
  contentStyle: { backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 },
  labelStyle:   { color: '#e2e8f0' },
}

export default function SignalsTab({ run }) {
  if (!run?.signals?.length) {
    return <p className="text-slate-400">No signal data in this run.</p>
  }

  const sorted     = [...run.signals].sort((a, b) => a.combined_score - b.combined_score)
  const breakdown  = run.signals.map(s => ({
    ticker:     s.ticker,
    Twitter:    +s.twitter_score.toFixed(4),
    Polymarket: +s.polymarket_score.toFixed(4),
    Momentum:   +s.momentum_score.toFixed(4),
  }))

  return (
    <div className="space-y-5">

      {/* Horizontal combined-score bar chart */}
      <Card title="Combined Signal Score">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={sorted} layout="vertical" margin={{ left: 10, right: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
            <XAxis type="number" domain={[-1, 1]} tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <YAxis type="category" dataKey="ticker" tick={{ fill: '#e2e8f0', fontSize: 12 }} width={55} />
            <Tooltip {...tooltipStyle} formatter={(v) => [v.toFixed(4), 'Score']} />
            <ReferenceLine x={0} stroke="#475569" />
            <Bar dataKey="combined_score" radius={[0, 4, 4, 0]}>
              {sorted.map((s, i) => <Cell key={i} fill={scoreColor(s.combined_score)} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Grouped signal breakdown */}
      <Card title="Signal Breakdown per Ticker">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={breakdown}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="ticker" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
            <ReferenceLine y={0} stroke="#475569" />
            <Bar dataKey="Twitter"    fill="#1d9bf0" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Polymarket" fill="#7c3aed" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Momentum"   fill="#f59e0b" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Detail table */}
      <Card title="Signal Detail">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-700 text-right">
                <th className="text-left py-2 px-3">Ticker</th>
                <th className="py-2 px-3">Twitter</th>
                <th className="py-2 px-3">Polymarket</th>
                <th className="py-2 px-3">Momentum</th>
                <th className="py-2 px-3">Combined</th>
                <th className="py-2 px-3">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {run.signals.map(s => (
                <tr key={s.ticker} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                  <td className="py-2 px-3 font-medium text-white">{s.ticker}</td>
                  {[s.twitter_score, s.polymarket_score, s.momentum_score, s.combined_score].map((v, i) => (
                    <td key={i} className="py-2 px-3 text-right font-mono" style={{ color: scoreColor(v) }}>
                      {v >= 0 ? '+' : ''}{v.toFixed(4)}
                    </td>
                  ))}
                  <td className="py-2 px-3 text-right text-slate-300">{(s.confidence * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
