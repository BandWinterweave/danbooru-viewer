# Danbooru Viewer store listing

## Short description

A focused new-tab workspace for browsing, filtering, saving, and downloading posts across five Booru sources.

## Full description

Danbooru Viewer turns the browser's new tab into an image-first workspace for Danbooru, Gelbooru, Safebooru, Yande.re, and Rule34.

Search and combine tags without losing context. Switch between grid, masonry, and information-dense list layouts, inspect categorized tags and source metadata, and open images or videos in a full-screen viewer. New installations select only the General rating by default; other ratings require an explicit user choice.

### Highlights

- Tag autocomplete, include/exclude chips, reusable quick tags, and reorderable filter presets
- Rating, score, date, resolution, and ordering filters
- Virtualized grid, masonry, and list layouts
- Independent local favorites library with search, groups, batch organization, and previewed JSON import
- Progressive media loading, zoom and pan controls, and preview/sample/original quality choices
- Single and batch downloads with configurable filenames
- Runtime English and Simplified Chinese interface
- Light, dark, and system themes with compact-width support

### Keyboard shortcuts

| Key | Action |
|---|---|
| `Ctrl+K` | Focus search |
| `S` | Toggle sidebar |
| `G` / `M` / `L` | Grid / masonry / list layout |
| `1`-`5` | Switch source |
| `Escape` | Close the active panel, then clear filters |
| `Left` / `Right` | Previous / next detail post |
| `F` / `D` | Favorite / download the detail or hovered post |
| `Up` / `Down` | Vote when supported and authenticated |
| `Ctrl+A` / `Ctrl+D` | Select all loaded posts / download selection |

Shortcuts can be disabled in settings.

### Privacy disclosure

The extension contains no analytics or telemetry. Preferences and optional source credentials are stored on the device; credentials are not additionally encrypted and are sent only to their corresponding source. Favorites, download history, cached media, and bounded tag metadata remain in IndexedDB.

Requests normally contact the selected source and its media hosts. When another source omits tag categories, the extension may send only missing tag names to Danbooru for metadata enrichment. It never shares credentials across sources. See [`PRIVACY.md`](../PRIVACY.md) for retention, permission, and challenge-fallback details.

### Known limitations

- Gelbooru and Rule34 require credentials for post searches.
- Comments, votes, remote favorites, pools, and post relationships depend on source support.
- A source API outage or rate limit can leave one resource unavailable while other detail resources continue to work.
- Source-loaded Firefox builds are temporary add-ons and must be loaded again after Firefox restarts.
- Browser store content policies still apply; every submitted screenshot must show General-rated media only.

## Screenshot placeholders

Do not commit temporary captures under the final filenames until their content and dimensions have been reviewed.

| Placeholder file | Required content |
|---|---|
| `docs/screenshots/main-workspace.png` | Light theme, General-only results, active include/exclude filters, visible source selector, and the detail drawer. |
| `docs/screenshots/dark-masonry.png` | Dark masonry layout with the hover tag inspector, categorized tags, and `+` / `-` actions visible. |
| `docs/screenshots/compact-layout.png` | Compact viewport with the mobile drawer, search, rating controls, and a two-column General-only grid without overlap. |
| `docs/screenshots/media-viewer.png` | Full-screen image viewer showing zoom, pan, quality, download, and previous/next controls. |
| `docs/screenshots/favorites-library.png` | Favorites search, group filter, sorting, selection, and batch organization controls. |
| `docs/screenshots/settings.png` | Language, theme, preview quality, download, tag-copy, and credential test controls with all secrets blank. |

Capture from the exact release candidate. Use PNG, the store's current required aspect ratio and dimensions, no browser chrome unless required, no credentials or account identifiers, and no Sensitive, Questionable, or Explicit media. Record final filenames and checks in `docs/RELEASING.md`.
