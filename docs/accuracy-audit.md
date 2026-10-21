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

Still open: games and other different items that read like the thing itself ("Mario Kart 8 Nintendo Switch" in a console search) are caught only once a scan marks them unrelated.

## Spending estimates

Checked against current published prices (per million tokens, input/output): Opus 5.5 $4/$20, Sonnet 5.5 $2/$10, Haiku 5.5 $0.10/$0.50 under 100K-token prompts (a scan batch is far smaller). These match. Cache reads are counted at 0.1× input; Opus 5.5 and Sonnet 5.5 now charge 0.05×, so estimates run slightly high on cached prompts, never low. Every figure is labeled an estimate; the real balance is at console.anthropic.com.

## Sources

- Claude API prices: [Finout](https://www.finout.io/blog/anthropic-api-pricing), [eesel.ai on Haiku 5.5](https://www.eesel.ai/blog/claude-haiku-5-5-pricing), [VentureBeat on Haiku 5.5](https://venturebeat.com/technology/anthropic-launches-claude-haiku-5-5-with-90-api-price-reduction-matching-gpt-6-luna) (third-party; confirm on Anthropic's pricing page).
- eBay fees: [flowlister: final value fees explained](https://flowlister.com/blog/ebay-final-value-fees-explained/), [size.ly fee calculator](https://www.size.ly/tools/ebay-fee-calculator) (third-party; confirm in eBay Seller Center).
