/** Main stock price chart: candlestick + overlays using lightweight-charts */
import { useEffect, useRef } from 'react'
import {
  createChart,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type LineData,
  type Time,
} from 'lightweight-charts'
import type { OHLCVBar } from '../lib/api'
import { useAppStore } from '../lib/store'

interface Overlays {
  sma20?: boolean
  sma50?: boolean
  sma200?: boolean
  bb?: boolean
  volume?: boolean
}

interface Props {
  bars: OHLCVBar[]
  overlays: Overlays
  height?: number
}

function computeSMA(bars: OHLCVBar[], period: number): LineData[] {
  return bars.flatMap((_, i) => {
    if (i < period - 1) return []
    const slice = bars.slice(i - period + 1, i + 1)
    const avg = slice.reduce((s, b) => s + b.close, 0) / period
    return [{ time: bars[i].date as Time, value: avg }]
  })
}

function computeBB(bars: OHLCVBar[], period = 20, stdMult = 2) {
  const upper: LineData[] = []
  const lower: LineData[] = []
  bars.forEach((_, i) => {
    if (i < period - 1) return
    const slice = bars.slice(i - period + 1, i + 1).map(b => b.close)
    const avg = slice.reduce((s, v) => s + v, 0) / period
    const std = Math.sqrt(slice.reduce((s, v) => s + (v - avg) ** 2, 0) / period)
    upper.push({ time: bars[i].date as Time, value: avg + stdMult * std })
    lower.push({ time: bars[i].date as Time, value: avg - stdMult * std })
  })
  return { upper, lower }
}

export function StockChart({ bars, overlays, height = 400 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const theme = useAppStore(s => s.theme)

  const isDark = theme === 'dark'
  const bg = isDark ? '#161B22' : '#FFFFFF'
  const textColor = isDark ? '#8B949E' : '#5B6478'
  const gridColor = isDark ? '#30363D' : '#DDE1EA'
  const borderColor = isDark ? '#30363D' : '#DDE1EA'

  useEffect(() => {
    if (!containerRef.current || !bars.length) return

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: bg },
        textColor,
      },
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor },
      timeScale: { borderColor, timeVisible: false },
      width: containerRef.current.clientWidth,
      height,
    })
    chartRef.current = chart

    // Candlestick series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#1B7F4B',
      downColor: '#C2410C',
      borderUpColor: '#1B7F4B',
      borderDownColor: '#C2410C',
      wickUpColor: '#1B7F4B',
      wickDownColor: '#C2410C',
    })
    candleRef.current = candleSeries

    const candleData: CandlestickData[] = bars.map(b => ({
      time: b.date as Time,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
    }))
    candleSeries.setData(candleData)

    chart.timeScale().fitContent()

    // Resize observer
    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.resize(containerRef.current.clientWidth, height)
    })
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current = null
    }
  }, [bars, theme])

  // Overlays update
  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !bars.length) return

    const seriesToRemove: ISeriesApi<'Line'>[] = []

    if (overlays.sma20) {
      const s = chart.addSeries(LineSeries, { color: '#3B82F6', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, title: 'SMA20' })
      s.setData(computeSMA(bars, 20))
      seriesToRemove.push(s)
    }
    if (overlays.sma50) {
      const s = chart.addSeries(LineSeries, { color: '#E07A1F', lineWidth: 2, priceLineVisible: false, lastValueVisible: false, title: 'SMA50' })
      s.setData(computeSMA(bars, 50))
      seriesToRemove.push(s)
    }
    if (overlays.sma200) {
      const s = chart.addSeries(LineSeries, { color: '#0F766E', lineWidth: 2, priceLineVisible: false, lastValueVisible: false, title: 'SMA200' })
      s.setData(computeSMA(bars, 200))
      seriesToRemove.push(s)
    }
    if (overlays.bb) {
      const { upper, lower } = computeBB(bars)
      const su = chart.addSeries(LineSeries, { color: '#8B5CF6', lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false, title: 'BB Upper' })
      const sl = chart.addSeries(LineSeries, { color: '#8B5CF6', lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false, title: 'BB Lower' })
      su.setData(upper)
      sl.setData(lower)
      seriesToRemove.push(su, sl)
    }

    return () => {
      seriesToRemove.forEach(s => {
        try { chart.removeSeries(s) } catch {}
      })
    }
  }, [bars, overlays])

  if (!bars.length) {
    return <div className="skeleton rounded-xl" style={{ height }} />
  }

  return (
    <div
      ref={containerRef}
      className="rounded-xl overflow-hidden border"
      style={{ height, borderColor: 'var(--border)' }}
    />
  )
}
