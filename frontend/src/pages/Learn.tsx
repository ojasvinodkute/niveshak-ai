/** Beginner Glossary & Learn section */
import { useState } from 'react'
import { Card } from '../components/ui'
import { BookOpen, Search, HelpCircle, AlertCircle, ShieldCheck } from 'lucide-react'

interface Term {
  term: string
  plain: string
  example: string
  whyItMatters: string
  category: 'Basics' | 'Technicals' | 'Valuation' | 'Risk'
}

const GLOSSARY_TERMS: Term[] = [
  {
    category: 'Basics',
    term: 'Nifty 50',
    plain: 'A shopping basket containing 50 of India\'s largest and most established companies (like Reliance, TCS, HDFC Bank).',
    example: 'When news says "market is up 1%", they usually mean the Nifty 50 gained 1%.',
    whyItMatters: 'If you don\'t want to pick individual stocks, you can buy an ETF tracking the Nifty 50 and own a slice of all 50.',
  },
  {
    category: 'Basics',
    term: 'Market Cap (Market Capitalisation)',
    plain: 'The total price tag of a whole company if someone bought 100% of all its shares today.',
    example: 'Reliance is a "Large Cap" (worth over ₹15 Lakh Crore), while smaller rising firms are Mid or Small Caps.',
    whyItMatters: 'Large caps are usually steadier; small caps can grow faster but can fall much harder.',
  },
  {
    category: 'Valuation',
    term: 'P/E Ratio (Price-to-Earnings)',
    plain: 'How many Rupees you are paying today for every ₹1 of profit the company generates each year.',
    example: 'A P/E of 20 means you\'re paying ₹20 for ₹1 of annual profit.',
    whyItMatters: 'Helps compare if a stock is cheap or expensive relative to competitors in the same industry.',
  },
  {
    category: 'Valuation',
    term: 'P/B Ratio (Price-to-Book)',
    plain: 'Comparing the stock\'s market price to the net physical assets (land, machinery, cash minus debt) on its books.',
    example: 'Especially popular when evaluating Banks and financial companies.',
    whyItMatters: 'A P/B under 1 can mean a stock is trading below the liquid liquidation value of its assets.',
  },
  {
    category: 'Valuation',
    term: 'ROE (Return on Equity)',
    plain: 'The profit a company makes using the shareholders\' money. It\'s a measure of management efficiency.',
    example: 'A 20% ROE means every ₹100 of shareholder capital generated ₹20 of net profit.',
    whyItMatters: 'High ROE companies (15%+) usually have strong competitive moats and pricing power.',
  },
  {
    category: 'Technicals',
    term: 'Moving Average (SMA 50 & 200)',
    plain: 'The average closing price smoothed over the last 50 or 200 trading days to filter out daily noise.',
    example: 'When current price is comfortably above the 200-day average, the long-term trend is upward.',
    whyItMatters: 'Helps you avoid buying stocks caught in chronic downward momentum.',
  },
  {
    category: 'Technicals',
    term: 'RSI (Relative Strength Index)',
    plain: 'A speed-o-meter from 0 to 100 measuring how fast a stock has been bought or dumped recently.',
    example: 'Above 70 suggests the stock ran up too quickly (overbought); below 30 suggests aggressive selling (oversold).',
    whyItMatters: 'Helps prevent buying at short-term emotional peaks.',
  },
  {
    category: 'Risk',
    term: 'Volatility',
    plain: 'How wildly the stock swings up and down during a typical year.',
    example: 'A stock with 15% volatility moves like a calm family sedan; 40% volatility moves like a rollercoaster.',
    whyItMatters: 'Make sure the stock\'s volatility matches your personal emotional stomach.',
  },
  {
    category: 'Risk',
    term: 'Max Drawdown',
    plain: 'The deepest drop from peak to trough that investors suffered over the past few years.',
    example: 'If a stock hit ₹1,000 and crashed to ₹700 before recovering, its max drawdown was 30%.',
    whyItMatters: 'Asks you honestly: "Could I hold through a 30% temporary loss without panicking and selling?"',
  },
  {
    category: 'Risk',
    term: 'Beta',
    plain: 'How much a stock moves compared to the overall market (Nifty 50).',
    example: 'Beta of 1.5 means if the market moves 1%, this stock typically jumps or plunges 1.5%.',
    whyItMatters: 'Stocks with Beta under 0.8 provide defensive calm during market corrections.',
  },
]

export function LearnPage() {
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('All')

  const filtered = GLOSSARY_TERMS.filter(t => {
    const matchesCat = activeCategory === 'All' || t.category === activeCategory
    const matchesQuery = t.term.toLowerCase().includes(query.toLowerCase()) ||
                         t.plain.toLowerCase().includes(query.toLowerCase())
    return matchesCat && matchesQuery
  })

  return (
    <main className="max-w-4xl mx-auto px-4 md:px-6 py-8 space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-2" style={{ color: 'var(--accent)' }}>
          <BookOpen size={24} />
          <span className="text-xs font-bold uppercase tracking-wider">Investing Guidebook</span>
        </div>
        <h1 className="text-3xl font-extrabold" style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--ink)' }}>
          Plain English Glossary
        </h1>
        <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
          Stock markets are notorious for jargon designed to sound intimidating. Here is every term used across Niveshak AI, translated into everyday language.
        </p>
      </div>

      {/* Golden Rules for Beginners */}
      <Card className="p-5 border-l-4 border-l-teal-600 space-y-3" style={{ background: 'color-mix(in srgb, #0F766E 6%, var(--card))' }}>
        <h3 className="font-bold text-base flex items-center gap-2" style={{ color: 'var(--ink)' }}>
          <ShieldCheck size={18} style={{ color: 'var(--accent)' }} />
          Three Golden Rules Before You Buy Your First Share
        </h3>
        <ul className="text-xs sm:text-sm space-y-2 leading-relaxed" style={{ color: 'var(--ink)' }}>
          <li>
            <strong>1. Only invest money you won't need for at least 3 to 5 years:</strong> In the short term, markets can fall 20-30% for random global reasons.
          </li>
          <li>
            <strong>2. Never put all your eggs in one basket:</strong> Spread your investment across at least 3-6 distinct companies and sectors.
          </li>
          <li>
            <strong>3. Don't chase yesterday's hottest stock:</strong> Stocks that doubled last month often cool off just when beginners finally hear about them.
          </li>
        </ul>
      </Card>

      {/* Filter and Search */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search terms (e.g. RSI, P/E, Beta)..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border"
              style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--ink)' }}
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {['All', 'Basics', 'Valuation', 'Technicals', 'Risk'].map(c => (
              <button
                key={c}
                onClick={() => setActiveCategory(c)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
                style={{
                  background: activeCategory === c ? 'var(--accent)' : 'var(--card)',
                  borderColor: activeCategory === c ? 'var(--accent)' : 'var(--border)',
                  color: activeCategory === c ? '#fff' : 'var(--muted)',
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Terms list */}
      <div className="space-y-4">
        {filtered.map(item => (
          <Card key={item.term} className="space-y-3 p-5">
            <div className="flex justify-between items-start gap-2">
              <h3 className="font-bold text-lg" style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--ink)' }}>
                {item.term}
              </h3>
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: 'var(--bg)', color: 'var(--muted)' }}>
                {item.category}
              </span>
            </div>

            <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
              {item.plain}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs border-t" style={{ borderColor: 'var(--border)' }}>
              <div>
                <span className="font-bold block mb-0.5" style={{ color: 'var(--muted)' }}>Real Example:</span>
                <span style={{ color: 'var(--ink)' }}>{item.example}</span>
              </div>
              <div>
                <span className="font-bold block mb-0.5" style={{ color: 'var(--accent)' }}>Why it matters to you:</span>
                <span style={{ color: 'var(--ink)' }}>{item.whyItMatters}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </main>
  )
}
