# Improvement round: keyboard and focus (0.20.0 → 0.21.0)

**Target:** usability for keyboard and screen-reader users of the panel. **Evaluation:** serial self-critique, not independent (no separate evaluator was run; scores below are my judgment except where marked measured).

## Baseline (0.20.0, `tests/run.sh`, headless Chrome, stubbed extension APIs)
1 of 7 checks pass. Opening the panel left focus on the now-invisible tab; closing left focus on a control that had just been hidden; the view tabs, Use / Fix & flip and Show / Dim / Hide groups had radio/tab roles but no arrow keys, and every button stayed in the Tab order.

## Acceptance (frozen before changes)
The 7 checks in `tests/a11y.test.js`; no new permissions, network calls or storage; first-run welcome still opens the panel without taking focus.

## Candidates
| | A: focus management only | B: A + arrow keys / roving tab stop on tab and radio groups |
|---|---|---|
| Checks satisfied | 3 of 7 (open, Escape, return focus) — judged from the checks, not built separately | 7 of 7 — measured on the built tree |
| Hard gates | pass | pass (no manifest permission change, no remote code, no new data flow) |
| Complexity | ~8 lines | ~25 lines, one helper for three static groups |
| Score (team.json weights) | task 3, sec 5, a11y 3, arch 4, test 3, perf 5 → ≈ 73 | task 4, sec 5, a11y 4, arch 4, test 4, perf 5 → ≈ 86 |

B selected: it is the only candidate meeting acceptance, and the extra code is one small helper. One round; stop reason: acceptance met.

## Result
Final build 0.21.0: `tests/run.sh` 7/7 PASS. Also added `role="complementary"` and an accessible name to the panel.

## Limits / not done
- Not tested in real Chrome with the extension loaded, on live eBay/Facebook, or with an actual screen reader.
- Other keyboard paths (hover-only card actions ☆ / ✕ / Sold, the listing hover card) were not examined; hover-revealed actions are the likeliest next gap.
- Tab panels are not linked with `aria-controls`.

# Follow-up (0.22.0): card actions without a mouse

Request: "prettier and more useful". The panel's paper-and-ink look was kept (screenshot of 0.21.0 reviewed; no visual redesign made). The concrete gap found: Save / Sold / Not interested on cards and the tag's reasons card appeared only on mouse hover, and the buttons were `display:none`, so they could not take keyboard focus.

Change (`content/panel.js`): hover actions are now clipped rather than hidden and appear on hover or focus; the score tag is a focusable group that opens its reasons card on focus.

Evidence: `tests/run.sh` 11/11 PASS on this build; on the previous tree the three new card checks fail (focus did not move, focused box 0x0). The tag's focus-to-reasons behaviour is **not covered by a test** (needs a scan) and the card marks did not render visibly in the unstyled fixture, so their appearance on real eBay/Facebook pages is **unverified**. Touch devices are not addressed.

# Browser pass (0.22.1): found by driving the page with real key presses

Setup: the real `content/panel.js` + `adapters.js` served on localhost (`tests/sch/live.html`, adapters told it is an eBay results page, background stubbed with canned model replies), driven in the in-app browser. The unpacked extension itself was **not** loaded, and no live eBay/Facebook page was used.

Observed (real Enter/Tab): Enter on the tab opens the panel with focus inside; Tab reaches help, settings, tuck; a scan runs and puts a tag on all 6 cards; Tab from a card link lands on the score tag, which opens its reasons card, then Save, Sold, Not interested become visible and focusable.

Bug found: pressing Enter on Save saved the listing but the card's marks were redrawn and focus fell to the page body. Fix: `decorate` remembers which control had focus and refocuses the same position after redrawing. Re-tested with a real Enter: focus stays on "★ Saved". Automated check added (the headless run is now 12 checks).

Not fixed / noted: about 8 Tab stops per card (tag, three actions, reasons-card buttons), which is a lot on a 60-listing page; a "next card" shortcut would help. Still unchecked: the other hover actions' redraw behaviour (Not interested), Facebook layout, a screen reader.

# Live eBay check (read-only, one search page)

Page: `ebay.com/sch/i.html?_nkw=pentax+k1000` in the in-app browser, signed out. `SecondLook.extractEbay` (copied from `content/adapters.js` without changes to the logic) was run against the real DOM; the extension itself was not loaded.

- 62 `li.s-card` cards -> 60 listings. All 60 had price, image, shipping figure and seller rating. The 2 skipped are eBay's sponsored "Shop on eBay" placeholders, which is correct.
- 6 auctions read with bids and time left ("21 bids, 2d 7h"); 27 "or Best Offer"; no auction was also marked as an offer; no price ranges, no junk titles.
- The `li.s-card` selectors in the README are current as of 2026-10-11.
- **Not verified:** the sold-price lookup. A same-page `fetch` of the sold-listings URL was blocked by eBay's Radware script, so the median/p25/p75 code has not been run on real sold results. A content script uses its own `fetch`, so this does not show that the extension's lookup fails. The panel, scan and hover actions were not run on live eBay either.

# Live Marketplace check (read-only, signed-in home feed)

Page: `facebook.com/marketplace` (home feed, so browse mode), user's own signed-in session in the in-app browser. `extractFacebook`, `titleCode` and the label filter were run against the real DOM (copied logic, extension not loaded). Only counts and two public titles were inspected.

- 18 item links -> 18 listings; all had an image, a price line (one `FREE`, one $1,000,000) and a title that is not the location line. "Just listed" (12 cards carried a label) and "Ships to you" were correctly kept out of titles.
- 1 title flagged as coded: "oura Ring gen 4 size 7 V4847" at $35, which is the bulk-posted-code pattern, correctly flagged. 1 very short title ("If ykyk") is just a vague listing, not an extractor fault.
- The link-based approach (no class names) still works on Facebook as of 2026-10-11.
- **Not verified:** the panel, scan, reposted-code detection across pages, hover actions and keyboard path on live Facebook; listing pages (`extractItem`); Marketplace search results (this was the home feed).

## Marketplace search page (`/marketplace/<city>/search/?query=ipod`, read-only)
Same copied-logic method, extension not loaded. 15 links -> 15 listings; every one priced (one Free), no location line mistaken for a title, 4 carried a label that was kept out of the title, and the search words were read from the address (`query`). No coded titles and no same-title-different-code groups on this page, so the reposted-scam path has still **not** been exercised on a real page with a real campaign (only on the earlier home feed, which had one coded title). Page showed 15 cards before any scrolling; loading more was not tested.

# Listing pages, third site (0.22.2) — found by driving live pages

Method as before: the real extraction logic run against live DOMs in the in-app browser; the extension itself was not loaded. User authorised taking over tabs.

**Facebook listing (`/marketplace/item/<id>`), opened directly — bug found and fixed.** The listing reader chose any `[role=dialog]` containing an `h1`; Facebook keeps a hidden "Notifications" dialog in the page, so the title was "Notifications", with no price, no images, and the visible disguised address ("www . jmyzl . com", the README's own scam example) was missed, so no "Likely scam" note. Fix: `extractItem` only considers visible dialogs (`content/adapters.js`). Confirmed on the live page after the change: title, $31, 19 images in the main area, disguised address found.

**eBay listing (`/itm/<id>`), two flaws found and fixed.** Title, price, images, seller rating and details were read correctly. (1) "Free 2-4 day delivery" gave shipping `null` (unknown) because the pattern did not allow the hyphen; now 0. (2) The condition read "Excellent - RefurbishedExcellent - RefurbishedMore information…" (eBay repeats the label for screen readers and adds a button); now the single label. Neither changed the total price, but both fed the model messy text.

**Third site (Craigslist, search page).** `currentSite()` is null, no panel is injected, nothing runs: the extension ignores sites it has no adapter for, as designed. The search itself showed no results, so no listings were inspected.

**Tests.** `tests/run.sh` now has 3 fixtures and 20 checks (panel keyboard, card actions, Facebook listing, eBay listing). Before these fixes 6 of the new checks failed; now all pass. The fixtures mirror real structure but are small copies; they do not prove the live pages stay this way.

Not verified: panel/scan/hover on live eBay or Facebook (extension not loaded), sold-price lookup on real sold results, a Facebook listing opened as an overlay from the feed (only the direct-open form was seen), a real repost campaign (only a lone coded listing on the live search).

# Deeper pass (0.23.0): what the live pages and a short window taught

Lessons applied: test on the real page structure, not the assumed one; measure layout in the browser instead of trusting "results first".

Found and fixed (each with a failing check before, passing after; `tests/run.sh` is now 29 checks, 0 failing):
- **Auction listing pages**: eBay writes "Ends in 6d 20h", the reader only knew "6d 20h left", so the time left was dropped (the auction itself was still detected). Now read.
- **Marketplace markdowns**: 4 of 24 live cards ("$165" then "$180") carried the old price; it is now kept and shown as "↓ was $180" (not shown when the extension has its own recorded drop). Checked on live cards: the old price was always the higher one.
- **Results were off-screen on short windows** (measured in the browser at 1280x640 on a fixture scan): the sticky filter/sort bar took 163px of a 453px body and the controls 273px, so the first result began 530px down and 0 results were fully visible. The filter fields now sit behind a "Filter" button (counts what is set; opens itself when a search already has a filter or a deal price), the sticky bar is 75px, and a finished scan scrolls the panel up to the status line. Measured after: first result at 348px without the scroll; with it, 2 results fully visible, a third partly, status line still in view.
- Already seen to work on live pages: Facebook listing opened as an overlay from search results (visible dialog, title and price right); lazy loading (1 card at first, 24 after scrolling); price-drop cards' price order.

Not verified: the panel on live eBay/Facebook (the extension is not loaded in this browser; panel measurements are from the local fixture with canned model replies), narrower widths than 1280, touch, screen readers, the sold-price lookup.

# v3 design applied (0.24.0)

Applied from the "Second Look UX and visual design" canvas (v3, dark first):
- **Theme**: dark is the default palette. Settings → On the page → Theme: Match my browser (default; dark when the browser does not say), Dark, Light. The panel and the photo-check card follow it. The marks on cards follow the page's own measured background brightness (re-checked each second), falling back to the browser, then dark.
- **Contrast** (measured on the palettes): text 4.6:1 or better in both themes; control borders use a separate 3:1+ colour (the divider colour is 1.4:1); `color-scheme` is set so native checkboxes and menus match; text on verdict/accent fills uses a dark ink on dark theme (white on those fills failed there).
- **Type**: Atkinson Hyperlegible (Next / Mono) if installed, else the system font; larger text for titles, meta and hints; numbers monospaced. The bundled serif and its loader were removed (`fonts/`, `getFont`).
- **Results**: square score box with the verdict word beside every number, price in its own right-hand column, plain-language headline after a scan ("2 worth a look" / "Nothing here is a bargain"), "N look like scams" in the summary line.
- **Marks on the page**: same position as before, restyled (outlined score box with word, 4px corners, larger text, tokens per page brightness).
- **Tests**: `tests/run.sh` is 34 checks, all passing (adds page-brightness, theme-override and Dark/Light checks).

Not applied: the in-flow "Details" strip under each card's price (marks stay as overlays on the photo, because Facebook re-renders cards and an inserted block is fragile there), the Score/Price/Value/Ending segmented sort and "Hide skipped" checkbox (the existing sort menu and Show/Dim/Hide control remain), the table layout of the earlier v2, and the Setup sheet and status-line redesign. Atkinson is not bundled (fetching font files was not done); say if you want it bundled. Checked visually only on a local fixture and a rendered settings page, not in an installed extension on live eBay or Facebook.

# Chrome-extension guidance audit (0.24.0)

Checked against the MV3 checklist: Manifest V3 only; every icon is a real file at its stated size (16/32/48/128); `action` is declared; permissions are `storage`, `contextMenus`, `scripting` with host permissions scoped to eBay, Facebook, the AI services and local model addresses (the broad `https://*/*` is optional, asked for only when you pick a custom AI address); no `tabs` permission needed (no `tab.url` is read); the message listener returns `true` for async replies; the right-click photo check confirms with an on-page card; no `eval`, inline scripts or remote code; spending, cooldowns and scores are kept in `chrome.storage`, not worker variables (the few module variables are request-scoped: abort handles and two promise queues that only order writes).

Changed: the background message handler is now async/await instead of a `.then` chain. Left as is on purpose: the promise queues (`spendQueue`, `syncing`) because they exist to serialise writes, and about ten `.then` calls on `chrome.storage` in the content script and settings page (no behaviour difference).

Measured: decorating 200 cards takes about 0.9 s with a worst main-thread stall of 12 to 39 ms (headless Chrome, three runs), so no batching is needed.

Known minor: the toolbar "?" badge on unsupported pages is cleared by a 5 s `setTimeout` in the worker; the worker stays alive that long after the click so it works, but a worker restart in that window would leave the badge until the tab navigates.

# Settings: model menus (0.25.0)

Every model field on the settings page is now a menu instead of a bare text box: Claude model (the three models), the other-service Model and Photo model (what Test connection found, remembered between visits; the photo menu starts on "Same as the model above"), and Ollama's ranking and photo models (what Test connection found installed). "Another model…" reveals the text box for any ID, which stays the one place the value is saved. Checked the rest of the page for similar cases: provider, service and theme were already menus; the remaining boxes take free numbers or words. `tests/run.sh` now also loads the real settings page with stubbed extension APIs: 45 checks, 0 failing (a first run caught the menu not matching the saved model on load; fixed).

# Audit and improvement round (0.26.0, branch claude/second-look-audit-improve)

Method: read all of background.js, content/*.js and options/*; then loaded the **real unpacked extension** in headless Chrome 153 (CDP `Extensions.loadUnpacked`), served eBay-shaped pages as www.ebay.com over local https, and pointed `anthropicUrl` at a mock Claude API. Not covered: live eBay/Facebook, a real Claude key, a screen reader.

Works as intended (observed): content script registers, tab and marks draw before any scan, scan sends one request and tags 6 of 6, hover card via keyboard focus, Analyze on a listing page, toolbar-icon path with the tab turned off, first-run welcome, spend line, Test suite 45/45.

Found and fixed:
1. **Theme choice wiped on every update/reload** (`onInstalled` removed `theme`, left over from the retired retro themes). Now only invalid old values are removed.
2. **Scores lived only in the page's memory** (plus a 24 h cache keyed on exact lens/wants/query/model). Now saved per listing and lens, restored in other tabs, other searches and after reload, and shown on the listing page; analyses and photo checks included. Verified by `tests/e2e/scores-persist.ts`; a rescan after changing wants re-judges (found and fixed during that test).
3. Photo checks fetched any address a page supplied; now https images (and data:image) only, no localhost/private hosts.
4. Settings: two groups of number fields had a label with nothing to label; now named groups.

Also done in 0.26.1: the "add a key" card now sits above the welcome card; eBay result titles get the off-site-contact check (titles only). Still open: API keys sit in storage.local, which content scripts can technically read (they never ask for it).

# 0.27.0: cheaper default scans, Check this page
- New installs default to Sonnet 5.5; the system prompt carries `cache_control` and spend counts cache writes (1.25x) and reads (0.1x). Not measured: the real saving (needs a live key; Sonnet caches from 1,024 tokens, our instructions are roughly 1,600, so it should apply, Opus's larger minimum may not).
- "Check this page" diagnostic on "No listings found" / unreadable listing. Verified by `tests/e2e/diagnostic.ts` on an empty page; not yet seen on a live site that changed layout.

# 0.28.0: type, colour and button hierarchy
Inventory found 16 font sizes (9 to 24, with 10.5/11.5/12.5/13.5 as near-duplicates), weights 400/500/600/700, and row actions that looked like plain muted text. Now: one size scale and weights 400/600/700 across panel, marks, toast and settings; three button tiers (settings: Test connection filled, clear-actions red outline; settings section headings 18/600 instead of 11px caps); in-list actions underlined; "Start over" quiet; reasons 13px under 15px titles; tag word and verdict line share vocabulary (Fair price, Scam?). Checked by eye in dark and light at 1x in headless Chrome; contrast values unchanged (colours were not changed except a `--danger` token reusing the existing red). Not user-tested.
