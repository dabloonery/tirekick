# Renaming the extension

The name isn't settled (another browser extension is already called "Second Look"; see the trademark
note in `store/LISTING.md`). A rename changes what people read, and keeps every internal name: those
are how existing installs find their saved listings, settings and scores.

## Change (what people read)

- `manifest.json`: `name`, `description`, `action.default_title`, `commands` description, `homepage_url`
- The wordmark "Second *Look*" and the vertical tab label: `content/panel.js` (the panel template and the tab), `options/options.html`, `hub/hub.html`
- Text that says the name: `git grep -n "Second Look" -- content lib background.js options hub` (welcome card, menu items, status messages, the photo card, settings, the hub)
- The toolbar icon and logo mark (`icons/`, the `MARK` SVG in `content/panel.js`, the mark in `options/options.html` and `hub/hub.html`)
- `README.md`, `store/LISTING.md`, `store/PRIVACY.md`, `store/screenshots/`, `docs/`
- `LICENSE` (the first line)

## Keep (internal names)

- Storage keys (`saved`, `savedSearches`, `scans`, `listingMemory`, `searchWants`, settings names…) and the backup file's `app: "second-look"` marker: changing them loses everyone's data.
- Page markers and ids: `second-look-host`, `.second-look-sticker`, `data-second-look-*`, `data-sl-*`, the `#second-look-styles` sheet, the `second-look-*` page events, the `SecondLook` / `SL*` script globals, the "SL Fraunces" font name, the `second-look-*` context menu ids and the registered script id.
- The extension id comes from the Chrome Web Store listing, not the name; keep the same listing (rename it there) and installs update in place.

A test after renaming: `deno task test`, then load the packed extension over an existing profile and check Saved and settings are still there.
