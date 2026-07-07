/**
 * RetailX V2 Sprint E1 — Server-side provisioning orchestrator (auth + RPC)
 */

import { createServiceSupabase, supabase } from '../supabase';
import { isFeatureEnabled, FEATURE_FLAGS } from '../infrastructure/feature-flag-client';
import { ProvisionError, mapProvisionError } from './errors';
import { provisionLogger } from './provision-logger';
import {
  buildIdempotencyKey,
  generateLegacyUsername,
  generateTemporaryPassword,
  validateProvisionInput,
} from './provision-validator';
import type { ProvisionShopInput, ProvisionShopResult } from './types';

interface RpcProvisionResult {
  shopId: string;
  ownerUserId: string;
  membershipId: string;
  branchId: string;
  warehouseId: string;
  subscriptionId: string;
  invitationId?: string | null;
  invitationSent?: boolean;
  idempotencyKey: string;
  planCode: string;
}

export async function orchestrateProvision(input: ProvisionShopInput): Promise<ProvisionShopResult> {
  validateProvisionInput(input);
  provisionLogger.clear();

  const idempotencyKey = buildIdempotencyKey(input);
  const temporaryPassword = input.temporaryPassword ?? generateTemporaryPassword();
  const username = input.username ?? generateLegacyUsername(input.shopName);
  const useInvitation = input.useInvitation ?? false;

  const serviceClient = createServiceSupabase(
    typeof process !== 'undefined' ? process.env.SUPABASE_SERVICE_ROLE_KEY : undefined
  );

  if (!serviceClient) {
    throw new ProvisionError(
      'EDGE_FUNCTION_UNAVAILABLE',
      'Service role required for provisioning. Deploy provision-shop edge function or run server-side.'
    );
  }

  const writeLegacy =
    (await isFeatureEnabled(FEATURE_FLAGS.WRITE_LEGACY_CREDENTIALS).catch(() => true)) ?? true;

  let createdUserId: string | null = null;

  try {
    provisionLogger.log('create_auth_user', 'started');

    const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
      email: input.ownerEmail.trim().toLowerCase(),
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { full_name: input.ownerName, shop_name: input.shopName },
    });

    if (authError) {
      if (authError.message?.toLowerCase().includes('already')) {
        throw new ProvisionError('EMAIL_ALREADY_EXISTS', authError.message);
      }
      throw new ProvisionError('AUTH_USER_CREATE_FAILED', authError.message);
    }

    createdUserId = authData.user?.id ?? null;
    if (!createdUserId) {
      throw new ProvisionError('AUTH_USER_CREATE_FAILED', 'No user id returned from auth');
    }

    provisionLogger.log('create_auth_user', 'completed', { userId: createdUserId });

    provisionLogger.log('provision_shop_rpc', 'started', { idempotencyKey });

    const { data, error } = await serviceClient.rpc('provision_shop', {
      p_idempotency_key: idempotencyKey,
      p_user_id: createdUserId,
      p_owner_email: input.ownerEmail.trim().toLowerCase(),
      p_owner_name: input.ownerName.trim(),
      p_owner_phone: input.phone.trim(),
      p_shop_name: input.shopName.trim(),
      p_address: input.address ?? null,
      p_city: input.city ?? null,
      p_state: input.state ?? null,
      p_gst_no: input.gst ?? null,
      p_category: input.category ?? null,
      p_plan_code: input.plan ?? 'starter',
      p_timezone: input.timezone ?? 'Asia/Kolkata',
      p_currency: input.currency ?? 'INR',
      p_username: username,
      p_password: temporaryPassword,
      p_write_legacy_credentials: writeLegacy,
      p_use_invitation: useInvitation,
      p_provisioned_by: input.provisionedBy ?? null,
    });

    if (error) {
      throw mapProvisionError(error);
    }

    const rpc = data as RpcProvisionResult;
    provisionLogger.log('provision_shop_rpc', 'completed', rpc as unknown as Record<string, unknown>);

    return {
      shopId: rpc.shopId,
      ownerUserId: rpc.ownerUserId,
      membershipId: rpc.membershipId,
      branchId: rpc.branchId,
      warehouseId: rpc.warehouseId,
      subscriptionId: rpc.subscriptionId,
      invitationId: rpc.invitationId ?? null,
      temporaryPassword: useInvitation ? undefined : temporaryPassword,
      invitationSent: !!rpc.invitationSent,
      idempotencyKey: rpc.idempotencyKey ?? idempotencyKey,
      planCode: rpc.planCode,
      username,
    };
  } catch (err) {
    if (createdUserId) {
      provisionLogger.log('rollback_auth_user', 'started', { userId: createdUserId });
      try {
        await serviceClient.auth.admin.deleteUser(createdUserId);
        provisionLogger.log('rollback_auth_user', 'completed');
      } catch (rollbackErr) {
        provisionLogger.log('rollback_auth_user', 'failed', {
          message: rollbackErr instanceof Error ? rollbackErr.message : 'unknown',
        });
      }
    }

    if (err instanceof ProvisionError && createdUserId) {
      throw new ProvisionError('ROLLBACK_COMPLETED', err.message, err.detail);
    }
    throw mapProvisionError(err);
  }
}

/** Invoke edge function from browser when service role unavailable */
export async function orchestrateProvisionViaEdge(
  input: ProvisionShopInput
): Promise<ProvisionShopResult> {
  validateProvisionInput(input);
  provisionLogger.clear();

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) {
    throw new ProvisionError('PROVISION_FAILED', 'Admin must be signed in to provision shops');
  }

  provisionLogger.log('edge_function', 'started');

  const { data, error } = await supabase.functions.invoke('provision-shop', {
    body: input,
    headers: { Authorization: `Bearer ${token}` },
  });

  if (error) {
    throw mapProvisionError(error);
  }

  if (data?.error) {
    throw new ProvisionError(data.error.code ?? 'PROVISION_FAILED', data.error.message ?? 'Provisioning failed');
  }

  provisionLogger.log('edge_function', 'completed');
  return data as ProvisionShopResult;
}
