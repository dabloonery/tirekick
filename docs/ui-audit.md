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
