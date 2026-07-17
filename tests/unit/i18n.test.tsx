import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsPanel } from '../../src/components/settings/SettingsPanel';
import { browserLanguage, I18nProvider, localeResources, resolveLocale, setRuntimeLanguage } from '../../src/i18n/runtime';
import { useSettingsStore } from '../../src/stores/settings-store';

function resourceKeys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object') return [prefix];
  return Object.entries(value).flatMap(([key, child]) => resourceKeys(child, prefix ? `${prefix}.${key}` : key));
}

describe('runtime i18n', () => {
  beforeEach(() => {
    localStorage.clear();
    useSettingsStore.setState({ language: 'en', theme: 'light' });
    setRuntimeLanguage('en');
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    });
  });

  afterEach(() => {
    setRuntimeLanguage('en');
    vi.unstubAllGlobals();
  });

  it('resolves supported browser languages and falls back to English', () => {
    expect(resolveLocale('system', 'zh-CN')).toBe('zh-CN');
    expect(resolveLocale('system', 'zh_Hans')).toBe('zh-CN');
    expect(resolveLocale('system', 'fr-FR')).toBe('en');
    expect(resolveLocale('en', 'zh-CN')).toBe('en');
    vi.stubGlobal('chrome', { i18n: { getUILanguage: () => 'zh-CN' } });
    expect(browserLanguage()).toBe('zh-CN');
  });

  it('keeps English and Chinese runtime resource keys complete', () => {
    expect(resourceKeys(localeResources['zh-CN'])).toEqual(resourceKeys(localeResources.en));
  });

  it('switches rendered components immediately and persists the preference', async () => {
    render(<I18nProvider page="settings"><SettingsPanel /></I18nProvider>);
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'zh-CN' } });

    expect(screen.getByRole('heading', { level: 1, name: '设置' })).toBeInTheDocument();
    await waitFor(() => expect(document.documentElement.lang).toBe('zh-CN'));
    expect(document.title).toBe('Danbooru Viewer 设置');
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('danbooru-settings') ?? '{}') as { state?: { language?: string } };
      expect(stored.state?.language).toBe('zh-CN');
    });
  });

  it('keeps long Chinese permission text in the responsive two-part section structure', async () => {
    await act(async () => useSettingsStore.getState().setLanguage('zh-CN'));
    const { container } = render(<I18nProvider page="settings"><SettingsPanel /></I18nProvider>);
    const description = screen.getByText(/凭据按图源隔离/);
    const section = description.closest('.settings-section');

    expect(description.textContent?.length).toBeGreaterThan(60);
    expect(section).toBeInTheDocument();
    expect(section?.children).toHaveLength(2);
    expect(container.querySelectorAll('.settings-controls input, .settings-controls select').length).toBeGreaterThan(5);
  });
});
