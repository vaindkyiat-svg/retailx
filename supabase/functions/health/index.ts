/**
 * RetailX V2 — Health check Edge Function (infrastructure only)
 * No business endpoints — confirms Edge runtime and shared helpers work.
 */

import { createLogger, generateRequestId } from '../_shared/logging.ts';
import { successResponse, optionsResponse, methodNotAllowedResponse } from '../_shared/response.ts';

Deno.serve(async (req: Request) => {
  const requestId = req.headers.get('x-request-id') ?? generateRequestId();
  const logger = createLogger('health', { requestId });

  if (req.method === 'OPTIONS') return optionsResponse();

  if (req.method !== 'GET') {
    return methodNotAllowedResponse(requestId);
  }

  logger.info('Health check');

  return successResponse(
    {
      status: 'ok',
      service: 'retailx-edge',
      version: '2.0.0-milestone-a',
      timestamp: new Date().toISOString(),
    },
    requestId
  );
});
