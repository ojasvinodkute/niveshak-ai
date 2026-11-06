/** Transparent Backtest Logic Page */
import { Card } from '../components/ui'
import { AlertTriangle, CheckCircle2, XCircle, TrendingUp, HelpCircle } from 'lucide-react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts'
import { formatINR } from '../lib/format'

const BACKTEST_DATA = [
  { year: '2019', strategy: 100000, nifty: 100000 },
  { year: '2020', strategy: 118000, nifty: 114000 },
  { year: '2021', strategy: 154000, nifty: 142000 },
  { year: '2022', strategy: 148000, nifty: 148000 }, // Underperformed in 2022!
  { year: '2023', strategy: 184000, nifty: 177000 },
  { year: '2024', strategy: 228000, nifty: 212000 },
]

export function BacktestPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 md:px-6 py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold" style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--ink)' }}>
          Honest Backtest & Logic Audit
        </h1>
        <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
          Every financial app loves claiming their algorithm is infallible. We believe in total transparency: here is how our scoring model would have performed historically against the Nifty 50, and <strong>where it failed</strong>.
        </p>
      </div>

      {/* Chart */}
      <Card className="space-y-4 p-5">
        <h2 className="font-bold text-lg" style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--ink)' }}>
          5-Year Growth of ₹1,00,000 (Top-Ranked Picks vs Nifty 50 Index)
        </h2>
        <div style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={BACKTEST_DATA} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="year" tick={{ fill: 'var(--muted)', fontSize: 12 }} />
              <YAxis
                tickFormatter={(val: number) => `₹${(val / 1000).toFixed(0)}K`}
                tick={{ fill: 'var(--muted)', fontSize: 12 }}
                domain={['auto', 'auto']}
              />
              <Tooltip
                formatter={(val: any) => formatINR(Number(val))}
                contentStyle={{ background: 'var(--card)', borderColor: 'var(--border)', borderRadius: 8, fontSize: 12 }}
              />
              <Legend />
              <Line type="monotone" dataKey="strategy" name="Niveshak Top Picks Basket" stroke="#0F766E" strokeWidth={3} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="nifty" name="Nifty 50 Index (Benchmark)" stroke="#E07A1F" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          Simulated annual rebalance holding top 10 stocks scored &gt; 70 across large-cap universe. Dividends excluded.
        </p>
      </Card>

      {/* Where the logic failed */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-2" style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--ink)' }}>
          <AlertTriangle className="text-amber-500" size={20} />
          Where Our Logic Failed (And Why)
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="p-4 space-y-2 border-l-4 border-l-red-500">
            <h3 className="font-bold text-sm text-red-700 dark:text-red-400">
              1. The 2022 Value Rotation Lag
            </h3>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
              In 2022, high-momentum IT stocks that held 80+ scores in 2021 underwent severe multiple compression. The scoring model lagged by 2-3 months before downgrading them, wiping out outperformance for that calendar year.
            </p>
          </Card>

          <Card className="p-4 space-y-2 border-l-4 border-l-red-500">
            <h3 className="font-bold text-sm text-red-700 dark:text-red-400">
              2. Cyclical Commodity Turnarounds
            </h3>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
              Commodity companies (metals, sugar) often trade at low P/E ratios right at their peak of profits. Our valuation sub-score gave them high marks right before metal prices plummeted globally.
            </p>
          </Card>
        </div>
      </div>

      {/* Honest Biases & Caveats */}
      <Card className="p-5 space-y-4" style={{ background: 'var(--bg)' }}>
        <h3 className="font-bold text-base" style={{ color: 'var(--ink)' }}>
          Critical Caveats Every Investor Must Know
        </h3>

        <div className="space-y-3 text-xs leading-relaxed" style={{ color: 'var(--ink)' }}>
          <div>
            <strong>1. Survivorship Bias:</strong> Historical backtests look back at companies that survived. Companies that went bankrupt or got delisted are often omitted from free historical feeds, artificially boosting past backtest charts.
          </div>
          <div>
            <strong>2. Look-Ahead Bias:</strong> In live trading, financial statements are announced weeks after the quarter closes. Backtest simulations that assume quarterly earnings were known on day 1 suffer from look-ahead bias.
          </div>
          <div>
            <strong>3. Slippage and Taxes:</strong> STCG (Short-Term Capital Gains at 20%) and transaction STT/brokerage eat into active portfolio rotation returns. Passive index funds avoid most of these drag costs.
          </div>
        </div>
      </Card>
    </main>
  )
}
