import { actionMessages } from '../i18n/en-actions';

const enhanced = new WeakSet<Element>();

function enhancePost(element: Element) {
  if (enhanced.has(element)) return;
  const link = element.querySelector<HTMLAnchorElement>('a[href*="/posts/"]');
  const image = element.querySelector<HTMLImageElement>('img');
  const tags = element.getAttribute('data-tags') || element.querySelector<HTMLElement>('[data-tags]')?.dataset.tags || image?.alt || '';
  if (!link || !image) return;
  enhanced.add(element);
  element.classList.add('dv-enhanced-post');
  const actions = document.createElement('span');
  actions.className = 'dv-post-actions';
  const copy = document.createElement('button');
  copy.type = 'button';
  copy.textContent = actionMessages.content.copyTags;
  copy.title = actionMessages.content.copyTagsTitle;
  copy.addEventListener('click', (event) => {
    event.preventDefault(); event.stopPropagation();
    void navigator.clipboard.writeText(tags.trim()).then(() => { copy.textContent = actionMessages.content.copied; }, () => { copy.textContent = actionMessages.content.copyFailed; }).finally(() => { window.setTimeout(() => { copy.textContent = actionMessages.content.copyTags; }, 1200); });
  });
  actions.append(copy);
  element.append(actions);
  const preview = document.createElement('img');
  preview.className = 'dv-hover-preview';
  preview.alt = '';
  preview.src = image.dataset.largeFileUrl || image.dataset.fileUrl || image.src;
  element.append(preview);
}

function scan() {
  document.querySelectorAll('article.post-preview, .post-preview, [id^="post_"]').forEach(enhancePost);
}

const style = document.createElement('style');
style.textContent = '.dv-enhanced-post{position:relative}.dv-post-actions{position:absolute;z-index:8;right:4px;bottom:4px;opacity:0;transition:opacity .12s}.dv-enhanced-post:hover .dv-post-actions{opacity:1}.dv-post-actions button{padding:4px 7px;border:1px solid #fff8;border-radius:3px;background:#17201ee8;color:#fff;font:11px system-ui;cursor:pointer}.dv-hover-preview{position:absolute;z-index:7;left:100%;top:0;width:320px;height:320px;object-fit:contain;background:#17201e;box-shadow:0 8px 28px #0005;pointer-events:none;opacity:0;transition:opacity .12s}.dv-enhanced-post:hover .dv-hover-preview{opacity:1}';
document.documentElement.append(style);
scan();
new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
