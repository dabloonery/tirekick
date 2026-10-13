# Plan: OfferUp and Craigslist

Status: a plan. Step 1 (the sites table) is done as of 0.36.1, with no change in behaviour; nothing for OfferUp or Craigslist is built. How to add a site: `docs/adding-a-site.md`. Dated 2026-10-13.

## Why

Both are where second-hand buying happens locally, and both have the problems Second Look is for: no sold prices on the page, scams, and long feeds to skim. eBay's sold listings stay the price reference for all four sites (OfferUp and Craigslist publish no sales).

## What each site is like

| | OfferUp | Craigslist |
|---|---|---|
| Pages | A React app (offerup.com/search?q=…, /item/detail/<id>); cards load as you scroll and are recycled, like Marketplace | Server-rendered per city (sfbay.craigslist.org/search/sss?query=…, /…/d/<slug>/<id>.html); the newer gallery and list layouts are built with script, the old "result-row" one still appears |
| Reading cards | By the link to /item/detail/ and the text inside it (the Marketplace approach: no class names) | `.cl-search-result` / gallery cards: title link, `.priceinfo`, location; the listing page has `#postingbody` and an attributes block (condition, make, model) |
| Price and shipping | Local pickup mostly; some "Ships" with a shipping price on the listing | Local only; prices are often round, sometimes $0 or $1 as a placeholder |
| Seller | Star rating, number of ratings, "TruYou" verified, join date, response time | None |
| What a scam looks like | Moving to text/email to pay by Zelle, Cash App or gift cards; "shipping only" for a local-looking item; brand-new account with no ratings | "I'm away, I'll ship it", payment before seeing it, fake escrow or overpayment, email relays. Phone numbers and "text me" are normal here, not a sign |

## How it would fit

1. **One table of sites** (a refactor first, eBay and Marketplace only, no change in behaviour, the tests stay green). Today "ebay" and "facebook" are written into many places: listing keys (`ebay:`, `fb:`), item and search addresses, site names, saved searches, the per-search wants and filters, "Try on Marketplace", photo hosts, the page-script registration. A `SITES` table would hold, per site: hosts, how to tell a search from a listing, the card reader, the search word, search and item addresses, the key prefix (`ou:`, `cl:`), what it has (shipping, seller ratings, offers, auctions) and its scam rules.
2. **Opt in, per site, in settings** ("Also work on: OfferUp, Craigslist"). The sites are optional host permissions asked for when you tick one, and the page scripts are registered for them then. Adding them as required permissions would make Chrome disable the extension on update until every user accepts a new warning.
3. **Scam rules per site.** Off-site contact is a strong sign on Marketplace and OfferUp, normal on Craigslist; Craigslist gets the "away, will ship" and pay-first patterns instead. Reposts under new codes and duplicate photos apply everywhere.
4. **Prices.** The sold reference from eBay, as now. A local price is compared with what eBay buyers paid including shipping, which is the fair comparison for someone who could buy either. Reseller margins work the same (buy local, sell on eBay, shipping out comes off). Placeholder prices ($0, $1, $1234) are treated as no price.
5. **Seller warnings.** OfferUp's ratings feed the existing rule (at least N ratings, X% positive, as stars); Craigslist has none, so the rule doesn't apply there.
6. **Everywhere else in the product.** Saved listings and searches, alerts and Home mark the site; the hub's lookup searches all four (Craigslist needs your area: remember the last one you visited, or use craigslist.org's own redirect); "Try on Marketplace" becomes "Also on: eBay · Marketplace · OfferUp · Craigslist".
7. **Distance** (both show it): a filter, "within N miles", would be new and is worth asking for.

## Order

1. ~~The sites table, eBay and Marketplace only.~~ Done: `lib/sites.js`, the per-site maps in `content/adapters.js`, and `tests/unit/sites.test.mjs`.
2. Craigslist (stable markup, simplest cards), with fixtures for the gallery, list and old layouts and a listing page.
3. OfferUp (an app like Marketplace: recycled cards, late-loading prices), with fixtures and a long-feed performance check like `perf.ts`.
4. The hub, saved searches and "Also on" across all four; README, privacy policy and store listing (the new optional permissions and why).

## Risks and questions

- Both sites' terms limit automated collection. Second Look would read only pages you are looking at, never fetch from these sites in the background: the same line it holds on eBay and Facebook.
- OfferUp may show less without signing in, and changes its app often; Craigslist's script-built layouts vary by city and device.
- Photo checks need their image hosts (images.craigslist.org, OfferUp's CDN) added to the allowed photo hosts.
- Questions for you: which first; which Craigslist areas you use; whether distance matters enough to filter on.
