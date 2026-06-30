import { DensityToggle } from '../../../components/ui/DensityToggle'

function getSubtitle(isAgentActive, newMatchCount, agentStatus) {
  if (!isAgentActive) return 'Your agent is ready whenever you are.'

  if (newMatchCount > 0) {
    return (
      <>
        <span style={{ color: 'var(--text-primary)' }}>
          {newMatchCount} new {newMatchCount === 1 ? 'match' : 'matches'}
        </span>
        {' '}since you were last here.
      </>
    )
  }

  if (agentStatus?.status === 'searching' || agentStatus?.strong_matches_found === 0) {
    return 'Your agent is searching — nothing new since this morning.'
  }

  return 'Everything is up to date.'
}

export function DashboardHeader({ userName, isAgentActive, newMatchCount = 0, agentStatus }) {
  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'wrap',
        paddingTop: 48,
      }}
    >
      <div>
        <h1
          style={{
            fontSize: 36,
            fontWeight: 500,
            color: 'var(--text-primary)',
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          {greeting}, {userName}
        </h1>
        <p
          style={{
            fontSize: 15,
            color: 'var(--text-secondary)',
            margin: '4px 0 0',
          }}
        >
          {getSubtitle(isAgentActive, newMatchCount, agentStatus)}
        </p>
      </div>
      <DensityToggle />
    </div>
  )
}
