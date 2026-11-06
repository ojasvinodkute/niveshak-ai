/** Stock detail page — chart, analysis, fundamentals, projection, news */
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAppStore } from '../lib/store'
import { formatINR, formatPct, formatNumber, formatMarketCap, formatDateTime } from '../lib/format'
import { StockChart } from '../components/StockChart'
import { ScoreBreakdown } from '../components/ScoreBreakdown'
import { ProjectionChart } from '../components/ProjectionChart'
import { SearchBar } from '../components/SearchBar'
import { SkeletonCard, ErrorBox, DataLabel, RiskBadge, Card, Button, Tooltip } from '../components/ui'
import { Star, StarOff, ArrowLeft, Info } from 'lucide-react'
import { clsx } from 'clsx'
import type { SearchResult } from '../lib/api'

const PERIODS = [
  { label: '1M', value: '1mo' },
  { label: '6M', value: '6mo' },
  { label: '1Y', value: '1y' },
  { label: '3Y', value: '3y' },
  { label: '5Y', value: '5y' },
]

const OVERLAY_OPTIONS = [
  { key: 'sma20', label: 'SMA 20', color: '#3B82F6' },
  { key: 'sma50', label: 'SMA 50', color: '#E07A1F' },
  { key: 'sma200', label: 'SMA 200', color: '#0F766E' },
  { key: 'bb', label: 'Bollinger', color: '#8B5CF6' },
] as const

function FundamentalItem({ label, value, tooltip, color }: { label: string; value: string; tooltip?: string; color?: string }) {
  return (
    <div className="p-3 rounded-lg" style={{ background: 'var(--bg)' }}>
      <div className="flex items-center gap-1 text-xs font-semibold mb-1" style={{ color: 'var(--muted)' }}>
        {label}
        {tooltip && (
          <Tooltip text={tooltip}>
            <Info size={11} />
          </Tooltip>
        )}
      </div>
      <div className="font-bold text-base" style={{ color: color || 'var(--ink)', fontFamily: 'Bricolage Grotesque, sans-serif' }}>
        {value}
      </div>
    </div>
  )
}

export function StockDetailPage() {
  const { symbol } = useParams<{ symbol: string }>()
  const navigate = useNavigate()
  const { profile, watchlist, addToWatchlist, removeFromWatchlist } = useAppStore()
  const isWatched = symbol ? watchlist.includes(symbol) : false

  const [period, setPeriod] = useState('1y')
  const [overlays, setOverlays] = useState({ sma20: false, sma50: true, sma200: true, bb: false })
  const [projAmount, setProjAmount] = useState(Math.floor(profile.amount / 4 / 1000) * 1000 || 25000)
  const [projYears, setProjYears] = useState(5)

  const { data: stockData, isLoading: loadingStock, error: stockError } = useQuery({
    queryKey: ['stock', symbol],
    queryFn: () => api.getStock(symbol!),
    enabled: !!symbol,
  })

  const { data: ohlcv = [], isLoading: loadingChart } = useQuery({
    queryKey: ['ohlcv', symbol, period],
    queryFn: () => api.getOHLCV(symbol!, period),
    enabled: !!symbol,
    staleTime: 15 * 60 * 1000,
  })

  const { data: analysis, isLoading: loadingAnalysis } = useQuery({
    queryKey: ['analysis', symbol],
    queryFn: () => api.getAnalysis(symbol!),
    enabled: !!symbol,
    staleTime: 15 * 60 * 1000,
  })

  const { data: news = [], isLoading: loadingNews } = useQuery({
    queryKey: ['news', symbol],
    queryFn: () => api.getNews(symbol!),
    enabled: !!symbol,
    staleTime: 60 * 60 * 1000,
  })

  const { data: projection, isLoading: loadingProj } = useQuery({
    queryKey: ['projection', symbol, projAmount, projYears],
    queryFn: () => api.getProjection(symbol!, projAmount, projYears),
    enabled: !!symbol && projAmount >= 1000,
    staleTime: 60 * 1000,
  })

  if (stockError) return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <ErrorBox message={(stockError as Error).message} />
    </main>
  )

  const quote = stockData?.quote
  const fundamentals = stockData?.fundamentals
  const up = (quote?.change ?? 0) >= 0

  function handleSearch(result: SearchResult) {
    navigate(`/stock/${result.symbol}`)
  }

  return (
    <main className="max-w-5xl mx-auto px-4 md:px-6 py-8 space-y-8">
      {/* Nav */}
      <div className="flex items-center gap-4 flex-wrap">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm font-medium transition-colors"
          style={{ color: 'var(--accent)' }}
        >
          <ArrowLeft size={16} /> Back
        </button>
        <SearchBar onSelect={handleSearch} className="flex-1 max-w-sm" placeholder="Search another stock…" />
      </div>

      {/* Header */}
      {loadingStock ? (
        <SkeletonCard />
      ) : quote && (
        <Card>
          <div className="flex flex-wrap items-start gap-4 justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="font-bold font-mono text-sm px-2 py-0.5 rounded"
                  style={{ background: 'var(--border)', color: 'var(--ink)' }}
                >
                  {symbol}
                </span>
                {fundamentals?.sector && (
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>{fundamentals.sector}</span>
                )}
                <RiskBadge risk={analysis?.score.risk_label ?? 'Medium'} />
              </div>
              <h1
                className="text-2xl md:text-3xl font-extrabold"
                style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--ink)' }}
              >
                {quote.name}
              </h1>
              <div className="flex items-baseline gap-3 mt-2">
                <span
                  className="text-4xl font-black"
                  style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--ink)' }}
                >
                  {formatINR(quote.price)}
                </span>
                <span className={clsx('text-lg font-semibold', up ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400')}>
                  {up ? '▲' : '▼'} {formatINR(Math.abs(quote.change))} ({Math.abs(quote.change_pct).toFixed(2)}%)
                </span>
              </div>
              <div className="mt-1">
                <DataLabel delayed={quote.delayed} asOf={quote.timestamp} />
              </div>
            </div>

            {/* Watchlist + score */}
            <div className="flex flex-col items-end gap-2">
              <button
                onClick={() => symbol && (isWatched ? removeFromWatchlist(symbol) : addToWatchlist(symbol))}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors"
                style={{
                  borderColor: isWatched ? '#E07A1F' : 'var(--border)',
                  color: isWatched ? '#E07A1F' : 'var(--muted)',
                  background: 'var(--card)',
                }}
              >
                {isWatched ? <Star size={15} fill="currentColor" /> : <StarOff size={15} />}
                {isWatched ? 'Watching' : 'Watch'}
              </button>
              {analysis && (
                <div
                  className="text-right px-3 py-2 rounded-xl"
                  style={{ background: 'var(--bg)' }}
                >
                  <div className="text-xs" style={{ color: 'var(--muted)' }}>AI Score</div>
                  <div
                    className="text-3xl font-black"
                    style={{
                      fontFamily: 'Bricolage Grotesque, sans-serif',
                      color: analysis.score.verdict_color === 'green' ? '#1B7F4B' : analysis.score.verdict_color === 'red' ? '#C2410C' : '#E07A1F',
                    }}
                  >
                    {analysis.score.total}
                  </div>
                  <div className="text-xs font-semibold"
                    style={{ color: analysis.score.verdict_color === 'green' ? '#1B7F4B' : analysis.score.verdict_color === 'red' ? '#C2410C' : '#E07A1F' }}
                  >
                    {analysis.score.verdict}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick stats */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <FundamentalItem label="52W High" value={formatINR(quote.week_52_high)} />
            <FundamentalItem label="52W Low" value={formatINR(quote.week_52_low)} />
            <FundamentalItem label="Market Cap" value={formatMarketCap(quote.market_cap)} tooltip="Total market value of all shares" />
            <FundamentalItem label="Avg Volume" value={quote.avg_volume?.toLocaleString('en-IN') ?? '—'} tooltip="Average daily trading volume" />
          </div>
        </Card>
      )}

      {/* Chart */}
      <Card className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="font-bold text-lg" style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--ink)' }}>
            Price Chart
          </h2>
          <div className="flex gap-1">
            {PERIODS.map(p => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className="px-2.5 py-1 rounded text-sm font-medium transition-colors"
                style={{
                  background: period === p.value ? 'var(--accent)' : 'transparent',
                  color: period === p.value ? '#fff' : 'var(--muted)',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Overlay toggles */}
        <div className="flex gap-2 flex-wrap">
          {OVERLAY_OPTIONS.map(o => (
            <button
              key={o.key}
              onClick={() => setOverlays(prev => ({ ...prev, [o.key]: !prev[o.key] }))}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors"
              style={{
                borderColor: overlays[o.key] ? o.color : 'var(--border)',
                background: overlays[o.key] ? `${o.color}20` : 'transparent',
                color: overlays[o.key] ? o.color : 'var(--muted)',
              }}
            >
              <span style={{ width: 12, height: 2, background: o.color, display: 'inline-block', borderRadius: 1 }} />
              {o.label}
            </button>
          ))}
        </div>

        {loadingChart ? (
          <div className="skeleton rounded-xl" style={{ height: 400 }} />
        ) : (
          <StockChart bars={ohlcv} overlays={overlays} height={400} />
        )}
      </Card>

      {/* Analysis score breakdown */}
      <Card className="space-y-4">
        <h2 className="font-bold text-xl" style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--ink)' }}>
          Why the score is {analysis?.score.total ?? '…'}/100
        </h2>
        {loadingAnalysis ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}</div>
        ) : analysis ? (
          <ScoreBreakdown score={analysis.score} />
        ) : null}
      </Card>

      {/* Fundamentals */}
      {fundamentals && (
        <Card className="space-y-4">
          <h2 className="font-bold text-xl" style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--ink)' }}>
            Company Fundamentals
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            <FundamentalItem
              label="P/E Ratio"
              value={formatNumber(fundamentals.pe_ratio, 1)}
              tooltip="Price-to-Earnings: how much you pay for ₹1 of profit. Lower can mean cheaper."
            />
            <FundamentalItem
              label="P/B Ratio"
              value={formatNumber(fundamentals.pb_ratio, 1)}
              tooltip="Price-to-Book: price vs accounting value of assets. <1 can mean undervalued."
            />
            <FundamentalItem
              label="ROE"
              value={fundamentals.roe ? `${(fundamentals.roe * 100).toFixed(1)}%` : '—'}
              tooltip="Return on Equity: how well the company turns shareholder money into profit. Higher is better."
              color={fundamentals.roe && fundamentals.roe > 0.15 ? '#1B7F4B' : undefined}
            />
            <FundamentalItem
              label="Debt/Equity"
              value={formatNumber(fundamentals.debt_to_equity, 2)}
              tooltip="How much debt the company carries per ₹1 of equity. Lower is safer."
              color={fundamentals.debt_to_equity && fundamentals.debt_to_equity > 2 ? '#C2410C' : undefined}
            />
            <FundamentalItem
              label="Dividend Yield"
              value={fundamentals.dividend_yield ? `${(fundamentals.dividend_yield * 100).toFixed(2)}%` : '—'}
              tooltip="Annual dividend as a % of price. Good for income investors."
            />
            <FundamentalItem
              label="EPS"
              value={fundamentals.eps ? formatINR(fundamentals.eps) : '—'}
              tooltip="Earnings Per Share: profit divided by number of shares."
            />
            <FundamentalItem
              label="Revenue Growth"
              value={fundamentals.revenue_growth ? `${(fundamentals.revenue_growth * 100).toFixed(1)}%` : '—'}
              tooltip="Year-over-year revenue growth."
              color={fundamentals.revenue_growth && fundamentals.revenue_growth > 0 ? '#1B7F4B' : '#C2410C'}
            />
            <FundamentalItem
              label="Industry"
              value={fundamentals.industry ?? '—'}
            />
          </div>
        </Card>
      )}

      {/* Indicators snapshot */}
      {analysis?.indicators && (
        <Card className="space-y-4">
          <h2 className="font-bold text-xl" style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--ink)' }}>
            Technical Indicators
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            <FundamentalItem label="RSI (14)" value={formatNumber(analysis.indicators.rsi, 1)} tooltip="0-100 gauge. Above 70 = overheated; below 30 = oversold." />
            <FundamentalItem label="MACD" value={formatNumber(analysis.indicators.macd, 2)} tooltip="Trend-following momentum indicator. Positive = bullish." />
            <FundamentalItem label="SMA 20" value={formatINR(analysis.indicators.sma20 ?? 0)} tooltip="Average price over last 20 trading days." />
            <FundamentalItem label="SMA 50" value={formatINR(analysis.indicators.sma50 ?? 0)} tooltip="Average price over last 50 trading days." />
            <FundamentalItem label="SMA 200" value={formatINR(analysis.indicators.sma200 ?? 0)} tooltip="Average price over last 200 trading days. Long-term trend." />
            <FundamentalItem label="Volatility" value={analysis.indicators.volatility ? `${(analysis.indicators.volatility * 100).toFixed(1)}%` : '—'} tooltip="Annualised price swings. Higher = riskier but can mean more upside." />
            <FundamentalItem label="Max Drawdown" value={analysis.indicators.max_drawdown ? `${(analysis.indicators.max_drawdown * 100).toFixed(1)}%` : '—'} tooltip="Biggest fall from a peak in the period." />
            <FundamentalItem label="Beta" value={formatNumber(analysis.indicators.beta, 2)} tooltip="How much the stock moves vs Nifty 50. Beta >1 = more volatile than the index." />
          </div>

          {/* Returns */}
          <div>
            <h3 className="font-semibold text-sm mb-2" style={{ color: 'var(--muted)' }}>Historical Returns</h3>
            <div className="grid grid-cols-4 gap-3">
              {(['1m', '6m', '1y', '3y'] as const).map(key => {
                const v = analysis.indicators.returns?.[key]
                const isPos = v !== null && v !== undefined && v >= 0
                return (
                  <div key={key} className="p-3 rounded-lg text-center" style={{ background: 'var(--bg)' }}>
                    <div className="text-xs font-semibold mb-1 uppercase" style={{ color: 'var(--muted)' }}>{key}</div>
                    <div
                      className="font-bold"
                      style={{ color: v === null || v === undefined ? 'var(--muted)' : isPos ? '#1B7F4B' : '#C2410C', fontFamily: 'Bricolage Grotesque, sans-serif' }}
                    >
                      {v !== null && v !== undefined ? `${isPos ? '+' : ''}${(v * 100).toFixed(1)}%` : '—'}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </Card>
      )}

      {/* Investment calculator */}
      <Card className="space-y-6">
        <div>
          <h2 className="font-bold text-xl" style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--ink)' }}>
            What could you make?
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            Rough outcome ranges using this stock's volatility and a conservative return estimate. Not a promise.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--ink)' }}>
              Amount in {symbol}
            </label>
            <input
              type="number"
              min={1000}
              step={1000}
              value={projAmount}
              onChange={e => setProjAmount(Number(e.target.value))}
              className="w-full rounded-lg border px-3 py-2 text-lg font-semibold"
              style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--ink)' }}
            />
            <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{formatINR(projAmount)}</div>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--ink)' }}>
              Hold for <strong style={{ color: 'var(--accent)' }}>{projYears} year{projYears !== 1 ? 's' : ''}</strong>
            </label>
            <input
              type="range"
              min={1}
              max={10}
              value={projYears}
              onChange={e => setProjYears(Number(e.target.value))}
              className="w-full"
              style={{ accentColor: 'var(--accent)' }}
            />
            <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--muted)' }}>
              <span>1 yr</span><span>10 yrs</span>
            </div>
          </div>
        </div>

        {loadingProj && <div className="skeleton h-40 rounded-xl" />}

        {projection && !loadingProj && (
          <>
            {/* Fan chart */}
            <ProjectionChart data={projection.fan_data} inputAmount={projAmount} />

            {/* Scenario cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { label: 'Unlucky scenario', note: '1-in-6 chance of worse', value: projection.p10, color: '#C2410C' },
                { label: 'Middle estimate', note: 'Most likely range', value: projection.p50, color: '#0F766E' },
                { label: 'Lucky scenario', note: '1-in-6 chance of better', value: projection.p90, color: '#1B7F4B' },
              ].map(({ label, note, value, color }) => (
                <div key={label} className="p-4 rounded-xl" style={{ background: 'var(--bg)' }}>
                  <div className="text-xs" style={{ color: 'var(--muted)' }}>{note}</div>
                  <div className="text-sm font-semibold mb-1" style={{ color: 'var(--ink)' }}>{label}</div>
                  <div className="text-2xl font-black" style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color }}>
                    {formatINR(value)}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: value >= projAmount ? '#1B7F4B' : '#C2410C' }}>
                    {value >= projAmount ? '+' : '−'}{formatINR(Math.abs(value - projAmount))}
                  </div>
                </div>
              ))}
            </div>

            <div className="text-sm rounded-xl p-4 space-y-2" style={{ background: 'var(--bg)', color: 'var(--muted)' }}>
              <p>
                <strong style={{ color: 'var(--ink)' }}>Assumed return:</strong>{' '}
                {(projection.assumed_return * 100).toFixed(1)}% per year (blended conservative estimate — not based on past alone).
              </p>
              <p>
                <strong style={{ color: 'var(--ink)' }}>Chance of losing money:</strong>{' '}
                ~{(projection.prob_loss * 100).toFixed(0)}% — this is a real possibility.
              </p>
              <p>{projection.note}</p>
              <p className="text-xs">{projection.tax_note}</p>
            </div>
          </>
        )}
      </Card>

      {/* News */}
      {news.length > 0 && (
        <Card className="space-y-3">
          <h2 className="font-bold text-xl" style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--ink)' }}>
            Latest News
          </h2>
          <div className="space-y-3">
            {news.map((item, i) => (
              <a
                key={i}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-3 rounded-lg border hover:border-teal-400 transition-colors"
                style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}
              >
                <div className="font-semibold text-sm mb-1" style={{ color: 'var(--ink)' }}>{item.title}</div>
                <div className="text-xs" style={{ color: 'var(--muted)' }}>
                  {item.publisher} · {item.published_at ? new Date(item.published_at).toLocaleDateString('en-IN') : ''}
                </div>
              </a>
            ))}
          </div>
        </Card>
      )}

      {/* Add to portfolio CTA */}
      <div className="flex gap-3 flex-wrap">
        <Button onClick={() => navigate('/portfolio')} variant="secondary">
          + Add to Portfolio Builder
        </Button>
        <Button onClick={() => navigate('/compare')} variant="ghost">
          Compare stocks
        </Button>
      </div>
    </main>
  )
}

