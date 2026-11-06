# Niveshak AI (निवेशक AI)

> **Indian stocks, explained simply before you invest.**
> Dynamic, production-quality web application built for first-time retail investors in the Indian stock market.

---

## 🌟 Philosophy & Product Goal

A complete beginner with no prior financial market knowledge wants to invest their hard-earned money and let it grow. Niveshak AI helps them pick Indian stocks (NSE) and shows **exactly WHY** each looks promising or risky in plain English, with zero jargon, so they can make confident decisions themselves.

- **Deterministic & Explainable:** Not a black box. Scores are mathematically derived from real market data.
- **Honest Compliance:** Educational analytics only; persistent SEBI compliance notices; transparent backtest logic detailing where strategies failed.
- **Zero Hallucination:** Optional LLM layer is strictly confined to converting deterministic computed statistics into beginner-friendly prose — it never invents numbers or makes speculative price predictions.

---

## 🛠️ Stack

- **Backend:** Python 3.11+ / FastAPI, pandas, numpy, scipy, yfinance, pydantic v2
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, lightweight-charts (TradingView interactive candles), Recharts (fan charts & sparklines), Lucide icons, Zustand (state & localStorage)
- **Cache:** SQLite with automated TTL management (15 minutes during NSE market hours 9:15–15:30 IST; 24 hours off-market)
- **Deployment:** Docker & Docker Compose (`docker compose up`)

---

## 🚀 Quick Start

### Option A: Docker Compose (One-command run)

```bash
# 1. Clone & copy environment variables
cp .env.example .env

# 2. Run everything
docker compose up --build
```
- Frontend: `http://localhost:5173`
- Backend API & OpenAPI Docs: `http://localhost:8000/docs`

---

### Option B: Local Development

#### 1. Backend
```bash
cd backend

# Create & activate virtual environment (optional)
python -m venv venv
# Windows: venv\Scripts\activate | Mac/Linux: source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run backend API
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### 2. Frontend
```bash
cd frontend

# Install packages
npm install

# Start Vite dev server
npm run dev
```
Visit `http://localhost:5173`. Requests to `/api/*` are automatically proxied to the backend at `http://localhost:8000`.

---

## 📊 Features

1. **Onboarding:** Evaluates user budget, emotional risk comfort (Panic / Wait it out / Accept swings), and time horizon. Persisted in `localStorage`.
2. **Search Autocomplete:** Instant search across the entire NSE equity universe by company name or symbol (e.g. `RELIANCE`, `TCS`, `INFY`).
3. **Top Picks Screener:** Ranked by transparent 0–100 score, filtered by user risk profile and sector, featuring live sparkline charts and instant verdict pills.
4. **Interactive Stock Detail:**
   - Lightweight-charts candlestick chart with toggleable overlays (SMA 20, SMA 50, SMA 200, Bollinger Bands).
   - Multi-timeframe selection (1M, 6M, 1Y, 3Y, 5Y).
   - 5-part sub-score breakdown with color-coded reasons: Trend, Momentum, Valuation, Quality, Stability.
   - Plain-English fundamentals table with beginner-friendly tooltips.
5. **Monte Carlo Investment Calculator:**
   - Models bad luck (10th percentile), most likely (50th percentile), and good luck (90th percentile) return cones.
   - Shrinkage model blends historical performance towards long-run 12% equity average (does not blindly extrapolate past bull runs).
   - Fan chart visualization, probability of loss estimate, and Indian tax notes (STCG vs LTCG).
6. **Portfolio Builder:**
   - Allocates user capital across 3 to 6 selected stocks.
   - Enforces diversification (max 35% per stock, max 40% per sector).
   - Displays blended portfolio risk and recommends Nifty 50 ETFs as beginner foundation.
7. **Watchlist & Stock Comparison:**
   - Side-by-side comparison of 2–3 stocks across scores, valuations, and risk.
   - Watchlist with localStorage sync.
8. **Market Overview & Pulse:**
   - Live Nifty 50 and Sensex benchmarks.
   - Sector heatmap (IT, Banks, Auto, Pharma, FMCG, Metal, Energy, Infra).
   - Top daily gainers and losers.
9. **Honest Backtest & Logic Audit:**
   - Historical performance of top-scoring stocks vs Nifty 50.
   - Documents periods of failure (e.g., 2022 tech valuation multiple compression).
   - Educates beginners on survivorship bias and look-ahead bias.

---

## 🧮 How the Scoring Engine Works

Every stock receives a score from 0 to 100 based on five deterministic pillars:

| Category | Max Points | What it measures |
|---|---|---|
| **Trend** | 25 | Price vs SMA 50 (+8), SMA 50 vs SMA 200 (+8), Price vs EMA 20 (+5), Price vs 200-day average (+4) |
| **Momentum** | 25 | 6M return (up to 10), 1Y return (up to 8), MACD > 0 (+4), RSI healthy range 40–65 (+3) |
| **Valuation** | 20 | P/E ratio relative to sector median, Price-to-Book bonus |
| **Quality** | 15 | ROE > 20% (+8), Debt/Equity < 0.5 (+5), Dividend yield bonus (+2) |
| **Stability** | 15 | Volatility < 20% (+8), Max drawdown < 15% (+5), Beta < 0.8 (+2) |

### Verdict Labels:
- **70–100:** *Looks strong* (Green)
- **45–69:** *Mixed signals* (Amber)
- **0–44:** *Looks weak* (Red)

---

## 🔌 Swapping the Data Provider

Niveshak AI isolates all market data access behind an abstract `DataProvider` interface located at `backend/app/data/provider.py`:

```python
class DataProvider(ABC):
    @abstractmethod
    async def get_ohlcv(self, symbol: str, period: str = "2y") -> list[OHLCVBar]: ...
    @abstractmethod
    async def get_quote(self, symbol: str) -> Quote: ...
    @abstractmethod
    async def get_fundamentals(self, symbol: str) -> Fundamentals: ...
    @abstractmethod
    async def get_news(self, symbol: str, limit: int = 5) -> list[NewsItem]: ...
```

To switch to a licensed broker API (Zerodha Kite Connect, Angel One SmartAPI, Upstox, or Twelve Data):
1. Create `backend/app/data/zerodha_provider.py` implementing `DataProvider`.
2. In `backend/app/main.py`, replace `provider = YFinanceProvider()` with `provider = ZerodhaProvider(api_key=...)`.

---

## 🧪 Running Tests

```bash
cd backend
python -m pytest tests/
```
All 41 indicators, projection models, and scoring tests run and validate deterministically.

---

## ⚖️ Legal & SEBI Disclaimer

**Niveshak AI is strictly an educational tool.** It is not registered with SEBI (Securities and Exchange Board of India) as an Investment Adviser or Research Analyst. None of the content, scores, or simulations constitute financial, investment, legal, or tax advice. Stock investments are subject to market risks. Past returns do not guarantee future performance.
