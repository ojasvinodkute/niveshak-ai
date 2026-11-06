/** Global navigation bar */
import { Link, useLocation } from 'react-router-dom'
import { Moon, Sun, Star, TrendingUp, LayoutGrid, BookOpen, ArrowLeftRight } from 'lucide-react'
import { useAppStore } from '../lib/store'
import { clsx } from 'clsx'

const NAV_LINKS = [
  { to: '/screener', label: 'Top Picks', icon: TrendingUp },
  { to: '/market', label: 'Market', icon: LayoutGrid },
  { to: '/compare', label: 'Compare', icon: ArrowLeftRight },
  { to: '/watchlist', label: 'Watchlist', icon: Star },
  { to: '/learn', label: 'Learn', icon: BookOpen },
]

export function Navbar() {
  const { theme, toggleTheme } = useAppStore()
  const location = useLocation()

  return (
    <header
      className="sticky top-0 z-40 border-b"
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
    >
      <div className="max-w-6xl mx-auto px-4 md:px-6 flex items-center justify-between gap-4 h-14">
        {/* Logo */}
        <Link
          to="/"
          className="flex items-center gap-2 font-bold text-lg no-underline flex-shrink-0"
          style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--accent)' }}
        >
          <span className="text-2xl">📊</span>
          <span className="hidden sm:inline">Niveshak AI</span>
        </Link>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-1 overflow-x-auto" aria-label="Main navigation">
          {NAV_LINKS.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                location.pathname.startsWith(to)
                  ? 'bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800'
              )}
              style={{ color: location.pathname.startsWith(to) ? 'var(--accent)' : 'var(--muted)' }}
            >
              <Icon size={15} />
              {label}
            </Link>
          ))}
        </nav>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
          style={{ color: 'var(--muted)' }}
          aria-label="Toggle dark mode"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      {/* Mobile nav */}
      <div
        className="md:hidden flex items-center gap-1 overflow-x-auto px-3 pb-2"
        style={{ scrollbarWidth: 'none' }}
      >
        {NAV_LINKS.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className={clsx(
              'flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
              location.pathname.startsWith(to)
                ? 'text-teal-700 dark:text-teal-400'
                : ''
            )}
            style={{ color: location.pathname.startsWith(to) ? 'var(--accent)' : 'var(--muted)' }}
          >
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </div>
    </header>
  )
}

