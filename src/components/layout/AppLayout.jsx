import { NavLink } from 'react-router-dom'
import {
  Home,
  Sparkles,
  MessageSquare,
  User,
  Search,
} from 'lucide-react'

const NAV_ITEMS = [
  { label: 'Home',    to: '/dashboard', Icon: Home },
  { label: 'Matches', to: '/matches',   Icon: Sparkles },
  { label: 'Chats',   to: '/chat/1',    Icon: MessageSquare },
  { label: 'Account', to: '/account',   Icon: User },
]

function NavItem({ label, to, Icon }) {
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
          <Icon
            size={18}
            style={{ color: isActive ? 'var(--accent)' : 'var(--text-secondary)' }}
          />
          <span>{label}</span>
        </>
      )}
    </NavLink>
  )
}

function Sidebar() {
  return (
    <aside
      className="hidden md:flex flex-col w-56 shrink-0 h-screen sticky top-0 px-4 py-8"
      style={{ background: 'var(--surface)', boxShadow: '1px 0 0 rgba(255,255,255,0.06)' }}
    >
      {/* Logo */}
      <div
        className="mb-10 px-4 tracking-widest text-sm font-semibold"
        style={{ color: 'var(--text-primary)' }}
      >
        ✦ FLATMATE
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
      </nav>

      {/* Start flat-hunting CTA */}
      <div className="mt-auto pt-6">
        <NavLink
          to="/screening"
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-btn text-body font-semibold transition-all duration-200 hover:opacity-88"
          style={{ background: 'var(--accent)', color: '#fff', textDecoration: 'none' }}
        >
          <Search size={15} />
          Start flat-hunting
        </NavLink>
      </div>
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
      {NAV_ITEMS.map(({ label, to, Icon }) => (
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
              <Icon
                size={20}
                style={{ color: isActive ? 'var(--accent)' : 'var(--text-secondary)' }}
              />
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
