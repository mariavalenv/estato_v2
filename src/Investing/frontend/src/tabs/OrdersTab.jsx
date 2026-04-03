const SideBadge = ({ side }) => (
  <span className={`px-2 py-0.5 rounded text-xs font-bold
    ${side === 'BUY'
      ? 'bg-green-900/60 text-green-400'
      : 'bg-red-900/60  text-red-400'}`}>
    {side}
  </span>
)

const ModeBadge = ({ dry }) => (
  <span className={`text-xs ${dry ? 'text-amber-400' : 'text-green-400'}`}>
    {dry ? 'Dry' : 'Live'}
  </span>
)

const fmt = (n) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`

export default function OrdersTab({ runs }) {
  const latest       = runs[runs.length - 1]
  const latestOrders = latest?.orders ?? []

  const allOrders = [...runs]
    .reverse()
    .flatMap(run =>
      (run.orders ?? []).map(o => ({
        date:   new Date(run.timestamp).toLocaleDateString(),
        time:   new Date(run.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        ticker: o.ticker,
        side:   o.side.toUpperCase(),
        amount: o.amount,
        dry:    run.dry_run,
      }))
    )

  return (
    <div className="space-y-5">

      {/* Latest run */}
      <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold">
            Latest Run — {latest ? new Date(latest.timestamp).toLocaleString() : ''}
          </h2>
          {latest && <ModeBadge dry={latest.dry_run} />}
        </div>

        {!latestOrders.length ? (
          <p className="text-slate-400 text-sm">
            No orders — positions already at target or no positive signals.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-700">
                <th className="text-left  py-2 px-3">Ticker</th>
                <th className="text-left  py-2 px-3">Side</th>
                <th className="text-right py-2 px-3">Amount</th>
              </tr>
            </thead>
            <tbody>
              {latestOrders.map((o, i) => (
                <tr
                  key={i}
                  className={`border-b border-slate-700/50
                    ${o.side.toUpperCase() === 'BUY' ? 'bg-green-900/10' : 'bg-red-900/10'}`}
                >
                  <td className="py-2 px-3 font-medium text-white">{o.ticker}</td>
                  <td className="py-2 px-3"><SideBadge side={o.side.toUpperCase()} /></td>
                  <td className="py-2 px-3 text-right font-mono text-white">{fmt(o.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Full history */}
      <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
        <h2 className="text-white font-semibold mb-4">All Historical Orders</h2>
        {!allOrders.length ? (
          <p className="text-slate-400 text-sm">No orders recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-slate-700">
                  <th className="text-left  py-2 px-3">Date</th>
                  <th className="text-left  py-2 px-3">Time</th>
                  <th className="text-left  py-2 px-3">Ticker</th>
                  <th className="text-left  py-2 px-3">Side</th>
                  <th className="text-right py-2 px-3">Amount</th>
                  <th className="text-left  py-2 px-3">Mode</th>
                </tr>
              </thead>
              <tbody>
                {allOrders.map((o, i) => (
                  <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="py-2 px-3 text-slate-300">{o.date}</td>
                    <td className="py-2 px-3 text-slate-400">{o.time}</td>
                    <td className="py-2 px-3 font-medium text-white">{o.ticker}</td>
                    <td className="py-2 px-3"><SideBadge side={o.side} /></td>
                    <td className="py-2 px-3 text-right font-mono text-white">{fmt(o.amount)}</td>
                    <td className="py-2 px-3"><ModeBadge dry={o.dry} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
