import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'

const tooltipStyle = {
  contentStyle: { backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 },
}

function slugMeta(slug) {
  if (slug.includes('recession'))
    return { direction: 'Bearish', icon: '🔴', color: '#ef4444', bg: '#ef444420' }
  if (slug.includes('rate-cut') || slug.includes('fed-cut') || slug.includes('sp500') || slug.includes('spx'))
    return { direction: 'Bullish', icon: '🟢', color: '#22c55e', bg: '#22c55e20' }
  return { direction: 'Contextual', icon: '🟡', color: '#f59e0b', bg: '#f59e0b20' }
}

export default function MacroTab({ runs, config }) {
  const polyData = runs.map(run => ({
    date:  new Date(run.timestamp).toLocaleDateString(),
    score: run.poly_macro_score ?? 0,
  }))

  const slugs = config?.polymarket_slugs ?? []

  return (
    <div className="space-y-5">

      {/* Macro score bar chart */}
      <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
        <h2 className="text-white font-semibold mb-4">Polymarket Macro Score per Run</h2>
        {polyData.length < 1 ? (
          <p className="text-slate-400 text-sm">No data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={polyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip
                {...tooltipStyle}
                formatter={(v) => [v.toFixed(4), 'Macro Score']}
              />
              <ReferenceLine y={0} stroke="#475569" strokeDasharray="4 4" />
              <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                {polyData.map((d, i) => (
                  <Cell key={i} fill={d.score >= 0 ? '#22c55e' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Market list */}
      <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
        <h2 className="text-white font-semibold mb-4">Monitored Polymarket Markets</h2>

        {!slugs.length ? (
          <p className="text-slate-400 text-sm">No markets configured.</p>
        ) : (
          <div className="space-y-3">
            {slugs.map(slug => {
              const meta  = slugMeta(slug)
              const label = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
              return (
                <div
                  key={slug}
                  className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-lg shrink-0">{meta.icon}</span>
                    <div className="min-w-0">
                      <a
                        href={`https://polymarket.com/event/${slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 font-medium block truncate"
                      >
                        {label}
                      </a>
                      <p className="text-slate-500 text-xs mt-0.5 truncate">{slug}</p>
                    </div>
                  </div>
                  <span
                    className="text-xs px-2.5 py-1 rounded-full font-medium ml-3 shrink-0"
                    style={{ color: meta.color, backgroundColor: meta.bg }}
                  >
                    {meta.direction}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        <p className="text-slate-600 text-xs mt-5">
          Polymarket is a prediction market. Probabilities reflect crowd beliefs, not guaranteed outcomes.
          This is for research and informational use only.
        </p>
      </div>
    </div>
  )
}
