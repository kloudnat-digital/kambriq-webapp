"""
Pytest fixtures for API integration tests.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.presentation.main import app


@pytest.fixture(scope="function")
def test_client(test_session: AsyncSession):
    """
    Create a TestClient for FastAPI app.

    Override get_db_session dependency to use test session.
    """
    from src.presentation.dependencies import get_db_session

    async def override_get_db_session():
        yield test_session

    app.dependency_overrides[get_db_session] = override_get_db_session

    client = TestClient(app)
    yield client

    # Cleanup
    app.dependency_overrides.clear()
