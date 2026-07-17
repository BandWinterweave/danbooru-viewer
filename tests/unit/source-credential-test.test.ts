import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from '../../src/services/api/client';
import { testSourceAccess } from '../../src/services/source-credential-test';

const request = vi.fn();
const credentials = { username: 'user-7', apiKey: 'secret-key' };

describe('source credential tests', () => {
  beforeEach(() => request.mockReset());

  it('uses the Danbooru read-only profile endpoint with Basic auth credentials', async () => {
    request.mockResolvedValue({ id: 7, name: 'user-7' });
    await expect(testSourceAccess('danbooru', credentials, request)).resolves.toEqual({ code: 'source_reachable' });
    const [url, options] = request.mock.calls[0];
    expect(url.toString()).toBe('https://danbooru.donmai.us/profile.json');
    expect(options).toEqual({ credentials });
  });

  it.each([
    ['gelbooru', 'https://gelbooru.com/index.php'],
    ['rule34', 'https://api.rule34.xxx/index.php'],
  ] as const)('uses a read-only limit=1 %s query with its URL credential protocol', async (source, endpoint) => {
    request.mockResolvedValue([{ id: 1 }]);
    await expect(testSourceAccess(source, credentials, request)).resolves.toEqual({ code: 'source_reachable' });
    const [url, options] = request.mock.calls[0];
    expect(`${url.origin}${url.pathname}`).toBe(endpoint);
    expect(Object.fromEntries(url.searchParams)).toEqual({ page: 'dapi', s: 'post', q: 'index', json: '1', limit: '1', pid: '0', user_id: 'user-7', api_key: 'secret-key' });
    expect(options).toBeUndefined();
  });

  it('tests Safebooru public availability without credentials', async () => {
    request.mockResolvedValue({ post: [] });
    await expect(testSourceAccess('safebooru', credentials, request)).resolves.toEqual({ code: 'source_reachable_public' });
    const [url, options] = request.mock.calls[0];
    expect(url.origin).toBe('https://safebooru.org');
    expect(url.searchParams.has('user_id')).toBe(false);
    expect(url.searchParams.has('api_key')).toBe(false);
    expect(options).toBeUndefined();
  });

  it('reports Yande.re as reachable but unverified and sends no credentials', async () => {
    request.mockResolvedValue([]);
    await expect(testSourceAccess('yandere', credentials, request)).resolves.toEqual({ code: 'source_reachable_unverified' });
    const [url, options] = request.mock.calls[0];
    expect(url.toString()).toBe('https://yande.re/post.json?limit=1&page=1');
    expect(options).toBeUndefined();
  });

  it('does not issue authenticated-source requests when credentials are incomplete', async () => {
    await expect(testSourceAccess('gelbooru', { username: 'user', apiKey: '' }, request)).resolves.toEqual({ code: 'credentials_missing' });
    expect(request).not.toHaveBeenCalled();
  });

  it('classifies and sanitizes request failures', async () => {
    const cases = [
      [401, undefined, 'authentication_failed'],
      [403, undefined, 'permission_denied'],
      [429, undefined, 'rate_limited'],
      [503, undefined, 'source_unavailable'],
      [0, 'timeout', 'timeout'],
      [422, undefined, 'invalid_response'],
    ] as const;
    for (const [status, reason, code] of cases) {
      const error = new ApiRequestError('raw user-7 secret-key Authorization https://source.invalid', status, reason);
      const failingRequest = <T,>() => Promise.reject<T>(error);
      const result = await testSourceAccess('danbooru', credentials, failingRequest);
      expect(result).toEqual({ code });
      expect(JSON.stringify(result)).not.toMatch(/user-7|secret-key|Authorization|https:\/\//);
    }
  });

  it('classifies malformed successful payloads as invalid responses', async () => {
    request.mockResolvedValue('upstream raw body secret-key');
    await expect(testSourceAccess('rule34', credentials, request)).resolves.toEqual({ code: 'invalid_response' });
  });

  it.each([[], { post: [] }, { post: [null] }])('does not accept empty authenticated post responses as valid credentials', async (response) => {
    request.mockResolvedValue(response);
    await expect(testSourceAccess('gelbooru', credentials, request)).resolves.toEqual({ code: 'invalid_response' });
  });

  it('rejects a Danbooru profile belonging to another username', async () => {
    request.mockResolvedValue({ id: 8, user: { name: 'another-user' } });
    await expect(testSourceAccess('danbooru', credentials, request)).resolves.toEqual({ code: 'authentication_failed' });
  });

  it('classifies protocol-level authentication rejection without returning its body', async () => {
    request.mockResolvedValue('Missing authentication: secret-key');
    const result = await testSourceAccess('gelbooru', credentials, request);
    expect(result).toEqual({ code: 'authentication_failed' });
    expect(JSON.stringify(result)).not.toContain('secret-key');
  });
});
