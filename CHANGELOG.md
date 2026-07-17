# Changelog

All notable changes to Danbooru Viewer are recorded here. Versions follow Semantic Versioning.

## [Unreleased]

### Added

- Added a local ComfyUI workbench with API workflow management, configurable options, post and local-file inputs, a persistent serial queue, progress tracking, output previews, history, retry, cancellation, and background recovery.
- Added direct ComfyUI actions to post thumbnails, post details, multi-selection, and favorite groups.

### Changed

- Added narrowly scoped HTTP(S) host access for `127.0.0.1`; arbitrary webpage and system notification permissions remain excluded.
- Documented ComfyUI's local storage, data flow, default 1 GB task-media limit, and localhost-only boundary.
- Input thumbnails now open a progressive original-quality media viewer instead of enlarging the low-resolution preview.
- Completed the release validation, reproducible-build, privacy, store-listing, and rollback documentation baseline.

### Known limitations

- ComfyUI connections are limited to `127.0.0.1`; LAN and remote instances are intentionally unsupported.
- Running-task cancellation calls ComfyUI's instance-wide `/interrupt` endpoint after confirmation and can affect unrelated work on that instance.
- A lost `/prompt` response is marked for manual confirmation instead of being retried automatically, preventing duplicate generation.

## [0.1.0] - 2026-07-17

### Added

- Unified browsing for Danbooru, Gelbooru, Safebooru, Yande.re, and Rule34.
- Search, advanced filters, three layouts, post details, downloads, and a local favorites library.
- General-only first-install default, English and Simplified Chinese UI, source credential testing, and bounded local caches.
- Chromium and Firefox Manifest V3 builds with automated quality and artifact checks.

[Unreleased]: https://github.com/bandwinterweave/Danbooru-Viewer/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/bandwinterweave/Danbooru-Viewer/releases/tag/v0.1.0
