"""Niveshak AI — Monte Carlo projection engine.

Simulates portfolio growth using lognormal returns with shrinkage blending
to avoid overconfident projections based on historical winners.
"""

from __future__ import annotations

import numpy as np


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def monte_carlo_projection(
    amount: float,
    years: int,
    annual_return: float,
    annual_volatility: float,
    simulations: int = 2000,
    seed: int = 42,
) -> dict:
    """Run a Monte Carlo simulation of investment growth.

    Uses a lognormal model where each year's gross return is drawn from
    ``LogNormal(mu - sigma²/2, sigma²)``.  The expected return is blended
    toward a 12% long-run assumption to avoid extrapolating past winners.

    Args:
        amount: Initial investment amount (₹).
        years: Investment horizon in years (1–30).
        annual_return: Historical / assumed annual return (e.g. 0.15 = 15%).
        annual_volatility: Historical annualised volatility (e.g. 0.20 = 20%).
        simulations: Number of Monte Carlo paths (default 2000).
        seed: Random seed for reproducibility (default 42).

    Returns:
        Dict with keys:
        - ``p10``, ``p25``, ``p50``, ``p75``, ``p90``: final portfolio value
          at each percentile (₹)
        - ``prob_loss``: fraction of simulations that end below *amount*
        - ``fan_data``: list of annual snapshots for a fan chart
        - ``input_amount``, ``years``, ``assumed_return``, ``note``
    """
    years = max(1, int(years))
    simulations = max(100, int(simulations))
    amount = max(1.0, float(amount))
    annual_volatility = max(0.0, float(annual_volatility))

    # Shrinkage blend: 40% historical, 60% long-run base of 12%
    mu = 0.4 * annual_return + 0.6 * 0.12
    # Cap mu between 4% and 20%
    mu = max(0.04, min(0.20, mu))
    sigma = annual_volatility

    rng = np.random.default_rng(seed)

    # Shape: (simulations, years)
    # Each entry is ln(1 + r_t) ~ N(mu - sigma²/2, sigma²)
    drift = mu - 0.5 * sigma ** 2
    annual_log_returns = rng.normal(
        loc=drift,
        scale=sigma if sigma > 0 else 1e-6,
        size=(simulations, years),
    )

    # Cumulative product → portfolio value at each year
    # paths shape: (simulations, years)
    cum_log_returns = np.cumsum(annual_log_returns, axis=1)
    paths = amount * np.exp(cum_log_returns)  # (simulations, years)

    # Fan data: percentiles for each year
    fan_data: list[dict] = []
    for yr in range(1, years + 1):
        col = paths[:, yr - 1]
        fan_data.append(
            {
                "year": yr,
                "p10": float(np.percentile(col, 10)),
                "p25": float(np.percentile(col, 25)),
                "p50": float(np.percentile(col, 50)),
                "p75": float(np.percentile(col, 75)),
                "p90": float(np.percentile(col, 90)),
            }
        )

    # Final values
    final_values = paths[:, -1]
    p10 = float(np.percentile(final_values, 10))
    p25 = float(np.percentile(final_values, 25))
    p50 = float(np.percentile(final_values, 50))
    p75 = float(np.percentile(final_values, 75))
    p90 = float(np.percentile(final_values, 90))

    prob_loss = float(np.mean(final_values < amount))

    # Tax note
    if years > 1:
        tax_note = (
            "Gains held for more than 1 year qualify as Long-Term Capital Gains (LTCG) "
            "and are taxed at 12.5% above ₹1.25 lakh per year (as of Budget 2024-25)."
        )
    else:
        tax_note = (
            "Gains held for 1 year or less are Short-Term Capital Gains (STCG) "
            "and are taxed at 20% (as of Budget 2024-25)."
        )

    return {
        "p10": p10,
        "p25": p25,
        "p50": p50,
        "p75": p75,
        "p90": p90,
        "prob_loss": prob_loss,
        "fan_data": fan_data,
        "input_amount": amount,
        "years": years,
        "assumed_return": mu,
        "note": (
            f"Projections use a blended expected return of {mu*100:.1f}% p.a. "
            f"(40% historical, 60% long-run 12% base) with volatility of "
            f"{sigma*100:.1f}% p.a. across {simulations:,} simulations. "
            "These are illustrative estimates — actual returns will differ. "
            f"{tax_note}"
        ),
    }


def compute_annual_return_assumption(
    score: int,
    historical_vol: float,
    hist_1y_return: float,
) -> float:
    """Derive a conservative annual return assumption for projections.

    Formula:
    - Base return: 12% (Nifty 50 long-run average)
    - Score bonus: ``score / 100 * 4%`` (max +4% for a perfect score)
    - Shrinkage: ``0.4 × (base + bonus + hist_1y) / 2 + 0.6 × 0.12``
    - Capped between 4% and 20%

    Args:
        score: Stock score 0–100.
        historical_vol: Annualised volatility (e.g. 0.25).
        hist_1y_return: 1-year historical return (e.g. 0.18).

    Returns:
        Conservative return assumption as a decimal (e.g. 0.14 = 14%).
    """
    base = 0.12
    score_bonus = (score / 100) * 0.04
    blended_hist = (base + score_bonus + hist_1y_return) / 2.0

    # Shrinkage: 40% toward blended historical, 60% toward base
    assumed = 0.4 * blended_hist + 0.6 * base
    # Cap
    assumed = max(0.04, min(0.20, assumed))
    return float(assumed)
