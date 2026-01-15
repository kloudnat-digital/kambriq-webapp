"""
Database Base Configuration

SQLAlchemy base and session setup.
"""

from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""
    pass


# These will be initialized when database URL is available
_async_engine = None
_async_session_maker = None


def get_async_engine(database_url: str):
    """
    Get or create async SQLAlchemy engine.
    
    Args:
        database_url: Database connection URL (asyncpg format)
        
    Returns:
        AsyncEngine instance
    """
    global _async_engine
    if _async_engine is None:
        _async_engine = create_async_engine(
            database_url,
            echo=False,
            future=True,
        )
    return _async_engine


def get_async_session_maker(database_url: str) -> async_sessionmaker[AsyncSession]:
    """
    Get or create async session maker.
    
    Args:
        database_url: Database connection URL (asyncpg format)
        
    Returns:
        AsyncSessionMaker instance
    """
    global _async_session_maker
    if _async_session_maker is None:
        engine = get_async_engine(database_url)
        _async_session_maker = async_sessionmaker(
            engine, class_=AsyncSession, expire_on_commit=False
        )
    return _async_session_maker


async def get_db_session(database_url: str):
    """
    Dependency function to get database session.
    
    Args:
        database_url: Database connection URL
        
    Yields:
        AsyncSession instance
    """
    session_maker = get_async_session_maker(database_url)
    async with session_maker() as session:
        try:
            yield session
        finally:
            await session.close()

