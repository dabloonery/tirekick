# Adding a site

How to add a marketplace (OfferUp and Craigslist are planned: Brief 5 in `docs/ROADMAP.md`). Everything
site-specific is in one table and a few per-site maps, so a new site is an entry in each, not edits
scattered through the panel. `tests/unit/sites.test.mjs` fails until every piece is there.

Before you start, read the README's **Ground rules**: only pages the user is looking at, no fetching from
the new site in the background, never get past a bot check.

## 1. The table: `lib/sites.js`

Add an entry to `SITES`. Every field is documented in the `Site` typedef at the top; the ones that matter most:

| Field | What to put |
|---|---|
| `id`, `key` | `id` is stored with saved searches and listing facts; `key` prefixes listing keys (`ou:123`). Both new and unique |
| `name`, `owner` | What people read ("OfferUp"), and who runs it (for "outside OfferUp" and the not-affiliated line) |
| `hosts`, `matches` | Exact host names, and URL patterns for the page scripts and menus |
| `isHere`, `pageType`, `queryOf` | Is this page ours; is it a search (`results`), a listing (`item`), a front page (`home`) or `other`; the search words in its address |
| `itemId`, `itemUrl`, `searchUrl`, `isSearchUrl`, `home` | The listing id in a link, and back; a search address for words; what may be opened as a saved search |
| `imageHosts` | Where its listing photos live (photo checks fetch only from these) |
| `local` | Mostly local pickup (no shipping on cards; offers say "I can pick up") |
| `cards` | How its result cards behave: which corner the tag sits in, whether a card is a link nested deep in boxes, whether to size the tag to the photo, when to use the compact tag, whether cards overlap or are recycled as you scroll |
| `titleCodes` | Whether bulk scams on this site end titles with a random code |
| `soldReference` | `false`: eBay's sold listings stay the price reference |
| `setting`, `photoOrigins` | A store added after release is opt in: the setting that turns it on (add it to `DEFAULTS` in `background.js`, `FIELDS` and a switch in settings), and its photo hosts as permission patterns. Settings asks for `TKSites.originsOf(site)` in the click; the background registers the page scripts there only while the setting is on and the access is granted (`sitesInUse`) |
| `isHost` | For a store with a host per city (`sfbay.craigslist.org`): which hosts are its own, for links and backups |

## 2. Reading its pages: `content/adapters.js`

Add the site's function to each per-site map (they are next to each other and say what they're for):

- `TK.READERS[id](root)`: the result cards, as listings in the shared shape (see the top of the file: `{ site, title, priceText, price, shipping, total, url, imageUrl, raw, el, ... }`). Prefer reading links and visible text over class names; sites rename classes without notice.
- `TK.ITEM_READERS[id]()`: one listing's page (title, price, shipping, condition, seller, details, photos).
- `TK.LISTING_LINKS[id]`: a selector for the links to listings in the results.
- `TK.CARD_FINDERS[id](key, itemId)`: a listing's card on the page, from its key.
- `TK.SEARCH_BUILDERS[id]({ query, maxPrice, newest })`: the address for a suggested search.
- `TK.BROWSE_CONTEXT[id]()`: in words, what a page with no search is ("OfferUp home feed").

## 3. Its rules

- Scam signs differ: off-site contact is a strong sign on Marketplace, normal on Craigslist. Site-specific rules belong with the scam rules in `content/rules.js` and the `SCAM_RULE` prompt in `background.js`, keyed by the listing's `site`.
- Seller ratings: if the site has them, read them into `sellerPct` / `sellerCount` so the seller rule applies; if not, leave them out and the rule doesn't apply.

## 4. Permissions

- Add the site's `matches` and image hosts to `manifest.json`. Craigslist is the worked example of an opt-in site. For a site added after release, put them under `optional_host_permissions` and ask for them when the person turns the site on in settings: new required hosts make Chrome disable the extension on update until each user accepts a new warning.
- The page scripts are registered for `TKSites.matches()`, so they follow the table. With an optional site, register only once its permission is granted.

## 5. Tests and fixtures

- A results page and a listing page under `tests/fixtures/` (real markup, trimmed; no real names or photos), and the host mapped to the mock server in `tests/e2e/run.sh` (`--host-resolver-rules`) and served in `tests/e2e/server.ts`.
- An adapter test like the eBay and Marketplace ones in `tests/e2e/adapters.ts`, a page test like `tests/e2e/marketplace.ts`, and a long-feed run of `tests/e2e/perf.ts` if its pages scroll forever.
- `deno test --allow-read tests/unit/` checks the table and every per-site map.

## 6. Everywhere it shows

Saved, Home, the hub's search buttons and "Try on …" read the table already. Update the README, `store/PRIVACY.md` (what is read on the new site), `store/LISTING.md` (the permission and why) and `docs/ux-spec.md`.
