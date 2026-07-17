# Phase 6 browser smoke record

Date: 2026-07-17  
Extension version: 0.1.0  
Build inputs: current working revision, Node.js 24.18.0

General-rated content only was used. No store screenshots were captured; `docs/STORE_LISTING.md` retains the requested screenshot placeholders.

| Browser | Version | Build | Result | Verified scope |
|---|---:|---|---|---|
| Chrome for Testing | 149.0.7827.55 | `dist` | Pass | Unpacked extension, service worker, new-tab override, popup, and settings page loaded without page errors. |
| Microsoft Edge | 150.0.4078.65 | `dist` | Pass | Unpacked extension, service worker, new-tab override, popup, and settings page loaded without page errors. |
| Firefox | 151.0 | `dist-firefox` | Pass | `web-ext` installed the build as a temporary add-on and opened the new-tab override; Manifest validation reported zero errors and notices. |

The Chrome and Edge checks used `scripts/smoke-chromium-extension.mjs` with isolated temporary profiles. Firefox used an isolated `web-ext run` profile with the Playwright Firefox binary. The Firefox runner was stopped after the successful temporary-add-on installation message because it intentionally remains active while the browser is open.

Automated page E2E separately covers first-install General-only state, search, applied filters, pagination, details, favorites, downloads, mobile navigation, and unhandled rejection monitoring with controlled API fixtures. Every release candidate must repeat the browser-specific checks in `docs/RELEASING.md`; this record applies only to the build identified above.
