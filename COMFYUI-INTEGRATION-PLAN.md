# ComfyUI Browser Sender Pro 整合执行计划

## 1. 目标

将 `D:\Baidu\comfyui-browser-sender-pro` 的 ComfyUI 工作流发送、串行队列、进度监控、输出历史和任务恢复能力整合到 Danbooru Viewer 中。

整合后的功能应属于 Danbooru Viewer 的现有 React/TypeScript 扩展，而不是继续维护两个并列的扩展外壳。ComfyUI 工作台、设置、通知、国际化、存储和测试都遵循当前项目的架构与视觉规范。

## 2. 已确认范围

### 2.1 支持的输入

- Danbooru Viewer 浏览页中的帖子。
- 帖子详情侧栏中的当前帖子。
- 多选帖子。
- 当前收藏组的全部条目，不受分页影响。
- 本地单文件、多文件和文件夹。
- 桌面端支持拖放；同时提供文件和文件夹选择按钮。
- 文件夹递归导入。Firefox 不具备对应能力时使用目录选择或多文件选择降级。

### 2.2 不纳入首期的输入

- 任意网页 Hover SEND。
- 任意网页拖放。
- 原插件的全页面 Content Script。
- Danbooru/Gelbooru/Safebooru 的 MAIN-world 页面桥。

Viewer 帖子直接使用现有 `UnifiedPost`，不重新解析网页 DOM 或猜测 Booru URL。

### 2.3 浏览器和服务器

- Chrome 与 Firefox 同步支持。
- ComfyUI 只允许连接 `127.0.0.1`。
- 端口由用户配置，默认 `8188`。
- 保留原插件的 HTTP/HTTPS 地址形式。
- 首期不支持 Basic、Bearer、API Key、自定义认证头或自签名证书绕过。
- 首期只管理一个 ComfyUI 实例。
- 不增加独立的连接测试按钮；工作台加载或首次发送时进行必要的连接检查。

### 2.4 用户界面

- 新增独立 ComfyUI 工作台。
- 工作台使用当前项目的布局、颜色、间距、组件、响应式策略和国际化机制。
- 设置集成到现有设置界面。
- 缩略图、帖子详情侧栏、多选工具栏和收藏组提供 Send 入口。
- 快捷 Send 按当前活动工作流和已保存的 OPTION 值立即入队。
- 无有效工作流时阻止入队，并引导用户前往工作台导入或激活工作流。
- 不使用原插件的 Shadow DOM 浮层、原生 HTML UI 或独立 Popup 作为主要交互界面。

### 2.5 媒体处理

- 静态图片直接发送。
- GIF 和视频提取第一帧后发送。
- ZIP/ugoira 解析并提取第一帧后发送。
- Viewer 帖子使用原图优先，失败时依次回退到样图和预览图，并记录实际使用的资源。
- 首帧最终图片不设置应用层文件大小或像素上限；保留浏览器、Canvas、ComfyUI 和存储层的原生失败处理。
- 第一帧处理仍应加入解码超时、异常捕获和资源释放，避免媒体失败拖垮工作台。

### 2.6 工作流

- 首期只导入 ComfyUI API JSON，不转换 ComfyUI UI 工作流 JSON。
- 支持完整预设管理：导入、命名、切换、重命名、替换、复制、导出、删除和排序。
- 严格沿用原插件的节点标题约定：
  - `INPUT`：输入图片节点。
  - `OUTPUT*`：收集图片和文本输出。
  - `REVERSE`：接收标签提示词。
  - `OPTION*`：文本或整数参数。
- 导入时校验节点结构和必需字段，错误应定位到工作流及节点，而不是延迟到发送时才失败。
- 队列任务入队时冻结完整工作流 JSON，后续编辑或删除预设不能影响已有任务。
- OPTION 文本和整数编辑行为保持原插件语义，并按工作流预设保存。

### 2.7 标签

- 复用现有标签复制格式和设置。
- 支持 artist、character、copyright、general、meta 五类标签的启用、排序和格式化。
- 新增“图片 Tag 替代 REVERSE”设置，默认开启。
- 开启时，将格式化后的标签写入所有 `REVERSE` 节点的 `inputs.text`。
- 不修改连接，不删除 `REVERSE` 节点。
- 本地文件没有标签时写入空字符串并继续发送。
- 入队时冻结最终标签文本，之后修改标签设置只影响新任务。

### 2.8 队列、恢复和取消

- 每个输入生成一个独立任务。
- 允许重复入队，不做自动去重。
- 队列串行执行。
- 支持查看、上下移动、删除等待项、取消当前项、当前节点、进度、耗时和批次统计。
- 服务离线时任务无限等待，界面显示明确的等待状态。
- 等待中的任务可以删除或取消。
- 运行中取消允许调用 ComfyUI 全局 `/interrupt`，操作前明确提示可能中断该实例上的其他任务。
- 通过 WebSocket 和 History/轮询合并状态；History 是最终完成状态来源。
- 后台 Service Worker 重启后恢复队列和任务状态。
- 页面关闭后继续执行，重新打开 Viewer 后恢复状态。
- `/prompt` 提交临界区无法确认时标记为“需人工确认/重试”，不自动重复提交。
- 重试使用任务冻结的工作流、OPTION、标签和输入快照。

### 2.9 历史和输出

- 保留图片预览、放大查看、文本输出、输出列表和任务历史。
- 历史保留元数据、prompt ID、输入来源、工作流快照和输出引用。
- 输出 Blob 可选缓存，但受本地容量上限约束。
- 历史默认 100 条，数量可配置。
- 支持单条删除、清空历史、查看输出和失败/未知任务重试。
- 删除 Viewer 历史只删除本地元数据和缓存，不删除 ComfyUI 服务器文件。
- 使用扩展内工作台、未读计数和 Toast 展示结果，不申请系统通知权限。

### 2.10 存储和权限

- 申请 `unlimitedStorage`，但应用内默认总容量上限为 1 GB。
- 本地输入和输出缓存使用 IndexedDB Blob，不使用 Data URL 作为长期存储。
- 待执行、恢复中和未完成任务的输入 Blob 受保护，不能被清理策略删除。
- 清理优先级：已完成输出缓存、已完成输入缓存、失败任务附件。
- 服务器配置、活动工作流元数据和小型设置使用扩展存储。
- 完整工作流、队列、历史和媒体 Blob 不应通过高频完整快照广播。
- 首期不迁移原插件的浏览器私有存储；用户通过新工作台重新导入 API JSON。

## 3. 现有代码整合边界

### 3.1 当前项目可复用能力

- `UnifiedPost`：帖子来源、原图、样图、预览图、媒体类型和五类标签。
- `tag-copy`：现有标签排序、格式化和复制设置。
- `idb-keyval`/IndexedDB：媒体缓存和大对象存储模式。
- Zustand：设置、UI、帖子和收藏状态。
- 现有 i18n、Toast、响应式样式和无障碍组件。
- 现有后台消息校验、扩展来源校验和网络错误处理。
- 现有 Chrome/Firefox 构建、Manifest 校验、Playwright 和 Vitest 测试体系。

### 3.2 应迁移或重写的插件能力

允许使用已确认授权的原插件代码作为实现参考和迁移来源，但最终代码必须改造成 TypeScript，并符合当前项目的边界与测试方式。

- ComfyUI HTTP 客户端：`/upload/image`、`/prompt`、`/history/{id}`、`/queue`、`/interrupt`、`/view`。
- WebSocket 状态处理和 History 轮询。
- INPUT、OUTPUT、REVERSE、OPTION 工作流变换。
- 串行任务执行器、队列排序、取消和恢复。
- 输出图片和文本提取。
- 任务快照、未知提交状态和后台重启恢复。
- 图片签名校验、文件名清洗和超时处理。

### 3.3 不应迁移的代码

- 原生 HTML/Shadow DOM 浮层。
- 任意网页 Content Script。
- MAIN-world Booru 桥。
- 原插件的全标签页状态广播。
- 原插件 Popup 作为主设置和工作台。
- 允许任意远程主机的权限和网络逻辑。

## 4. 目标模块设计

建议新增以下模块，实际命名以现有目录约定为准：

```text
src/services/comfy/
  types.ts          # 配置、工作流、任务、输出、错误和消息联合类型
  workflow.ts       # API JSON 校验、节点发现、OPTION/REVERSE/INPUT/OUTPUT 变换
  client.ts         # ComfyUI HTTP/WebSocket 客户端
  media.ts          # Viewer 媒体、本地文件、GIF/视频/ugoira 首帧规范化
  storage.ts        # 任务、预设、Blob、历史和容量清理
  executor.ts       # 串行执行、恢复、退避等待、取消和未知状态

src/stores/
  comfy-store.ts    # 工作台 UI 状态和轻量任务状态
  settings-store.ts # ComfyUI 地址、容量、历史和标签相关设置扩展

src/components/comfy/
  ComfyWorkbench.tsx
  WorkflowManager.tsx
  WorkflowOptions.tsx
  ComfyQueue.tsx
  ComfyHistory.tsx
  ComfyOutputViewer.tsx
  LocalInputDropzone.tsx
  BatchSendDialog.tsx
```

后台消息建议使用独立的 discriminated union，不复用现有 Booru `API_REQUEST`：

```text
COMFY_LOAD_STATE
COMFY_SAVE_SETTINGS
COMFY_IMPORT_WORKFLOW
COMFY_EXPORT_WORKFLOW
COMFY_TEST_ON_LOAD
COMFY_ENQUEUE_POSTS
COMFY_ENQUEUE_FILES
COMFY_ENQUEUE_COLLECTION
COMFY_MOVE_TASK
COMFY_REMOVE_TASK
COMFY_CANCEL_TASK
COMFY_RETRY_TASK
COMFY_GET_HISTORY
COMFY_DELETE_HISTORY
COMFY_CLEAR_HISTORY
COMFY_STATE_UPDATE
```

所有消息必须校验结构、扩展来源和 payload 大小。普通网页不得构造任意 ComfyUI 请求。

## 5. 分阶段执行

### 阶段 0：基线和协议确认

1. 记录当前项目构建、测试、Manifest 校验和 Firefox 构建基线。
2. 复核原插件授权文件或授权凭证，并将依据记录到项目内部变更说明。
3. 整理 ComfyUI API JSON 示例，覆盖最小有效工作流、多个 INPUT/OUTPUT、文本 OPTION、整数 OPTION、REVERSE 和错误工作流。
4. 确定扩展消息 schema、任务状态枚举、错误分类和 IndexedDB key 结构。

完成标准：协议类型和数据迁移边界在代码评审前固定，不能再通过隐式 any 或无结构消息传递。

### 阶段 1：工作流核心和 ComfyUI 客户端

1. 实现 API JSON 解析和结构校验。
2. 实现 INPUT、OUTPUT、REVERSE、OPTION 变换。
3. 实现标签格式化结果写入 REVERSE 的逻辑。
4. 实现 HTTP 请求、超时、响应校验和 ComfyUI 错误解析。
5. 实现 WebSocket 连接、断线重连、事件过滤和 History 轮询。
6. 实现本机 `127.0.0.1` 地址解析与端口校验。

完成标准：核心逻辑不依赖 React、浏览器 DOM 或具体页面，Vitest 可覆盖全部协议分支。

### 阶段 2：存储、媒体和执行器

1. 增加版本化设置 schema 和迁移。
2. 增加工作流预设存储、导入、导出、排序和删除保护。
3. 增加本地文件 Blob 暂存、租约和 1 GB 容量管理。
4. 增加静态图片、GIF、视频和 ugoira 首帧规范化。
5. 将 `UnifiedPost` 转换为队列输入，并实现原图到预览图回退。
6. 实现独立任务快照，冻结服务器、工作流、OPTION、标签和输入引用。
7. 实现串行执行、无限等待、重启恢复、取消和未知提交状态。
8. 实现输出元数据、输出缓存、历史条数限制和清理。

完成标准：后台在无 UI 页面时可继续执行；Service Worker 重启后不会丢失可恢复任务；资源清理不删除活动任务输入。

### 阶段 3：后台消息接入

1. 在 `src/background/index.ts` 增加 ComfyUI 消息路由。
2. 与现有 Booru 网络代理隔离，不放宽既有 API 白名单。
3. 对发送者、消息类型、地址、工作流结构、文件引用和大小进行校验。
4. 只向打开的 ComfyUI 工作台订阅者发送轻量状态；历史和输出按需读取。
5. 覆盖 Chrome Service Worker 与 Firefox background script 两种生命周期。

完成标准：普通网页、内容脚本和未知消息无法触发任意本地 ComfyUI 操作。

### 阶段 4：设置和工作台 UI

1. 在现有 SettingsPanel 增加 ComfyUI 设置区。
2. 实现默认地址、端口、容量、历史数量和标签选项。
3. 实现独立工作台导航、空状态、导入错误和无服务状态。
4. 实现工作流管理和 OPTION 编辑。
5. 实现本地文件/文件夹选择、拖放、扫描进度和跳过原因。
6. 实现队列、进度、节点、耗时、排序、删除和取消。
7. 实现输出预览、放大、文本输出、历史删除、清空和重试。
8. 将 Send 接入缩略图、详情侧栏、多选工具栏和收藏组。
9. 实现大批量超过 50 项时的确认摘要。
10. 增加中英文文案、键盘操作、焦点管理和移动端布局。

完成标准：所有快捷 Send 使用当前配置立即入队；工作台功能完整但不引入嵌套卡片、独立视觉体系或移动端横向溢出。

### 阶段 5：Manifest、隐私和发布产物

1. 确认并保留当前项目已有的 `unlimitedStorage` 权限。
2. 在保留现有 Booru 主机权限的基础上，增加访问 `127.0.0.1` 所需的最小主机权限，不复制原插件的 `*://*/*`。
3. 更新 Manifest schema、artifact 校验和 Chrome/Firefox 构建转换。
4. 更新 `README.md` 的配置、工作流约定和使用限制。
5. 更新 `PRIVACY.md`，说明本地文件、标签、工作流、任务历史和 ComfyUI 地址的存储与发送范围。
6. 更新 `CHANGELOG.md`，记录功能、权限和已知限制。
7. 检查商店权限说明、最小权限原则和可重复构建。

完成标准：两个浏览器构建均通过产物检查，Manifest 不包含任意网页权限、系统通知权限或认证凭据能力。

### 阶段 6：验证和发布前检查

1. 运行格式化、ESLint、TypeScript、Vitest、覆盖率和构建检查。
2. 运行 Chrome/Firefox 扩展加载烟测。
3. 运行 Playwright 桌面和移动视口测试。
4. 使用本地 ComfyUI 测试工作流覆盖成功、失败、断线、恢复、取消和输出。
5. 验证静态图、GIF、视频和 ugoira 第一帧。
6. 验证大批量确认、重复入队、收藏组全部条目和存储容量不足。
7. 验证页面关闭、后台重启、WebSocket 断线和 `/prompt` 未知提交状态。
8. 检查权限、隐私文档、构建产物和测试结果一致。

## 6. 测试矩阵

### 核心逻辑

- API JSON 导入、导出、复制、排序和删除保护。
- 缺失 INPUT、无效 OUTPUT、错误 OPTION 和 REVERSE 字段。
- 多个 INPUT/OUTPUT/REVERSE 节点。
- 文本 OPTION、整数 OPTION、整数连接替换和嵌套输入限制。
- 五类标签配置、格式化和空标签。
- 任务快照不受工作流后续编辑影响。

### 媒体

- 原图成功、原图失败后样图回退、预览图回退。
- PNG/JPEG/WebP 静态图片。
- GIF 第一帧、视频第一帧、ugoira/ZIP 第一帧。
- 无法解码、超时、Canvas 异常和 ComfyUI 上传错误。
- 本地文件夹递归导入、重复文件、不可读文件和浏览器降级。

### 执行器

- 排队、排序、删除、重复入队和独立任务结果。
- HTTP 断线、ComfyUI 离线、无限等待和恢复。
- WebSocket 断线重连及 History 最终状态。
- Service Worker 重启和页面关闭后的继续执行。
- 等待任务取消、运行中全局 interrupt 警告。
- `/prompt` 提交成功但 prompt ID 丢失时不自动重复提交。

### UI 和发布

- 缩略图、详情、多选、收藏组和本地文件发送入口。
- 50 项以上批量确认和跳过项统计。
- 工作台、设置、输出查看和历史操作。
- 移动端布局、键盘焦点、中文/英文文案和错误状态。
- Chrome/Firefox 构建、Manifest 权限、隐私文档和产物校验。

## 7. 风险和处理原则

| 风险 | 处理原则 |
| --- | --- |
| ComfyUI `/interrupt` 是实例级操作 | 运行中取消前显示明确警告；等待任务取消不调用 interrupt。 |
| `/prompt` 提交状态未知 | 标记人工重试，禁止自动重试造成重复生成。 |
| 服务离线时无限等待 | 工作台持续显示等待状态，允许删除；输入 Blob 受保护，容量不足时阻止新增。 |
| 不限制源媒体和首帧大小 | 加入解码超时、异常捕获和资源释放；记录浏览器/ComfyUI 原生失败。 |
| MV3 Worker 生命周期不稳定 | 状态持久化、恢复扫描、History 轮询和 Chrome/Firefox 双端测试。 |
| 本地文件占用空间 | IndexedDB Blob、1 GB 默认上限、活动任务保护和完成后自动清理。 |
| 原插件节点约定严格 | 导入时校验并指出节点错误，不进行隐式自动推断。 |
| 原插件依赖任意网页权限 | 首期完全移除网页能力，只保留 Viewer 和本地文件输入。 |
| 原项目权限校验固定 | 同步更新 Manifest schema、artifact 检查、隐私声明和商店说明。 |
| 工作流被后续编辑影响历史任务 | 入队时保存完整 JSON 和所有输入配置快照。 |

## 8. 完成定义

整合完成必须同时满足：

1. 用户可以在 Viewer 帖子、详情、多选、收藏组和本地文件/文件夹上直接 Send。
2. Send 使用活动工作流立即入队，并在无有效工作流时给出可操作引导。
3. API JSON 工作流可导入、管理、导出，并正确执行 INPUT/OUTPUT/REVERSE/OPTION 约定。
4. 图片标签使用现有 Viewer 标签设置，默认可替换 REVERSE 文本。
5. GIF、视频和 ugoira 均能按首帧进入统一图片上传链路。
6. 队列支持串行执行、排序、删除、取消、无限等待、后台恢复和未知提交状态保护。
7. 工作台能查看进度、当前节点、耗时、图片输出、文本输出和历史，并支持重试。
8. 本地输入和可选输出缓存遵守 1 GB 默认容量与活动任务保护规则。
9. Chrome 与 Firefox 的构建、扩展加载和关键 E2E 流程均通过。
10. 权限、隐私声明、README、CHANGELOG、Manifest schema 和产物校验同步更新。

## 9. 首次实现顺序

建议实际开发顺序保持如下：

1. 先实现并测试工作流变换、ComfyUI 客户端和任务状态机。
2. 再实现 IndexedDB、媒体规范化和后台恢复。
3. 接入后台消息协议和安全校验。
4. 完成设置和独立工作台。
5. 最后接入各个 Send 入口、发布权限和完整 E2E。

任何阶段都不应先复制原插件 UI 或扩大网页权限。只有核心协议、任务快照和恢复行为通过测试后，才进入完整界面接入。
