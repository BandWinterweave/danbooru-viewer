import { useEffect, useState } from 'react';
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
import { FavoriteLibrary } from '../components/favorites/FavoriteLibrary';
import { useUiStore } from '../stores/ui-store';

export default function App() {
  useKeyboard();
  useTheme();
  const filters = useFilterStore((state) => state.activeFilters);
  const ratings = useFilterStore((state) => state.ratings);
  const activeSource = useSettingsStore((state) => state.activeSource);
  const meta = useFilterStore((state) => state.meta);
  const view = useUiStore((state) => state.view);
  const [searchStoresHydrated, setSearchStoresHydrated] = useState(() => useSettingsStore.persist.hasHydrated() && useFilterStore.persist.hasHydrated());

  useEffect(() => { runAsync('storage', useFavoriteStore.getState().hydrate()); }, []);

  useEffect(() => {
    const update = () => setSearchStoresHydrated(useSettingsStore.persist.hasHydrated() && useFilterStore.persist.hasHydrated());
    const unsubscribeSettings = useSettingsStore.persist.onFinishHydration(update);
    const unsubscribeFilters = useFilterStore.persist.onFinishHydration(update);
    update();
    return () => { unsubscribeSettings(); unsubscribeFilters(); };
  }, []);

  useEffect(() => {
    if (view !== 'browse' || !searchStoresHydrated) return;
    void usePostStore.getState().search(useFilterStore.getState().getSearchQuery());
    return () => usePostStore.getState().cancelSearch();
  }, [activeSource, filters, ratings, meta, searchStoresHydrated, view]);

  return <><AppShell>{view === 'browse' ? <PostGrid /> : <FavoriteLibrary />}</AppShell><ToastViewport /></>;
}
