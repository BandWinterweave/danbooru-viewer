import { useEffect } from 'react';
import { AppShell } from '../components/layout/AppShell';
import { PostGrid } from '../components/posts/PostGrid';
import { useFilterStore } from '../stores/filter-store';
import { usePostStore } from '../stores/post-store';
import { useSettingsStore } from '../stores/settings-store';
import { useFavoriteStore } from '../stores/favorite-store';
import { useKeyboard } from '../hooks/useKeyboard';

export default function App() {
  useKeyboard();
  const filters = useFilterStore((state) => state.activeFilters);
  const ratings = useFilterStore((state) => state.ratings);
  const theme = useSettingsStore((state) => state.theme);
  const activeSource = useSettingsStore((state) => state.activeSource);
  const meta = useFilterStore((state) => state.meta);

  useEffect(() => { void useFavoriteStore.getState().hydrate(); }, []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => document.documentElement.dataset.theme = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme;
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  useEffect(() => {
    void usePostStore.getState().search(useFilterStore.getState().getSearchQuery());
  }, [activeSource, filters, ratings, meta]);

  return <AppShell><PostGrid /></AppShell>;
}
