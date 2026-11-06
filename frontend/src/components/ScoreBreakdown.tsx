/** Score breakdown component with sub-scores and human-readable reasons */
import { clsx } from 'clsx'
import type { ScoreResult } from '../lib/api'
import { Card } from './ui'

const COLOR_MAP = {
  green: 'border-l-emerald-500 bg-emerald-50 dark:bg-emerald-900/10',
  amber: 'border-l-amber-500 bg-amber-50 dark:bg-amber-900/10',
  red: 'border-l-red-500 bg-red-50 dark:bg-red-900/10',
}
const TEXT_MAP = {
  green: 'text-emerald-800 dark:text-emerald-300',
  amber: 'text-amber-800 dark:text-amber-300',
  red: 'text-red-800 dark:text-red-300',
}

function SubScoreBar({ label, score, max, color }: { label: string; score: number; max: number; color: string }) {
  const pct = Math.round((score / max) * 100)
  const barColor = pct >= 65 ? '#1B7F4B' : pct >= 40 ? '#E07A1F' : '#C2410C'
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold" style={{ color: 'var(--ink)' }}>{label}</span>
        <span style={{ color: 'var(--muted)' }}>{score}/{max}</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
    </div>
  )
}

interface Props {
  score: ScoreResult
}

export function ScoreBreakdown({ score }: Props) {
  const categories = [
    { key: 'trend', label: 'Trend', data: score.trend, icon: '📈' },
    { key: 'momentum', label: 'Momentum', data: score.momentum, icon: '⚡' },
    { key: 'valuation', label: 'Valuation', data: score.valuation, icon: '💰' },
    { key: 'quality', label: 'Quality', data: score.quality, icon: '🏆' },
    { key: 'stability', label: 'Stability', data: score.stability, icon: '🛡️' },
  ] as const

  return (
    <div className="space-y-6">
      {/* Total score */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <div className="text-6xl font-bold" style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--accent)' }}>
            {score.total}
          </div>
          <div className="text-sm" style={{ color: 'var(--muted)' }}>out of 100</div>
        </div>
        <div className="flex-1">
          <div className="h-4 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${score.total}%`,
                background: score.total >= 65 ? '#1B7F4B' : score.total >= 40 ? '#E07A1F' : '#C2410C',
              }}
            />
          </div>
          <div className="mt-2 text-sm font-semibold" style={{ color: score.verdict_color === 'green' ? '#1B7F4B' : score.verdict_color === 'red' ? '#C2410C' : '#E07A1F' }}>
            {score.verdict}
          </div>
        </div>
      </div>

      {/* Sub-score bars */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {categories.map(({ key, label, data, icon }) => (
          <Card key={key} className="p-4 space-y-3">
            <SubScoreBar label={`${icon} ${label}`} score={data.score} max={data.max} color="" />
            <ul className="space-y-1.5 mt-2">
              {data.reasons.map((r, i) => (
                <li
                  key={i}
                  className={clsx('text-xs border-l-4 pl-3 py-2 rounded-r', COLOR_MAP[r.color])}
                >
                  <span className={TEXT_MAP[r.color]}>{r.text}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      {/* Patterns */}
      {score.patterns && score.patterns.length > 0 && (
        <div>
          <h3 className="font-semibold text-sm mb-2" style={{ color: 'var(--muted)' }}>Pattern Signals</h3>
          <div className="flex flex-wrap gap-2">
            {score.patterns.map((p, i) => (
              <span
                key={i}
                title={p.description}
                className={clsx(
                  'text-xs px-2.5 py-1 rounded-full font-medium cursor-help',
                  p.severity === 'positive' ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' :
                  p.severity === 'negative' ? 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                  'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                )}
              >
                {p.pattern.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Narrative */}
      {score.narrative && (
        <Card className="border-l-4 border-l-teal-500">
          <h3 className="font-semibold mb-2 text-sm" style={{ color: 'var(--muted)' }}>Why the AI thinks this</h3>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--ink)' }}>{score.narrative}</p>
        </Card>
      )}
    </div>
  )
}

