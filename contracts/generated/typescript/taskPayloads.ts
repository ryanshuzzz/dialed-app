/* Auto-generated from contracts/json-schema/task-payloads.schema.json - DO NOT EDIT */

/**
 * A UUID v4 identifier
 *
 * This interface was referenced by `TaskQueuePayloadSchemas`'s JSON-Schema
 * via the `definition` "uuid".
 */
export type Uuid = string;
/**
 * An ISO 8601 date-time string with timezone (e.g. 2026-03-18T12:00:00Z)
 *
 * This interface was referenced by `TaskQueuePayloadSchemas`'s JSON-Schema
 * via the `definition` "dateTime".
 */
export type DateTime = string;

/**
 * Redis task queue message payloads for both Dialed queues. Queues use Redis Lists (LPUSH/BRPOP). Both payloads are simple JSON with no nested objects.
 */
export interface TaskQueuePayloadSchemas {
  [k: string]: unknown;
}
/**
 * Payload published to the 'dialed:ingestion' Redis queue when a file upload triggers an ingestion job. The worker reads this to locate the file and associate results with the correct session.
 *
 * This interface was referenced by `TaskQueuePayloadSchemas`'s JSON-Schema
 * via the `definition` "IngestionJobPayload".
 */
export interface IngestionJobPayload {
  /**
   * ID of the telemetry.ingestion_jobs record that tracks this job's state
   */
  job_id: string;
  /**
   * ID of the core.sessions session this ingestion will populate
   */
  session_id: string;
  /**
   * ID of the user who triggered this ingestion. Used for authorization checks within the worker.
   */
  user_id: string;
  /**
   * Ingestion pipeline to invoke. csv = AiM/compatible data logger file; ocr = setup sheet photo; voice = audio note.
   */
  source: "csv" | "ocr" | "voice";
  /**
   * Absolute path to the uploaded file on shared blob storage (e.g. /storage/uploads/abc123.csv). The worker reads from this path.
   */
  file_path: string;
  /**
   * ISO 8601 timestamp when this payload was enqueued. Used for job age monitoring and stale-job sweeps.
   */
  created_at: string;
}
/**
 * Payload published to the 'dialed:ai' Redis queue when a suggestion generation request is received. The worker fetches all required context (session, bike, history) from Core API via HTTP before calling Claude.
 *
 * This interface was referenced by `TaskQueuePayloadSchemas`'s JSON-Schema
 * via the `definition` "AiJobPayload".
 */
export interface AiJobPayload {
  /**
   * ID of the ai.generation_jobs record that tracks this job's state
   */
  job_id: string;
  /**
   * ID of the core.sessions session a suggestion is being generated for. The worker fetches session data, bike specs, telemetry summary, and change history using this ID.
   */
  session_id: string;
  /**
   * ID of the user who requested the suggestion. Forwarded in inter-service HTTP calls via X-Internal-Token.
   */
  user_id: string;
  /**
   * ISO 8601 timestamp when this payload was enqueued. Used for job age monitoring and stale-job sweeps.
   */
  created_at: string;
}
