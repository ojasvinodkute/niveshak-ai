"""Niveshak AI — NSE equity list loader.

Handles downloading, caching, and searching the NSE EQUITY_L.csv file.
Falls back to a bundled CSV when the download is unavailable.
"""

from __future__ import annotations

import asyncio
import csv
import io
import logging
import os
from pathlib import Path
from typing import TYPE_CHECKING, Optional

import httpx
import pandas as pd

if TYPE_CHECKING:
    from app.config import Settings

logger = logging.getLogger(__name__)

# Columns we care about in the NSE CSV
_REQUIRED_COLS = {"SYMBOL", "NAME OF COMPANY", "SERIES"}

# Local paths (relative to the backend working directory)
_CACHED_CSV = Path("data/nse_equity_list.csv")
_FALLBACK_CSV = Path("data/nse_equity_fallback.csv")


class EquityList:
    """Manages the NSE equity master list.

    Usage::

        eq = EquityList(settings)
        await eq.refresh()           # download / reload
        results = eq.search("reliance")
    """

    def __init__(self, settings: "Settings") -> None:
        self._settings = settings
        self._df: pd.DataFrame = pd.DataFrame(
            columns=["SYMBOL", "NAME OF COMPANY", "SERIES"]
        )
        self._load_local()

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _load_local(self) -> None:
        """Load from the local cached CSV, then fall back to bundled CSV."""
        for path in (_CACHED_CSV, _FALLBACK_CSV):
            if path.exists():
                try:
                    df = pd.read_csv(path, dtype=str)
                    df.columns = [c.strip() for c in df.columns]
                    missing = _REQUIRED_COLS - set(df.columns)
                    if missing:
                        logger.warning(
                            "CSV %s is missing columns: %s — skipping", path, missing
                        )
                        continue
                    df = df[df["SERIES"].str.strip() == "EQ"].copy()
                    df["SYMBOL"] = df["SYMBOL"].str.strip().str.upper()
                    df["NAME OF COMPANY"] = df["NAME OF COMPANY"].str.strip()
                    self._df = df.reset_index(drop=True)
                    logger.info(
                        "Loaded %d equities from %s", len(self._df), path
                    )
                    return
                except Exception as exc:
                    logger.warning("Failed to read %s: %s", path, exc)

        logger.warning(
            "No local equity CSV found. Search will return empty results until refresh()."
        )

    def _parse_csv_bytes(self, raw: bytes) -> pd.DataFrame:
        """Parse raw NSE EQUITY_L.csv bytes into a cleaned DataFrame."""
        # NSE sometimes uses Windows-1252 encoding
        for encoding in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
            try:
                text = raw.decode(encoding)
                break
            except UnicodeDecodeError:
                continue
        else:
            text = raw.decode("latin-1", errors="replace")

        df = pd.read_csv(io.StringIO(text), dtype=str)
        df.columns = [c.strip() for c in df.columns]

        missing = _REQUIRED_COLS - set(df.columns)
        if missing:
            raise ValueError(f"Downloaded CSV missing columns: {missing}")

        df = df[df["SERIES"].str.strip() == "EQ"].copy()
        df["SYMBOL"] = df["SYMBOL"].str.strip().str.upper()
        df["NAME OF COMPANY"] = df["NAME OF COMPANY"].str.strip()
        return df.reset_index(drop=True)

    # ------------------------------------------------------------------
    # Public async API
    # ------------------------------------------------------------------

    async def refresh(self) -> None:
        """Download the NSE equity list and update the local cache.

        Falls back to the bundled fallback CSV if the download fails.
        """
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.get(
                    self._settings.nse_equity_csv_url,
                    headers={
                        "User-Agent": (
                            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                            "AppleWebKit/537.36 (KHTML, like Gecko) "
                            "Chrome/120.0.0.0 Safari/537.36"
                        ),
                        "Referer": "https://www.nseindia.com/",
                        "Accept-Language": "en-US,en;q=0.9",
                    },
                    follow_redirects=True,
                )
                resp.raise_for_status()
                df = self._parse_csv_bytes(resp.content)

            _CACHED_CSV.parent.mkdir(parents=True, exist_ok=True)
            df.to_csv(_CACHED_CSV, index=False)
            self._df = df
            logger.info(
                "NSE equity list refreshed: %d EQ symbols saved to %s",
                len(df),
                _CACHED_CSV,
            )
        except Exception as exc:
            logger.warning(
                "NSE equity list download failed (%s). Using local/fallback data.", exc
            )
            # Reload from whatever is available locally
            self._load_local()

    async def maybe_refresh(self) -> None:
        """Refresh only if the cached file is older than ``equity_refresh_days``."""
        if _CACHED_CSV.exists():
            age_days = (
                pd.Timestamp.now().timestamp() - _CACHED_CSV.stat().st_mtime
            ) / 86400
            if age_days < self._settings.equity_refresh_days:
                return
        await self.refresh()

    # ------------------------------------------------------------------
    # Synchronous search/lookup helpers
    # ------------------------------------------------------------------

    def search(self, query: str, limit: int = 20) -> list[dict]:
        """Case-insensitive substring search on SYMBOL and NAME OF COMPANY.

        Args:
            query: Search string.
            limit: Maximum number of results.

        Returns:
            List of dicts with keys ``symbol``, ``name``, ``series``.
        """
        if self._df.empty or not query:
            return []

        q = query.strip().upper()
        mask = self._df["SYMBOL"].str.contains(q, na=False) | self._df[
            "NAME OF COMPANY"
        ].str.upper().str.contains(q, na=False)
        subset = self._df[mask].head(limit)
        return [
            {
                "symbol": row["SYMBOL"],
                "name": row["NAME OF COMPANY"],
                "series": row.get("SERIES", "EQ"),
            }
            for _, row in subset.iterrows()
        ]

    def get_all_symbols(self) -> list[str]:
        """Return all NSE EQ symbols."""
        if self._df.empty:
            return []
        return self._df["SYMBOL"].tolist()

    def get(self, symbol: str) -> Optional[dict]:
        """Look up a single symbol.

        Args:
            symbol: NSE ticker (case-insensitive).

        Returns:
            Dict with ``symbol``, ``name``, ``series`` or ``None`` if not found.
        """
        if self._df.empty:
            return None
        sym = symbol.strip().upper()
        row = self._df[self._df["SYMBOL"] == sym]
        if row.empty:
            return None
        r = row.iloc[0]
        return {
            "symbol": r["SYMBOL"],
            "name": r["NAME OF COMPANY"],
            "series": r.get("SERIES", "EQ"),
        }

    def __len__(self) -> int:
        return len(self._df)
