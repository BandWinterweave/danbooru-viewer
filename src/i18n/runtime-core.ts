import type { Language } from '../stores/settings-store';
import { en, type LocaleMessages } from './en';
import { zhCN } from './zh-CN';

export type ResolvedLocale = 'en' | 'zh-CN';
export type { LocaleMessages } from './en';

export const localeResources: Record<ResolvedLocale, LocaleMessages> = { en, 'zh-CN': zhCN };
let currentLocale: ResolvedLocale = resolveLocale('system');
let currentLanguage: Language = 'system';
let languageRevision = 0;
let initialization: Promise<void> | null = null;
let storageListenerInstalled = false;
let contentListenerInstalled = false;
const listeners = new Set<() => void>();

export function browserLanguage(): string {
  if (typeof chrome !== 'undefined' && chrome.i18n?.getUILanguage) return chrome.i18n.getUILanguage();
  return typeof navigator !== 'undefined' ? navigator.language : 'en';
}

export function resolveLocale(language: Language, systemLanguage = browserLanguage()): ResolvedLocale {
  const candidate = language === 'system' ? systemLanguage : language;
  return candidate.toLowerCase().replace('_', '-').startsWith('zh') ? 'zh-CN' : 'en';
}

export function setRuntimeLanguage(language: Language) {
  currentLanguage = language;
  languageRevision += 1;
  const locale = resolveLocale(language);
  if (locale === currentLocale) return;
  currentLocale = locale;
  listeners.forEach((listener) => listener());
}

export function getRuntimeLanguage(): Language {
  return currentLanguage;
}

export function subscribeRuntimeLanguage(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getMessages(): LocaleMessages {
  return localeResources[currentLocale];
}

export function getLocale(): ResolvedLocale {
  return currentLocale;
}

export function languageFromStoredValue(value: unknown): Language {
  if (typeof value !== 'string') return 'system';
  try {
    const language = (JSON.parse(value) as { state?: { language?: unknown } }).state?.language;
    return language === 'en' || language === 'zh-CN' || language === 'system' ? language : 'system';
  } catch {
    return 'system';
  }
}

export function initializeRuntimeI18n(): Promise<void> {
  if (initialization) return initialization;
  initialization = (async () => {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      if (!storageListenerInstalled) {
        chrome.storage.onChanged?.addListener((changes, areaName) => {
          if (areaName === 'local' && changes['danbooru-settings']) setRuntimeLanguage(languageFromStoredValue(changes['danbooru-settings'].newValue));
        });
        storageListenerInstalled = true;
      }
      const revision = languageRevision;
      try {
        const stored = await chrome.storage.local.get('danbooru-settings');
        if (revision === languageRevision) setRuntimeLanguage(languageFromStoredValue(stored['danbooru-settings']));
      } catch {
        if (revision === languageRevision) setRuntimeLanguage('system');
      }
      return;
    }
    if (typeof localStorage !== 'undefined') setRuntimeLanguage(languageFromStoredValue(localStorage.getItem('danbooru-settings')));
  })().catch(() => {
    initialization = null;
    setRuntimeLanguage('system');
  });
  return initialization;
}

function isLanguage(value: unknown): value is Language {
  return value === 'system' || value === 'en' || value === 'zh-CN';
}

export async function initializeContentScriptI18n(): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
  if (!contentListenerInstalled) {
    chrome.runtime.onMessage.addListener((message: unknown) => {
      if (!message || typeof message !== 'object' || (message as { type?: unknown }).type !== 'LANGUAGE_CHANGED') return;
      const language = (message as { payload?: { language?: unknown } }).payload?.language;
      if (isLanguage(language)) setRuntimeLanguage(language);
    });
    contentListenerInstalled = true;
  }
  const revision = languageRevision;
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_LANGUAGE' }) as { language?: unknown } | undefined;
    if (revision === languageRevision && isLanguage(response?.language)) setRuntimeLanguage(response.language);
  } catch {
    if (revision === languageRevision) setRuntimeLanguage('system');
  }
}
