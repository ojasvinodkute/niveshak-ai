/** Stock search autocomplete */
import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, X } from 'lucide-react'
import { api, type SearchResult } from '../lib/api'
import { clsx } from 'clsx'

interface Props {
  onSelect: (result: SearchResult) => void
  placeholder?: string
  className?: string
}

export function SearchBar({ onSelect, placeholder = 'Search stocks by name or symbol…', className }: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['search', query],
    queryFn: () => api.search(query, 15),
    enabled: query.trim().length >= 1,
    staleTime: 60_000,
  })

  useEffect(() => {
    setOpen(query.length >= 1 && results.length > 0)
  }, [query, results])

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function handleSelect(r: SearchResult) {
    setQuery('')
    setOpen(false)
    onSelect(r)
  }

  return (
    <div ref={ref} className={clsx('relative', className)}>
      <div className="relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: 'var(--muted)' }}
        />
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => query.length >= 1 && setOpen(true)}
          placeholder={placeholder}
          className="w-full pl-9 pr-9 py-2.5 rounded-lg border text-sm transition-colors"
          style={{
            background: 'var(--card)',
            borderColor: 'var(--border)',
            color: 'var(--ink)',
          }}
          aria-label="Search NSE stocks"
          aria-expanded={open}
          aria-haspopup="listbox"
          role="combobox"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setOpen(false) }}
            className="absolute right-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--muted)' }}
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute z-50 mt-1 w-full rounded-lg shadow-lg border overflow-hidden"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
          role="listbox"
        >
          {isFetching && (
            <div className="px-4 py-2 text-sm" style={{ color: 'var(--muted)' }}>Searching…</div>
          )}
          {!isFetching && results.length === 0 && (
            <div className="px-4 py-3 text-sm" style={{ color: 'var(--muted)' }}>No results for "{query}"</div>
          )}
          {results.map((r) => (
            <button
              key={r.symbol}
              role="option"
              className="w-full text-left px-4 py-3 text-sm hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors border-b last:border-b-0 flex items-center gap-3"
              style={{ borderColor: 'var(--border)' }}
              onClick={() => handleSelect(r)}
            >
              <span
                className="font-bold text-xs px-1.5 py-0.5 rounded font-mono"
                style={{ background: 'var(--border)', color: 'var(--ink)' }}
              >
                {r.symbol}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate" style={{ color: 'var(--ink)' }}>{r.name}</div>
                <div className="text-xs" style={{ color: 'var(--muted)' }}>{r.sector || 'NSE'}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

