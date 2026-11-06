"""Niveshak AI — FastAPI application entry point.

Creates the app, registers routers, sets up lifespan (startup/shutdown),
CORS, global exception handling, and optional static file serving.
"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from app.cache.sqlite_cache import SQLiteCache
from app.config import settings
from app.data.equity_list import EquityList
from app.data.yfinance_provider import YFinanceProvider
from app.routers import stocks as stocks_router_module
from app.routers import screener as screener_router_module
from app.routers.screener import refresh_screener_cache, NIFTY50_SYMBOLS
from app.routers import stocks, screener, market, projection, portfolio

logger = logging.getLogger(__name__)

logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application lifespan: initialise resources on startup, clean up on shutdown."""
    logger.info("Starting %s …", settings.app_name)

    # Initialise shared singletons
    cache = SQLiteCache(db_path=settings.db_path)
    await cache.initialize()

    provider = YFinanceProvider()
    equity_list = EquityList(settings)

    # Try to refresh NSE equity list (falls back gracefully)
    try:
        await equity_list.maybe_refresh()
    except Exception as exc:
        logger.warning("Equity list refresh skipped: %s", exc)

    # Inject singletons into router modules
    stocks_router_module._cache = cache
    stocks_router_module._equity_list = equity_list
    stocks_router_module._provider = provider

    # Background screener pre-warm (fire-and-forget)
    import asyncio
    asyncio.create_task(refresh_screener_cache(provider, cache))

    # Periodic cache cleanup (every hour)
    async def _periodic_cleanup() -> None:
        while True:
            await asyncio.sleep(3600)
            try:
                await cache.cleanup()
            except Exception as exc:
                logger.warning("Cache cleanup error: %s", exc)

    asyncio.create_task(_periodic_cleanup())

    logger.info("%s is ready.", settings.app_name)
    yield

    logger.info("%s shutting down.", settings.app_name)


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------


def create_app() -> FastAPI:
    """Construct and configure the FastAPI application."""
    app = FastAPI(
        title="Niveshak AI API",
        description=(
            "Indian stock analyser for beginners — scores, projections, "
            "portfolio builder and market overview."
        ),
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # CORS — allow all origins for development
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Routers
    prefix = "/api/v1"
    app.include_router(stocks.router, prefix=prefix)
    app.include_router(screener.router, prefix=prefix)
    app.include_router(market.router, prefix=prefix)
    app.include_router(projection.router, prefix=prefix)
    app.include_router(portfolio.router, prefix=prefix)

    # Health check
    @app.get("/health", tags=["meta"])
    @app.get("/api/v1/health", tags=["meta"])
    async def health() -> dict:
        return {"status": "ok", "app": settings.app_name}

    # Serve frontend static files if available
    potential_dirs = [
        os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"),
        os.path.join(os.path.dirname(__file__), "..", "frontend_dist"),
        os.path.join(os.getcwd(), "frontend", "dist"),
        os.path.join(os.getcwd(), "frontend_dist"),
    ]
    frontend_dir = None
    for p in potential_dirs:
        norm = os.path.normpath(p)
        if os.path.isdir(norm) and os.path.isfile(os.path.join(norm, "index.html")):
            frontend_dir = norm
            break

    # Root endpoint
    @app.get("/", include_in_schema=False)
    async def root():
        if frontend_dir:
            return FileResponse(os.path.join(frontend_dir, "index.html"))
        return {"message": f"Welcome to {settings.app_name} API. Visit /docs for API docs."}

    # Global exception handler — never expose stack traces
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.error("Unhandled exception on %s: %s", request.url, exc, exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "error": "Internal server error",
                "detail": "An unexpected error occurred. Please try again later.",
            },
        )

    if frontend_dir:
        logger.info("Serving frontend static files from %s", frontend_dir)
        assets_dir = os.path.join(frontend_dir, "assets")
        if os.path.isdir(assets_dir):
            app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

        @app.get("/{full_path:path}", include_in_schema=False)
        async def serve_spa(full_path: str):
            if full_path.startswith("api/") or full_path in ("docs", "redoc", "openapi.json"):
                return JSONResponse(status_code=404, content={"detail": "Not Found"})
            file_path = os.path.join(frontend_dir, full_path)
            if os.path.isfile(file_path):
                return FileResponse(file_path)
            return FileResponse(os.path.join(frontend_dir, "index.html"))

    return app


app = create_app()
