import { execFileSync, spawn } from 'node:child_process';

function windowsProxy() {
  if (process.platform !== 'win32') return undefined;
  try {
    const key = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings';
    const output = execFileSync('reg', ['query', key], { encoding: 'utf8' });
    if (!/ProxyEnable\s+REG_DWORD\s+0x1/i.test(output)) return undefined;
    const value = output.match(/ProxyServer\s+REG_SZ\s+([^\r\n]+)/i)?.[1]?.trim();
    const server = value?.split(';').find((item) => item.startsWith('https='))?.slice(6) ?? value;
    return server && (/^https?:\/\//i.test(server) ? server : `http://${server}`);
  } catch { return undefined; }
}

const proxy = process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY ?? windowsProxy();
const vite = new URL('./node_modules/vite/bin/vite.js', import.meta.url).pathname.replace(/^\/(.:\/)/, '$1');
const flags = process.allowedNodeEnvironmentFlags.has('--use-env-proxy') ? ['--use-env-proxy'] : [];
const child = spawn(process.execPath, [...flags, vite, '--host', '127.0.0.1', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, ...(proxy ? { HTTPS_PROXY: proxy, HTTP_PROXY: proxy } : {}) },
});

process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
child.on('exit', (code) => process.exit(code ?? 1));
