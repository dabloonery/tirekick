# Chrome Web Store listing

Everything the store's forms ask for. Upload `dist/tirekick-<version>.zip` from `deno task pack`.

## Basics

- **Name:** Tirekick
- **Summary** (132 characters at most; this is the manifest's description, checked by `deno task pack`):
  Beta. Good price or scam? Price checks and scam warnings for secondhand marketplaces, starting with eBay and Facebook Marketplace.
- **Category:** Shopping
- **Language:** English
- **Privacy policy URL:** https://tirekick.app/privacy.html (the site's copy of `store/PRIVACY.md`; `site/privacy.html` here and the tirekick-site repo)
- **Homepage URL:** https://tirekick.app (set in the manifest)
- **Support contact:** support@tirekick.app (public; works once the tirekick.app mailbox is set up)

## Description

Don't list AI services by name here: the store rejected 0.50.0 for keyword spam over that list (2026-10-16). The site and README can name them.

**Beta:** Tirekick is new and still improving. If something looks wrong on a page, or a store changes and Tirekick stops reading it, write to support@tirekick.app.

**Kick the tires before you buy.** Is it a good price? Is it a scam?

Tirekick looks over listings with you on secondhand marketplaces, where you already shop. It works on eBay and Facebook Marketplace today, with more stores to come. Every listing gets a small score dot, prices are checked against what similar items recently sold for, common scam patterns are pointed out, and it remembers what you've already seen.

Tirekick has optional AI features. The checks below work without them; turn on an AI only if you want scores and write-ups.

**Works without the AI, no account needed**
• Scam marks: the same listing reposted under new codes, a code tacked onto the title, and "message me off the site" tricks
• How far below or above the typical price each card is ("$53 below typical", from recent eBay sales) once sold prices are in, plus price drops, "new to you" and auctions ending soon
• Filter a search the way eBay does (dmg -case -game), by price, or to just the broken ones
• Save listings and searches; the Home tab shows what got cheaper
• From any page: select a thing's name, right-click, "Look up": what it has sold for on eBay, and a search on eBay, Marketplace or both
• Dock the panel left or right in three widths; Buyer and Reseller modes, each with its own tools

**Optional: add an AI you choose** (with your own API key from a major AI service, or a model running on your own computer)
• A score and verdict for every listing, one line on the price, and the reasons on hover
• Analyze one listing: red flags, a fair offer and a ready-to-send message, plus a photo check
• Selling things on? Reseller mode adds the likely fault, how hard it is to fix, parts, and the price gap after eBay fees
• Search ideas: the misspellings sellers make, other model names, tighter or looser words
• Optional: scan new listings automatically as a search page you're looking at loads them, up to your monthly budget

**It only looks when you do.** Tirekick works on the page in front of you, when you ask (or, if you turn on automatic scanning, as the search you're looking at loads). Nothing browses or checks prices in the background. Everything it keeps stays in your browser, and the only things sent anywhere go to the AI service you picked and to eBay's own sold-listings search, because you pressed a button. Bring your own API key: a scan of 50 listings with a small model usually costs less than a cent.

Scores, prices, price gaps and warnings are estimates to help you decide, not advice or a guarantee: a model can be wrong and sold prices are approximate, so check the listing and the seller yourself.

Not affiliated with or endorsed by eBay or Meta. eBay and Facebook are trademarks of their owners.

## Single purpose

Help people buying secondhand online judge the listings they are viewing on supported marketplaces (currently eBay and Facebook Marketplace): scoring them, comparing prices with recent sales, and warning about likely scams.

## Permission justifications

| Permission | Why |
|---|---|
| `storage` | Keeps the user's settings, saved and hidden listings, the memory of what they've seen, and cached scores, all in this browser. |
| `unlimitedStorage` | Lifts the 10 MB limit on that same local storage, so a few months of kept scores and seen listings can't fill it and make saving a listing fail. Nothing more is stored and nothing leaves the browser; old entries are still pruned. |
| `scripting` | Registers the page script that draws the score tags and the panel on eBay and Facebook pages (and injects it on demand when the "slim tab" setting is off), and reads eBay sold-price results from an open eBay tab when the user is on Facebook. |
| `contextMenus` | Three entries: "Check this photo with Tirekick" on images on eBay and Facebook, "Look up “…” on eBay and Marketplace" on text the user selects (it opens the extension's own page with that text; nothing is read from the page), and "Open Tirekick in a tab" on the toolbar icon (the icon itself opens the same page as a popup off eBay and Marketplace). |
| Host: `https://www.ebay.com/*`, `https://www.facebook.com/*` | The two sites it works on: reading the listings the user is viewing, and fetching eBay sold-listing pages for price comparison, once for a search the user is looking at or when the user asks (at most eight an hour, paused at the first sign of eBay's browser check). |
| Host: `https://i.ebayimg.com/*`, `https://*.fbcdn.net/*` | Fetching a listing's photo when the user asks for a photo check, and Marketplace thumbnails already on screen (without cookies) to fingerprint them on the user's computer, for the "same photo as other listings" mark. |
| Host: `https://api.anthropic.com/*`, `https://openrouter.ai/*`, `https://api.openai.com/*`, `https://generativelanguage.googleapis.com/*`, `https://api.deepseek.com/*`, `https://api.mistral.ai/*`, `https://api.x.ai/*` | The AI services the user can choose. Sent only when the user presses Scan, Analyze, Search ideas or Check photo, or has turned on automatic scanning. |
| Host: `http://localhost:11434/*`, `http://127.0.0.1:11434/*`, `http://localhost:1234/*`, `http://127.0.0.1:1234/*` | Ollama and LM Studio, which run on the user's own computer. |
| Optional hosts: `https://*/*`, `http://*/*` | Only for "another OpenAI-style address". The extension asks the user for permission to one specific address when they press **Test connection** for it; it cannot reach any address the user hasn't approved. |

**Remote code:** none. All code ships in the package; the extension loads no scripts from anywhere and uses no `eval`.

## Privacy practices tab

- **Data collected:** *Website content* (listing titles, card text and photos, sent to the AI service the user chose, only when the user asks) and *Authentication information* (the user's own API key, stored locally and sent only to the service it belongs to).
- **Not collected:** personally identifiable information, health, financial or payment information, location, web history, user activity (the feature counters never leave the browser), personal communications.
- **Certify:** not sold to third parties; not used or transferred for purposes unrelated to the single purpose; not used to determine creditworthiness or for lending.

## Screenshots (1280 × 800, in `store/screenshots/`)

1 to 3 are real captures in Vivaldi (cropped, with the account name, profile picture, ZIP code, town and seller
names removed; in 2 the panel's verdict header comes from a capture a moment earlier of the same analysis, so it
reads from the top). 4 and 5 are the real extension's panel, drawn by `tests/e2e/run.sh screenshots.ts` and placed
over the eBay page from 1. `store/screenshots/captioned/` has the same five under a one-line caption, and
`store/promo-small.png` (440 × 280) and `store/promo-marquee.png` (1400 × 560) are the promo tiles: all drawn from
`store/art.html` by `scripts/store-art.sh`. Upload the captioned set (dabloonery's pick, 2026-10-16).

1. `1-ebay-search.png`: an eBay search after a scan, with tags on the cards and the panel's best picks.
2. `2-ebay-listing.png`: one eBay listing analyzed: the AI's read, its notes and a suggested offer.
3. `3-marketplace.png`: a Marketplace search after a scan.
4. `4-home.png`: the Home tab: price drops on saved listings and saved searches.
5. `5-saved.png`: the Saved view.

## Notes for the reviewer

Scores and analysis need an API key, which the reviewer is not expected to have. Without one, everything else works: open an eBay search, open the panel (the "Tirekick" tab at the right edge, or Alt+Shift+L), press "Typical price", try the filter bar, save a listing, and open the Home tab. Select any text on another site and right-click "Look up" for the extension's own page.

## Before you submit

- [ ] A Chrome Web Store developer account (one-time fee)
- [ ] Host the privacy policy at a public address
- [x] Real captures for screenshots 1 to 3 (0.49.1)
- [ ] `deno task test`, then `deno task pack`; unzip the package into a folder and load it with Load unpacked to check it runs
- [ ] Reread the marketplaces' rules about automated access: the README's "Ground rules" explain what the extension does and won't do
- [ ] Clear the name: search the trademark office (USPTO) for "Tirekick" in software (classes 9 and 42) and the Chrome Web Store for extensions with the same name before publishing; `docs/renaming.md` lists what a rename touches
- [ ] Optional: an hour with an internet or IP lawyer on eBay's and Meta's terms and the sold-price lookups
