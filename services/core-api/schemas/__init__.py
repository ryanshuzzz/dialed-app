"""Core API Pydantic schemas — re-export all domain schemas."""

from .admin import (
    ChannelAliasCreate,
    ChannelAliasListResponse,
    ChannelAliasResponse,
    ChannelAliasUpdate,
)
from .auth import (
    ApiKeyCreateRequest,
    ApiKeyCreateResponse,
    ApiKeyListResponse,
    ApiKeySummary,
    LoginRequest,
    RefreshRequest,
    RefreshResponse,
    RegisterRequest,
    RiderType,
    SkillLevel,
    TokenResponse,
    Units,
    UpdateProfileRequest,
    UserProfile,
)
from .bikes import (
    BikeCreate,
    BikeDetailResponse,
    BikeListResponse,
    BikeResponse,
    BikeStats,
    BikeStatus,
    BikeUpdate,
    SuspensionEndSettings,
    SuspensionSpec,
)
from .events import (
    ConditionsModel,
    EventCreate,
    EventListResponse,
    EventResponse,
    EventUpdate,
    TrackCondition,
)
from .maintenance import (
    MaintenanceCategory,
    MaintenanceCreate,
    MaintenanceListResponse,
    MaintenanceResponse,
    MaintenanceUpdate,
    UpcomingMaintenanceItem,
    UpcomingMaintenanceResponse,
)
from .modifications import (
    ModificationAction,
    ModificationCategory,
    ModificationCreate,
    ModificationFilters,
    ModificationListResponse,
    ModificationResponse,
    ModificationUpdate,
)
from .ownership import (
    OwnershipEventCreate,
    OwnershipEventResponse,
    OwnershipEventType,
    OwnershipTimelineResponse,
)
from .progress import (
    AvgDeltaByStatus,
    BestLapByTrack,
    EfficacyResponse,
    LapTrendItem,
    LapTrendResponse,
    SessionHistoryItem,
    SessionHistoryResponse,
)
from .sessions import (
    ChangeLogCreate,
    ChangeLogResponse,
    SessionCreate,
    SessionDetailResponse,
    SessionListResponse,
    SessionResponse,
    SessionType,
    SessionUpdate,
    SetupSnapshotCreate,
    SetupSnapshotResponse,
    TireSnapshot,
)
from .tire_pressure import (
    TirePressureContext,
    TirePressureCreate,
    TirePressureFilters,
    TirePressureListResponse,
    TirePressureResponse,
)
from .tracks import (
    TrackCreate,
    TrackListResponse,
    TrackResponse,
    TrackUpdate,
)
