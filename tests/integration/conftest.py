"""
Fixtures for integration tests

Database setup and session management for tests.
Uses PostgreSQL from docker-compose for all tests.
"""

import os

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.infrastructure.database.base import Base

# Use PostgreSQL from docker-compose for all tests
TEST_DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql+asyncpg://postgres:postgres@postgres:5432/kambriq_db"
)


@pytest.fixture(scope="session")
async def test_engine():
    """
    Create test database engine.
    Creates all tables before tests.
    Note: For PostgreSQL, we don't drop tables after tests to allow data persistence for E2E tests.
    """
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)

    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    # Don't drop tables for PostgreSQL - let data persist for E2E tests
    # async with engine.begin() as conn:
    #     await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest.fixture()
async def test_session(test_engine):
    """
    Create a test database session.
    Commits after each test (no rollback for E2E tests with PostgreSQL).
    """
    async_session = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        yield session
        # Don't rollback for PostgreSQL - let data persist for E2E tests
        # await session.rollback()
