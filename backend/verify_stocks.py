import asyncio
from app.data.yfinance_provider import YFinanceProvider
from app.analysis.scoring import score_stock
import numpy as np

async def verify():
    provider = YFinanceProvider()
    print("Fetching Nifty 50...")
    nifty = await provider.get_ohlcv('^NSEI', period='1y')
    market_closes = np.array([b.close for b in nifty]) if nifty else np.array([22000.0, 22500.0])
    print(f"Nifty 50 bars count: {len(market_closes)}")

    for sym in ['RELIANCE', 'TCS', 'HDFCBANK']:
        print(f"\n--- Testing {sym} ---")
        q = await provider.get_quote(sym)
        f = await provider.get_fundamentals(sym)
        bars = await provider.get_ohlcv(sym, period='1y')
        closes = np.array([b.close for b in bars])
        vols = np.array([b.volume for b in bars])
        f_dict = f.model_dump() if hasattr(f, 'model_dump') else f.dict()
        scored = score_stock(closes, vols, market_closes, f_dict)
        print(f"Name: {q.name}")
        print(f"Price: INR {q.price:.2f} ({'+' if q.change >= 0 else ''}{q.change_pct:.2f}%)")
        print(f"52W Range: INR {q.week_52_low:.2f} - INR {q.week_52_high:.2f}")
        print(f"P/E: {f.pe_ratio}, ROE: {f.roe}, D/E: {f.debt_to_equity}")
        print(f"AI Score: {scored['total']}/100 -> {scored['verdict']} ({scored['verdict_color']})")
        print(f"Risk Profile: {scored['risk_label']}")
        print(f"Sample reasoning: {scored['trend']['reasons'][0]['text']}")

if __name__ == '__main__':
    asyncio.run(verify())
