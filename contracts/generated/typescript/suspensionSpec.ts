/* Auto-generated from contracts/json-schema/suspension-spec.schema.json - DO NOT EDIT */

/**
 * Versioned suspension specification stored as validated JSONB inside the bikes table. The schema_version field enables future migrations without breaking stored data.
 */
export interface SuspensionSpecSchema {
  [k: string]: unknown;
}
/**
 * Settings for one end of the suspension (front fork or rear shock). All adjustment fields are optional — riders fill in what they have and know.
 *
 * This interface was referenced by `SuspensionSpecSchema`'s JSON-Schema
 * via the `definition` "SuspensionEndSettings".
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
 * Complete versioned suspension specification for a bike. Stored as JSONB in core.bikes.suspension_spec and validated by the Pydantic SuspensionSpec model on write. The schema_version field enables safe in-place migrations.
 *
 * This interface was referenced by `SuspensionSpecSchema`'s JSON-Schema
 * via the `definition` "SuspensionSpec".
 */
export interface SuspensionSpec {
  /**
   * Schema version number. Increment this when the shape of this object changes. Services must handle or reject unknown versions.
   */
  schema_version: 1;
  front?: SuspensionEndSettings1;
  rear?: SuspensionEndSettings2;
}
/**
 * Front fork / damper settings
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
 * Rear shock / linkage settings
 */
export interface SuspensionEndSettings2 {
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
