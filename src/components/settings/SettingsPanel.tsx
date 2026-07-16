import { FormEvent, useEffect, useState } from 'react';
import { Check, KeyRound } from 'lucide-react';
import { useSettingsStore, type Theme } from '../../stores/settings-store';
import { booruSources } from '../../services/booru-adapters';
import type { BooruSource } from '../../types/post';
import { useTheme } from '../../hooks/useTheme';
import { shellMessages } from '../../i18n/en-shell';

const copyCategories = [
  ['artist', shellMessages.settings.artists], ['character', shellMessages.settings.characters], ['copyright', shellMessages.settings.copyrights], ['general', shellMessages.settings.general], ['meta', shellMessages.settings.meta],
] as const;

export function SettingsPanel() {
  useTheme();
  const settings = useSettingsStore();
  const [source, setSource] = useState<BooruSource>(settings.activeSource);
  const [username, setUsername] = useState(settings.credentials[source]?.username ?? '');
  const [apiKey, setApiKey] = useState(settings.credentials[source]?.apiKey ?? '');
  const [saved, setSaved] = useState(false);

  useEffect(() => { setUsername(settings.credentials[source]?.username ?? ''); setApiKey(settings.credentials[source]?.apiKey ?? ''); }, [settings.credentials, source]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    settings.setCredentials(source, username, apiKey);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  return (
    <main className="settings-page">
      <header><div className="brand-mark">D</div><div><span>{shellMessages.settings.brandName}</span><h1>{shellMessages.settings.title}</h1></div></header>
      <section className="settings-section"><div><h2>{shellMessages.settings.appearance}</h2><p>{shellMessages.settings.appearanceDescription}</p></div><div className="settings-controls"><label>{shellMessages.settings.theme}<select value={settings.theme} onChange={(event) => settings.setTheme(event.target.value as Theme)}><option value="system">{shellMessages.settings.followSystem}</option><option value="light">{shellMessages.settings.light}</option><option value="dark">{shellMessages.settings.dark}</option></select></label><label>{shellMessages.settings.defaultColumns}<input type="number" min="2" max="8" value={settings.columns} onChange={(event) => settings.setColumns(Number(event.target.value))} /></label></div></section>
      <section className="settings-section"><div><h2>{shellMessages.settings.downloadsAndPlayback}</h2><p>{shellMessages.settings.filenameVariables}</p></div><div className="settings-controls"><label>{shellMessages.settings.filenameRule}<input value={settings.downloadRule} onChange={(event) => settings.setDownloadRule(event.target.value)} /></label><label>{shellMessages.settings.slideshowInterval}<input type="number" min="2" max="30" value={settings.slideshowInterval} onChange={(event) => settings.setSlideshowInterval(Number(event.target.value))} /></label><label className="checkbox-setting"><input type="checkbox" checked={settings.keyboardEnabled} onChange={(event) => settings.setKeyboardEnabled(event.target.checked)} /> {shellMessages.settings.enableKeyboardShortcuts}</label></div></section>
      <section className="settings-section"><div><h2>{shellMessages.settings.tagCopy}</h2><p>{shellMessages.settings.tagCopyDescription}</p></div><div className="settings-controls"><div className="category-checkboxes">{copyCategories.map(([category, label]) => <label className="checkbox-setting" key={category}><input type="checkbox" checked={settings.copyTagCategories.includes(category)} onChange={(event) => settings.setCopyTagCategory(category, event.target.checked)} /><span className="category-option"><span className={`category-swatch category-${category}`} />{label}</span></label>)}</div><label className="checkbox-setting"><input type="checkbox" checked={settings.copyTagsUseUnderscores} onChange={(event) => settings.setCopyTagsUseUnderscores(event.target.checked)} /> {shellMessages.settings.keepUnderscores}</label><label className="checkbox-setting"><input type="checkbox" checked={settings.copyTagsEscapeParentheses} onChange={(event) => settings.setCopyTagsEscapeParentheses(event.target.checked)} /> {shellMessages.settings.escapeParentheses}</label></div></section>
      <section className="settings-section"><div><h2>{shellMessages.settings.sourceAccess}</h2><p>{shellMessages.settings.sourceAccessDescription}</p></div><form className="settings-controls" onSubmit={submit}><label>{shellMessages.settings.source}<select value={source} onChange={(event) => setSource(event.target.value as BooruSource)}>{booruSources.map((item) => <option key={item.id} value={item.id}>{item.name}{item.supportsAuth ? '' : shellMessages.settings.publicOnly}</option>)}</select></label><label>{source === 'gelbooru' || source === 'rule34' ? shellMessages.settings.userId : shellMessages.settings.username}<input value={username} autoComplete="username" disabled={!booruSources.find((item) => item.id === source)?.supportsAuth} onChange={(event) => setUsername(event.target.value)} /></label><label>{shellMessages.settings.apiKey}<input value={apiKey} type="password" autoComplete="current-password" disabled={!booruSources.find((item) => item.id === source)?.supportsAuth} onChange={(event) => setApiKey(event.target.value)} /></label><button className="primary-button" type="submit" disabled={!booruSources.find((item) => item.id === source)?.supportsAuth}>{saved ? <Check size={16} /> : <KeyRound size={16} />}{saved ? shellMessages.settings.saved : shellMessages.settings.saveCredentials}</button></form></section>
    </main>
  );
}
