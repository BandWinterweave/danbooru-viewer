import { notify } from '../notifications';
import { useComfyStore } from '../../stores/comfy-store';
import type { UnifiedPost } from '../../types/post';
import { getMessages } from '../../i18n/runtime-core';
import { normalizePostMedia } from './media';
import { ComfyStorage } from './storage';
import { useUiStore } from '../../stores/ui-store';

export async function sendPostsToComfy(posts: UnifiedPost[], collectionId?: string): Promise<boolean> {
  const messages = getMessages().comfy;
  if (!posts.length) return false;
  const state = useComfyStore.getState();
  if (!state.hydrated) await state.hydrate();
  if (!useComfyStore.getState().workflows.some((workflow) => workflow.active)) {
    notify({ tone: 'warning', title: messages.noWorkflow, description: messages.noWorkflowBody });
    useUiStore.getState().openComfy();
    return false;
  }
  if (posts.length > 50 && !window.confirm(messages.confirmBatch(posts.length))) return false;
  const batchId = crypto.randomUUID();
  const dynamicPosts = posts.filter((post) => ['gif', 'zip', 'mp4', 'webm', 'mov', 'mkv'].includes(post.fileExt.toLowerCase()));
  const staticPosts = posts.filter((post) => !dynamicPosts.includes(post));
  if (dynamicPosts.length) {
    const storage = new ComfyStorage();
    await storage.initialize();
    const inputs = [];
    for (const post of dynamicPosts) {
      const media = await normalizePostMedia(post);
      const record = await storage.putInputBlob(media.blob, media.filename, media.mediaType);
      inputs.push({ kind: 'blob' as const, blobKey: record.key, name: media.filename, mediaType: media.mediaType, sourceLabel: `${post.source} #${post.id}`, post });
    }
    await useComfyStore.getState().request({ type: 'COMFY_ENQUEUE_FILES', payload: { inputs, batchId } });
  }
  if (staticPosts.length) {
    if (collectionId) await useComfyStore.getState().request({ type: 'COMFY_ENQUEUE_COLLECTION', payload: { collectionId, posts: staticPosts, batchId } });
    else await useComfyStore.getState().request({ type: 'COMFY_ENQUEUE_POSTS', payload: { posts: staticPosts, batchId } });
  }
  notify({ tone: 'success', title: messages.sent, description: messages.tasksAdded(posts.length) });
  return true;
}
