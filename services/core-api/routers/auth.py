"""Auth endpoints — register, login, refresh, profile, API keys."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_session
from dialed_shared.auth import get_current_user
from schemas.auth import (
    ApiKeyCreateRequest,
    ApiKeyCreateResponse,
    ApiKeyListResponse,
    LoginRequest,
    RefreshRequest,
    RefreshResponse,
    RegisterRequest,
    TokenResponse,
    UpdateProfileRequest,
    UserProfile,
)
from services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(
    body: RegisterRequest,
    session: AsyncSession = Depends(get_session),
) -> TokenResponse:
    return await AuthService.register_user(session, body)


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    session: AsyncSession = Depends(get_session),
) -> TokenResponse:
    return await AuthService.login_user(session, body.email, body.password)


@router.post("/refresh", response_model=RefreshResponse)
async def refresh(
    body: RefreshRequest,
    session: AsyncSession = Depends(get_session),
) -> RefreshResponse:
    token = await AuthService.refresh_token(session, body.refresh_token)
    return RefreshResponse(token=token)


@router.get("/me", response_model=UserProfile)
async def get_profile(
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> UserProfile:
    return await AuthService.get_profile(session, uuid.UUID(user["user_id"]))


@router.patch("/me", response_model=UserProfile)
async def update_profile(
    body: UpdateProfileRequest,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> UserProfile:
    return await AuthService.update_profile(session, uuid.UUID(user["user_id"]), body)


# ── API Keys ──


@router.get("/me/api-keys", response_model=ApiKeyListResponse)
async def list_api_keys(
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ApiKeyListResponse:
    return await AuthService.list_api_keys(session, uuid.UUID(user["user_id"]))


@router.put(
    "/me/api-keys",
    response_model=ApiKeyCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_api_key(
    body: ApiKeyCreateRequest,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ApiKeyCreateResponse:
    return await AuthService.create_api_key(session, uuid.UUID(user["user_id"]), body)


@router.delete("/me/api-keys/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_api_key(
    key_id: uuid.UUID,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await AuthService.delete_api_key(session, uuid.UUID(user["user_id"]), key_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
