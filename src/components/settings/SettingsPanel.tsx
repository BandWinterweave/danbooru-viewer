import { FormEvent, useEffect, useRef, useState } from 'react';
import { Check, KeyRound, LoaderCircle, PlugZap, Sparkles } from 'lucide-react';
import { useSettingsStore, type DetailImageQuality, type Language, type Theme, type ThumbnailQuality } from '../../stores/settings-store';
import { booruSources } from '../../services/booru-adapters';
import type { BooruSource } from '../../types/post';
import { useTheme } from '../../hooks/useTheme';
import { useI18n } from '../../i18n/runtime';
import { testSourceAccess, type SourceTestCode } from '../../services/source-credential-test';
import { useComfyStore } from '../../stores/comfy-store';

export function SettingsPanel() {
  useTheme();
  const { messages: { shell: shellMessages, comfy: comfyMessages } } = useI18n();
  const settings = useSettingsStore();
  const copyCategories = [
    ['artist', shellMessages.settings.artists], ['character', shellMessages.settings.characters], ['copyright', shellMessages.settings.copyrights], ['general', shellMessages.settings.general], ['meta', shellMessages.settings.meta],
  ] as const;
  const [source, setSource] = useState<BooruSource>(settings.activeSource);
  const [username, setUsername] = useState(settings.credentials[source]?.username ?? '');
  const [apiKey, setApiKey] = useState(settings.credentials[source]?.apiKey ?? '');
  const [saved, setSaved] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'result'>('idle');
  const [testResult, setTestResult] = useState<SourceTestCode | null>(null);
  const [comfySaved, setComfySaved] = useState(false);
  const testRun = useRef(0);

  useEffect(() => { setUsername(settings.credentials[source]?.username ?? ''); setApiKey(settings.credentials[source]?.apiKey ?? ''); setTestStatus('idle'); setTestResult(null); testRun.current += 1; }, [settings.credentials, source]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    settings.setCredentials(source, username, apiKey);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  const updateUsername = (value: string) => { setUsername(value); setTestStatus('idle'); setTestResult(null); testRun.current += 1; };
  const updateApiKey = (value: string) => { setApiKey(value); setTestStatus('idle'); setTestResult(null); testRun.current += 1; };
  const runTest = async () => {
    const run = ++testRun.current;
    setTestStatus('testing');
    setTestResult(null);
    const result = await testSourceAccess(source, { username, apiKey });
    if (testRun.current !== run) return;
    setTestResult(result.code);
    setTestStatus('result');
  };
  const saveComfy = async () => {
    await useComfyStore.getState().request({ type: 'COMFY_SAVE_SETTINGS', payload: { baseUrl: settings.comfyBaseUrl, historyLimit: settings.comfyHistoryLimit, storageLimitBytes: settings.comfyStorageLimitBytes, replaceReverseWithTags: settings.comfyReplaceReverseWithTags, cacheOutputs: settings.comfyCacheOutputs } });
    setComfySaved(true); window.setTimeout(() => setComfySaved(false), 1800);
  };

  return (
    <main className="settings-page">
      <header><div className="brand-mark">D</div><div><span>{shellMessages.settings.brandName}</span><h1>{shellMessages.settings.title}</h1></div></header>
      <section className="settings-section"><div><h2>{shellMessages.settings.language}</h2><p>{shellMessages.settings.languageDescription}</p></div><div className="settings-controls"><label>{shellMessages.settings.language}<select value={settings.language} onChange={(event) => settings.setLanguage(event.target.value as Language)}><option value="system">{shellMessages.settings.languageSystem}</option><option value="en">{shellMessages.settings.languageEnglish}</option><option value="zh-CN">{shellMessages.settings.languageChinese}</option></select></label></div></section>
      <section className="settings-section"><div><h2>{shellMessages.settings.appearance}</h2><p>{shellMessages.settings.appearanceDescription}</p></div><div className="settings-controls"><label>{shellMessages.settings.theme}<select value={settings.theme} onChange={(event) => settings.setTheme(event.target.value as Theme)}><option value="system">{shellMessages.settings.followSystem}</option><option value="light">{shellMessages.settings.light}</option><option value="dark">{shellMessages.settings.dark}</option></select></label><label>{shellMessages.settings.defaultColumns}<input type="number" min="2" max="12" value={settings.columns} onChange={(event) => settings.setColumns(Number(event.target.value))} /></label><label>{shellMessages.settings.thumbnailQuality}<select value={settings.thumbnailQuality} onChange={(event) => settings.setThumbnailQuality(event.target.value as ThumbnailQuality)}><option value="preview">{shellMessages.settings.previewQuality}</option><option value="sample">{shellMessages.settings.sampleQuality}</option></select></label><label>{shellMessages.settings.detailImageQuality}<select value={settings.detailImageQuality} onChange={(event) => settings.setDetailImageQuality(event.target.value as DetailImageQuality)}><option value="preview">{shellMessages.settings.previewQuality}</option><option value="sample">{shellMessages.settings.sampleQuality}</option><option value="original">{shellMessages.settings.originalQuality}</option></select></label><label>{shellMessages.settings.imageCacheLimit}<input type="number" min="64" max="10240" step="64" value={Math.round(settings.imageCacheLimitBytes / 1024 ** 2)} onChange={(event) => settings.setImageCacheLimitBytes(Number(event.target.value) * 1024 ** 2)} /></label></div></section>
      <section className="settings-section"><div><h2>{shellMessages.settings.downloadsAndPlayback}</h2><p>{shellMessages.settings.filenameVariables}</p></div><div className="settings-controls"><label>{shellMessages.settings.filenameRule}<input value={settings.downloadRule} onChange={(event) => settings.setDownloadRule(event.target.value)} /></label><label className="checkbox-setting"><input type="checkbox" checked={settings.keyboardEnabled} onChange={(event) => settings.setKeyboardEnabled(event.target.checked)} /> {shellMessages.settings.enableKeyboardShortcuts}</label></div></section>
      <section className="settings-section"><div><h2>{shellMessages.settings.tagCopy}</h2><p>{shellMessages.settings.tagCopyDescription}</p></div><div className="settings-controls"><div className="category-checkboxes">{copyCategories.map(([category, label]) => <label className="checkbox-setting" key={category}><input type="checkbox" checked={settings.copyTagCategories.includes(category)} onChange={(event) => settings.setCopyTagCategory(category, event.target.checked)} /><span className="category-option"><span className={`category-swatch category-${category}`} />{label}</span></label>)}</div><label className="checkbox-setting"><input type="checkbox" checked={settings.copyTagsUseUnderscores} onChange={(event) => settings.setCopyTagsUseUnderscores(event.target.checked)} /> {shellMessages.settings.keepUnderscores}</label><label className="checkbox-setting"><input type="checkbox" checked={settings.copyTagsEscapeParentheses} onChange={(event) => settings.setCopyTagsEscapeParentheses(event.target.checked)} /> {shellMessages.settings.escapeParentheses}</label></div></section>
      <section className="settings-section"><div><h2>{comfyMessages.name}</h2><p>{comfyMessages.settingsDescription}</p></div><div className="settings-controls"><label>{comfyMessages.serverAddress}<input value={settings.comfyBaseUrl} placeholder="http://127.0.0.1:8188/" onChange={(event) => settings.setComfyBaseUrl(event.target.value)} /></label><label>{comfyMessages.historyRecords}<input type="number" min="10" max="1000" value={settings.comfyHistoryLimit} onChange={(event) => settings.setComfyHistoryLimit(Number(event.target.value))} /></label><label>{comfyMessages.storageLimit}<input type="number" min="64" max="10240" value={Math.round(settings.comfyStorageLimitBytes / 1024 ** 2)} onChange={(event) => settings.setComfyStorageLimitBytes(Number(event.target.value) * 1024 ** 2)} /></label><label className="checkbox-setting"><input type="checkbox" checked={settings.comfyReplaceReverseWithTags} onChange={(event) => settings.setComfyReplaceReverseWithTags(event.target.checked)} /> {comfyMessages.replaceReverse}</label><label className="checkbox-setting"><input type="checkbox" checked={settings.comfyCacheOutputs} onChange={(event) => settings.setComfyCacheOutputs(event.target.checked)} /> {comfyMessages.cacheOutputs}</label><button type="button" className="primary-button" onClick={() => void saveComfy()}>{comfySaved ? <Check size={16} /> : <Sparkles size={16} />}{comfySaved ? comfyMessages.saved : comfyMessages.saveSettings}</button></div></section>
      <section className="settings-section"><div><h2>{shellMessages.settings.sourceAccess}</h2><p>{shellMessages.settings.sourceAccessDescription}</p></div><form className="settings-controls" onSubmit={submit}><label>{shellMessages.settings.source}<select value={source} onChange={(event) => setSource(event.target.value as BooruSource)}>{booruSources.map((item) => <option key={item.id} value={item.id}>{item.name}{item.supportsAuth ? '' : shellMessages.settings.publicOnly}</option>)}</select></label><label>{source === 'gelbooru' || source === 'rule34' ? shellMessages.settings.userId : shellMessages.settings.username}<input value={username} autoComplete="username" disabled={!booruSources.find((item) => item.id === source)?.supportsAuth} onChange={(event) => updateUsername(event.target.value)} /></label><label>{shellMessages.settings.apiKey}<input value={apiKey} type="password" autoComplete="current-password" disabled={!booruSources.find((item) => item.id === source)?.supportsAuth} onChange={(event) => updateApiKey(event.target.value)} /></label><div className="settings-source-actions"><button type="button" className="secondary-button" disabled={testStatus === 'testing'} onClick={() => void runTest()}>{testStatus === 'testing' ? <LoaderCircle className="spin" size={16} /> : <PlugZap size={16} />}{testStatus === 'testing' ? shellMessages.settings.testingConnection : shellMessages.settings.testConnection}</button><button className="primary-button" type="submit" disabled={!booruSources.find((item) => item.id === source)?.supportsAuth}>{saved ? <Check size={16} /> : <KeyRound size={16} />}{saved ? shellMessages.settings.saved : shellMessages.settings.saveCredentials}</button></div>{testStatus === 'result' && testResult && <p className={`source-test-result source-test-result--${testResult}`} role="status" aria-live="polite">{shellMessages.settings.sourceTestResults[testResult]}</p>}{testStatus === 'testing' && <span className="sr-only" role="status" aria-live="polite">{shellMessages.settings.testingConnection}</span>}</form></section>
    </main>
  );
}
