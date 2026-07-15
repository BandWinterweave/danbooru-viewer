import { FormEvent, useEffect, useState } from 'react';
import { Check, KeyRound } from 'lucide-react';
import { useSettingsStore, type Theme } from '../../stores/settings-store';
import { booruSources } from '../../services/booru-adapters';
import type { BooruSource } from '../../types/post';

const copyCategories = [
  ['artist', 'Artists'], ['character', 'Characters'], ['copyright', 'Copyrights'], ['general', 'General'], ['meta', 'Meta'],
] as const;

export function SettingsPanel() {
  const settings = useSettingsStore();
  const [source, setSource] = useState<BooruSource>(settings.activeSource);
  const [username, setUsername] = useState(settings.credentials[source]?.username ?? '');
  const [apiKey, setApiKey] = useState(settings.credentials[source]?.apiKey ?? '');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme === 'system'
      ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : settings.theme;
  }, [settings.theme]);

  useEffect(() => { setUsername(settings.credentials[source]?.username ?? ''); setApiKey(settings.credentials[source]?.apiKey ?? ''); }, [settings.credentials, source]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    settings.setCredentials(source, username, apiKey);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  return (
    <main className="settings-page">
      <header><div className="brand-mark">D</div><div><span>DANBOORU VIEWER</span><h1>Settings</h1></div></header>
      <section className="settings-section"><div><h2>Appearance</h2><p>Choose how the browsing workspace is rendered.</p></div><div className="settings-controls"><label>Theme<select value={settings.theme} onChange={(event) => settings.setTheme(event.target.value as Theme)}><option value="system">Follow system</option><option value="light">Light</option><option value="dark">Dark</option></select></label><label>Default columns<input type="number" min="2" max="8" value={settings.columns} onChange={(event) => settings.setColumns(Number(event.target.value))} /></label></div></section>
      <section className="settings-section"><div><h2>Downloads and playback</h2><p>Filename variables: {'{id}'}, {'{tags}'}, {'{artist}'}, {'{rating}'}, {'{source}'}, {'{size}'}.</p></div><div className="settings-controls"><label>Filename rule<input value={settings.downloadRule} onChange={(event) => settings.setDownloadRule(event.target.value)} /></label><label>Slideshow interval (seconds)<input type="number" min="2" max="30" value={settings.slideshowInterval} onChange={(event) => settings.setSlideshowInterval(Number(event.target.value))} /></label><label className="checkbox-setting"><input type="checkbox" checked={settings.keyboardEnabled} onChange={(event) => settings.setKeyboardEnabled(event.target.checked)} /> Enable keyboard shortcuts</label></div></section>
      <section className="settings-section"><div><h2>Tag copy</h2><p>Choose which Danbooru tag categories are copied and how prompt syntax is formatted.</p></div><div className="settings-controls"><div className="category-checkboxes">{copyCategories.map(([category, label]) => <label className="checkbox-setting" key={category}><input type="checkbox" checked={settings.copyTagCategories.includes(category)} onChange={(event) => settings.setCopyTagCategory(category, event.target.checked)} /><span className="category-option"><span className={`category-swatch category-${category}`} />{label}</span></label>)}</div><label className="checkbox-setting"><input type="checkbox" checked={settings.copyTagsUseUnderscores} onChange={(event) => settings.setCopyTagsUseUnderscores(event.target.checked)} /> Keep underscores</label><label className="checkbox-setting"><input type="checkbox" checked={settings.copyTagsEscapeParentheses} onChange={(event) => settings.setCopyTagsEscapeParentheses(event.target.checked)} /> Escape parentheses as \( \)</label></div></section>
      <section className="settings-section"><div><h2>Source access</h2><p>Credentials are isolated by source and stored only in chrome.storage.local. Gelbooru and Rule34 require a user ID and API key for post queries.</p></div><form className="settings-controls" onSubmit={submit}><label>Source<select value={source} onChange={(event) => setSource(event.target.value as BooruSource)}>{booruSources.map((item) => <option key={item.id} value={item.id}>{item.name}{item.supportsAuth ? '' : ' (public only)'}</option>)}</select></label><label>{source === 'gelbooru' || source === 'rule34' ? 'User ID' : 'Username'}<input value={username} autoComplete="username" disabled={!booruSources.find((item) => item.id === source)?.supportsAuth} onChange={(event) => setUsername(event.target.value)} /></label><label>API key<input value={apiKey} type="password" autoComplete="current-password" disabled={!booruSources.find((item) => item.id === source)?.supportsAuth} onChange={(event) => setApiKey(event.target.value)} /></label><button className="primary-button" type="submit" disabled={!booruSources.find((item) => item.id === source)?.supportsAuth}>{saved ? <Check size={16} /> : <KeyRound size={16} />}{saved ? 'Saved' : 'Save credentials'}</button></form></section>
    </main>
  );
}
