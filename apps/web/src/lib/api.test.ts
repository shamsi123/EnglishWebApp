import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const OLD_ENV = import.meta.env.VITE_API_URL;

function mockFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const fn = vi.fn(handler);
  vi.stubGlobal('fetch', fn);
  return fn;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('api client', () => {
  beforeEach(() => {
    vi.resetModules();
    import.meta.env.VITE_API_URL = 'http://localhost:5080/api/v1';
  });
  afterEach(() => {
    import.meta.env.VITE_API_URL = OLD_ENV;
    vi.unstubAllGlobals();
  });

  it('reports disabled when VITE_API_URL is unset', async () => {
    import.meta.env.VITE_API_URL = '';
    const api = await import('./api');
    expect(api.apiEnabled).toBe(false);
    await expect(api.login('a@b.com', 'x')).rejects.toThrow();
  });

  it('posts registration with the exact contract shape', async () => {
    const fetchMock = mockFetch(() => json({ accessToken: 'a', refreshToken: 'r', parentId: 'p1' }));
    const api = await import('./api');
    const res = await api.register('Parent@Example.com', 'secret123', true, 'en');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:5080/api/v1/auth/register',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ email: 'Parent@Example.com', password: 'secret123', consentGiven: true, locale: 'en' }) }),
    );
    expect(res).toEqual({ accessToken: 'a', refreshToken: 'r', parentId: 'p1' });
  });

  it('rejects with the response body on a non-2xx status', async () => {
    mockFetch(() => new Response('bad email', { status: 400 }));
    const api = await import('./api');
    await expect(api.login('x', 'y')).rejects.toMatchObject({ status: 400, message: 'bad email' });
  });

  it('attaches the bearer token to authenticated calls', async () => {
    const fetchMock = mockFetch(() => json({ id: 'c1', nickname: 'Sara', ageBand: '4-6', avatar: { animal: '🦊', color: '#fff', item: 'none' }, hasPin: false, dailyLimitMinutes: 20 }));
    const api = await import('./api');
    api.setTokens({ access: 'tok', refresh: 'ref' });
    await api.createChild({ id: 'c1', nickname: 'Sara', ageBand: '4-6', avatar: { animal: '🦊', color: '#fff', item: 'none' }, picturePinHash: null });
    const [, init] = fetchMock.mock.calls[0]!;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });

  it('refreshes once on a 401 and retries the original call', async () => {
    let calls = 0;
    const fetchMock = mockFetch((url) => {
      calls++;
      if (url.toString().endsWith('/auth/refresh')) return json({ accessToken: 'new', refreshToken: 'new-r', parentId: 'p1' });
      if (calls === 1) return new Response('expired', { status: 401 });
      return json({ acceptedIds: ['a1'] });
    });
    const api = await import('./api');
    api.setTokens({ access: 'old', refresh: 'ref' });
    const refreshed = vi.fn();
    api.setOnRefresh(refreshed);
    const res = await api.submitAttemptsBatch([]);
    expect(res).toEqual({ acceptedIds: ['a1'] });
    expect(refreshed).toHaveBeenCalledWith({ access: 'new', refresh: 'new-r' });
    expect(fetchMock).toHaveBeenCalledTimes(3); // original (401) + refresh + retry
    const lastCall = fetchMock.mock.calls.at(-1)!;
    expect((lastCall[1].headers as Record<string, string>).Authorization).toBe('Bearer new');
  });

  it('rejects an authenticated call when no session token is set', async () => {
    const api = await import('./api');
    api.setTokens(null);
    await expect(api.createChild({ id: 'c1', nickname: 'Sara', ageBand: '4-6', avatar: { animal: '🦊', color: '#fff', item: 'none' }, picturePinHash: null })).rejects.toThrow();
  });
});
