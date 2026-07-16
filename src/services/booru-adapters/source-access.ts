import type { BooruAdapter, Credentials } from '../../types/api';
import type { BooruSource } from '../../types/post';
import { getBooruAdapter } from '.';

export interface SourceAccess {
  source: BooruSource;
  adapter: BooruAdapter;
  credentials?: Credentials;
  authenticated: boolean;
  authPolicy: 'none' | 'optional' | 'required';
  capabilities: {
    addFavorite: boolean;
    removeFavorite: boolean;
    vote: boolean;
    comment: boolean;
    relatedTags: boolean;
    pools: boolean;
    relations: boolean;
  };
}

export function resolveSourceAccess(source: BooruSource, credentials?: Credentials): SourceAccess {
  const adapter = getBooruAdapter(source);
  const validCredentials = credentials?.username && credentials.apiKey ? { ...credentials } : undefined;
  return {
    source,
    adapter,
    credentials: validCredentials,
    authenticated: Boolean(validCredentials),
    authPolicy: source === 'gelbooru' || source === 'rule34' ? 'required' : adapter.supportsAuth ? 'optional' : 'none',
    capabilities: {
      addFavorite: Boolean(adapter.addFavorite),
      removeFavorite: Boolean(adapter.removeFavorite),
      vote: Boolean(adapter.vote),
      comment: Boolean(adapter.getComments),
      relatedTags: Boolean(adapter.getRelatedTags),
      pools: Boolean(adapter.getPools),
      relations: Boolean(adapter.getChildren),
    },
  };
}
