"""Telemetry endpoints — upload, channels, lap data, analysis."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_db_session, get_timescale_session
from dialed_shared.auth import get_current_user
from dialed_shared.errors import NotFoundException, ValidationException
from dialed_shared.logging import setup_logger
from models.lap_segment import LapSegment
from models.telemetry_point import TelemetryPoint
from pipelines.csv_parser import CORE_CHANNELS, bulk_insert_telemetry
from schemas.telemetry import (
    AnalysisResponse,
    ChannelInfo,
    ChannelSummaryResponse,
    LapDataResponse,
    TelemetryPointSchema,
    TelemetryUploadRequest,
    TelemetryUploadResponse,
    TimeRange,
)
from services.analysis_service import run_analysis

logger = setup_logger("telemetry-ingestion")

router = APIRouter(prefix="/telemetry", tags=["Telemetry"])

# Sorted list of the 13 core channel column names.
_CORE_CHANNEL_NAMES = sorted(CORE_CHANNELS)


# ── POST /telemetry/upload ───────────────────────────────────────────────────


@router.post("/upload", status_code=201, response_model=TelemetryUploadResponse)
async def upload_telemetry(
    body: TelemetryUploadRequest,
    ts: AsyncSession = Depends(get_timescale_session),
    user: dict = Depends(get_current_user),
) -> TelemetryUploadResponse:
    """Bulk insert telemetry data points into the hypertable."""
    if not body.points:
        raise ValidationException("No telemetry points provided")

    rows = [
        {
            "time": p.time,
            "session_id": str(body.session_id),
            "gps_speed": p.gps_speed,
            "throttle_pos": p.throttle_pos,
            "rpm": p.rpm,
            "gear": p.gear,
            "lean_angle": p.lean_angle,
            "front_brake_psi": p.front_brake_psi,
            "rear_brake_psi": p.rear_brake_psi,
            "fork_position": p.fork_position,
            "shock_position": p.shock_position,
            "coolant_temp": p.coolant_temp,
            "oil_temp": p.oil_temp,
            "lat": p.lat,
            "lon": p.lon,
            "extra_channels": p.extra_channels or {},
        }
        for p in body.points
    ]

    inserted = await bulk_insert_telemetry(ts, body.session_id, rows)

    return TelemetryUploadResponse(inserted_count=inserted)


# ── GET /telemetry/{session_id}/channels ─────────────────────────────────────


@router.get("/{session_id}/channels", response_model=ChannelSummaryResponse)
async def get_channels(
    session_id: str,
    ts: AsyncSession = Depends(get_timescale_session),
    user: dict = Depends(get_current_user),
) -> ChannelSummaryResponse:
    """List available channels with value ranges for a session."""
    # Check session has data.
    count_row = await ts.execute(
        select(func.count())
        .select_from(TelemetryPoint)
        .where(TelemetryPoint.session_id == session_id)
    )
    total_samples = count_row.scalar() or 0

    if total_samples == 0:
        raise NotFoundException("No telemetry data found for this session")

    # Query min/max/count for each core channel.
    channels: list[ChannelInfo] = []
    for col_name in _CORE_CHANNEL_NAMES:
        col = getattr(TelemetryPoint, col_name)
        row = await ts.execute(
            select(
                func.min(col),
                func.max(col),
                func.count(col),
            ).where(TelemetryPoint.session_id == session_id)
        )
        min_val, max_val, sample_count = row.one()

        if sample_count and sample_count > 0:
            channels.append(
                ChannelInfo(
                    name=col_name,
                    min=float(min_val) if min_val is not None else None,
                    max=float(max_val) if max_val is not None else None,
                    sample_count=sample_count,
                )
            )

    # Query extra_channels keys and their sample counts from JSONB.
    # jsonb_object_keys() unnests all keys in extra_channels for each row.
    extra_keys_row = await ts.execute(
        text(
            "SELECT key, count(*) AS sample_count "
            "FROM telemetry.telemetry_points, "
            "jsonb_object_keys(extra_channels) AS key "
            "WHERE session_id = :sid "
            "GROUP BY key "
            "ORDER BY key"
        ),
        {"sid": session_id},
    )
    for row in extra_keys_row.all():
        channels.append(
            ChannelInfo(
                name=row.key,
                min=None,
                max=None,
                sample_count=row.sample_count,
            )
        )

    # Get time range.
    time_row = await ts.execute(
        select(
            func.min(TelemetryPoint.time),
            func.max(TelemetryPoint.time),
        ).where(TelemetryPoint.session_id == session_id)
    )
    t_min, t_max = time_row.one()
    time_range = TimeRange(start=t_min, end=t_max) if t_min and t_max else None

    return ChannelSummaryResponse(
        channels=channels,
        total_samples=total_samples,
        time_range=time_range,
    )


# ── GET /telemetry/{session_id}/lap/{lap_number} ─────────────────────────────


@router.get("/{session_id}/lap/{lap_number}", response_model=LapDataResponse)
async def get_lap_data(
    session_id: str,
    lap_number: int,
    hz: float | None = Query(default=None, ge=1, le=20),
    channels: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db_session),
    ts: AsyncSession = Depends(get_timescale_session),
    user: dict = Depends(get_current_user),
) -> LapDataResponse:
    """Get full channel data for a specific lap with optional downsampling."""
    if lap_number < 1:
        raise ValidationException("lap_number must be >= 1")

    # Fetch the lap segment to get time boundaries.
    lap_row = await db.execute(
        select(LapSegment).where(
            LapSegment.session_id == session_id,
            LapSegment.lap_number == lap_number,
        )
    )
    lap = lap_row.scalar_one_or_none()

    if lap is None:
        raise NotFoundException(f"Lap {lap_number} not found for this session")

    # Get base timestamp for the session.
    base_row = await ts.execute(
        select(TelemetryPoint.time)
        .where(TelemetryPoint.session_id == session_id)
        .order_by(TelemetryPoint.time)
        .limit(1)
    )
    base_time = base_row.scalar_one_or_none()
    if base_time is None:
        raise NotFoundException("No telemetry data found for this session")

    lap_start = base_time + timedelta(milliseconds=lap.start_time_ms)
    lap_end = base_time + timedelta(milliseconds=lap.end_time_ms)

    # Parse channel filter.
    requested_channels: set[str] | None = None
    if channels:
        requested_channels = {c.strip() for c in channels.split(",") if c.strip()}

    # Determine which columns to select.
    select_cols = [TelemetryPoint.time, TelemetryPoint.session_id]
    for col_name in _CORE_CHANNEL_NAMES:
        if requested_channels is None or col_name in requested_channels:
            select_cols.append(getattr(TelemetryPoint, col_name))
    if requested_channels is None or "extra_channels" in requested_channels:
        select_cols.append(TelemetryPoint.extra_channels)

    effective_hz = hz or 20.0

    if hz and hz < 20:
        # Downsampled query using TimescaleDB time_bucket.
        bucket_ms = int(1000 / hz)
        bucket_interval = f"{bucket_ms}ms"

        # Build column selections for the aggregated query.
        agg_cols = [f"time_bucket('{bucket_interval}', time) AS bucket"]
        agg_cols.append("session_id")

        core_selected: list[str] = []
        for col_name in _CORE_CHANNEL_NAMES:
            if requested_channels is None or col_name in requested_channels:
                if col_name == "gear":
                    agg_cols.append(f"round(avg({col_name}))::smallint AS {col_name}")
                else:
                    agg_cols.append(f"avg({col_name}) AS {col_name}")
                core_selected.append(col_name)

        if requested_channels is None or "extra_channels" in requested_channels:
            # For JSONB, just take the first value in each bucket.
            agg_cols.append("(array_agg(extra_channels))[1] AS extra_channels")

        sql = text(
            f"SELECT {', '.join(agg_cols)} "
            f"FROM telemetry.telemetry_points "
            f"WHERE session_id = :sid AND time >= :start AND time < :end "
            f"GROUP BY bucket, session_id "
            f"ORDER BY bucket"
        )

        result = await ts.execute(
            sql,
            {"sid": session_id, "start": lap_start, "end": lap_end},
        )
        rows = result.all()

        points = []
        for row in rows:
            point: dict[str, Any] = {
                "time": row.bucket,
                "session_id": row.session_id,
            }
            for col_name in core_selected:
                val = getattr(row, col_name, None)
                point[col_name] = float(val) if val is not None else None

            if hasattr(row, "extra_channels"):
                point["extra_channels"] = row.extra_channels

            points.append(TelemetryPointSchema(**point))
    else:
        # Full-resolution query.
        stmt = (
            select(*select_cols)
            .where(
                TelemetryPoint.session_id == session_id,
                TelemetryPoint.time >= lap_start,
                TelemetryPoint.time < lap_end,
            )
            .order_by(TelemetryPoint.time)
        )

        result = await ts.execute(stmt)
        rows = result.all()

        points = []
        for row in rows:
            point: dict[str, Any] = {
                "time": row.time,
                "session_id": row.session_id,
            }
            for col_name in _CORE_CHANNEL_NAMES:
                if requested_channels is None or col_name in requested_channels:
                    val = getattr(row, col_name, None)
                    point[col_name] = float(val) if val is not None else None

            if (requested_channels is None or "extra_channels" in requested_channels) and hasattr(row, "extra_channels"):
                point["extra_channels"] = row.extra_channels

            points.append(TelemetryPointSchema(**point))

    return LapDataResponse(
        session_id=session_id,
        lap_number=lap_number,
        lap_time_ms=lap.lap_time_ms,
        sample_rate_hz=effective_hz,
        points=points,
    )


# ── GET /telemetry/{session_id}/analysis ─────────────────────────────────────


@router.get("/{session_id}/analysis", response_model=AnalysisResponse)
async def get_session_analysis(
    session_id: str,
    db: AsyncSession = Depends(get_db_session),
    ts: AsyncSession = Depends(get_timescale_session),
    user: dict = Depends(get_current_user),
) -> dict:
    """Get computed analysis metrics for a session."""
    # Verify session has data.
    count_row = await ts.execute(
        select(func.count())
        .select_from(TelemetryPoint)
        .where(TelemetryPoint.session_id == session_id)
    )
    total = count_row.scalar() or 0
    if total == 0:
        raise NotFoundException("No telemetry data found for this session")

    result = await run_analysis(db, ts, session_id)
    return result
