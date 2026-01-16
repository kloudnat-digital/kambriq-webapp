"""
Integration tests for authentication endpoints.
"""


from fastapi.testclient import TestClient


def test_signup_success(test_client: TestClient):
    """Test successful user signup."""
    response = test_client.post(
        "/auth/signup",
        json={
            "email": "newuser@example.com",
            "password": "securepassword123",
            "first_name": "New",
            "last_name": "User",
            "phone_number": "1234567890",
            "terms_accepted": True,
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert "user_id" in data
    assert data["email"] == "newuser@example.com"
    assert data["first_name"] == "New"
    assert data["last_name"] == "User"


def test_signup_email_already_exists(test_client: TestClient):
    """Test signup with existing email."""
    # First signup
    test_client.post(
        "/auth/signup",
        json={
            "email": "existing@example.com",
            "password": "securepassword123",
            "first_name": "Existing",
            "last_name": "User",
        },
    )

    # Try to signup again with same email
    response = test_client.post(
        "/auth/signup",
        json={
            "email": "existing@example.com",
            "password": "securepassword123",
            "first_name": "Another",
            "last_name": "User",
        },
    )

    assert response.status_code == 409
    assert "already exists" in response.json()["detail"].lower()


def test_signin_success(test_client: TestClient):
    """Test successful user signin."""
    # First signup
    signup_response = test_client.post(
        "/auth/signup",
        json={
            "email": "signin@example.com",
            "password": "securepassword123",
            "first_name": "Signin",
            "last_name": "User",
        },
    )
    assert signup_response.status_code == 201

    # Signin
    response = test_client.post(
        "/auth/signin",
        json={
            "email": "signin@example.com",
            "password": "securepassword123",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert "user_id" in data
    assert data["email"] == "signin@example.com"

    # Check cookies are set
    cookies = response.cookies
    assert "access_token" in cookies
    assert "refresh_token" in cookies

    # Check cookies are HttpOnly
    set_cookie_headers = list(response.headers.get_list("set-cookie"))
    access_cookie = next((h for h in set_cookie_headers if "access_token" in h), "")
    refresh_cookie = next((h for h in set_cookie_headers if "refresh_token" in h), "")

    assert "HttpOnly" in access_cookie
    assert "HttpOnly" in refresh_cookie


def test_signin_invalid_credentials(test_client: TestClient):
    """Test signin with invalid credentials."""
    response = test_client.post(
        "/auth/signin",
        json={
            "email": "nonexistent@example.com",
            "password": "wrongpassword",
        },
    )

    assert response.status_code == 401
    assert "invalid" in response.json()["detail"].lower()


def test_me_endpoint_with_token(test_client: TestClient):
    """Test GET /me endpoint with valid JWT token."""
    # Signup and signin
    test_client.post(
        "/auth/signup",
        json={
            "email": "me@example.com",
            "password": "securepassword123",
            "first_name": "Me",
            "last_name": "User",
        },
    )

    signin_response = test_client.post(
        "/auth/signin",
        json={
            "email": "me@example.com",
            "password": "securepassword123",
        },
    )

    # Get access token from cookie
    access_token = signin_response.cookies.get("access_token")
    assert access_token is not None

    # Call /me with Authorization header
    response = test_client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert "user_id" in data
    assert data["email"] == "me@example.com"
    assert data["first_name"] == "Me"
    assert data["last_name"] == "User"


def test_me_endpoint_without_token(test_client: TestClient):
    """Test GET /me endpoint without token."""
    response = test_client.get("/auth/me")

    assert response.status_code == 403  # FastAPI security returns 403 for missing credentials


def test_refresh_token(test_client: TestClient):
    """Test refresh token endpoint."""
    # Signup and signin
    test_client.post(
        "/auth/signup",
        json={
            "email": "refresh@example.com",
            "password": "securepassword123",
            "first_name": "Refresh",
            "last_name": "User",
        },
    )

    signin_response = test_client.post(
        "/auth/signin",
        json={
            "email": "refresh@example.com",
            "password": "securepassword123",
        },
    )

    # Get refresh token from cookie
    refresh_token = signin_response.cookies.get("refresh_token")
    assert refresh_token is not None

    # Refresh tokens
    response = test_client.post("/auth/refresh")

    assert response.status_code == 200
    assert "message" in response.json()

    # Check new cookies are set
    cookies = response.cookies
    assert "access_token" in cookies
    assert "refresh_token" in cookies


def test_logout(test_client: TestClient):
    """Test logout endpoint."""
    # Signup and signin
    test_client.post(
        "/auth/signup",
        json={
            "email": "logout@example.com",
            "password": "securepassword123",
            "first_name": "Logout",
            "last_name": "User",
        },
    )

    test_client.post(
        "/auth/signin",
        json={
            "email": "logout@example.com",
            "password": "securepassword123",
        },
    )

    # Logout
    response = test_client.post("/auth/logout")

    assert response.status_code == 204

    # Check cookies are cleared
    # Cookies should be deleted (empty value with max_age=0)
    set_cookie_headers = list(response.headers.get_list("set-cookie"))
    for cookie_header in set_cookie_headers:
        if "access_token" in cookie_header or "refresh_token" in cookie_header:
            assert "Max-Age=0" in cookie_header or "expires=" in cookie_header.lower()


def test_reset_password_request(test_client: TestClient):
    """Test password reset request endpoint."""
    # Signup
    test_client.post(
        "/auth/signup",
        json={
            "email": "reset@example.com",
            "password": "securepassword123",
            "first_name": "Reset",
            "last_name": "User",
        },
    )

    # Request password reset
    response = test_client.post(
        "/auth/resetpassword/request",
        json={"email": "reset@example.com"},
    )

    # Should always return 202 (even if email doesn't exist)
    assert response.status_code == 202
    assert "message" in response.json()


def test_reset_password_request_nonexistent_email(test_client: TestClient):
    """Test password reset request with nonexistent email (should still return 202)."""
    response = test_client.post(
        "/auth/resetpassword/request",
        json={"email": "nonexistent@example.com"},
    )

    # Should return 202 to prevent email enumeration
    assert response.status_code == 202
