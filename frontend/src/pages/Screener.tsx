/** Screener / Top Picks page */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api, type ScreenerItem } from '../lib/api'
import { useAppStore } from '../lib/store'
import { formatINR, formatPct } from '../lib/format'
import { Sparkline } from '../components/Sparkline'
import { SearchBar } from '../components/SearchBar'
import { SkeletonCard, ErrorBox, EmptyState, ScoreBadge, RiskBadge, Card, Button } from '../components/ui'
import { Star, StarOff, SlidersHorizontal } from 'lucide-react'
import { clsx } from 'clsx'
import type { SearchResult } from '../lib/api'

const SECTORS = ['All', 'IT', 'Banking', 'FMCG', 'Pharma', 'Energy', 'Automobile', 'Infrastructure', 'Telecom']
const RISK_FILTERS = [
  { value: '', label: 'Any risk' },
  { value: 'low', label: '🛡️ Low risk' },
  { value: 'medium', label: '⚖️ Medium risk' },
  { value: 'high', label: '🚀 High risk' },
]

export function ScreenerPage() {
  const { profile, watchlist, addToWatchlist, removeFromWatchlist } = useAppStore()
  const navigate = useNavigate()
  const [sector, setSector] = useState('')
  const [riskFilter, setRiskFilter] = useState(profile.risk === 'low' ? 'low' : profile.risk === 'medium' ? 'medium' : '')
  const [showFilters, setShowFilters] = useState(false)

  const { data: stocks = [], isLoading, error } = useQuery({
    queryKey: ['screener', riskFilter, sector],
    queryFn: () => api.getScreener({
      risk: riskFilter || undefined,
      sector: sector && sector !== 'All' ? sector : undefined,
      limit: 40,
    }),
    staleTime: 10 * 60 * 1000,
  })

  function handleSearch(result: SearchResult) {
    navigate(`/stock/${result.symbol}`)
  }

  if (error) return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <ErrorBox message={(error as Error).message} />
    </main>
  )

  return (
    <main className="max-w-4xl mx-auto px-4 md:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold" style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--ink)' }}>
          Top Stock Picks
        </h1>
        <p style={{ color: 'var(--muted)' }}>
          Ranked by our scoring engine using real NSE data. Matching your profile:{' '}
          <strong style={{ color: 'var(--ink)' }}>
            {profile.risk === 'low' ? 'Low risk' : profile.risk === 'medium' ? 'Medium risk' : 'High risk'} ·{' '}
            {formatINR(profile.amount)}
          </strong>
        </p>
      </div>

      {/* Search + filters */}
      <div className="space-y-3">
        <div className="flex gap-2 items-center">
          <SearchBar onSelect={handleSearch} className="flex-1" />
          <button
            onClick={() => setShowFilters(v => !v)}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors"
            style={{ borderColor: 'var(--border)', background: showFilters ? 'var(--accent)' : 'var(--card)', color: showFilters ? '#fff' : 'var(--muted)' }}
          >
            <SlidersHorizontal size={15} />
            Filters
          </button>
        </div>

        {showFilters && (
          <Card className="space-y-4 p-4">
            {/* Risk filter */}
            <div>
              <label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--muted)' }}>Risk Level</label>
              <div className="flex gap-2 flex-wrap">
                {RISK_FILTERS.map(r => (
                  <button
                    key={r.value}
                    onClick={() => setRiskFilter(r.value)}
                    className="px-3 py-1.5 rounded-full text-sm border transition-colors"
                    style={{
                      borderColor: riskFilter === r.value ? 'var(--accent)' : 'var(--border)',
                      background: riskFilter === r.value ? 'var(--accent)' : 'transparent',
                      color: riskFilter === r.value ? '#fff' : 'var(--muted)',
                    }}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Sector filter */}
            <div>
              <label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--muted)' }}>Sector</label>
              <div className="flex gap-2 flex-wrap">
                {SECTORS.map(s => (
                  <button
                    key={s}
                    onClick={() => setSector(s === 'All' ? '' : s)}
                    className="px-3 py-1.5 rounded-full text-sm border transition-colors"
                    style={{
                      borderColor: (sector === s || (!sector && s === 'All')) ? 'var(--accent)' : 'var(--border)',
                      background: (sector === s || (!sector && s === 'All')) ? 'var(--accent)' : 'transparent',
                      color: (sector === s || (!sector && s === 'All')) ? '#fff' : 'var(--muted)',
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* ETF tip */}
      <div
        className="rounded-xl p-4 text-sm border-l-4"
        style={{ background: 'color-mix(in srgb, #0F766E 8%, var(--card))', borderLeftColor: 'var(--accent)', color: 'var(--ink)' }}
      >
        <strong>💡 Beginner tip:</strong> Many first-time investors put 50-70% of their money in a{' '}
        <strong>Nifty 50 Index Fund or ETF</strong> (symbols: NIFTYBEES, JUNIORBEES) for safe broad exposure,
        and use the remaining amount for individual stock picks from the list below.
      </div>

      {/* Results */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {!isLoading && stocks.length === 0 && (
        <EmptyState
          icon="🔍"
          title="No stocks match your filters"
          body="Try widening the risk or sector filter, or search for a specific stock."
        />
      )}

      {!isLoading && stocks.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm" style={{ color: 'var(--muted)' }}>{stocks.length} stocks ranked by score</p>
          {stocks.map((stock, i) => (
            <StockRow
              key={stock.symbol}
              stock={stock}
              rank={i + 1}
              isWatched={watchlist.includes(stock.symbol)}
              onToggleWatch={() =>
                watchlist.includes(stock.symbol)
                  ? removeFromWatchlist(stock.symbol)
                  : addToWatchlist(stock.symbol)
              }
              onClick={() => navigate(`/stock/${stock.symbol}`)}
            />
          ))}
        </div>
      )}
    </main>
  )
}

function StockRow({
  stock, rank, isWatched, onToggleWatch, onClick,
}: {
  stock: ScreenerItem
  rank: number
  isWatched: boolean
  onToggleWatch: () => void
  onClick: () => void
}) {
  const up = stock.change_pct >= 0

  return (
    <div
      className="rounded-xl border p-4 flex items-center gap-4 cursor-pointer transition-all hover:border-teal-400 group"
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}
    >
      {/* Rank */}
      <div
        className="text-2xl font-black w-8 text-center flex-shrink-0"
        style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--muted)' }}
      >
        {rank}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="font-bold text-sm font-mono px-1.5 py-0.5 rounded"
            style={{ background: 'var(--border)', color: 'var(--ink)' }}
          >
            {stock.symbol}
          </span>
          <span className="font-semibold truncate" style={{ color: 'var(--ink)' }}>{stock.name}</span>
        </div>
        <div className="text-xs mt-0.5 flex items-center gap-2 flex-wrap" style={{ color: 'var(--muted)' }}>
          <span>{stock.sector}</span>
          <span>·</span>
          <span className={clsx(up ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400')}>
            {up ? '▲' : '▼'} {Math.abs(stock.change_pct).toFixed(2)}% today
          </span>
        </div>
      </div>

      {/* Sparkline */}
      <div className="w-24 flex-shrink-0 hidden sm:block">
        <Sparkline data={stock.sparkline} height={36} />
      </div>

      {/* Price */}
      <div className="text-right flex-shrink-0">
        <div className="font-bold" style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--ink)' }}>
          {formatINR(stock.price)}
        </div>
        <RiskBadge risk={stock.risk_label} />
      </div>

      {/* Score */}
      <div className="flex-shrink-0">
        <ScoreBadge score={stock.score} verdict={stock.verdict} verdictColor={stock.verdict_color} />
      </div>

      {/* Watchlist */}
      <button
        onClick={e => { e.stopPropagation(); onToggleWatch() }}
        className="flex-shrink-0 p-1.5 rounded-lg transition-colors hover:bg-amber-50 dark:hover:bg-amber-900/20"
        aria-label={isWatched ? 'Remove from watchlist' : 'Add to watchlist'}
        style={{ color: isWatched ? '#E07A1F' : 'var(--muted)' }}
      >
        {isWatched ? <Star size={18} fill="currentColor" /> : <StarOff size={18} />}
      </button>
    </div>
  )
}

