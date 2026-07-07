/**
 * RetailX V2 Milestone D1.2 — Supabase auth repository
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthSession } from '../types';
import { mapSupabaseSession } from '../session';
import { resolveIdentity } from '../identity/resolve-identity';
import type { IdentityContext } from '../identity/types';
import { logRepositoryEvent } from './repository-logger';
import { mapSupabaseAuthError, mapProfileFetchError } from './map-errors';
import type {
  IAuthRepository,
  MembershipRecord,
  ResolveIdentityOptions,
  SupabaseAuthUser,
  V1ProfileRecord,
} from './interfaces';

export class SupabaseAuthRepository implements IAuthRepository {
  constructor(private readonly client: SupabaseClient) {}

  async signIn(email: string, password: string): Promise<void> {
    logRepositoryEvent('debug', 'Repository signIn request', { email: maskEmail(email) });

    const { data, error } = await this.client.auth.signInWithPassword({ email, password });

    if (error) {
      logRepositoryEvent('warn', 'Repository signIn failed', { code: error.name });
      throw mapSupabaseAuthError(error);
    }

    if (!data.user) {
      throw mapSupabaseAuthError(null);
    }

    logRepositoryEvent('debug', 'Repository signIn succeeded', { userId: data.user.id });
  }

  async signOut(): Promise<void> {
    logRepositoryEvent('debug', 'Repository signOut request');

    const { error } = await this.client.auth.signOut();
    if (error) {
      logRepositoryEvent('warn', 'Repository signOut failed');
      throw mapSupabaseAuthError(error);
    }
  }

  async getSession(): Promise<AuthSession | null> {
    const { data, error } = await this.client.auth.getSession();
    if (error) {
      logRepositoryEvent('warn', 'Repository getSession failed');
      throw mapSupabaseAuthError(error);
    }
    return mapSupabaseSession(data.session);
  }

  async refreshSession(): Promise<AuthSession | null> {
    const { data, error } = await this.client.auth.refreshSession();
    if (error) {
      logRepositoryEvent('warn', 'Repository refreshSession failed');
      throw mapSupabaseAuthError(error);
    }
    return mapSupabaseSession(data.session);
  }

  async getCurrentUser(): Promise<SupabaseAuthUser | null> {
    const { data, error } = await this.client.auth.getUser();

    if (error) {
      logRepositoryEvent('debug', 'Repository getUser returned error', { code: error.name });
      return null;
    }

    if (!data.user) return null;

    return {
      id: data.user.id,
      email: data.user.email ?? '',
      userMetadata: data.user.user_metadata as Record<string, unknown> | undefined,
    };
  }

  async fetchV1Profile(userId: string): Promise<V1ProfileRecord | null> {
    logRepositoryEvent('debug', 'Fetching V1 profile', { userId });

    const { data, error } = await this.client
      .from('user_profiles')
      .select('id, shop_id, role, email, full_name, created_at')
      .eq('id', userId)
      .single();

    if (error || !data) {
      logRepositoryEvent('warn', 'V1 profile fetch failed', { userId, code: error?.code });
      throw mapProfileFetchError(error);
    }

    return {
      userId: data.id,
      shopId: data.shop_id ?? undefined,
      role: (data.role as 'shop_owner' | 'admin') ?? 'shop_owner',
      email: data.email ?? undefined,
      fullName: data.full_name ?? undefined,
      createdAt: data.created_at ?? undefined,
    };
  }

  async fetchMemberships(userId: string): Promise<MembershipRecord[]> {
    logRepositoryEvent('debug', 'Fetching memberships', { userId });

    const { data, error } = await this.client
      .from('memberships')
      .select('id, shop_id, user_id, is_primary, status, system_roles(slug)')
      .eq('user_id', userId)
      .eq('status', 'active')
      .is('deleted_at', null);

    if (error) {
      logRepositoryEvent('warn', 'Membership fetch failed', { userId, code: error.code });
      return [];
    }

    if (!data?.length) return [];

    return data.map((row) => {
      const role = row.system_roles as { slug?: string } | { slug?: string }[] | null;
      const slug = Array.isArray(role) ? role[0]?.slug : role?.slug;
      return {
        id: row.id,
        shopId: row.shop_id,
        userId: row.user_id,
        roleSlug: slug ?? 'shop_owner',
        isPrimary: row.is_primary ?? false,
        status: row.status as MembershipRecord['status'],
      };
    });
  }

  async resolveIdentity(options: ResolveIdentityOptions): Promise<IdentityContext | null> {
    const supabaseUser = await this.getCurrentUser();
    if (!supabaseUser) return null;

    let profile: V1ProfileRecord | null = null;
    try {
      profile = await this.fetchV1Profile(supabaseUser.id);
    } catch (err) {
      if (options.useMembershipAuth) {
        logRepositoryEvent('debug', 'V1 profile missing; attempting V2 resolution', {
          userId: supabaseUser.id,
        });
      } else {
        throw err;
      }
    }

    const memberships = options.useMembershipAuth
      ? await this.fetchMemberships(supabaseUser.id)
      : [];

    const identity = resolveIdentity({
      userId: supabaseUser.id,
      email: supabaseUser.email,
      name:
        profile?.fullName ??
        (supabaseUser.userMetadata?.full_name as string | undefined) ??
        supabaseUser.email,
      createdAt: profile?.createdAt,
      useMembershipAuth: options.useMembershipAuth,
      profile: profile
        ? {
            userId: profile.userId,
            shopId: profile.shopId,
            role: profile.role,
            email: profile.email,
          }
        : null,
      memberships,
    });

    logRepositoryEvent('debug', 'Identity resolved', {
      userId: supabaseUser.id,
      mode: identity?.resolutionMode ?? 'none',
    });

    return identity;
  }

  async fetchMainBranchCode(shopId: string): Promise<string | null> {
    try {
      const { data, error } = await this.client
        .from('branches')
        .select('code')
        .eq('shop_id', shopId)
        .eq('code', 'MAIN')
        .maybeSingle();

      if (error || !data) return null;
      return data.code ?? null;
    } catch {
      return null;
    }
  }
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  return `${local.slice(0, 2)}***@${domain}`;
}
