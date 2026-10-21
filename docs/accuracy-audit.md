# Accuracy audit: prices, margins and scores

Dated 2026-10-13, version 0.36.0. What each number in Tirekick is made from, what was wrong or loose, what changed, and what is still an approximation (and how the extension says so). Checks are in `tests/e2e/features.ts` against a mock eBay that returns a realistic, noisy sold page.

## Sold prices (the reference for "% of sold", margins, bid limits, the hub's lookup)

Made from: eBay's sold-listings search for the words, used condition (any condition if too few), up to 60 results; the median of what buyers paid (price + shipping when the card shows it).

| Problem | Effect | Now |
|---|---|---|
| "Best offer accepted" sales show the asking price, not what was paid | The median ran high, so listings looked cheaper than they are | Left out |
| Lots and bundles | A bundle's price counted as one item's | Left out |
| Sellers list broken ones as "used" | "For parts", "not working", "as is" sales pulled a working price down | Left out of the working price (kept for the for-parts price) |
| eBay's loose matching | A search for "pentax k1000" can return other Pentax bodies or a strap | A model number in the search ("k1000", "ps2", "ags-001") must be in the title |
| Far-off prices | One museum-grade boxed kit or a lone box moved the median | Left out beyond Tukey's fences on log prices, never nearer than 2.5× the median |
| eBay's default order is "best match" | Older sales mixed in | Most recently ended first |
| No sense of how reliable it is | 5 sales with a 3× spread looked as solid as 40 tight ones | A confidence: **good** (15+ sales, middle half within 2×), **fair** (8+, within 3×), **rough** otherwise. Rough shows as "~$58" and "a rough guide", "~64% of sold", "(est.)" on a margin, a line in the hover card; the model is told to treat it as rough |
| Cached answers from before these changes | Would have kept the old numbers for six hours | The cache key is versioned |

What's left out is listed where the number is shown (the panel's price box on hover, the hub under the price).

Still approximate, and said so: the words match titles, not identical items, so a kit or a variant can still count ("Check a few", and the sales closest to the median are one click away). International listings priced in another currency with a "$" (C $, AU $) are read as US dollars; eBay.com usually shows US prices.

## Margins (Reseller)

Made from: the working sold median, less eBay's fee (13.6% + $0.40, the "most categories" rate; the panel and settings have the box), less parts the model expects, less the listing's total.

| Problem | Effect | Now |
|---|---|---|
| Sold totals include the shipping the buyer paid, but you then pay to send it on | Every margin was too high by the shipping, often $8–15 | The median shipping buyers paid on those sales comes off. When too few paid shipping to tell, the hover card says "shipping not known: take it off" |
| The formula wasn't shown | "≈ $16 margin" with no way to see what it assumed | The hover card spells it out: resold at $X, less fees, shipping, parts and the price; before sales tax and your time |

Checked against current sources: eBay's most-categories fee is 13.6% of the total plus $0.40 per order over $10 ($0.30 at $10 or less). eBay also charges that 13.6% on sales tax it collects, which isn't in the margin (about 1% of the price at a 7% tax rate): margins run that much high. Store subscribers and some categories pay different rates; the fee box is there for that.

## Scores and verdicts

Made from: the model (Haiku 5.5 for scans by default), given each card's title, price, shipping, card text, the sold reference and its confidence, what you want, the mode's rules and scam signals. It returns a 0–100 score and a verdict.

| Problem | Effect | Now |
|---|---|---|
| Score and verdict came separately and nothing tied them | A "Great deal" could show 55, a "Fair price" 60: the ring and the word disagreed | Each verdict has a range (great 75–100, good 60–74, fair 45–59, pass 0–44, suspicious 0–30). The model is told to pick the verdict first and a score inside it, and the panel moves any score that strays into the verdict's range |
| It wasn't said what a scan looks at | A score could be read as a full inspection | The hover card says a scan's score is from the card's title, price and text, not the photos or the description; an analysis says it's from the listing's page |

Still a judgment: scores are a model's reading of a card, not an inspection. Photo checks and Analyze go further on one listing. A remembered score (60 days) comes back only at the same price; it doesn't move when the market does, and the hover card dates it.

## Scam checks and price verdicts (2026-10-21, from 0.51.0)

A second pass, on false alarms and misses in the free checks and on where the scan and the free read disagree. No labeled listings exist, so each change is checked against hand-made titles in `tests/unit/rules.test.mjs` and the e2e fixtures, and says how it moves real listings.

| Problem | Effect on real listings | Now |
|---|---|---|
| Every card on a results page is compared with the search's typical price, accessories too | In a "nintendo switch" search a $15 case is 7% of a $200 console: a red "Likely scam? Typical is $200", and a "Great price, if it's real" even after a scan said it's not what you searched for | `TKRules.accessoryOf`: a card that reads as an accessory or part for the search ("Case for …", "… Carrying Case", "box only", "replacement shell") says "No price check" and can still be priced from its own title; "with case", "+ 2 controllers" and words in the search itself don't count. `tooCheap` and `priceVerdict` skip accessories and anything a scan marked as not your search (0.51.0) |
| A code on the end of a Marketplace title was a red "Likely scam" on its own, before any scan | Model numbers have the same shape: 17 of 19 ordinary titles tried ("ThinkPad T480", "Bose QC35", "Weber Spirit E310", "DeWalt DCD771C2") read as a code, so many honest pickup listings started out marked as scams | A lone code is "Check first" (and never "At your price"). It's "Likely scam" when something backs it up (`TKRules.codeBacked`): a price under the typical one, the same photo on other listings, or a seller warning such as an account made this year. The same title reposted under another code stays a sure scam, and a scan still clears a real model number (0.52.0) |
| The scan judged price with no lines of its own | A scan could call a listing at 75% of typical "fair" while its card said "Good price", and it wasn't told about a bait price, a seller warning, or what to do with off-site contact (only Analyze had that rule) | The scan and Analyze prompts get the cards' price lines (60% or less great, 80% good, 105% fair, under 55% too cheap for a working one), the off-site rule, and two more SCAM SIGNAL lines: "the total is N% of the typical price" and the seller warning (0.53.0) |
| Marketplace pickup prices were compared with eBay totals, which include the shipping buyers paid | A $40 pickup price read as 77% of a $52 total that was $40 plus $12 to post: "Good price" when it was about typical, and the "too cheap" cutoffs fired early on cheap items, where shipping is a big share | `TKRules.forPickup`: on a local site, a listing with no shipping is compared with the typical price less the typical shipping on those sales (only when the sales say what it was and it's under half the price). The chip's hover says so, the offer plan uses it, and the scan is told; margins still use the full total, since you'd post it on (0.54.0) |

Still open: games and other different items that read like the thing itself ("Mario Kart 8 Nintendo Switch" in a console search) are caught only once a scan marks them unrelated. *Mostly closed in 0.57.0, below.*

## What the tags say against what the checks did (2026-10-21, 0.55.0)

A search run end to end the way a buyer meets it (`tests/e2e/real.ts`: "nintendo switch oled", typical about $252, fourteen cards of what really turns up, and a model that makes the usual mistakes), reading every card and row as shown.

| Problem | Effect on real listings | Now |
|---|---|---|
| When the price check overruled a scan, the word changed and the number didn't | A bait listing the model called great read "91 Scam? Great price, if it's real" and, sorted by score, headed the list; a sealed one at 131% of typical read "82 Fair price" | The number moves into the new word's range, as it already did for the model's own answers (30 and 59 here), so the list sorts by what it shows. The hover card and the row say why ("$89 is 35% of the typical $252…", "Held at Fair price: $329 is 131%…") and what the scan said. Analyze does the same |
| A sure scam still got the price praise | "Scam: off-site contact" beside a green "Great price $102 below typical" | Likely scams, broken ones and what a scan called something else show the dollar gap only, no "Great price" |
| After a scan said a listing wasn't the search, its "too cheap" mark stayed | A game in a console search read "Worth a look (not your search)" beside "Likely scam? Typical is $252" | The scan's "not your search" reaches the free checks, so the mark goes |
| A title without one of the search's words was "Likely scam" on price alone | "Mario Kart 8 Deluxe - Nintendo Switch" in a "switch oled" search: red Likely scam before any scan | `TKRules.missingWord`: such a title is at most "Too cheap?" (Check first). Bait copies the search's words, so scams keep the red mark |
| A bundle written with "+" read as an accessory | "Switch OLED white + 3 games + case" got "No price check", so it also escaped the too-cheap check | "+" and "&" read as "with" in `accessoryOf` |
| The page line counted scams its own way | "1 possible scam, 1 to be careful with" above cards showing two Likely scam marks and three Check first; after a scan "6 worth a look" counted a game the scan had set aside | The line counts each listing the way its tag reads (shown verdict after a scan, free read before) |
| A for-parts listing's "too cheap" was worked out before it was known to be for parts | Could back a title code into "Likely scam" on Marketplace | The order is fixed |

A UI/UX pass on the same search followed (0.56.0), on how the scam checks, scores and price checks read on the cards:

| Problem | Effect | Now |
|---|---|---|
| Before a scan, a warning chip ("Likely scam? Typical is $252", "Scam: off-site contact", "Code in title") said why only in a browser tooltip, and some said nothing | The most important mark on the card had no visible reason; on Marketplace, where tooltips are slow and touch has none, it read as a bare accusation | Hovering or tabbing to the card shows a small box with each warning's reason: the bait percentage, what the contact asks ("WhatsApp, text me"), the code and what would make it likely, the seller rule, the repost's other codes |
| A broken one's chip said "$147 below typical" | Read as a bargain on the same thing, when the typical price is for working ones | "$147 below working ones" on the card, "the typical price of a working one" in the panel |
| The price chip's bold word and its number wrapped as two columns ("Fair / price", "$13 below / typical") | Hard to read on narrow cards | The chip wraps as one line of text, the word kept whole |
| A "Great price, if it's real" tag also carried the "Likely scam? Typical is $252" chip | The same warning twice, and the tag's own price line cut off | The chip is left off where the tag's label already says it; the hover card has the numbers |

## Games in a console search (2026-10-21, 0.57.0)

| Problem | Effect on real listings | Now |
|---|---|---|
| A game whose title has every word of the search read as the console at a bait price | In a "nintendo switch" search, "Mario Kart 8 Deluxe - Nintendo Switch" at $38 was a red "Likely scam? Typical is $250" before any scan, and a scan was the only way to clear it | `TKRules.madeFor`, part of `accessoryOf`: a title that names something first and the search (or its console) only after a dash, a bracket or "for" ("Zelda: Breath of the Wild (Nintendo Switch, 2017)", "Spider-Man 2 - PS5", "Minecraft for Nintendo Switch") gets "No price check", as accessories do. For a console search, two or more naming words before the console at the end count too ("Animal Crossing New Horizons Nintendo Switch"). Game words ("video game", "game cartridge", "disc only") count anywhere |
| | | What stays priced: the search named first ("Nintendo Switch console - fast shipping", the way bait is written), one word before a dash ("Apple - iPhone 13"), filler or colors ("Brand New - Nintendo Switch OLED", "Neon - Nintendo Switch"), a tail that says more than the search ("Unlocked - Apple iPhone 13 128GB", "(PS5) Disc Edition"), and, outside consoles, any title that just ends with the search ("Vintage Film Camera Pentax K1000"). 11 game titles and 21 console and other titles are in `tests/unit/rules.test.mjs` |

Still missed: a one-word game before a dash ("Zelda - Nintendo Switch") and colors in a game's name ("Pokemon Red - Game Boy"); a scan still sets those aside.

## An accuracy eval for the free checks (2026-10-21)

Until now each rule was checked on its own, against hand-made titles. Nothing said how the checks did together on a page of real-looking listings, or whether a change made them better or worse overall. `tests/eval/` does that: 68 listings written from the shapes real eBay and Marketplace listings take (8 searches; scams of every kind the checks know: bait prices, new sellers, title codes, reposts, off-site contact, a seller account made this year; and honest listings that look like them: model numbers, games, parts, broken ones, lots, auctions, quick sales), each labeled with what it really is. They go through the same functions the panel runs (`TKRules.compareFacts`, shared with the panel since this change, then `freeRead`, and `priceVerdict` over a scripted scan). `deno task eval` prints the scorecard; `tests/unit/eval.test.mjs` fails if it gets worse.

First run, with the rules as they are in 0.57.0:

| | |
|---|---|
| Scams with a warning before any scan | 17 of 17 (11 Likely scam, 6 Check first) |
| Honest listings marked Likely scam | 1 of 51: "Pokemon Scarlet Nintendo Switch OLED Game Brand New Sealed" at $42 (a game with no dash or bracket) |
| Honest listings marked Check first | 5: "Switch OLED dock and charger" (parts read as a console), "DeWalt 20V Max Drill DCD771C2" (the searched model number read as a code), a Pentax K1000 that "needs light seals" and a Switch "missing Joy-Cons" (cheap for a reason), and a new seller at a normal price (which is what Check first is for) |
| Price word as labeled | 47 of 51 |
| Verdict after a scan as labeled | 18 of 18 |

What it can't say: the labels are judgments on made-up listings, not real outcomes, and the model isn't run (its answers are scripted). It measures the rules, not the scan.

Fixes from that first run (same day):

| Problem | Effect on real listings | Now |
|---|---|---|
| "Game" in a console search didn't count as a game without a dash or bracket | "Pokemon Scarlet Nintendo Switch OLED Game Brand New Sealed" at $42 read as a console at 17%: red Likely scam | In a console search, "game" anywhere makes it a game (`accessoryOf`), unless it's the machine ("handheld game console") or comes with it ("console with game") |
| Two parts joined by "and" read as a console and what comes with it | "Switch OLED dock and charger" at $40: Check first, too cheap for a console | "dock and charger" are both the listing |
| A model number searched for read as a scammer's code | On Marketplace, every "DeWalt 20V Max Drill DCD771C2" in a "dewalt dcd771" search wore "Code in title" and Check first | `TKRules.codeInSearch`: a code the search has (or starts with) is cleared before any scan |
| A bait price and a seller warning were each only Check first | eBay's "Nintendo Switch OLED, $109.99" from a seller with 0 ratings, 44% of typical, read Check first, not Likely scam; so did a $100 one on Marketplace from an account made this year | Under 55% of typical from a seller with a warning is Likely scam (`tooCheap` says "far", and why), unless the title says what's missing ("missing Joy-Cons", "body only"). Honest new sellers in the eval price near the typical price, and stay at Check first |
| Off-site contact in a Marketplace card's title was only read once the listing was opened | "PS5 console and 4 games, text 505_507__6507" looked like an ordinary cheap listing in the results | Marketplace card titles are checked, as eBay's are |

After: scams marked Likely scam 15 of 17 (was 11), honest ones marked Likely scam 0 (was 1), honest ones marked Check first 3 (was 5), price words as labeled 48 of 51 (was 47). Left: the Pentax that needs light seals and the Switch missing Joy-Cons (cheap for a reason, Check first is fair) and the new seller at a normal price.

## Spending estimates

Checked against current published prices (per million tokens, input/output): Opus 5.5 $4/$20, Sonnet 5.5 $2/$10, Haiku 5.5 $0.10/$0.50 under 100K-token prompts (a scan batch is far smaller). These match. Cache reads are counted at 0.1× input; Opus 5.5 and Sonnet 5.5 now charge 0.05×, so estimates run slightly high on cached prompts, never low. Every figure is labeled an estimate; the real balance is at console.anthropic.com.

## Sources

- Claude API prices: [Finout](https://www.finout.io/blog/anthropic-api-pricing), [eesel.ai on Haiku 5.5](https://www.eesel.ai/blog/claude-haiku-5-5-pricing), [VentureBeat on Haiku 5.5](https://venturebeat.com/technology/anthropic-launches-claude-haiku-5-5-with-90-api-price-reduction-matching-gpt-6-luna) (third-party; confirm on Anthropic's pricing page).
- eBay fees: [flowlister: final value fees explained](https://flowlister.com/blog/ebay-final-value-fees-explained/), [size.ly fee calculator](https://www.size.ly/tools/ebay-fee-calculator) (third-party; confirm in eBay Seller Center).
