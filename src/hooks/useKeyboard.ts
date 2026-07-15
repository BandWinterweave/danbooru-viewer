import { useEffect } from 'react';
import { booruSources, getBooruAdapter } from '../services/booru-adapters';
import { downloadPost, downloadPosts } from '../services/download-service';
import { useFavoriteStore } from '../stores/favorite-store';
import { useFilterStore } from '../stores/filter-store';
import { usePostStore } from '../stores/post-store';
import { useSettingsStore } from '../stores/settings-store';
import { useUiStore } from '../stores/ui-store';

function isTyping(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  return Boolean(element?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element?.tagName ?? ''));
}

export function useKeyboard() {
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.id && chrome.commands?.getAll) {
      void chrome.commands.getAll().then((commands) => {
        const slideshow = commands.find((command) => command.name === 'toggle-slideshow');
        if (slideshow && !slideshow.shortcut) useUiStore.getState().setShortcutNotice('Ctrl+Shift+S is occupied. Reassign it at chrome://extensions/shortcuts.');
      });
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const settings = useSettingsStore.getState();
      if (!settings.keyboardEnabled || (isTyping(event.target) && !(event.ctrlKey && event.key.toLowerCase() === 'k'))) return;
      const key = event.key.toLowerCase();
      const ui = useUiStore.getState();
      const postState = usePostStore.getState();
      const current = ui.currentPost;
      if (event.ctrlKey && event.shiftKey && key === 's') {
        event.preventDefault();
        if (!ui.viewerOpen && current) ui.openViewer(current);
        window.setTimeout(() => window.dispatchEvent(new Event('danbooru-toggle-slideshow')), 0);
        return;
      }
      if (event.ctrlKey && event.shiftKey && key === 'f') { event.preventDefault(); ui.toggleAdvancedFilters(); return; }
      if (event.ctrlKey && event.shiftKey && key === 'c') { event.preventDefault(); useFilterStore.getState().clearAll(); return; }
      if (event.ctrlKey && key === 'k') { event.preventDefault(); document.querySelector<HTMLInputElement>('#main-search')?.focus(); return; }
      if (event.ctrlKey && key === 'a') { event.preventDefault(); postState.selectAll(); return; }
      if (event.ctrlKey && key === 'd') {
        event.preventDefault();
        const selected = postState.posts.filter((post) => postState.selectedPostKeys.includes(`${post.source}:${post.id}`));
        if (selected.length) void downloadPosts(selected, 'full', settings.downloadRule);
        return;
      }
      if (key === 'escape') { if (ui.viewerOpen) ui.closeViewer(); else if (ui.detailOpen) ui.closeDetail(); else useFilterStore.getState().clearAll(); return; }
      if (key === 'f' && current) { void useFavoriteStore.getState().toggleLocal(current); return; }
      if (key === 'd' && current) { void downloadPost(current, 'full', settings.downloadRule); return; }
      if (ui.viewerOpen) return;
      if ((key === 'arrowleft' || key === 'arrowright') && current) {
        const index = postState.posts.findIndex((post) => post.id === current.id && post.source === current.source);
        const next = postState.posts[index + (key === 'arrowright' ? 1 : -1)];
        if (next) ui.openDetail(next);
        return;
      }
      if ((key === 'arrowup' || key === 'arrowdown') && current) {
        const credential = settings.credentials[current.source];
        const adapter = getBooruAdapter(current.source);
        if (credential?.username && credential.apiKey && adapter.vote) { event.preventDefault(); void adapter.vote(current.id, key === 'arrowup' ? 1 : -1, credential); }
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
