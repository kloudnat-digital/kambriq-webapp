"""
FastAPI Application

Main FastAPI application entry point.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
async def health():
    """Health check endpoint."""
    return {"status": "healthy"}
