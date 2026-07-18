import { FormEvent, useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { getBooruAdapter } from '../../services/booru-adapters';
import { useFilterStore } from '../../stores/filter-store';
import { usePostStore } from '../../stores/post-store';
import { useSettingsStore } from '../../stores/settings-store';
import type { TagAutocompleteResult } from '../../types/api';
import { useI18n } from '../../i18n/runtime';
import { cacheSuggestions, getCachedSuggestions } from '../../services/booru-adapters/tag-suggestion-cache';
import { rememberTagMetadata } from '../../services/booru-adapters/tag-categories';
import { applyKnownSuggestionCategories, ensureCanonicalTagMetadata } from '../../services/booru-adapters/tag-enrichment';

export function SearchBar() {
  const { locale, messages: { shell: shellMessages } } = useI18n();
  const searchText = useFilterStore((state) => state.searchText);
  const setSearchText = useFilterStore((state) => state.setSearchText);
  const addSearchFilters = useFilterStore((state) => state.addSearchFilters);
  const getSearchQuery = useFilterStore((state) => state.getSearchQuery);
  const searchPosts = usePostStore((state) => state.search);
  const credentials = useSettingsStore((state) => state.credentials.danbooru);
  const [suggestions, setSuggestions] = useState<TagAutocompleteResult[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = 'main-search-suggestions';

  useEffect(() => {
    const lastTerm = searchText.trim().split(/\s+/).at(-1)?.replace(/^-/, '') ?? '';
    if (lastTerm.length < 2) { setSuggestions([]); return; }
    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      const cached = await getCachedSuggestions('danbooru', lastTerm);
      if (cancelled) return;
       if (cached?.items.length) {
         await ensureCanonicalTagMetadata('danbooru', cached.items.map((item) => item.name)).catch(() => undefined);
         setSuggestions(applyKnownSuggestionCategories('danbooru', cached.items)); setOpen(true); setActiveIndex(0);
       }
      if (cached && !cached.stale) return;
      try {
        const result = await getBooruAdapter('danbooru').autocomplete(lastTerm, credentials?.username && credentials.apiKey ? credentials : undefined, controller.signal);
        await ensureCanonicalTagMetadata('danbooru', result.map((item) => item.name)).catch(() => undefined);
        const categorized = applyKnownSuggestionCategories('danbooru', result);
        await Promise.all([
          cacheSuggestions('danbooru', lastTerm, categorized),
          rememberTagMetadata('danbooru', result.map((item) => ({ name: item.name, category: item.category, postCount: item.postCount }))),
        ]);
        if (!cancelled) { setSuggestions(categorized); setOpen(true); setActiveIndex(categorized.length ? 0 : -1); }
      } catch {
        if (!cancelled && !cached) setSuggestions([]);
      }
    }, 350);
    return () => { cancelled = true; controller.abort(); window.clearTimeout(timeout); };
  }, [credentials, searchText]);

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    setOpen(false);
    if (searchText.trim()) addSearchFilters(searchText);
    else void searchPosts(getSearchQuery());
  };

  const selectSuggestion = (name: string) => {
    const terms = searchText.trim().split(/\s+/);
    const excluded = terms.at(-1)?.startsWith('-');
    terms[terms.length - 1] = `${excluded ? '-' : ''}${name}`;
    addSearchFilters(terms.join(' '));
    setOpen(false);
    setActiveIndex(-1);
  };

  const navigateSuggestions = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') { setOpen(false); setActiveIndex(-1); return; }
    if (!suggestions.length || !open) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((current) => (current + direction + suggestions.length) % suggestions.length);
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      selectSuggestion(suggestions[activeIndex].name);
    }
  };

  return (
    <form className="search-form" onSubmit={submit} role="search">
      <Search className="search-icon" size={19} />
      <input
        ref={inputRef}
        id="main-search"
        value={searchText}
        onChange={(event) => setSearchText(event.target.value)}
        onFocus={() => setOpen(Boolean(suggestions.length))}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        placeholder={shellMessages.search.placeholder}
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open && suggestions.length > 0}
        aria-controls={listboxId}
        aria-activedescendant={open && activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
        onKeyDown={navigateSuggestions}
      />
      {searchText && <button type="button" className="search-clear" title={shellMessages.search.clear} onClick={() => { setSearchText(''); inputRef.current?.focus(); }}><X size={16} /></button>}
      <button type="submit" className="search-submit">{shellMessages.search.submit}</button>
      {open && suggestions.length > 0 && (
        <div className="suggestions" id={listboxId} role="listbox">
          {suggestions.map((suggestion, index) => (
            <button type="button" id={`${listboxId}-${index}`} role="option" aria-selected={activeIndex === index} className={activeIndex === index ? 'is-active' : ''} data-category={suggestion.category} key={suggestion.name} onMouseEnter={() => setActiveIndex(index)} onMouseDown={() => selectSuggestion(suggestion.name)}>
              <span>{suggestion.name.replaceAll('_', ' ')}</span>
               <small>{suggestion.postCount.toLocaleString(locale)}</small>
            </button>
          ))}
        </div>
      )}
    </form>
  );
}
