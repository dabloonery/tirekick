# Tests

```
deno task test          # everything below
tests/run.sh            # fixture pages in plain Chrome: the panel's keyboard use, settings, adapters; then the rules on their own
deno test --allow-read tests/unit/     # no browser: the plain rules and helpers (node --test works too)
tests/e2e/run.sh features.ts           # the real extension in headless Chrome; also scores-persist.ts, marketplace.ts, ux.ts, adapters.ts
```

Needs `google-chrome-stable`, `deno`, `python3` and `openssl`. Nothing touches the real eBay, Facebook or Claude API:
`tests/e2e/server.ts` serves eBay- and Marketplace-shaped pages at their real addresses (the browser maps the hosts to
it) and a fake Claude API that keeps every request, so tests can check the model, effort and fallbacks sent.

| File | What it checks |
|---|---|
| `unit/rules.test.mjs` | word matching, the filter bar, scam signs, project words, how a photo check moves a verdict |
| `unit/shared.test.mjs` | the link check, settings limits, spend totals, the toolbar-number rules, the old word lists → one line |
| `unit/adapters.test.mjs`, `offsite.test.mjs` | prices, shipping, lots, auctions, seller ratings, the scam code and off-site contact patterns (and ordinary sentences that must not match) |
| `e2e/adapters.ts` | the site adapters against the saved pages in `fixtures/`: eBay (two layouts and categories), sold prices, a listing page, Marketplace |
| `e2e/features.ts` | Buyer and Reseller, Home and the toolbar number, which model does what, budget and billing, safe links and restores, settings, the sold-price route from Facebook, no errors logged |
| `e2e/ux.ts` | row links on hover, Filter and the spend popover, the Sort menu, docking and widths |
| `e2e/scores-persist.ts` | scores kept with each listing across tabs, searches and reloads |
| `e2e/marketplace.ts` | Marketplace: reposted-code scams, a scan, whole grid cells hidden (no gaps) |
| `e2e/perf.ts` | a long, busy Marketplace feed: main-thread time while scrolling, with and without the extension, opening and sorting the panel; `PROFILE_OUT`/`TRACE_OUT` say where the time goes. In `all.sh` it runs as a guard (`PERF_GUARD=1`) |
| `e2e/states.ts` | every way things can go wrong, on the real panel: rejected key, rate limit, answer cut off, no connection, budget used up, a scan under way and stopped, a page with nothing to scan, empty Saved and Home, Delete everything. Checks the message, that it's on screen, and that it offers the way out (`STATES_OUT=dir` saves screenshots) |
| `e2e/a11y.ts` | not a test: the browser's accessibility tree (controls with no name), the keyboard tab order and focus rings, forced colours (Windows high contrast) and 200% zoom, as screenshots and `a11y.json` (`A11Y_OUT=dir`) |
| `e2e/audit.ts` | not a test: screenshots of every state, dark and light, plus contrast, target-size and type measurements (`AUDIT_OUT=dir`) |
| `e2e/screenshots.ts` | not a test: the store screenshots in `store/screenshots` |
| `a11y.test.js`, `opts.test.js` | keyboard and focus in the panel; the settings page (run by `tests/run.sh`) |

## When eBay or Facebook change their markup

The adapters (`content/adapters.js`) are the part most likely to break, and `e2e/adapters.ts` is how you find out where.

1. Save the page that stopped working (browser → Save page as → "Webpage, HTML only") over the matching file in `tests/fixtures`.
   Keep the first-line comment, and trim the page down if it is huge: the adapters only need the cards and the listing's main area.
2. `tests/e2e/run.sh adapters.ts` shows which expectations fail. Fix the selectors in `content/adapters.js`, then adjust the
   expected values if the page you saved has different listings.

The eBay fixtures are small hand-made reductions of the layouts the adapters handle. **`facebook-marketplace.html` is
synthetic**: Facebook's real markup is generated and changes constantly, so the adapter reads link text instead of class
names. Replace it with a real saved page when you have one.

## Adding a test

- A rule with no page in it → `unit/` (load it with `loadScripts()` from `helpers/load.mjs`).
- Anything in the panel (Home included) or the settings → `e2e/`, with `start()` and `open()` from `e2e/lib.ts`. The panel
  does a lot on timers: wait for what you expect rather than a fixed pause where you can, and close earlier tabs before
  clearing storage (an open tab saves its scores a moment later).
