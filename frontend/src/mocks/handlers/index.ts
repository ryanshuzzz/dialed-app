import type { RequestHandler } from 'msw';
import { bikeHandlers } from './bikes';
import { maintenanceHandlers } from './maintenance';
import { tirePressureHandlers } from './tirePressure';
import { modificationHandlers } from './modifications';
import { ownershipHandlers } from './ownership';
import { trackHandlers } from './tracks';
import { eventHandlers } from './events';
import { sessionHandlers } from './sessions';
import { ingestionHandlers } from './ingestion';
import { aiHandlers } from './ai';
import { telemetryHandlers } from './telemetry';
import { progressHandlers } from './progress';
import { authHandlers } from './auth';
import { adminHandlers } from './admin';

/**
 * Aggregate all MSW handlers here.
 * As handlers are created in subsequent prompts, import and spread them below.
 */
export const handlers: RequestHandler[] = [
  ...bikeHandlers,
  ...maintenanceHandlers,
  ...tirePressureHandlers,
  ...modificationHandlers,
  ...ownershipHandlers,
  ...trackHandlers,
  ...eventHandlers,
  ...sessionHandlers,
  ...ingestionHandlers,
  ...aiHandlers,
  ...telemetryHandlers,
  ...progressHandlers,
  ...authHandlers,
  ...adminHandlers,
];
