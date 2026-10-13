# UI/UX audit — 0.28.1 (2026-10-12)

**Brief:** minimalist but elegant. **Method:** the real unpacked extension in headless Chrome 153 (`tests/e2e/audit.ts`), local eBay- and Marketplace-shaped pages, a mock Claude API. 13 states captured in dark and light (first run, closed tab, cards, hover card, pre-scan, scanned, filter + spend open, ideas, saved, listing analysed, error, settings full and at 390px) plus measurements: text contrast for every text node, interactive target sizes, font sizes and weights. Compared with WCAG 2.2 AA and current practice (Material 3 / Apple HIG type and density guidance, progressive disclosure, one primary action per view).

**Not measured:** a real screen reader, forced-colors / high-contrast mode, 200% zoom, RTL, touch, an 8-px spacing audit, real eBay/Facebook pages, users. Everything below is expert review plus measurement, not user research.

## Verdict
The foundations are good: one typeface, one restrained palette, semantic colour, a word beside every colour, dark-first with a true light theme, reduced-motion respected, keyboard operable. It is minimal in vocabulary but **not yet minimal in density**: the panel shows a lot of equally weighted controls at once, so the eye has no single place to land. The fixes below are mostly about showing less at a time.

## What meets the standard (measured)
| Check | Result |
|---|---|
| WCAG 1.4.3 text contrast (4.5:1; 3:1 large) | **0 failures** across 8 panel/settings views, dark and light (dimmed "skip" rows excluded on purpose) |
| 1.4.11 control borders (3:1) | designed to 3:1 (`--line`), not re-measured |
| 2.4.7 focus visible | 2px ink ring on buttons/links/inputs; arrow-key roving in tab and radio groups (tests/a11y) |
| 2.3.3 / prefers-reduced-motion | animations disabled |
| 1.4.10 reflow | settings page: no horizontal scroll at 390px; panel width `min(380px, 100vw - 32px)` |
| Theme | `prefers-color-scheme` + explicit override, kept across updates |
| Type scale | now 10–18px in the panel, weights 400/600/700 (was 16 sizes) |

## Findings, most important first
**P1 — causes confusion or real friction**
1. **First run is three screens of onboarding at once.** With no key: a "Add a key" card, a "Welcome" card (both 1px ink borders, same weight), then three inputs; the Scan button is below the fold at 870px high. Modern practice: one state, one primary action. *Fix:* a single card with a 3-step checklist whose first unchecked step is the call to action; hide the inputs until a model is set up.
2. **Panel height jumps between views.** It is bottom-anchored and content-sized, so Saved and a listing's analysis are short, This page is tall; switching tabs moves the whole panel. *Fix:* fixed height (e.g. `min(640px, 100vh - 48px)`) so only the content scrolls.
3. **Filter + Spend leave ~230px for results.** Opening both takes most of the panel, and the Spend detail carries a four-line pricing disclaimer. *Fix:* move the disclaimer to Settings; show Spend as a small popover; keep Filter inline but collapse after use.
4. **Touch/click targets under 24px** (WCAG 2.5.8): 14 distinct controls in the results view: every row action (Open, Sold, Save, Not interested: 18px high), Show/Dim/Hide (20px), Edit (23px), ☆ Save search, ✦ Ideas, the spend button. Spacing partly mitigates it. *Fix:* 24px minimum hit area via padding (visual size unchanged).
5. **Four underlined links on every row.** Six rows = 24 same-weight links, and "Not interested" often wraps alone to a second line. *Fix:* show row actions on hover/focus (as the card marks already do) or reduce to one overflow "⋯"; the title already opens the card.
6. **After an error the message is half-clipped under the tab bar and Scan is scrolled away**, so the retry is out of sight. *Fix:* scroll the status into view with margin, keep Scan in view (or sticky).
7. **The injected drawer covers the page it analyses.** Clicking a title tucks the panel to show the card. Modern extension practice for a persistent companion is the Side Panel API, which sits beside the page. *Tradeoff:* Vivaldi/Chromium forks do not all expose it, and it needs a new permission; worth a prototype, not a certain win.

**P2 — polish that makes it feel considered**
8. **Small body text.** Of ~75 text nodes in the scanned view, 37 are 12px and 8 are 11px; guidance for reading UI is 13–14px minimum for anything meant to be read (Material body-small 14, HIG 13+). *Fix:* meta 13, labels 12, nothing below 12 except the tag word.
9. **Uppercase tracked micro-labels** (BUYING TO, LISTINGS · 1, NARROW, MISSPELLING). Heavier than the content they label; current practice favours sentence-case 12px muted. 
10. **Tag word and verdict line say the same thing twice** (GREAT / Great deal). Now the same vocabulary, but still redundant. *Fix:* number-only tag, coloured verdict word beside it.
11. **Three control styles in one toolbar row** (outlined pill "Filter", bare select "Sort", segmented "Skipped"). "Skipped: Show / Dim / Hide" is ambiguous. *Fix:* one style; label it "Skips" or move to the Filter popover.
12. **Inconsistent undo/remove**: × icon (Saved), "Undo" pill (Hidden), "Start over" text, status-line Undo. Pick one pattern (toast with Undo is the modern default).
13. **Listing view**: Save / Not interested / Sold sits above the verdict instead of with it; the primary "Analyze again" stays full-width after the result is shown (should demote to secondary); "Cost under $0.01" floats alone.
14. **Skipped cards fade to 38% with greyscale**, including their sticker and any red scam chip, so the warning is the least legible thing on the card. *Fix:* fade the card image/text, keep the sticker at full contrast.
15. **Mixed icon languages**: Unicode glyphs (☆ ★ ↗ ✦ ✕ ×) beside SVG icons; glyph rendering varies by font/OS. *Fix:* one small SVG set.
16. **Settings is one 3,100px column** with ~41 muted hint paragraphs. Fine for a first read, heavy for a return visit. *Fix:* collapse "Judging", "Filters", "Backup" and provider-specific boxes behind disclosure; shorten hints to one line; keep the readiness banner (it works well).
17. Filter input shows a double focus treatment (border change + outline).

**P3 — nice to have**
18. Closed tab is a solid black pill on light sites in dark mode; a quieter edge handle would be more minimal.
19. Scan progress is text only ("Ranked 3 of 6"); a thin progress line would show it without reading.
20. Dimmed rows, hover cards and flash outlines use three different emphasis mechanisms.

## Regression caught by this audit
0.28.1's narrow-card rule (hide the long verdict label under 250px) also hid it on eBay's 200px cards. Fixed: the rule is Marketplace-only.

## Suggested order
(2) fixed height, (1) single onboarding card, (5) row actions on hover, (4) hit areas, (8) type sizes, (6) error visibility, then (10)–(14). Items 1–6 change layout and should be done with before/after screenshots from `tests/e2e/audit.ts`; (7) needs a prototype before committing.

## Done in 0.29.0
Re-measured with `tests/e2e/audit.ts` (same states, dark and light). The headless browser now reports a mouse (`--blink-settings` in `tests/e2e/run.sh`), as desktop Chrome does, so hover-only UI is captured as people see it; `lib.ts` captures beyond the viewport, so the full settings page shows.

| Measure | 0.28.1 | 0.29.0 |
|---|---|---|
| Panel controls under 24px (scanned view) | 30 | **0** (0 in every panel view) |
| Panel text under 12px (scanned view) | 12 nodes (11px, 10px) | only the tag word on page stickers |
| Text contrast failures | 0 | 0 |
| First run: cards before the inputs | 2 (key + welcome) | 1 |
| Spend detail height | ~190px, pushes results up | ~110px popover over the footer |
| Toolbar above the results | Filter · Sort · Skipped (3 styles, 2 lines) | Filter · Sort (1 line) |

- **1** One welcome card: with no model, "Add a key" is step 1 with **Open settings** as its one button; the later steps are muted; Use / Fix & flip, What I want and Scan wait for a model (Compare prices and free sold prices stay).
- **2** Fixed panel height `min(760px, 100vh - 48px)`; only the body scrolls.
- **3** Spend detail is a popover (Esc or a click elsewhere closes it) with one line pointing to settings, where the pricing note already was. *Not done:* Filter does not collapse by itself after use.
- **4** 24px hit areas via padding and negative margin; nothing looks bigger. Settings: nav links, checkboxes 18px, disclosure headers.
- **5** Row links run under the price (no more lone "Not interested" line) and show on hover or focus; a saved listing keeps "Saved". Touch screens always show them.
- **6** After an error the message and the Scan/Analyze button are both scrolled into view; other scans leave 8px above the status.
- **8, 9** 11px text raised to 12px; uppercase tracked labels are now sentence case 12px semibold muted.
- **10** Panel tags show the number only; the coloured verdict word is beside it. Page stickers keep the word (it can be hidden on narrow cards).
- **11** Skipped became "Skips and scams" inside Filter.
- **12** Saved, Searches and Hidden rows each end in one quiet text action: Remove, Remove, Unhide.
- **13** Listing view: Save / Not interested / Sold sit under the verdict; Analyze again becomes secondary and carries what the last one cost; no empty gaps.
- **14** Dim fades the card's content but not its tag or chips (the fade goes on the largest parts that hold no tag, so it never stacks).
- **15** Decorative glyphs (☆ ★ ✦ ×) replaced with words; ↗ stays for links that open a new tab.
- **16** Settings: Judging, Filters and marks and Backup fold behind disclosures with a one-line summary; jump links (and `#sec-…` addresses) open them.
- **17** Inputs show one focus ring (outline over the border).
- **18** The closed tab takes the page's colours (light on eBay's white pages).
- **19** A scan shows a 2px accent progress line under the tabs.

## Done in 0.30.0
- **3** Filter folds on Enter or Esc (Esc no longer closes the panel from inside it) and starts folded; the button carries the count ("Filter · 2").
- **20** One way to dim: in the panel as on the page, the content fades and the tag (and any "Likely scam" line) stays at full strength.
- Page stickers: the score box drops the repeated verdict word when the verdict is written beside it, so it is 36px instead of 44px and covers less of the photo; narrow Marketplace cards keep the word.
- Card hover chips say Save / Saved / Not interested without glyphs, like the panel.
- "Scan again" (nothing new to score) is a secondary button, like "Analyze again".
- A row's reserved link line doubles as its bottom padding (gap 39px → 28px under a row at rest).
- The welcome card's "No key yet?" tip only shows while there is no model.
- Settings: the spending note is two short sentences.
- `tests/e2e/ux.ts` checks these interactions (11 checks).

Still open: **7** (Side Panel prototype). Rows reserve the space of their hidden links, so the list keeps its rhythm when you point at a row; the cost is a quiet gap under each row.

# Audit 2: after porting the 0.23 branch back (0.33.1)

Same method as above (`tests/e2e/audit.ts`, 15 states in dark and light, now including Reseller mode and the Home tab), plus a functionality pass: the whole test suite, error capture on every page and the background worker, and a read-through of the ported code for real-use problems the tests don't reach.

## Measured
| Measure | 0.28.1 | 0.29.0 | 0.33.1 |
|---|---|---|---|
| Panel controls under 24px (all panel views) | 30 in the results view alone | 0 | **0** (Home included) |
| Text contrast failures (panel, cards, settings) | 0 | 0 | **0** |
| Panel text under 12px | 12 nodes | tag word only | **tag word on page stickers only** |
| Settings controls under 24px | 11 | 5 | 5, all exempt: links inside sentences, and 18px checkboxes whose labels are clickable |

The first capture after the port found one real problem, fixed before release: Home's 30-day spend chart had 30 tab stops, each 8px wide. It is now one labelled image (the numbers are in its Table view), with the per-day figures on hover.

## Fixed from this review
- With no model set up, the mode hint ("Find a good one to keep…") is hidden: it describes scoring that can't run yet, under a welcome card that already explains the modes.
- Home's empty "Worth another look" message is one sentence instead of five lines.
- Per-call cost reads "under $0.01 each" (it said "~<$0.01 each"), in the spend popover and in settings.
- Settings call the fee "Selling fees", like the panel's Reseller box, and the last "Fix & flip" wording is gone.
- The readiness banner names both models: "Ready: Sonnet 5.5, scans with Haiku 5.5".
- Home's chart had its top axis label crowding the heading, and the spending line showed model IDs ("claude-sonnet-5-5"); both fixed.
- The toolbar icon with new alerts opened Home every time, so with Home on screen the icon could no longer close the panel; a second click now tucks it away.

## Functionality
- **Tests:** 136 checks pass, 0 fail: fixture pages (keyboard and focus, settings, adapters), 27 unit tests, the saved eBay and Marketplace pages (17), the branch's behaviours on the real extension (`features.ts`), interaction checks (`ux.ts`), scores kept across tabs, and Marketplace.
- **No errors logged** by any page, the settings page or the background worker over the whole `features.ts` run, including deliberately refused sold-price lookups.
- Verified on the real extension: scans go to Haiku 5.5 with effort and without fallbacks, analysis to the main model with its fallback; a cut-off reply is counted in spend; the budget stops paid AI; each mode keeps its own settings and the old single settings migrate; switching mode keeps marks and hidden listings; Home's alerts, numbers per mode, toolbar number and openHome; restored backups rebuild bad links, drop junk and keep settings within limits; an Ollama address you haven't allowed is never contacted; a refused lookup from Facebook pauses only that route; defaults are not copied into storage.

## Not verified
Real eBay and Facebook pages (all pages here are fixtures; Facebook's is synthetic, and the grid-gap fix was checked against a page nested the way Facebook nests its cards, not Facebook itself), a screen reader, forced colours, 200% zoom, touch, the GitHub workflow (runs on the first push), and anyone using it but me.

## Open design questions
- The Buyer / Reseller bar costs about 50px on every view. A single-line control without the subtitles would halve it; the subtitles are what tell a first-time user what the modes mean.
- "Find better searches for this" is a full-width button (the branch made it one so it would be found); with Scan above it, a search page opens with two stacked buttons.
- Rows keep the space of their hidden links (a quiet 28px under each row) so nothing moves when you point at one.
- Item **7**, the Chrome Side Panel instead of the drawer, still needs a prototype.

# Performance on Marketplace (0.33.2)

Reported as "so laggy" on Marketplace. Measured with `tests/e2e/perf.ts`: a Marketplace-sized page (240 cards nested fourteen boxes deep like Facebook's, more loading as you scroll, class names changing several times a second), scored, the panel tucked away, then ten seconds of scrolling. Main-thread time, with 5,000 listings already in the seen-listings memory:

| | busy (of 10,000 ms) | style | layout | worst frame gap | cards loaded |
|---|---|---|---|---|---|
| the page alone | 350 ms | 25 ms | 24 ms | 17 ms | 408 |
| 0.28.1 | 4,260 ms | 464 ms | 2,049 ms | 1,167 ms | 312 |
| 0.33.1 | **61,875 ms** | **59,703 ms** | 667 ms | **61 seconds** | 264 |
| 0.33.2 | **1,287 ms** | 144 ms | 150 ms | 217 ms | 408 |

Opening the panel on that feed: 188 ms → 58 ms; re-sorting 143 ms → 87 ms.

What it was, worst first:
1. **The dimming rule** (0.29.0) used `:has()` to fade a skipped card without its tag. Facebook changes its markup constantly, and every change made the browser re-check that rule across the whole page: the page froze for a minute. The parts to fade are now marked once per card and the rule is a plain attribute; the hover lift that also used `:has()` is a pointer listener.
2. **Every card was re-dressed on every pass.** The page pass (whenever more listings load) removed and rebuilt every tag. A card whose facts, score and settings haven't changed is now skipped before anything is measured.
3. **Layout thrashing.** Each tag read its card's size right after the previous card's tag was written, so the browser laid out the page once per card. A batch is now measured first and written after.
4. **The grid-cell search** listed every listing link at every level for every card (it grows with the square of the feed). One query that stops at the first other listing.
5. **Hidden views drawn anyway.** The result list was redrawn after every pass with the panel tucked away, and Home re-read all of storage (the seen-listings memory included) and redrew itself on most storage changes. Both are drawn when shown; the Home tab's number comes from three small records.
6. **Saving the memory and scores** read, sorted and rewrote the whole store each time. Each tab now keeps them current from the change events, writes once, prunes only past the cap, and saves when idle (and at once when you leave or switch tabs).
7. **Smaller:** cards whose text hasn't changed aren't read again; the tag's fade-in is gone (hundreds of animations on a feed); the every-two-seconds panel refresh only writes what changed; the date formatter is made once; off-screen result rows aren't laid out (`content-visibility`) and only the first dozen fade in.

`tests/all.sh` now ends with `perf.ts` as a guard: the run fails if the feed is busy more than 5 of 10 seconds or a frame waits over a second.

# Accessibility pass and the paper-and-ink look (0.34.0)

## Accessibility (`tests/e2e/a11y.ts`)
Measured from Chrome's own accessibility tree, a real Tab walk, forced-colours emulation and a 700x450 viewport (a 1400x900 window at 200%).

| Found | Fix |
|---|---|
| The header's icon SVGs were exposed as unnamed images (a screen reader said "image" three times before each button) | Decorative SVGs are `aria-hidden` |
| The mode buttons were named "Buyerto keep and use" | A space between the name and its subtitle |
| The model menu in the footer had no focus ring | `:focus-visible` ring like the other controls |
| In Windows high contrast every tab looked selected (the system paints all borders) and the chosen mode looked like the other | Under `forced-colors`, only the chosen tab keeps its line, chosen buttons use `Highlight`, score dials become plain outlined circles |
| At 200% zoom the header, mode bar and tabs took more than half the panel | Below 620px of height the tagline and mode subtitles drop out |

Kept: the drag handle (the header) is a Tab stop, because it's also how the keyboard moves the panel (arrow keys). Nothing scrolls sideways at 200%, in the panel or settings.

## The look
Inspired by the 0.13 "paper and ink" identity: warm paper, ink, hairlines, colour only for verdicts and one vermilion accent.
- **Fraunces** is back (bundled, OFL, added with the FontFace API from bytes the background provides, so it isn't web-accessible and page font rules can't block it). It's used for what you *read*: the wordmark (*Look* in italic), the headline, scores, prices, Home's numbers, the offer, sold prices, and settings headings. What you *operate* stays in the UI face.
- **Scores are dials**: a ring that fills to the score in the verdict's colour, in the panel and on the card tags. Card tags are rounded paper pills; chips are pills too.
- **The mode switch** is a quiet track with a raised thumb and a vermilion dot, instead of an inked block; the chosen tab is underlined in vermilion.
- Softer corners (12px panels, 7px controls), a raised welcome card, and a soft edge under the tabs once the list has scrolled (a scroll-driven animation, no script).

## The redesign, past the restyle
A second pass rethought layout and hierarchy, not only the finish:

| Before | After | Why |
|---|---|---|
| Header with a tagline, a two-line Buyer/Reseller bar, then the tabs: ~160px on every view | One header row; the tabs and a small Buyer/Reseller pill switch share the second row: ~88px | The results get the height. What each mode means is already the first line of This page, and the buttons keep it for screen readers |
| Scan, then a full-width "Find better searches for this", then an underlined "Just compare sold prices · free, no AI" | Scan, then **Better searches** and **Sold prices · free** side by side, both hairline buttons | One primary action, two equal secondary ones; three different weights were competing |
| Results summary: a headline and a counts line | Headline, a **verdict bar** (one segment per verdict, as wide as its count; named for screen readers), then the counts | How good the page is, at a glance |
| List rows separated by hairlines only | The row you point at is tinted, edge to edge, with its links | Its links clearly belong to it |
| Listing page: a 46px score beside "Worth a look · 64 out of 100" | A 60px dial, the verdict in the serif | The judgment leads |
| Saved: price inside the details line, Remove always visible in its own column | The price in its own serif column; Remove in the details line, shown on hover or focus; section titles in the serif | The title gets the width; prices line up |
| Home: boxed tiles, small grey section labels | An open grid of numbers with a hairline rule; serif section titles; the chart's peak in vermilion | Less boxing; the same type scale as This page |
| Filter: inked toggles; a hairline segmented control | Segmented controls match the mode switch (a track with a raised thumb) | One control style throughout |
| Settings: the section links scroll away | They stay at the top, over a blurred band; sections land below them | Long page, quick jumps |
| Selling fees: a full-width box with a two-line hint | A small number box beside its label, one-line hint | It's a number, not a sentence |
