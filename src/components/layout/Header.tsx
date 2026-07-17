import { ImageOff, KeyRound, Moon, Settings, SlidersHorizontal, Sun } from 'lucide-react';
import { useRef } from 'react';
import { booruSources } from '../../services/booru-adapters';
import { useSettingsStore } from '../../stores/settings-store';
import { FilterChipBar } from '../filter/FilterChipBar';
import { RatingQuickToggle } from '../filter/RatingQuickToggle';
import { SearchBar } from '../search/SearchBar';
import { AdvancedFilter } from '../search/AdvancedFilter';
import { useUiStore } from '../../stores/ui-store';
import { useI18n } from '../../i18n/runtime';
import { runAsync } from '../../services/notifications';

export function Header() {
  const { messages: { shell: shellMessages } } = useI18n();
  const theme = useSettingsStore((state) => state.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);
  const activeSource = useSettingsStore((state) => state.activeSource);
  const setActiveSource = useSettingsStore((state) => state.setActiveSource);
  const credential = useSettingsStore((state) => state.credentials[state.activeSource]);
  const filtersOpen = useUiStore((state) => state.advancedFiltersOpen);
  const toggleFilters = useUiStore((state) => state.toggleAdvancedFilters);
  const hideUnavailablePreviews = useSettingsStore((state) => state.hideUnavailablePreviews);
  const setHideUnavailablePreviews = useSettingsStore((state) => state.setHideUnavailablePreviews);
  const searchAreaRef = useRef<HTMLDivElement>(null);
  const view = useUiStore((state) => state.view);
  const themeLabel = theme === 'system' ? shellMessages.settings.followSystem : theme === 'light' ? shellMessages.settings.light : shellMessages.settings.dark;
  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');
  const openOptions = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) runAsync('api', chrome.runtime.openOptionsPage());
    else window.open('/src/options/index.html', '_blank', 'noopener,noreferrer');
  };
  const focusSearch = () => searchAreaRef.current?.querySelector('input')?.focus();

  return (
    <header className="app-header">
      <div className="brand-row">
        <div className="brand-block">
          <div className="brand-mark">D</div>
          <div><strong>{shellMessages.header.brandName}</strong><span>{shellMessages.header.brandEdition}</span></div>
        </div>
        {view === 'browse' && <div className="source-tabs" aria-label={shellMessages.header.sourceLabel}>
          {booruSources.map((source) => <button key={source.id} className={`source-tab ${activeSource === source.id ? 'is-active' : ''}`} onClick={() => setActiveSource(source.id)}>{source.name}{activeSource === source.id && <span className="live-dot" />}</button>)}
        </div>}
        <div className="header-tools">
          <span className={`auth-status ${credential?.username && credential.apiKey ? 'is-authenticated' : ''}`} title={credential?.username && credential.apiKey ? shellMessages.header.authenticatedAs(credential.username) : shellMessages.header.noCredentials}><KeyRound size={13} />{credential?.username && credential.apiKey ? shellMessages.header.authenticated : shellMessages.header.readOnly}</span>
          <button className="icon-button" title={shellMessages.header.theme(themeLabel)} onClick={toggleTheme}>{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button>
          <button className="icon-button" title={shellMessages.header.openSettings} onClick={openOptions}><Settings size={17} /></button>
        </div>
      </div>
      {view === 'browse' && <div className="search-row" ref={searchAreaRef}>
        <SearchBar />
          <RatingQuickToggle />
          <button className={`meta-shortcut ${filtersOpen ? 'is-active' : ''}`} aria-expanded={filtersOpen} aria-controls="advanced-filters" title={shellMessages.header.advancedFilters} onClick={toggleFilters}><SlidersHorizontal size={15} /> {shellMessages.header.filters}</button>
          <button className={`meta-shortcut preview-toggle ${hideUnavailablePreviews ? 'is-active' : ''}`} aria-pressed={hideUnavailablePreviews} title={shellMessages.header.hideUnavailablePreviews} onClick={() => setHideUnavailablePreviews(!hideUnavailablePreviews)}><ImageOff size={15} /> {shellMessages.header.hideUnavailable}</button>
      </div>}
      {view === 'browse' && <><AdvancedFilter open={filtersOpen} /><FilterChipBar onAddFilter={focusSearch} /></>}
    </header>
  );
}
