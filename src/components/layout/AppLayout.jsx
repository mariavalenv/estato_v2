import { NavLink, Link } from 'react-router-dom'
import { useAssistant } from '../../contexts/AssistantContext'

// Character art used on the dashboard tiles, reused here so the sidebar reads
// the same visual language: a house for home, a housemate, the agent dog, etc.
const NAV_ITEMS = [
  { label: 'Homepage', to: '/dashboard', wordmark: true },
  { label: 'Matches',  to: '/matches',   img: '/char-man.png' },
  { label: 'Chats',    to: '/chats',     img: '/char-cat.png' },
  { label: 'Agent',    to: '/agent',     img: '/char-dog.png' },
  { label: 'Activity', to: '/activity',  img: '/char-box.png' },
]

// The ESTATO wordmark, sized to sit inside a nav icon slot.
function Wordmark({ active }) {
  return (
    <span
      style={{
        width: 30,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Archivo Black, Inter, sans-serif',
        fontSize: 7,
        letterSpacing: '0.12em',
        color: 'var(--text-primary)',
        opacity: active ? 1 : 0.55,
        transition: 'opacity 200ms ease',
      }}
    >
      ESTATO
    </span>
  )
}

function NavItem({ label, to, img, wordmark }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-4 py-2 rounded-btn text-body font-medium transition-all duration-200 ${
          isActive
            ? 'text-accent bg-accent/10'
            : 'text-secondary hover:text-primary hover:bg-white/5'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {wordmark ? (
            <Wordmark active={isActive} />
          ) : (
            <img
              src={img}
              alt=""
              draggable={false}
              style={{
                width: 30,
                height: 30,
                objectFit: 'contain',
                opacity: isActive ? 1 : 0.55,
                transition: 'opacity 200ms ease',
              }}
            />
          )}
          <span>{label}</span>
        </>
      )}
    </NavLink>
  )
}

function Sidebar() {
  const { open } = useAssistant()
  return (
    <aside
      className="hidden md:flex flex-col shrink-0 h-screen sticky top-0 px-4 py-8"
      style={{
        width: open ? 364 : 224,
        background: 'var(--surface)',
        boxShadow: '1px 0 0 rgba(255,255,255,0.06)',
        transition: 'width 250ms ease',
      }}
    >
      {/* Logo — same dog mark + wordmark as the landing page. Clicking returns home. */}
      <Link to="/dashboard" className="mb-10 px-4 flex items-center gap-3 no-underline" aria-label="Go to dashboard">
        <span
          style={{
            width: 36, height: 36, borderRadius: '50%',
            border: '2px solid var(--text-primary)',
            background: '#C94A3D',
            overflow: 'hidden', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <img
            src="/logo-dog.png"
            alt="Estato"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            draggable={false}
          />
        </span>
        <span
          style={{
            fontFamily: 'Archivo Black, Inter, sans-serif',
            fontSize: 14, letterSpacing: '0.22em',
            color: 'var(--text-primary)',
          }}
        >
          ESTATO
        </span>
      </Link>

      {/* Nav */}
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
      </nav>

    </aside>
  )
}

function BottomNav() {
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex justify-around items-center px-4 py-3"
      style={{
        background: 'var(--surface)',
        boxShadow: '0 -1px 0 rgba(255,255,255,0.06)',
      }}
    >
      {NAV_ITEMS.map(({ label, to, img, wordmark }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 transition-all duration-200 ${
              isActive ? 'opacity-100' : 'opacity-40'
            }`
          }
        >
          {({ isActive }) => (
            <>
              {wordmark ? (
                <Wordmark active={isActive} />
              ) : (
                <img
                  src={img}
                  alt=""
                  draggable={false}
                  style={{ width: 28, height: 28, objectFit: 'contain' }}
                />
              )}
              <span
                className="text-meta"
                style={{ color: isActive ? 'var(--accent)' : 'var(--text-secondary)' }}
              >
                {label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

export function AppLayout({ children }) {
  return (
    <div className="flex min-h-screen" style={{ background: 'var(--background)' }}>
      <Sidebar />

      {/* Main content */}
      <main className="flex-1 min-w-0 pb-20 md:pb-0">
        {children}
      </main>

      <BottomNav />
    </div>
  )
}
