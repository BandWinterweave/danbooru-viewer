import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ComfyImageViewer, ComfyTaskOutputs, ComfyTaskThumbnail, historyThumbnail } from '../../src/components/comfy/ComfyTaskMedia';

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

describe('ComfyUI input media', () => {
  it('keeps the preview for the task list and opens the original-quality URL', () => {
    const thumbnail = historyThumbnail({ input: { kind: 'post', post: { previewUrl: 'https://cdn.test/preview.jpg', sampleUrl: 'https://cdn.test/sample.jpg', fileUrl: 'https://cdn.test/original.jpg' } } });
    let opened = null;
    render(<ComfyTaskThumbnail thumbnail={thumbnail} label="post 42" onOpen={(image) => { opened = image; }} />);

    expect(screen.getByRole('img').getAttribute('src')).toContain(encodeURIComponent('https://cdn.test/preview.jpg'));
    fireEvent.click(screen.getByRole('button', { name: 'post 42' }));
    expect(opened).toMatchObject({
      url: expect.stringContaining(encodeURIComponent('https://cdn.test/original.jpg')),
      previewUrl: expect.stringContaining(encodeURIComponent('https://cdn.test/preview.jpg')),
    });
  });

  it('progressively replaces the preview in the sidebar-free viewer', () => {
    render(<ComfyImageViewer image={{ url: 'https://cdn.test/original.jpg', previewUrl: 'https://cdn.test/preview.jpg', label: 'post 42' }} onClose={() => undefined} />);
    const full = screen.getByAltText('post 42');
    expect(document.querySelector('.comfy-output-viewer')).toBeInTheDocument();
    expect(document.querySelector('.comfy-viewer-preview')).not.toHaveClass('is-replaced');
    fireEvent.load(full);
    expect(document.querySelector('.comfy-viewer-preview')).toHaveClass('is-replaced');
    expect(full).toHaveClass('is-loaded');
    expect(document.querySelector('.comfy-output-viewer aside')).not.toBeInTheDocument();
  });
});
