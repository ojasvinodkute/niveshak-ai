"""Tests for app/analysis/projection.py

Verifies Monte Carlo lognormal projections, percentile ordering,
fan data generation, and probability of loss calculation.
"""

from __future__ import annotations

import pytest
from app.analysis.projection import monte_carlo_projection


def test_monte_carlo_projection_percentiles():
    amt = 100000.0
    years = 5
    annual_return = 0.12
    annual_volatility = 0.18

    res = monte_carlo_projection(
        amount=amt,
        years=years,
        annual_return=annual_return,
        annual_volatility=annual_volatility,
        simulations=2000,
        seed=42,
    )

    assert "p10" in res and "p50" in res and "p90" in res
    assert res["p10"] <= res["p25"] <= res["p50"] <= res["p75"] <= res["p90"]
    assert res["p50"] > amt  # Expect positive growth for 12% over 5 years
    assert 0.0 <= res["prob_loss"] <= 1.0


def test_monte_carlo_fan_data():
    amt = 50000.0
    years = 10
    res = monte_carlo_projection(
        amount=amt,
        years=years,
        annual_return=0.15,
        annual_volatility=0.22,
        simulations=1000,
    )

    assert len(res["fan_data"]) == 10
    for i, pt in enumerate(res["fan_data"]):
        assert pt["year"] == i + 1
        assert pt["p10"] <= pt["p50"] <= pt["p90"]


def test_monte_carlo_negative_drift():
    amt = 100000.0
    res = monte_carlo_projection(
        amount=amt,
        years=3,
        annual_return=-0.10,
        annual_volatility=0.30,
        simulations=1000,
    )
    # Even with shrinkage to 12%, negative return pulls down expected outcome
    assert res["prob_loss"] > 0.10
