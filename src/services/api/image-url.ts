export function displayImageUrl(url: string): string {
  if (!url || typeof window === 'undefined') return url;
  if (typeof chrome !== 'undefined' && chrome.runtime?.id) return url;
  if (!['127.0.0.1', 'localhost'].includes(window.location.hostname)) return url;
  return `/__image?url=${encodeURIComponent(url)}`;
}
