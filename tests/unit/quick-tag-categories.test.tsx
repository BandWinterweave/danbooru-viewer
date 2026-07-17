import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Sidebar } from '../../src/components/layout/Sidebar';
import { useSettingsStore } from '../../src/stores/settings-store';
import { useUiStore } from '../../src/stores/ui-store';

const categoryState = vi.hoisted(() => ({ hydrated: false, hydrate: vi.fn() }));
vi.mock('../../src/services/booru-adapters/tag-categories', () => ({
  hydrateTagMetadata: categoryState.hydrate,
  rememberTagMetadata: vi.fn().mockResolvedValue(undefined),
  tagCategoryFor: () => categoryState.hydrated ? 'character' : 'general',
}));

describe('Sidebar quick tag categories', () => {
  beforeEach(() => {
    categoryState.hydrated = false;
    categoryState.hydrate.mockReset().mockImplementation(async () => { categoryState.hydrated = true; });
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn().mockReturnValue({ matches: false }) });
    useUiStore.setState({ sidebarOpen: true, view: 'browse' });
    useSettingsStore.setState({ activeSource: 'rule34', quickTags: ['sample_character'], credentials: {} });
  });

  it('rehydrates persisted category colors after a refresh', async () => {
    render(<Sidebar />);

    await waitFor(() => expect(categoryState.hydrate).toHaveBeenCalledWith('rule34', ['sample_character']));
    await waitFor(() => expect(screen.getByRole('button', { name: 'sample character' })).toHaveAttribute('data-category', 'character'));
  });
});
