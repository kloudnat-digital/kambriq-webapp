"""
Unit tests for SignupUseCase
"""

from unittest.mock import AsyncMock

import pytest

from src.application.dtos.signup import SignupRequest, SignupResponse
from src.application.use_cases.signup import SignupUseCase
from src.domain.entities.user import User
from src.domain.exceptions.user_exceptions import EmailAlreadyExistsError
from src.domain.repositories.user_repository import UserRepository
from src.infrastructure.security.password_hasher import PasswordHasher


@pytest.fixture()
def mock_user_repository():
    """Create mock user repository."""
    return AsyncMock(spec=UserRepository)


@pytest.fixture()
def mock_password_hasher():
    """Create mock password hasher."""
    hasher = PasswordHasher()
    return hasher


@pytest.fixture()
def signup_use_case(mock_user_repository, mock_password_hasher):
    """Create SignupUseCase instance."""
    return SignupUseCase(
        user_repository=mock_user_repository,
        password_hasher=mock_password_hasher,
    )


@pytest.mark.asyncio()
async def test_signup_success(signup_use_case, mock_user_repository, mock_password_hasher):
    """Test successful user signup."""
    # Arrange
    request = SignupRequest(
        email="test@example.com",
        password="password123",
        first_name="John",
        last_name="Doe",
        phone_number="1234567890",
        terms_accepted=True,
    )

    mock_user_repository.exists_by_email.return_value = False

    # Create a user that will be returned
    saved_user = User.create(
        first_name=request.first_name,
        last_name=request.last_name,
        email=request.email,
        password_hash=mock_password_hasher.hash(request.password),
        phone_number=request.phone_number,
        terms_accepted=request.terms_accepted,
    )

    mock_user_repository.save.return_value = saved_user

    # Act
    response = await signup_use_case.execute(request)

    # Assert
    assert isinstance(response, SignupResponse)
    assert response.email == request.email
    assert response.first_name == request.first_name
    assert response.last_name == request.last_name
    assert response.user_id == saved_user.id

    mock_user_repository.exists_by_email.assert_called_once_with(request.email)
    mock_user_repository.save.assert_called_once()


@pytest.mark.asyncio()
async def test_signup_email_already_exists(signup_use_case, mock_user_repository):
    """Test signup with existing email."""
    # Arrange
    request = SignupRequest(
        email="existing@example.com",
        password="password123",
        first_name="John",
        last_name="Doe",
    )

    mock_user_repository.exists_by_email.return_value = True

    # Act & Assert
    with pytest.raises(EmailAlreadyExistsError):
        await signup_use_case.execute(request)

    mock_user_repository.exists_by_email.assert_called_once_with(request.email)
    mock_user_repository.save.assert_not_called()
