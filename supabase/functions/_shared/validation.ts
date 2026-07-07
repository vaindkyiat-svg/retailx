/**
 * RetailX V2 — Edge Function shared validation helpers
 */

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly code = 'VALIDATION_ERROR'
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function requireString(value: unknown, field: string, minLength = 1): string {
  if (typeof value !== 'string' || value.trim().length < minLength) {
    throw new ValidationError(`${field} must be a non-empty string`, field);
  }
  return value.trim();
}

export function requireUuid(value: unknown, field: string): string {
  const str = requireString(value, field);
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(str)) {
    throw new ValidationError(`${field} must be a valid UUID`, field, 'INVALID_UUID');
  }
  return str;
}

export function optionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') {
    throw new ValidationError('Expected string value');
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function requireBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    throw new ValidationError(`${field} must be a boolean`, field);
  }
  return value;
}

export async function parseJsonBody<T = Record<string, unknown>>(req: Request): Promise<T> {
  const contentType = req.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new ValidationError('Content-Type must be application/json', 'content-type', 'INVALID_CONTENT_TYPE');
  }

  try {
    return (await req.json()) as T;
  } catch {
    throw new ValidationError('Invalid JSON body', 'body', 'INVALID_JSON');
  }
}

export function validateAllowedMethods(req: Request, allowed: string[]): void {
  if (!allowed.includes(req.method)) {
    throw new ValidationError(`Method ${req.method} not allowed`, 'method', 'METHOD_NOT_ALLOWED');
  }
}
