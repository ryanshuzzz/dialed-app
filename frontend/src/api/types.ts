/**
 * TypeScript types matching the OpenAPI contracts exactly.
 *
 * Core API: contracts/openapi/core-api.yaml
 * Telemetry: contracts/openapi/telemetry-ingestion.yaml
 * AI: contracts/openapi/ai.yaml
 */

// ---------- Auth ----------
export interface RegisterRequest {
  email: string;
  password: string;
  display_name?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user_id: string;
  token: string;
  refresh_token: string;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface RefreshResponse {
  token: string;
}

export interface UserProfile {
  user_id: string;
  email: string;
  display_name?: string | null;
  skill_level: 'novice' | 'intermediate' | 'expert';
  rider_type: 'street' | 'casual_track' | 'competitive';
  units: 'metric' | 'imperial';
}

export interface UpdateProfileRequest {
  display_name?: string | null;
  skill_level?: 'novice' | 'intermediate' | 'expert';
  rider_type?: 'street' | 'casual_track' | 'competitive';
  units?: 'metric' | 'imperial';
}

// ---------- API Keys ----------
export interface ApiKeyCreateRequest {
  name: string;
  expires_at?: string | null;
}

export interface ApiKeyCreateResponse {
  id: string;
  name: string;
  key: string;
  expires_at?: string | null;
  created_at: string;
}

export interface ApiKeySummary {
  id: string;
  name: string;
  last_used_at?: string | null;
  expires_at?: string | null;
  created_at: string;
}

// ---------- Suspension ----------
export interface SuspensionEndSettings {
  compression?: number | null;
  rebound?: number | null;
  preload?: number | null;
  spring_rate?: number | null;
  oil_level?: number | null;
  ride_height?: number | null;
}

export interface SuspensionSpec {
  schema_version: 1;
  front?: SuspensionEndSettings;
  rear?: SuspensionEndSettings;
}

// ---------- Conditions ----------
export interface Conditions {
  temp_c?: number | null;
  humidity_pct?: number | null;
  track_temp_c?: number | null;
  wind_kph?: number | null;
  condition?: 'dry' | 'damp' | 'wet' | 'mixed' | null;
  notes?: string | null;
}

// ---------- Bikes ----------
export interface Bike {
  id: string;
  user_id: string;
  make: string;
  model: string;
  year?: number | null;
  vin?: string | null;
  color?: string | null;
  mileage_km?: number | null;
  engine_hours?: number | null;
  exhaust?: string | null;
  ecu?: string | null;
  gearing_front?: number | null;
  gearing_rear?: number | null;
  suspension_spec: SuspensionSpec;
  notes?: string | null;
  status: 'owned' | 'sold' | 'stored' | 'in_repair';
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BikeDetail extends Bike {
  stats?: {
    maintenance_count?: number;
    modification_count?: number;
    session_count?: number;
    best_lap_ms?: number | null;
  };
}

export interface CreateBikeRequest {
  make: string;
  model: string;
  year?: number | null;
  vin?: string | null;
  color?: string | null;
  mileage_km?: number | null;
  engine_hours?: number | null;
  exhaust?: string | null;
  ecu?: string | null;
  gearing_front?: number | null;
  gearing_rear?: number | null;
  suspension_spec?: SuspensionSpec;
  notes?: string | null;
  status?: 'owned' | 'sold' | 'stored' | 'in_repair';
}

export interface UpdateBikeRequest {
  make?: string;
  model?: string;
  year?: number | null;
  vin?: string | null;
  color?: string | null;
  mileage_km?: number | null;
  engine_hours?: number | null;
  exhaust?: string | null;
  ecu?: string | null;
  gearing_front?: number | null;
  gearing_rear?: number | null;
  suspension_spec?: SuspensionSpec;
  notes?: string | null;
  status?: 'owned' | 'sold' | 'stored' | 'in_repair';
}

// ---------- Maintenance ----------
export interface MaintenanceLog {
  id: string;
  bike_id: string;
  user_id: string;
  category: string;
  description?: string | null;
  mileage_km?: number | null;
  engine_hours?: number | null;
  cost?: number | null;
  currency?: string | null;
  performed_by?: string | null;
  performed_at: string;
  next_due_km?: number | null;
  next_due_date?: string | null;
  notes?: string | null;
  receipt_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateMaintenanceRequest {
  category: string;
  description?: string | null;
  mileage_km?: number | null;
  engine_hours?: number | null;
  cost?: number | null;
  currency?: string | null;
  performed_by?: string | null;
  performed_at: string;
  next_due_km?: number | null;
  next_due_date?: string | null;
  notes?: string | null;
  receipt_url?: string | null;
}

export interface UpdateMaintenanceRequest {
  category?: string;
  description?: string | null;
  mileage_km?: number | null;
  engine_hours?: number | null;
  cost?: number | null;
  currency?: string | null;
  performed_by?: string | null;
  performed_at?: string;
  next_due_km?: number | null;
  next_due_date?: string | null;
  notes?: string | null;
  receipt_url?: string | null;
}

export interface UpcomingMaintenanceItem {
  id: string;
  bike_id: string;
  category: string;
  performed_at: string;
  next_due_km?: number | null;
  next_due_date?: string | null;
  current_mileage_km?: number | null;
}

export interface UpcomingMaintenance {
  items: UpcomingMaintenanceItem[];
}

// ---------- Tire Pressure ----------
export interface TirePressureLog {
  id: string;
  bike_id: string;
  user_id: string;
  front_psi?: number | null;
  rear_psi?: number | null;
  front_temp_c?: number | null;
  rear_temp_c?: number | null;
  context: 'cold' | 'pre_ride' | 'post_ride' | 'pit_stop' | 'pre_session' | 'post_session';
  session_id?: string | null;
  notes?: string | null;
  recorded_at: string;
  created_at: string;
}

export interface CreateTirePressureRequest {
  front_psi?: number | null;
  rear_psi?: number | null;
  front_temp_c?: number | null;
  rear_temp_c?: number | null;
  context?: 'cold' | 'pre_ride' | 'post_ride' | 'pit_stop' | 'pre_session' | 'post_session';
  session_id?: string | null;
  notes?: string | null;
  recorded_at?: string;
}

// ---------- Modifications ----------
export interface Modification {
  id: string;
  bike_id: string;
  user_id: string;
  action: 'installed' | 'removed' | 'swapped' | 'upgraded' | 'repaired';
  category: string;
  part_name: string;
  brand?: string | null;
  part_number?: string | null;
  cost?: number | null;
  currency?: string | null;
  installed_at: string;
  removed_at?: string | null;
  mileage_km?: number | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateModificationRequest {
  action: 'installed' | 'removed' | 'swapped' | 'upgraded' | 'repaired';
  category: string;
  part_name: string;
  brand?: string | null;
  part_number?: string | null;
  cost?: number | null;
  currency?: string | null;
  installed_at: string;
  removed_at?: string | null;
  mileage_km?: number | null;
  notes?: string | null;
}

export interface UpdateModificationRequest {
  action?: 'installed' | 'removed' | 'swapped' | 'upgraded' | 'repaired';
  category?: string;
  part_name?: string;
  brand?: string | null;
  part_number?: string | null;
  cost?: number | null;
  currency?: string | null;
  installed_at?: string;
  removed_at?: string | null;
  mileage_km?: number | null;
  notes?: string | null;
}

// ---------- Ownership ----------
export interface OwnershipHistory {
  id: string;
  bike_id: string;
  user_id: string;
  event_type: 'purchased' | 'sold' | 'traded' | 'gifted' | 'transferred';
  date: string;
  price?: number | null;
  currency?: string | null;
  mileage_km?: number | null;
  counterparty?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface CreateOwnershipRequest {
  event_type: 'purchased' | 'sold' | 'traded' | 'gifted' | 'transferred';
  date: string;
  price?: number | null;
  currency?: string | null;
  mileage_km?: number | null;
  counterparty?: string | null;
  notes?: string | null;
}

// ---------- Tracks ----------
export interface Track {
  id: string;
  name: string;
  config?: string | null;
  surface_notes?: string | null;
  gps_bounds?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTrackRequest {
  name: string;
  config?: string | null;
  surface_notes?: string | null;
  gps_bounds?: Record<string, unknown> | null;
}

export interface UpdateTrackRequest {
  name?: string;
  config?: string | null;
  surface_notes?: string | null;
  gps_bounds?: Record<string, unknown> | null;
}

// ---------- Events ----------
export interface TrackEvent {
  id: string;
  user_id: string;
  bike_id: string;
  track_id: string;
  date: string;
  conditions: Conditions;
  created_at: string;
  updated_at: string;
}

export interface CreateEventRequest {
  bike_id: string;
  track_id: string;
  date: string;
  conditions?: Conditions;
}

export interface UpdateEventRequest {
  bike_id?: string;
  track_id?: string;
  date?: string;
  conditions?: Conditions;
}

// ---------- Sessions ----------
export interface TireSnapshot {
  brand?: string | null;
  compound?: string | null;
  laps?: number | null;
}

export interface Session {
  id: string;
  event_id: string;
  user_id: string;
  session_type: 'practice' | 'qualifying' | 'race' | 'trackday';
  manual_best_lap_ms?: number | null;
  csv_best_lap_ms?: number | null;
  tire_front?: TireSnapshot | null;
  tire_rear?: TireSnapshot | null;
  rider_feedback?: string | null;
  voice_note_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SetupSnapshot {
  id: string;
  session_id: string;
  settings: SuspensionSpec;
  created_at: string;
}

export interface ChangeLog {
  id: string;
  session_id: string;
  parameter: string;
  from_value?: string | null;
  to_value: string;
  rationale?: string | null;
  applied_at: string;
}

export interface SessionDetail extends Session {
  snapshots?: SetupSnapshot[];
  changes?: ChangeLog[];
}

export interface CreateSessionRequest {
  event_id: string;
  session_type: 'practice' | 'qualifying' | 'race' | 'trackday';
  manual_best_lap_ms?: number | null;
  tire_front?: TireSnapshot | null;
  tire_rear?: TireSnapshot | null;
  rider_feedback?: string | null;
  voice_note_url?: string | null;
}

export interface UpdateSessionRequest {
  session_type?: 'practice' | 'qualifying' | 'race' | 'trackday';
  manual_best_lap_ms?: number | null;
  tire_front?: TireSnapshot | null;
  tire_rear?: TireSnapshot | null;
  rider_feedback?: string | null;
  voice_note_url?: string | null;
}

export interface CreateSnapshotRequest {
  settings: SuspensionSpec;
}

export interface CreateChangeRequest {
  parameter: string;
  from_value?: string | null;
  to_value: string;
  rationale?: string | null;
  applied_at?: string;
}

// ---------- Progress ----------
export interface LapTimeTrendItem {
  session_id: string;
  date: string;
  track_name: string;
  best_lap_ms?: number | null;
}

export interface BestLapByTrack {
  track_id: string;
  track_name: string;
  best_lap_ms: number;
  session_id: string;
  date: string;
}

export interface ProgressOverview {
  lap_time_trend?: LapTimeTrendItem[];
  best_laps_by_track?: BestLapByTrack[];
  total_time_found_ms?: number;
}

export interface EfficacyOverview {
  total_suggestions?: number;
  adoption_rate?: number;
  avg_delta_by_status?: {
    applied?: number | null;
    applied_modified?: number | null;
    skipped?: number | null;
  };
}

export interface SessionHistoryItem {
  session_id: string;
  event_id: string;
  date: string;
  track_name: string;
  session_type: 'practice' | 'qualifying' | 'race' | 'trackday';
  best_lap_ms?: number | null;
  delta_from_previous_ms?: number | null;
}

export interface SessionHistory {
  sessions: SessionHistoryItem[];
}

// ---------- Admin: Channel Aliases ----------
export interface ChannelAlias {
  id: string;
  raw_name: string;
  canonical_name: string;
  logger_model?: string | null;
  created_at: string;
}

export interface CreateChannelAliasRequest {
  raw_name: string;
  canonical_name: string;
  logger_model?: string | null;
}

export interface UpdateChannelAliasRequest {
  raw_name?: string;
  canonical_name?: string;
  logger_model?: string | null;
}

// ---------- Ingestion ----------
export interface IngestionJobCreated {
  job_id: string;
}

export interface IngestionJob {
  id: string;
  session_id: string;
  source: 'csv' | 'ocr' | 'voice';
  status: 'pending' | 'processing' | 'complete' | 'failed';
  result?: Record<string, unknown> | null;
  error_message?: string | null;
  confidence?: number | null;
  created_at: string;
  completed_at?: string | null;
}

export interface ConfirmRequest {
  confirmed?: boolean;
  corrections?: Record<string, unknown> | null;
}

export interface ConfirmResponse {
  status: 'confirmed' | 'corrected';
  session_id?: string;
}

// ---------- Telemetry ----------
export interface TelemetryPoint {
  time: string;
  session_id: string;
  gps_speed?: number | null;
  throttle_pos?: number | null;
  rpm?: number | null;
  gear?: number | null;
  lean_angle?: number | null;
  front_brake_psi?: number | null;
  rear_brake_psi?: number | null;
  fork_position?: number | null;
  shock_position?: number | null;
  coolant_temp?: number | null;
  oil_temp?: number | null;
  lat?: number | null;
  lon?: number | null;
  extra_channels?: Record<string, number | null>;
}

export interface ChannelInfo {
  name: string;
  min: number | null;
  max: number | null;
  sample_count: number;
}

export interface ChannelSummary {
  channels: ChannelInfo[];
  total_samples?: number;
  time_range?: {
    start: string;
    end: string;
  };
}

export interface LapData {
  session_id: string;
  lap_number: number;
  lap_time_ms?: number;
  sample_rate_hz?: number;
  points: TelemetryPoint[];
}

export interface SessionAnalysis {
  session_id: string;
  lap_segments?: Array<{
    id: string;
    session_id: string;
    lap_number: number;
    start_time_ms: number;
    end_time_ms: number;
    lap_time_ms: number;
    beacon_start_s?: number | null;
    beacon_end_s?: number | null;
    created_at: string;
  }>;
  best_lap?: {
    lap_number: number;
    lap_time_ms: number;
  };
  braking_zones?: Array<{
    zone_id: number;
    entry_speed_kph: number;
    exit_speed_kph: number;
    max_brake_psi: number;
    duration_ms: number;
  }>;
  fork_rebound?: {
    avg_rebound_rate?: number | null;
    max_compression_mm?: number | null;
  };
  tcs_events?: Array<{
    time: string;
    lap_number: number;
    duration_ms: number;
    throttle_pos_at_trigger: number;
  }>;
}

// ---------- AI Suggestions ----------
export interface SuggestRequest {
  session_id: string;
}

export interface SuggestResponse {
  job_id: string;
}

export interface Suggestion {
  id: string;
  session_id: string;
  user_id: string;
  suggestion_text: string;
  changes?: SuggestionChange[];
  created_at: string;
}

export interface SuggestionSummary {
  id: string;
  session_id: string;
  user_id: string;
  suggestion_text?: string;
  change_count?: number;
  applied_count?: number;
  created_at: string;
}

export interface SuggestionChange {
  id: string;
  suggestion_id: string;
  parameter: string;
  suggested_value: string;
  symptom?: string | null;
  confidence?: number | null;
  applied_status: 'not_applied' | 'applied' | 'applied_modified' | 'skipped';
  actual_value?: string | null;
  outcome_lap_delta_ms?: number | null;
  applied_at?: string | null;
  created_at: string;
}

export interface UpdateChangeStatusRequest {
  applied_status: 'not_applied' | 'applied' | 'applied_modified' | 'skipped';
  actual_value?: string | null;
}

export interface RecordOutcomeRequest {
  outcome_lap_delta_ms: number;
}

// ---------- Error ----------
export interface ErrorResponse {
  error: string;
  code: string;
  request_id?: string;
}
