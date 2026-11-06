"""Niveshak AI — abstract data provider and shared Pydantic models.

Defines the contract that every data-source implementation must satisfy,
plus the data-transfer objects shared across the application.
"""

from __future__ import annotations

import abc
from datetime import date, datetime
from typing import Optional

import pandas as pd
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Data-Transfer Objects (Pydantic models)
# ---------------------------------------------------------------------------


class OHLCVBar(BaseModel):
    """A single OHLCV candlestick bar."""

    date: date
    open: float
    high: float
    low: float
    close: float
    volume: float


class Quote(BaseModel):
    """Real-time (or delayed) market quote for a stock."""

    symbol: str
    name: str = ""
    price: float
    change: float = 0.0
    change_pct: float = 0.0
    prev_close: float = 0.0
    day_high: float = 0.0
    day_low: float = 0.0
    week_52_high: float = 0.0
    week_52_low: float = 0.0
    volume: float = 0.0
    avg_volume: float = 0.0
    market_cap: Optional[float] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    delayed: bool = True


class Fundamentals(BaseModel):
    """Key fundamental metrics for a stock."""

    pe_ratio: Optional[float] = None
    pb_ratio: Optional[float] = None
    roe: Optional[float] = None
    debt_to_equity: Optional[float] = None
    dividend_yield: Optional[float] = None
    sector: Optional[str] = None
    industry: Optional[str] = None
    eps: Optional[float] = None
    revenue_growth: Optional[float] = None


class NewsItem(BaseModel):
    """A single news article."""

    title: str
    url: str = ""
    publisher: str = ""
    published_at: Optional[datetime] = None
    summary: str = ""


# ---------------------------------------------------------------------------
# Abstract data provider
# ---------------------------------------------------------------------------


class DataProvider(abc.ABC):
    """Contract for all data-source implementations (yfinance, real broker API, etc.)."""

    @abc.abstractmethod
    async def get_ohlcv(self, symbol: str, period: str = "2y") -> list[OHLCVBar]:
        """Return OHLCV bars for *symbol* over *period*.

        Args:
            symbol: NSE ticker symbol (without exchange suffix).
            period: yfinance-style period string, e.g. ``"1y"``, ``"2y"``.

        Returns:
            List of :class:`OHLCVBar` ordered oldest → newest.

        Raises:
            ValueError: If the symbol is not found or data is unavailable.
        """

    @abc.abstractmethod
    async def get_quote(self, symbol: str) -> Optional[Quote]:
        """Return the latest quote for *symbol*, or ``None`` on failure."""

    @abc.abstractmethod
    async def get_fundamentals(self, symbol: str) -> Optional[Fundamentals]:
        """Return fundamental data for *symbol*, or ``None`` on failure."""

    @abc.abstractmethod
    async def get_news(self, symbol: str, limit: int = 5) -> list[NewsItem]:
        """Return up to *limit* recent news items for *symbol*."""

    @abc.abstractmethod
    async def search_symbols(self, query: str) -> list[dict]:
        """Search for symbols matching *query*.

        Returns:
            List of dicts with at least ``symbol`` and ``name`` keys.
        """
