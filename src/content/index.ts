import { getMessages, initializeContentScriptI18n, subscribeRuntimeLanguage } from '../i18n/runtime-core';

const enhanced = new WeakSet<Element>();

function enhancePost(element: Element) {
  const actionMessages = getMessages().domainActions;
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
  copy.className = 'dv-copy-tags';
  copy.textContent = actionMessages.content.copyTags;
  copy.title = actionMessages.content.copyTagsTitle;
  copy.addEventListener('click', (event) => {
    event.preventDefault(); event.stopPropagation();
    void navigator.clipboard.writeText(tags.trim()).then(() => { copy.textContent = getMessages().domainActions.content.copied; }, () => { copy.textContent = getMessages().domainActions.content.copyFailed; }).finally(() => { window.setTimeout(() => { copy.textContent = getMessages().domainActions.content.copyTags; }, 1200); });
  });
  actions.append(copy);
  element.append(actions);
  const preview = document.createElement('img');
  preview.className = 'dv-hover-preview';
  preview.alt = '';
  const previewUrl = image.dataset.largeFileUrl || image.dataset.fileUrl || image.src;
  element.addEventListener('mouseenter', () => { if (!preview.src) preview.src = previewUrl; }, { once: true });
  element.append(preview);
}

function scan() {
  document.querySelectorAll('article.post-preview, .post-preview, [id^="post_"]').forEach(enhancePost);
}

function localizeActions() {
  const content = getMessages().domainActions.content;
  document.querySelectorAll<HTMLButtonElement>('.dv-copy-tags').forEach((button) => {
    button.textContent = content.copyTags;
    button.title = content.copyTagsTitle;
  });
}

const style = document.createElement('style');
style.textContent = '.dv-enhanced-post{position:relative}.dv-post-actions{position:absolute;z-index:8;right:4px;bottom:4px;opacity:0;transition:opacity .12s}.dv-enhanced-post:hover .dv-post-actions{opacity:1}.dv-post-actions button{padding:4px 7px;border:1px solid #fff8;border-radius:3px;background:#17201ee8;color:#fff;font:11px system-ui;cursor:pointer}.dv-hover-preview{position:absolute;z-index:7;left:100%;top:0;width:320px;height:320px;object-fit:contain;background:#17201e;box-shadow:0 8px 28px #0005;pointer-events:none;opacity:0;transition:opacity .12s}.dv-enhanced-post:hover .dv-hover-preview{opacity:1}';
document.documentElement.append(style);
void initializeContentScriptI18n().finally(() => {
  scan();
  subscribeRuntimeLanguage(localizeActions);
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
});
