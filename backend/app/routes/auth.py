from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client
from supabase_auth.errors import AuthApiError
from supabase_auth.types import User

from app.database import get_supabase_auth
from app.dependencies.auth import get_current_user
from app.schemas.auth import (
    AuthResponse,
    AuthUserResponse,
    LoginRequest,
    SessionResponse,
    SignupRequest,
)

router = APIRouter()


def serialize_user(user: User) -> AuthUserResponse:
    return AuthUserResponse(
        id=user.id,
        email=user.email,
        email_confirmed=user.email_confirmed_at is not None,
        created_at=user.created_at,
    )


def map_signup_error(error: AuthApiError) -> HTTPException:
    if error.code in {"email_exists", "user_already_exists"}:
        return HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    if error.code == "over_email_send_rate_limit":
        return HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many signup attempts. Please try again later.",
        )

    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=error.message,
    )


@router.post(
    "/signup",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
)
def signup(
    payload: SignupRequest,
    supabase: Annotated[Client, Depends(get_supabase_auth)],
) -> AuthResponse:
    credentials: dict[str, object] = {
        "email": str(payload.email),
        "password": payload.password,
    }

    if payload.display_name:
        credentials["options"] = {
            "data": {"display_name": payload.display_name},
        }

    try:
        response = supabase.auth.sign_up(credentials)
    except AuthApiError as error:
        raise map_signup_error(error) from error

    if response.user is None:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Supabase did not return a user.",
        )

    session = (
        SessionResponse.model_validate(response.session, from_attributes=True)
        if response.session
        else None
    )

    return AuthResponse(
        user=serialize_user(response.user),
        session=session,
        requires_email_confirmation=session is None,
    )


@router.post("/login", response_model=AuthResponse)
def login(
    payload: LoginRequest,
    supabase: Annotated[Client, Depends(get_supabase_auth)],
) -> AuthResponse:
    try:
        response = supabase.auth.sign_in_with_password(
            {
                "email": str(payload.email),
                "password": payload.password,
            }
        )
    except AuthApiError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from error

    if response.user is None or response.session is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unable to create a session.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return AuthResponse(
        user=serialize_user(response.user),
        session=SessionResponse.model_validate(
            response.session,
            from_attributes=True,
        ),
        requires_email_confirmation=False,
    )


@router.get("/me", response_model=AuthUserResponse)
def read_current_user(
    current_user: Annotated[User, Depends(get_current_user)],
) -> AuthUserResponse:
    return serialize_user(current_user)
