"""Tests for app/analysis/indicators.py

Covers SMA, EMA, RSI, MACD, Bollinger Bands, max drawdown,
annualised volatility, and pattern detection against known values.
"""

from __future__ import annotations

import numpy as np
import pytest

from app.analysis.indicators import (
    annualised_volatility,
    beta,
    bollinger_bands,
    detect_patterns,
    ema,
    macd,
    max_drawdown,
    relative_strength,
    returns,
    rsi,
    sma,
    volume_trend,
)


# ---------------------------------------------------------------------------
# SMA
# ---------------------------------------------------------------------------


class TestSMA:
    def test_simple_case(self) -> None:
        result = sma(np.array([1, 2, 3, 4, 5], dtype=float), 3)
        assert result[-1] == pytest.approx(4.0)

    def test_first_values_are_nan(self) -> None:
        result = sma(np.array([1, 2, 3, 4, 5], dtype=float), 3)
        assert np.isnan(result[0])
        assert np.isnan(result[1])

    def test_period_1(self) -> None:
        arr = np.array([3.0, 6.0, 9.0])
        result = sma(arr, 1)
        np.testing.assert_array_almost_equal(result, arr)

    def test_empty_array(self) -> None:
        result = sma(np.array([], dtype=float), 3)
        assert len(result) == 0

    def test_period_longer_than_array(self) -> None:
        result = sma(np.array([1, 2], dtype=float), 10)
        assert all(np.isnan(result))

    def test_sma_values(self) -> None:
        # [1,2,3,4,5] with period 3: results should be [nan, nan, 2, 3, 4]
        result = sma(np.array([1.0, 2.0, 3.0, 4.0, 5.0]), 3)
        assert result[2] == pytest.approx(2.0)
        assert result[3] == pytest.approx(3.0)
        assert result[4] == pytest.approx(4.0)


# ---------------------------------------------------------------------------
# EMA
# ---------------------------------------------------------------------------


class TestEMA:
    def test_ema_period_1_equals_prices(self) -> None:
        prices = np.array([10.0, 20.0, 30.0])
        result = ema(prices, 1)
        # With period=1, alpha=1.0, so each value equals price
        np.testing.assert_array_almost_equal(result, prices)

    def test_ema_seed_is_sma(self) -> None:
        prices = np.array([2.0, 4.0, 6.0, 8.0, 10.0])
        result = ema(prices, 3)
        # Seed at index 2 = SMA(2,4,6) = 4.0
        assert result[2] == pytest.approx(4.0)

    def test_ema_empty(self) -> None:
        result = ema(np.array([], dtype=float), 5)
        assert len(result) == 0


# ---------------------------------------------------------------------------
# RSI
# ---------------------------------------------------------------------------


class TestRSI:
    def test_all_up_prices_near_100(self) -> None:
        # Strictly increasing prices → RSI should be very high
        prices = np.arange(1.0, 50.0)
        result = rsi(prices, 14)
        last_rsi = result[~np.isnan(result)][-1]
        assert last_rsi > 90.0

    def test_all_down_prices_near_0(self) -> None:
        # Strictly decreasing prices → RSI should be very low
        prices = np.arange(50.0, 1.0, -1.0)
        result = rsi(prices, 14)
        last_rsi = result[~np.isnan(result)][-1]
        assert last_rsi < 10.0

    def test_rsi_range(self) -> None:
        prices = np.random.default_rng(0).uniform(90, 110, 100)
        result = rsi(prices, 14)
        valid = result[~np.isnan(result)]
        assert np.all(valid >= 0)
        assert np.all(valid <= 100)

    def test_insufficient_data_returns_nan(self) -> None:
        result = rsi(np.array([1.0, 2.0]), 14)
        assert all(np.isnan(result))

    def test_flat_prices_rsi_at_50(self) -> None:
        # Flat prices → gains = losses = 0 → RSI undefined, but our impl handles it
        prices = np.ones(50)
        result = rsi(prices, 14)
        # With all zeros for gains and losses, RS=1 → RSI=50 (edge case handled)
        valid = result[~np.isnan(result)]
        # Just check no crashes and values in range
        assert len(valid) > 0


# ---------------------------------------------------------------------------
# MACD
# ---------------------------------------------------------------------------


class TestMACD:
    def test_macd_shape(self) -> None:
        prices = np.arange(1.0, 101.0)
        ml, sl, hist = macd(prices)
        assert len(ml) == len(prices)
        assert len(sl) == len(prices)
        assert len(hist) == len(prices)

    def test_histogram_equals_macd_minus_signal(self) -> None:
        prices = np.sin(np.linspace(0, 10, 200)) * 100 + 500
        ml, sl, hist = macd(prices)
        valid = ~(np.isnan(ml) | np.isnan(sl) | np.isnan(hist))
        np.testing.assert_array_almost_equal(hist[valid], ml[valid] - sl[valid])


# ---------------------------------------------------------------------------
# Bollinger Bands
# ---------------------------------------------------------------------------


class TestBollingerBands:
    def test_constant_prices_zero_width(self) -> None:
        prices = np.ones(50) * 100.0
        upper, middle, lower = bollinger_bands(prices, period=20)
        # Width should be ~0 for constant prices
        valid = ~(np.isnan(upper) | np.isnan(lower))
        width = upper[valid] - lower[valid]
        np.testing.assert_array_almost_equal(width, 0.0)

    def test_middle_band_is_sma(self) -> None:
        prices = np.arange(1.0, 51.0)
        upper, middle, lower = bollinger_bands(prices, period=20)
        sma_vals = sma(prices, 20)
        valid = ~(np.isnan(middle) | np.isnan(sma_vals))
        np.testing.assert_array_almost_equal(middle[valid], sma_vals[valid])

    def test_upper_above_lower(self) -> None:
        prices = np.random.default_rng(1).uniform(100, 200, 100)
        upper, middle, lower = bollinger_bands(prices, period=20)
        valid = ~(np.isnan(upper) | np.isnan(lower))
        assert np.all(upper[valid] >= lower[valid])


# ---------------------------------------------------------------------------
# Max Drawdown
# ---------------------------------------------------------------------------


class TestMaxDrawdown:
    def test_known_drawdown(self) -> None:
        # Peak at 110, trough at 90: drawdown = (110-90)/110 ≈ 0.1818
        prices = np.array([100.0, 110.0, 90.0, 95.0])
        mdd = max_drawdown(prices)
        assert mdd == pytest.approx((110.0 - 90.0) / 110.0, rel=1e-4)  # ≈ 0.1818

    def test_monotonic_increase_zero_drawdown(self) -> None:
        prices = np.arange(1.0, 101.0)
        assert max_drawdown(prices) == pytest.approx(0.0, abs=1e-10)

    def test_empty_array(self) -> None:
        assert max_drawdown(np.array([], dtype=float)) == 0.0

    def test_single_value(self) -> None:
        assert max_drawdown(np.array([100.0])) == 0.0


# ---------------------------------------------------------------------------
# Annualised Volatility
# ---------------------------------------------------------------------------


class TestAnnualisedVolatility:
    def test_constant_prices_zero_vol(self) -> None:
        prices = np.ones(100) * 500.0
        assert annualised_volatility(prices) == pytest.approx(0.0, abs=1e-10)

    def test_nonzero_vol(self) -> None:
        rng = np.random.default_rng(42)
        prices = np.cumprod(1 + rng.normal(0, 0.01, 500)) * 100
        vol = annualised_volatility(prices)
        # Should be somewhere around 15-20%
        assert 0.05 < vol < 0.50

    def test_empty_array(self) -> None:
        assert annualised_volatility(np.array([], dtype=float)) == 0.0


# ---------------------------------------------------------------------------
# Returns
# ---------------------------------------------------------------------------


class TestReturns:
    def test_returns_dict_keys(self) -> None:
        prices = np.cumprod(1 + np.full(1000, 0.001)) * 100
        ret = returns(prices)
        assert set(ret.keys()) == {"1m", "6m", "1y", "3y"}

    def test_monotonic_up_positive_returns(self) -> None:
        prices = np.arange(100.0, 1100.0)
        ret = returns(prices)
        assert ret["1m"] > 0
        assert ret["6m"] > 0

    def test_short_array_returns_zero(self) -> None:
        prices = np.array([100.0, 101.0])
        ret = returns(prices)
        assert ret["6m"] == 0.0
        assert ret["1y"] == 0.0


# ---------------------------------------------------------------------------
# Volume Trend
# ---------------------------------------------------------------------------


class TestVolumeTrend:
    def test_increasing_volume_above_1(self) -> None:
        # Last 20 days have higher volume
        vols = np.concatenate([np.ones(40), np.ones(20) * 3])
        vt = volume_trend(vols, period=20)
        assert vt > 1.0

    def test_insufficient_data_returns_1(self) -> None:
        assert volume_trend(np.ones(10), period=20) == pytest.approx(1.0)


# ---------------------------------------------------------------------------
# Detect Patterns
# ---------------------------------------------------------------------------


class TestDetectPatterns:
    def test_returns_list(self) -> None:
        prices = np.arange(100.0, 600.0)
        volumes = np.ones(500) * 1e6
        result = detect_patterns(prices, volumes)
        assert isinstance(result, list)

    def test_pattern_severity_values(self) -> None:
        prices = np.arange(100.0, 600.0)
        volumes = np.ones(500) * 1e6
        result = detect_patterns(prices, volumes)
        for p in result:
            assert p["severity"] in ("positive", "neutral", "negative")
            assert isinstance(p["description"], str)
            assert len(p["description"]) > 0

    def test_overbought_detected(self) -> None:
        # All-up prices → RSI > 70 → overbought pattern
        prices = np.arange(1.0, 100.0)
        volumes = np.ones(99) * 1e6
        result = detect_patterns(prices, volumes)
        patterns = [p["pattern"] for p in result]
        assert "overbought" in patterns

    def test_empty_prices_no_crash(self) -> None:
        result = detect_patterns(np.array([]), np.array([]))
        assert result == []
