import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ComfyTaskOutputs } from '../../src/components/comfy/ComfyTaskMedia';

describe('ComfyTaskOutputs', () => {
  it('sorts by node title, strips OUTPUT prefixes, and renders images before text', () => {
    const { container } = render(<ComfyTaskOutputs serverUrl="http://127.0.0.1:8188/" outputs={[
      { nodeId: 'text-10', nodeTitle: 'OUTPUT10', kind: 'text', text: 'ten' },
      { nodeId: 'text-2', nodeTitle: 'OUTPUT2', kind: 'text', text: 'two' },
      { nodeId: 'image', nodeTitle: 'OUTPUT1', kind: 'image', filename: 'ComfyUI_temp_rpayn_00007_.png', type: 'output' },
    ]} />);

    expect(screen.getByAltText('ComfyUI output 1')).toBeInTheDocument();
    expect(screen.getByText('two')).toBeInTheDocument();
    expect(screen.getByText('ten')).toBeInTheDocument();
    expect(container.querySelector('.comfy-task-output-images figcaption')).toHaveTextContent('1');
    expect(container.querySelector('.comfy-task-output-images figcaption')).not.toHaveTextContent('ComfyUI_temp');
    expect([...container.querySelectorAll('.comfy-task-output-texts span')].map((item) => item.textContent)).toEqual(['2', '10']);
    const images = container.querySelector('.comfy-task-output-images');
    const texts = container.querySelector('.comfy-task-output-texts');
    expect(images?.compareDocumentPosition(texts!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });
});
