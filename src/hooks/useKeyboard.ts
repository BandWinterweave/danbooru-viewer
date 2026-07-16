import { useEffect } from 'react';
import { booruSources, getBooruAdapter } from '../services/booru-adapters';
import { downloadPost, downloadPosts } from '../services/download-service';
import { useFavoriteStore } from '../stores/favorite-store';
import { useFilterStore } from '../stores/filter-store';
import { usePostStore } from '../stores/post-store';
import { useSettingsStore } from '../stores/settings-store';
import { useUiStore } from '../stores/ui-store';
import { runAsync } from '../services/notifications';

function isTyping(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  return Boolean(element?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element?.tagName ?? ''));
}

export function useKeyboard() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const settings = useSettingsStore.getState();
      if (!settings.keyboardEnabled || (isTyping(event.target) && !(event.ctrlKey && event.key.toLowerCase() === 'k'))) return;
      const key = event.key.toLowerCase();
      const ui = useUiStore.getState();
      const postState = usePostStore.getState();
      const current = ui.currentPost;
      if (event.ctrlKey && key === 'k') { event.preventDefault(); document.querySelector<HTMLInputElement>('#main-search')?.focus(); return; }
      if (event.ctrlKey && key === 'a') { event.preventDefault(); postState.selectAll(); return; }
      if (event.ctrlKey && key === 'd') {
        event.preventDefault();
        const selected = postState.posts.filter((post) => postState.selectedPostKeys.includes(`${post.source}:${post.id}`));
        if (selected.length) runAsync('download', downloadPosts(selected, 'full', settings.downloadRule));
        return;
      }
      if (key === 'escape') { if (ui.detailOpen) ui.closeDetail(); else useFilterStore.getState().clearAll(); return; }
      if (key === 'f' && current) { runAsync('storage', useFavoriteStore.getState().toggleLocal(current)); return; }
      if (key === 'd' && current && ui.detailOpen) { runAsync('download', downloadPost(current, current.fileExt === 'zip' && current.playbackUrl ? 'playback' : 'full', settings.downloadRule)); return; }
      if ((key === 'arrowleft' || key === 'arrowright') && current && ui.detailOpen) {
        event.preventDefault();
        if (!event.repeat) void postState.navigateDetail(key === 'arrowright' ? 1 : -1);
        return;
      }
      if ((key === 'arrowup' || key === 'arrowdown') && current) {
        const credential = settings.credentials[current.source];
        const adapter = getBooruAdapter(current.source);
        if (credential?.username && credential.apiKey && adapter.vote) { event.preventDefault(); runAsync('api', adapter.vote(current.id, key === 'arrowup' ? 1 : -1, credential)); }
        return;
      }
      if (key === 's') { ui.toggleSidebar(); return; }
      if (key === 'g' || key === 'l' || key === 'm') { settings.setLayout(key === 'g' ? 'grid' : key === 'l' ? 'list' : 'masonry'); return; }
      if (/^[1-5]$/.test(key)) settings.setActiveSource(booruSources[Number(key) - 1].id);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
