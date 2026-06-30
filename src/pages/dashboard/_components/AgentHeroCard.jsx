import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { InsightPill } from '../../../components/ui/InsightPill'
import { PinkBlob } from '../../../components/ui/PinkBlob'

export function AgentHeroCard() {
  const navigate = useNavigate()

  return (
    <div
      style={{
        borderRadius: 20,
        padding: '32px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}
    >
      <PinkBlob state="idle" size={64} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2
          style={{
            fontSize: 24,
            fontWeight: 600,
            color: 'var(--text-primary)',
            margin: 0,
            lineHeight: 1.3,
          }}
        >
          Meet your agent.
        </h2>
        <p
          style={{
            fontSize: 15,
            color: 'var(--text-secondary)',
            margin: 0,
            lineHeight: 1.6,
            maxWidth: 440,
          }}
        >
          Tell it what you're looking for — it handles the search, compares
          every option, and only surfaces the ones worth your time.
        </p>
      </div>

      <InsightPill>
        Your agent will review hundreds of listings and surface only the ones
        that genuinely fit your life.
      </InsightPill>

      <button
        onClick={() => navigate('/screening')}
        className="flex items-center gap-2 transition-opacity duration-150 hover:opacity-80 cursor-pointer"
        style={{
          height: 52,
          borderRadius: 12,
          background: 'var(--accent)',
          color: '#fff',
          border: 'none',
          fontSize: 15,
          fontWeight: 600,
          padding: '0 24px',
          alignSelf: 'flex-start',
        }}
      >
        <Search size={16} />
        Start flat-hunting
      </button>
    </div>
  )
}
