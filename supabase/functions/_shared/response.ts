/**
 * RetailX V2 — Edge Function shared response helpers
 */

import { corsHeaders as baseCorsHeaders } from './cors.ts';

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  requestId?: string;
}

export interface ApiSuccessBody<T = unknown> {
  data: T;
  requestId?: string;
}

const JSON_HEADERS = {
  'Content-Type': 'application/json',
};

export function jsonResponse<T>(
  body: T,
  status = 200,
  extraHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...baseCorsHeaders, ...extraHeaders },
  });
}

export function successResponse<T>(
  data: T,
  requestId?: string,
  status = 200
): Response {
  const body: ApiSuccessBody<T> = { data, requestId };
  return jsonResponse(body, status);
}

export function errorResponse(
  code: string,
  message: string,
  status = 400,
  details?: Record<string, unknown>,
  requestId?: string
): Response {
  const body: ApiErrorBody = {
    error: { code, message, details },
    requestId,
  };
  return jsonResponse(body, status);
}

export function unauthorizedResponse(requestId?: string): Response {
  return errorResponse('UNAUTHORIZED', 'Authentication required', 401, undefined, requestId);
}

export function forbiddenResponse(requestId?: string): Response {
  return errorResponse('FORBIDDEN', 'Insufficient permissions', 403, undefined, requestId);
}

export function notFoundResponse(resource = 'Resource', requestId?: string): Response {
  return errorResponse('NOT_FOUND', `${resource} not found`, 404, undefined, requestId);
}

export function internalErrorResponse(requestId?: string): Response {
  return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500, undefined, requestId);
}

export function methodNotAllowedResponse(requestId?: string): Response {
  return errorResponse('METHOD_NOT_ALLOWED', 'HTTP method not allowed', 405, undefined, requestId);
}

export function optionsResponse(): Response {
  return new Response(null, { status: 204, headers: baseCorsHeaders });
}
