# Release process

## Release checklist

1. Start from a clean working copy and use a supported Node.js version (`>=20.19.0`). Run `npm ci`.
2. Choose a SemVer version. Update `package.json`, `package-lock.json`, `src/manifest.json`, and `CHANGELOG.md`, then run `npm run validate:version`.
3. Review Manifest permissions, host permissions, CSP, locale strings, `PRIVACY.md`, README capabilities, store copy, shortcuts, and known limitations.
4. Run `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test:coverage`, and `npm run test:e2e`.
5. Run `npm run verify:reproducible` followed by `npm run validate:artifacts`. Preserve `artifacts/reproducibility.json` and `artifacts/build-manifest.json` with the release record.
6. Load the generated `dist` build in current stable Chrome and Edge, and `dist-firefox/manifest.json` in current stable Firefox. `npm run smoke:chromium-extension -- <browser-executable> <name>` automates the Chromium service worker, new tab, popup, and settings load check; complete the remaining browser record manually using General-rated fixtures only.
7. Replace every placeholder listed in `docs/STORE_LISTING.md` with release-candidate screenshots. Check dimensions, cropping, readable text, General-only media, and removal of credentials or account identifiers.
8. Create archives from the validated build directories without rebuilding. Record each archive SHA-256 beside the release entry.
9. Create tag `v<package version>`. CI must pass version validation and publish the unsigned builds, file manifest, and reproducibility report before store submission.
10. Submit the same validated archives to Chrome Web Store, Edge Add-ons, and Firefox Add-ons. Record submission IDs and approval status in the release issue.

## Browser smoke record

Do not mark a release ready with blank cells. Record the exact browser version and result in the release issue; this table defines the required checks rather than claiming a particular build has passed.

| Flow | Chrome | Edge | Firefox |
|---|---|---|---|
| Unpacked/temporary extension loads without Manifest errors | Pending | Pending | Pending |
| New tab, popup, and settings open | Pending | Pending | Pending |
| First-install state enables only General | Pending | Pending | Pending |
| Search, pagination, source switch, and detail drawer work | Pending | Pending | Pending |
| Favorites persist after browser restart | Pending | Pending | Pending |
| Requested single download completes | Pending | Pending | Pending |
| Service worker/background restarts without unhandled errors | Pending | Pending | Pending |

Chrome and Edge are separate smoke targets even though both consume `dist`. Firefox consumes `dist-firefox` and must be checked after the background script rewrite. Keep screenshots or console exports only for failures; store screenshots follow the separate sanitized checklist.

## Release record

For every release, record:

- Version, tag, source revision, date, and release owner
- Node and npm versions used by CI
- Chromium and Firefox archive filenames and SHA-256 hashes
- `build-manifest.json` and `reproducibility.json`
- Chrome, Edge, and Firefox versions and smoke results
- Store submission IDs, approval dates, and published versions
- Accepted known limitations or dependency findings

## Rollback

1. Stop or cancel pending store submissions. If already published, use each store's rollback or previous-version controls where available; do not rebuild an old tag.
2. Retrieve the previously approved archives and hashes from the release record. Verify SHA-256 before submission.
3. If a new corrective version is required, branch from the last known-good tag, apply only the release-blocking fix, increment the patch version, and repeat the full checklist.
4. Restore documentation and store copy only when the reverted behavior changes a user-visible capability, permission, or privacy statement.
5. Record the incident, affected versions, reason, store actions, and final resolution in `CHANGELOG.md` and the release issue.
