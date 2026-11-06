"""Tests for app/analysis/scoring.py

Verifies scoring engine sub-scores, weights, risk labels, and reason text generation.
"""

from __future__ import annotations

import numpy as np
import pytest

from app.analysis.scoring import score_stock


def test_score_stock_bullish_profile():
    """Stock with strong uptrend, strong fundamentals, and low volatility."""
    n = 300
    # Steadily rising prices: from 100 to 125 (calm growth)
    prices = np.linspace(100.0, 125.0, n)
    volumes = np.full(n, 100000.0)
    market_prices = np.linspace(10000.0, 13000.0, n)

    fundamentals = {
        "pe_ratio": 18.0,
        "pb_ratio": 2.5,
        "roe": 0.22,
        "debt_to_equity": 0.2,
        "dividend_yield": 0.02,
    }

    result = score_stock(
        prices=prices,
        volumes=volumes,
        market_prices=market_prices,
        fundamentals=fundamentals,
        sector_pe_median=25.0,
    )

    assert "total" in result
    assert result["total"] >= 65
    assert result["verdict_color"] == "green"
    assert result["risk_label"] in ("Low", "Medium")

    # Check that all reasons are populated
    for cat in ("trend", "momentum", "valuation", "quality", "stability"):
        sub = result[cat]
        assert sub["score"] <= sub["max"]
        assert len(sub["reasons"]) > 0
        for r in sub["reasons"]:
            assert "text" in r and len(r["text"]) > 0
            assert r["color"] in ("green", "amber", "red")


def test_score_stock_bearish_profile():
    """Stock in steep downtrend, weak fundamentals, wild volatility."""
    n = 300
    # Falling prices: 300 to 80
    prices = np.linspace(300.0, 80.0, n)
    volumes = np.full(n, 50000.0)
    market_prices = np.linspace(10000.0, 15000.0, n)

    fundamentals = {
        "pe_ratio": 75.0,
        "pb_ratio": 8.0,
        "roe": 0.02,
        "debt_to_equity": 3.5,
        "dividend_yield": 0.0,
    }

    result = score_stock(
        prices=prices,
        volumes=volumes,
        market_prices=market_prices,
        fundamentals=fundamentals,
        sector_pe_median=20.0,
    )

    assert result["total"] <= 45
    assert result["verdict_color"] in ("red", "amber")


def test_score_stock_empty_or_minimal_data():
    """Ensure engine handles small arrays without throwing exceptions."""
    prices = np.array([100.0, 101.0, 102.0])
    volumes = np.array([1000.0, 1000.0, 1000.0])
    market_prices = np.array([500.0, 505.0, 510.0])
    fundamentals = {}

    result = score_stock(prices, volumes, market_prices, fundamentals)
    assert 0 <= result["total"] <= 100
    assert result["verdict"] in ("Looks strong", "Mixed signals", "Looks weak")
