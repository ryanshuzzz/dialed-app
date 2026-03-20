/* Auto-generated from contracts/json-schema/progress.schema.json - DO NOT EDIT */

/**
 * A UUID v4 identifier
 *
 * This interface was referenced by `ProgressSchemas`'s JSON-Schema
 * via the `definition` "uuid".
 */
export type Uuid = string;
/**
 * An ISO 8601 date-time string with timezone (e.g. 2026-03-18T12:00:00Z)
 *
 * This interface was referenced by `ProgressSchemas`'s JSON-Schema
 * via the `definition` "dateTime".
 */
export type DateTime = string;

/**
 * Progress tracking and suggestion efficacy data shapes for the Dialed platform
 */
export interface ProgressSchemas {
  [k: string]: unknown;
}
/**
 * Records the measured lap time outcome for a specific AI suggestion. Written to core.efficacy_stats after the rider completes a session where they applied a suggestion. suggestion_id is a cross-schema reference — it points to ai.suggestions(id) but is stored without a foreign key constraint to avoid cross-schema coupling.
 *
 * This interface was referenced by `ProgressSchemas`'s JSON-Schema
 * via the `definition` "EfficacyStats".
 */
export interface EfficacyStats {
  /**
   * Unique efficacy record identifier
   */
  id: string;
  /**
   * ID of the rider whose outcome this record captures
   */
  user_id: string;
  /**
   * Cross-schema reference to ai.suggestions(id). Stored without a database foreign key to avoid cross-schema coupling. Must be validated at the application layer.
   */
  suggestion_id: string;
  /**
   * Net lap time change in milliseconds attributable to the applied suggestion. Negative values mean improvement (faster laps). Null if the outcome could not be measured.
   */
  lap_delta_ms?: number | null;
  /**
   * Timestamp when this efficacy outcome was recorded
   */
  recorded_at: string;
}
