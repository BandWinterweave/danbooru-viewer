# Danbooru Viewer

A browser extension that turns your new tab into a focused workspace for browsing, filtering, saving, and downloading posts from Danbooru, Gelbooru, Safebooru, Yande.re, and Rule34.

## Features

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

## Install from source

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
- Chrome, Edge, or Firefox

### Build

```bash
npm install
npm run build          # Chrome / Edge
npm run build:firefox  # Firefox
```

### Load in Chrome or Edge

1. Open `chrome://extensions/` (or `edge://extensions/`).
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked**.
4. Select the `dist` folder.
5. Press `Ctrl+T` to open a new tab.

### Load in Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on**.
3. Select `dist-firefox/manifest.json`.

Temporary add-ons are removed when Firefox restarts. For permanent installation, submit the extension through Firefox Add-ons.

### Update after code changes

```bash
npm run build                    # rebuild
# Then click the refresh icon on the extension card in chrome://extensions/
```

## Usage

### Searching

Type tags in the search bar and press Enter or click **Search**. Danbooru tags use underscores, e.g. `blue_sky`, `long_hair`, `original`.

### Source switching

Click a source tab in the header: Danbooru, Gelbooru, Safebooru, Yande.re, or Rule34.

### Rating controls

Click **Safe**, **Questionable**, or **Explicit** to toggle content ratings. Active ratings are highlighted.

### Advanced filters

Click **Filters** next to the rating buttons to set minimum score, date range, width, height, and sort order.

### Post cards

- **Click** a card to open the detail panel.
- **Hover** for one second to show the tag inspector, where each tag has `+` and `-` filter buttons.
- **Click the rating badge** in the top-left corner to open the full-screen viewer.
- Use the checkmark button to batch-select posts for download.
- Use the copy button to copy formatted tags.

### Detail panel

- View post metadata, tag categories, related tags, pools, parent/child relations, and comments.
- Click any tag name to search for it.
- Click `+` or `-` on a tag to add or exclude it from the current search.
- Save locally, toggle remote favorites, vote, or download from the detail action bar.

### Full-screen viewer

- **Scroll** to zoom.
- **Arrow keys** to navigate between posts.
- **D** to download.
- **Ctrl+Shift+S** to toggle slideshow.
- **Escape** to close.

### Keyboard shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+K` | Focus search |
| `S` | Toggle sidebar |
| `G` / `M` / `L` | Grid / Masonry / List layout |
| `1`–`5` | Switch Booru source |
| `Escape` | Close viewer, close detail, or clear filters |
| `F` | Toggle local favorite (detail open) |
| `D` | Download current post (detail open) |
| `ArrowLeft/Right` | Previous / next post (detail open) |
| `Ctrl+A` | Select all posts |
| `Ctrl+D` | Download selected posts |
| `Ctrl+Shift+S` | Toggle slideshow |
| `Ctrl+Shift+C` | Clear all filters |
| `Ctrl+Shift+F` | Toggle advanced filters |

### Settings

Click the gear icon in the header, or right-click the extension icon and choose **Options**, to configure:

- Theme: light, dark, or follow system
- Default column count
- Download filename rule (variables: `{id}`, `{tags}`, `{artist}`, `{rating}`, `{source}`, `{size}`)
- Slideshow interval
- Keyboard shortcuts on/off
- Tag copy format and categories
- API credentials per source

## API credentials

Some sources and features require an account:

| Feature | Requires |
|---------|----------|
| Browsing Danbooru, Safebooru, Yande.re | None |
| Gelbooru browsing | User ID + API key |
| Rule34 browsing | User ID + API key |
| Remote favorites, voting, commenting | Danbooru API key |

Add credentials in Settings under **Source access**.

## Privacy

Danbooru Viewer does not collect, sell, or transmit usage analytics. API requests go directly to the selected Booru source. Credentials and settings are stored in browser extension storage. Cached thumbnails and local favorites are stored in IndexedDB and can be removed by clearing extension data.

## Development

```bash
npm install        # install dependencies
npm run dev        # start development server with hot reload
npm run typecheck  # check TypeScript types
npm test           # run unit tests
npm run assets     # regenerate extension icons
```

## License

MIT
