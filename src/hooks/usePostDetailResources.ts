import { useCallback, useEffect, useRef, useState } from 'react';
import type { BooruAdapter, CommentRecord, Credentials, RelatedTagRecord } from '../types/api';
import type { PoolRecord, UnifiedPost } from '../types/post';
import { getMessages } from '../i18n/runtime-core';

export interface DetailResource<T> {
  status: 'unavailable' | 'loading' | 'success' | 'error';
  data: T;
  error: string | null;
  retry: () => void;
}

interface ResourceResult<T> { data: T; error?: string }

function useResource<T>(enabled: boolean, identity: string, initial: T, load: (signal: AbortSignal) => Promise<ResourceResult<T>>): DetailResource<T> {
  const [state, setState] = useState<Omit<DetailResource<T>, 'retry'> & { identity: string }>({ status: 'unavailable', data: initial, error: null, identity });
  const [attempt, setAttempt] = useState(0);
  const previousIdentity = useRef('');
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    if (!enabled) {
      previousIdentity.current = identity;
      setState({ status: 'unavailable', data: initial, error: null, identity });
      return;
    }
    const changed = previousIdentity.current !== identity;
    previousIdentity.current = identity;
    setState((current) => ({ status: 'loading', data: changed ? initial : current.data, error: null, identity }));
    const controller = new AbortController();
    void load(controller.signal).then(
      (result) => { if (!controller.signal.aborted) setState({ status: result.error ? 'error' : 'success', data: result.data, error: result.error ?? null, identity }); },
      (error: unknown) => {
        if (!controller.signal.aborted) setState((current) => ({ status: 'error', data: current.data, error: error instanceof Error ? error.message : getMessages().posts.common.requestFailed, identity }));
      },
    );
    return () => controller.abort();
  }, [attempt, enabled, identity, initial, load]);

  const visible = state.identity === identity ? state : { status: enabled ? 'loading' as const : 'unavailable' as const, data: initial, error: null };
  return { ...visible, retry };
}

const EMPTY_COMMENTS: CommentRecord[] = [];
const EMPTY_RELATED: RelatedTagRecord[] = [];
const EMPTY_POOLS: PoolRecord[] = [];
const EMPTY_RELATIONS: UnifiedPost[] = [];

export function usePostDetailResources(open: boolean, post: UnifiedPost | null, adapter: BooruAdapter | null, credentials?: Credentials, credentialRevision = 0) {
  const postKey = post ? `${post.source}:${post.id}` : '';
  const credentialKey = credentials ? `credential-${credentialRevision}` : 'public';
  const leadTag = post?.tags.find((tag) => tag.category === 'artist')?.name ?? post?.tags.find((tag) => tag.category === 'general')?.name ?? '';
  const poolKey = post?.poolIds?.join(',') ?? '';
  const relationKey = post ? `${post.parentId ?? ''}:${post.hasChildren}` : '';

  const loadComments = useCallback(async (signal: AbortSignal) => ({ data: await adapter!.getComments!(post!.id, credentials, signal) }), [adapter, credentials, post?.id]);
  const loadRelated = useCallback(async (signal: AbortSignal) => ({ data: await adapter!.getRelatedTags!(leadTag, credentials, signal) }), [adapter, credentials, leadTag]);
  const loadPools = useCallback(async (signal: AbortSignal) => ({ data: await adapter!.getPools!(poolKey.split(',').filter(Boolean).map(Number), credentials, signal) }), [adapter, credentials, poolKey]);
  const loadRelations = useCallback(async (signal: AbortSignal): Promise<ResourceResult<UnifiedPost[]>> => {
    const requests: Promise<UnifiedPost | UnifiedPost[]>[] = [];
    if (post!.parentId) requests.push(adapter!.getPost(post!.parentId, credentials, signal));
    if (post!.hasChildren && adapter!.getChildren) requests.push(adapter!.getChildren(post!.id, credentials, signal));
    const settled = await Promise.allSettled(requests);
    const data = settled.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
    const failed = settled.filter((result) => result.status === 'rejected');
    return { data, error: failed.length ? getMessages().posts.detail.relatedRequestsFailed(failed.length) : undefined };
  }, [adapter, credentials, post?.hasChildren, post?.id, post?.parentId]);

  const comments = useResource(open && Boolean(post && adapter?.getComments), `${postKey}:${credentialKey}:comments`, EMPTY_COMMENTS, loadComments);
  const relatedTags = useResource(open && Boolean(post && leadTag && adapter?.getRelatedTags), `${postKey}:${credentialKey}:${leadTag}`, EMPTY_RELATED, loadRelated);
  const pools = useResource(open && Boolean(post?.poolIds?.length && adapter?.getPools), `${postKey}:${credentialKey}:${poolKey}`, EMPTY_POOLS, loadPools);
  const relations = useResource(open && Boolean(post && adapter && (post.parentId || post.hasChildren && adapter.getChildren)), `${postKey}:${credentialKey}:${relationKey}`, EMPTY_RELATIONS, loadRelations);
  return { comments, relatedTags, pools, relations };
}
