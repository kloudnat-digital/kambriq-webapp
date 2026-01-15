"""
Signup Use Case

Handles user registration.
"""


from src.application.dtos.signup import SignupRequest, SignupResponse
from src.domain.entities.user import User
from src.domain.exceptions.user_exceptions import EmailAlreadyExistsError
from src.domain.repositories.user_repository import UserRepository
from src.infrastructure.security.password_hasher import PasswordHasher


class SignupUseCase:
    """Use case for user signup."""

    def __init__(
        self,
        user_repository: UserRepository,
        password_hasher: PasswordHasher,
    ):
        """
        Initialize signup use case.

        Args:
            user_repository: User repository
            password_hasher: Password hasher service
        """
        self.user_repository = user_repository
        self.password_hasher = password_hasher

    async def execute(self, request: SignupRequest) -> SignupResponse:
        """
        Execute signup use case.

        Args:
            request: Signup request DTO

        Returns:
            Signup response DTO

        Raises:
            EmailAlreadyExistsError: If email already exists
        """
        # Check if email already exists
        if await self.user_repository.exists_by_email(request.email):
            raise EmailAlreadyExistsError(f"Email {request.email} already exists")

        # Hash password
        password_hash = self.password_hasher.hash(request.password)

        # Create user entity
        user = User.create(
            first_name=request.first_name,
            last_name=request.last_name,
            email=request.email,
            password_hash=password_hash,
            phone_number=request.phone_number,
            terms_accepted=request.terms_accepted,
        )

        # Save user
        saved_user = await self.user_repository.save(user)

        return SignupResponse(
            user_id=saved_user.id,
            email=saved_user.email,
            first_name=saved_user.first_name,
            last_name=saved_user.last_name,
        )
