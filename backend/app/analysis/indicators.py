"""Niveshak AI — technical indicator functions.

All functions operate on NumPy arrays and are fully vectorised.
NaN is used for positions where there is insufficient history.
"""

from __future__ import annotations

import numpy as np
import pandas as pd


# ---------------------------------------------------------------------------
# Moving averages
# ---------------------------------------------------------------------------


def sma(prices: np.ndarray, period: int) -> np.ndarray:
    """Simple moving average.

    Returns an array of the same length as *prices*. The first
    ``period - 1`` values are ``NaN``.

    Args:
        prices: 1-D array of closing prices.
        period: Look-back window size.

    Returns:
        1-D NumPy array with SMA values.
    """
    prices = np.asarray(prices, dtype=float)
    if len(prices) == 0 or period <= 0:
        return np.full_like(prices, np.nan, dtype=float)

    result = np.full(len(prices), np.nan, dtype=float)
    if period > len(prices):
        return result

    # Use cumulative sum trick for O(n) computation
    cumsum = np.nancumsum(prices)
    result[period - 1:] = (
        cumsum[period - 1:]
        - np.concatenate([[0], cumsum[: len(prices) - period]])
    ) / period
    return result


def ema(prices: np.ndarray, period: int) -> np.ndarray:
    """Exponential moving average.

    Seed value is the SMA of the first *period* observations. Returns NaN
    for indices before the first full window.

    Args:
        prices: 1-D array of closing prices.
        period: EMA span / look-back period.

    Returns:
        1-D NumPy array with EMA values.
    """
    prices = np.asarray(prices, dtype=float)
    n = len(prices)
    if n == 0 or period <= 0:
        return np.full(n, np.nan, dtype=float)

    result = np.full(n, np.nan, dtype=float)
    if period > n:
        return result

    alpha = 2.0 / (period + 1)
    # Seed with the SMA of the first window
    seed = np.nanmean(prices[: period])
    result[period - 1] = seed

    for i in range(period, n):
        prev = result[i - 1]
        cur = prices[i]
        if np.isnan(prev):
            result[i] = cur
        elif np.isnan(cur):
            result[i] = prev
        else:
            result[i] = alpha * cur + (1 - alpha) * prev

    return result


# ---------------------------------------------------------------------------
# Momentum
# ---------------------------------------------------------------------------


def rsi(prices: np.ndarray, period: int = 14) -> np.ndarray:
    """Relative Strength Index using Wilder smoothing (RMA).

    Returns an array of the same length as *prices*. Values at positions
    before sufficient history is available are ``NaN``.

    Args:
        prices: 1-D array of closing prices.
        period: RSI look-back period (default 14).

    Returns:
        1-D NumPy array with RSI values in [0, 100].
    """
    prices = np.asarray(prices, dtype=float)
    n = len(prices)
    if n < period + 1:
        return np.full(n, np.nan, dtype=float)

    result = np.full(n, np.nan, dtype=float)
    deltas = np.diff(prices)  # length n-1

    gains = np.where(deltas > 0, deltas, 0.0)
    losses = np.where(deltas < 0, -deltas, 0.0)

    # Initial averages (SMA seed for Wilder's smoothing)
    avg_gain = np.mean(gains[:period])
    avg_loss = np.mean(losses[:period])

    # First RSI value at index period
    if avg_loss == 0:
        result[period] = 100.0
    else:
        rs = avg_gain / avg_loss
        result[period] = 100.0 - (100.0 / (1.0 + rs))

    # Wilder's smoothing for the rest
    for i in range(period + 1, n):
        avg_gain = (avg_gain * (period - 1) + gains[i - 1]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i - 1]) / period
        if avg_loss == 0:
            result[i] = 100.0
        else:
            rs = avg_gain / avg_loss
            result[i] = 100.0 - (100.0 / (1.0 + rs))

    return result


def macd(
    prices: np.ndarray,
    fast: int = 12,
    slow: int = 26,
    signal: int = 9,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """MACD — Moving Average Convergence/Divergence.

    Args:
        prices: 1-D array of closing prices.
        fast: Fast EMA period (default 12).
        slow: Slow EMA period (default 26).
        signal: Signal line EMA period (default 9).

    Returns:
        Tuple of (macd_line, signal_line, histogram), each a 1-D array of
        the same length as *prices*.
    """
    prices = np.asarray(prices, dtype=float)
    fast_ema = ema(prices, fast)
    slow_ema = ema(prices, slow)
    macd_line = fast_ema - slow_ema
    signal_line = ema(macd_line, signal)
    histogram = macd_line - signal_line
    return macd_line, signal_line, histogram


def bollinger_bands(
    prices: np.ndarray,
    period: int = 20,
    std_dev: float = 2.0,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Bollinger Bands.

    Args:
        prices: 1-D array of closing prices.
        period: Rolling window period (default 20).
        std_dev: Number of standard deviations for band width (default 2.0).

    Returns:
        Tuple of (upper_band, middle_band, lower_band).
    """
    prices = np.asarray(prices, dtype=float)
    n = len(prices)
    upper = np.full(n, np.nan, dtype=float)
    middle = np.full(n, np.nan, dtype=float)
    lower = np.full(n, np.nan, dtype=float)

    if n < period:
        return upper, middle, lower

    for i in range(period - 1, n):
        window = prices[i - period + 1: i + 1]
        m = np.nanmean(window)
        s = np.nanstd(window, ddof=0)
        middle[i] = m
        upper[i] = m + std_dev * s
        lower[i] = m - std_dev * s

    return upper, middle, lower


# ---------------------------------------------------------------------------
# Volume & drawdown
# ---------------------------------------------------------------------------


def volume_trend(volumes: np.ndarray, period: int = 20) -> float:
    """Ratio of recent average volume to longer-term average volume.

    A value > 1 indicates increasing volume relative to history.

    Args:
        volumes: 1-D array of daily volumes.
        period: Short-term window; long-term window is 3× this.

    Returns:
        Ratio (float). Returns 1.0 if data is insufficient.
    """
    volumes = np.asarray(volumes, dtype=float)
    long_period = period * 3
    if len(volumes) < long_period:
        return 1.0

    recent_avg = np.nanmean(volumes[-period:])
    long_avg = np.nanmean(volumes[-long_period:])
    if long_avg == 0:
        return 1.0
    return float(recent_avg / long_avg)


def max_drawdown(prices: np.ndarray) -> float:
    """Maximum peak-to-trough drawdown over the full price history.

    Args:
        prices: 1-D array of prices (typically closing prices).

    Returns:
        Drawdown as a **positive** fraction, e.g. ``0.30`` for a 30%
        drawdown. Returns ``0.0`` if data is insufficient.
    """
    prices = np.asarray(prices, dtype=float)
    prices = prices[~np.isnan(prices)]
    if len(prices) < 2:
        return 0.0

    running_max = np.maximum.accumulate(prices)
    # Avoid division by zero
    safe_max = np.where(running_max == 0, 1e-10, running_max)
    drawdowns = (running_max - prices) / safe_max
    return float(np.nanmax(drawdowns))


# ---------------------------------------------------------------------------
# Risk metrics
# ---------------------------------------------------------------------------


def annualised_volatility(
    prices: np.ndarray, trading_days: int = 252
) -> float:
    """Annualised volatility computed from daily log returns.

    Args:
        prices: 1-D array of closing prices.
        trading_days: Number of trading days per year (default 252).

    Returns:
        Annualised volatility as a fraction (e.g. ``0.25`` = 25%).
        Returns ``0.0`` for constant or empty price series.
    """
    prices = np.asarray(prices, dtype=float)
    prices = prices[~np.isnan(prices)]
    if len(prices) < 2:
        return 0.0

    log_returns = np.diff(np.log(np.where(prices > 0, prices, np.nan)))
    log_returns = log_returns[~np.isnan(log_returns)]
    if len(log_returns) == 0:
        return 0.0

    return float(np.nanstd(log_returns, ddof=1) * np.sqrt(trading_days))


def beta(
    stock_prices: np.ndarray,
    market_prices: np.ndarray,
    trading_days: int = 252,
) -> float:
    """Market beta (sensitivity of stock returns vs. benchmark).

    Args:
        stock_prices: 1-D array of stock closing prices.
        market_prices: 1-D array of benchmark (Nifty 50) closing prices.
        trading_days: Unused; kept for API symmetry.

    Returns:
        Beta coefficient. Returns ``1.0`` if computation is not possible.
    """
    stock_prices = np.asarray(stock_prices, dtype=float)
    market_prices = np.asarray(market_prices, dtype=float)

    min_len = min(len(stock_prices), len(market_prices))
    if min_len < 2:
        return 1.0

    stock_prices = stock_prices[-min_len:]
    market_prices = market_prices[-min_len:]

    stock_ret = np.diff(np.log(np.where(stock_prices > 0, stock_prices, np.nan)))
    mkt_ret = np.diff(np.log(np.where(market_prices > 0, market_prices, np.nan)))

    # Remove pairs where either series is NaN
    valid = ~(np.isnan(stock_ret) | np.isnan(mkt_ret))
    stock_ret = stock_ret[valid]
    mkt_ret = mkt_ret[valid]

    if len(mkt_ret) < 2:
        return 1.0

    mkt_var = np.var(mkt_ret, ddof=1)
    if mkt_var == 0:
        return 1.0

    cov = np.cov(stock_ret, mkt_ret, ddof=1)[0, 1]
    return float(cov / mkt_var)


def relative_strength(
    stock_prices: np.ndarray,
    market_prices: np.ndarray,
    period: int = 252,
) -> float:
    """Relative strength of stock vs. market over *period* trading days.

    Args:
        stock_prices: 1-D array of stock closing prices.
        market_prices: 1-D array of benchmark closing prices.
        period: Look-back in trading days (default 252 = 1 year).

    Returns:
        Ratio of stock return to market return. >1 means outperforming.
        Returns ``1.0`` if data is insufficient.
    """
    stock_prices = np.asarray(stock_prices, dtype=float)
    market_prices = np.asarray(market_prices, dtype=float)

    n = min(len(stock_prices), len(market_prices), period + 1)
    if n < 2:
        return 1.0

    s = stock_prices[-n:]
    m = market_prices[-n:]

    # Filter NaN
    s = s[~np.isnan(s)]
    m = m[~np.isnan(m)]

    if len(s) < 2 or len(m) < 2 or s[0] == 0 or m[0] == 0:
        return 1.0

    stock_ret = (s[-1] - s[0]) / s[0]
    mkt_ret = (m[-1] - m[0]) / m[0]

    if mkt_ret == 0:
        return 1.0
    return float((1 + stock_ret) / (1 + mkt_ret))


# ---------------------------------------------------------------------------
# Returns
# ---------------------------------------------------------------------------


def returns(prices: np.ndarray) -> dict[str, float]:
    """Compute period returns from daily price history.

    Uses last N trading days:
    - ``1m`` = 21 days (simple return)
    - ``6m`` = 126 days (simple return)
    - ``1y`` = 252 days (simple return, annualised)
    - ``3y`` = 756 days (annualised CAGR)

    Args:
        prices: 1-D array of closing prices.

    Returns:
        Dict with keys ``'1m'``, ``'6m'``, ``'1y'``, ``'3y'``.
        Missing periods return ``0.0``.
    """
    prices = np.asarray(prices, dtype=float)
    prices = prices[~np.isnan(prices)]
    n = len(prices)

    def _ret(lookback: int, annualise: bool = False, years: float = 1.0) -> float:
        if n < lookback + 1:
            return 0.0
        start = prices[-(lookback + 1)]
        end = prices[-1]
        if start <= 0:
            return 0.0
        raw = (end - start) / start
        if annualise and years > 0:
            # CAGR
            return float((1 + raw) ** (1.0 / years) - 1)
        return float(raw)

    return {
        "1m": _ret(21),
        "6m": _ret(126),
        "1y": _ret(252, annualise=True, years=1.0),
        "3y": _ret(756, annualise=True, years=3.0),
    }


# ---------------------------------------------------------------------------
# Pattern detection
# ---------------------------------------------------------------------------


def detect_patterns(
    prices: np.ndarray, volumes: np.ndarray
) -> list[dict]:
    """Detect common technical patterns from price and volume data.

    Detected patterns:
    - ``golden_cross``: SMA50 crossed above SMA200 recently
    - ``death_cross``: SMA50 crossed below SMA200 recently
    - ``near_52w_high``: Price within 5% of 52-week high
    - ``near_52w_low``: Price within 5% of 52-week low
    - ``high_volume_move``: Recent price move with above-average volume
    - ``overbought``: RSI > 70
    - ``oversold``: RSI < 30

    Args:
        prices: 1-D array of closing prices.
        volumes: 1-D array of daily volumes.

    Returns:
        List of dicts with keys ``pattern``, ``description``,
        and ``severity`` (``"positive"`` | ``"neutral"`` | ``"negative"``).
    """
    prices = np.asarray(prices, dtype=float)
    volumes = np.asarray(volumes, dtype=float)
    n = len(prices)
    patterns: list[dict] = []

    if n < 2:
        return patterns

    # --- Golden / Death Cross ---
    if n >= 200:
        sma50 = sma(prices, 50)
        sma200 = sma(prices, 200)
        # Check last 5 trading days for a recent cross
        look = min(5, n - 200)
        for i in range(n - look, n):
            if i < 1:
                continue
            if (
                not np.isnan(sma50[i])
                and not np.isnan(sma200[i])
                and not np.isnan(sma50[i - 1])
                and not np.isnan(sma200[i - 1])
            ):
                if sma50[i] > sma200[i] and sma50[i - 1] <= sma200[i - 1]:
                    patterns.append(
                        {
                            "pattern": "golden_cross",
                            "description": (
                                "Golden Cross: the 50-day moving average has just "
                                "crossed above the 200-day — a classic bullish signal."
                            ),
                            "severity": "positive",
                        }
                    )
                    break
                elif sma50[i] < sma200[i] and sma50[i - 1] >= sma200[i - 1]:
                    patterns.append(
                        {
                            "pattern": "death_cross",
                            "description": (
                                "Death Cross: the 50-day moving average has just "
                                "crossed below the 200-day — a bearish warning sign."
                            ),
                            "severity": "negative",
                        }
                    )
                    break

    # --- Near 52-week high/low ---
    period_252 = min(252, n)
    recent = prices[-period_252:]
    recent_valid = recent[~np.isnan(recent)]
    if len(recent_valid) > 0:
        high_52 = np.nanmax(recent_valid)
        low_52 = np.nanmin(recent_valid)
        cur = prices[-1]

        if not np.isnan(cur) and high_52 > 0:
            if cur >= high_52 * 0.95:
                patterns.append(
                    {
                        "pattern": "near_52w_high",
                        "description": (
                            "The stock is trading within 5% of its 52-week high — "
                            "showing strong upward momentum."
                        ),
                        "severity": "positive",
                    }
                )
            if low_52 > 0 and cur <= low_52 * 1.05:
                patterns.append(
                    {
                        "pattern": "near_52w_low",
                        "description": (
                            "The stock is trading within 5% of its 52-week low — "
                            "it may be in a prolonged downtrend."
                        ),
                        "severity": "negative",
                    }
                )

    # --- High volume move ---
    vol_len = min(len(volumes), n)
    if vol_len >= 20 and not np.isnan(prices[-1]) and not np.isnan(prices[-2]):
        avg_vol = np.nanmean(volumes[-20:])
        last_vol = volumes[-1]
        price_move = abs(prices[-1] - prices[-2]) / max(prices[-2], 1e-10)

        if last_vol > avg_vol * 1.5 and price_move > 0.02:
            direction = "upward" if prices[-1] > prices[-2] else "downward"
            patterns.append(
                {
                    "pattern": "high_volume_move",
                    "description": (
                        f"Yesterday's {direction} move was accompanied by unusually "
                        "high trading volume — suggesting strong conviction."
                    ),
                    "severity": "positive" if direction == "upward" else "negative",
                }
            )

    # --- RSI overbought / oversold ---
    if n >= 15:
        rsi_arr = rsi(prices, 14)
        last_rsi = rsi_arr[-1]
        if not np.isnan(last_rsi):
            if last_rsi > 70:
                patterns.append(
                    {
                        "pattern": "overbought",
                        "description": (
                            f"RSI is {last_rsi:.1f} — above 70 suggests the stock "
                            "may be overbought and due for a pullback."
                        ),
                        "severity": "negative",
                    }
                )
            elif last_rsi < 30:
                patterns.append(
                    {
                        "pattern": "oversold",
                        "description": (
                            f"RSI is {last_rsi:.1f} — below 30 suggests the stock "
                            "may be oversold and could bounce."
                        ),
                        "severity": "positive",
                    }
                )

    return patterns
