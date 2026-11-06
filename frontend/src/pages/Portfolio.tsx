/** Portfolio Builder page */
import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api, type PortfolioResult, type SearchResult } from '../lib/api'
import { useAppStore } from '../lib/store'
import { formatINR, formatPct } from '../lib/format'
import { SearchBar } from '../components/SearchBar'
import { Card, Button, ErrorBox, RiskBadge, ScoreBadge } from '../components/ui'
import { Trash2, Plus, Info, ShieldAlert, Sparkles } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

const DEFAULT_STOCKS = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY']
const PIE_COLORS = ['#0F766E', '#14213D', '#E07A1F', '#2DD4BF', '#6B5B95', '#F59E0B']

export function PortfolioPage() {
  const { profile } = useAppStore()
  const navigate = useNavigate()
  const [symbols, setSymbols] = useState<string[]>(DEFAULT_STOCKS)
  const [amount, setAmount] = useState(profile.amount)

  const mutation = useMutation({
    mutationFn: (vars: { symbols: string[]; amount: number; risk: string }) =>
      api.getPortfolio(vars.symbols, vars.amount, vars.risk),
  })

  // Auto-calculate on initial load or changes
  const { data: portfolio, isLoading, error } = useQuery({
    queryKey: ['portfolio', symbols, amount, profile.risk],
    queryFn: () => api.getPortfolio(symbols, amount, profile.risk),
    enabled: symbols.length >= 3 && amount >= 1000,
    staleTime: 60 * 1000,
  })

  function handleAddStock(result: SearchResult) {
    if (symbols.includes(result.symbol)) return
    if (symbols.length >= 6) {
      alert('Maximum 6 stocks allowed for beginners to keep management simple.')
      return
    }
    setSymbols([...symbols, result.symbol])
  }

  function handleRemoveStock(sym: string) {
    if (symbols.length <= 3) {
      alert('We recommend keeping at least 3 stocks for diversification.')
      return
    }
    setSymbols(symbols.filter(s => s !== sym))
  }

  const pieData = portfolio?.allocations.map(a => ({
    name: a.symbol,
    value: a.amount,
    weight: a.weight,
    sector: a.sector,
  })) || []

  return (
    <main className="max-w-5xl mx-auto px-4 md:px-6 py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold" style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--ink)' }}>
          Portfolio Builder
        </h1>
        <p className="mt-1" style={{ color: 'var(--muted)' }}>
          Build a balanced, diversified basket across 3 to 6 stocks. We protect you from concentrating too much in one stock or sector.
        </p>
      </div>

      {/* Amount and Stock Selection */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="space-y-4 md:col-span-1">
          <h2 className="font-bold text-lg" style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--ink)' }}>
            1. Total Investment
          </h2>
          <div>
            <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--muted)' }}>
              Amount to distribute (₹)
            </label>
            <input
              type="number"
              min={1000}
              step={5000}
              value={amount}
              onChange={e => setAmount(Number(e.target.value))}
              className="w-full rounded-lg border px-3 py-2 text-lg font-bold"
              style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--ink)' }}
            />
            <div className="text-xs mt-1" style={{ color: 'var(--accent)' }}>{formatINR(amount)}</div>
          </div>

          <div className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
            <label className="text-xs font-semibold block mb-2" style={{ color: 'var(--muted)' }}>
              Add a Stock (3–6 max)
            </label>
            <SearchBar onSelect={handleAddStock} placeholder="Search stock to add…" />
          </div>

          <div className="space-y-2 pt-2">
            <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Current Selection ({symbols.length}/6):</span>
            <div className="flex flex-wrap gap-2">
              {symbols.map(s => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-bold"
                  style={{ background: 'var(--bg)', color: 'var(--ink)', border: '1px solid var(--border)' }}
                >
                  {s}
                  <button
                    onClick={() => handleRemoveStock(s)}
                    className="hover:text-red-500 transition-colors"
                    aria-label={`Remove ${s}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        </Card>

        {/* Portfolio Breakdown */}
        <Card className="space-y-4 md:col-span-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-bold text-lg" style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--ink)' }}>
              2. Recommended Allocation
            </h2>
            {portfolio && (
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: 'var(--muted)' }}>Overall Risk:</span>
                <RiskBadge risk={portfolio.blended_risk} />
              </div>
            )}
          </div>

          {error && <ErrorBox message={(error as Error).message} />}

          {isLoading && (
            <div className="skeleton h-48 rounded-xl" />
          )}

          {portfolio && !isLoading && (
            <>
              {/* Pie and Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div style={{ height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                      >
                        {pieData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val: any) => formatINR(Number(val))}
                        contentStyle={{ background: 'var(--card)', borderColor: 'var(--border)', borderRadius: 8, fontSize: 12 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-2 text-xs">
                  {portfolio.allocations.map((a, i) => (
                    <div key={a.symbol} className="flex items-center justify-between p-1.5 rounded" style={{ background: 'var(--bg)' }}>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="font-mono font-bold">{a.symbol}</span>
                        <span style={{ color: 'var(--muted)' }}>({(a.weight * 100).toFixed(0)}%)</span>
                      </div>
                      <span className="font-bold" style={{ color: 'var(--ink)' }}>{formatINR(a.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Diversification Note */}
              <div className="p-3 rounded-lg text-xs border-l-4" style={{ background: 'var(--bg)', borderLeftColor: 'var(--accent)', color: 'var(--muted)' }}>
                <strong>Diversification rules:</strong> {portfolio.diversification_note}
              </div>

              {/* ETF beginner alternative */}
              <div className="p-3 rounded-lg text-xs" style={{ background: 'color-mix(in srgb, #E07A1F 10%, var(--card))', color: 'var(--ink)', border: '1px solid #E07A1F40' }}>
                <strong>Beginner alternative:</strong> {portfolio.etf_tip}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Detailed Stock Cards */}
      {portfolio?.allocations && (
        <div className="space-y-3">
          <h3 className="font-bold text-lg" style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--ink)' }}>
            Stock Allocations in Detail
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {portfolio.allocations.map((alloc) => (
              <Card
                key={alloc.symbol}
                className="cursor-pointer hover:border-teal-400 transition-all space-y-2"
                onClick={() => navigate(`/stock/${alloc.symbol}`)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-mono font-bold text-sm px-1.5 py-0.5 rounded" style={{ background: 'var(--border)' }}>
                      {alloc.symbol}
                    </span>
                    <h4 className="font-bold text-sm mt-1 truncate" style={{ color: 'var(--ink)' }}>{alloc.name}</h4>
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>{alloc.sector}</span>
                  </div>
                  <RiskBadge risk={alloc.risk_label} />
                </div>

                <div className="pt-2 border-t flex justify-between items-baseline" style={{ borderColor: 'var(--border)' }}>
                  <div>
                    <div className="text-xs" style={{ color: 'var(--muted)' }}>Invest</div>
                    <div className="text-lg font-black" style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--accent)' }}>
                      {formatINR(alloc.amount)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs" style={{ color: 'var(--muted)' }}>Weight</div>
                    <div className="font-bold text-sm">{(alloc.weight * 100).toFixed(1)}%</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}
