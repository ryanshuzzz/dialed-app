/**
 * Re-export generated TypeScript types from contracts.
 *
 * When the contracts/generated/typescript/ directory is populated by the
 * code generation step, update this file to re-export from there.
 * For now we define placeholder types so the app compiles.
 */

// ---------- Auth ----------
export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  rider_type: 'street' | 'casual_track' | 'competitive';
  skill_level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  units: 'imperial' | 'metric';
  created_at: string;
  updated_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  display_name: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  expires_at?: string;
}

export interface ApiKeyWithSecret extends ApiKey {
  raw_key: string;
}

// ---------- Garage: Bikes ----------
export interface SuspensionSpec {
  front_spring_rate?: string;
  front_compression?: number;
  front_rebound?: number;
  front_preload?: string;
  rear_spring_rate?: string;
  rear_compression_high?: number;
  rear_compression_low?: number;
  rear_rebound?: number;
  rear_preload?: string;
}

export interface Bike {
  id: string;
  user_id: string;
  make: string;
  model: string;
  year: number;
  vin?: string;
  mileage_km: number;
  status: 'active' | 'stored' | 'sold' | 'totaled';
  suspension_spec?: SuspensionSpec;
  gearing?: string;
  exhaust?: string;
  ecu?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface BikeDetail extends Bike {
  stats: {
    last_maintenance_date?: string;
    active_mods_count: number;
    tire_pressure_last_checked?: string;
    total_sessions: number;
  };
}

export interface CreateBikeRequest {
  make: string;
  model: string;
  year: number;
  vin?: string;
  mileage_km?: number;
  status?: 'active' | 'stored' | 'sold' | 'totaled';
  suspension_spec?: SuspensionSpec;
  gearing?: string;
  exhaust?: string;
  ecu?: string;
  notes?: string;
}

export interface UpdateBikeRequest {
  make?: string;
  model?: string;
  year?: number;
  vin?: string;
  mileage_km?: number;
  status?: 'active' | 'stored' | 'sold' | 'totaled';
  suspension_spec?: SuspensionSpec;
  gearing?: string;
  exhaust?: string;
  ecu?: string;
  notes?: string;
}

// ---------- Maintenance ----------
export interface MaintenanceEntry {
  id: string;
  bike_id: string;
  category: string;
  description: string;
  performed_at: string;
  mileage_km?: number;
  cost_cents?: number;
  performed_by?: string;
  next_due_date?: string;
  next_due_mileage_km?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// ---------- Tire Pressure ----------
export interface TirePressureReading {
  id: string;
  bike_id: string;
  session_id?: string;
  front_psi: number;
  rear_psi: number;
  front_temp_f?: number;
  rear_temp_f?: number;
  context: 'cold' | 'pre_ride' | 'pit_stop' | 'post_ride' | 'other';
  measured_at: string;
  created_at: string;
}

// ---------- Modifications ----------
export interface Modification {
  id: string;
  bike_id: string;
  action: 'installed' | 'removed' | 'replaced' | 'adjusted';
  category: string;
  part_name: string;
  brand?: string;
  cost_cents?: number;
  installed_at?: string;
  removed_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// ---------- Ownership ----------
export interface OwnershipEvent {
  id: string;
  bike_id: string;
  event_type: 'purchased' | 'sold';
  event_date: string;
  price_cents?: number;
  mileage_km?: number;
  counterparty?: string;
  notes?: string;
  created_at: string;
}

// ---------- Tracks ----------
export interface Track {
  id: string;
  user_id: string;
  name: string;
  config?: string;
  surface_notes?: string;
  created_at: string;
  updated_at: string;
}

// ---------- Events ----------
export interface Conditions {
  ambient_temp_f?: number;
  humidity_pct?: number;
  track_temp_f?: number;
  wind_mph?: number;
  condition: 'dry' | 'damp' | 'wet' | 'mixed';
  notes?: string;
}

export interface TrackEvent {
  id: string;
  user_id: string;
  bike_id: string;
  track_id: string;
  event_date: string;
  conditions?: Conditions;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// ---------- Sessions ----------
export interface Session {
  id: string;
  event_id: string;
  session_type: 'practice' | 'qualifying' | 'race' | 'test';
  manual_best_lap_ms?: number;
  csv_best_lap_ms?: number;
  rider_feedback?: string;
  created_at: string;
  updated_at: string;
}

export interface SessionDetail extends Session {
  snapshots: SetupSnapshot[];
  changes: ChangeLogEntry[];
}

export interface SetupSnapshot {
  id: string;
  session_id: string;
  bike_id: string;
  suspension_spec: SuspensionSpec;
  gearing?: string;
  tire_pressure_front_psi?: number;
  tire_pressure_rear_psi?: number;
  created_at: string;
}

export interface ChangeLogEntry {
  id: string;
  session_id: string;
  parameter: string;
  from_value: string;
  to_value: string;
  rationale?: string;
  source: 'manual' | 'ai_applied';
  created_at: string;
}

// ---------- Telemetry ----------
export interface TelemetryChannel {
  channel_name: string;
  min_value: number;
  max_value: number;
  unit: string;
}

export interface TelemetryPoint {
  timestamp_ms: number;
  values: Record<string, number>;
}

// ---------- AI Suggestions ----------
export interface Suggestion {
  id: string;
  session_id: string;
  status: 'pending' | 'streaming' | 'complete' | 'failed';
  suggestion_text?: string;
  model_version?: string;
  created_at: string;
}

export interface SuggestionChange {
  id: string;
  suggestion_id: string;
  parameter: string;
  current_value: string;
  suggested_value: string;
  symptom?: string;
  confidence: number;
  status: 'pending' | 'applied' | 'skipped' | 'applied_modified';
  actual_value?: string;
  delta_ms?: number;
}

// ---------- Ingestion ----------
export interface IngestionJob {
  job_id: string;
  status: 'queued' | 'processing' | 'complete' | 'failed';
  result?: Record<string, unknown>;
  error?: string;
}

// ---------- Progress ----------
export interface LapTrend {
  session_id: string;
  track_name: string;
  event_date: string;
  best_lap_ms: number;
}

export interface EfficacyStats {
  total_suggestions: number;
  applied_count: number;
  skipped_count: number;
  adoption_rate: number;
  avg_delta_applied_ms: number;
  avg_delta_skipped_ms: number;
}

// ---------- Admin ----------
export interface ChannelAlias {
  id: string;
  raw_name: string;
  canonical_name: string;
  logger_model?: string;
  created_at: string;
  updated_at: string;
}

// ---------- Error ----------
export interface ErrorResponse {
  error: string;
  code: string;
  request_id?: string;
}
