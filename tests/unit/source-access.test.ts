import { describe, expect, it } from 'vitest';
import { resolveSourceAccess } from '../../src/services/booru-adapters/source-access';

describe('source access', () => {
  it('models authentication policy and capabilities from the adapter', () => {
    expect(resolveSourceAccess('safebooru')).toMatchObject({ authenticated: false, authPolicy: 'none' });
    expect(resolveSourceAccess('gelbooru')).toMatchObject({ authenticated: false, authPolicy: 'required', capabilities: { addFavorite: true, removeFavorite: false } });
    expect(resolveSourceAccess('danbooru', { username: 'user', apiKey: 'key' })).toMatchObject({ authenticated: true, authPolicy: 'optional', capabilities: { vote: true, comment: true, pools: true, relations: true } });
  });

  it('normalizes incomplete credentials', () => {
    expect(resolveSourceAccess('danbooru', { username: 'user', apiKey: '' }).credentials).toBeUndefined();
  });
});
