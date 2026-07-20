import { pageImageMeetsThreshold, pageImageUrls } from './page-image';

const OVERLAY_KEY = '__danbooruViewerPageOverlay';

interface OverlayHandle { remove: () => void }
interface PageSettings { enabled: boolean; minPixels: number; language?: string }
type OverlayWindow = Window & { [OVERLAY_KEY]?: OverlayHandle };

const existing = (window as OverlayWindow)[OVERLAY_KEY];
if (existing) {
  void chrome.runtime.sendMessage({ type: 'PAGE_GET_SETTINGS' }).then((settings: PageSettings) => {
    if (!settings.enabled) existing.remove();
  }).catch(() => undefined);
} else {
  void initialize();
}

async function initialize() {
  const settings = await chrome.runtime.sendMessage({ type: 'PAGE_GET_SETTINGS' }).catch(() => null) as PageSettings | null;
  if (!settings?.enabled) return;

  let minPixels = settings.minPixels;
  let activeImage: HTMLImageElement | null = null;
  let frame: HTMLIFrameElement | null = null;
  let opening = false;
  let removed = false;
  const chinese = settings.language === 'zh-CN';
  const host = document.createElement('div');
  host.id = 'danbooru-viewer-page-overlay';
  host.style.cssText = 'all:initial;position:fixed;z-index:2147483647;inset:0;pointer-events:none;contain:layout style;';
  const shadow = host.attachShadow({ mode: 'closed' });
  shadow.innerHTML = `<style>
    :host{all:initial}
    button{box-sizing:border-box;margin:0;font-family:Arial,"Segoe UI",sans-serif;letter-spacing:0;cursor:pointer}
    #dv-launcher{position:fixed;right:18px;bottom:18px;width:46px;height:46px;padding:0;border:1px solid #d9ff48;border-radius:13px;background:#c8f031;color:#0a0a0e;box-shadow:0 10px 30px rgba(0,0,0,.32),0 0 0 3px rgba(200,240,49,.16);font-size:24px;font-weight:800;line-height:1;pointer-events:auto}
    #dv-launcher:hover{background:#d9ff48;transform:translateY(-1px)}
    #dv-launcher:disabled{cursor:wait;opacity:.7}
    #dv-send{position:fixed;display:none;width:36px;height:36px;padding:0;border:1px solid rgba(255,255,255,.72);border-radius:5px;background:rgba(10,10,14,.92);color:#c8f031;box-shadow:0 8px 24px rgba(0,0,0,.42);place-items:center;pointer-events:auto}
    #dv-send:hover{border-color:#c8f031;background:#111118}
    #dv-send:disabled{cursor:wait;opacity:.6}
    #dv-send svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
    #dv-workbench{position:fixed;z-index:2;inset:0;width:100%;height:100%;border:0;background:transparent;pointer-events:auto}
    button:focus-visible{outline:3px solid #5cc6e8;outline-offset:3px}
    @media(max-width:520px){#dv-launcher{right:12px;bottom:12px;width:44px;height:44px}}
  </style>
  <button id="dv-launcher" type="button" aria-label="${chinese ? '打开 ComfyUI 工作台' : 'Open ComfyUI workbench'}" title="${chinese ? '打开 ComfyUI 工作台' : 'Open ComfyUI workbench'}">D</button>
  <button id="dv-send" type="button" aria-label="${chinese ? '发送到 ComfyUI' : 'Send to ComfyUI'}" title="${chinese ? '发送到 ComfyUI' : 'Send to ComfyUI'}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/><path d="M5 3v4M3 5h4M19 17v4M17 19h4"/></svg></button>`;
  const launcher = shadow.querySelector<HTMLButtonElement>('#dv-launcher')!;
  const send = shadow.querySelector<HTMLButtonElement>('#dv-send')!;
  document.documentElement.append(host);

  const hideSend = () => { activeImage = null; send.style.display = 'none'; };
  const positionSend = (image: HTMLImageElement) => {
    const rect = image.getBoundingClientRect();
    if (rect.bottom <= 0 || rect.top >= window.innerHeight || rect.right <= 0 || rect.left >= window.innerWidth) { hideSend(); return; }
    send.style.left = `${Math.max(4, Math.min(window.innerWidth - 40, rect.right - 42))}px`;
    send.style.top = `${Math.max(4, Math.min(window.innerHeight - 40, rect.top + 7))}px`;
    send.style.display = 'grid';
  };
  const imageAt = (x: number, y: number) => document.elementsFromPoint(x, y).find((element): element is HTMLImageElement => element instanceof HTMLImageElement && !host.contains(element));
  const trackPointer = (event: PointerEvent) => {
    if (send.matches(':hover') || launcher.matches(':hover')) return;
    const image = event.target instanceof HTMLImageElement ? event.target : imageAt(event.clientX, event.clientY);
    if (!image || !pageImageMeetsThreshold(image, minPixels)) { hideSend(); return; }
    activeImage = image;
    positionSend(image);
  };
  const reposition = () => activeImage ? positionSend(activeImage) : undefined;

  const openWorkbench = async () => {
    if (frame) {
      launcher.style.display = 'none';
      hideSend();
      frame.style.display = 'block';
      frame.contentWindow?.postMessage({ type: 'DV_COMFY_OVERLAY_OPEN' }, '*');
      return;
    }
    if (opening) return;
    opening = true;
    launcher.disabled = true;
    try {
      const session = await chrome.runtime.sendMessage({ type: 'PAGE_CREATE_WORKBENCH' }).catch(() => null) as { ok?: boolean; token?: string } | null;
      if (removed || !session?.ok || !session.token) return;
      launcher.style.display = 'none';
      hideSend();
      frame = document.createElement('iframe');
      frame.id = 'dv-workbench';
      frame.title = chinese ? 'ComfyUI 工作台' : 'ComfyUI Workbench';
      frame.src = `${chrome.runtime.getURL('src/overlay/index.html')}?token=${encodeURIComponent(session.token)}`;
      shadow.append(frame);
    } finally {
      opening = false;
      launcher.disabled = false;
    }
  };
  const closeWorkbench = () => {
    frame?.remove();
    frame = null;
    launcher.style.display = 'block';
  };
  const receiveWindowMessage = (event: MessageEvent) => {
    if (frame && event.source === frame.contentWindow && event.data?.type === 'DV_COMFY_OVERLAY_CLOSE') closeWorkbench();
  };
  const receiveRuntimeMessage = (message: unknown) => {
    if (!message || typeof message !== 'object') return;
    const value = message as { type?: string; payload?: PageSettings };
    if (value.type === 'PAGE_OVERLAY_REMOVE') remove();
    if (value.type === 'PAGE_SETTINGS_CHANGED') {
      if (!value.payload?.enabled) remove();
      else minPixels = value.payload.minPixels;
    }
  };
  const queueImage = async () => {
    if (!activeImage) return;
    const image = activeImage;
    const urls = pageImageUrls(image);
    if (!urls.length) return;
    send.disabled = true;
    try {
      await chrome.runtime.sendMessage({ type: 'PAGE_ENQUEUE_IMAGE', payload: { urls, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight } });
    } finally {
      send.disabled = false;
      hideSend();
    }
  };
  const remove = () => {
    if (removed) return;
    removed = true;
    document.removeEventListener('pointermove', trackPointer, true);
    window.removeEventListener('scroll', reposition, true);
    window.removeEventListener('resize', reposition);
    window.removeEventListener('message', receiveWindowMessage);
    chrome.runtime.onMessage.removeListener(receiveRuntimeMessage);
    host.remove();
    delete (window as OverlayWindow)[OVERLAY_KEY];
  };

  launcher.addEventListener('click', () => void openWorkbench());
  send.addEventListener('click', () => void queueImage());
  document.addEventListener('pointermove', trackPointer, true);
  window.addEventListener('scroll', reposition, true);
  window.addEventListener('resize', reposition);
  window.addEventListener('message', receiveWindowMessage);
  chrome.runtime.onMessage.addListener(receiveRuntimeMessage);
  (window as OverlayWindow)[OVERLAY_KEY] = { remove };
}
