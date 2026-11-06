"""Niveshak AI — projection router.

Runs a Monte Carlo growth projection for a given stock and investment amount.
"""

from __future__ import annotations

import json
import logging
from typing import Optional

import numpy as np
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.analysis.indicators import annualised_volatility, returns
from app.analysis.projection import compute_annual_return_assumption, monte_carlo_projection
from app.analysis.scoring import score_stock
from app.cache.sqlite_cache import SQLiteCache
from app.config import Settings
from app.data.provider import DataProvider, Fundamentals, OHLCVBar
from app.routers.stocks import get_cache, get_provider, get_settings, get_cache_ttl

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projection", tags=["projection"])


# ---------------------------------------------------------------------------
# Request model
# ---------------------------------------------------------------------------


class ProjectionRequest(BaseModel):
    """Request body for the projection endpoint."""

    symbol: str = Field(..., description="NSE ticker symbol")
    amount: float = Field(..., gt=0, description="Investment amount in ₹")
    years: int = Field(..., ge=1, le=30, description="Investment horizon in years")


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------


@router.post("")
async def project(
    req: ProjectionRequest,
    cache: SQLiteCache = Depends(get_cache),
    provider: DataProvider = Depends(get_provider),
    s: Settings = Depends(get_settings),
) -> dict:
    """Run a Monte Carlo growth projection for a stock investment."""
    symbol = req.symbol.upper().strip()
    ttl = get_cache_ttl(s)

    # Retrieve or compute analysis (re-use analysis cache if available)
    analysis_cache_key = f"analysis:{symbol}"
    analysis_cached = await cache.get(analysis_cache_key)

    prices: np.ndarray
    score_dict: dict
    ret: dict

    if analysis_cached:
        analysis = json.loads(analysis_cached)
        score_dict = analysis.get("score", {})
        ret = analysis.get("returns", {})
        # We still need raw prices for volatility — fetch short history
        try:
            bars = await provider.get_ohlcv(symbol, period="2y")
            prices = np.array([b.close for b in bars], dtype=float)
        except Exception:
            prices = np.array([], dtype=float)
    else:
        try:
            bars = await provider.get_ohlcv(symbol, period="2y")
        except ValueError as exc:
            raise HTTPException(status_code=404, detail=str(exc))

        if not bars:
            raise HTTPException(status_code=404, detail=f"No price data for '{symbol}'.")

        prices = np.array([b.close for b in bars], dtype=float)
        volumes = np.array([b.volume for b in bars], dtype=float)

        fundamentals: Optional[Fundamentals] = await provider.get_fundamentals(symbol)
        fund_dict = fundamentals.model_dump() if fundamentals else {}

        try:
            nifty_bars = await provider.get_ohlcv("^NSEI", period="2y")
            market_prices = np.array([b.close for b in nifty_bars], dtype=float)
        except Exception:
            market_prices = np.array([], dtype=float)

        score_dict = score_stock(
            prices=prices,
            volumes=volumes,
            market_prices=market_prices,
            fundamentals=fund_dict,
        )
        ret = returns(prices)

        # Cache analysis result
        analysis_result = {
            "symbol": symbol,
            "score": score_dict,
            "returns": ret,
        }
        await cache.set(
            analysis_cache_key, json.dumps(analysis_result, default=str), ttl
        )

    score_int = score_dict.get("total", 50)
    vol_ann = annualised_volatility(prices) if len(prices) > 1 else 0.20
    hist_1y = ret.get("1y", 0.12)

    assumed_return = compute_annual_return_assumption(
        score=score_int,
        historical_vol=vol_ann,
        hist_1y_return=hist_1y,
    )

    projection = monte_carlo_projection(
        amount=req.amount,
        years=req.years,
        annual_return=assumed_return,
        annual_volatility=vol_ann if vol_ann > 0 else 0.20,
        simulations=2000,
        seed=42,
    )

    return {
        "symbol": symbol,
        "score": score_int,
        "risk_label": score_dict.get("risk_label", "Medium"),
        "projection": projection,
    }
