"""Niveshak AI — SQLite-backed async cache.

Uses stdlib ``sqlite3`` with ``asyncio.to_thread`` so the event loop is
never blocked by disk I/O.
"""

from __future__ import annotations

import asyncio
import logging
import sqlite3
import time
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

_CREATE_TABLE = """
CREATE TABLE IF NOT EXISTS cache (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    expires_at REAL NOT NULL
);
"""

_CREATE_INDEX = """
CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache (expires_at);
"""


class SQLiteCache:
    """Lightweight async key-value cache backed by SQLite.

    All blocking DB operations run in a thread pool via ``asyncio.to_thread``.

    Args:
        db_path: Filesystem path for the SQLite database file.
    """

    def __init__(self, db_path: str = "data/cache.db") -> None:
        self._db_path = db_path

    # ------------------------------------------------------------------
    # Private synchronous helpers
    # ------------------------------------------------------------------

    def _connect(self) -> sqlite3.Connection:
        Path(self._db_path).parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(self._db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_sync(self) -> None:
        with self._connect() as conn:
            conn.execute(_CREATE_TABLE)
            conn.execute(_CREATE_INDEX)
            conn.commit()

    def _get_sync(self, key: str) -> Optional[str]:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT value, expires_at FROM cache WHERE key = ?", (key,)
            ).fetchone()
            if row is None:
                return None
            if time.time() > row["expires_at"]:
                conn.execute("DELETE FROM cache WHERE key = ?", (key,))
                conn.commit()
                return None
            return row["value"]

    def _set_sync(self, key: str, value: str, ttl: int) -> None:
        expires_at = time.time() + ttl
        with self._connect() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO cache (key, value, expires_at) VALUES (?, ?, ?)",
                (key, value, expires_at),
            )
            conn.commit()

    def _delete_sync(self, key: str) -> None:
        with self._connect() as conn:
            conn.execute("DELETE FROM cache WHERE key = ?", (key,))
            conn.commit()

    def _cleanup_sync(self) -> int:
        with self._connect() as conn:
            cur = conn.execute(
                "DELETE FROM cache WHERE expires_at < ?", (time.time(),)
            )
            conn.commit()
            return cur.rowcount

    # ------------------------------------------------------------------
    # Public async API
    # ------------------------------------------------------------------

    async def initialize(self) -> None:
        """Create the cache table if it doesn't exist."""
        await asyncio.to_thread(self._init_sync)
        logger.info("SQLiteCache initialised at %s", self._db_path)

    async def get(self, key: str) -> Optional[str]:
        """Return the cached value for *key*, or ``None`` if missing/expired.

        Args:
            key: Cache key string.

        Returns:
            Cached string value or ``None``.
        """
        return await asyncio.to_thread(self._get_sync, key)

    async def set(self, key: str, value: str, ttl: int) -> None:
        """Store *value* under *key* with a time-to-live of *ttl* seconds.

        Args:
            key: Cache key string.
            value: Serialised string value (e.g. JSON).
            ttl: Seconds until expiry.
        """
        await asyncio.to_thread(self._set_sync, key, value, ttl)

    async def delete(self, key: str) -> None:
        """Remove *key* from the cache.

        Args:
            key: Cache key string.
        """
        await asyncio.to_thread(self._delete_sync, key)

    async def cleanup(self) -> int:
        """Delete all expired cache entries.

        Returns:
            Number of rows deleted.
        """
        deleted = await asyncio.to_thread(self._cleanup_sync)
        logger.debug("Cache cleanup: removed %d expired entries", deleted)
        return deleted
