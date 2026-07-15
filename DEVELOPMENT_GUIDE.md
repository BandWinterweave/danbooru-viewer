# Development Guide — 如何指导 Agent 分阶段实施

## 核心原则

| 原则 | 说明 |
|------|------|
| **一次只做一个 Phase** | 不要把整个 PLANNING.md 一次性投喂，Agent 会混乱 |
| **每个 Phase 必须可验收** | 结束时能看到能跑的东西，不是半成品 |
| **先骨架后肉** | 先跑通完整链路（搜索→渲染→查看），再加花活 |
| **每次指令附带验收标准** | "当你运行 `npm run dev`，打开 chrome://extensions 加载后，Ctrl+T 能看到一个搜索框" |

---

## Phase 1: 项目脚手架 + 核心浏览 (首个任务)

**投喂方式**：把下面这段复制给 Agent，附带 PLANNING.md 作为引用。

---

### 任务描述

```
请按照 PLANNING.md 的技术栈和架构，创建 Danbooru Viewer 浏览器扩展的 Phase 1 脚手架。

## 要求

1. 使用 Vite + React 18 + TypeScript 5 + Tailwind CSS 3 + @samrum/vite-plugin-web-extension
   搭建 Manifest V3 浏览器扩展项目

2. 创建以下入口页面：
   - src/newtab/    → 新标签页（主界面）
   - src/popup/     → 工具栏弹窗（简单占位即可）
   - src/options/   → 设置页（简单占位即可）
   - src/background/ → Service Worker（API 代理 + 消息路由）

3. 主界面 (NewTab) 实现以下组件：
   - AppShell: 全局布局壳
   - Header (Row1-3): 见 PLANNING.md 第9节 即时过滤层设计
     - Row1: Logo + Booru 源选择器（标签式切换） + 主题/设置按钮
     - Row2: 搜索栏 + 🟢🟡🔴 评级快捷切换 + 评分/排序快捷入口
     - Row3: FilterChipBar（活跃过滤芯片栏 + 清除/添加/保存预设按钮）
   - PostGrid: 网格布局，无限滚动
   - PostCard: 缩略图卡片，hover 显示 PostCardOverlay

4. 实现 Danbooru Adapter：
   - searchPosts — 调用 /posts.json 搜索
   - getPost — 获取单个帖子详情
   - autocomplete — 标签自动补全
   - 需要能处理 Basic Auth 认证（可选，无认证时以只读模式工作）

5. Background SW 实现 API 代理：
   - 监听 runtime.onMessage，代理所有跨域 fetch 请求
   - 返回 UnifiedPost[] 格式数据给前端

6. Zustand Store 创建：
   - post-store.ts: 帖子列表 + 加载状态
   - filter-store.ts: 过滤芯片管理（addTagFilter/removeFilter/clearAll/toggleRating）
   - ui-store.ts: 主题/侧栏/详情面板显隐
   - settings-store.ts: 持久化设置到 chrome.storage.local

7. 搜索功能流程：
   - 用户在搜索框输入标签 → 防抖300ms后调用 autocomplete 显示建议
   - 用户回车或点击搜索 → filter-store.getSearchQuery() 生成 API 查询参数
   - → post-store.search() → Background SW 代理 fetch → 渲染 PostGrid
   - 滚动到底部 → 自动加载下一页

## 不需要做的 (留到后续 Phase)
- 不需要 Gelbooru/Safebooru/Yande.re 适配器（Phase 2）
- 不需要远程收藏/投票/评论写操作（Phase 2）
- 不需要图片查看器 Lightbox（Phase 2）
- 不需要下载管理器（Phase 3）
- 不需要键盘快捷键（Phase 3）
- 不需要 Content Script（Phase 3）
- 不需要国际化（Phase 4）
- 不需要暗色主题完整覆盖（Phase 4）

## 验收标准
1. 运行 npm run dev 能正常构建，无 TS 错误
2. Chrome 加载扩展后，Ctrl+T 新标签页能看到完整的 Header + 搜索栏 + 评级切换
3. 在搜索框输入 "1girl" 回车，能看到 Danbooru 的帖子网格
4. 点击某个帖子卡片，侧栏能打开显示该帖子的详情信息（标签列表、评分等）
5. 点击帖子标签旁的 [+] 按钮，该标签出现在 Row3 FilterChipBar 中
6. 点击 FilterChip 的 [×] 能移除过滤条件，帖子列表自动刷新
7. 点击 Row2 的 🟢 按钮能过滤 Safe 评级内容
8. 滚动到底部能自动加载更多帖子
9. 所有状态通过 Zustand + chrome.storage 持久化，刷新页面后保留
```

### 如果 Phase 1 太大，可以进一步拆分：

```
拆分 A: 纯脚手架
  - 只做 Vite + MV3 配置，4个入口页面，最简单的 "Hello World" 渲染
  - 验收: 加载扩展后能看到页面

拆分 B: 搭 UI 骨架
  - AppShell, Header(Row1-3), PostGrid 占位, PostCard 占位
  - 验收: 所有 UI 结构完整，点击/切换不报错，使用 mock 数据

拆分 C: 接 API
  - Danbooru Adapter, Background SW 代理, Zustand stores
  - 验收: 搜索真实数据，无限滚动

拆分 D: 过滤层联动
  - FilterChipBar 状态机, PostCardOverlay [+][-], 评级切换
  - 验收: 过滤芯片完整流转
```

---

## Phase 2: 多源 + 完整读写

```
请基于已完成的 Phase 1 代码，实现 Phase 2 功能。

## 要求

1. 实现 Gelbooru/Safebooru/Yande.re/Rule34 适配器
   - 每个适配器按 PLANNING.md 第5节接口实现
   - 注意各源差异：Gelbooru 无 tag_count_* 分类字段，评级映射不同，分页机制不同
   - Rule34 可复用 Gelbooru 适配器（API 结构几乎一致）
   - 切换源后搜索自动重新查询对应 API

2. 实现认证系统
   - 设置页添加 API Key Manager，按源独立管理
   - 认证后 Header 显示认证状态指示器（🔑绿/灰）
   - 未认证时写操作按钮禁用，hover 提示"需要 API Key"

3. 实现远程写操作（需认证）
   - Danbooru: POST/DELETE /favorites 收藏
   - Danbooru: POST/DELETE /posts/:id/votes 投票
   - Danbooru: GET + POST /comments 评论读取+发布
   - Gelbooru: POST /favorites（以 Gelbooru 的 API 方式实现）

4. 实现本地收藏系统
   - IndexedDB 存储本地收藏数据
   - FavoriteList 组件（列表视图 + 分组）
   - FavoriteGroup 管理（创建/删除/添加帖子）
   - 收藏导出/导入（JSON 格式）

5. 实现过滤预设系统
   - FilterChipBar 的 [Save as Preset] 功能
   - 保存/加载/删除预设
   - 预设列表显示在侧栏

6. 实现 ImageViewer (Lightbox)
   - 使用 yet-another-react-lightbox
   - 支持缩放/平移/全屏
   - ← → 键切换图片

## 验收标准
1. 通过 BooSourceTabs 能切换到 Gelbooru，搜索能返回 Gelbooru 的结果
2. 配置 Danbooru API Key 后能点赞和收藏帖子
3. 收藏的帖子能在本地收藏列表中看到
4. 保存过滤预设后，能从侧栏重新加载
5. 点击帖子能打开图片查看器，缩放/平移正常
```

---

## Phase 3: 下载 + 快捷键 + 增强体验

```
请基于 Phase 1+2 代码，实现 Phase 3 功能。

## 要求

1. 下载管理器
   - 单帖下载：可选择原图/大图/缩略图尺寸
   - 批量下载：选中多个帖子后批量下载
   - 自定义命名规则：支持 {id}/{tags}/{artist}/{rating}/{source} 等变量
   - 下载历史：记录已下载 MD5，列表页标记"已下载"状态

2. 键盘快捷键
   - 实现 useKeyboard hook
   - 按 PLANNING.md 第10节键盘快捷键表实现所有快捷键
   - 冲突检测：如果快捷键已被系统占用，给予提示

3. NoteOverlay
   - 图片上叠加 Danbooru 翻译注释

4. 关联内容
   - RelatedTags：调用 /related_tag.json 展示
   - Pools 浏览：帖子所属画集列表
   - Children/Parent 关系展示

5. 幻灯片模式
   - 自动播放、可调间隔速度

6. Content Script
   - 注入 Danbooru 页面，增加悬浮预览和快捷复制标签按钮

7. 虚拟滚动
   - 使用 @tanstack/react-virtual 优化 PostGrid
   - 1000+ 帖子列表不卡顿

## 验收标准
1. 能下载单张帖子原图，文件名按规则命名
2. 批量选择3张帖子能一次性下载
3. 按 D 键能下载当前浏览的帖子
4. 幻灯片模式按 Ctrl+Shift+S 启动/停止
```

---

## Phase 4: 打磨发布

```
请基于 Phase 1+2+3 代码，实现 Phase 4 打磨。

## 要求

1. 错误处理完善
   - React Error Boundary 全局捕获
   - Toast 通知系统 (网络错误/操作成功/限流提醒)
   - 空状态/错误状态/加载状态 UI 组件
   - 重试按钮

2. 暗色主题
   - Tailwind dark: variant 完整覆盖所有组件
   - 所有颜色在暗色模式下可读

3. 性能优化
   - 图片缩略图 IndexedDB 缓存 (TTL 24h, LRU 淘汰)
   - 请求去重（同参数请求不重复发出）
   - 防抖/节流优化（搜索输入、滚动事件）
   - 构建产物 Code Splitting

4. 国际化基础
   - en 默认语言
   - 所有用户可见文本集中管理

5. Chrome Web Store / Firefox Add-ons 适配
   - 完整商店清单
   - 截图（明亮/暗色主题下的浏览界面）
   - 描述文案

6. 测试
   - 关键路径 E2E 测试
   - Booru Adapter 单元测试

## 验收标准
1. npm run build 无报错，产物能正常加载
2. 暗色模式切换后所有 UI 可读
3. 网络断开时显示友好错误提示，有重试按钮
4. 图片缓存生效：第二次打开同一页面图片不闪烁重新加载
```

---

## 给用户的实用建议

### 1. 如果 Agent 跑偏了怎么办

```
请停止当前任务。回顾一下已完成的部分，列出：
1. 哪些已经可用
2. 哪些还没实现
3. 当前最大的 blocker 是什么

然后我们重新聚焦到 [具体任务]。
```

### 2. 如果某个组件实现不理想

```
[组件名] 的实现不符合预期。请参考 PLANNING.md 中 [具体章节] 的设计，
特别是 [具体细节]，重新实现该组件。之前需要考虑：
1. 状态应该从哪个 Zustand store 读取
2. 交互应该触发哪些 action
3. 需要保持和哪些现有组件的兼容
```

### 3. 如果遇到技术问题

```
[具体问题描述]。请先研究 [相关库] 的文档（必要时用 webfetch 获取），
然后给出解决方案选项，等我选择后再实现。
```

### 4. 每个 Phase 结束后的检查清单

```
请检查以下内容：
1. npm run dev 能否正常构建（无 TS 错误）
2. 加载扩展后所有核心流程是否跑通
3. 是否引入了新的 npm 依赖（如有，列出）
4. 哪些已知的边界情况还未处理（列出）
5. 控制台是否有 red error/warning（列出）
```

### 5. 项目太大的心理建设

这个项目确实大，但只要坚持**每次只做一个 Phase，做完验收再做下一个**，就不会失控。Phase 1 完成后已经是一个"能用的 Danbooru 浏览器"，之后每个 Phase 都是增量增强。
