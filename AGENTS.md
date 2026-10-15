# Notes for agents

Read these before changing anything:

- [docs/ROADMAP.md](docs/ROADMAP.md): Chrome Web Store checklist, the robustness plan for the
  no-AI features, and the feature briefs (what to build next).
- [docs/REFERENCE.md](docs/REFERENCE.md): voice and copy, the rename plan, and the security and
  permissions review.
- README.md **Ground rules**: only pages the user is looking at, no crawling or background fetching
  from the stores, never get past a bot check.
- [docs/adding-a-site.md](docs/adding-a-site.md) before touching anything store-specific.

Standing rules:

- US English only, in code, copy and docs ("tire", "color").
- Never present Tirekick as "no AI" or AI-free: it has AI features. Say the core features work without the
  AI and the AI is optional; for a single action, "your AI isn't used" (Myer, 2026-10-15).
- Keep the flat Tread Dot look, in color: a subtle slate-navy dark theme, orange main button, verdict colors on tags and rows (Myer wants color as a cue; the neutral graphite round was undone in 0.39.0). Design tokens live in `lib/theme.js`. No gloss, no 3D.
- The extension must work in Vivaldi as well as Chrome.
- No background polling for alerts. Alerts come only from open tabs and the user-pressed
  "Check my saved searches" button.
- Add new plans as sections in `docs/ROADMAP.md` or `docs/REFERENCE.md`, not as new files.
- Never submit to the Chrome Web Store without Myer's OK.
- One PR per change, with `deno task test` green.

## How the code fits together

Plain Manifest V3, no build step and no dependencies: the folder loads unpacked as is.

- `background.js`: the service worker. Every AI call, eBay sold-price fetches, context menus, the
  toolbar action, and the one writer for shared storage. Messages arrive as `{ type, payload }` and go
  to the `HANDLERS` table.
- `content/adapters.js`: reads listing cards and listing pages into one shape per site. Layered
  selectors, because the stores change their markup without notice; this is what breaks first.
- `content/rules.js`: plain functions (filters, scam signs, page health), with no page, storage or
  network access, so they can be unit tested.
- `content/panel.js`: the on-page panel (state, views, scans). `content/home.js` is its Home tab.
- `lib/sites.js`: everything that differs per store. `lib/shared.js`: helpers shared by every context
  (`safeUrl`, `applyEdit`, `upgradeStorage`, backup checks). `lib/sold.js`: sold-price lookups, cache
  and pacing. `lib/theme.js`: all colors, type and the tread mark.
- `hub/`: Tirekick's own page (look-ups, Saved, Home) opened from any other site. `options/`: settings.

Conventions that matter:

- **Shared records** (the `SHARED` set in `background.js`: saved items and searches, stats,
  `siteHealth`, `soldCache` and more) are only changed with `send("storeEdit", { name, edit })`,
  never a direct `chrome.storage.local.set`, so two tabs can't undo each other. Edit ops are
  documented above `applyEdit` in `lib/shared.js`. A new shared record goes in `SHARED`.
- **Storage shape changes** go in `TKShared.upgradeStorage` with a bump to `STORAGE_VERSION`; the
  background runs it once per version. Restore (backup import) must accept older shapes too.
- **A new background message type** goes in `HANDLERS`. The fixture pages stub
  `chrome.runtime.sendMessage` (`tests/sch/i.html`, `tests/sch/live.html` and the item fixtures) and
  answer unknown types with an empty reply, so add a stub reply there if the panel needs real data back.
- **Layout watch**: on results pages the panel checks how many listings it could read
  (`TKRules.readHealth`) and records the result per store in `siteHealth`; Home shows a note when a store
  looks broken. Keep that working when you change adapters.
- **Links**: any address that came from storage, a backup or a web page goes through
  `TKShared.safeUrl` before it becomes a link or is opened (security review L1, done in 0.37.0).
- **Permissions**: don't add any without a reason in `store/LISTING.md` and the security review.
  Any-address host access stays optional, asked for one address at a time.

## Tests

`deno task test` runs everything (`tests/all.sh`): the fixture pages in headless Chrome, the unit tests,
then the real extension end to end against a local fake eBay, Facebook and AI server (`tests/e2e/`).
It needs `google-chrome-stable`, `deno`, `python3` and `openssl`. For quick runs:
`deno task test:unit` (no browser) or `tests/e2e/run.sh features.ts`. `deno task pack` builds the
store zip from an allowlist. See `tests/README.md` for which file checks what, and for refreshing
fixtures when a store changes its markup.
