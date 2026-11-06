# 万圣节塔防 — 独立静态版

Standalone build of the Halloween tower-defense game (Muse space `space-5`),
packaged 2026-11-06 so it runs on any static host with no Muse runtime.

## Deploy

Upload the contents of this folder (index.html at the root) to any static
host. For the GitHub + jsDelivr route:

1. Create a public GitHub repo, upload everything in this folder to its root.
2. Open `https://cdn.jsdelivr.net/gh/<user>/<repo>@<branch>/index.html`
   (replace `<user>`, `<repo>`, `<branch>`; use a release tag instead of a
   branch name once the game is stable, so the link never moves).
3. Every later update: push the changed files, then open the same URL with
   a new tag — or wait for jsDelivr's cache to refresh.

No build step, no server, no database. The game stores progress in the
browser's localStorage only.

## What changed vs the Muse version

- **Font self-hosted (the only code change).** Baloo 2 used to load from
  Google Fonts (`fonts.googleapis.com` / `fonts.gstatic.com`), which is
  unreachable from mainland China. The exact same font files are now in
  `assets/fonts/` (`baloo2-latin.woff2`, `baloo2-latin-ext.woff2`, served
  by `assets/fonts/baloo2.css`, SIL Open Font License 1.1). Only the
  `__tdLoadGameFont` loader in `index.html` was touched; its contract is
  unchanged (`css.onload` still adds `.fonts-in`, `window.__tdFontCss`
  is still exposed for the boot-progress wiring).
- Nothing else changed: no gameplay, art, music, or text edits.

## External requests (only one left)

| Request | Purpose | China risk |
|---|---|---|
| `https://visitor-badge.laobi.icu/badge?page_id=td-halloween-space5-2026` | Visit counter badge (an `<img>` in the footer) | May be slow/unreachable in China. Harmless: it loads asynchronously and hides itself on error (`onerror` hides the badge). Kept deliberately — removing it would stop the visit counting. |

Everything else (engine, images, music, font) is served from local files.
The share button shares `location.href`, so on the new host it
automatically shares the new URL. The visit counter keeps counting under
the same `page_id`, so counts continue across hosts.

## Files

- `index.html` — entry point (all asset paths are relative)
- `assets/game.js` — game engine (~366 KB)
- `assets/*.webp` / `assets/*.jpg` / `assets/*.png` — splash art, victory
  group photo, defeat report, Dracula portraits (`.png` is the fallback
  if the `.webp` fails to decode)
- `assets/my-castle-my-rules.mp3` — victory music loop
- `assets/fonts/` — self-hosted Baloo 2 (latin + latin-ext)

Not included (unreferenced by the game): `assets/splash-cover-2.jpg`,
`assets/icon.webp`, Muse build metadata (`space.json`, `.space-build/`,
audits).
