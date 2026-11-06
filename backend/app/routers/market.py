"""Niveshak AI — market overview router.

Provides Nifty 50, Sensex quotes, and top gainers/losers derived from
the screener cache.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends

from app.cache.sqlite_cache import SQLiteCache
from app.config import Settings
from app.data.provider import DataProvider, Quote
from app.routers.stocks import get_cache, get_provider, get_settings, get_cache_ttl

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/market", tags=["market"])

_MARKET_CACHE_KEY = "market:overview"


@router.get("/overview")
async def market_overview(
    cache: SQLiteCache = Depends(get_cache),
    provider: DataProvider = Depends(get_provider),
    s: Settings = Depends(get_settings),
) -> dict:
    """Return Nifty 50, Sensex, top gainers and top losers."""
    ttl = get_cache_ttl(s)
    cached = await cache.get(_MARKET_CACHE_KEY)
    if cached:
        return json.loads(cached)

    # Fetch Nifty 50 and Sensex quotes
    nifty_quote: Optional[Quote] = None
    sensex_quote: Optional[Quote] = None

    try:
        nifty_quote = await provider.get_quote("^NSEI")
    except Exception as exc:
        logger.warning("Failed to fetch Nifty 50 quote: %s", exc)

    try:
        sensex_quote = await provider.get_quote("^BSESN")
    except Exception as exc:
        logger.warning("Failed to fetch Sensex quote: %s", exc)

    # Top gainers/losers from screener cache
    top_gainers: list[dict] = []
    top_losers: list[dict] = []

    screener_cached = await cache.get("screener:all")
    if screener_cached:
        payload = json.loads(screener_cached)
        entries = payload.get("entries", [])
        sorted_by_change = sorted(
            entries, key=lambda x: x.get("change_pct", 0.0), reverse=True
        )
        top_gainers = sorted_by_change[:5]
        top_losers = sorted_by_change[-5:][::-1]

    result = {
        "nifty50": nifty_quote.model_dump(mode="json") if nifty_quote else None,
        "sensex": sensex_quote.model_dump(mode="json") if sensex_quote else None,
        "top_gainers": top_gainers,
        "top_losers": top_losers,
        "last_updated": datetime.now(timezone.utc).isoformat(),
        "data_as_of": datetime.now(timezone.utc).isoformat(),
        "delayed": True,
    }

    await cache.set(_MARKET_CACHE_KEY, json.dumps(result, default=str), ttl)
    return result
