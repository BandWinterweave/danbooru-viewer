# ComfyUI integration phase 0 record

Date: 2026-07-17

## Baseline

- `npm.cmd run build:all`: passed for Chromium and Firefox.
- `npm.cmd test`: 36 files and 176 tests passed before ComfyUI code was added.
- `npm.cmd run lint`: passed with zero warnings.
- `npm.cmd run validate:artifacts`: validated 54 files across both builds.
- Manifest baseline keeps `unlimitedStorage` and has no localhost host permission yet. That permission remains a phase 5 change.

## Source and authorization boundary

The reference directory `D:\Baidu\comfyui-browser-sender-pro` contains no LICENSE, COPYING, NOTICE, SPDX declaration, package license metadata, copyright grant, Git history, or configured remote. Absence of a license is not permission to copy or redistribute code.

This integration therefore uses the reference extension only to confirm observable ComfyUI protocol behavior and node naming conventions. The TypeScript implementation in this repository is independently written. No UI, source text, storage format, or broad host permission is copied.

## Frozen protocol decisions

- API JSON is an object keyed by node ID. Every node requires a non-empty `class_type` and an `inputs` object.
- Node titles are case-sensitive. `INPUT` and `REVERSE` are exact. `OUTPUT` is a prefix. OPTION nodes match `^OPTION.+`, so a title of exactly `OPTION` is not special.
- At least one valid `INPUT` is required. OUTPUT and REVERSE nodes are optional. Every declared special node is validated at import time.
- Text OPTION uses `inputs.text`. Integer OPTION uses the first safe integer in `value`, `integer`, `number`, or `input`. A prepared integer OPTION replaces only direct two-element ComfyUI links and removes the primitive node.
- Queue snapshots will contain the complete prepared workflow, final OPTION values, final reverse text, server address, and input reference. Preset edits cannot alter queued work.
- Task states, error codes, extension message discriminants, and IndexedDB names/keys are defined in `src/services/comfy/types.ts`. Messages remain isolated from `API_REQUEST`.
- IndexedDB uses `danbooru-viewer-comfy` with separate metadata, workflows, tasks, history, input Blob, and output Blob stores. Schema version starts at 1.
- ComfyUI addresses accept only HTTP(S), host `127.0.0.1`, and ports 1-65535. Credentials, paths, queries, and fragments are rejected. The default port is 8188.
- `/history/{promptId}` is the completion authority. WebSocket events accelerate polling and report progress/errors but do not independently mark a task completed.
- A network or timeout failure during `/prompt` is classified as `submission-unknown`; callers must not automatically resubmit it.
