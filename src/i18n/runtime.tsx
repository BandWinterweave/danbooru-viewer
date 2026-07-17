import { createContext, useContext, useEffect, useLayoutEffect, type ReactNode } from 'react';
import { useSettingsStore } from '../stores/settings-store';
import { getLocale, localeResources, resolveLocale, setRuntimeLanguage, type LocaleMessages, type ResolvedLocale } from './runtime-core';

export type DocumentPage = 'viewer' | 'popup' | 'settings';
export { browserLanguage, getLocale, getMessages, initializeRuntimeI18n, localeResources, resolveLocale, setRuntimeLanguage, subscribeRuntimeLanguage } from './runtime-core';
export type { LocaleMessages, ResolvedLocale } from './runtime-core';

const initialLocale = getLocale();
const I18nContext = createContext<{ locale: ResolvedLocale; messages: LocaleMessages }>({ locale: initialLocale, messages: localeResources[initialLocale] });

export function I18nProvider({ children, page = 'viewer' }: { children: ReactNode; page?: DocumentPage }) {
  const language = useSettingsStore((state) => state.language);
  const locale = resolveLocale(language);
  const messages = localeResources[locale];

  useLayoutEffect(() => setRuntimeLanguage(language), [language]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = page === 'settings' ? messages.shell.document.settingsTitle : page === 'popup' ? messages.shell.document.popupTitle : messages.shell.document.viewerTitle;
  }, [locale, messages, page]);

  return <I18nContext.Provider value={{ locale, messages }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
