"""Admin — channel alias CRUD."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_session
from dialed_shared.auth import get_current_user
from dialed_shared.errors import NotFoundException
from models.channel_alias import ChannelAlias
from schemas.admin import (
    ChannelAliasCreate,
    ChannelAliasResponse,
    ChannelAliasUpdate,
)

router = APIRouter(prefix="/admin/channel-aliases", tags=["Admin"])


@router.get("", response_model=list[ChannelAliasResponse])
async def list_channel_aliases(
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[ChannelAliasResponse]:
    result = await session.execute(
        select(ChannelAlias).order_by(ChannelAlias.raw_name)
    )
    aliases = result.scalars().all()
    return [ChannelAliasResponse.model_validate(a) for a in aliases]


@router.post("", response_model=ChannelAliasResponse, status_code=status.HTTP_201_CREATED)
async def create_channel_alias(
    body: ChannelAliasCreate,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ChannelAliasResponse:
    alias = ChannelAlias(**body.model_dump())
    session.add(alias)
    await session.commit()
    await session.refresh(alias)
    return ChannelAliasResponse.model_validate(alias)


@router.patch("/{alias_id}", response_model=ChannelAliasResponse)
async def update_channel_alias(
    alias_id: uuid.UUID,
    body: ChannelAliasUpdate,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ChannelAliasResponse:
    result = await session.execute(
        select(ChannelAlias).where(ChannelAlias.id == alias_id)
    )
    alias = result.scalar_one_or_none()
    if not alias:
        raise NotFoundException(error="Channel alias not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(alias, field, value)

    await session.commit()
    await session.refresh(alias)
    return ChannelAliasResponse.model_validate(alias)


@router.delete("/{alias_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_channel_alias(
    alias_id: uuid.UUID,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    result = await session.execute(
        select(ChannelAlias).where(ChannelAlias.id == alias_id)
    )
    alias = result.scalar_one_or_none()
    if not alias:
        raise NotFoundException(error="Channel alias not found")

    await session.delete(alias)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
