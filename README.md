# Danbooru Viewer / Danbooru 图片浏览器

[English](#english) | [中文](#中文)

---

## English

A browser extension that turns your new tab into a focused workspace for browsing, filtering, saving, and downloading posts from Danbooru, Gelbooru, Safebooru, Yande.re, and Rule34.

### Features

- Five Booru sources with a unified browsing experience
- Tag search with autocomplete suggestions
- Quick rating filters (Safe, Questionable, Explicit)
- Advanced filters for score, date, resolution, and ordering
- Grid, masonry, and list layouts with virtualized rendering
- Full-screen image and video viewer with keyboard navigation
- Post detail panel with tag categories, comments, notes, and related posts
- Local favorites with custom groups
- Formatted tag copy for AI prompt workflows
- Single and batch downloads with configurable filenames
- Light, dark, and system themes
- Responsive layout for compact viewports
- 24-hour thumbnail cache via IndexedDB

### Install from source

**Prerequisites:** [Node.js](https://nodejs.org/) 18+

```bash
npm install
npm run build          # Chrome / Edge
npm run build:firefox  # Firefox
```

**Chrome / Edge:**

1. Open `chrome://extensions/` (or `edge://extensions/`).
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the `dist` folder.
4. Press `Ctrl+T` to open a new tab.

**Firefox:**

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on**.
3. Select `dist-firefox/manifest.json`.

### Usage

- Type tags in the search bar and press Enter.
- Switch sources via the tabs in the header.
- Click a post card to open the detail panel.
- Hover a card for one second to inspect tags with `+`/`-` filter buttons.
- Click the rating badge on a card to open the full-screen viewer.

### Keyboard shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+K` | Focus search |
| `S` | Toggle sidebar |
| `G` / `M` / `L` | Grid / Masonry / List |
| `1`–`5` | Switch source |
| `Escape` | Close viewer / detail / clear filters |
| `F` | Toggle local favorite |
| `D` | Download current post |
| `ArrowLeft/Right` | Previous / next post |
| `Ctrl+A` | Select all |
| `Ctrl+D` | Download selected |
| `Ctrl+Shift+S` | Toggle slideshow |
| `Ctrl+Shift+C` | Clear all filters |

### Settings

Click the gear icon to configure theme, columns, download filenames, slideshow interval, tag copy format, and API credentials.

### API credentials

| Feature | Requires |
|---------|----------|
| Danbooru, Safebooru, Yande.re browsing | None |
| Gelbooru, Rule34 browsing | User ID + API key |
| Remote favorites, votes, comments | Danbooru API key |

### Privacy

No analytics, no telemetry. All data stays on your device. Credentials and settings are stored in browser extension storage. Cached thumbnails and local favorites are stored in IndexedDB.

### License

MIT

---

## 中文

一个浏览器扩展，将新标签页变成浏览、搜索、收藏和下载 Danbooru、Gelbooru、Safebooru、Yande.re、Rule34 图片的工作台。

### 功能

- 五个 Booru 图源，统一浏览体验
- 标签搜索，自动补全建议
- 评级快速切换（Safe / Questionable / Explicit）
- 高级筛选：评分、日期、分辨率、排序
- 网格、瀑布流、列表三种布局，虚拟滚动
- 全屏图片/视频查看器，键盘导航
- 帖子详情面板：标签分类、评论、注释、关联帖子
- 本地收藏和自定义分组
- 格式化标签复制，适配 AI 绘图提示词
- 单张和批量下载，文件名可自定义
- 亮色、暗色、跟随系统三种主题
- 窄屏自适应布局
- IndexedDB 缩略图缓存（24 小时）

### 本地安装

**环境要求：** [Node.js](https://nodejs.org/) 18 及以上

```bash
npm install
npm run build          # Chrome / Edge
npm run build:firefox  # Firefox
```

**Chrome / Edge：**

1. 打开 `chrome://extensions/`（或 `edge://extensions/`）
2. 开启右上角**开发者模式**
3. 点击**加载已解压的扩展程序**，选择 `dist` 文件夹
4. 按 `Ctrl+T` 打开新标签页

**Firefox：**

1. 打开 `about:debugging#/runtime/this-firefox`
2. 点击**临时载入附加组件**
3. 选择 `dist-firefox/manifest.json`

### 使用方法

- 在搜索框输入标签，按回车搜索
- 点击顶部标签切换数据源
- 点击帖子卡片打开详情面板
- 悬停卡片一秒弹出标签检查器，可快速添加/排除标签
- 点击卡片左上角评级角标打开全屏查看器

### 键盘快捷键

| 按键 | 功能 |
|------|------|
| `Ctrl+K` | 聚焦搜索框 |
| `S` | 切换侧栏 |
| `G` / `M` / `L` | 切换网格 / 瀑布流 / 列表 |
| `1`–`5` | 切换数据源 |
| `Escape` | 关闭查看器 / 详情 / 清除筛选 |
| `F` | 切换本地收藏 |
| `D` | 下载当前帖子 |
| `ArrowLeft/Right` | 上一张 / 下一张 |
| `Ctrl+A` | 全选 |
| `Ctrl+D` | 批量下载已选 |
| `Ctrl+Shift+S` | 幻灯片播放 |
| `Ctrl+Shift+C` | 清除所有筛选 |

### 设置

点击右上角齿轮图标，可配置主题、列数、下载文件名规则、幻灯片间隔、标签复制格式，以及各数据源的 API 凭据。

### API 凭据

| 功能 | 需要 |
|------|------|
| 浏览 Danbooru、Safebooru、Yande.re | 无需 |
| 浏览 Gelbooru、Rule34 | User ID + API Key |
| 远程收藏、投票、评论 | Danbooru API Key |

### 隐私

无分析、无遥测。所有数据存储在本地设备。凭据和设置保存在浏览器扩展存储中。缩略图缓存和本地收藏保存在 IndexedDB 中。

### 许可证

MIT
