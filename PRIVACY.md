# Privacy notice / 隐私声明

Last updated: 2026-07-21

## English

Danbooru Viewer does not include analytics, telemetry, advertising, or remote error reporting. It does not operate a project-owned server.

### Data stored on the device

- Preferences and optional source credentials are stored in browser extension storage. Credentials are not additionally encrypted and anyone with access to the browser profile may be able to read them.
- Local favorites, favorite groups, download history, media cache entries, tag-category metadata, imported ComfyUI API workflows, task history, and local task inputs are stored in IndexedDB. The configured ComfyUI address is stored in browser extension storage.
- Browsing media expires after 24 hours and uses a configurable LRU budget of 512 MiB by default. Persistent tag metadata is bounded to 10,000 entries. ComfyUI task media has a configurable application limit of 1 GB by default, and active task inputs are protected from automatic cleanup. Clearing the extension's site data removes these local records.

### Network requests

- Searches, post details, credential tests, authenticated actions, and media downloads contact the selected Booru source and the media hosts declared in the extension Manifest.
- Credentials are sent only to the corresponding source when it is used or tested. They are not sent to another source and are excluded from request cache keys and user-facing errors.
- Some sources do not provide tag categories. In that case, the extension may send only the missing tag names to Danbooru to retrieve category metadata. This cross-source enrichment does not include source credentials, search history, favorite groups, or downloaded media.
- When Danbooru blocks a background request with a browser challenge, the extension may open a background Danbooru tab and retry using the browser's existing Danbooru session.
- When the user sends a post, local file, or an image from an enabled third-party webpage to ComfyUI, the extension sends the selected media, the active API workflow, configured option values, and optionally formatted Booru post tags only to the configured `127.0.0.1` ComfyUI instance. To send a third-party webpage image, the extension downloads the selected public HTTP(S) image without page cookies, credentials, or authorization headers; it rejects local, private-network, link-local, non-image, and over-100-MiB resources. Third-party webpage images do not populate `REVERSE`. It does not discover or connect to LAN or remote ComfyUI hosts. Generated outputs are read from that same local instance and are cached only when output caching is enabled.

The extension requests `storage`, `downloads`, `unlimitedStorage`, `scripting`, and declarative network request permissions to persist settings and bounded local data, save requested files, support page integrations and challenge fallback, and attach required media request headers. Required host permissions are limited to the five supported Booru services, their media subdomains, and HTTP(S) access to `127.0.0.1`. The optional Send to ComfyUI webpage feature is off by default and requests `<all_urls>` only after the user enables it; disabling the feature removes that permission. It does not request system notifications or a credential-management permission.

## 中文

Danbooru Viewer 不包含分析、遥测、广告或远程错误上报，也不运行项目自有服务器。

### 本机保存的数据

- 偏好设置和可选图源凭据保存在浏览器扩展存储中。凭据未额外加密，能够访问浏览器配置文件的人可能读取这些数据。
- 本地收藏、收藏分组、下载历史、媒体缓存、标签分类元数据、导入的 ComfyUI API 工作流、任务历史和本地任务输入保存在 IndexedDB；配置的 ComfyUI 地址保存在浏览器扩展存储中。
- 浏览媒体缓存保留 24 小时，默认使用可配置的 512 MiB LRU 容量上限；持久化标签元数据最多保留 10,000 条。ComfyUI 任务媒体默认受 1 GB 应用内容量限制，活动任务输入不会被自动清理。清除扩展站点数据会删除这些本地记录。

### 网络请求

- 搜索、帖子详情、凭据测试、登录后操作和媒体下载会访问当前选择的 Booru 图源及 Manifest 声明的媒体域名。
- 凭据只在使用或测试对应图源时发送，不会发送给其他图源，也不会写入请求缓存键或面向用户的错误信息。
- 部分图源不提供标签分类。此时扩展可能只把缺失的标签名称发送到 Danbooru 获取分类元数据；跨图源补全不包含图源凭据、搜索历史、收藏分组或下载媒体。
- Danbooru 使用浏览器挑战拦截后台请求时，扩展可能在后台打开 Danbooru 标签页，并利用浏览器已有的 Danbooru 会话重试。
- 用户把帖子、本地文件或已启用第三方网页中的图片发送到 ComfyUI 时，扩展只会向配置的 `127.0.0.1` ComfyUI 实例发送所选媒体、活动 API 工作流、选项值，以及按设置选择性格式化的 Booru 帖子标签。发送第三方网页图片前，扩展会在不携带网页 Cookie、凭据或授权头的情况下下载用户选择的公开 HTTP(S) 图片，并拒绝本机、局域网、链路本地、非图片和超过 100 MiB 的资源；第三方网页图片不会填充 `REVERSE`。扩展不会发现或连接局域网与远程 ComfyUI 主机。生成结果从同一本机实例读取，并且仅在启用输出缓存时保存在本机。

扩展申请 `storage`、`downloads`、`unlimitedStorage`、`scripting` 和声明式网络请求权限，分别用于保存设置及有界本地数据、保存用户要求的文件、支持网页集成与挑战回退，以及附加媒体请求所需的请求头。必需主机权限仅覆盖五个受支持的 Booru 服务及其媒体子域名，以及用于用户主动执行 ComfyUI 工作流的 `127.0.0.1` HTTP(S) 地址。“发送到 ComfyUI”网页功能默认关闭，仅在用户主动开启时申请可选的 `<all_urls>` 权限，关闭功能会撤销该权限；不申请系统通知或凭据管理权限。
