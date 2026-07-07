/**
 * RetailX V2 Sprint E2 — Shop provisioning (mirrors provision-orchestrator)
 */

import { randomUUID } from 'node:crypto';

function buildIdempotencyKey(email, shopName) {
  const normalized = `${email.trim().toLowerCase()}::${shopName.trim().toLowerCase()}`;
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0;
  }
  return `golden-${Math.abs(hash).toString(36)}-${Date.now().toString(36)}`;
}

function generatePassword() {
  return `pos@${Math.floor(1000 + Math.random() * 9000)}`;
}

function generateUsername(shopName) {
  const base =
    shopName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .slice(0, 12) || 'shop';
  return `${base}${Math.floor(Math.random() * 100000)}`;
}

/**
 * Full V2 provisioning: auth user + provision_shop RPC
 */
export async function provisionShop(serviceClient, input) {
  const email = input.ownerEmail.trim().toLowerCase();
  const temporaryPassword = input.temporaryPassword ?? generatePassword();
  const username = input.username ?? generateUsername(input.shopName);
  const idempotencyKey = input.idempotencyKey ?? buildIdempotencyKey(email, input.shopName);

  let createdUserId = null;

  try {
    const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { full_name: input.ownerName, shop_name: input.shopName },
    });

    if (authError) {
      if (authError.message?.toLowerCase().includes('already')) {
        throw new Error(`EMAIL_ALREADY_EXISTS: ${authError.message}`);
      }
      throw new Error(`AUTH_USER_CREATE_FAILED: ${authError.message}`);
    }

    createdUserId = authData.user?.id ?? null;
    if (!createdUserId) {
      throw new Error('AUTH_USER_CREATE_FAILED: No user id returned');
    }

    const { data, error } = await serviceClient.rpc('provision_shop', {
      p_idempotency_key: idempotencyKey,
      p_user_id: createdUserId,
      p_owner_email: email,
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
      p_write_legacy_credentials: true,
      p_use_invitation: false,
      p_provisioned_by: input.provisionedBy ?? null,
    });

    if (error) {
      const msg = error.message ?? String(error);
      if (/Could not find the function.*provision_shop/i.test(msg)) {
        throw new Error(
          'PROVISION_FAILED: provision_shop RPC not deployed. Run: npm run db:migrate (requires DATABASE_URL)'
        );
      }
      throw new Error(`PROVISION_FAILED: ${msg}`);
    }

    return {
      shopId: data.shopId,
      ownerUserId: data.ownerUserId ?? createdUserId,
      membershipId: data.membershipId,
      branchId: data.branchId,
      warehouseId: data.warehouseId,
      subscriptionId: data.subscriptionId,
      temporaryPassword,
      username,
      idempotencyKey,
      ownerEmail: email,
    };
  } catch (err) {
    if (createdUserId) {
      try {
        await serviceClient.auth.admin.deleteUser(createdUserId);
      } catch {
        // best-effort rollback
      }
    }
    throw err;
  }
}

export function uniqueShopInput(prefix = 'Golden') {
  const suffix = randomUUID().slice(0, 8);
  return {
    shopName: `${prefix} Shop ${suffix}`,
    ownerName: 'Golden Path Owner',
    ownerEmail: `golden-${suffix}@retailx-test.com`,
    phone: '9876543210',
    address: '123 Test Street',
    city: 'Lucknow',
    state: 'UP',
    gst: '09TEST1234F1Z5',
    category: 'Sweets',
    plan: 'starter',
  };
}
