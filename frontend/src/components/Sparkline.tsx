/** Sparkline chart component using Recharts */
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'
import { formatINR } from '../lib/format'

interface Props {
  data: number[]
  color?: string
  height?: number
}

export function Sparkline({ data, color, height = 40 }: Props) {
  if (!data || data.length < 2) {
    return <div style={{ height, background: 'var(--border)', borderRadius: 4 }} />
  }

  const first = data[0]
  const last = data[data.length - 1]
  const up = last >= first
  const lineColor = color ?? (up ? '#1B7F4B' : '#C2410C')

  const chartData = data.map((v, i) => ({ i, v }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData}>
        <Line
          type="monotone"
          dataKey="v"
          stroke={lineColor}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
        <Tooltip
          content={({ payload }) => {
            if (!payload?.length) return null
            return (
              <div
                className="text-xs rounded px-2 py-1 shadow"
                style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
              >
                {formatINR(payload[0].value as number)}
              </div>
            )
          }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

