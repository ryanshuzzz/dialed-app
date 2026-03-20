/* Auto-generated from contracts/json-schema/garage.schema.json - DO NOT EDIT */

/**
 * A UUID v4 identifier
 *
 * This interface was referenced by `GarageSchemas`'s JSON-Schema
 * via the `definition` "uuid".
 */
export type Uuid = string;
/**
 * An ISO 8601 date-time string with timezone (e.g. 2026-03-18T12:00:00Z)
 *
 * This interface was referenced by `GarageSchemas`'s JSON-Schema
 * via the `definition` "dateTime".
 */
export type DateTime = string;
/**
 * A calendar date in ISO 8601 format (YYYY-MM-DD)
 *
 * This interface was referenced by `GarageSchemas`'s JSON-Schema
 * via the `definition` "date".
 */
export type Date = string;
/**
 * ISO 4217 currency code (e.g. USD, EUR, GBP)
 *
 * This interface was referenced by `GarageSchemas`'s JSON-Schema
 * via the `definition` "currency".
 */
export type Currency = string;

/**
 * Bike, maintenance logs, tire pressure logs, modifications, and ownership history for the Dialed Garage feature
 */
export interface GarageSchemas {
  [k: string]: unknown;
}
/**
 * A motorcycle in a user's garage. The core entity for all Dialed features — maintenance, tires, mods, sessions, and telemetry all hang off a bike.
 *
 * This interface was referenced by `GarageSchemas`'s JSON-Schema
 * via the `definition` "Bike".
 */
export interface Bike {
  /**
   * Unique bike identifier
   */
  id: string;
  /**
   * ID of the user who owns or manages this bike
   */
  user_id: string;
  /**
   * Manufacturer name (e.g. Honda, Ducati, Yamaha, KTM)
   */
  make: string;
  /**
   * Model designation (e.g. CBR600RR, Panigale V4R, R1M)
   */
  model: string;
  /**
   * Model year of the bike
   */
  year?: number | null;
  /**
   * Vehicle identification number. Optional but useful for service records.
   */
  vin?: string | null;
  /**
   * Color or livery description
   */
  color?: string | null;
  /**
   * Current odometer reading in kilometres. Updated manually by the rider.
   */
  mileage_km?: number | null;
  /**
   * Current hour meter reading. Used by track bikes that track engine hours instead of mileage.
   */
  engine_hours?: number | null;
  /**
   * Exhaust system description (e.g. Akrapovič full system, stock)
   */
  exhaust?: string | null;
  /**
   * ECU / flash description (e.g. stock, PiggyBack, Woolich Racing flash)
   */
  ecu?: string | null;
  /**
   * Front sprocket tooth count
   */
  gearing_front?: number | null;
  /**
   * Rear sprocket tooth count
   */
  gearing_rear?: number | null;
  suspension_spec: SuspensionSpec;
  /**
   * Free-text notes about the bike (quirks, known issues, build notes)
   */
  notes?: string | null;
  /**
   * Current ownership/availability status. Soft-deleted bikes are excluded from list views.
   */
  status: "owned" | "sold" | "stored" | "in_repair";
  /**
   * Soft-delete timestamp. Non-null means the bike has been removed from the garage view but data is retained.
   */
  deleted_at?: DateTime | null;
  /**
   * An ISO 8601 date-time string with timezone (e.g. 2026-03-18T12:00:00Z)
   */
  created_at: string;
  /**
   * An ISO 8601 date-time string with timezone (e.g. 2026-03-18T12:00:00Z)
   */
  updated_at: string;
}
/**
 * Current suspension settings. Validated JSONB — see suspension-spec.schema.json for the full shape.
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
 * A single maintenance event for a bike — oil change, chain service, valve check, etc. Includes optional next-due reminders.
 *
 * This interface was referenced by `GarageSchemas`'s JSON-Schema
 * via the `definition` "MaintenanceLog".
 */
export interface MaintenanceLog {
  /**
   * Unique maintenance log entry identifier
   */
  id: string;
  /**
   * ID of the bike this maintenance was performed on
   */
  bike_id: string;
  /**
   * ID of the user who logged this entry
   */
  user_id: string;
  /**
   * Type of maintenance performed. Used for filtering and upcoming-service queries.
   */
  category:
    | "oil_change"
    | "coolant"
    | "brake_fluid"
    | "chain"
    | "air_filter"
    | "spark_plugs"
    | "valve_check"
    | "brake_pads"
    | "battery"
    | "general_service"
    | "other";
  /**
   * What was done in plain text (e.g. 'Full oil and filter change, Motul 7100 10W-40')
   */
  description?: string | null;
  /**
   * Odometer reading at time of service in kilometres
   */
  mileage_km?: number | null;
  /**
   * Hour meter reading at time of service
   */
  engine_hours?: number | null;
  /**
   * Cost of the service, in the specified currency
   */
  cost?: number | null;
  /**
   * ISO 4217 currency code for the cost field
   */
  currency?: Currency | null;
  /**
   * Who performed the service (e.g. 'self', 'Honda Dealer', 'John Smith')
   */
  performed_by?: string | null;
  /**
   * Calendar date when the maintenance was performed
   */
  performed_at: string;
  /**
   * Odometer reading at which the next service of this type is due
   */
  next_due_km?: number | null;
  /**
   * Calendar date by which the next service should be performed, regardless of mileage
   */
  next_due_date?: Date | null;
  /**
   * Additional free-text notes or observations
   */
  notes?: string | null;
  /**
   * URL of a receipt photo stored in blob storage
   */
  receipt_url?: string | null;
  /**
   * An ISO 8601 date-time string with timezone (e.g. 2026-03-18T12:00:00Z)
   */
  created_at: string;
  /**
   * An ISO 8601 date-time string with timezone (e.g. 2026-03-18T12:00:00Z)
   */
  updated_at: string;
}
/**
 * A timestamped tire pressure reading. Can be linked to a track session for pre/post-session analysis.
 *
 * This interface was referenced by `GarageSchemas`'s JSON-Schema
 * via the `definition` "TirePressureLog".
 */
export interface TirePressureLog {
  /**
   * Unique tire pressure log identifier
   */
  id: string;
  /**
   * ID of the bike the reading was taken on
   */
  bike_id: string;
  /**
   * ID of the user who logged this reading
   */
  user_id: string;
  /**
   * Front tire pressure in PSI at the time of reading
   */
  front_psi?: number | null;
  /**
   * Rear tire pressure in PSI at the time of reading
   */
  rear_psi?: number | null;
  /**
   * Front tire surface temperature in Celsius at the time of reading. Primarily useful for track sessions.
   */
  front_temp_c?: number | null;
  /**
   * Rear tire surface temperature in Celsius at the time of reading. Primarily useful for track sessions.
   */
  rear_temp_c?: number | null;
  /**
   * When in the riding lifecycle this reading was taken. Used to group and compare readings meaningfully.
   */
  context?: "cold" | "pre_ride" | "post_ride" | "pit_stop" | "pre_session" | "post_session";
  /**
   * Optional link to a track session. Set for pre_session/post_session/pit_stop readings.
   */
  session_id?: Uuid | null;
  /**
   * Free-text notes (e.g. 'Ambient 18°C, tyres cold from overnight')
   */
  notes?: string | null;
  /**
   * An ISO 8601 date-time string with timezone (e.g. 2026-03-18T12:00:00Z)
   */
  recorded_at: string;
  /**
   * An ISO 8601 date-time string with timezone (e.g. 2026-03-18T12:00:00Z)
   */
  created_at: string;
}
/**
 * A part installed, removed, or changed on a bike. Builds a full modification history for insurance, resale, and AI context.
 *
 * This interface was referenced by `GarageSchemas`'s JSON-Schema
 * via the `definition` "Modification".
 */
export interface Modification {
  /**
   * A UUID v4 identifier
   */
  id: string;
  /**
   * A UUID v4 identifier
   */
  bike_id: string;
  /**
   * A UUID v4 identifier
   */
  user_id: string;
  /**
   * What was done to the part. 'swapped' implies replacing one part with another of the same type.
   */
  action: "installed" | "removed" | "swapped" | "upgraded" | "repaired";
  /**
   * System or area of the bike affected. Used for filtering and AI context building.
   */
  category:
    | "exhaust"
    | "ecu"
    | "suspension"
    | "brakes"
    | "wheels_tires"
    | "bodywork"
    | "cosmetics"
    | "controls"
    | "lighting"
    | "engine"
    | "drivetrain"
    | "electronics"
    | "ergonomics"
    | "other";
  /**
   * Descriptive name of the part (e.g. 'Öhlins TTX GP rear shock', 'Brembo M50 calipers')
   */
  part_name: string;
  /**
   * Part manufacturer or brand name
   */
  brand?: string | null;
  /**
   * OEM or aftermarket part number for exact identification
   */
  part_number?: string | null;
  /**
   * Cost of the part or service, in the specified currency
   */
  cost?: number | null;
  /**
   * ISO 4217 currency code for the cost field
   */
  currency?: Currency | null;
  /**
   * A calendar date in ISO 8601 format (YYYY-MM-DD)
   */
  installed_at: string;
  /**
   * Calendar date when this part was removed. Null means the part is currently installed.
   */
  removed_at?: Date | null;
  /**
   * Odometer reading in kilometres when this modification was made
   */
  mileage_km?: number | null;
  /**
   * Free-text notes (settings used, reason for swap, supplier info, etc.)
   */
  notes?: string | null;
  /**
   * An ISO 8601 date-time string with timezone (e.g. 2026-03-18T12:00:00Z)
   */
  created_at: string;
  /**
   * An ISO 8601 date-time string with timezone (e.g. 2026-03-18T12:00:00Z)
   */
  updated_at: string;
}
/**
 * A single ownership event for a bike — purchase, sale, trade, gift, or transfer. Builds a provenance timeline.
 *
 * This interface was referenced by `GarageSchemas`'s JSON-Schema
 * via the `definition` "OwnershipHistory".
 */
export interface OwnershipHistory {
  /**
   * A UUID v4 identifier
   */
  id: string;
  /**
   * A UUID v4 identifier
   */
  bike_id: string;
  /**
   * A UUID v4 identifier
   */
  user_id: string;
  /**
   * The nature of the ownership transaction
   */
  event_type: "purchased" | "sold" | "traded" | "gifted" | "transferred";
  /**
   * A calendar date in ISO 8601 format (YYYY-MM-DD)
   */
  date: string;
  /**
   * Transaction price, in the specified currency. Null for gifted or non-monetary transfers.
   */
  price?: number | null;
  /**
   * ISO 4217 currency code for the price field
   */
  currency?: Currency | null;
  /**
   * Odometer reading in kilometres at the time of the transaction
   */
  mileage_km?: number | null;
  /**
   * Name of the other party in the transaction (e.g. 'Honda of Seattle', 'Private seller - John D.')
   */
  counterparty?: string | null;
  /**
   * Free-text notes about the transaction
   */
  notes?: string | null;
  /**
   * An ISO 8601 date-time string with timezone (e.g. 2026-03-18T12:00:00Z)
   */
  created_at: string;
}
