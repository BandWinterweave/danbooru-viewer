import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComfyHistory } from '../../src/components/comfy/ComfyHistory';
import { useComfyStore } from '../../src/stores/comfy-store';
import type { ComfyHistoryRecord, ComfyTaskStatus } from '../../src/services/comfy/types';

function record(status: ComfyTaskStatus, error?: string, withOutputs = false): ComfyHistoryRecord {
  const now = Date.now();
  const workflow = {
    '1': { class_type: 'LoadImage', inputs: { image: '' }, _meta: { title: 'INPUT' } },
    '2': { class_type: 'SaveImage', inputs: { images: ['1', 0] }, _meta: { title: 'OUTPUT image' } },
  };
  const outputs = withOutputs ? [{ nodeId: 'text', kind: 'text' as const, text: 'first' }, { nodeId: '2', kind: 'image' as const, filename: 'result.png', type: 'output' }] : [];
  return { id: crypto.randomUUID(), completedAt: now, outputs, task: { id: crypto.randomUUID(), batchId: 'batch', status, workflowId: 'workflow', sourceLabel: `${status} image`, serverUrl: 'http://127.0.0.1:8188/', workflow, optionValues: {}, input: { kind: 'blob', blobKey: crypto.randomUUID(), name: 'input.png', mediaType: 'image/png' }, clientId: crypto.randomUUID(), attempts: 1, createdAt: now - 1000, updatedAt: now, completedAt: now, outputs, ...(error ? { error: { code: 'execution' as const, message: error } } : {}) } };
}

describe('ComfyUI history', () => {
  const request = vi.fn();

  beforeEach(() => {
    request.mockReset();
    request.mockResolvedValue(undefined);
    useComfyStore.setState({
      history: [record('completed', undefined, true), record('needs-confirmation', 'Prompt result is unknown'), record('cancelled')],
      loadHistory: vi.fn().mockResolvedValue(undefined),
      request,
    });
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:history-output') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  });

  it('shows localized success, failed reason, and cancelled states', () => {
    render(<ComfyHistory />);

    expect(screen.getByText('Success')).toBeInTheDocument();
    expect(screen.getByText('Failed (Prompt result is unknown)')).toBeInTheDocument();
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
  });

  it('requests the original output index and opens the returned cached blob', async () => {
    request.mockResolvedValueOnce({ output: { nodeId: '2', nodeTitle: 'OUTPUT image', kind: 'image' }, blob: new Blob(['image'], { type: 'image/png' }) });
    render(<ComfyHistory />);
    fireEvent.click(screen.getAllByTitle('Expand outputs')[0]);
    fireEvent.click(await screen.findByAltText('ComfyUI output image'));

    await vi.waitFor(() => expect(request).toHaveBeenCalledWith(expect.objectContaining({ type: 'COMFY_GET_OUTPUT', payload: expect.objectContaining({ outputIndex: 1 }) })));
    expect(await screen.findByRole('dialog', { name: 'OUTPUT image' })).toBeInTheDocument();
  });

  it('revokes cached output URLs on unmount and contains request failures', async () => {
    request.mockResolvedValueOnce({ output: { nodeId: '2', nodeTitle: 'OUTPUT image', kind: 'image' }, blob: new Blob(['image'], { type: 'image/png' }) });
    const rendered = render(<ComfyHistory />);
    fireEvent.click(screen.getAllByTitle('Expand outputs')[0]);
    fireEvent.click(await screen.findByAltText('ComfyUI output image'));
    await screen.findByRole('dialog', { name: 'OUTPUT image' });
    rendered.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:history-output');

    request.mockRejectedValueOnce(new Error('cached output unavailable'));
    useComfyStore.setState({ history: [record('completed', undefined, true)] });
    render(<ComfyHistory />);
    fireEvent.click(screen.getByTitle('Expand outputs'));
    fireEvent.click(await screen.findByAltText('ComfyUI output image'));
    await vi.waitFor(() => expect(request).toHaveBeenCalledWith(expect.objectContaining({ type: 'COMFY_GET_OUTPUT' })));
    expect(screen.queryByRole('dialog', { name: 'OUTPUT image' })).not.toBeInTheDocument();
  });
});
