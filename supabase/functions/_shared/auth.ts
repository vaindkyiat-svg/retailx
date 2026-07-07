/**
 * RetailX V2 — Edge Function shared auth middleware (scaffold only)
 * Full membership-based auth deferred to Milestone B.
 */

import { createClient, type SupabaseClient, type User } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { unauthorizedResponse, forbiddenResponse } from './response.ts';
import { createLogger } from './logging.ts';

export interface AuthContext {
  user: User;
  supabase: SupabaseClient;
  requestId: string;
  token: string;
}

export interface AuthMiddlewareOptions {
  requireServiceRole?: boolean;
  allowedRoles?: string[];
}

function getSupabaseAdmin(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function getSupabaseUser(token: string): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anonKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  }
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
}

export function extractBearerToken(req: Request): string | null {
  const header = req.headers.get('Authorization') ?? req.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7).trim();
}

/**
 * Authenticate request and return context, or a Response on failure.
 */
export async function authenticateRequest(
  req: Request,
  requestId: string,
  options: AuthMiddlewareOptions = {}
): Promise<AuthContext | Response> {
  const logger = createLogger('auth-middleware', { requestId });

  if (options.requireServiceRole) {
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const token = extractBearerToken(req);
    if (!token || token !== serviceKey) {
      logger.warn('Service role auth failed');
      return unauthorizedResponse(requestId);
    }
    const supabase = getSupabaseAdmin();
    return {
      user: { id: 'service-role' } as User,
      supabase,
      requestId,
      token,
    };
  }

  const token = extractBearerToken(req);
  if (!token) {
    logger.warn('Missing bearer token');
    return unauthorizedResponse(requestId);
  }

  const supabase = getSupabaseUser(token);
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    logger.warn('Invalid token', { error: error?.message });
    return unauthorizedResponse(requestId);
  }

  if (options.allowedRoles?.length) {
    // Role check stub — full RBAC in Milestone B
    logger.debug('Role check skipped (Milestone A scaffold)', { roles: options.allowedRoles });
  }

  return { user: data.user, supabase, requestId, token };
}

export function requireAuth(
  handler: (req: Request, ctx: AuthContext) => Promise<Response>
) {
  return async (req: Request): Promise<Response> => {
    const requestId = req.headers.get('x-request-id') ?? crypto.randomUUID();
    const auth = await authenticateRequest(req, requestId);
    if (auth instanceof Response) return auth;
    return handler(req, auth);
  };
}

export async function requirePlatformAdmin(
  _ctx: AuthContext
): Promise<Response | null> {
  // Stub — returns null (authorized) until membership RBAC is implemented
  return null;
}

export function checkPlatformAdmin(ctx: AuthContext): Response | null {
  // Synchronous stub for pre-handler checks
  if (!ctx.user?.id) return forbiddenResponse(ctx.requestId);
  return null;
}
