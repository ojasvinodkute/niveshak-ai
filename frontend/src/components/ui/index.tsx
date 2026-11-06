/** Shared UI primitives */
import { clsx } from 'clsx'
import React from 'react'

// ─── Badge ────────────────────────────────────────────────────────────────────
interface BadgeProps {
  color: 'green' | 'amber' | 'red' | 'blue' | 'muted'
  children: React.ReactNode
  className?: string
}
export function Badge({ color, children, className }: BadgeProps) {
  const colors = {
    green: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    amber: 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    red: 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    blue: 'bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    muted: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  }
  return (
    <span className={clsx('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold', colors[color], className)}>
      {children}
    </span>
  )
}

// ─── Skeleton ────────────────────────────────────────────────────────────────
interface SkeletonProps { className?: string; rows?: number }
export function Skeleton({ className, rows = 1 }: SkeletonProps) {
  return (
    <div className={clsx('space-y-2', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton h-4 rounded" style={{ width: `${70 + (i % 3) * 10}%` }} />
      ))}
    </div>
  )
}
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={clsx('rounded-xl border p-4 space-y-3', className)} style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
      <div className="skeleton h-5 w-2/3 rounded" />
      <div className="skeleton h-4 w-full rounded" />
      <div className="skeleton h-4 w-5/6 rounded" />
      <div className="skeleton h-8 w-1/3 rounded" />
    </div>
  )
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────
interface TooltipProps { text: string; children: React.ReactNode }
export function Tooltip({ text, children }: TooltipProps) {
  return (
    <span className="relative group inline-flex items-center">
      {children}
      <span
        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 hidden group-hover:block group-focus-within:block
          bg-gray-900 text-white text-xs rounded px-2 py-1 w-48 text-center shadow-lg pointer-events-none"
      >
        {text}
      </span>
    </span>
  )
}

// ─── ErrorBox ────────────────────────────────────────────────────────────────
export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800 p-4 text-red-700 dark:text-red-400 text-sm">
      <strong>Something went wrong:</strong> {message}
    </div>
  )
}

// ─── EmptyState ──────────────────────────────────────────────────────────────
export function EmptyState({ icon, title, body }: { icon?: string; title: string; body?: string }) {
  return (
    <div className="text-center py-16 space-y-2" style={{ color: 'var(--muted)' }}>
      {icon && <div className="text-5xl">{icon}</div>}
      <h3 className="font-semibold text-lg" style={{ color: 'var(--ink)' }}>{title}</h3>
      {body && <p className="text-sm max-w-sm mx-auto">{body}</p>}
    </div>
  )
}

// ─── DataLabel ───────────────────────────────────────────────────────────────
export function DataLabel({ delayed, asOf }: { delayed: boolean; asOf: string }) {
  const formatted = asOf
    ? new Date(asOf).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })
    : ''
  return (
    <span className="text-xs" style={{ color: 'var(--muted)' }}>
      Data as of {formatted} IST{delayed ? ', delayed ~15 min' : ''}
    </span>
  )
}

// ─── ScoreBadge ──────────────────────────────────────────────────────────────
export function ScoreBadge({ score, verdict, verdictColor }: { score: number; verdict: string; verdictColor: string }) {
  const bg = verdictColor === 'green'
    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
    : verdictColor === 'amber'
    ? 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
    : 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-300'
  return (
    <span className={clsx('inline-flex items-center gap-1 px-3 py-1 rounded-full font-semibold text-sm', bg)}>
      <span className="font-bold">{score}/100</span>
      <span>·</span>
      <span>{verdict}</span>
    </span>
  )
}

// ─── RiskBadge ───────────────────────────────────────────────────────────────
export function RiskBadge({ risk }: { risk: 'Low' | 'Medium' | 'High' }) {
  const map: Record<string, BadgeProps['color']> = { Low: 'green', Medium: 'amber', High: 'red' }
  return <Badge color={map[risk] ?? 'muted'}>{risk} Risk</Badge>
}

// ─── Divider ────────────────────────────────────────────────────────────────
export function Divider() {
  return <hr style={{ borderColor: 'var(--border)' }} className="my-6" />
}

// ─── Button ─────────────────────────────────────────────────────────────────
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}
export function Button({ variant = 'primary', size = 'md', className, children, ...props }: ButtonProps) {
  const base = 'inline-flex items-center justify-center font-semibold rounded-lg transition-all focus-visible:outline-none'
  const sizes = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2', lg: 'px-6 py-3 text-lg' }
  const variants = {
    primary: 'bg-teal-700 text-white hover:bg-teal-600 disabled:opacity-50',
    secondary: 'border border-current text-teal-700 hover:bg-teal-50 dark:text-teal-400 dark:hover:bg-teal-900/20',
    ghost: 'text-teal-700 hover:bg-teal-50 dark:text-teal-400 dark:hover:bg-teal-900/20',
  }
  return (
    <button className={clsx(base, sizes[size], variants[variant], className)} {...props}>
      {children}
    </button>
  )
}

// ─── Card ────────────────────────────────────────────────────────────────────
export function Card({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx('rounded-xl border p-4 md:p-5', className)}
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
      {...props}
    >
      {children}
    </div>
  )
}

