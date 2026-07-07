/**
 * RetailX V2 Milestone D1.2 — MockAuthRepository tests
 */

import { describe, it, expect } from 'vitest';
import { MockAuthRepository } from './MockAuthRepository';
import { createAuthError } from '../errors';

describe('MockAuthRepository', () => {
  it('resolves V1 identity', async () => {
    const repo = new MockAuthRepository({
      supabaseUser: { id: 'u1', email: 'a@b.com' },
      profile: { userId: 'u1', shopId: 's1', role: 'shop_owner' },
    });

    const identity = await repo.resolveIdentity({ useMembershipAuth: false });
    expect(identity?.user.shop_id).toBe('s1');
  });

  it('signIn establishes session', async () => {
    const repo = new MockAuthRepository({
      supabaseUser: { id: 'u1', email: 'a@b.com' },
      profile: { userId: 'u1', shopId: 's1', role: 'shop_owner' },
    });

    await repo.signIn('a@b.com', 'ok');
    const session = await repo.getSession();
    expect(session?.userId).toBe('u1');
  });

  it('signIn throws typed error on failure', async () => {
    const repo = new MockAuthRepository({
      supabaseUser: { id: 'u1', email: 'a@b.com' },
      signInShouldFail: true,
    });

    await expect(repo.signIn('a@b.com', 'ok')).rejects.toMatchObject({
      code: 'AUTH_INVALID_CREDENTIALS',
    });
  });

  it('fetchV1Profile throws AUTH_USER_NOT_FOUND when missing', async () => {
    const repo = new MockAuthRepository({
      supabaseUser: { id: 'u1', email: 'a@b.com' },
      profile: null,
    });

    await expect(repo.fetchV1Profile('u1')).rejects.toEqual(
      createAuthError('AUTH_USER_NOT_FOUND')
    );
  });
});
