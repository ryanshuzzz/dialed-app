/* Auto-generated from contracts/json-schema/session.schema.json - DO NOT EDIT */

/**
 * A UUID v4 identifier
 *
 * This interface was referenced by `SessionSchemas`'s JSON-Schema
 * via the `definition` "uuid".
 */
export type Uuid = string;
/**
 * An ISO 8601 date-time string with timezone (e.g. 2026-03-18T12:00:00Z)
 *
 * This interface was referenced by `SessionSchemas`'s JSON-Schema
 * via the `definition` "dateTime".
 */
export type DateTime = string;

/**
 * Track session, setup snapshots, and change log data shapes for the Dialed platform
 */
export interface SessionSchemas {
  [k: string]: unknown;
}
/**
 * Tire specification snapshot at session time (brand, compound, age). Recorded separately for front and rear.
 *
 * This interface was referenced by `SessionSchemas`'s JSON-Schema
 * via the `definition` "TireSnapshot".
 */
export interface TireSnapshot {
  /**
   * Tire manufacturer (e.g. Pirelli, Dunlop, Bridgestone)
   */
  brand?: string | null;
  /**
   * Compound designation (e.g. SC1, SC2, Medium, Soft)
   */
  compound?: string | null;
  /**
   * Number of laps on this tire at the start of the session
   */
  laps?: number | null;
}
/**
 * A single on-track session within a track event. A session has a type (practice, qualifying, etc.) and captures lap times from two sources: manual rider entry and CSV logger data.
 *
 * This interface was referenced by `SessionSchemas`'s JSON-Schema
 * via the `definition` "Session".
 */
export interface Session {
  /**
   * Unique session identifier
   */
  id: string;
  /**
   * ID of the track event this session belongs to
   */
  event_id: string;
  /**
   * ID of the rider who participated in this session
   */
  user_id: string;
  /**
   * The type of session. Affects how lap times are compared and displayed.
   */
  session_type: "practice" | "qualifying" | "race" | "trackday";
  /**
   * Best lap time in milliseconds as entered manually by the rider. Preserved as a fallback when no logger data is available.
   */
  manual_best_lap_ms?: number | null;
  /**
   * Best lap time in milliseconds extracted from the CSV data logger file. More accurate than manual entry — displayed preferentially when available.
   */
  csv_best_lap_ms?: number | null;
  /**
   * Front tire specification at the start of this session
   */
  tire_front?: TireSnapshot | null;
  /**
   * Rear tire specification at the start of this session
   */
  tire_rear?: TireSnapshot | null;
  /**
   * Free-text rider notes about how the bike felt during this session (used as AI context)
   */
  rider_feedback?: string | null;
  /**
   * URL of an audio voice note in blob storage. Transcribed by the voice ingestion pipeline.
   */
  voice_note_url?: string | null;
  /**
   * Timestamp when this session was created
   */
  created_at: string;
  /**
   * Timestamp when this session was last modified
   */
  updated_at: string;
}
/**
 * An immutable snapshot of a bike's suspension settings at a point in time during a session. Append-only — never updated. Each save creates a new row, building a history of setup changes throughout the day.
 *
 * This interface was referenced by `SessionSchemas`'s JSON-Schema
 * via the `definition` "SetupSnapshot".
 */
export interface SetupSnapshot {
  /**
   * Unique setup snapshot identifier
   */
  id: string;
  /**
   * ID of the session this snapshot belongs to
   */
  session_id: string;
  settings: SuspensionSpec;
  /**
   * Timestamp when this snapshot was saved. Defines the ordering of snapshots within a session.
   */
  created_at: string;
}
/**
 * Full suspension spec at the time this snapshot was taken. Validated against the SuspensionSpec schema.
 */
export interface SuspensionSpec {
  /**
   * Schema version number. Increment this when the shape of this object changes. Services must handle or reject unknown versions.
   */
  schema_version: 1;
  front?: SuspensionEndSettings;
  rear?: SuspensionEndSettings1;
}
/**
 * Front fork / damper settings
 */
export interface SuspensionEndSettings {
  /**
   * Compression damping clicks from full hard. A lower number means softer compression.
   */
  compression?: number | null;
  /**
   * Rebound damping clicks from full hard. A lower number means faster rebound.
   */
  rebound?: number | null;
  /**
   * Spring preload in mm (if measured) or turns from minimum. Affects sag and ride height.
   */
  preload?: number | null;
  /**
   * Spring rate in N/mm. Set when a non-standard spring is fitted.
   */
  spring_rate?: number | null;
  /**
   * Fork oil level in mm from the top of the inner tube with spring removed. Front-end setting only.
   */
  oil_level?: number | null;
  /**
   * Ride height in mm, typically measured as linkage eye-to-eye or shock length.
   */
  ride_height?: number | null;
}
/**
 * Rear shock / linkage settings
 */
export interface SuspensionEndSettings1 {
  /**
   * Compression damping clicks from full hard. A lower number means softer compression.
   */
  compression?: number | null;
  /**
   * Rebound damping clicks from full hard. A lower number means faster rebound.
   */
  rebound?: number | null;
  /**
   * Spring preload in mm (if measured) or turns from minimum. Affects sag and ride height.
   */
  preload?: number | null;
  /**
   * Spring rate in N/mm. Set when a non-standard spring is fitted.
   */
  spring_rate?: number | null;
  /**
   * Fork oil level in mm from the top of the inner tube with spring removed. Front-end setting only.
   */
  oil_level?: number | null;
  /**
   * Ride height in mm, typically measured as linkage eye-to-eye or shock length.
   */
  ride_height?: number | null;
}
/**
 * A single setting change made between or during sessions. Provides the AI with a structured history of what was tried and why.
 *
 * This interface was referenced by `SessionSchemas`'s JSON-Schema
 * via the `definition` "ChangeLog".
 */
export interface ChangeLog {
  /**
   * Unique change log entry identifier
   */
  id: string;
  /**
   * ID of the session in which this change was made
   */
  session_id: string;
  /**
   * Name of the setting that was changed (e.g. 'front.compression', 'rear.rebound', 'rear.preload')
   */
  parameter: string;
  /**
   * Previous value of the parameter before this change. Null if the previous value was not recorded.
   */
  from_value?: string | null;
  /**
   * New value of the parameter after this change
   */
  to_value: string;
  /**
   * Why this change was made (rider notes, AI suggestion reference, mechanic recommendation)
   */
  rationale?: string | null;
  /**
   * Timestamp when this change was applied
   */
  applied_at: string;
}
