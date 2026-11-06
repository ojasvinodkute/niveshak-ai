"""Niveshak AI — 0-100 stock scoring engine.

Produces a structured score breakdown with human-readable reasons for each
sub-category, suitable for display to beginner investors.
"""

from __future__ import annotations

from typing import Optional

import numpy as np

from app.analysis.indicators import (
    annualised_volatility,
    beta,
    bollinger_bands,
    detect_patterns,
    ema,
    macd,
    max_drawdown,
    returns,
    rsi,
    sma,
    volume_trend,
)


# ---------------------------------------------------------------------------
# Type alias
# ---------------------------------------------------------------------------

Reason = dict  # {"text": str, "color": "green"|"amber"|"red"}


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------


def _reason(text: str, color: str) -> Reason:
    return {"text": text, "color": color}


def _safe_last(arr: np.ndarray) -> Optional[float]:
    """Return the last non-NaN value in *arr*, or None."""
    arr = np.asarray(arr, dtype=float)
    valid = arr[~np.isnan(arr)]
    return float(valid[-1]) if len(valid) > 0 else None


# ---------------------------------------------------------------------------
# Main scoring function
# ---------------------------------------------------------------------------


def score_stock(
    prices: np.ndarray,
    volumes: np.ndarray,
    market_prices: np.ndarray,
    fundamentals: dict,
    sector_pe_median: Optional[float] = None,
) -> dict:
    """Compute a 0-100 score for a stock across five dimensions.

    Args:
        prices: 1-D array of daily closing prices (oldest → newest).
        volumes: 1-D array of daily volumes (same length as *prices*).
        market_prices: Nifty 50 closing prices for beta / RS computation.
        fundamentals: Dict with optional keys: ``pe_ratio``, ``pb_ratio``,
            ``roe``, ``debt_to_equity``, ``dividend_yield``.
        sector_pe_median: Median PE of the stock's sector; ``None`` if unknown.

    Returns:
        Structured score dict with keys ``total``, ``trend``, ``momentum``,
        ``valuation``, ``quality``, ``stability``, ``risk_label``,
        ``patterns``, ``verdict``, ``verdict_color``.
    """
    prices = np.asarray(prices, dtype=float)
    volumes = np.asarray(volumes, dtype=float)
    market_prices = np.asarray(market_prices, dtype=float)
    n = len(prices)

    # ------------------------------------------------------------------
    # Pre-compute indicators (guard against short series)
    # ------------------------------------------------------------------
    cur_price = _safe_last(prices) or 0.0

    sma20_arr = sma(prices, 20) if n >= 20 else np.full(n, np.nan)
    sma50_arr = sma(prices, 50) if n >= 50 else np.full(n, np.nan)
    sma200_arr = sma(prices, 200) if n >= 200 else np.full(n, np.nan)
    ema20_arr = ema(prices, 20) if n >= 20 else np.full(n, np.nan)

    sma50_val = _safe_last(sma50_arr)
    sma200_val = _safe_last(sma200_arr)
    ema20_val = _safe_last(ema20_arr)

    rsi_arr = rsi(prices, 14) if n >= 15 else np.full(n, np.nan)
    rsi_val = _safe_last(rsi_arr)

    macd_line, signal_line, _ = macd(prices) if n >= 35 else (
        np.full(n, np.nan), np.full(n, np.nan), np.full(n, np.nan)
    )
    macd_val = _safe_last(macd_line)

    ret = returns(prices)
    vol_ann = annualised_volatility(prices)
    mdd = max_drawdown(prices)
    beta_val = beta(prices, market_prices) if len(market_prices) >= 2 else 1.0

    # Fundamentals (all Optional)
    pe = fundamentals.get("pe_ratio")
    pb = fundamentals.get("pb_ratio")
    roe = fundamentals.get("roe")
    de = fundamentals.get("debt_to_equity")
    div_yield = fundamentals.get("dividend_yield")

    # ------------------------------------------------------------------
    # 1. Trend score (max 25)
    # ------------------------------------------------------------------
    trend_score = 0
    trend_reasons: list[Reason] = []

    # Price > SMA50 → +8
    if cur_price > 0 and sma50_val is not None:
        if cur_price > sma50_val:
            trend_score += 8
            trend_reasons.append(
                _reason(
                    "Price is above its 50-day moving average — the medium-term trend is upward.",
                    "green",
                )
            )
        else:
            trend_reasons.append(
                _reason(
                    "Price is below its 50-day moving average — medium-term trend is under pressure.",
                    "red",
                )
            )
    else:
        trend_reasons.append(
            _reason("Not enough data to evaluate 50-day trend.", "amber")
        )

    # SMA50 > SMA200 → +8
    if sma50_val is not None and sma200_val is not None:
        if sma50_val > sma200_val:
            trend_score += 8
            trend_reasons.append(
                _reason(
                    "The 50-day average is above the 200-day average — a healthy long-term uptrend.",
                    "green",
                )
            )
        else:
            trend_reasons.append(
                _reason(
                    "The 50-day average is below the 200-day average — the long-term trend is bearish.",
                    "red",
                )
            )
    else:
        trend_reasons.append(
            _reason("Insufficient history to compare 50-day and 200-day averages.", "amber")
        )

    # Price > EMA20 → +5
    if cur_price > 0 and ema20_val is not None:
        if cur_price > ema20_val:
            trend_score += 5
            trend_reasons.append(
                _reason(
                    "Price is above its 20-day exponential average — short-term momentum is positive.",
                    "green",
                )
            )
        else:
            trend_reasons.append(
                _reason(
                    "Price is below its 20-day exponential average — short-term momentum is weak.",
                    "red",
                )
            )
    else:
        trend_reasons.append(
            _reason("Not enough data to evaluate short-term EMA trend.", "amber")
        )

    # Price > SMA200 → +4
    if cur_price > 0 and sma200_val is not None:
        if cur_price > sma200_val:
            trend_score += 4
            trend_reasons.append(
                _reason(
                    "Price is above its 200-day moving average — the long-term trend is upward.",
                    "green",
                )
            )
        else:
            trend_reasons.append(
                _reason(
                    "Price is below its 200-day moving average — the stock is in a long-term downtrend.",
                    "red",
                )
            )
    else:
        trend_reasons.append(
            _reason("Insufficient price history to evaluate 200-day trend.", "amber")
        )

    trend_score = min(trend_score, 25)

    # ------------------------------------------------------------------
    # 2. Momentum score (max 25)
    # ------------------------------------------------------------------
    momentum_score = 0
    momentum_reasons: list[Reason] = []

    # 6M return (up to 10 pts)
    r6m = ret.get("6m", 0.0)
    if r6m >= 0.20:
        pts = 10
        momentum_reasons.append(
            _reason(f"6-month return of {r6m*100:.1f}% is excellent — strong upward momentum.", "green")
        )
    elif r6m >= 0.10:
        pts = 7
        momentum_reasons.append(
            _reason(f"6-month return of {r6m*100:.1f}% is solid.", "green")
        )
    elif r6m >= 0.0:
        pts = 4
        momentum_reasons.append(
            _reason(f"6-month return of {r6m*100:.1f}% is modest.", "amber")
        )
    elif r6m >= -0.10:
        pts = 2
        momentum_reasons.append(
            _reason(f"6-month return of {r6m*100:.1f}% is slightly negative.", "amber")
        )
    else:
        pts = 0
        momentum_reasons.append(
            _reason(f"6-month return of {r6m*100:.1f}% — the stock has fallen significantly.", "red")
        )
    momentum_score += pts

    # 1Y return (up to 8 pts)
    r1y = ret.get("1y", 0.0)
    if r1y >= 0.20:
        pts = 8
        momentum_reasons.append(
            _reason(f"1-year return of {r1y*100:.1f}% — strong annual performance.", "green")
        )
    elif r1y >= 0.10:
        pts = 5
        momentum_reasons.append(
            _reason(f"1-year return of {r1y*100:.1f}% is decent.", "green")
        )
    elif r1y >= 0.0:
        pts = 3
        momentum_reasons.append(
            _reason(f"1-year return of {r1y*100:.1f}% — marginally positive.", "amber")
        )
    else:
        pts = 0
        momentum_reasons.append(
            _reason(f"1-year return of {r1y*100:.1f}% — underperformed over the past year.", "red")
        )
    momentum_score += pts

    # MACD > 0 → +4
    if macd_val is not None:
        if macd_val > 0:
            momentum_score += 4
            momentum_reasons.append(
                _reason(
                    "MACD is positive — price momentum is currently bullish.",
                    "green",
                )
            )
        else:
            momentum_reasons.append(
                _reason(
                    "MACD is negative — price momentum has turned bearish.",
                    "red",
                )
            )
    else:
        momentum_reasons.append(_reason("Not enough data to compute MACD.", "amber"))

    # RSI 40-65 → +3; overbought/oversold penalty
    if rsi_val is not None:
        if 40 <= rsi_val <= 65:
            momentum_score += 3
            momentum_reasons.append(
                _reason(
                    f"RSI of {rsi_val:.1f} is in a healthy zone (40–65) — not overbought or oversold.",
                    "green",
                )
            )
        elif rsi_val > 70:
            momentum_score = max(0, momentum_score - 2)
            momentum_reasons.append(
                _reason(
                    f"RSI of {rsi_val:.1f} indicates the stock is overbought — a correction may follow.",
                    "red",
                )
            )
        elif rsi_val < 30:
            momentum_score = max(0, momentum_score - 1)
            momentum_reasons.append(
                _reason(
                    f"RSI of {rsi_val:.1f} indicates the stock is oversold — a bounce is possible but risk is elevated.",
                    "amber",
                )
            )
        else:
            momentum_reasons.append(
                _reason(f"RSI of {rsi_val:.1f} is neutral.", "amber")
            )
    else:
        momentum_reasons.append(_reason("Not enough data to compute RSI.", "amber"))

    momentum_score = max(0, min(momentum_score, 25))

    # ------------------------------------------------------------------
    # 3. Valuation score (max 20)
    # ------------------------------------------------------------------
    valuation_score = 0
    valuation_reasons: list[Reason] = []

    if pe is not None and pe > 0:
        if sector_pe_median is not None and sector_pe_median > 0:
            if pe < sector_pe_median * 0.8:
                valuation_score += 20
                valuation_reasons.append(
                    _reason(
                        f"P/E of {pe:.1f}x is well below the sector median ({sector_pe_median:.1f}x) — attractively valued.",
                        "green",
                    )
                )
            elif pe < sector_pe_median:
                valuation_score += 15
                valuation_reasons.append(
                    _reason(
                        f"P/E of {pe:.1f}x is below the sector median ({sector_pe_median:.1f}x) — reasonably valued.",
                        "green",
                    )
                )
            elif pe < sector_pe_median * 1.2:
                valuation_score += 10
                valuation_reasons.append(
                    _reason(
                        f"P/E of {pe:.1f}x is slightly above the sector median ({sector_pe_median:.1f}x) — fairly valued.",
                        "amber",
                    )
                )
            elif pe < sector_pe_median * 1.5:
                valuation_score += 6
                valuation_reasons.append(
                    _reason(
                        f"P/E of {pe:.1f}x is moderately above the sector median ({sector_pe_median:.1f}x) — slightly expensive.",
                        "amber",
                    )
                )
            else:
                valuation_score += 3
                valuation_reasons.append(
                    _reason(
                        f"P/E of {pe:.1f}x is well above the sector median ({sector_pe_median:.1f}x) — appears expensive.",
                        "red",
                    )
                )
        else:
            # No sector benchmark — use absolute thresholds
            if pe < 15:
                valuation_score += 18
                valuation_reasons.append(
                    _reason(f"P/E of {pe:.1f}x is very low — the stock looks undervalued.", "green")
                )
            elif pe < 25:
                valuation_score += 13
                valuation_reasons.append(
                    _reason(f"P/E of {pe:.1f}x is moderate — reasonably priced.", "green")
                )
            elif pe < 40:
                valuation_score += 8
                valuation_reasons.append(
                    _reason(f"P/E of {pe:.1f}x is on the higher side — investors are paying a growth premium.", "amber")
                )
            else:
                valuation_score += 3
                valuation_reasons.append(
                    _reason(f"P/E of {pe:.1f}x is very high — the stock is priced for perfection.", "red")
                )
    else:
        # No PE data
        valuation_score += 10
        valuation_reasons.append(
            _reason("P/E data is unavailable — neutral valuation score assigned.", "amber")
        )

    # PB ratio bonus/penalty
    if pb is not None and pb > 0:
        if pb < 1.0:
            valuation_score = min(20, valuation_score + 2)
            valuation_reasons.append(
                _reason(f"Price-to-Book of {pb:.2f}x is below 1 — the stock trades below book value.", "green")
            )
        elif pb > 5.0:
            valuation_score = max(0, valuation_score - 2)
            valuation_reasons.append(
                _reason(f"Price-to-Book of {pb:.2f}x is high — premium valuation relative to assets.", "red")
            )
        else:
            valuation_reasons.append(
                _reason(f"Price-to-Book of {pb:.2f}x is within a normal range.", "amber")
            )

    valuation_score = max(0, min(valuation_score, 20))

    # ------------------------------------------------------------------
    # 4. Quality score (max 15)
    # ------------------------------------------------------------------
    quality_score = 0
    quality_reasons: list[Reason] = []

    # ROE
    if roe is not None:
        roe_pct = roe * 100 if abs(roe) < 2 else roe  # normalise if stored as fraction
        if roe_pct > 20:
            quality_score += 8
            quality_reasons.append(
                _reason(
                    f"Return on Equity of {roe_pct:.1f}% is excellent — the company generates strong profits from shareholder money.",
                    "green",
                )
            )
        elif roe_pct >= 10:
            quality_score += 5
            quality_reasons.append(
                _reason(
                    f"Return on Equity of {roe_pct:.1f}% is decent — above-average profitability.",
                    "amber",
                )
            )
        else:
            quality_score += 2
            quality_reasons.append(
                _reason(
                    f"Return on Equity of {roe_pct:.1f}% is low — the company is not generating strong returns.",
                    "red",
                )
            )
    else:
        quality_reasons.append(_reason("ROE data unavailable — quality partially assessed.", "amber"))

    # Debt/Equity
    if de is not None and de >= 0:
        if de < 0.5:
            quality_score += 5
            quality_reasons.append(
                _reason(
                    f"Debt-to-Equity of {de:.2f} is very low — the company has a strong, low-debt balance sheet.",
                    "green",
                )
            )
        elif de <= 1.5:
            quality_score += 3
            quality_reasons.append(
                _reason(
                    f"Debt-to-Equity of {de:.2f} is moderate — manageable debt levels.",
                    "amber",
                )
            )
        else:
            quality_score += 1
            quality_reasons.append(
                _reason(
                    f"Debt-to-Equity of {de:.2f} is high — the company carries significant debt.",
                    "red",
                )
            )
    else:
        quality_reasons.append(
            _reason("Debt-to-Equity data unavailable.", "amber")
        )

    # Dividend yield bonus
    if div_yield is not None and div_yield > 0:
        dy_pct = div_yield * 100 if div_yield < 1 else div_yield
        if dy_pct > 1.0:
            quality_score = min(15, quality_score + 2)
            quality_reasons.append(
                _reason(
                    f"Dividend yield of {dy_pct:.2f}% — the stock pays a meaningful dividend.",
                    "green",
                )
            )

    quality_score = max(0, min(quality_score, 15))

    # ------------------------------------------------------------------
    # 5. Stability score (max 15)
    # ------------------------------------------------------------------
    stability_score = 0
    stability_reasons: list[Reason] = []

    # Annualised volatility
    if vol_ann < 0.20:
        stability_score += 8
        stability_reasons.append(
            _reason(
                f"Annualised volatility of {vol_ann*100:.1f}% is low — the stock has been relatively stable.",
                "green",
            )
        )
    elif vol_ann < 0.30:
        stability_score += 5
        stability_reasons.append(
            _reason(
                f"Annualised volatility of {vol_ann*100:.1f}% is moderate — some price swings to expect.",
                "amber",
            )
        )
    else:
        stability_score += 2
        stability_reasons.append(
            _reason(
                f"Annualised volatility of {vol_ann*100:.1f}% is high — the stock is quite volatile.",
                "red",
            )
        )

    # Max drawdown
    if mdd < 0.15:
        stability_score += 5
        stability_reasons.append(
            _reason(
                f"Maximum drawdown of {mdd*100:.1f}% is small — the stock has held its value well during downturns.",
                "green",
            )
        )
    elif mdd < 0.30:
        stability_score += 3
        stability_reasons.append(
            _reason(
                f"Maximum drawdown of {mdd*100:.1f}% is moderate — the stock has had notable pullbacks.",
                "amber",
            )
        )
    else:
        stability_score += 1
        stability_reasons.append(
            _reason(
                f"Maximum drawdown of {mdd*100:.1f}% is large — the stock has experienced severe falls in the past.",
                "red",
            )
        )

    # Beta
    if beta_val < 0.8:
        stability_score += 2
        stability_reasons.append(
            _reason(
                f"Beta of {beta_val:.2f} — the stock moves less than the broader market, adding stability.",
                "green",
            )
        )
    elif beta_val <= 1.3:
        stability_reasons.append(
            _reason(
                f"Beta of {beta_val:.2f} — the stock broadly tracks market movements.",
                "amber",
            )
        )
    else:
        stability_reasons.append(
            _reason(
                f"Beta of {beta_val:.2f} — the stock is more volatile than the market.",
                "red",
            )
        )

    stability_score = max(0, min(stability_score, 15))

    # ------------------------------------------------------------------
    # Total score
    # ------------------------------------------------------------------
    total = trend_score + momentum_score + valuation_score + quality_score + stability_score
    total = max(0, min(total, 100))

    # ------------------------------------------------------------------
    # Risk label
    # ------------------------------------------------------------------
    if vol_ann < 0.20 and mdd < 0.20 and beta_val < 0.8:
        risk_label = "Low"
    elif vol_ann > 0.30 or mdd > 0.35 or beta_val > 1.3:
        risk_label = "High"
    else:
        risk_label = "Medium"

    # ------------------------------------------------------------------
    # Verdict
    # ------------------------------------------------------------------
    if total >= 65:
        verdict = "Looks strong"
        verdict_color = "green"
    elif total >= 45:
        verdict = "Mixed signals"
        verdict_color = "amber"
    else:
        verdict = "Looks weak"
        verdict_color = "red"

    # ------------------------------------------------------------------
    # Patterns
    # ------------------------------------------------------------------
    detected = detect_patterns(prices, volumes)

    return {
        "total": total,
        "trend": {
            "score": trend_score,
            "max": 25,
            "reasons": trend_reasons,
        },
        "momentum": {
            "score": momentum_score,
            "max": 25,
            "reasons": momentum_reasons,
        },
        "valuation": {
            "score": valuation_score,
            "max": 20,
            "reasons": valuation_reasons,
        },
        "quality": {
            "score": quality_score,
            "max": 15,
            "reasons": quality_reasons,
        },
        "stability": {
            "score": stability_score,
            "max": 15,
            "reasons": stability_reasons,
        },
        "risk_label": risk_label,
        "patterns": detected,
        "verdict": verdict,
        "verdict_color": verdict_color,
    }
