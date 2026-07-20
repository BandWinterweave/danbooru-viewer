import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkflowManager } from '../../src/components/comfy/WorkflowManager';
import { useComfyStore } from '../../src/stores/comfy-store';

describe('ComfyUI workflow options', () => {
  const request = vi.fn();

  beforeEach(() => {
    request.mockReset();
    request.mockImplementation(async (message) => message.type === 'COMFY_EXPORT_WORKFLOW'
      ? { name: 'workflow.json', apiJson: JSON.stringify({ '1': { class_type: 'LoadImage', inputs: { image: '' }, _meta: { title: 'INPUT' } }, '2': { class_type: 'PrimitiveString', inputs: { text: 'line one' }, _meta: { title: 'OPTION prompt' } } }) }
      : undefined);
    useComfyStore.setState({ workflows: [{ id: 'workflow', name: 'Workflow', active: true, order: 0, options: { '2': 'line one' }, updatedAt: 1 }], request, busy: false });
  });

  it('renders text options as multiline fields and preserves line breaks when saving', async () => {
    render(<WorkflowManager />);
    const option = await screen.findByLabelText('OPTION prompt');
    expect(option).toBeInstanceOf(HTMLTextAreaElement);

    fireEvent.change(option, { target: { value: 'line one\nline two' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save options' }));

    expect(request).toHaveBeenCalledWith({ type: 'COMFY_SAVE_WORKFLOW_OPTIONS', payload: { workflowId: 'workflow', options: { '2': 'line one\nline two' } } });
  });

  it('remeasures a textarea when saved workflow values change', async () => {
    Object.defineProperty(HTMLTextAreaElement.prototype, 'scrollHeight', { configurable: true, get() { return this.value.includes('\n') ? 120 : 24; } });
    useComfyStore.setState({ workflows: [{ id: 'workflow', name: 'Workflow', active: true, order: 0, options: { '2': 'one\ntwo\nthree' }, updatedAt: 2 }] });
    render(<WorkflowManager />);
    const option = await screen.findByLabelText('OPTION prompt');
    await vi.waitFor(() => expect(option).toHaveStyle({ height: '120px' }));

    useComfyStore.setState({ workflows: [{ id: 'workflow', name: 'Workflow', active: true, order: 0, options: { '2': 'short' }, updatedAt: 3 }] });
    await vi.waitFor(() => expect(option).toHaveValue('short'));
    expect(option).toHaveStyle({ height: '24px' });
  });
});
