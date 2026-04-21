import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

describe('session helpers', () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null when no session cookie present', async () => {
    vi.doMock('next/headers', () => ({
      cookies: async () => ({
        get: (_: string) => undefined,
      }),
    }));
    const mod = await import('@/lib/auth/session');
    await expect(mod.getSession()).resolves.toBeNull();
    await expect(mod.getAdminSession()).resolves.toBeNull();
  });

  it('returns a user session with role cookie', async () => {
    const map: Record<string, string> = {
      loftly_session: 'tok',
      loftly_role: 'user',
    };
    vi.doMock('next/headers', () => ({
      cookies: async () => ({
        get: (k: string) => (map[k] ? { value: map[k] } : undefined),
      }),
    }));
    const mod = await import('@/lib/auth/session');
    await expect(mod.getSession()).resolves.toEqual({
      accessToken: 'tok',
      role: 'user',
    });
    // non-admin → admin helper returns null
    await expect(mod.getAdminSession()).resolves.toBeNull();
  });

  it('getAdminSession returns session when role=admin', async () => {
    const map: Record<string, string> = {
      loftly_session: 'tok',
      loftly_role: 'admin',
    };
    vi.doMock('next/headers', () => ({
      cookies: async () => ({
        get: (k: string) => (map[k] ? { value: map[k] } : undefined),
      }),
    }));
    const mod = await import('@/lib/auth/session');
    await expect(mod.getAdminSession()).resolves.toEqual({
      accessToken: 'tok',
      role: 'admin',
    });
  });
});
