export function safeHttpUrl(value: string | undefined, base?: string): string {
  if (!value) return '';
  try {
    const url = new URL(value, base);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}
