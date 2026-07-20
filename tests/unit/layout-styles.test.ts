import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(resolve('src/styles.css'), 'utf8');
const mediaStyles = readFileSync(resolve('src/components/posts/post-detail-media.css'), 'utf8');

describe('workspace layout styles', () => {
  it('keeps the content toolbar sticky below desktop and mobile headers', () => {
    expect(styles).toMatch(/\.content-toolbar \{[^}]*position: sticky;[^}]*z-index: 20;[^}]*top: 174px;[^}]*margin-right: -18px;/);
    expect(styles).toMatch(/\.content-toolbar \{ top: 234px; margin-right: -8px; \}/);
  });

  it('wraps preset titles and list tags without truncating their content', () => {
    expect(styles).toMatch(/\.preset-list-item \.preset-load \{[^}]*overflow-wrap: anywhere;[^}]*white-space: normal;/);
    expect(styles).toMatch(/\.list-card-info p \{[^}]*overflow: auto;[^}]*white-space: normal;/);
  });

  it('contains detail images and uses a readable translucent stage with drag cursors', () => {
    expect(mediaStyles).toMatch(/\.detail-media-stage \{[^}]*color-mix[^}]*backdrop-filter: blur/);
    expect(mediaStyles).toMatch(/\.detail-media-zoom \{[^}]*cursor: grab;/);
    expect(mediaStyles).toMatch(/\.detail-media-zoom img, \.detail-media-video \{[^}]*position: absolute;[^}]*inset: 0;[^}]*width: auto;[^}]*height: auto;[^}]*max-width: calc\(100% - 96px\);[^}]*max-height: calc\(100% - 48px\);[^}]*margin: auto;[^}]*object-fit: contain;/);
    expect(mediaStyles).not.toContain('cursor: zoom-in');
  });

  it('marks hoverable tooltip tag names without restoring the image cache skeleton', () => {
    expect(styles).toMatch(/\.tooltip-tag-name:hover \{[^}]*text-decoration: underline;/);
    expect(styles).toMatch(/\.post-tooltip-tags \{[^}]*padding: 7px 39px 9px 9px;/);
    expect(styles).toMatch(/\.post-tooltip-tags \{[^}]*position: relative;/);
    expect(styles).toMatch(/\.tooltip-tag--shifted \{[^}]*transform: translateX\(30px\);/);
    expect(styles).toMatch(/\.tooltip-tag-actions \{[^}]*position: absolute;[^}]*left: 100%;[^}]*width: 30px;[^}]*animation: tooltip-tag-actions-in 120ms ease-out;/);
    expect(styles).not.toContain('post-tooltip-tags--active');
    expect(styles).not.toContain('tooltip-tag-actions--docked');
    expect(styles).not.toContain('.image-cache-loading');
  });

  it('keeps all four rating colors independent', () => {
    expect(styles).toMatch(/\.filter-chip--rating-s \{[^}]*var\(--blue\)/);
    expect(styles).toMatch(/\.rating-badge--s \{[^}]*var\(--blue\)/);
    expect(styles).toMatch(/\.rating-badge--q \{[^}]*var\(--amber\)/);
    expect(styles).toMatch(/\.rating-badge--e \{[^}]*var\(--coral\)/);
    expect(styles).not.toContain('.rating-badge--g, .rating-badge--s');
  });

  it('caps multiline ComfyUI options at eight lines', () => {
    expect(styles).toMatch(/\.comfy-options textarea \{[^}]*max-height: calc\(8lh \+ 18px\);[^}]*resize: none;/);
  });
});
