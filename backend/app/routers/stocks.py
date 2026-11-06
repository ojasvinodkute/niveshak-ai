"""Niveshak AI — stocks router.

Endpoints for stock search, quotes, OHLCV, full analysis, and news.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Annotated, Optional

import numpy as np
from fastapi import APIRouter, Depends, HTTPException, Query

from app.analysis.indicators import returns
from app.analysis.scoring import score_stock
from app.cache.sqlite_cache import SQLiteCache
from app.config import Settings, settings as _settings
from app.data.equity_list import EquityList
from app.data.provider import DataProvider, Fundamentals, OHLCVBar, Quote
from app.data.yfinance_provider import YFinanceProvider

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/stocks", tags=["stocks"])

# ---------------------------------------------------------------------------
# Dependency providers
# ---------------------------------------------------------------------------

# Module-level singletons (populated by main.py lifespan)
_cache: Optional[SQLiteCache] = None
_equity_list: Optional[EquityList] = None
_provider: Optional[DataProvider] = None


def get_settings() -> Settings:
    return _settings


def get_cache() -> SQLiteCache:
    if _cache is None:
        raise RuntimeError("Cache not initialised")
    return _cache


def get_equity_list() -> EquityList:
    if _equity_list is None:
        raise RuntimeError("EquityList not initialised")
    return _equity_list


def get_provider() -> DataProvider:
    if _provider is None:
        raise RuntimeError("DataProvider not initialised")
    return _provider


# ---------------------------------------------------------------------------
# Cache TTL helper
# ---------------------------------------------------------------------------


def get_cache_ttl(s: Settings) -> int:
    """Return 900 during NSE market hours (9:15–15:30 IST Mon-Fri), else 86400."""
    from zoneinfo import ZoneInfo

    now = datetime.now(ZoneInfo("Asia/Kolkata"))
    if now.weekday() < 5:  # Monday–Friday
        market_open = now.replace(hour=9, minute=15, second=0, microsecond=0)
        market_close = now.replace(hour=15, minute=30, second=0, microsecond=0)
        if market_open <= now <= market_close:
            return s.cache_ttl_market_hours
    return s.cache_ttl_off_hours


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/search")
async def search_stocks(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(20, ge=1, le=100),
    equity_list: EquityList = Depends(get_equity_list),
    provider: DataProvider = Depends(get_provider),
) -> dict:
    """Search NSE stocks by symbol or company name."""
    results = equity_list.search(q, limit=limit)
    return {
        "query": q,
        "results": results,
        "count": len(results),
        "data_as_of": datetime.now(timezone.utc).isoformat(),
        "delayed": True,
    }


@router.get("/{symbol}")
async def get_stock(
    symbol: str,
    cache: SQLiteCache = Depends(get_cache),
    provider: DataProvider = Depends(get_provider),
    equity_list: EquityList = Depends(get_equity_list),
    s: Settings = Depends(get_settings),
) -> dict:
    """Return quote + fundamentals + 5-year sparkline for a stock."""
    symbol = symbol.upper().strip()
    ttl = get_cache_ttl(s)
    cache_key = f"stock:{symbol}"

    cached = await cache.get(cache_key)
    if cached:
        return json.loads(cached)

    # Fetch quote and fundamentals concurrently would be ideal; keep sequential
    # to avoid hammering yfinance with parallel requests for the same ticker.
    quote: Optional[Quote] = await provider.get_quote(symbol)
    if quote is None:
        raise HTTPException(status_code=404, detail=f"Symbol '{symbol}' not found.")

    fundamentals: Optional[Fundamentals] = await provider.get_fundamentals(symbol)
    eq_info = equity_list.get(symbol) or {}

    # 5-year sparkline (closes only, monthly sampled to keep payload small)
    sparkline: list[float] = []
    try:
        bars: list[OHLCVBar] = await provider.get_ohlcv(symbol, period="5y")
        # Sample every ~21 trading days (monthly)
        closes = [b.close for b in bars]
        sparkline = closes[::21] if closes else []
    except Exception as exc:
        logger.warning("Could not fetch sparkline for %s: %s", symbol, exc)

    result = {
        "symbol": symbol,
        "name": quote.name or eq_info.get("name", ""),
        "quote": quote.model_dump(mode="json"),
        "fundamentals": fundamentals.model_dump(mode="json") if fundamentals else {},
        "sparkline": sparkline,
        "data_as_of": datetime.now(timezone.utc).isoformat(),
        "delayed": True,
    }

    await cache.set(cache_key, json.dumps(result, default=str), ttl)
    return result


@router.get("/{symbol}/ohlcv")
async def get_ohlcv(
    symbol: str,
    period: str = Query("1y", description="yfinance period string, e.g. 1y, 2y, 6mo"),
    cache: SQLiteCache = Depends(get_cache),
    provider: DataProvider = Depends(get_provider),
    s: Settings = Depends(get_settings),
) -> dict:
    """Return full OHLCV bars for charting."""
    symbol = symbol.upper().strip()
    ttl = get_cache_ttl(s)
    cache_key = f"ohlcv:{symbol}:{period}"

    cached = await cache.get(cache_key)
    if cached:
        return json.loads(cached)

    try:
        bars = await provider.get_ohlcv(symbol, period=period)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    result = {
        "symbol": symbol,
        "period": period,
        "bars": [b.model_dump(mode="json") for b in bars],
        "count": len(bars),
        "data_as_of": datetime.now(timezone.utc).isoformat(),
        "delayed": True,
    }
    await cache.set(cache_key, json.dumps(result, default=str), ttl)
    return result


@router.get("/{symbol}/analysis")
async def get_analysis(
    symbol: str,
    cache: SQLiteCache = Depends(get_cache),
    provider: DataProvider = Depends(get_provider),
    s: Settings = Depends(get_settings),
) -> dict:
    """Return full score breakdown + indicator snapshot for a stock."""
    symbol = symbol.upper().strip()
    ttl = get_cache_ttl(s)
    cache_key = f"analysis:{symbol}"

    cached = await cache.get(cache_key)
    if cached:
        return json.loads(cached)

    # Fetch stock data
    try:
        bars = await provider.get_ohlcv(symbol, period="2y")
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    if not bars:
        raise HTTPException(status_code=404, detail=f"No price data for '{symbol}'.")

    fundamentals: Optional[Fundamentals] = await provider.get_fundamentals(symbol)
    fund_dict = fundamentals.model_dump() if fundamentals else {}

    # Market prices (Nifty 50)
    try:
        nifty_bars = await provider.get_ohlcv("^NSEI", period="2y")
        market_prices = np.array([b.close for b in nifty_bars], dtype=float)
    except Exception:
        market_prices = np.array([], dtype=float)

    prices = np.array([b.close for b in bars], dtype=float)
    volumes = np.array([b.volume for b in bars], dtype=float)

    score = score_stock(
        prices=prices,
        volumes=volumes,
        market_prices=market_prices,
        fundamentals=fund_dict,
        sector_pe_median=None,  # TODO: sector-level PE lookup
    )

    # Indicator snapshot (last values)
    ret = returns(prices)

    result = {
        "symbol": symbol,
        "score": score,
        "returns": ret,
        "data_as_of": datetime.now(timezone.utc).isoformat(),
        "delayed": True,
    }

    await cache.set(cache_key, json.dumps(result, default=str), ttl)
    return result


@router.get("/{symbol}/news")
async def get_news(
    symbol: str,
    limit: int = Query(5, ge=1, le=20),
    cache: SQLiteCache = Depends(get_cache),
    provider: DataProvider = Depends(get_provider),
    s: Settings = Depends(get_settings),
) -> dict:
    """Return recent news articles for a stock."""
    symbol = symbol.upper().strip()
    ttl = get_cache_ttl(s)
    cache_key = f"news:{symbol}"

    cached = await cache.get(cache_key)
    if cached:
        return json.loads(cached)

    news_items = await provider.get_news(symbol, limit=limit)
    result = {
        "symbol": symbol,
        "news": [item.model_dump(mode="json") for item in news_items],
        "count": len(news_items),
        "data_as_of": datetime.now(timezone.utc).isoformat(),
        "delayed": True,
    }
    await cache.set(cache_key, json.dumps(result, default=str), ttl)
    return result
