/** Watchlist Page */
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../lib/store'
import { api, type SearchResult } from '../lib/api'
import { formatINR, formatPct } from '../lib/format'
import { SearchBar } from '../components/SearchBar'
import { Card, Button, EmptyState, ScoreBadge, RiskBadge, SkeletonCard } from '../components/ui'
import { Trash2 } from 'lucide-react'
import { Sparkline } from '../components/Sparkline'

export function WatchlistPage() {
  const navigate = useNavigate()
  const { watchlist, removeFromWatchlist, addToWatchlist } = useAppStore()

  function handleAdd(result: SearchResult) {
    addToWatchlist(result.symbol)
  }

  return (
    <main className="max-w-4xl mx-auto px-4 md:px-6 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold" style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--ink)' }}>
            Your Watchlist
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
            Save stocks here to follow their performance and score updates over time.
          </p>
        </div>

        <div className="w-full sm:w-64">
          <SearchBar onSelect={handleAdd} placeholder="Add symbol to watchlist…" />
        </div>
      </div>

      {watchlist.length === 0 ? (
        <EmptyState
          icon="⭐"
          title="Your watchlist is empty"
          body="Search for stocks or explore our Top Picks screener and tap the star icon to save stocks here."
        />
      ) : (
        <div className="space-y-3">
          {watchlist.map(symbol => (
            <WatchlistItem
              key={symbol}
              symbol={symbol}
              onRemove={() => removeFromWatchlist(symbol)}
              onSelect={() => navigate(`/stock/${symbol}`)}
            />
          ))}
        </div>
      )}
    </main>
  )
}

function WatchlistItem({ symbol, onRemove, onSelect }: { symbol: string; onRemove: () => void; onSelect: () => void }) {
  const { data: stock, isLoading: loadingStock } = useQuery({
    queryKey: ['stock', symbol],
    queryFn: () => api.getStock(symbol),
    staleTime: 5 * 60 * 1000,
  })

  const { data: analysis, isLoading: loadingAnalysis } = useQuery({
    queryKey: ['analysis', symbol],
    queryFn: () => api.getAnalysis(symbol),
    staleTime: 5 * 60 * 1000,
  })

  if (loadingStock || loadingAnalysis) {
    return <SkeletonCard className="h-20" />
  }

  const q = stock?.quote
  const score = analysis?.score

  if (!q) {
    return (
      <Card className="flex justify-between items-center p-4">
        <div>
          <span className="font-mono font-bold">{symbol}</span>
          <div className="text-xs text-red-500">Failed to load live data</div>
        </div>
        <button onClick={onRemove} className="text-red-500 hover:text-red-700">
          <Trash2 size={16} />
        </button>
      </Card>
    )
  }

  const up = q.change >= 0

  return (
    <Card
      className="flex items-center gap-4 p-4 cursor-pointer hover:border-teal-400 transition-all"
      onClick={onSelect}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-xs px-2 py-0.5 rounded" style={{ background: 'var(--border)' }}>
            {symbol}
          </span>
          <span className="font-semibold text-sm truncate" style={{ color: 'var(--ink)' }}>{q.name}</span>
        </div>
        <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
          {stock?.fundamentals?.sector || 'NSE'}
        </div>
      </div>

      <div className="w-24 hidden sm:block">
        <Sparkline data={stock?.sparkline || []} height={32} />
      </div>

      <div className="text-right">
        <div className="font-bold text-sm" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>
          {formatINR(q.price)}
        </div>
        <div className={`text-xs font-semibold ${up ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
          {up ? '▲' : '▼'} {Math.abs(q.change_pct).toFixed(2)}%
        </div>
      </div>

      {score && (
        <div className="hidden md:block">
          <ScoreBadge score={score.total} verdict={score.verdict} verdictColor={score.verdict_color} />
        </div>
      )}

      <button
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-600 transition-colors"
        aria-label="Remove from watchlist"
      >
        <Trash2 size={16} />
      </button>
    </Card>
  )
}
