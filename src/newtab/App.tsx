import { useEffect } from 'react';
import { AppShell } from '../components/layout/AppShell';
import { PostGrid } from '../components/posts/PostGrid';
import { useFilterStore } from '../stores/filter-store';
import { usePostStore } from '../stores/post-store';
import { useSettingsStore } from '../stores/settings-store';
import { useFavoriteStore } from '../stores/favorite-store';
import { useKeyboard } from '../hooks/useKeyboard';
import { ToastViewport } from '../components/feedback/ToastViewport';
import { useTheme } from '../hooks/useTheme';
import { runAsync } from '../services/notifications';

export default function App() {
  useKeyboard();
  useTheme();
  const filters = useFilterStore((state) => state.activeFilters);
  const ratings = useFilterStore((state) => state.ratings);
  const activeSource = useSettingsStore((state) => state.activeSource);
  const meta = useFilterStore((state) => state.meta);

  useEffect(() => { runAsync('storage', useFavoriteStore.getState().hydrate()); }, []);

  useEffect(() => {
    void usePostStore.getState().search(useFilterStore.getState().getSearchQuery());
    return () => usePostStore.getState().cancelSearch();
  }, [activeSource, filters, ratings, meta]);

  return <><AppShell><PostGrid /></AppShell><ToastViewport /></>;
}
