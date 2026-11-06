import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { useAppStore } from './lib/store'
import { Navbar } from './components/Navbar'
import { Disclaimer } from './components/Disclaimer'

// Pages
import { HomePage } from './pages/Home'
import { ScreenerPage } from './pages/Screener'
import { StockDetailPage } from './pages/StockDetail'
import { PortfolioPage } from './pages/Portfolio'
import { ComparePage } from './pages/Compare'
import { WatchlistPage } from './pages/Watchlist'
import { MarketOverviewPage } from './pages/MarketOverview'
import { LearnPage } from './pages/Learn'
import { BacktestPage } from './pages/Backtest'

export default function App() {
  const theme = useAppStore(s => s.theme)

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)', color: 'var(--ink)' }}>
        {/* Top demo & delayed data banner */}
        <div className="text-xs text-center py-1.5 px-4 font-medium" style={{ background: '#FFF3DC', color: '#6B4200' }}>
          Real NSE data via YFinance · Prices delayed ~15 mins during market hours · Educational analytics only
        </div>

        <Navbar />

        <div className="flex-1">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/screener" element={<ScreenerPage />} />
            <Route path="/stock/:symbol" element={<StockDetailPage />} />
            <Route path="/portfolio" element={<PortfolioPage />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/watchlist" element={<WatchlistPage />} />
            <Route path="/market" element={<MarketOverviewPage />} />
            <Route path="/learn" element={<LearnPage />} />
            <Route path="/backtest" element={<BacktestPage />} />
          </Routes>
        </div>

        {/* Footer */}
        <footer className="border-t py-6 px-4 md:px-8 text-xs space-y-3" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm" style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--accent)' }}>
                Niveshak AI
              </span>
              <span style={{ color: 'var(--muted)' }}>— Empowering new Indian retail investors with transparent logic.</span>
            </div>
            <div className="flex gap-4 flex-wrap" style={{ color: 'var(--muted)' }}>
              <Link to="/backtest" className="hover:underline">Backtest & Audit</Link>
              <Link to="/learn" className="hover:underline">Glossary</Link>
              <Link to="/market" className="hover:underline">Market Pulse</Link>
              <Link to="/portfolio" className="hover:underline">Portfolio</Link>
            </div>
          </div>
        </footer>

        <Disclaimer />
      </div>
    </BrowserRouter>
  )
}
