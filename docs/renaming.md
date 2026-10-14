# Renaming the extension

Second Look became Tirekick in 0.35.0. That rename changed what people read and the internal names
(page ids, globals, events, menu ids, the backup marker), with migrations so existing installs keep
working. This is what it touched, as a checklist for any future rename.

## What people read

- `manifest.json`: `name`, `description`, `action.default_title`, `commands` description, `homepage_url`
- The wordmark: `lib/theme.js` (`TKTheme.wordmark`), `options/options.html`, `hub/hub.html`, and the panel's tab label in `content/panel.js`
- Text that says the name: `git grep -n "Tirekick" -- content lib background.js options hub` (welcome card, menu items, status messages, the photo card, settings, Tirekick's own page)
- The toolbar icon and mark (`icons/`, made by `scripts/icons.mjs`)
- `README.md`, `store/LISTING.md`, `store/PRIVACY.md`, `store/screenshots/`, `docs/`, `LICENSE` (the first line)

## Internal names, and what keeps old installs working

- Storage keys (`saved`, `savedSearches`, `scans`, `listingMemory`, `searchWants`, settings names…) never change: changing them loses everyone's data.
- Page markers and ids (`tirekick-host`, `.tirekick-sticker`, `data-tirekick-*`, `data-tk-*`, `#tirekick-styles`, the `tirekick-*` page events, the `Tirekick` / `TK*` globals, the `tirekick-*` menu ids). A tab left open across the update still holds the old panel; `content/panel.js` removes the old markers on load.
- The registered page script: `background.js` unregisters the old id (`OLD_AUTO_IDS`).
- Backups: `options/options.js` accepts every name in `BACKUP_APPS`, the new one first.
- The extension id comes from the Chrome Web Store listing, not the name; keep the same listing (rename it there) and installs update in place. For an unpacked install, the id comes from the folder's path, so don't rename the folder.

`tests/e2e/rename.ts` checks the migrations. After a rename: `deno task test`, then load the packed extension over an existing profile and check Saved and settings are still there.
