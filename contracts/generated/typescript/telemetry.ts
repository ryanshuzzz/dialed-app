/* Auto-generated from contracts/json-schema/telemetry.schema.json - DO NOT EDIT */

/**
 * A UUID v4 identifier
 *
 * This interface was referenced by `TelemetrySchemas`'s JSON-Schema
 * via the `definition` "uuid".
 */
export type Uuid = string;
/**
 * An ISO 8601 date-time string with timezone (e.g. 2026-03-18T12:00:00Z)
 *
 * This interface was referenced by `TelemetrySchemas`'s JSON-Schema
 * via the `definition` "dateTime".
 */
export type DateTime = string;

/**
 * Telemetry data points, lap segments, and ingestion job data shapes for the Dialed telemetry/ingestion service
 */
export interface TelemetrySchemas {
  [k: string]: unknown;
}
/**
 * A single 20Hz telemetry sample from an AiM or compatible data logger. Uses a hybrid wide table — the 13 core channels are real columns; additional logger channels overflow into extra_channels JSONB. Stored in a TimescaleDB hypertable partitioned by time.
 *
 * This interface was referenced by `TelemetrySchemas`'s JSON-Schema
 * via the `definition` "TelemetryPoint".
 */
export interface TelemetryPoint {
  /**
   * Exact timestamp of this telemetry sample. Serves as the TimescaleDB hypertable partition key.
   */
  time: string;
  /**
   * ID of the core.sessions session this data point belongs to
   */
  session_id: string;
  /**
   * GPS-derived speed in km/h
   */
  gps_speed?: number | null;
  /**
   * Throttle position as a percentage (0 = closed, 100 = wide open)
   */
  throttle_pos?: number | null;
  /**
   * Engine RPM
   */
  rpm?: number | null;
  /**
   * Current gear (0 = neutral)
   */
  gear?: number | null;
  /**
   * Lean angle in degrees from vertical. Negative = left, positive = right.
   */
  lean_angle?: number | null;
  /**
   * Front brake line pressure in PSI
   */
  front_brake_psi?: number | null;
  /**
   * Rear brake line pressure in PSI
   */
  rear_brake_psi?: number | null;
  /**
   * Front fork position in mm (0 = fully extended)
   */
  fork_position?: number | null;
  /**
   * Rear shock position in mm (0 = fully extended)
   */
  shock_position?: number | null;
  /**
   * Engine coolant temperature in Celsius
   */
  coolant_temp?: number | null;
  /**
   * Engine oil temperature in Celsius
   */
  oil_temp?: number | null;
  /**
   * GPS latitude in decimal degrees
   */
  lat?: number | null;
  /**
   * GPS longitude in decimal degrees
   */
  lon?: number | null;
  /**
   * Additional logger channels not in the 13 core columns (e.g. TCS intervention level, wheelie sensor, secondary lambda). Keys are canonical channel names after alias resolution.
   */
  extra_channels?: {
    [k: string]: number | null;
  };
}
/**
 * Computed lap boundary data for one lap within a session. Created by the ingestion pipeline from beacon or GPS data. The combination of session_id + lap_number is unique.
 *
 * This interface was referenced by `TelemetrySchemas`'s JSON-Schema
 * via the `definition` "LapSegment".
 */
export interface LapSegment {
  /**
   * Unique lap segment identifier
   */
  id: string;
  /**
   * ID of the session this lap belongs to
   */
  session_id: string;
  /**
   * Sequential lap number within the session, starting at 1
   */
  lap_number: number;
  /**
   * Lap start offset in milliseconds from the beginning of the session file
   */
  start_time_ms: number;
  /**
   * Lap end offset in milliseconds from the beginning of the session file
   */
  end_time_ms: number;
  /**
   * Total lap duration in milliseconds (end_time_ms - start_time_ms)
   */
  lap_time_ms: number;
  /**
   * Start beacon trigger time in seconds from file start. Null if lap was computed from GPS rather than a physical beacon.
   */
  beacon_start_s?: number | null;
  /**
   * End beacon trigger time in seconds from file start. Null if lap was computed from GPS rather than a physical beacon.
   */
  beacon_end_s?: number | null;
  /**
   * Timestamp when this lap segment was computed and stored
   */
  created_at: string;
}
/**
 * Tracks the state of an async data ingestion job (CSV, OCR, or voice). Created when a file is uploaded, updated as the worker processes it, and polled or streamed via SSE by the client.
 *
 * This interface was referenced by `TelemetrySchemas`'s JSON-Schema
 * via the `definition` "IngestionJob".
 */
export interface IngestionJob {
  /**
   * Unique ingestion job identifier, also used to construct the SSE stream URL
   */
  id: string;
  /**
   * ID of the core.sessions session this ingestion job populates
   */
  session_id: string;
  /**
   * The ingestion pipeline that will process this job. csv = AiM or compatible logger file; ocr = photo of a paper setup sheet; voice = audio note.
   */
  source: "csv" | "ocr" | "voice";
  /**
   * Current job state. 'pending' = queued in Redis; 'processing' = worker is active; 'complete' = data written; 'failed' = unrecoverable error.
   */
  status: "pending" | "processing" | "complete" | "failed";
  /**
   * Parsed output data once the job is complete. Shape varies by source: CSV jobs produce lap segments + channel summary; OCR/voice jobs produce extracted setup values pending user confirmation.
   */
  result?: {
    [k: string]: unknown;
  } | null;
  /**
   * Human-readable error description if status is 'failed'
   */
  error_message?: string | null;
  /**
   * Confidence score (0–1) for OCR and voice extraction results. Null for CSV jobs. Low confidence results are flagged for user review.
   */
  confidence?: number | null;
  /**
   * Timestamp when this job was created (file uploaded)
   */
  created_at: string;
  /**
   * Timestamp when this job reached 'complete' or 'failed' status
   */
  completed_at?: DateTime | null;
}
