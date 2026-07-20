import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComfyWorkbench } from '../../src/components/comfy/ComfyWorkbench';
import { useComfyStore } from '../../src/stores/comfy-store';
import { useSettingsStore } from '../../src/stores/settings-store';
import { useUiStore } from '../../src/stores/ui-store';

describe('ComfyWorkbench keyboard shortcuts', () => {
  beforeEach(() => {
    useSettingsStore.setState({ keyboardEnabled: true });
    useUiStore.setState({ comfyOpen: true, comfyTrigger: null });
    useComfyStore.setState({
      hydrated: true,
      serviceOnline: true,
      error: '',
      workflows: [{ id: 'workflow', name: 'Workflow', active: true, order: 0, options: {}, updatedAt: 1 }],
      history: [],
      tasks: [],
      hydrate: vi.fn().mockResolvedValue(undefined),
      refresh: vi.fn().mockResolvedValue(undefined),
      request: vi.fn().mockResolvedValue(undefined),
    });
  });

  it('switches tabs with 1, 2, and 3', () => {
    render(<ComfyWorkbench />);

    fireEvent.keyDown(window, { key: '2' });
    expect(screen.getByRole('button', { name: 'Workflows' })).toHaveClass('is-active');
    fireEvent.keyDown(window, { key: '3' });
    expect(screen.getByRole('button', { name: 'History' })).toHaveClass('is-active');
    fireEvent.keyDown(window, { key: '1' });
    expect(screen.getByRole('button', { name: 'Queue' })).toHaveClass('is-active');
  });

  it('does not switch tabs while typing or when shortcuts are disabled', () => {
    render(<ComfyWorkbench />);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Queue' }), { key: '2' });
    expect(screen.getByRole('button', { name: 'Workflows' })).toHaveClass('is-active');

    const input = document.createElement('input');
    document.body.append(input);
    fireEvent.keyDown(input, { key: '3' });
    expect(screen.getByRole('button', { name: 'Workflows' })).toHaveClass('is-active');

    useSettingsStore.setState({ keyboardEnabled: false });
    fireEvent.keyDown(window, { key: '1' });
    expect(screen.getByRole('button', { name: 'Workflows' })).toHaveClass('is-active');
  });

  it('closes the Viewer workbench when C is pressed again', () => {
    const closeComfy = vi.fn();
    useUiStore.setState({ closeComfy });
    render(<ComfyWorkbench />);

    fireEvent.keyDown(window, { key: 'c' });

    expect(closeComfy).toHaveBeenCalledOnce();
  });

  it('does not bind C inside the third-party page workbench', () => {
    const closeComfy = vi.fn();
    useUiStore.setState({ closeComfy });
    render(<ComfyWorkbench toggleWithKeyboard={false} />);

    fireEvent.keyDown(window, { key: 'c' });

    expect(closeComfy).not.toHaveBeenCalled();
  });
});
