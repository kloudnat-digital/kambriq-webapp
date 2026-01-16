"""
FastAPI Application

Main FastAPI application entry point.
"""

from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.presentation.dependencies import get_db_session
from src.presentation.routers import auth

app = FastAPI(
    title="KAMBRIQ API",
    description="KAMBRIQ Authentication API with DDD architecture",
    version="0.1.0",
    docs_url="/api/v1/docs",
    redoc_url="/api/v1/redoc",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers with API version prefix
app.include_router(auth.router, prefix="/api/v1")


@app.get("/", tags=["health"])
async def root():
    """Health check endpoint."""
    return {"message": "KAMBRIQ API is running", "version": "0.1.0"}


@app.get("/health", tags=["health"])
async def health(db: Annotated[AsyncSession, Depends(get_db_session)]):
    """
    Health check endpoint.

    Verifies:
    - API is running
    - Database connection is accessible
    """
    try:
        # Test database connection
        result = await db.execute(text("SELECT 1"))
        result.scalar()

        return {"status": "healthy", "api": "ok", "database": "ok"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"Service unhealthy: {e!s}"
        ) from e
