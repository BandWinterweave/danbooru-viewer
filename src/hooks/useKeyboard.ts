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
      if (ui.comfyOpen) return;
      const postState = usePostStore.getState();
      const current = ui.currentPost;
      const actionTarget = ui.detailOpen ? current : ui.hoveredPost;
      if (event.ctrlKey && key === 'k') { event.preventDefault(); document.querySelector<HTMLInputElement>('#main-search')?.focus(); return; }
      if (event.ctrlKey && key === 'a') { event.preventDefault(); postState.selectAll(); return; }
      if (event.ctrlKey && key === 'd') {
        event.preventDefault();
        const selected = postState.posts.filter((post) => postState.selectedPostKeys.includes(`${post.source}:${post.id}`));
        if (selected.length) runAsync('download', downloadPosts(selected, 'full', settings.downloadRule));
        return;
      }
      if (key === 'escape') {
        if (ui.detailOpen) ui.closeDetail();
        else if (ui.advancedFiltersOpen) ui.closeAdvancedFilters();
        else if (ui.sidebarOpen) ui.setSidebarOpen(false);
        else useFilterStore.getState().clearAll();
        return;
      }
      if ((key === 'f' || key === 'd') && event.repeat) return;
      if (key === 'f' && actionTarget) { event.preventDefault(); runAsync('storage', useFavoriteStore.getState().toggleLocal(actionTarget)); return; }
      if (key === 'd' && actionTarget) { event.preventDefault(); runAsync('download', downloadPost(actionTarget, actionTarget.fileExt === 'zip' && actionTarget.playbackUrl ? 'playback' : 'full', settings.downloadRule)); return; }
      if ((key === 'arrowleft' || key === 'arrowright') && current && ui.detailOpen && ui.detailContext === 'browse') {
        event.preventDefault();
        if (!event.repeat && current) void postState.navigateDetail(current, key === 'arrowright' ? 1 : -1).then((next) => { if (next) useUiStore.getState().setCurrentPost(next); });
        return;
      }
      if ((key === 'arrowup' || key === 'arrowdown') && current) {
        const credential = settings.credentials[current.source];
        const adapter = getBooruAdapter(current.source);
        if (credential?.username && credential.apiKey && adapter.vote) { event.preventDefault(); runAsync('api', adapter.vote(current.id, key === 'arrowup' ? 1 : -1, credential)); }
        return;
      }
      if (key === 'c' && !event.repeat) { event.preventDefault(); ui.openComfy(); return; }
      if (key === 's') { ui.toggleSidebar(); return; }
      if (key === 'g' || key === 'l' || key === 'm') { settings.setLayout(key === 'g' ? 'grid' : key === 'l' ? 'list' : 'masonry'); return; }
      if (/^[1-5]$/.test(key)) settings.setActiveSource(booruSources[Number(key) - 1].id);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
