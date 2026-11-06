/** Fan chart for investment projection using Recharts */
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import type { FanDataPoint } from '../lib/api'
import { formatINR } from '../lib/format'

interface Props {
  data: FanDataPoint[]
  inputAmount: number
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg shadow-lg p-3 text-sm space-y-1" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
      <div className="font-semibold mb-1" style={{ color: 'var(--ink)' }}>Year {label}</div>
      {[
        { key: 'p90', label: 'Best (90th %ile)', color: '#1B7F4B' },
        { key: 'p75', label: 'Good (75th %ile)', color: '#4ADE80' },
        { key: 'p50', label: 'Middle', color: '#0F766E' },
        { key: 'p25', label: 'Weak (25th %ile)', color: '#FB923C' },
        { key: 'p10', label: 'Poor (10th %ile)', color: '#C2410C' },
      ].map(({ key, label, color }) => {
        const entry = payload.find((p: any) => p.dataKey === key || p.name === key)
        if (!entry) return null
        return (
          <div key={key} className="flex justify-between gap-4">
            <span style={{ color }}>{label}</span>
            <span className="font-semibold" style={{ color: 'var(--ink)' }}>{formatINR(entry.value)}</span>
          </div>
        )
      })}
    </div>
  )
}

export function ProjectionChart({ data, inputAmount }: Props) {
  if (!data?.length) return null

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
        <defs>
          <linearGradient id="fanGreen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#1B7F4B" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#1B7F4B" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="fanAmber" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#E07A1F" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#E07A1F" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="fanRed" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#C2410C" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#C2410C" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="year" tickFormatter={v => `Yr ${v}`} tick={{ fontSize: 11, fill: 'var(--muted)' }} />
        <YAxis tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11, fill: 'var(--muted)' }} width={60} />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={inputAmount} stroke="var(--muted)" strokeDasharray="4 4" label={{ value: 'Your investment', position: 'left', fontSize: 10, fill: 'var(--muted)' }} />
        {/* Fan bands */}
        <Area type="monotone" dataKey="p90" stroke="#1B7F4B" strokeWidth={1} fill="url(#fanGreen)" fillOpacity={0.4} name="p90" />
        <Area type="monotone" dataKey="p75" stroke="#4ADE80" strokeWidth={1} fill="url(#fanGreen)" fillOpacity={0.3} name="p75" />
        <Area type="monotone" dataKey="p50" stroke="#0F766E" strokeWidth={2} fill="none" name="p50" />
        <Area type="monotone" dataKey="p25" stroke="#FB923C" strokeWidth={1} fill="url(#fanAmber)" fillOpacity={0.2} name="p25" />
        <Area type="monotone" dataKey="p10" stroke="#C2410C" strokeWidth={1} fill="url(#fanRed)" fillOpacity={0.2} name="p10" />
      </AreaChart>
    </ResponsiveContainer>
  )
}

