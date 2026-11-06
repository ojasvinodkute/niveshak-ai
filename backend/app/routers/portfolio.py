"""Niveshak AI — portfolio builder router.

Accepts 3–6 NSE symbols and constructs a scored, weighted portfolio
with diversification checks.
"""

from __future__ import annotations

import json
import logging
from typing import Optional

import numpy as np
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

from app.analysis.indicators import annualised_volatility, returns
from app.analysis.scoring import score_stock
from app.cache.sqlite_cache import SQLiteCache
from app.config import Settings
from app.data.provider import DataProvider, Fundamentals, OHLCVBar
from app.routers.stocks import get_cache, get_provider, get_settings, get_cache_ttl

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/portfolio", tags=["portfolio"])

# ---------------------------------------------------------------------------
# Request model
# ---------------------------------------------------------------------------


class PortfolioRequest(BaseModel):
    """Request body for the portfolio builder."""

    symbols: list[str] = Field(..., min_length=3, max_length=6)
    amount: float = Field(..., gt=0, description="Total investment amount in ₹")
    risk_preference: str = Field("medium", description="low | medium | high")

    @field_validator("symbols")
    @classmethod
    def validate_symbols(cls, v: list[str]) -> list[str]:
        cleaned = [s.strip().upper() for s in v]
        if len(set(cleaned)) != len(cleaned):
            raise ValueError("Duplicate symbols are not allowed.")
        return cleaned

    @field_validator("risk_preference")
    @classmethod
    def validate_risk(cls, v: str) -> str:
        v = v.lower()
        if v not in ("low", "medium", "high"):
            raise ValueError("risk_preference must be 'low', 'medium', or 'high'.")
        return v


# ---------------------------------------------------------------------------
# Helper: fetch stock data with cache
# ---------------------------------------------------------------------------


async def _get_stock_data(
    symbol: str,
    provider: DataProvider,
    cache: SQLiteCache,
    ttl: int,
    market_prices: np.ndarray,
) -> Optional[dict]:
    """Return cached or freshly computed analysis dict for *symbol*."""
    cache_key = f"portfolio_stock:{symbol}"
    cached = await cache.get(cache_key)
    if cached:
        return json.loads(cached)

    try:
        bars: list[OHLCVBar] = await provider.get_ohlcv(symbol, period="2y")
    except Exception as exc:
        logger.warning("Portfolio: cannot fetch %s — %s", symbol, exc)
        return None

    if not bars:
        return None

    prices = np.array([b.close for b in bars], dtype=float)
    volumes = np.array([b.volume for b in bars], dtype=float)

    fundamentals: Optional[Fundamentals] = await provider.get_fundamentals(symbol)
    fund_dict = fundamentals.model_dump() if fundamentals else {}

    quote = None
    try:
        quote = await provider.get_quote(symbol)
    except Exception:
        pass

    name = quote.name if quote else symbol
    price = quote.price if quote else (float(prices[-1]) if len(prices) > 0 else 0.0)

    score_dict = score_stock(
        prices=prices,
        volumes=volumes,
        market_prices=market_prices,
        fundamentals=fund_dict,
    )
    ret = returns(prices)
    vol = annualised_volatility(prices)

    result = {
        "symbol": symbol,
        "name": name,
        "price": price,
        "sector": fund_dict.get("sector") or "Diversified",
        "score": score_dict,
        "returns": ret,
        "volatility": vol,
    }
    await cache.set(cache_key, json.dumps(result, default=str), ttl)
    return result


# ---------------------------------------------------------------------------
# Weight computation
# ---------------------------------------------------------------------------


def _compute_weights(scores: list[float], max_weight: float = 0.35) -> list[float]:
    """Assign portfolio weights proportional to scores, capped at *max_weight*.

    Iteratively caps any stock exceeding *max_weight* and redistributes
    the excess proportionally among the uncapped stocks.

    Args:
        scores: Raw score values (all >= 0).
        max_weight: Maximum fraction for any single stock (default 35%).

    Returns:
        Normalised weight list (sums to 1.0).
    """
    n = len(scores)
    if n == 0:
        return []

    scores_arr = np.array(scores, dtype=float)
    # Avoid division by zero: treat zero score as a minimum of 1
    scores_arr = np.where(scores_arr <= 0, 1.0, scores_arr)

    weights = scores_arr / scores_arr.sum()
    # Iterative capping
    for _ in range(100):
        over_mask = weights > max_weight
        if not np.any(over_mask):
            break
        excess = (weights[over_mask] - max_weight).sum()
        weights[over_mask] = max_weight
        under_mask = ~over_mask
        if not np.any(under_mask):
            break
        sub_sum = weights[under_mask].sum()
        if sub_sum <= 0:
            break
        weights[under_mask] += excess * (weights[under_mask] / sub_sum)

    # Final normalisation
    total = weights.sum()
    if total > 0:
        weights /= total

    return weights.tolist()


# ---------------------------------------------------------------------------
# Diversification check
# ---------------------------------------------------------------------------


def _diversification_note(sector_weights: dict[str, float]) -> str:
    """Return a plain-English note about sector concentration."""
    top_sector = max(sector_weights, key=sector_weights.get)  # type: ignore[arg-type]
    top_pct = sector_weights[top_sector] * 100
    if top_pct > 60:
        return (
            f"⚠️ Your portfolio is heavily concentrated in {top_sector} ({top_pct:.0f}%). "
            "Consider adding stocks from other sectors to reduce risk."
        )
    elif top_pct > 40:
        return (
            f"Your portfolio has {top_pct:.0f}% exposure to {top_sector}. "
            "Moderate concentration — consider diversifying further."
        )
    return "Good diversification across sectors. No single sector dominates the portfolio."


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------


@router.post("")
async def build_portfolio(
    req: PortfolioRequest,
    cache: SQLiteCache = Depends(get_cache),
    provider: DataProvider = Depends(get_provider),
    s: Settings = Depends(get_settings),
) -> dict:
    """Build a scored and weighted portfolio from 3–6 NSE stocks."""
    ttl = get_cache_ttl(s)

    # Market prices
    try:
        nifty_bars = await provider.get_ohlcv("^NSEI", period="2y")
        market_prices = np.array([b.close for b in nifty_bars], dtype=float)
    except Exception:
        market_prices = np.array([], dtype=float)

    # Fetch data for each symbol
    stock_data: list[dict] = []
    failed: list[str] = []
    for sym in req.symbols:
        data = await _get_stock_data(sym, provider, cache, ttl, market_prices)
        if data is None:
            failed.append(sym)
        else:
            stock_data.append(data)

    if len(stock_data) < 3:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Could not retrieve data for {failed}. "
                "Need at least 3 valid symbols to build a portfolio."
            ),
        )

    scores = [d["score"]["total"] for d in stock_data]
    weights = _compute_weights(scores, max_weight=0.35)

    # Sector concentration check
    sector_weights: dict[str, float] = {}
    for d, w in zip(stock_data, weights):
        sect = d.get("sector") or "Unknown"
        sector_weights[sect] = sector_weights.get(sect, 0.0) + w

    top_sector_weight = max(sector_weights.values()) if sector_weights else 0.0
    if top_sector_weight > 0.40:
        # Warn but do not reject — the user chose the symbols
        logger.info("Portfolio sector concentration: %.0f%%", top_sector_weight * 100)

    # Build allocation entries
    allocations = []
    for d, w in zip(stock_data, weights):
        allocation_amount = req.amount * w
        allocations.append(
            {
                "symbol": d.get("symbol", ""),
                "name": d.get("name") or d.get("symbol", ""),
                "sector": d.get("sector") or "Diversified",
                "price": d.get("price", 0.0),
                "weight": round(w, 4),
                "weight_pct": round(w * 100, 2),
                "amount": round(allocation_amount, 2),
                "allocation_amount": round(allocation_amount, 2),
                "score": d["score"]["total"] if isinstance(d.get("score"), dict) and "total" in d["score"] else 50,
                "risk_label": d["score"].get("risk_label", "Medium") if isinstance(d.get("score"), dict) else "Medium",
                "verdict": d["score"].get("verdict", "Mixed") if isinstance(d.get("score"), dict) else "Mixed",
                "verdict_color": d["score"].get("verdict_color", "amber") if isinstance(d.get("score"), dict) else "amber",
                "returns": d.get("returns", {}),
            }
        )

    # Blended risk metrics
    vols = np.array([d.get("volatility", 0.20) for d in stock_data], dtype=float)
    w_arr = np.array(weights, dtype=float)
    blended_vol = float(np.dot(w_arr, vols))

    if blended_vol < 0.20:
        blended_risk = "Low"
    elif blended_vol < 0.30:
        blended_risk = "Medium"
    else:
        blended_risk = "High"

    # ETF tip
    etf_tip = (
        "💡 Tip: For broad market exposure with low effort, consider a Nifty 50 index fund "
        "(e.g., UTI Nifty 50 Index Fund) alongside your stock picks."
    )

    return {
        "allocations": allocations,
        "blended_risk": blended_risk,
        "blended_volatility_pct": round(blended_vol * 100, 2),
        "total_amount": req.amount,
        "sector_exposure": {k: round(v * 100, 2) for k, v in sector_weights.items()},
        "diversification_note": _diversification_note(sector_weights),
        "etf_tip": etf_tip,
        "failed_symbols": failed,
        "risk_preference": req.risk_preference,
    }
