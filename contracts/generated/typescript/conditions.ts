/* Auto-generated from contracts/json-schema/conditions.schema.json - DO NOT EDIT */

/**
 * Structured weather and track conditions stored as validated JSONB in core.events.conditions. Enables analytical correlation of lap times with environmental factors.
 */
export interface ConditionsSchema {
  [k: string]: unknown;
}
/**
 * Weather and track surface conditions at the time of a track event. All fields are optional — riders record what they have. The notes field captures anything not covered by structured fields.
 *
 * This interface was referenced by `ConditionsSchema`'s JSON-Schema
 * via the `definition` "Conditions".
 */
export interface Conditions {
  /**
   * Ambient air temperature in Celsius at the time of the event
   */
  temp_c?: number | null;
  /**
   * Relative humidity as a percentage (0–100)
   */
  humidity_pct?: number | null;
  /**
   * Track surface temperature in Celsius. Significantly affects tire grip and optimal tire pressure.
   */
  track_temp_c?: number | null;
  /**
   * Wind speed in kilometres per hour
   */
  wind_kph?: number | null;
  /**
   * Overall track surface condition. 'damp' means drying but not fully dry; 'mixed' means varying conditions across the circuit.
   */
  condition?: "dry" | "damp" | "wet" | "mixed" | null;
  /**
   * Free-text description of conditions not captured by structured fields (e.g. 'Fog in sector 2', 'Strong crosswind on back straight', 'Oil flag at T5')
   */
  notes?: string | null;
}
