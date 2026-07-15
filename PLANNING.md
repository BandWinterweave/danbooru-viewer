# Danbooru Viewer - 旗舰级浏览器插件规划文档

---

## 目录

1. [项目概述](#1-项目概述)
2. [技术栈](#2-技术栈)
3. [项目目录结构](#3-项目目录结构)
4. [核心数据模型](#4-核心数据模型)
5. [Booru 适配器接口](#5-booru-适配器接口)
6. [各 Booru 源差异映射](#6-各-booru-源差异映射)
7. [数据流架构](#7-数据流架构)
8. [组件树 - 主界面 NewTab](#8-组件树---主界面-newtab)
9. [即时过滤层设计 - Quick Filter Layer](#9-即时过滤层设计---quick-filter-layer)
10. [键盘快捷键](#10-键盘快捷键)
11. [状态管理设计 - Zustand Stores](#11-状态管理设计---zustand-stores)
12. [API 请求/响应流](#12-api-请求响应流)
13. [错误处理策略](#13-错误处理策略)
14. [安全与隐私](#14-安全与隐私)
15. [开发阶段规划](#15-开发阶段规划)
16. [关键依赖汇总](#16-关键依赖汇总)
17. [附录: API 响应示例](#17-附录-api-响应示例)

---

## 1. 项目概述

| 项目 | 说明 |
|------|------|
| **名称** | Danbooru Viewer |
| **类型** | Chrome/Firefox 浏览器扩展 (Manifest V3) |
| **主界面** | 新标签页 (NewTab)，Ctrl+T 打开 |
| **核心功能** | 浏览/搜索/收藏/下载 Danbooru 系图站的帖子 |
| **Booru 源** | Danbooru、Gelbooru、Safebooru、Rule34.xxx、Yande.re |
| **交互模式** | 完整读写 —— 支持远程收藏、投票、评论等 API 写操作 |
| **特色** | 即时过滤层 (Quick Filter Layer)，一键操作标签、评级、评分等过滤 |

---

## 2. 技术栈

| 层级 | 技术选择 | 理由 |
|------|---------|------|
| **UI 框架** | React 18 + TypeScript 5 | 组件化开发，类型安全 |
| **构建工具** | Vite + @samrum/vite-plugin-web-extension | 针对浏览器扩展优化的 Vite 插件 |
| **状态管理** | Zustand | 轻量级，支持 persist 中间件同步到 chrome.storage |
| **样式方案** | Tailwind CSS 3 + CSS Modules | 快速开发 + 样式隔离 |
| **HTTP 客户端** | ky (fetch 封装) | 支持拦截器/重试/超时/限流 |
| **图片查看器** | yet-another-react-lightbox | 支持缩放/平移/全屏/画廊模式 |
| **虚拟滚动** | @tanstack/react-virtual | 大量帖子列表性能优化 |
| **数据持久化** | idb-keyval (IndexedDB) | 图片缓存、收藏数据，大数据量友好 |
| **扩展存储** | chrome.storage.local | 设置、认证信息、UI 状态 |
| **测试** | Vitest + @testing-library/react | 组件和单元测试 |

---

## 3. 项目目录结构

```
danbooru-viewer/
├── public/
│   ├── icons/                        # 扩展图标 16/32/48/128
│   └── _locales/en/                  # 国际化 (预留)
│
├── src/
│   ├── manifest.json                 # MV3 清单
│   │
│   ├── background/                   # Service Worker
│   │   ├── index.ts                  # SW 入口, 消息路由
│   │   ├── api-proxy.ts              # 代理所有 API 请求 (解决 CORS)
│   │   ├── cache-manager.ts          # 统一缓存策略 (LRU + TTL)
│   │   └── download-manager.ts       # 下载队列/进度/命名规则
│   │
│   ├── newtab/                       # ★ 主界面 (NewTab)
│   │   ├── index.html
│   │   ├── main.tsx                  # React 入口
│   │   └── App.tsx                   # 根组件, 路由
│   │
│   ├── popup/                        # 工具栏弹窗 (快捷入口)
│   │   ├── index.html
│   │   └── main.tsx
│   │
│   ├── options/                      # 设置页
│   │   ├── index.html
│   │   └── main.tsx
│   │
│   ├── content/                      # 内容脚本 (注入 danbooru 等站点增强)
│   │   └── index.ts
│   │
│   ├── components/                   # 共享组件
│   │   ├── layout/
│   │   │   ├── AppShell.tsx          # 全局布局壳 (Header + 内容区)
│   │   │   ├── Header.tsx            # 顶部导航 (搜索栏/源切换/过滤层/设置)
│   │   │   └── Sidebar.tsx           # 侧栏 (收藏列表/搜索历史)
│   │   ├── search/
│   │   │   ├── SearchBar.tsx         # 主搜索栏
│   │   │   ├── TagAutocomplete.tsx   # 标签自动补全 (分类显示)
│   │   │   ├── SearchHistory.tsx     # 历史搜索下拉
│   │   │   └── AdvancedFilter.tsx    # 高级筛选面板 (rating/score/order...)
│   │   ├── filter/                   # ★ 即时过滤层组件
│   │   │   ├── FilterChipBar.tsx     # 活跃过滤芯片栏容器
│   │   │   ├── FilterChip.tsx        # 单个过滤芯片 (含 +/× 按钮)
│   │   │   ├── TagChip.tsx           # 标签芯片 (包含/排除状态)
│   │   │   ├── RatingChip.tsx        # 评级芯片
│   │   │   ├── MetaChip.tsx          # 元数据芯片 (score/order等)
│   │   │   ├── RatingQuickToggle.tsx # 评级快速切换 (🟢🟡🔴)
│   │   │   ├── ScoreQuickInput.tsx   # 评分快捷输入
│   │   │   ├── QuickCategoryBar.tsx  # 快捷分类栏 (Popular/Recent/Random)
│   │   │   └── TagContextMenu.tsx    # 标签右键菜单
│   │   ├── posts/
│   │   │   ├── PostGrid.tsx          # 瀑布流/网格 (虚拟滚动)
│   │   │   ├── PostCard.tsx          # 帖子卡片 (缩略图+悬浮操作层)
│   │   │   ├── PostCardOverlay.tsx   # 卡片悬浮覆盖层 (标签 +/- 按钮)
│   │   │   ├── PostDetail.tsx        # 帖子详情面板 (侧栏式)
│   │   │   ├── PostInfo.tsx          # 评分/尺寸/上传者等元数据
│   │   │   ├── TagList.tsx           # 标签列表 (按类别分组/可点击)
│   │   │   ├── NoteOverlay.tsx       # 翻译注释叠加
│   │   │   └── VoteButtons.tsx       # 赞/踩按钮 (写操作)
│   │   ├── viewer/
│   │   │   ├── ImageViewer.tsx       # Lightbox 封装
│   │   │   ├── ViewerControls.tsx    # 缩放/导航/下载/全屏
│   │   │   └── Slideshow.tsx         # 幻灯片自动播放
│   │   ├── favorites/
│   │   │   ├── FavoriteButton.tsx    # 收藏/取消 (远程API + 本地同步)
│   │   │   ├── FavoriteList.tsx      # 收藏列表
│   │   │   └── FavoriteGroup.tsx     # 收藏分组管理
│   │   ├── comments/
│   │   │   ├── CommentSection.tsx    # 评论区
│   │   │   └── CommentItem.tsx       # 单条评论 (含写操作)
│   │   └── settings/
│   │       ├── SettingsPanel.tsx     # 设置总面板
│   │       ├── BooSourceManager.tsx  # Booru 源配置 (添加/编辑/切换)
│   │       ├── ApiKeyManager.tsx     # API Key 管理 (按源独立)
│   │       ├── ThemeConfig.tsx       # 主题 (亮色/暗色/跟随系统)
│   │       └── DownloadConfig.tsx    # 下载命名规则
│   │
│   ├── services/
│   │   ├── api/
│   │   │   ├── client.ts            # HTTP 客户端 (限流/重试/认证/User-Agent)
│   │   │   ├── auth.ts             # 认证逻辑 (Basic Auth / API Key / Cookie)
│   │   │   ├── posts.ts            # /posts.json (搜索/详情/更新)
│   │   │   ├── tags.ts             # /tags.json + /autocomplete.json
│   │   │   ├── artists.ts          # /artists.json
│   │   │   ├── pools.ts            # /pools.json
│   │   │   ├── comments.ts         # /comments.json (读+写)
│   │   │   ├── favorites.ts        # /favorites.json (读+写)
│   │   │   ├── votes.ts            # /posts/:id/votes (POST/DELETE)
│   │   │   └── related-tags.ts     # /related_tag.json
│   │   ├── booru-adapters/         # 多源适配器
│   │   │   ├── types.ts            # 统一适配器接口定义
│   │   │   ├── base.ts             # 基础适配器 (共享逻辑)
│   │   │   ├── danbooru.ts         # Danbooru 适配器 (最完整)
│   │   │   ├── gelbooru.ts         # Gelbooru / Rule34 适配器
│   │   │   ├── safebooru.ts        # Safebooru 适配器
│   │   │   └── yandere.ts          # Yande.re 适配器
│   │   └── download-service.ts     # 下载业务
│   │
│   ├── stores/                     # Zustand 状态仓库
│   │   ├── post-store.ts           # 帖子列表 + 详情
│   │   ├── filter-store.ts         # ★ 过滤状态 (活跃芯片/快捷标签/预设)
│   │   ├── search-store.ts         # 搜索查询/历史/结果游标
│   │   ├── tag-store.ts            # 标签缓存 (autocomplete结果)
│   │   ├── favorite-store.ts       # 本地+远程收藏
│   │   ├── comment-store.ts        # 评论状态
│   │   ├── ui-store.ts             # 主题/布局/侧栏显隐
│   │   └── settings-store.ts       # 持久化设置 → chrome.storage
│   │
│   ├── hooks/                      # 自定义 React Hooks
│   │   ├── usePosts.ts             # 帖子数据 (分页/无限滚动)
│   │   ├── useInfiniteScroll.ts    # IntersectionObserver 封装
│   │   ├── useTagAutocomplete.ts   # 防抖标签查询
│   │   ├── useImagePreload.ts      # 图片预加载
│   │   ├── useKeyboard.ts          # 全局快捷键
│   │   ├── useFavorites.ts         # 收藏状态 (远程优先, 本地兜底)
│   │   ├── useBooruSource.ts       # 当前选中的源
│   │   └── useFilterSync.ts        # 过滤芯片 ↔ 搜索查询双向同步
│   │
│   ├── utils/
│   │   ├── tag-parser.ts           # 标签字符串解析/序列化
│   │   ├── url-builder.ts          # API URL 构造
│   │   ├── image-url.ts            # 图片CDN URL 拼接
│   │   ├── rating.ts               # 评级映射 (s→safe, q→questionable...)
│   │   └── constants.ts            # 常量
│   │
│   └── types/
│       ├── post.ts                 # Post, Vote, MediaAsset...
│       ├── tag.ts                  # Tag, TagCategory
│       ├── api.ts                  # ApiResponse, SearchParams, RateLimit
│       ├── comment.ts
│       ├── favorite.ts
│       ├── filter.ts               # FilterChip, MetaFilter, FilterPreset
│       └── settings.ts
│
├── tests/
│   ├── unit/
│   │   ├── services/
│   │   │   ├── booru-adapters/
│   │   │   └── api/
│   │   └── utils/
│   └── integration/
│       └── components/
│
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── PLANNING.md                     # 本文件
```

---

## 4. 核心数据模型

```typescript
// ==================== 统一的帖子模型 (内部表示) ====================
interface UnifiedPost {
  id: number;
  source: string;                    // 来源 booru 标识: 'danbooru' | 'gelbooru' | 'safebooru'...
  rating: 's' | 'q' | 'e' | 'g';   // Safe / Questionable / Explicit / General(仅Gelbooru)
  tags: TagEntry[];                  // { name, category } 结构化标签数组
  tagString: string;                 // 原始标签字符串 (空格分隔)
  tagCountGeneral: number;
  tagCountArtist: number;
  tagCountCopyright: number;
  tagCountCharacter: number;
  tagCountMeta: number;
  score: number;
  upScore: number;
  downScore: number;
  favCount: number;
  isFavorited: boolean;             // 远程收藏状态
  isLocalFavorite: boolean;         // 本地收藏状态
  uploader: string;
  uploaderId: number;
  approverId: number | null;
  sourceUrl: string;                // 原始来源 (Pixiv/Twitter...)
  imageWidth: number;
  imageHeight: number;
  fileSize: number;
  fileExt: string;
  previewUrl: string;               // 缩略图 (180x180 / 150px)
  sampleUrl: string;                // 大缩略图 (850px) — gelbooru
  fileUrl: string;                  // 原图
  md5: string;
  isPending: boolean;
  isFlagged: boolean;
  isDeleted: boolean;
  hasChildren: boolean;
  parentId: number | null;
  children: number[];
  poolIds: number[];
  createdAt: string;                // ISO 8601
  updatedAt: string;
  lastCommentedAt: string | null;
  // Gelbooru 特有字段
  owner?: string;
  change?: number;
  // Danbooru 特有字段
  pixivId?: number;
  hasLarge?: boolean;
  tagStringGeneral?: string;
  tagStringArtist?: string;
  tagStringCopyright?: string;
  tagStringCharacter?: string;
  tagStringMeta?: string;
}

// ==================== 标签 ====================
interface TagEntry {
  name: string;
  category: TagCategory;
}

type TagCategory =
  | 'general'    // 0
  | 'artist'     // 1
  | 'copyright'  // 3
  | 'character'  // 4
  | 'meta';      // 5

interface TagResult {
  id: number;
  name: string;
  category: TagCategory;
  postCount: number;
  isDeprecated: boolean;
  createdAt: string;
  updatedAt: string;
}

// ==================== 评论 ====================
interface Comment {
  id: number;
  postId: number;
  creator: string;
  creatorId: number;
  body: string;
  score: number;
  createdAt: string;
  updatedAt: string;
}

// ==================== 投票 ====================
type VoteDirection = 'up' | 'down';
```

---

## 5. Booru 适配器接口

```typescript
interface BooruAdapter {
  // 元信息
  readonly id: string;             // 'danbooru' | 'gelbooru' | 'safebooru' | 'yandere' | 'rule34'
  readonly name: string;           // 显示名称
  readonly baseUrl: string;        // API 根 URL
  readonly baseImageUrl?: string;  // 图片 CDN (如果与 API 不同)
  readonly supportsAuth: boolean;  // 是否支持 API Key 认证
  readonly maxLimit: number;       // 单页最大条数
  readonly rateLimit: {
    readsPerSecond: number;
    writesPerSecond: number;
  };

  // 帖子
  searchPosts(params: SearchQuery): Promise<PaginatedResult<UnifiedPost>>;
  getPost(id: number): Promise<UnifiedPost>;
  getPosts(ids: number[]): Promise<UnifiedPost[]>;

  // 标签
  searchTags(query: string, options?: TagSearchOptions): Promise<TagResult[]>;
  autocomplete(query: string): Promise<TagAutocompleteResult[]>;

  // 艺术家
  getArtist(name: string): Promise<ArtistInfo>;

  // 评论
  getComments(postId: number): Promise<Comment[]>;

  // 收藏 (远程写) — 需要认证
  addFavorite(postId: number): Promise<void>;
  removeFavorite(postId: number): Promise<void>;
  getFavorites(userId?: number): Promise<UnifiedPost[]>;

  // 投票 (远程写) — 需要认证
  vote(postId: number, direction: VoteDirection): Promise<void>;
  unvote(postId: number): Promise<void>;

  // 评论 (远程写) — 需要认证
  createComment(postId: number, body: string): Promise<Comment>;

  // 图片 URL
  getImageUrl(post: UnifiedPost, size: 'preview' | 'sample' | 'full'): string;

  // 评级
  normalizeRating(raw: string): UnifiedPost['rating'];
  denormalizeRating(rating: UnifiedPost['rating']): string;
}

// 搜索参数
interface SearchQuery {
  tags?: string;
  page?: number;
  limit?: number;
  order?: string;               // 'id_desc' | 'score_desc' | 'favcount_desc'...
  rating?: string;
  beforeId?: number;
  afterId?: number;
  random?: boolean;
}

// 分页结果
interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
```

---

## 6. 各 Booru 源差异映射

| 特性 | Danbooru | Gelbooru | Safebooru | Yande.re | Rule34 |
|------|----------|----------|-----------|----------|--------|
| **API 地址** | `danbooru.donmai.us` | `gelbooru.com` | `safebooru.org` | `yande.re` | `api.rule34.xxx` |
| **认证方式** | Basic Auth + API Key | user_id + api_key 参数 | 不需要 | Basic Auth | 不需要 |
| **标签查询** | 完整 metatag 语法 | 简化标签语法 | 同 Gelbooru | 同 Danbooru | 同 Gelbooru |
| **自动补全** | `/autocomplete.json` | `/index.php?page=autocomplete2` | 同 Gelbooru | `/tag/suggest.json` | 同 Gelbooru |
| **rating 值** | g, s, q, e | general, sensitive, questionable, explicit | 仅 safe | s, q, e | 同 Gelbooru |
| **缩略图** | `preview_file_url` | `preview_url` | 同 Gelbooru | `preview_url` | 同 Gelbooru |
| **大缩略图** | `large_file_url` | `sample_url` (非原图) | 同 Gelbooru | `sample_url` | 同 Gelbooru |
| **原图** | `file_url` | MD5-based 构造 | 同 Gelbooru | `file_url` | 同 Gelbooru |
| **列表 limit 上限** | 200 | 100 | 100 | 100 | 100 |
| **b<id>/a<id>游标** | 支持 | 不支持 | 不支持 | 不支持 | 不支持 |
| **收藏 API** | POST/DELETE `/favorites` | POST `/favorites` | 不支持 | POST `/favorite/create` | 不支持 |
| **投票 API** | POST/DELETE `/posts/:id/votes` | 无 | 不支持 | 无 | 不支持 |
| **评论 API** | POST `/comments` | 不支持 | 不支持 | 不支持 | 不支持 |
| **数据格式** | JSON (snake_case) | JSON (snake_case) | JSON | JSON | XML/JSON |
| **字段完整度** | 完整 | 较少 (缺少 tag_count_* 分类) | 同 Gelbooru | 比 Danbooru 少 | 同 Gelbooru |

### Gelbooru 原始返回格式

```typescript
interface GelbooruRawPost {
  id: number;
  tags: string;           // 空格分隔
  rating: string;         // "general", "sensitive", "questionable", "explicit"
  score: number;
  owner: string;
  source: string;
  file_url: string;       // 实际是原图 URL
  preview_url: string;
  sample_url: string;
  change: number;         // timestamp
  height: number;
  width: number;
  // ... 更少的字段, 无 tag_count_* 分类
}
```

---

## 7. 数据流架构

```
┌──────────────────────────────────────────────────────────────────┐
│                         BROWSER EXTENSION                         │
│                                                                   │
│  ┌───────────────┐  ┌─────────────────┐  ┌───────────────────┐  │
│  │   Popup Page  │  │  NewTab Page ★  │  │  Options Page     │  │
│  │   (快捷入口)   │  │  (主浏览界面)    │  │  (配置管理)       │  │
│  └───────┬───────┘  └────────┬────────┘  └────────┬──────────┘  │
│          │                    │                     │             │
│          └────────────────────┼─────────────────────┘             │
│                               │                                    │
│                    ▼           ▼           ▼                      │
│              ┌──────────────────────────────────┐                 │
│              │         REACT APP                 │                 │
│              │   (Shared Component Tree)         │                 │
│              └──────────────┬───────────────────┘                 │
│                             │                                      │
│              ┌──────────────┼──────────────┐                      │
│              ▼              ▼              ▼                      │
│        ┌─────────┐   ┌──────────┐   ┌───────────┐               │
│        │ Zustand │   │  React   │   │  Cache    │               │
│        │ Stores  │   │  Hooks   │   │  Layer    │               │
│        └────┬────┘   └────┬─────┘   └─────┬─────┘               │
│             │              │               │                      │
│             └──────────────┼───────────────┘                      │
│                            ▼                                       │
│              ┌────────────────────────┐                           │
│              │    SERVICE LAYER        │                           │
│              │    BooruAdapter[]       │                           │
│              │    + API Client         │                           │
│              └───────────┬────────────┘                           │
│                          │                                         │
│        ┌─────────────────┼─────────────────┐                      │
│        ▼                 ▼                 ▼                      │
│  ┌───────────┐   ┌─────────────┐    ┌────────────┐               │
│  │ Danbooru  │   │  Gelbooru   │    │  Safebooru │  ...          │
│  │   API     │   │    API      │    │    API     │               │
│  └───────────┘   └─────────────┘    └────────────┘               │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │                 BACKGROUND SERVICE WORKER                     │ │
│  │  • 消息路由 (runtime.onMessage)                               │ │
│  │  • API 代理 (fetch + CORS bypass)                            │ │
│  │  • 缓存管理 (内存 LRU + TTL 定时清理)                          │ │
│  │  • 下载队列管理 (downloads API)                               │ │
│  │  • Badge 更新 (未读/新帖通知)                                  │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │                     STORAGE LAYER                             │ │
│  │  chrome.storage.local  → 设置、认证信息、UI 状态 (10MB)       │ │
│  │  IndexedDB             → 收藏数据、缩略图缓存、下载历史       │ │
│  └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

## 8. 组件树 - 主界面 NewTab

```
AppShell (NewTab)
│
├── Header (固定置顶, 4 Row 分区)
│   │
│   ├── Row1: BrandBar
│   │   ├── Logo + Extension Name
│   │   ├── BooSourceTabs          → 标签式切换 [Danbooru | Gelbooru | Safebooru | ...]
│   │   └── QuickActions
│   │       ├── ThemeToggle         → 🌙 亮/暗/自动
│   │       ├── ApiKeyStatus        → 认证状态指示器
│   │       └── SettingsButton      → ⚙ 打开 Options 页
│   │
│   ├── Row2: SearchBar + RatingQuick ★
│   │   ├── SearchInput            → 🔍 主搜索框 (带 Autocomplete)
│   │   ├── RatingQuickToggle      → 🟢 Safe | 🟡 Questionable | 🔴 Explicit
│   │   ├── ScoreQuickInput        → ⭐ score:>N
│   │   └── OrderQuickSelect       → 📅 排序选择
│   │
│   ├── Row3: FilterChipBar ★
│   │   ├── FilterChip[]           → 所有活跃过滤芯片 (可水平滚动)
│   │   │   ├── TagChip (绿色)     → 🔗 包含标签 [×] [-]
│   │   │   ├── ExcludeTagChip     → 🚫 排除标签 [×]
│   │   │   ├── RatingChip         → 🟢🟡🔴 评级芯片
│   │   │   └── MetaChip (蓝色)    → ⭐📅📏 元数据芯片
│   │   ├── AddFilterButton        → [+ Add filter...]
│   │   ├── ClearAllButton         → [Clear All (N)]
│   │   └── SavePresetButton       → [💾 Save as Preset]
│   │
│   └── Row4: QuickCategoryBar (可折叠)
│       ├── QuickLinks
│       │   ├── PopularButton       → 🔥 Popular
│       │   ├── RecentButton        → 🕐 Recent
│       │   ├── RandomButton        → 🎲 Random
│       │   ├── FavoritesButton     → ⭐ Favorites
│       │   └── DownloadsButton     → 📦 Downloads
│       └── PinnedTags              → 用户钉选的常用标签
│
├── MainContent
│   │
│   ├── [Left] Sidebar (可折叠)
│   │   ├── FavoriteTags           → 常用标签快捷点击
│   │   ├── RecentSearches         → 搜索历史列表
│   │   ├── LocalFavorites         → 本地收藏统计
│   │   └── FilterPresets          → 已保存的过滤预设
│   │
│   ├── [Right] Content Area
│   │   ├── ToolBar
│   │   │   ├── LayoutToggle       → 网格/瀑布流/列表 ▦ / ▤ / ≡
│   │   │   ├── ColumnsSlider      → 2-8 列
│   │   │   ├── SortSelector       → 排序方式
│   │   │   ├── ResultCount        → "1-100 of 50,000"
│   │   │   └── BatchActions       → 批量下载/收藏/复制链接
│   │   │
│   │   ├── PostGrid (虚拟滚动 + 无限加载)
│   │   │   └── PostCard[]
│   │   │       ├── Thumbnail      → lazy load + hover 放大
│   │   │       ├── RatingBadge    → s/q/e/g 角标
│   │   │       ├── ScoreBadge     → 评分数字
│   │   │       └── PostCardOverlay → 悬浮覆盖层 (见下方详图)
│   │   │
│   │   └── LoadingIndicator       → 无限滚动触底加载
│   │
│   ├── PostDetail (侧栏 Drawer / 浮层)
│   │   ├── DetailHeader
│   │   │   ├── PostId + Rating
│   │   │   ├── VoteButtons        → 👍👎 (调用远程API)
│   │   │   ├── FavoriteButton     → ⭐ 远程收藏 + 本地同步
│   │   │   ├── DownloadButton     → 📥 选择尺寸下载
│   │   │   └── OpenInViewerButton → 🖼 打开图片查看器
│   │   ├── ImagePreview           → 可点击放大的预览图
│   │   ├── PostMeta               → 评分/收藏数/文件大小/尺寸等
│   │   ├── TagList (分类显示)
│   │   │   ├── ArtistTags         → [tag1] [+][-] [tag2] [+][-]
│   │   │   ├── CharacterTags
│   │   │   ├── CopyrightTags
│   │   │   ├── GeneralTags
│   │   │   └── MetaTags
│   │   │   (每个标签可点击搜索, 每个标签旁有 [+]/[-] 过滤按钮)
│   │   ├── RelatedPosts           → 相关/相似帖子
│   │   ├── PoolsSection           → 所属画集
│   │   ├── ChildrenSection        → 子帖/父帖关系
│   │   └── CommentSection
│   │       ├── CommentList
│   │       │   └── CommentItem[]
│   │       └── CommentForm        → 发表评论 (需认证)
│   │
│   └── ImageViewer (全屏 Lightbox)
│       ├── MainImage              → 支持 zoom/pan
│       ├── NoteOverlay            → 翻译注释叠加
│       ├── ViewerControls
│       │   ├── ZoomSlider
│       │   ├── Prev/Next          → ← → 键
│       │   ├── FullscreenButton
│       │   ├── DownloadButton
│       │   ├── SlideshowButton    → 自动播放
│       │   └── InfoToggle         → 显示/隐藏信息面板
│       └── ThumbnailStrip         → 底部图片列表缩略条
```

### PostCardOverlay 悬浮覆盖层设计

```
     ┌──────────────────┐
     │                  │     Normal State: 仅显示缩略图
     │   [图片缩略图]    │
     │                  │
     │                  │
     │                  │
     └──────────────────┘

     ┌──────────────────┐
     │ ⭐ 120   👍42    │     Hover State: 覆盖层出现
     │ 👎0              │
     │                  │
     │  (artist_tag)    │
     │  [+] [-] [🔗]   │     [+] 加入过滤  [-] 排除标签
     │  (char_tag)     │     点击标签名 → 替换搜索为该标签
     │  [+] [-] [🔗]   │
     │  (series_tag)   │
     │  [+] [-] [🔗]   │
     │  general_tag    │
     │  [+] [-] [🔗]   │     ← 超出可滚动
     │  ...            │
     │                  │
     │  [💾 Save]  [📥 DL]  [🔍 View] │
     └──────────────────┘
```

### 标签点击三种模式 (可在设置中选择)

| 模式 | 单击标签名 | `[+]` 按钮 | `[-]` 按钮 |
|------|----------|-----------|-----------|
| **追加** (默认) | 追加到当前搜索 (AND) | 同上 | 排除该标签 (-tag) |
| **替换** | 替换为仅该标签的搜索 | 追加 | 排除 |
| **新标签页** | 在新标签页搜索该标签 | — | — |

### 标签右键菜单

```
┌──────────────────────┐
│  🔗 Add to filter    │  ← 追加到当前搜索 (AND)
│  🔗 Replace filter   │  ← 替换为仅此标签
│  🚫 Exclude this tag │  ← 排除此标签 (-tag)
│  ─────────────────── │
│  📋 Copy tag name    │
│  🔗 Copy tag link    │
│  📖 Open tag wiki    │
│  ─────────────────── │
│  📌 Pin to quick bar │  ← 追加到 Header Row4 快捷栏
└──────────────────────┘
```

---

## 9. 即时过滤层设计 - Quick Filter Layer

### 设计原则

| 原则 | 说明 |
|------|------|
| **永远可见** | 核心过滤控件固定于 Header Row2/Row3，不需任何菜单/对话框 |
| **一击操作** | 所有过滤动作单击完成，无确认步骤 |
| **可逆可撤销** | 每个激活的过滤条件显示为带 × 的可移除 Chip |
| **上下文感知** | 悬停帖子卡片时，每个标签旁出现 `[+]` `[-]` 快捷按钮 |

### Header 四行布局结构

```
┌───────────────────────────────────────────────────────────────────────────┐
│  ROW 1 — BrandBar                                                         │
│  🏠 [Logo]      [Danbooru · Gelbooru · Safebooru]        [🌙] [🔑] [⚙]   │
├───────────────────────────────────────────────────────────────────────────┤
│  ROW 2 — SearchBar + RatingQuick ★                                        │
│  ┌──────────────────────────────────────┐  [🟢 Safe] [🟡 Quest.]         │
│  │ 🔍 Search tags... (autocomplete)     │  [🔴 Explicit]                  │
│  └──────────────────────────────────────┘  [⭐ score:>0]  [📅 order:score]│
├───────────────────────────────────────────────────────────────────────────┤
│  ROW 3 — FilterChipBar ★                                                  │
│  [🔗 1girl  ×] [🚫 sketch  ×] [🟢 Safe  ×] [⭐ >100  ×]                   │
│  [+ Add filter...]  [Clear All (4)]  [💾 Save Preset]                     │
├───────────────────────────────────────────────────────────────────────────┤
│  ROW 4 — QuickCategoryBar (可折叠)                                        │
│  [🔥 Popular] [🕐 Recent] [🎲 Random] [⭐ Favorites] [📦 Downloads]       │
│   Pinned: [tag1 ×] [tag2 ×] ...                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

### Filter Chip 状态机

```
                    单击 [+]  或从卡片/标签添加
    ┌─────────────────────────────────────────────────┐
    │                                                  │
    ▼                                                  │
┌─────────┐   单击 [+] 或从卡片添加   ┌──────────┐   单击 [-]    ┌──────────┐
│  空白态  │ ──────────────────────▶ │ 包含态   │ ────────────▶ │ 排除态   │
│(无 chip) │                        │ (绿色)   │               │ (红色)   │
└─────────┘ ◀────────────────────── └──────────┘ ◀──────────── └──────────┘
                 单击 [×] 移除             单击 [×] / 再次单击切换
```

### Filter Chip 类型

```
┌─────────────────────┐  ┌─────────────────────┐
│ 🔗 1girl             │  │ 🚫 sketch           │
│    [×] [-]          │  │    [×] [+]          │
└─────────────────────┘  └─────────────────────┘
      包含标签 (绿色)           排除标签 (红色)

┌──────────────────────────┐  ┌──────────────────────┐
│ 🟢 Rating: Safe          │  │ ⭐ Score: >100       │
│    [×] [q] [e]          │  │    [×] [编辑范围]    │
└──────────────────────────┘  └──────────────────────┘
      评级 Chip (彩色)              元数据 Chip (蓝色)

┌──────────────────────────┐  ┌──────────────────────┐
│ 🔗 tag1  |  tag2 (OR)   │  │ 📅 order:score       │
│    [×]                  │  │    [×]               │
└──────────────────────────┘  └──────────────────────┘
    或运算 Chip (黄色边框)         排序列 Chip
```

### 窄屏适配 (<768px)

```
┌────────────────────────────────────────────┐
│ 🏠 [Danbooru ▼]                    🌙 ⚙   │
│ 🔍 [_Search...__________]                   │
│ [🟢] [🟡] [🔴]                              │
│ ← 水平可滚动 ──────────────────────────▶    │
│ [🔗 1girl ×] [🚫 sketch ×] [+ Add] [✕]    │
│ [🔥] [🕐] [🎲]                               │
└────────────────────────────────────────────┘
```

### 过滤预设系统

```typescript
// 用户可以保存任意过滤组合为预设
interface FilterPreset {
  id: string;
  name: string;                 // 用户命名, 如 "高评分Safe图"
  filters: FilterChip[];        // 过滤芯片数组
  sourceId: string;             // 关联的 Booru 源
  createdAt: string;
}
```

---

## 10. 键盘快捷键

| 快捷键 | 功能 | 作用域 |
|--------|------|--------|
| `Ctrl+K` | 聚焦搜索栏 | 全局 |
| `→` / `←` | 切换上一张/下一张帖子 | 详情/查看器 |
| `Esc` | 关闭详情/关闭查看器/清空搜索 | 全局 |
| `F` | 切换收藏状态 | 详情/卡片悬浮 |
| `D` | 下载当前帖子 (原图) | 详情/查看器 |
| `↑` / `↓` | 赞/踩 (需认证) | 详情 |
| `G` | 切换网格布局 | 列表页 |
| `L` | 切换列表布局 | 列表页 |
| `S` | 切换侧栏显隐 | 列表页 |
| `M` | 切换瀑布流布局 | 列表页 |
| `1-5` | 切换 Booru 源 (按配置顺序) | 全局 |
| `Ctrl+Shift+S` | 幻灯片模式 | 查看器 |
| `Ctrl+D` | 批量下载已选中的帖子 | 列表页 |
| `Ctrl+A` | 全选当前页帖子 | 列表页 |
| `Ctrl+Shift+F` | 打开高级筛选面板 | 列表页 |
| `Ctrl+Shift+C` | 清除所有活跃过滤 | 全局 |

---

## 11. 状态管理设计 - Zustand Stores

### post-store.ts

```typescript
interface PostStore {
  posts: UnifiedPost[];
  currentPost: UnifiedPost | null;
  selectedPostIds: Set<number>;
  isLoading: boolean;
  hasMore: boolean;
  page: number;
  totalCount: number;
  error: string | null;

  search: (query: SearchQuery) => Promise<void>;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  setCurrentPost: (post: UnifiedPost | null) => void;
  selectPost: (postId: number) => void;
  deselectPost: (postId: number) => void;
  selectAll: () => void;
  deselectAll: () => void;
  votePost: (postId: number, direction: VoteDirection) => Promise<void>;
}
```

### filter-store.ts ★ (核心新增)

```typescript
interface FilterStore {
  activeFilters: FilterChip[];
  quickTags: string[];
  ratingFilter: Rating[];
  metaFilter: MetaFilter;
  presets: FilterPreset[];

  // 标签操作
  addTagFilter: (tag: string, mode: 'include' | 'exclude') => void;
  removeFilter: (chipId: string) => void;
  toggleFilterMode: (chipId: string) => void;  // include ↔ exclude
  replaceFilter: (tag: string) => void;         // 替换全部为单标签

  // 评级操作
  toggleRating: (rating: Rating) => void;

  // 元数据操作
  setMetaFilter: (meta: Partial<MetaFilter>) => void;

  // 批量操作
  clearAllFilters: () => void;
  removeAllTagFilters: () => void;

  // 预设
  saveAsPreset: (name: string) => void;
  loadPreset: (presetId: string) => void;
  deletePreset: (presetId: string) => void;

  // 快捷栏
  pinToQuickBar: (tag: string) => void;
  unpinFromQuickBar: (tag: string) => void;

  // 派生
  getSearchQuery: () => SearchQuery;
}

interface FilterChip {
  id: string;
  type: 'tag' | 'rating' | 'meta' | 'order' | 'score';
  label: string;
  value: string;
  mode: 'include' | 'exclude';
  removable: boolean;
}

interface MetaFilter {
  scoreMin?: number;
  scoreMax?: number;
  order?: string;
  minWidth?: number;
  minHeight?: number;
  fileSizeMin?: number;
  dateAfter?: string;
  dateBefore?: string;
}
```

### favorite-store.ts

```typescript
interface FavoriteStore {
  remoteFavoriteIds: Map<string, Set<number>>;   // source -> postId set
  localFavorites: UnifiedPost[];
  favoriteGroups: FavoriteGroup[];

  toggleRemoteFavorite: (post: UnifiedPost) => Promise<void>;
  syncRemoteFavorites: () => Promise<void>;
  isRemoteFavorited: (post: UnifiedPost) => boolean;
  addLocalFavorite: (post: UnifiedPost) => void;
  removeLocalFavorite: (postId: number, source: string) => void;
  isLocalFavorited: (postId: number, source: string) => boolean;
  createGroup: (name: string) => void;
  deleteGroup: (groupId: string) => void;
  addToGroup: (groupId: string, post: UnifiedPost) => void;
  removeFromGroup: (groupId: string, postId: number) => void;
  exportFavorites: () => Promise<Blob>;
  importFavorites: (file: File) => Promise<void>;
}
```

### settings-store.ts

```typescript
interface SettingsStore {
  // Booru 源
  activeSource: string;
  sources: BooruSourceConfig[];

  // 外观
  theme: 'light' | 'dark' | 'auto';
  layout: 'grid' | 'masonry' | 'list';
  columns: number;                  // 2-8
  thumbnailSize: 'small' | 'medium' | 'large';

  // 内容
  nsfwFilter: 'show' | 'blur' | 'hide';
  autoplayGif: boolean;
  preloadNext: boolean;

  // 交互
  tagClickMode: 'append' | 'replace' | 'newtab';
  keyboardEnabled: boolean;

  // 下载
  downloadRule: string;
  downloadOriginalByDefault: boolean;

  // 认证 (按 source 存储)
  credentials: Record<string, { username: string; apiKey: string }>;

  // 操作
  setActiveSource: (id: string) => void;
  addSource: (config: BooruSourceConfig) => void;
  removeSource: (id: string) => void;
  updateSource: (id: string, config: Partial<BooruSourceConfig>) => void;
  setCredentials: (source: string, username: string, apiKey: string) => void;
  resetSettings: () => void;
}
```

### search-store.ts

```typescript
interface SearchStore {
  query: SearchQuery;
  history: SearchHistoryEntry[];
  suggestions: TagAutocompleteResult[];

  setQuery: (query: Partial<SearchQuery>) => void;
  addToHistory: (query: SearchQuery) => void;
  removeFromHistory: (entryId: string) => void;
  clearHistory: () => void;
}
```

### ui-store.ts

```typescript
interface UiStore {
  sidebarOpen: boolean;
  detailOpen: boolean;
  viewerOpen: boolean;
  viewerIndex: number;
  headerRow4Visible: boolean;

  toggleSidebar: () => void;
  openDetail: (post: UnifiedPost) => void;
  closeDetail: () => void;
  openViewer: (posts: UnifiedPost[], index: number) => void;
  closeViewer: () => void;
  toggleHeaderRow4: () => void;
}
```

---

## 12. API 请求/响应流

```
┌─────────────┐   runtime.sendMessage   ┌──────────────┐   fetch    ┌───────────┐
│  React      │ ──────────────────────▶ │  Background  │ ────────▶  │  Booru    │
│  Component  │                         │  SW (proxy)  │           │  API      │
│  ◀──────────│                         │  ◀───────────│           │  Server   │
│ UnifiedPost │                         │   Response   │           └───────────┘
└─────────────┘                         └──────────────┘

流程:
  1. 组件调用 hook → store action (如 postStore.search())
  2. Store 获取当前 BooruAdapter (根据 settingsStore.activeSource)
  3. Adapter 生成请求参数 → runtime.sendMessage() 发给 Background SW
  4. Background SW 执行 fetch (绕过 CORS 限制)
  5. Response 返回 → Adapter 解析原始JSON → 转换为 UnifiedPost[]
  6. Store 更新 → 组件重新渲染

限流处理:
  - Background SW 维护请求队列和令牌桶
  - 429 响应自动退避重试 (exponential backoff)
  - Danbooru: 10 req/s 读取, 1 req/s 写入 (Basic 用户)
  - Gelbooru: 保守 5 req/s

缓存策略:
  - 标签自动补全: 内存缓存 5 分钟
  - 帖子列表: 内存缓存 2 分钟
  - 帖子详情: 内存缓存 10 分钟
  - 标签查询: 内存缓存 30 分钟
  - 图片缩略图: IndexedDB 缓存, TTL 24h, LRU 淘汰
```

---

## 13. 错误处理策略

```typescript
// 统一错误类型
class BooruError extends Error {
  constructor(
    message: string,
    public code: ErrorCode,
    public httpStatus?: number,
    public source?: string,
  ) {}
}

enum ErrorCode {
  NETWORK_ERROR,       // 网络连接失败
  RATE_LIMITED,        // 429 — 限流
  AUTH_REQUIRED,       // 401 — 需要认证
  FORBIDDEN,           // 403 — 权限不足
  NOT_FOUND,           // 404 — 资源不存在
  PAGINATION_LIMIT,   // 410 — Danbooru 分页上限
  INVALID_RECORD,     // 420 — 无效记录
  USER_THROTTLED,     // 429 — 用户限流 (Danbooru)
  SERVER_ERROR,        // 5xx — 服务器错误
  PARSE_ERROR,         // 数据解析错误
  NOT_IMPLEMENTED,     // 当前源不支持的功能
}

// 重试策略:
//   - 网络错误:     3 次, 间隔 1s/2s/4s
//   - 限流 (429):   等待 Retry-After, 最多 5 次
//   - 5xx:         退避重试 2 次
//   - 其他:        不重试

// UI 层面:
//   - React Error Boundary 捕获渲染错误
//   - Toast 通知网络错误
//   - 空状态 / 错误状态 UI 组件
//   - 离线模式降级 (仅展示本地收藏)
```

---

## 14. 安全与隐私

### API Key 安全
- 存储在 `chrome.storage.local`（不暴露给 content script）
- 不在 React state / URL / console 中泄露
- 每个 Booru 源独立管理 API Key
- 查看/复制 API Key 需要再次确认

### CORS 处理
- 所有跨域 API 请求通过 Background Service Worker 代理
- Content Script 仅用于页面增强注入，不直接访问 API

### 下载安全
- 下载前文件名清理 (移除非法字符 `/ \ : * ? " < > |`)
- 批量下载前弹出确认对话框

### 隐私
- 零遥测 / 零分析 / 零第三方服务
- 所有用户数据本地存储
- NSFW 内容过滤选项 (显示/模糊/隐藏)
- Manifest 中 host_permissions 最小化

### Manifest V3 权限

```json
{
  "manifest_version": 3,
  "name": "Danbooru Viewer",
  "description": "旗舰级 Danbooru 图片浏览体验",
  "version": "1.0.0",
  "permissions": [
    "storage",
    "downloads",
    "unlimitedStorage"
  ],
  "host_permissions": [
    "*://*.donmai.us/*",
    "*://*.safebooru.org/*",
    "*://*.gelbooru.com/*",
    "*://*.rule34.xxx/*",
    "*://*.yande.re/*"
  ],
  "optional_permissions": [
    "notifications"
  ],
  "chrome_url_overrides": {
    "newtab": "src/newtab/index.html"
  },
  "background": {
    "service_worker": "src/background/index.ts"
  },
  "action": {
    "default_popup": "src/popup/index.html",
    "default_icon": {
      "16": "icons/icon-16.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  },
  "options_ui": {
    "page": "src/options/index.html",
    "open_in_tab": true
  },
  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  }
}
```

---

## 15. 开发阶段规划

```
Phase 1 ████████████ 2 周 (MVP — 核心浏览)
├── 项目脚手架 (Vite + React18 + TS + Tailwind + MV3)
├── 基础布局 (AppShell, Header Row1, Sidebar, ContentArea)
├── Background SW (API 代理, 消息路由, 基础缓存)
├── Danbooru Adapter (搜索, 单帖详情, 标签, autocomplete)
├── PostGrid 组件 (网格布局, 无限滚动 IntersectionObserver)
├── PostCard 组件 (缩略图, 基础信息, PostCardOverlay 悬浮层)
├── PostDetail 侧栏 (基础信息, TagList 分类显示含 [+]/[-] 按钮)
├── FilterChipBar ★ (Row2+Row3, RatingQuickToggle, FilterChip[])
├── ImageViewer Lightbox (缩放/导航/全屏)
├── 设置页 (主题, 基础设置, Booru 源配置)
└── 弹出窗口 (快捷搜索入口)
    ↓
Phase 2 ████████████ 2 周 (完整功能)
├── TagAutocomplete (防抖实时补全, 分类显示)
├── AdvancedFilter (评分/排序/时间/分辨率筛选)
├── 所有 Booru 适配器 (Gelbooru, Safebooru, Yande.re, Rule34)
├── BooSourceTabs (标签式源切换 UI)
├── 认证系统 (API Key 管理, Basic Auth, 状态指示器)
├── 远程收藏 (Danbooru favorites API 读写)
├── 远程投票 (Danbooru votes API POST/DELETE)
├── 远程评论 (GET 评论列表 + POST 发布)
├── 本地收藏 (IndexedDB, 收藏列表 UI)
├── 收藏分组管理
├── 收藏导出/导入 (JSON 格式)
├── FilterPresetSystem ★ (保存/加载/删除预设)
├── QuickCategoryBar (Row4, 可钉选标签)
└── TagContextMenu (右键菜单)
    ↓
Phase 3 ████████████ 1.5 周 (完善体验)
├── 下载管理器 (单帖选择尺寸, 批量下载, 命名规则自定义)
├── 下载历史 (IndexedDB, 去重提示)
├── 键盘快捷键系统 (useKeyboard hook)
├── NoteOverlay (翻译注释叠加层)
├── RelatedTags (关联标签展示)
├── Pools 浏览 (画集列表)
├── Children/Parent 关系展示
├── Content Script (Danbooru 页面增强注入)
├── 幻灯片模式 (自动播放, 可调间隔)
├── 图片预加载 (预测下一页)
└── 虚拟滚动 (@tanstack/react-virtual 优化 1000+ 列表)
    ↓
Phase 4 ████████████ 1.5 周 (打磨发布)
├── 错误处理完善 (全局边界, Toast, 重试, 空状态/错误状态UI)
├── 性能优化 (懒加载, 缓存策略调优, 防抖/节流, 请求去重)
├── 暗色主题完整覆盖 (Tailwind dark: variant)
├── 国际化基础框架 (en 默认)
├── 设置数据迁移/备份
├── 压缩构建优化 (vite build, chunk splitting)
├── E2E 关键路径测试
├── Chrome Web Store 清单/截图/描述
├── Firefox Add-ons 适配
└── README / 使用文档
```

---

## 16. 关键依赖汇总

### production dependencies

```json
{
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "zustand": "^4.5.2",
  "ky": "^1.4.0",
  "idb-keyval": "^6.2.1",
  "yet-another-react-lightbox": "^3.20.0",
  "@tanstack/react-virtual": "^3.8.1",
  "clsx": "^2.1.1",
  "tailwind-merge": "^2.4.0"
}
```

### devDependencies

```json
{
  "typescript": "^5.5.3",
  "vite": "^5.4.0",
  "@samrum/vite-plugin-web-extension": "^5.1.0",
  "@types/react": "^18.3.3",
  "@types/react-dom": "^18.3.0",
  "@types/chrome": "^0.0.268",
  "tailwindcss": "^3.4.7",
  "autoprefixer": "^10.4.19",
  "postcss": "^8.4.40",
  "vitest": "^1.6.0",
  "@testing-library/react": "^16.0.0",
  "@testing-library/jest-dom": "^6.4.8",
  "jsdom": "^24.1.1",
  "eslint": "^8.57.0",
  "@typescript-eslint/eslint-plugin": "^7.18.0",
  "@typescript-eslint/parser": "^7.18.0"
}
```

---

## 17. 附录: API 响应示例

### Danbooru — GET /posts.json

```json
[
  {
    "id": 1000000,
    "rating": "s",
    "parent_id": null,
    "source": "https://www.pixiv.net/en/artworks/12345678",
    "md5": "abc123def456...",
    "uploader_id": 12345,
    "approver_id": null,
    "file_ext": "png",
    "file_size": 2500000,
    "image_width": 2000,
    "image_height": 1500,
    "score": 42,
    "up_score": 42,
    "down_score": 0,
    "fav_count": 120,
    "is_pending": false,
    "is_flagged": false,
    "is_deleted": false,
    "tag_string": "1girl blonde_hair blue_eyes artist_name series_name highres",
    "tag_count": 15,
    "tag_count_general": 10,
    "tag_count_artist": 1,
    "tag_count_copyright": 2,
    "tag_count_character": 1,
    "tag_count_meta": 1,
    "has_children": false,
    "has_active_children": false,
    "pixiv_id": 12345678,
    "bit_flags": 0,
    "created_at": "2024-01-15T12:00:00.000Z",
    "updated_at": "2024-01-15T12:30:00.000Z",
    "last_commented_at": null,
    "last_comment_bumped_at": null,
    "last_noted_at": null,
    "has_large": true,
    "has_visible_children": false,
    "file_url": "https://cdn.donmai.us/original/ab/cd/abcd1234...png",
    "large_file_url": "https://cdn.donmai.us/sample/ab/cd/abcd1234...jpg",
    "preview_file_url": "https://cdn.donmai.us/180x180/ab/cd/abcd1234...jpg",
    "tag_string_general": "1girl blonde_hair blue_eyes",
    "tag_string_artist": "artist_name",
    "tag_string_copyright": "series_name",
    "tag_string_character": "character_name",
    "tag_string_meta": "highres",
    "media_asset": {
      "id": 2000000,
      "md5": "abc123def456...",
      "file_ext": "png",
      "file_size": 2500000,
      "image_width": 2000,
      "image_height": 1500,
      "duration": null,
      "status": "active",
      "file_key": "...",
      "is_public": true,
      "pixel_hash": "...",
      "variants": [
        { "type": "180x180", "url": "...", "width": 180, "height": 180 },
        { "type": "360x360", "url": "...", "width": 360, "height": 360 },
        { "type": "720x720", "url": "...", "width": 720, "height": 720 },
        { "type": "sample", "url": "...", "width": 850, "height": 637 },
        { "type": "full", "url": "...", "width": 2000, "height": 1500 }
      ]
    }
  }
]
```

### Danbooru — GET /autocomplete.json

```
GET /autocomplete.json?search[query]=blonde&search[type]=tag_query

Response:
[
  {
    "type": "tag-word",
    "value": "blonde_hair",
    "label": "blonde_hair",
    "category": "general",
    "post_count": 500000,
    "antecedent": "blonde_hair"
  },
  {
    "type": "tag-word",
    "value": "blonde",
    "label": "blonde",
    "category": "general",
    "post_count": 10000,
    "antecedent": "blonde"
  }
]
```

### Danbooru — GET /related_tag.json

```
GET /related_tag.json?query=blonde_hair&category=general

Response:
{
  "query": "blonde_hair",
  "category": "general",
  "tags": [
    ["long_hair", 0.85],
    ["blue_eyes", 0.72],
    ["1girl", 0.65]
  ]
}
```

---

## 附录 B: 给实施 Agent 的重要提示

1. **FilterChipBar 是最核心的交互组件**，必须优先高质量实现。它是区分"普通 Danbooru 查看器"和"旗舰级浏览体验"的关键。

2. **多 Booru 适配器的解析差异**主要集中在：
   - 标签分类 (Danbooru 有字段直接返回，Gelbooru 需要从 tag_string 推断)
   - 评级映射 (Gelbooru 用 "sensitive" 对应 "questionable")
   - 图片 URL 构造 (各源路径规则不同)
   - 分页机制差异 (Danbooru 有 b<id>/a<id>，其他只用 page)

3. **认证状态的 UI 反馈**：未认证时读写按钮应显示为灰色/禁用态，并有提示"需要 API Key"。不允许静默失败。

4. **性能关键路径**：
   - 帖子列表首次加载 → 应 < 1s (利用缓存)
   - 标签自动补全打字响应 → 防抖 300ms 内
   - 图片查看器打开 → 预加载已缓存的大图

5. **可访问性**：键盘导航、ARIA 标签、屏幕阅读器友好的评分/评级显示。

6. **NSFW 内容处理**：默认模糊 NSFW 内容，需用户主动在设置中调整。首次安装时可引导用户选择内容过滤级别。

---

**文档版本**: 2.0
**最后更新**: 2026-07-15
**下一个步骤**: 按 Phase 1 开始搭建项目脚手架
