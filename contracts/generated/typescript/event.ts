/* Auto-generated from contracts/json-schema/event.schema.json — DO NOT EDIT */
import type { Conditions } from "./conditions";

/**
 * This interface was referenced by `TrackAndRoadEvents`'s JSON-Schema
 * via the `definition` "uuid".
 */
export type Uuid = string;
/**
 * This interface was referenced by `TrackAndRoadEvents`'s JSON-Schema
 * via the `definition` "date".
 */
export type Date = string;
/**
 * This interface was referenced by `TrackAndRoadEvents`'s JSON-Schema
 * via the `definition` "dateTime".
 */
export type DateTime = string;
/**
 * track = circuit or known venue from the tracks catalog; road = public roads or undefined course
 *
 * This interface was referenced by `TrackAndRoadEvents`'s JSON-Schema
 * via the `definition` "EventVenue".
 */
export type EventVenue = "track" | "road";

/**
 * An outing for a bike on a calendar date: either at a known track (track day / race) or on the road. Sessions are always created under an event.
 */
export interface TrackAndRoadEvents {
  [k: string]: unknown;
}
/**
 * A single source that contributed to location knowledge for this ride.
 *
 * This interface was referenced by `TrackAndRoadEvents`'s JSON-Schema
 * via the `definition` "RideLocationSource".
 */
export interface RideLocationSource {
  /**
   * How this location fragment was obtained
   */
  type: "manual" | "gpx" | "map_match" | "telemetry" | "imported";
  /**
   * URI, blob id, or external route identifier when applicable
   */
  ref?: string | null;
  /**
   * When this source was recorded or imported
   */
  captured_at?: string | null;
  /**
   * Free-text provenance (e.g. logger model, app name)
   */
  notes?: string | null;
}
/**
 * Human- and machine-readable location for road rides. At least one of label or sources should be present.
 *
 * This interface was referenced by `TrackAndRoadEvents`'s JSON-Schema
 * via the `definition` "RideLocation".
 */
export interface RideLocation {
  /**
   * Primary display name (e.g. 'Angeles Crest', 'Office commute')
   */
  label?: string | null;
  /**
   * Additional route or area description
   */
  notes?: string | null;
  /**
   * Ordered or unordered list of contributing sources
   */
  sources?: RideLocationSource[];
  /**
   * Optional centroid or start latitude (WGS84)
   */
  approximate_lat?: number | null;
  /**
   * Optional centroid or start longitude (WGS84)
   */
  approximate_lon?: number | null;
}
/**
 * This interface was referenced by `TrackAndRoadEvents`'s JSON-Schema
 * via the `definition` "Event".
 */
export interface Event {
  id: Uuid;
  user_id: Uuid;
  bike_id: Uuid;
  venue: EventVenue;
  /**
   * Set when venue is track; null for road rides
   */
  track_id?: Uuid | null;
  /**
   * Set when venue is road; optional extra context for track days
   */
  ride_location?: RideLocation | null;
  date: Date;
  conditions: Conditions;
  created_at: DateTime;
  updated_at: DateTime;
}
/**
 * This interface was referenced by `TrackAndRoadEvents`'s JSON-Schema
 * via the `definition` "CreateEventRequest".
 */
export interface CreateEventRequest {
  bike_id: Uuid;
  /**
   * track = circuit or known venue from the tracks catalog; road = public roads or undefined course
   */
  venue?: "track" | "road";
  track_id?: Uuid | null;
  ride_location?: RideLocation | null;
  date: Date;
  conditions?: Conditions;
}
/**
 * This interface was referenced by `TrackAndRoadEvents`'s JSON-Schema
 * via the `definition` "UpdateEventRequest".
 */
export interface UpdateEventRequest {
  bike_id?: Uuid;
  venue?: EventVenue;
  track_id?: Uuid | null;
  ride_location?: RideLocation | null;
  date?: Date;
  conditions?: Conditions;
}
