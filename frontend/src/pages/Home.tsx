/** Onboarding page — beginner profile setup */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore, type RiskPreference, type InvestmentGoal } from '../lib/store'
import { Button } from '../components/ui'
import { formatINR } from '../lib/format'
import { clsx } from 'clsx'
import { SearchBar } from '../components/SearchBar'
import type { SearchResult } from '../lib/api'

const RISK_OPTIONS: { value: RiskPreference; label: string; desc: string; emoji: string }[] = [
  { value: 'low', label: 'Stay calm', desc: "If my money drops 20%, I'll panic. I want steadier, boring stocks.", emoji: '🛡️' },
  { value: 'medium', label: 'Wait it out', desc: "I can stomach a rough year as long as I believe in the company.", emoji: '⚖️' },
  { value: 'high', label: 'Accept big swings', desc: "I might even buy more if prices fall. High risk is fine for high reward.", emoji: '🚀' },
]

const GOAL_OPTIONS: { value: InvestmentGoal; label: string; desc: string; emoji: string }[] = [
  { value: 'wealth', label: 'Grow my wealth', desc: "I'm in this for the long term — 5+ years of compounding.", emoji: '🌱' },
  { value: 'income', label: 'Regular income', desc: "I'd like dividend-paying stocks that give me some cash each year.", emoji: '💵' },
  { value: 'short_term', label: 'Short-term gains', desc: "I want to invest for 1-3 years and exit.", emoji: '⏱️' },
]

export function HomePage() {
  const { profile, setProfile } = useAppStore()
  const navigate = useNavigate()
  const [amount, setAmount] = useState(profile.amount.toString())
  const [risk, setRisk] = useState<RiskPreference>(profile.risk)
  const [goal, setGoal] = useState<InvestmentGoal>(profile.goal)
  const [amountError, setAmountError] = useState('')

  function handleSearch(result: SearchResult) {
    navigate(`/stock/${result.symbol}`)
  }

  function handleStart() {
    const amt = parseFloat(amount)
    if (!amt || amt < 1000) {
      setAmountError('Please enter at least ₹1,000')
      return
    }
    setAmountError('')
    setProfile({ amount: amt, risk, goal, onboarded: true })
    navigate('/screener')
  }

  return (
    <main className="max-w-3xl mx-auto px-4 md:px-6 py-10 space-y-10">
      {/* Hero */}
      <section className="space-y-4">
        <h1
          className="text-4xl md:text-5xl font-extrabold leading-tight"
          style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--ink)' }}
        >
          Indian stocks,{' '}
          <span style={{ color: 'var(--accent)' }}>explained simply</span>
        </h1>
        <p className="text-lg max-w-xl" style={{ color: 'var(--muted)' }}>
          No jargon. No experience needed. Tell us your budget and risk comfort — we'll show you which stocks look promising and <em>exactly why</em>.
        </p>

        {/* Quick search */}
        <SearchBar onSelect={handleSearch} placeholder="Or search any NSE stock directly…" className="max-w-md" />
      </section>

      {/* Profile form */}
      <section className="space-y-6">
        <h2
          className="text-2xl font-bold"
          style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--ink)' }}
        >
          Let's find stocks that fit <em>you</em>
        </h2>

        {/* Amount */}
        <div>
          <label className="block font-semibold mb-1.5 text-sm" style={{ color: 'var(--ink)' }}>
            How much do you want to invest? (₹)
          </label>
          <div className="flex items-center gap-3 flex-wrap">
            <input
              type="number"
              min={1000}
              step={1000}
              value={amount}
              onChange={e => { setAmount(e.target.value); setAmountError('') }}
              className="rounded-lg border px-3 py-2 text-lg font-semibold w-44"
              style={{ background: 'var(--card)', borderColor: amountError ? '#C2410C' : 'var(--border)', color: 'var(--ink)' }}
              aria-label="Investment amount in rupees"
            />
            {parseFloat(amount) >= 1000 && (
              <span className="text-sm font-medium" style={{ color: 'var(--accent)' }}>
                {formatINR(parseFloat(amount))}
              </span>
            )}
          </div>
          {amountError && <p className="text-xs text-red-600 mt-1">{amountError}</p>}
          {/* Quick presets */}
          <div className="flex gap-2 mt-2 flex-wrap">
            {[10000, 50000, 100000, 500000].map(v => (
              <button
                key={v}
                onClick={() => setAmount(v.toString())}
                className="text-xs px-2.5 py-1 rounded-full border transition-colors"
                style={{
                  borderColor: parseFloat(amount) === v ? 'var(--accent)' : 'var(--border)',
                  background: parseFloat(amount) === v ? 'var(--accent)' : 'transparent',
                  color: parseFloat(amount) === v ? '#fff' : 'var(--muted)',
                }}
              >
                {formatINR(v)}
              </button>
            ))}
          </div>
        </div>

        {/* Risk */}
        <div>
          <fieldset>
            <legend className="font-semibold mb-3 text-sm" style={{ color: 'var(--ink)' }}>
              If your investment drops 20% for a few months, what would you do?
            </legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {RISK_OPTIONS.map(o => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setRisk(o.value)}
                  className={clsx(
                    'text-left p-4 rounded-xl border-2 transition-all space-y-1',
                    risk === o.value
                      ? 'border-teal-600'
                      : 'border-transparent'
                  )}
                  style={{
                    background: risk === o.value ? 'color-mix(in srgb, var(--accent) 10%, var(--card))' : 'var(--card)',
                    borderColor: risk === o.value ? 'var(--accent)' : 'var(--border)',
                  }}
                  aria-pressed={risk === o.value}
                >
                  <div className="text-2xl">{o.emoji}</div>
                  <div className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>{o.label}</div>
                  <div className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>{o.desc}</div>
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        {/* Goal */}
        <div>
          <fieldset>
            <legend className="font-semibold mb-3 text-sm" style={{ color: 'var(--ink)' }}>
              What's your main goal?
            </legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {GOAL_OPTIONS.map(o => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setGoal(o.value)}
                  className="text-left p-4 rounded-xl border-2 transition-all space-y-1"
                  style={{
                    background: goal === o.value ? 'color-mix(in srgb, var(--accent) 10%, var(--card))' : 'var(--card)',
                    borderColor: goal === o.value ? 'var(--accent)' : 'var(--border)',
                  }}
                  aria-pressed={goal === o.value}
                >
                  <div className="text-2xl">{o.emoji}</div>
                  <div className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>{o.label}</div>
                  <div className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>{o.desc}</div>
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <Button size="lg" onClick={handleStart} className="w-full sm:w-auto">
          Show me stock picks →
        </Button>
      </section>

      {/* How it works */}
      <section className="border-t pt-8 space-y-4" style={{ borderColor: 'var(--border)' }}>
        <h2 className="text-xl font-bold" style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--ink)' }}>
          How Niveshak AI works
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { n: '1', title: 'Real data', body: 'We fetch live prices and financial data from NSE. Nothing is made up.' },
            { n: '2', title: 'Transparent scoring', body: 'Each stock gets a 0-100 score. Every point is explained in plain English.' },
            { n: '3', title: 'You decide', body: 'We show you the signals. You make the call. We never say "buy this".' },
          ].map(({ n, title, body }) => (
            <div key={n} className="rounded-xl p-4 space-y-1" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <div className="text-3xl font-black" style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--accent)' }}>{n}</div>
              <div className="font-semibold" style={{ color: 'var(--ink)' }}>{title}</div>
              <div className="text-sm" style={{ color: 'var(--muted)' }}>{body}</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}

