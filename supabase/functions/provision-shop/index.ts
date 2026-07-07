/**
 * RetailX V2 Sprint E1 — provision-shop Edge Function
 *
 * Admin-authenticated one-click shop provisioning with service role.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { handleCors } from '../_shared/cors.ts';
import { jsonResponse, errorResponse } from '../_shared/response.ts';
import { createLogger } from '../_shared/logging.ts';
import { authenticateRequest } from '../_shared/auth.ts';

interface ProvisionBody {
  shopName: string;
  ownerName: string;
  ownerEmail: string;
  phone: string;
  address?: string;
  city?: string;
  state?: string;
  gst?: string;
  category?: string;
  plan?: string;
  timezone?: string;
  currency?: string;
  username?: string;
  temporaryPassword?: string;
  useInvitation?: boolean;
  idempotencyKey?: string;
}

function buildIdempotencyKey(input: ProvisionBody): string {
  if (input.idempotencyKey?.trim()) return input.idempotencyKey.trim();
  const normalized = `${input.ownerEmail.trim().toLowerCase()}::${input.shopName.trim().toLowerCase()}`;
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0;
  }
  return `provision-${Math.abs(hash).toString(36)}`;
}

function generatePassword(): string {
  const words = ['shop', 'pos', 'retail', 'store'];
  return `${words[Math.floor(Math.random() * words.length)]}@${Math.floor(1000 + Math.random() * 9000)}`;
}

function mapErrorCode(message: string): string {
  if (message.includes('EMAIL_ALREADY_EXISTS')) return 'EMAIL_ALREADY_EXISTS';
  if (message.includes('SHOP_ALREADY_EXISTS')) return 'SHOP_ALREADY_EXISTS';
  if (message.includes('INVALID_PLAN')) return 'INVALID_PLAN';
  return 'PROVISION_FAILED';
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const requestId = req.headers.get('x-request-id') ?? crypto.randomUUID();
  const logger = createLogger('provision-shop', { requestId });

  try {
    const auth = await authenticateRequest(req, requestId);
    if (auth instanceof Response) return auth;

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const body = (await req.json()) as ProvisionBody;

    if (!body.shopName?.trim() || !body.ownerEmail?.trim() || !body.ownerName?.trim() || !body.phone?.trim()) {
      return errorResponse('VALIDATION_FAILED', 'Missing required fields', 400, undefined, requestId);
    }

    const idempotencyKey = buildIdempotencyKey(body);
    const temporaryPassword = body.temporaryPassword ?? generatePassword();
    const username =
      body.username ??
      body.shopName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) + Math.floor(Math.random() * 100);

    let userId: string | null = null;

    try {
      const { data: authData, error: authError } = await admin.auth.admin.createUser({
        email: body.ownerEmail.trim().toLowerCase(),
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: { full_name: body.ownerName, shop_name: body.shopName },
      });

      if (authError) {
        const code = authError.message?.toLowerCase().includes('already')
          ? 'EMAIL_ALREADY_EXISTS'
          : 'AUTH_USER_CREATE_FAILED';
        return errorResponse(code, authError.message, 409, undefined, requestId);
      }

      userId = authData.user?.id ?? null;
      if (!userId) {
        return errorResponse('AUTH_USER_CREATE_FAILED', 'No user id returned', 500, undefined, requestId);
      }

      const { data, error } = await admin.rpc('provision_shop', {
        p_idempotency_key: idempotencyKey,
        p_user_id: userId,
        p_owner_email: body.ownerEmail.trim().toLowerCase(),
        p_owner_name: body.ownerName.trim(),
        p_owner_phone: body.phone.trim(),
        p_shop_name: body.shopName.trim(),
        p_address: body.address ?? null,
        p_city: body.city ?? null,
        p_state: body.state ?? null,
        p_gst_no: body.gst ?? null,
        p_category: body.category ?? null,
        p_plan_code: body.plan ?? 'starter',
        p_timezone: body.timezone ?? 'Asia/Kolkata',
        p_currency: body.currency ?? 'INR',
        p_username: username,
        p_password: temporaryPassword,
        p_write_legacy_credentials: true,
        p_use_invitation: body.useInvitation ?? false,
        p_provisioned_by: auth.user.id !== 'service-role' ? auth.user.id : null,
      });

      if (error) {
        throw error;
      }

      logger.info('Shop provisioned', { shopId: data?.shopId, requestId });

      return jsonResponse(
        {
          ...data,
          temporaryPassword: body.useInvitation ? undefined : temporaryPassword,
          username,
          invitationSent: !!body.useInvitation,
        },
        200,
        { 'x-request-id': requestId }
      );
    } catch (innerErr) {
      if (userId) {
        await admin.auth.admin.deleteUser(userId);
        logger.warn('Rolled back auth user after RPC failure', { userId, requestId });
      }
      const message = innerErr instanceof Error ? innerErr.message : String(innerErr);
      const code = mapErrorCode(message);
      if (userId) {
        return errorResponse('ROLLBACK_COMPLETED', message, 500, undefined, requestId);
      }
      return errorResponse(code, message, code === 'EMAIL_ALREADY_EXISTS' ? 409 : 500, undefined, requestId);
    }
  } catch (err) {
    logger.error('Provision failed', { error: String(err) });
    return errorResponse('PROVISION_FAILED', String(err), 500, undefined, requestId);
  }
});
