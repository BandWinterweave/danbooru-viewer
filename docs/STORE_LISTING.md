# Danbooru Viewer store listing

## Short description

A focused new-tab workspace for browsing, filtering, saving, and downloading posts across Booru sources.

## Full description

Danbooru Viewer turns the browser's new tab into an image-first workspace for Danbooru, Gelbooru, Safebooru, Yande.re, and Rule34.

Search and combine tags without losing context. Switch between grid, masonry, and information-dense list layouts, inspect post metadata in a side panel, and open media in a full-screen viewer. Quick rating controls, reusable tags, local favorite groups, formatted tag copy, and single or batch downloads keep repeated workflows close at hand.

The extension stores preferences, local favorites, download history, and a 24-hour thumbnail cache on the device. It does not include analytics or telemetry. Optional source credentials remain in browser extension storage and are sent only to the selected Booru API.

### Highlights

- Five supported Booru sources with a normalized browsing experience
- Tag, rating, score, date, resolution, and ordering filters
- Grid, masonry, and list layouts with virtualized rendering
- Local favorites and custom groups
- Full-screen image and video viewer with keyboard navigation
- Original, sample, and preview downloads with configurable filenames
- Light, dark, and system themes
- Responsive desktop and compact-width layouts

## Privacy disclosure

Danbooru Viewer does not collect, sell, or transmit usage analytics. API requests go directly to the source selected by the user. Credentials and personal settings are stored locally through the browser extension storage API. Cached thumbnails and local favorites are stored in IndexedDB and can be removed by clearing extension data.

## Screenshot checklist

1. Light theme: main grid with active filters and the post detail drawer.
2. Dark theme: masonry layout with the tag hover inspector visible.
3. Compact viewport: search, rating controls, and a two-column grid.
4. Viewer: full-screen media with zoom and slideshow controls.
5. Settings: theme, downloads, tag copy, and source credentials.

Store images should use the current acceptance-test build and contain no explicit media or user credentials.
