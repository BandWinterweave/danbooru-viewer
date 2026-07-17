import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Sidebar } from '../../src/components/layout/Sidebar';
import { useFilterStore } from '../../src/stores/filter-store';
import { useSettingsStore } from '../../src/stores/settings-store';
import { useUiStore } from '../../src/stores/ui-store';

describe('Sidebar filter presets', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn().mockReturnValue({ matches: false }) });
    useUiStore.setState({ sidebarOpen: true, view: 'browse' });
    useSettingsStore.setState({ activeSource: 'danbooru', quickTags: [], credentials: {} });
    useFilterStore.setState({
      activeFilters: [{ id: 'tag:new', type: 'tag', label: 'new', value: 'new', mode: 'include' }],
      ratings: ['g'],
      meta: {},
      presets: [
        { id: 'first', name: 'First', sourceId: 'danbooru', filters: [], ratings: [], meta: {}, createdAt: '2026-01-01T00:00:00Z' },
        { id: 'second', name: 'Second', sourceId: 'danbooru', filters: [], ratings: [], meta: {}, createdAt: '2026-01-02T00:00:00Z' },
      ],
    });
  });

  it('renames, confirms updates, and reorders presets with accessible icon controls', () => {
    vi.spyOn(window, 'prompt').mockReturnValue('Renamed');
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(<Sidebar />);

    fireEvent.click(screen.getByTitle('Rename First'));
    expect(useFilterStore.getState().presets[0].name).toBe('Renamed');

    fireEvent.click(screen.getByTitle('Update Renamed with current filters'));
    expect(useFilterStore.getState().presets[0].filters).toEqual([]);
    fireEvent.click(screen.getByTitle('Update Renamed with current filters'));
    expect(useFilterStore.getState().presets[0].filters[0].value).toBe('new');
    expect(confirm).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByTitle('Move Second up'));
    expect(useFilterStore.getState().presets.map(({ id }) => id)).toEqual(['second', 'first']);
  });

  it('keeps the preset title and its five actions in separate layout rows', () => {
    const { container } = render(<Sidebar />);
    const preset = container.querySelector('.preset-list-item')!;
    expect(preset.querySelector('.preset-load')).toHaveTextContent('First');
    expect(preset.querySelector('.preset-actions')?.children).toHaveLength(5);
  });
});
