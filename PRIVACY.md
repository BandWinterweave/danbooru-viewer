# Privacy notice / 隐私声明

Last updated: 2026-07-17

## English

Danbooru Viewer does not include analytics, telemetry, advertising, or remote error reporting. It does not operate a project-owned server.

### Data stored on the device

- Preferences and optional source credentials are stored in browser extension storage. Credentials are not additionally encrypted and anyone with access to the browser profile may be able to read them.
- Local favorites, favorite groups, download history, media cache entries, and tag-category metadata are stored in IndexedDB.
- Cached media expires after 24 hours and is bounded by a 96 MiB LRU budget. Persistent tag metadata is bounded to 10,000 entries. Clearing the extension's site data removes these local records.

### Network requests

- Searches, post details, credential tests, authenticated actions, and media downloads contact the selected Booru source and the media hosts declared in the extension Manifest.
- Credentials are sent only to the corresponding source when it is used or tested. They are not sent to another source and are excluded from request cache keys and user-facing errors.
- Some sources do not provide tag categories. In that case, the extension may send only the missing tag names to Danbooru to retrieve category metadata. This cross-source enrichment does not include source credentials, search history, favorite groups, or downloaded media.
- When Danbooru blocks a background request with a browser challenge, the extension may open a background Danbooru tab and retry using the browser's existing Danbooru session.

The extension requests `storage`, `downloads`, `unlimitedStorage`, `scripting`, and declarative network request permissions to persist settings and bounded local data, save requested files, support the Danbooru page integration and challenge fallback, and attach the required media request headers. Host permissions are limited to the five supported Booru services and their media subdomains.

## 中文

Danbooru Viewer 不包含分析、遥测、广告或远程错误上报，也不运行项目自有服务器。

### 本机保存的数据

- 偏好设置和可选图源凭据保存在浏览器扩展存储中。凭据未额外加密，能够访问浏览器配置文件的人可能读取这些数据。
- 本地收藏、收藏分组、下载历史、媒体缓存和标签分类元数据保存在 IndexedDB。
- 媒体缓存保留 24 小时并受 96 MiB LRU 预算限制；持久化标签元数据最多保留 10,000 条。清除扩展站点数据会删除这些本地记录。

### 网络请求

- 搜索、帖子详情、凭据测试、登录后操作和媒体下载会访问当前选择的 Booru 图源及 Manifest 声明的媒体域名。
- 凭据只在使用或测试对应图源时发送，不会发送给其他图源，也不会写入请求缓存键或面向用户的错误信息。
- 部分图源不提供标签分类。此时扩展可能只把缺失的标签名称发送到 Danbooru 获取分类元数据；跨图源补全不包含图源凭据、搜索历史、收藏分组或下载媒体。
- Danbooru 使用浏览器挑战拦截后台请求时，扩展可能在后台打开 Danbooru 标签页，并利用浏览器已有的 Danbooru 会话重试。

扩展申请 `storage`、`downloads`、`unlimitedStorage`、`scripting` 和声明式网络请求权限，分别用于保存设置及有界本地数据、保存用户要求的文件、支持 Danbooru 页面集成与挑战回退，以及附加媒体请求所需的请求头。主机权限仅覆盖五个受支持的 Booru 服务及其媒体子域名。
