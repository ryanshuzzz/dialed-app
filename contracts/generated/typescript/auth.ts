/* Auto-generated from contracts/json-schema/auth.schema.json - DO NOT EDIT */

/**
 * A UUID v4 identifier
 *
 * This interface was referenced by `AuthSchemas`'s JSON-Schema
 * via the `definition` "uuid".
 */
export type Uuid = string;
/**
 * An ISO 8601 date-time string with timezone (e.g. 2026-03-18T12:00:00Z)
 *
 * This interface was referenced by `AuthSchemas`'s JSON-Schema
 * via the `definition` "dateTime".
 */
export type DateTime = string;

/**
 * User account, authentication token, and API key data shapes for the Dialed platform
 */
export interface AuthSchemas {
  [k: string]: unknown;
}
/**
 * A Dialed platform user account. Represents any rider from casual street riders to competitive racers.
 *
 * This interface was referenced by `AuthSchemas`'s JSON-Schema
 * via the `definition` "User".
 */
export interface User {
  /**
   * Unique user identifier
   */
  id: string;
  /**
   * User's email address, used for login and notifications
   */
  email: string;
  /**
   * Optional display name shown in the UI. Falls back to email prefix if not set.
   */
  display_name?: string | null;
  /**
   * Rider's self-assessed skill level. Influences AI suggestion tone and complexity.
   */
  skill_level: "novice" | "intermediate" | "expert";
  /**
   * Primary riding context. Street riders see garage-focused features; competitive riders see full telemetry and AI suggestion features.
   */
  rider_type: "street" | "casual_track" | "competitive";
  /**
   * Preferred unit system. Affects display of distances, temperatures, and pressures throughout the UI.
   */
  units: "metric" | "imperial";
  /**
   * Timestamp when the account was created
   */
  created_at: string;
  /**
   * Timestamp when the account was last modified
   */
  updated_at: string;
}
/**
 * A persistent API auth token (not a Supabase session — used for long-lived programmatic access or internal token tracking).
 *
 * This interface was referenced by `AuthSchemas`'s JSON-Schema
 * via the `definition` "AuthToken".
 */
export interface AuthToken {
  /**
   * Unique token record identifier
   */
  id: string;
  /**
   * ID of the user this token belongs to
   */
  user_id: string;
  /**
   * Bcrypt or SHA-256 hash of the raw token value. The raw token is only returned at creation time.
   */
  token_hash: string;
  /**
   * Timestamp after which this token is no longer valid
   */
  expires_at: string;
  /**
   * Timestamp when this token was issued
   */
  created_at: string;
}
/**
 * A named API key for programmatic or team access. Shown in the UI as a named credential.
 *
 * This interface was referenced by `AuthSchemas`'s JSON-Schema
 * via the `definition` "UserApiKey".
 */
export interface UserApiKey {
  /**
   * Unique API key identifier
   */
  id: string;
  /**
   * ID of the user who owns this API key
   */
  user_id: string;
  /**
   * Human-readable label for this key (e.g. 'Paddock laptop', 'Crew chief iPad')
   */
  name: string;
  /**
   * Hash of the raw API key. The raw key is only returned at creation time.
   */
  key_hash: string;
  /**
   * Timestamp of the most recent successful authentication with this key, or null if never used
   */
  last_used_at?: DateTime | null;
  /**
   * Optional expiry timestamp. Null means the key does not expire.
   */
  expires_at?: DateTime | null;
  /**
   * An ISO 8601 date-time string with timezone (e.g. 2026-03-18T12:00:00Z)
   */
  created_at: string;
}
