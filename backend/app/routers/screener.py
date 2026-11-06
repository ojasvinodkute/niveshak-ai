"""Niveshak AI — screener router.

Filters and ranks stocks by risk level, sector, and score range.
Uses a background-refreshed cache to serve fast results.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Optional

import numpy as np
from fastapi import APIRouter, Depends, Query

from app.analysis.indicators import returns
from app.analysis.scoring import score_stock
from app.cache.sqlite_cache import SQLiteCache
from app.config import Settings, settings as _settings
from app.data.equity_list import EquityList
from app.data.provider import DataProvider, Fundamentals, OHLCVBar
from app.routers.stocks import get_cache, get_equity_list, get_provider, get_settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/screener", tags=["screener"])

# ---------------------------------------------------------------------------
# Nifty 50 constituent symbols used for screener pre-warming
# ---------------------------------------------------------------------------
NIFTY50_SYMBOLS = [
    "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK",
    "HINDUNILVR", "ITC", "SBIN", "BHARTIARTL", "KOTAKBANK",
    "LT", "AXISBANK", "ASIANPAINT", "MARUTI", "SUNPHARMA",
    "TITAN", "BAJFINANCE", "WIPRO", "NESTLEIND", "ULTRACEMCO",
    "POWERGRID", "NTPC", "ONGC", "COALINDIA", "TATAMOTORS",
    "TATASTEEL", "JSWSTEEL", "INDUSINDBK", "HCLTECH", "TECHM",
    "M&M", "BAJAJFINSV", "CIPLA", "DRREDDY", "DIVISLAB",
    "EICHERMOT", "HEROMOTOCO", "BPCL", "IOC", "HINDALCO",
    "VEDL", "ADANIENT", "ADANIPORTS", "AMBUJACEM", "GRASIM",
    "DABUR", "MARICO", "BRITANNIA", "TATACONSUM", "PIDILITIND",
]

_SCREENER_CACHE_KEY = "screener:all"
_SCREENER_TTL = 1800  # 30 minutes


async def _build_screener_entry(
    symbol: str,
    provider: DataProvider,
    market_prices: np.ndarray,
) -> Optional[dict]:
    """Build a single screener entry for *symbol*. Returns None on failure."""
    try:
        bars: list[OHLCVBar] = await provider.get_ohlcv(symbol, period="2y")
        if not bars:
            return None

        prices = np.array([b.close for b in bars], dtype=float)
        volumes = np.array([b.volume for b in bars], dtype=float)

        fundamentals: Optional[Fundamentals] = await provider.get_fundamentals(symbol)
        fund_dict = fundamentals.model_dump() if fundamentals else {}

        quote_obj = await provider.get_quote(symbol)
        if quote_obj is None:
            return None

        score = score_stock(
            prices=prices,
            volumes=volumes,
            market_prices=market_prices,
            fundamentals=fund_dict,
            sector_pe_median=None,
        )

        # Monthly sparkline
        closes = prices[::21].tolist()

        return {
            "symbol": symbol,
            "name": quote_obj.name,
            "sector": fund_dict.get("sector") or "",
            "price": quote_obj.price,
            "change_pct": quote_obj.change_pct,
            "score": score["total"],
            "risk_label": score["risk_label"],
            "verdict": score["verdict"],
            "verdict_color": score["verdict_color"],
            "sparkline": closes,
        }
    except Exception as exc:
        logger.warning("Screener: skipping %s — %s", symbol, exc)
        return None


async def refresh_screener_cache(
    provider: DataProvider,
    cache: SQLiteCache,
) -> None:
    """Pre-warm the screener cache with Nifty 50 stocks."""
    logger.info("Screener cache refresh started (%d symbols)", len(NIFTY50_SYMBOLS))
    try:
        nifty_bars = await provider.get_ohlcv("^NSEI", period="2y")
        market_prices = np.array([b.close for b in nifty_bars], dtype=float)
    except Exception:
        market_prices = np.array([], dtype=float)

    entries: list[dict] = []
    for symbol in NIFTY50_SYMBOLS:
        entry = await _build_screener_entry(symbol, provider, market_prices)
        if entry is not None:
            entries.append(entry)

    if entries:
        await cache.set(
            _SCREENER_CACHE_KEY,
            json.dumps({"entries": entries, "refreshed_at": datetime.now(timezone.utc).isoformat()}),
            _SCREENER_TTL,
        )
        logger.info("Screener cache refreshed: %d entries", len(entries))


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------


@router.get("")
async def screener(
    risk: Optional[str] = Query(None, description="low | medium | high"),
    sector: Optional[str] = Query(None, description="Sector filter (case-insensitive)"),
    min_score: int = Query(0, ge=0, le=100),
    max_score: int = Query(100, ge=0, le=100),
    limit: int = Query(20, ge=1, le=50),
    cache: SQLiteCache = Depends(get_cache),
    provider: DataProvider = Depends(get_provider),
    s: Settings = Depends(get_settings),
) -> dict:
    """Screen NSE stocks by risk, sector, and score range."""
    cached = await cache.get(_SCREENER_CACHE_KEY)

    if cached:
        payload = json.loads(cached)
        entries: list[dict] = payload.get("entries", [])
        refreshed_at = payload.get("refreshed_at", "")
    else:
        # Cold start: return empty with a note
        entries = []
        refreshed_at = ""
        # Trigger an async refresh in the background (fire-and-forget via task)
        import asyncio
        asyncio.create_task(refresh_screener_cache(provider, cache))

    # Apply filters
    filtered = entries

    if risk:
        filtered = [e for e in filtered if e.get("risk_label", "").lower() == risk.lower()]

    if sector:
        filtered = [
            e for e in filtered
            if sector.lower() in (e.get("sector") or "").lower()
        ]

    filtered = [
        e for e in filtered
        if min_score <= e.get("score", 0) <= max_score
    ]

    # Sort by score descending
    filtered.sort(key=lambda x: x.get("score", 0), reverse=True)
    filtered = filtered[:limit]

    return {
        "results": filtered,
        "count": len(filtered),
        "filters": {
            "risk": risk,
            "sector": sector,
            "min_score": min_score,
            "max_score": max_score,
        },
        "refreshed_at": refreshed_at,
        "data_as_of": datetime.now(timezone.utc).isoformat(),
        "delayed": True,
    }
