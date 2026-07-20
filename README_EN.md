# Danbooru Viewer

**Collect reference images across Booru sources and send them directly to local ComfyUI.**

[中文说明](README.md) | [English](README_EN.md)

![Danbooru Viewer workspace](./docs/screenshots-20260717/1.png)

Danbooru Viewer is a Manifest V3 browser extension that replaces the new tab page. It provides one interface for Danbooru, Gelbooru, Safebooru, Yande.re, and Rule34, with local favorites, batch downloads, and a persistent ComfyUI workbench. ComfyUI connections are restricted to `127.0.0.1`.

## Features

- Unified search across five Booru sources with autocomplete, include/exclude tags, quick tags, and filter presets.
- General, Sensitive, Questionable, and Explicit ratings plus score, date, dimensions, and ordering filters.
- Grid, masonry, and dense list layouts with high-quality detail media and categorized metadata.
- Fully local favorites with groups, batch organization, search, filtering, and reviewed JSON import/export.
- Send from thumbnails, details, selections, favorite groups, local files, or optional third-party webpages.
- Persistent serial ComfyUI queue with progress, cancellation, retry, output previews, and history.
- English and Simplified Chinese UI with light, dark, and system themes.

## Installation

Build from source with Node.js 20.19 or newer and npm:

```bash
npm ci
npm run build          # Chrome / Edge -> dist/
npm run build:firefox  # Firefox -> dist-firefox/
```

### Chrome / Edge

1. Open `chrome://extensions/` or `edge://extensions/`.
2. Enable Developer mode.
3. Choose Load unpacked.
4. Select the `dist` directory.
5. Open a new tab and verify that the Viewer loads.

### Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Choose Load Temporary Add-on.
3. Select `dist-firefox/manifest.json`.

Firefox removes temporary add-ons after restart, so they must be loaded again.

## First-Time Setup

1. Choose the language and theme.
2. Configure the default layout, column count, thumbnail quality, and detail quality.
3. Set the browsing cache limit, video autoplay, and keyboard shortcuts as needed.
4. Enter credentials for sources that need authentication and run the connection test.
5. Configure the ComfyUI address, history limit, task-media limit, and output cache.
6. Import and activate a ComfyUI API workflow.

Settings are stored in browser extension storage. Source credentials are not separately encrypted and are sent only to their matching source.

## Sources and Credentials

| Source | Public browsing | Credentials | Capabilities |
| --- | --- | --- | --- |
| Danbooru | Yes | Username + API key, optional | Search; remote favorites, voting, and comments when authenticated |
| Gelbooru | No | User ID + API key | Search and remote favorites |
| Safebooru | Yes | None | Read-only search |
| Yande.re | Yes | Username + API key, optional | Search and authenticated read access |
| Rule34 | No | User ID + API key | Search |

Yande.re has no separate General and Sensitive filters; both map to its Safe condition.

## Browsing, Downloads, and Favorites

Use the source tabs, tag autocomplete, include/exclude actions, rating controls, and advanced filters to build a query. General is the only rating enabled after a fresh install. Rating colors are green for General, blue for Sensitive, amber for Questionable, and red for Explicit.

Click a thumbnail to open the detail view. Detail media uses the configured preview, sample, or original quality and falls back when a higher-quality resource fails. The large viewer supports wheel zoom, drag-to-pan, and double-click reset.

Downloads support thumbnail, sample, original, and playable video resources. Filename templates can use `{id}`, `{tags}`, `{artist}`, `{rating}`, `{source}`, and `{size}`.

Local favorites support groups, batch moves, cross-group search, sorting, filtering, and previewed JSON merge or replacement.

![Post detail and tag context](./docs/screenshots-20260717/4.png)

![Local favorites and batch actions](./docs/screenshots-20260717/7.png)

## ComfyUI Setup

### Start the local service

The default address is:

```text
http://127.0.0.1:8188/
```

Only HTTP(S) `127.0.0.1` addresses with valid ports are accepted. LAN addresses, remote instances, authentication headers, and self-signed certificate bypasses are not supported.

### Export API JSON

Export an **API format** JSON workflow from ComfyUI. A normal UI workflow JSON cannot be imported directly.

### Name integration nodes

The extension reads case-sensitive `_meta.title` values:

| Node title | Purpose |
| --- | --- |
| `INPUT` | Receives the uploaded image path; at least one is required and multiple are supported |
| `OUTPUT*` | Collects image or text output, such as `OUTPUT1`, `OUTPUT image`, or `OUTPUT prompt` |
| `REVERSE` | Optionally receives formatted Booru tags |
| `OPTION*` | Exposes a saved text or integer value, such as `OPTION prompt` or `OPTION steps` |

Important details:

- Titles are exact and case-sensitive. `Input` is not `INPUT`.
- A title of exactly `OPTION` is not special; it needs a suffix.
- Text options use `inputs.text`; supported integer options use a direct integer input.
- Text options support line breaks. Their field grows up to about eight lines, then scrolls internally. Newlines are preserved.
- Import validates special nodes and required fields before creating a preset.

### Import and send

1. Open the ComfyUI workbench from the Viewer header.
2. Open Workflows and import the API JSON.
3. Activate it and save the desired OPTION values.
4. Send from a card, detail view, selection, favorite group, or local media area.

GIF, video, and ugoira/ZIP inputs are normalized to their first frame. Each image becomes a separate task.

## Queue and Cancellation

- Tasks run serially and waiting tasks can be reordered.
- Enqueueing freezes the workflow JSON, OPTION values, server address, input reference, and available tag text. Later preset edits do not change queued work.
- Tasks wait and retry while local ComfyUI is unavailable, and the background process restores the queue after restart.
- Cancelling a running prompt can call the instance-wide `/interrupt` endpoint after confirmation. This can affect unrelated work on the same ComfyUI instance.
- If `/prompt` may have succeeded but its response was lost, the extension does not resubmit automatically. History shows a failed record with the confirmation reason so the user can inspect and retry deliberately.

## History and Output Cache

History presents three terminal states: Success, Failed with a reason, and Cancelled.

Expanded records show image and text values from `OUTPUT*` nodes. Clicking an image reads the local cached Blob first and falls back to the original ComfyUI `/view` URL if the cache is missing. With output caching enabled, cached results remain viewable while ComfyUI is offline.

Deleting Viewer history removes local metadata and associated output cache entries. It does not delete files from the ComfyUI server.

## Sending from Other Websites

This feature is off by default.

### Enable it

1. Open the ComfyUI section in extension settings.
2. Enable Send to ComfyUI on other websites.
3. Grant the optional `<all_urls>` permission when the browser asks.
4. Set the minimum natural pixel count. The default is `262144`, equivalent to `512 × 512`.

Disabling the feature removes the optional permission and removes the injected controls from open pages. Required host access remains limited to the supported Booru sources and `127.0.0.1`.

### Use it

- A rounded `D` launcher appears at the bottom-right of ordinary HTTP and HTTPS pages. It opens the full workbench inside the current page without navigating to the Viewer.
- Hover an `<img>` or `<picture>`. When `naturalWidth × naturalHeight` reaches the threshold, a high-layer Sparkles send button appears at the image's top-right.
- Clicking it directly queues the image with the active workflow.
- Responsive images prefer the largest `srcset` candidate and fall back through `currentSrc` and `src` when downloads fail.
- Third-party webpage images populate `INPUT` only. They do not populate or clear `REVERSE`.
- Downloads omit page cookies and credentials and accept only public HTTP/HTTPS image addresses. Local, private-network, and link-local destinations are rejected, with a 100 MiB limit per image.

Browser-protected pages such as `chrome://`, `edge://`, and extension stores cannot be injected. CSS background images and canvas are not scanned.

## Keyboard Shortcuts

When shortcuts are enabled in the Viewer:

| Key | Action |
| --- | --- |
| `C` | Open the ComfyUI workbench; press again to close it |
| `Esc` | Close the current detail, filter, or sidebar |
| `S` | Toggle the sidebar |
| `G` / `M` / `L` | Grid / masonry / list layout |
| `1` - `5` | Switch sources; inside the workbench, switch Queue / Workflows / History |
| `F` | Favorite the detailed or hovered post |
| `D` | Download the detailed or hovered post |
| `Ctrl+K` | Focus search |
| `Ctrl+A` | Select current results |

Single-key shortcuts do not fire while typing in inputs, textareas, or selects. The third-party webpage workbench does not bind `C`; use its `D` launcher and close button.

## Storage and Privacy

- Browsing media uses a configurable 512 MiB default cache and a 24-hour default lifetime.
- ComfyUI task media uses a configurable 1 GiB default limit; active task inputs are protected from cleanup.
- History retains 100 records by default.
- Favorites, workflows, queues, history, and media caches remain in local browser storage.
- The project has no analytics, telemetry, or project server.
- See the [privacy notice](PRIVACY.md) for the full data and permission model.

## Troubleshooting

### Workflow import fails

Confirm it is API format JSON and contains at least one valid node titled exactly `INPUT`. Import errors identify the affected node and field.

### No active workflow

Open Workflows, import a valid preset, and activate it. Third-party webpage sends use the same active workflow.

### Waiting for service

Start ComfyUI, use `127.0.0.1` rather than `localhost` or a LAN address, and verify the port.

### A history thumbnail loads but the full output does not

Enable output caching and run the task again. Uncached records require the original ComfyUI server file to remain available.

### No D launcher or hover button

Verify that website integration is enabled and its optional permission is granted, then reload the page. The hover action only appears for loaded `<img>` / `<picture>` media above the configured threshold.

### A webpage image cannot be queued

Some sites use expiring signed URLs, hotlink protection, or non-image responses. The extension tries fallback candidates but does not forward page cookies, credentials, or authorization headers, and it rejects local, private-network, link-local, and over-100-MiB resources.

## Development Checks

```bash
npm run dev
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build:all
npm run validate:artifacts
```

## License

[MIT](LICENSE)
