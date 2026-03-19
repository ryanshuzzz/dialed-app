import type { RequestHandler } from 'msw';
import { bikeHandlers } from './bikes';
import { maintenanceHandlers } from './maintenance';
import { tirePressureHandlers } from './tirePressure';
import { modificationHandlers } from './modifications';
import { ownershipHandlers } from './ownership';

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
  // ...trackHandlers,
  // ...eventHandlers,
  // ...sessionHandlers,
  // ...ingestionHandlers,
  // ...aiHandlers,
  // ...telemetryHandlers,
  // ...progressHandlers,
  // ...authHandlers,
  // ...adminHandlers,
];
