/** Compare 2-3 stocks side-by-side */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api, type SearchResult, type StockDetail, type AnalysisResult } from '../lib/api'
import { formatINR, formatNumber, formatMarketCap } from '../lib/format'
import { SearchBar } from '../components/SearchBar'
import { Card, Button, ScoreBadge, RiskBadge, ErrorBox } from '../components/ui'
import { X, Plus, Info } from 'lucide-react'

const INITIAL_SYMBOLS = ['RELIANCE', 'TCS']

export function ComparePage() {
  const navigate = useNavigate()
  const [symbols, setSymbols] = useState<string[]>(INITIAL_SYMBOLS)

  function addStock(result: SearchResult) {
    if (symbols.includes(result.symbol)) return
    if (symbols.length >= 3) {
      alert('You can compare up to 3 stocks side-by-side.')
      return
    }
    setSymbols([...symbols, result.symbol])
  }

  function removeStock(sym: string) {
    if (symbols.length <= 1) return
    setSymbols(symbols.filter(s => s !== sym))
  }

  const queries = symbols.map(sym => ({
    sym,
    stock: useQuery({
      queryKey: ['stock', sym],
      queryFn: () => api.getStock(sym),
    }),
    analysis: useQuery({
      queryKey: ['analysis', sym],
      queryFn: () => api.getAnalysis(sym),
    }),
  }))

  const isLoading = queries.some(q => q.stock.isLoading || q.analysis.isLoading)

  return (
    <main className="max-w-6xl mx-auto px-4 md:px-6 py-8 space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold" style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--ink)' }}>
            Compare Stocks Side-by-Side
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
            Put 2 or 3 Indian stocks next to each other to see which has stronger fundamentals, better momentum, or lower risk.
          </p>
        </div>

        {symbols.length < 3 && (
          <div className="w-full sm:w-72">
            <SearchBar onSelect={addStock} placeholder="Add a stock to compare…" />
          </div>
        )}
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {symbols.map(s => (
            <Card key={s} className="skeleton h-96 rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {queries.map(({ sym, stock, analysis }) => {
            const q = stock.data?.quote
            const f = stock.data?.fundamentals
            const score = analysis.data?.score
            const ind = analysis.data?.indicators

            if (!q) {
              return (
                <Card key={sym} className="p-4 space-y-2">
                  <div className="font-mono font-bold">{sym}</div>
                  <div className="text-xs text-red-500">Failed to load data for {sym}.</div>
                </Card>
              )
            }

            return (
              <Card key={sym} className="space-y-6 relative">
                {symbols.length > 1 && (
                  <button
                    onClick={() => removeStock(sym)}
                    className="absolute top-4 right-4 p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    aria-label={`Remove ${sym}`}
                    style={{ color: 'var(--muted)' }}
                  >
                    <X size={16} />
                  </button>
                )}

                {/* Header */}
                <div>
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded" style={{ background: 'var(--border)' }}>
                    {sym}
                  </span>
                  <h3 className="font-bold text-lg mt-1 truncate" style={{ color: 'var(--ink)' }}>
                    {q.name}
                  </h3>
                  <div className="text-xs" style={{ color: 'var(--muted)' }}>{f?.sector || 'NSE'}</div>

                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-2xl font-black" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>
                      {formatINR(q.price)}
                    </span>
                    <span className={`text-xs font-bold ${q.change >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                      {q.change >= 0 ? '▲' : '▼'} {Math.abs(q.change_pct).toFixed(2)}%
                    </span>
                  </div>
                </div>

                {/* Score & Risk */}
                {score && (
                  <div className="space-y-2 p-3 rounded-lg" style={{ background: 'var(--bg)' }}>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>AI Score</span>
                      <ScoreBadge score={score.total} verdict={score.verdict} verdictColor={score.verdict_color} />
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Risk Rating</span>
                      <RiskBadge risk={score.risk_label} />
                    </div>
                  </div>
                )}

                {/* Fundamentals Comparison */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                    Fundamentals
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded" style={{ background: 'var(--bg)' }}>
                      <div style={{ color: 'var(--muted)' }}>P/E Ratio</div>
                      <div className="font-bold text-sm mt-0.5">{formatNumber(f?.pe_ratio, 1)}</div>
                    </div>
                    <div className="p-2 rounded" style={{ background: 'var(--bg)' }}>
                      <div style={{ color: 'var(--muted)' }}>ROE</div>
                      <div className="font-bold text-sm mt-0.5">{f?.roe ? `${(f.roe * 100).toFixed(1)}%` : '—'}</div>
                    </div>
                    <div className="p-2 rounded" style={{ background: 'var(--bg)' }}>
                      <div style={{ color: 'var(--muted)' }}>Debt / Equity</div>
                      <div className="font-bold text-sm mt-0.5">{formatNumber(f?.debt_to_equity, 2)}</div>
                    </div>
                    <div className="p-2 rounded" style={{ background: 'var(--bg)' }}>
                      <div style={{ color: 'var(--muted)' }}>Market Cap</div>
                      <div className="font-bold text-sm mt-0.5">{formatMarketCap(q.market_cap)}</div>
                    </div>
                  </div>
                </div>

                {/* Technicals */}
                {ind && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                      Technicals & Volatility
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded" style={{ background: 'var(--bg)' }}>
                        <div style={{ color: 'var(--muted)' }}>RSI (14)</div>
                        <div className="font-bold text-sm mt-0.5">{formatNumber(ind.rsi, 1)}</div>
                      </div>
                      <div className="p-2 rounded" style={{ background: 'var(--bg)' }}>
                        <div style={{ color: 'var(--muted)' }}>1Y Volatility</div>
                        <div className="font-bold text-sm mt-0.5">{ind.volatility ? `${(ind.volatility * 100).toFixed(1)}%` : '—'}</div>
                      </div>
                      <div className="p-2 rounded" style={{ background: 'var(--bg)' }}>
                        <div style={{ color: 'var(--muted)' }}>Max Drawdown</div>
                        <div className="font-bold text-sm mt-0.5">{ind.max_drawdown ? `${(ind.max_drawdown * 100).toFixed(1)}%` : '—'}</div>
                      </div>
                      <div className="p-2 rounded" style={{ background: 'var(--bg)' }}>
                        <div style={{ color: 'var(--muted)' }}>Beta vs Nifty</div>
                        <div className="font-bold text-sm mt-0.5">{formatNumber(ind.beta, 2)}</div>
                      </div>
                    </div>
                  </div>
                )}

                <Button
                  onClick={() => navigate(`/stock/${sym}`)}
                  variant="secondary"
                  className="w-full text-xs"
                >
                  View Full Analysis →
                </Button>
              </Card>
            )
          })}
        </div>
      )}
    </main>
  )
}
