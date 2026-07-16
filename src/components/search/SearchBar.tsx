import { FormEvent, useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { getBooruAdapter } from '../../services/booru-adapters';
import { useFilterStore } from '../../stores/filter-store';
import { usePostStore } from '../../stores/post-store';
import { useSettingsStore } from '../../stores/settings-store';
import type { TagAutocompleteResult } from '../../types/api';
import { shellMessages } from '../../i18n/en-shell';

const suggestionCache = new Map<string, { expiresAt: number; items: TagAutocompleteResult[] }>();

export function SearchBar() {
  const searchText = useFilterStore((state) => state.searchText);
  const setSearchText = useFilterStore((state) => state.setSearchText);
  const addSearchFilters = useFilterStore((state) => state.addSearchFilters);
  const getSearchQuery = useFilterStore((state) => state.getSearchQuery);
  const searchPosts = usePostStore((state) => state.search);
  const activeSource = useSettingsStore((state) => state.activeSource);
  const credentials = useSettingsStore((state) => state.credentials[state.activeSource]);
  const [suggestions, setSuggestions] = useState<TagAutocompleteResult[]>([]);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const lastTerm = searchText.trim().split(/\s+/).at(-1)?.replace(/^-/, '') ?? '';
    if (lastTerm.length < 2) { setSuggestions([]); return; }
    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      try {
        const cacheKey = `${activeSource}:${lastTerm.toLowerCase()}`;
        const cached = suggestionCache.get(cacheKey);
        const result = cached && cached.expiresAt > Date.now() ? cached.items : await getBooruAdapter(activeSource).autocomplete(lastTerm, credentials?.username && credentials.apiKey ? credentials : undefined);
        if (!cached || cached.expiresAt <= Date.now()) suggestionCache.set(cacheKey, { expiresAt: Date.now() + 300_000, items: result });
        if (!cancelled) { setSuggestions(result); setOpen(true); }
      } catch {
        if (!cancelled) setSuggestions([]);
      }
    }, 150);
    return () => { cancelled = true; window.clearTimeout(timeout); };
  }, [activeSource, credentials, searchText]);

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
      />
      {searchText && <button type="button" className="search-clear" title={shellMessages.search.clear} onClick={() => { setSearchText(''); inputRef.current?.focus(); }}><X size={16} /></button>}
      <button type="submit" className="search-submit">{shellMessages.search.submit}</button>
      {open && suggestions.length > 0 && (
        <div className="suggestions" role="listbox">
          {suggestions.map((suggestion) => (
            <button type="button" role="option" data-category={suggestion.category === 1 ? 'artist' : suggestion.category === 3 ? 'copyright' : suggestion.category === 4 ? 'character' : suggestion.category === 5 ? 'meta' : 'general'} key={suggestion.name} onMouseDown={() => selectSuggestion(suggestion.name)}>
              <span>{suggestion.name.replaceAll('_', ' ')}</span>
              <small>{suggestion.postCount.toLocaleString()}</small>
            </button>
          ))}
        </div>
      )}
    </form>
  );
}
