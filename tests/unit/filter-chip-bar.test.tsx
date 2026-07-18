import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { FilterChipBar } from '../../src/components/filter/FilterChipBar';
import { useFilterStore } from '../../src/stores/filter-store';
import { useSettingsStore } from '../../src/stores/settings-store';

describe('filter chip bar', () => {
  beforeEach(() => {
    useSettingsStore.setState({ activeSource: 'danbooru' });
    useFilterStore.setState({ activeFilters: [], ratings: [], meta: { order: 'score' } });
  });

  it('renders each underlying order term as its own quick-filter chip', () => {
    const { container } = render(<FilterChipBar onAddFilter={() => undefined} />);
    const chips = [...container.querySelectorAll('.filter-chip--meta')].map((chip) => chip.textContent);
    expect(chips).toHaveLength(2);
    expect(screen.getByText('score:>50')).toBeInTheDocument();
    expect(screen.getByText('order:score')).toBeInTheDocument();
  });
});
