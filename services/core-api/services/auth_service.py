"""Auth service — registration, login, token management, API keys."""

from __future__ import annotations

import hashlib
import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from cryptography.fernet import Fernet
from jose import JWTError, jwt
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from dialed_shared.errors import (
    NotFoundException,
    UnauthorizedException,
    ValidationException,
)

from models.auth_token import AuthToken
from models.user import User
from models.user_api_key import UserApiKey
from schemas.auth import (
    ApiKeyCreateRequest,
    ApiKeyCreateResponse,
    ApiKeySummary,
    RegisterRequest,
    TokenResponse,
    UpdateProfileRequest,
    UserProfile,
)

INTERNAL_SECRET = os.environ.get("INTERNAL_SECRET", "shared-secret-for-internal-tokens")
ENCRYPTION_KEY = os.environ.get("ENCRYPTION_KEY", "")
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 30
ALGORITHM = "HS256"


def _hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000)
    return f"{salt}:{hashed.hex()}"


def _verify_password(password: str, stored: str) -> bool:
    salt, hashed = stored.split(":", 1)
    check = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000)
    return check.hex() == hashed


def _create_access_token(user_id: uuid.UUID) -> str:
    payload = {
        "sub": str(user_id),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        "type": "access",
    }
    return jwt.encode(payload, INTERNAL_SECRET, algorithm=ALGORITHM)


def _create_refresh_token(user_id: uuid.UUID) -> str:
    payload = {
        "sub": str(user_id),
        "exp": datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        "type": "refresh",
    }
    return jwt.encode(payload, INTERNAL_SECRET, algorithm=ALGORITHM)


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _get_fernet() -> Fernet:
    if not ENCRYPTION_KEY:
        raise ValidationException(error="ENCRYPTION_KEY environment variable is not set")
    return Fernet(ENCRYPTION_KEY.encode())


class AuthService:

    @staticmethod
    async def register_user(
        session: AsyncSession,
        data: RegisterRequest,
    ) -> TokenResponse:
        result = await session.execute(
            select(User).where(User.email == data.email)
        )
        if result.scalar_one_or_none():
            raise ValidationException(error="Email already registered")

        user = User(
            email=data.email,
            display_name=data.display_name,
        )
        session.add(user)
        await session.flush()

        password_hash = _hash_password(data.password)
        access_token = _create_access_token(user.id)
        refresh_token = _create_refresh_token(user.id)

        auth_token = AuthToken(
            user_id=user.id,
            token_hash=password_hash,
            expires_at=datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        )
        session.add(auth_token)
        await session.commit()

        return TokenResponse(
            user_id=user.id,
            token=access_token,
            refresh_token=refresh_token,
        )

    @staticmethod
    async def login_user(
        session: AsyncSession,
        email: str,
        password: str,
    ) -> TokenResponse:
        result = await session.execute(
            select(User).where(User.email == email)
        )
        user = result.scalar_one_or_none()
        if not user:
            raise UnauthorizedException(error="Invalid email or password")

        token_result = await session.execute(
            select(AuthToken).where(AuthToken.user_id == user.id)
        )
        auth_token = token_result.scalar_one_or_none()
        if not auth_token or not _verify_password(password, auth_token.token_hash):
            raise UnauthorizedException(error="Invalid email or password")

        access_token = _create_access_token(user.id)
        refresh_token = _create_refresh_token(user.id)

        return TokenResponse(
            user_id=user.id,
            token=access_token,
            refresh_token=refresh_token,
        )

    @staticmethod
    async def refresh_token(
        session: AsyncSession,
        refresh_token: str,
    ) -> str:
        try:
            payload = jwt.decode(refresh_token, INTERNAL_SECRET, algorithms=[ALGORITHM])
        except JWTError:
            raise UnauthorizedException(error="Invalid or expired refresh token")

        if payload.get("type") != "refresh":
            raise UnauthorizedException(error="Invalid token type")

        user_id = uuid.UUID(payload["sub"])
        result = await session.execute(
            select(User).where(User.id == user_id)
        )
        if not result.scalar_one_or_none():
            raise UnauthorizedException(error="User not found")

        return _create_access_token(user_id)

    @staticmethod
    async def get_profile(
        session: AsyncSession,
        user_id: uuid.UUID,
    ) -> UserProfile:
        result = await session.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        if not user:
            raise NotFoundException(error="User not found")

        return UserProfile(
            user_id=user.id,
            email=user.email,
            display_name=user.display_name,
            skill_level=user.skill_level,
            rider_type=user.rider_type,
            units=user.units,
        )

    @staticmethod
    async def update_profile(
        session: AsyncSession,
        user_id: uuid.UUID,
        data: UpdateProfileRequest,
    ) -> UserProfile:
        result = await session.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        if not user:
            raise NotFoundException(error="User not found")

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(user, field, value)

        await session.commit()
        await session.refresh(user)

        return UserProfile(
            user_id=user.id,
            email=user.email,
            display_name=user.display_name,
            skill_level=user.skill_level,
            rider_type=user.rider_type,
            units=user.units,
        )

    @staticmethod
    async def create_api_key(
        session: AsyncSession,
        user_id: uuid.UUID,
        data: ApiKeyCreateRequest,
    ) -> ApiKeyCreateResponse:
        raw_key = f"dk_{secrets.token_urlsafe(32)}"
        key_hash = _hash_token(raw_key)

        api_key = UserApiKey(
            user_id=user_id,
            name=data.name,
            key_hash=key_hash,
            expires_at=data.expires_at,
        )
        session.add(api_key)
        await session.commit()
        await session.refresh(api_key)

        return ApiKeyCreateResponse(
            id=api_key.id,
            name=api_key.name,
            key=raw_key,
            expires_at=api_key.expires_at,
            created_at=api_key.created_at,
        )

    @staticmethod
    async def list_api_keys(
        session: AsyncSession,
        user_id: uuid.UUID,
    ) -> list[ApiKeySummary]:
        result = await session.execute(
            select(UserApiKey)
            .where(UserApiKey.user_id == user_id)
            .order_by(UserApiKey.created_at.desc())
        )
        keys = result.scalars().all()

        return [
            ApiKeySummary(
                id=k.id,
                name=k.name,
                key_preview=f"...{k.key_hash[-4:]}" if k.key_hash else "",
                last_used_at=k.last_used_at,
                expires_at=k.expires_at,
                created_at=k.created_at,
            )
            for k in keys
        ]

    @staticmethod
    async def delete_api_key(
        session: AsyncSession,
        user_id: uuid.UUID,
        key_id: uuid.UUID,
    ) -> None:
        result = await session.execute(
            select(UserApiKey).where(
                UserApiKey.id == key_id,
                UserApiKey.user_id == user_id,
            )
        )
        api_key = result.scalar_one_or_none()
        if not api_key:
            raise NotFoundException(error="API key not found")

        await session.delete(api_key)
        await session.commit()
