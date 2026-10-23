# Tests

```
deno task test          # everything below
tests/run.sh            # fixture pages in plain Chrome: the panel's keyboard use, settings, adapters; then the rules on their own
deno test --allow-read tests/unit/     # no browser: the plain rules and helpers (node --test works too)
tests/e2e/run.sh features.ts           # the real extension in headless Chrome; also scores-persist.ts, marketplace.ts, ux.ts, adapters.ts
```

Needs Chrome or Chromium, `deno`, `python3` and `openssl`. `chrome.sh` picks the browser: `$CHROME_BIN`, else an installed
Chrome or Chromium, else Playwright's (cloud containers have it). In a Claude Code cloud session `.claude/hooks/session-start.sh`
installs deno from npm, so `deno task test` runs with no setup. Nothing touches the real eBay, Facebook or Claude API:
`tests/e2e/server.ts` serves eBay- and Marketplace-shaped pages at their real addresses (the browser maps the hosts to
it) and a fake Claude API that keeps every request, so tests can check the model, effort and fallbacks sent.

| File | What it checks |
|---|---|
| `unit/rules.test.mjs` | word matching, the filter bar, scam signs, project words, how a photo check moves a verdict |
| `unit/shared.test.mjs` | the link check, settings limits, spend totals, the toolbar-number rules, the old word lists → one line |
| `unit/eval.test.mjs`, `eval/` | the accuracy eval: labeled listings (`eval/cases.mjs`) through the free checks, with floors on scams caught, honest ones marked, price words, and honest listings far under typical (`CHEAP`, scored on their own). `deno task eval` prints the scorecard and what came out wrong (`EVAL_ALL=1` for every listing). Add a listing that fooled the checks here first, labeled, then change the rules. `eval/model.mjs` (`ANTHROPIC_API_KEY=... deno task eval:model`) sends the cheap listings and their look-alike scams through the real scan prompt and the price check, and says where the model's verdict or `cheapWhy` differs from the label: by hand after a prompt change, never in CI (it costs money and the answers vary) |
| `unit/adapters.test.mjs`, `offsite.test.mjs` | prices, shipping, lots, auctions, seller ratings, the scam code and off-site contact patterns (and ordinary sentences that must not match) |
| `e2e/adapters.ts` | the site adapters against the saved pages in `fixtures/`: eBay (two layouts and categories, and real saved searches), sold prices, listing pages (hand-made and real), Marketplace (synthetic and real saved searches) |
| `e2e/features.ts` | Buyer and Reseller, Home and the toolbar number, which model does what, budget and billing, safe links and restores, settings, the sold-price route from Facebook, no errors logged |
| `e2e/ux.ts` | row links on hover, Filter and the spend popover, the Sort menu, docking and widths |
| `e2e/scores-persist.ts` | scores kept with each listing across tabs, searches and reloads |
| `e2e/marketplace.ts` | Marketplace: reposted-code scams, a scan, whole grid cells hidden (no gaps) |
| `e2e/perf.ts` | a long, busy Marketplace feed: main-thread time while scrolling, with and without the extension, opening and sorting the panel; `PROFILE_OUT`/`TRACE_OUT` say where the time goes. In `all.sh` it runs as a guard (`PERF_GUARD=1`) |
| `e2e/perf-long.ts` | not a test: a minute of scrolling a Marketplace feed with a photo on every card (about 2,000 cards), then a minute left idle: busy time per ten seconds, the messages sent to the background worker, its storage writes, and what each stored record weighs. `PERF_FULL=1` starts with storage at its caps, `PERF_ALONE=1` without the extension, `PROFILE_OUT=file` says where the idle minute went (with `PROFILE_SCROLL=1`, the scrolling) |
| `e2e/robust.ts` | the free features when things go wrong: a site that changed its pages, storage, several tabs at once, damaged backups |
| `e2e/free.ts` | the free extras: "too cheap" marks from sold prices, the offer helper on a listing page (with "They said $…" and the plan passed to an analysis), saved listings as a spreadsheet |
| `e2e/real.ts` | a search the way buyers meet it ("nintendo switch oled": a game, a case, bait, a WhatsApp scam, a for-parts one, an auction, a lot, a new seller) through the free read, a scan whose model makes the usual mistakes, and Analyze: every tag's number fits its word, cards and rows agree, the price check's overrides say why. `REAL_DUMP=1` prints what every card and row shows |
| `e2e/photos.ts` | the same photo on other Marketplace listings: fingerprints of thumbnails on screen, marks on both cards, kept for later pages, never on eBay |
| `e2e/tidy.ts` | 0.39.0: the Marketplace home feed without off-topic posts, quick filters and Skips out of the Filter drawer, the free read on rows and chips, an offer from one free sold lookup, search ideas on the feed, the navy theme, clicking the page tucks the panel away |
| `e2e/marks.ts` | which marks show: each kind of chip follows its switch on an open tab, one mark per listing puts the scam mark first, scam marks off leave no gray card without a reason (the panel still warns), and the settings switch asks first |
| `e2e/ai-off.ts` | the AI turned off in settings: no AI buttons or menus in the panel, the free price check leads, auto-scan stays off, the background refuses an AI call, nothing reaches the fake AI, and turning it back on brings Scan back |
| `e2e/focus.ts` | What should Tirekick do: each focus sets its switches, open tabs follow (Scam check only leaves only scam marks and no Scan), the banner says so, and a switch changed by hand reads as Custom |
| `e2e/first-run.ts` | the welcome opens the panel once; Got it puts it away; ? brings it back |
| `e2e/rename.ts` | a tab left open across the Second Look → Tirekick update loses the old panel and tags |
| `e2e/states.ts` | every way things can go wrong, on the real panel: rejected key, rate limit, answer cut off, no connection, budget used up, a scan under way and stopped, a page with nothing to scan, empty Saved and Home, Delete everything. Checks the message, that it's on screen, and that it offers the way out (`STATES_OUT=dir` saves screenshots) |
| `e2e/a11y.ts` | not a test: the browser's accessibility tree (controls with no name), the keyboard tab order and focus rings, forced colors (Windows high contrast) and 200% zoom, as screenshots and `a11y.json` (`A11Y_OUT=dir`) |
| `e2e/audit.ts` | not a test: screenshots of every state, dark and light, plus contrast, target-size and type measurements (`AUDIT_OUT=dir`) |
| `e2e/screenshots.ts` | not a test: the store screenshots in `store/screenshots` |
| `a11y.test.js`, `opts.test.js` | keyboard and focus in the panel; the settings page (run by `tests/run.sh`) |

## When eBay or Facebook change their markup

The adapters (`content/adapters.js`) are the part most likely to break, and `e2e/adapters.ts` is how you find out where.

1. Save the page that stopped working (browser → Save page as → "Webpage, HTML only") over the matching file in `tests/fixtures`.
   Keep the first-line comment, and trim the page down if it is huge: the adapters only need the cards and the listing's main area.
2. `tests/e2e/run.sh adapters.ts` shows which expectations fail. Fix the selectors in `content/adapters.js`, then adjust the
   expected values if the page you saved has different listings.

The `*-real.html` fixtures are real searches (October 2026: eBay iPods, bikes, couches and 4TB hard drives; Marketplace iPods (two),
couches, dumbbells, "ds" and the home feed) and two real listing pages (`ebay-item-real`, `facebook-item-real`), trimmed and sanitized with
`python3 tests/helpers/trim-page.py ebay|facebook|ebay-item|facebook-item saved.html out.html`: only the result cards (or the listing's
own parts), no scripts or tracking, and made-up item ids, seller names, places, ZIP codes and photos. A Marketplace listing saved while
open keeps only its listing pop-up, never the others (notifications, chats). Run a fresh save through it the same way, then read the
text before committing (titles and descriptions stay as sellers wrote them: look for names, streets and landmarks). The other eBay fixtures are small hand-made reductions of older layouts, and
`facebook-marketplace.html` is synthetic: Facebook's markup is generated, so the adapter reads link text, not class names.

## Adding a test

- A rule with no page in it → `unit/` (load it with `loadScripts()` from `helpers/load.mjs`).
- Anything in the panel (Home included) or the settings → `e2e/`, with `start()` and `open()` from `e2e/lib.ts`. The panel
  does a lot on timers: wait for what you expect rather than a fixed pause where you can, and close earlier tabs before
  clearing storage (an open tab saves its scores a moment later).
