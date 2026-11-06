"""Niveshak AI — yfinance implementation of DataProvider.

All network/CPU-bound yfinance calls are offloaded to a thread pool via
``asyncio.to_thread`` so the event loop is never blocked.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

import pandas as pd
import yfinance as yf

from app.data.provider import (
    DataProvider,
    Fundamentals,
    NewsItem,
    OHLCVBar,
    Quote,
)

logger = logging.getLogger(__name__)


def _ensure_ns_suffix(symbol: str) -> str:
    """Append ``.NS`` if the symbol is an equity and does not already carry an exchange suffix."""
    symbol = symbol.upper().strip()
    if symbol.startswith("^") or "." in symbol:
        return symbol
    return symbol + ".NS"


# ---------------------------------------------------------------------------
# Synchronous helpers (run inside threads)
# ---------------------------------------------------------------------------


def _sync_get_ohlcv(ticker_symbol: str, period: str) -> list[OHLCVBar]:
    """Download OHLCV data synchronously using yfinance."""
    df: pd.DataFrame = yf.download(
        ticker_symbol,
        period=period,
        auto_adjust=True,
        progress=False,
        threads=False,
    )
    if df is None or df.empty:
        raise ValueError(f"Symbol not found or no data returned for '{ticker_symbol}'")

    # yfinance may return multi-level columns when downloading a single ticker
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)

    df = df.rename(
        columns={
            "Open": "open",
            "High": "high",
            "Low": "low",
            "Close": "close",
            "Volume": "volume",
        }
    )
    df = df.dropna(subset=["close"])

    bars: list[OHLCVBar] = []
    for idx, row in df.iterrows():
        bars.append(
            OHLCVBar(
                date=idx.date() if hasattr(idx, "date") else idx,
                open=float(row.get("open", 0) or 0),
                high=float(row.get("high", 0) or 0),
                low=float(row.get("low", 0) or 0),
                close=float(row.get("close", 0) or 0),
                volume=float(row.get("volume", 0) or 0),
            )
        )
    return bars


def _sync_get_quote(ticker_symbol: str) -> Optional[Quote]:
    """Fetch a quote synchronously using yfinance."""
    ticker = yf.Ticker(ticker_symbol)
    try:
        info: dict = ticker.info or {}
    except Exception:
        info = {}

    try:
        fast = ticker.fast_info
    except Exception:
        fast = None

    def _safe(d: dict, key: str, default=0.0):
        val = d.get(key)
        if val is None:
            return default
        try:
            return float(val)
        except (TypeError, ValueError):
            return default

    # Prefer fast_info for speed-sensitive fields
    price = 0.0
    prev_close = 0.0
    day_high = 0.0
    day_low = 0.0
    volume = 0.0
    market_cap = None

    if fast is not None:
        try:
            price = float(fast.last_price or 0)
            prev_close = float(fast.previous_close or 0)
            day_high = float(fast.day_high or 0)
            day_low = float(fast.day_low or 0)
            volume = float(fast.last_volume or 0)
            market_cap = float(fast.market_cap) if fast.market_cap else None
        except Exception:
            pass

    # Fallback to info dict
    if price == 0.0:
        price = _safe(info, "currentPrice") or _safe(info, "regularMarketPrice")
    if prev_close == 0.0:
        prev_close = _safe(info, "previousClose") or _safe(info, "regularMarketPreviousClose")
    if day_high == 0.0:
        day_high = _safe(info, "dayHigh") or _safe(info, "regularMarketDayHigh")
    if day_low == 0.0:
        day_low = _safe(info, "dayLow") or _safe(info, "regularMarketDayLow")
    if volume == 0.0:
        volume = _safe(info, "volume") or _safe(info, "regularMarketVolume")
    if market_cap is None:
        mc = info.get("marketCap")
        market_cap = float(mc) if mc else None

    change = price - prev_close
    change_pct = (change / prev_close * 100) if prev_close else 0.0

    return Quote(
        symbol=ticker_symbol.replace(".NS", ""),
        name=info.get("longName") or info.get("shortName") or "",
        price=price,
        change=change,
        change_pct=change_pct,
        prev_close=prev_close,
        day_high=day_high,
        day_low=day_low,
        week_52_high=_safe(info, "fiftyTwoWeekHigh"),
        week_52_low=_safe(info, "fiftyTwoWeekLow"),
        volume=volume,
        avg_volume=_safe(info, "averageVolume"),
        market_cap=market_cap,
        timestamp=datetime.now(timezone.utc),
        delayed=True,
    )


def _sync_get_fundamentals(ticker_symbol: str) -> Optional[Fundamentals]:
    """Fetch fundamental data synchronously using yfinance."""
    ticker = yf.Ticker(ticker_symbol)
    try:
        info: dict = ticker.info or {}
    except Exception:
        return None

    def _opt_float(key: str) -> Optional[float]:
        val = info.get(key)
        if val is None:
            return None
        try:
            return float(val)
        except (TypeError, ValueError):
            return None

    return Fundamentals(
        pe_ratio=_opt_float("trailingPE"),
        pb_ratio=_opt_float("priceToBook"),
        roe=_opt_float("returnOnEquity"),
        debt_to_equity=_opt_float("debtToEquity"),
        dividend_yield=_opt_float("dividendYield"),
        sector=info.get("sector"),
        industry=info.get("industry"),
        eps=_opt_float("trailingEps"),
        revenue_growth=_opt_float("revenueGrowth"),
    )


def _sync_get_news(ticker_symbol: str, limit: int) -> list[NewsItem]:
    """Fetch news synchronously using yfinance."""
    ticker = yf.Ticker(ticker_symbol)
    try:
        raw_news = ticker.news or []
    except Exception:
        return []

    items: list[NewsItem] = []
    for article in raw_news[:limit]:
        try:
            published_at: Optional[datetime] = None
            ts = article.get("providerPublishTime") or article.get("publishTime")
            if ts:
                try:
                    published_at = datetime.fromtimestamp(int(ts), tz=timezone.utc)
                except Exception:
                    pass

            # yfinance v0.2+ nests data inside 'content' key sometimes
            content = article.get("content") or article
            title = content.get("title") or article.get("title") or ""
            url = (
                content.get("canonicalUrl", {}).get("url")
                or content.get("clickThroughUrl", {}).get("url")
                or article.get("link")
                or ""
            )
            publisher = (
                content.get("provider", {}).get("displayName")
                or article.get("publisher")
                or ""
            )
            summary = content.get("summary") or article.get("summary") or ""

            if title:
                items.append(
                    NewsItem(
                        title=title,
                        url=url,
                        publisher=publisher,
                        published_at=published_at,
                        summary=summary,
                    )
                )
        except Exception as exc:
            logger.warning("Skipping malformed news article: %s", exc)

    return items


# ---------------------------------------------------------------------------
# Async provider
# ---------------------------------------------------------------------------


class YFinanceProvider(DataProvider):
    """DataProvider implementation backed by the ``yfinance`` library."""

    async def get_ohlcv(self, symbol: str, period: str = "2y") -> list[OHLCVBar]:
        """Download OHLCV data for an NSE symbol.

        Args:
            symbol: NSE ticker (e.g. ``"RELIANCE"`` or ``"RELIANCE.NS"``).
            period: yfinance period string (``"1y"``, ``"2y"``, etc.).

        Returns:
            List of :class:`OHLCVBar` ordered oldest → newest.

        Raises:
            ValueError: If the symbol is not found.
        """
        ticker_symbol = _ensure_ns_suffix(symbol)
        try:
            bars = await asyncio.to_thread(_sync_get_ohlcv, ticker_symbol, period)
            return bars
        except ValueError:
            raise
        except Exception as exc:
            logger.error("get_ohlcv failed for %s: %s", ticker_symbol, exc)
            raise ValueError(f"Symbol not found: {symbol}") from exc

    async def get_quote(self, symbol: str) -> Optional[Quote]:
        """Return the latest (delayed) quote for an NSE symbol."""
        ticker_symbol = _ensure_ns_suffix(symbol)
        try:
            return await asyncio.to_thread(_sync_get_quote, ticker_symbol)
        except Exception as exc:
            logger.warning("get_quote failed for %s: %s", ticker_symbol, exc)
            return None

    async def get_fundamentals(self, symbol: str) -> Optional[Fundamentals]:
        """Return fundamental metrics for an NSE symbol."""
        ticker_symbol = _ensure_ns_suffix(symbol)
        try:
            return await asyncio.to_thread(_sync_get_fundamentals, ticker_symbol)
        except Exception as exc:
            logger.warning("get_fundamentals failed for %s: %s", ticker_symbol, exc)
            return None

    async def get_news(self, symbol: str, limit: int = 5) -> list[NewsItem]:
        """Return recent news articles for an NSE symbol."""
        ticker_symbol = _ensure_ns_suffix(symbol)
        try:
            return await asyncio.to_thread(_sync_get_news, ticker_symbol, limit)
        except Exception as exc:
            logger.warning("get_news failed for %s: %s", ticker_symbol, exc)
            return []

    async def search_symbols(self, query: str) -> list[dict]:
        """Lightweight symbol search via yfinance (not used in main search path)."""
        # Main search is handled by EquityList; this is a fallback.
        return []
