import { KeyRound, Moon, Settings, SlidersHorizontal, Sun } from 'lucide-react';
import { useRef } from 'react';
import { booruSources } from '../../services/booru-adapters';
import { useSettingsStore } from '../../stores/settings-store';
import { FilterChipBar } from '../filter/FilterChipBar';
import { RatingQuickToggle } from '../filter/RatingQuickToggle';
import { SearchBar } from '../search/SearchBar';
import { AdvancedFilter } from '../search/AdvancedFilter';
import { useUiStore } from '../../stores/ui-store';

export function Header() {
  const theme = useSettingsStore((state) => state.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);
  const activeSource = useSettingsStore((state) => state.activeSource);
  const setActiveSource = useSettingsStore((state) => state.setActiveSource);
  const credential = useSettingsStore((state) => state.credentials[state.activeSource]);
  const filtersOpen = useUiStore((state) => state.advancedFiltersOpen);
  const toggleFilters = useUiStore((state) => state.toggleAdvancedFilters);
  const shortcutNotice = useUiStore((state) => state.shortcutNotice);
  const searchAreaRef = useRef<HTMLDivElement>(null);
  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');
  const openOptions = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) void chrome.runtime.openOptionsPage();
    else window.open('/src/options/index.html', '_blank', 'noopener,noreferrer');
  };
  const focusSearch = () => searchAreaRef.current?.querySelector('input')?.focus();

  return (
    <header className="app-header">
      <div className="brand-row">
        <div className="brand-block">
          <div className="brand-mark">D</div>
          <div><strong>Danbooru</strong><span>VIEWER / 01</span></div>
        </div>
        <div className="source-tabs" aria-label="Booru source">
          {booruSources.map((source) => <button key={source.id} className={`source-tab ${activeSource === source.id ? 'is-active' : ''}`} onClick={() => setActiveSource(source.id)}>{source.name}{activeSource === source.id && <span className="live-dot" />}</button>)}
        </div>
        <div className="header-tools">
          <span className={`auth-status ${credential?.username && credential.apiKey ? 'is-authenticated' : ''}`} title={credential?.username && credential.apiKey ? `Authenticated as ${credential.username}` : 'No API credentials for this source'}><KeyRound size={13} />{credential?.username && credential.apiKey ? 'AUTH' : 'READ-ONLY'}</span>
          <button className="icon-button" title={`Theme: ${theme}`} onClick={toggleTheme}>{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button>
          <button className="icon-button" title="Open settings" onClick={openOptions}><Settings size={17} /></button>
        </div>
      </div>
      <div className="search-row" ref={searchAreaRef}>
        <SearchBar />
        <RatingQuickToggle />
          <button className={`meta-shortcut ${filtersOpen ? 'is-active' : ''}`} title="Advanced filters" onClick={toggleFilters}><SlidersHorizontal size={15} /> Filters</button>
      </div>
      <AdvancedFilter open={filtersOpen} />
      <FilterChipBar onAddFilter={focusSearch} />
      {shortcutNotice && <div className="shortcut-notice" role="status">{shortcutNotice}</div>}
    </header>
  );
}
