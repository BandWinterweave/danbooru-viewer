# 依赖审计与构建差异记录

## 2026-07-17

- Node.js 最低版本提升为 `20.19.0`，CI 使用 Node.js 22。
- Vite 从 5 升级到 7，Vitest 从 2 升级到 4，esbuild 随 Vite 升级到无已知审计漏洞的版本。
- 停止维护且包含高危间接依赖的 `@samrum/vite-plugin-web-extension` 已替换为 `@crxjs/vite-plugin`。
- `npm audit` 结果为 0 个已知漏洞，无需风险接受项。
- 项目未安装 `yet-another-react-lightbox`，也不存在其他旧灯箱运行时依赖。

## 浏览器产物差异

两种产物共享相同的 Manifest V3 权限、host permissions、CSP、内容脚本和页面入口。唯一有意保留的差异是后台入口：

- Chromium 使用 `background.service_worker` 和 ES module。
- Firefox 使用 `background.scripts`，并保留 `browser_specific_settings.gecko`。

`npm run validate:artifacts` 会校验版本、权限、后台入口和必要文件，并为两个目录生成文件清单、大小与 SHA-256 哈希。
