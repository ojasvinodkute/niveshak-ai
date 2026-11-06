/** Market Overview Page */
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api, type MarketOverview } from '../lib/api'
import { formatINR, formatPct, formatNumber } from '../lib/format'
import { Card, SkeletonCard, ErrorBox, ScoreBadge, RiskBadge, DataLabel } from '../components/ui'
import { TrendingUp, TrendingDown, Layers, BarChart2 } from 'lucide-react'

const SECTORS_HEATMAP = [
  { name: 'Nifty IT', change: 1.45, lead: 'TCS, INFY' },
  { name: 'Nifty Bank', change: -0.32, lead: 'HDFCBANK, ICICIBANK' },
  { name: 'Nifty Auto', change: 0.85, lead: 'MARUTI, TATAMOTORS' },
  { name: 'Nifty Pharma', change: 0.22, lead: 'SUNPHARMA, CIPLA' },
  { name: 'Nifty FMCG', change: -0.15, lead: 'ITC, HINDUNILVR' },
  { name: 'Nifty Metal', change: 2.10, lead: 'TATASTEEL, JSWSTEEL' },
  { name: 'Nifty Energy', change: 0.65, lead: 'RELIANCE, ONGC' },
  { name: 'Nifty Infra', change: 0.40, lead: 'LT, NTPC' },
]

export function MarketOverviewPage() {
  const navigate = useNavigate()
  const { data: market, isLoading, error } = useQuery({
    queryKey: ['market-overview'],
    queryFn: () => api.getMarketOverview(),
    staleTime: 5 * 60 * 1000,
  })

  return (
    <main className="max-w-5xl mx-auto px-4 md:px-6 py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold" style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--ink)' }}>
          Indian Market Pulse
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
          Broad overview of Nifty 50, Sensex, key sector health, and today's top moving stocks.
        </p>
      </div>

      {error && <ErrorBox message={(error as Error).message} />}

      {/* Index Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            {/* Nifty 50 */}
            <Card className="space-y-2">
              <div className="flex justify-between items-center text-xs" style={{ color: 'var(--muted)' }}>
                <span className="font-bold tracking-wide">NIFTY 50 INDEX</span>
                <span className="font-mono">NSE</span>
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-black" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>
                  {market?.nifty50?.price ? formatNumber(market.nifty50.price, 2) : '24,200.00'}
                </span>
                <span className={`text-sm font-bold ${(market?.nifty50?.change ?? 0) >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                  {(market?.nifty50?.change ?? 0) >= 0 ? '▲ +' : '▼ '}
                  {formatNumber(market?.nifty50?.change ?? 0, 2)} ({formatNumber(market?.nifty50?.change_pct ?? 0, 2)}%)
                </span>
              </div>
              <div className="text-xs" style={{ color: 'var(--muted)' }}>
                Top 50 companies driving the Indian economy.
              </div>
            </Card>

            {/* Sensex */}
            <Card className="space-y-2">
              <div className="flex justify-between items-center text-xs" style={{ color: 'var(--muted)' }}>
                <span className="font-bold tracking-wide">BSE SENSEX</span>
                <span className="font-mono">BSE</span>
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-black" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>
                  {market?.sensex?.price ? formatNumber(market.sensex.price, 2) : '79,500.00'}
                </span>
                <span className={`text-sm font-bold ${(market?.sensex?.change ?? 0) >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                  {(market?.sensex?.change ?? 0) >= 0 ? '▲ +' : '▼ '}
                  {formatNumber(market?.sensex?.change ?? 0, 2)} ({formatNumber(market?.sensex?.change_pct ?? 0, 2)}%)
                </span>
              </div>
              <div className="text-xs" style={{ color: 'var(--muted)' }}>
                30 financially sound blue-chip companies on Bombay Stock Exchange.
              </div>
            </Card>
          </>
        )}
      </div>

      {/* Sector Heatmap */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Layers size={18} style={{ color: 'var(--accent)' }} />
          <h2 className="text-xl font-bold" style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--ink)' }}>
            Sector Performance Today
          </h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {SECTORS_HEATMAP.map(sec => {
            const up = sec.change >= 0
            return (
              <div
                key={sec.name}
                className="p-3 rounded-xl border flex flex-col justify-between transition-transform hover:-translate-y-0.5"
                style={{
                  background: up ? 'color-mix(in srgb, #1B7F4B 8%, var(--card))' : 'color-mix(in srgb, #C2410C 8%, var(--card))',
                  borderColor: up ? '#1B7F4B40' : '#C2410C40',
                }}
              >
                <div>
                  <div className="font-bold text-sm" style={{ color: 'var(--ink)' }}>{sec.name}</div>
                  <div className="text-xs" style={{ color: 'var(--muted)' }}>{sec.lead}</div>
                </div>
                <div className={`mt-2 font-mono font-bold text-sm ${up ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                  {up ? '+' : ''}{sec.change.toFixed(2)}%
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Gainers & Losers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Gainers */}
        <Card className="space-y-4">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold">
            <TrendingUp size={18} />
            <h3 className="font-display">Top Gainers</h3>
          </div>
          <div className="space-y-2">
            {(market?.top_gainers?.slice(0, 5) || []).map(g => (
              <div
                key={g.symbol}
                className="flex items-center justify-between p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer"
                onClick={() => navigate(`/stock/${g.symbol}`)}
              >
                <div>
                  <div className="font-mono font-bold text-xs">{g.symbol}</div>
                  <div className="text-xs" style={{ color: 'var(--muted)' }}>{g.name}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-xs">{formatINR(g.price)}</div>
                  <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    +{Math.abs(g.change_pct).toFixed(2)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Top Losers */}
        <Card className="space-y-4">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-bold">
            <TrendingDown size={18} />
            <h3 className="font-display">Top Losers</h3>
          </div>
          <div className="space-y-2">
            {(market?.top_losers?.slice(0, 5) || []).map(l => (
              <div
                key={l.symbol}
                className="flex items-center justify-between p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer"
                onClick={() => navigate(`/stock/${l.symbol}`)}
              >
                <div>
                  <div className="font-mono font-bold text-xs">{l.symbol}</div>
                  <div className="text-xs" style={{ color: 'var(--muted)' }}>{l.name}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-xs">{formatINR(l.price)}</div>
                  <div className="text-xs font-bold text-red-700 dark:text-red-400">
                    -{Math.abs(l.change_pct).toFixed(2)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </main>
  )
}
