# Store listings (Chrome Web Store, Edge Add-ons, addons.mozilla.org)

Everything the store's forms ask for. Upload `dist/tirekick-<version>.zip` from `deno task pack`. The same text
serves Edge Add-ons (same zip) and addons.mozilla.org (`dist/tirekick-<version>-firefox.zip`; what its forms
add is under [addons.mozilla.org](#addonsmozillaorg-firefox) below); see the ROADMAP's "Edge Add-ons and addons.mozilla.org".

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
| `contextMenus` | Three entries: "Check this photo with Tirekick" on images on eBay and Facebook, "Look up “…” with Tirekick" on text the user selects (it opens the extension's own page with that text; nothing is read from the page), and "Open Tirekick in a tab" on the toolbar icon (the icon itself opens the same page as a popup off eBay and Marketplace). |
| Host: `https://www.ebay.com/*`, `https://www.facebook.com/*` | The two sites it works on: reading the listings the user is viewing, and fetching eBay sold-listing pages for price comparison, once for a search the user is looking at or when the user asks (at most eight an hour, paused at the first sign of eBay's browser check). |
| Host: `https://i.ebayimg.com/*`, `https://*.fbcdn.net/*` | Fetching a listing's photo when the user asks for a photo check, and Marketplace thumbnails already on screen (without cookies) to fingerprint them on the user's computer, for the "same photo as other listings" mark. |
| Host: `https://api.anthropic.com/*`, `https://openrouter.ai/*`, `https://api.openai.com/*`, `https://generativelanguage.googleapis.com/*`, `https://api.deepseek.com/*`, `https://api.mistral.ai/*`, `https://api.x.ai/*` | The AI services the user can choose. Sent only when the user presses Scan, Analyze, Search ideas or Check photo, or has turned on automatic scanning. |
| Host: `http://localhost:11434/*`, `http://127.0.0.1:11434/*`, `http://localhost:1234/*`, `http://127.0.0.1:1234/*` | Ollama and LM Studio, which run on the user's own computer. |
| Optional: `notifications` | Only when the user turns on **Notify me about great finds on saved searches** in settings: the browser asks then, and turning it off gives it back. A notification says a saved search the user has open turned up a great find (its title and price). Nothing is checked in the background. |
| Optional hosts: `https://*.craigslist.org/*`, `https://images.craigslist.org/*` | Only when the user turns on **Also work on Craigslist** in settings: the browser asks then, and turning it off gives the access back. Used to read the Craigslist searches and posts the user is viewing (a host per city, so the pattern covers every city) and their photos for a photo check. Nothing is fetched from Craigslist in the background. |
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

## addons.mozilla.org (Firefox)

The same listing, with what AMO's forms ask for that the Chrome Web Store doesn't. Upload
`dist/tirekick-<version>-firefox.zip` from `deno task pack` (not the Chrome zip: its manifest has no Firefox settings).
Checked before each upload: `tests/e2e/firefox.sh` passes (CI runs it), then the by-hand checks in the ROADMAP's
"Firefox: built 2026-11-02".

- **How to distribute:** On this site (listed on addons.mozilla.org).
- **Platforms:** Firefox only. Leave **Firefox for Android** unticked: phones are off the roadmap (dabloonery,
  2026-11-04), and the Marketplace and eBay apps are where phone shopping happens. (`web-ext lint` warns that Android
  would need 142 for the data question; that warning is about Android only.)
- **Source code:** No. Every file in the zip is the code as written: no build step, minifier or bundler. The only
  generated file is `manifest.json`, which `scripts/pack.mjs` writes from the folder's manifest (Firefox's background
  scripts and `browser_specific_settings` in place of Chrome's service worker); it's plain JSON.
- **Name:** Tirekick. **Add-on URL:** `tirekick` (addons.mozilla.org/firefox/addon/tirekick).
- **Summary** (250 characters at most; AMO fills it from the manifest's description, which is shorter): Beta. Good price or scam? Price checks and scam warnings for secondhand marketplaces, starting with eBay and Facebook Marketplace. The price checks and scam marks work without an AI; AI scores are optional, with your own key.
- **Description:** the Description above, as it is. AMO allows a little Markdown: the bold lines carry over.
- **Experimental:** leave unticked; the description already starts with "Beta".
- **Categories:** Shopping (the second choice, if asked: Search Tools).
- **Tags:** shopping, ebay, facebook, marketplace, price, scam
- **Support email:** support@tirekick.app. **Support website:** https://tirekick.app/support.html.
- **License:** Apache License 2.0 (the repository's `LICENSE`).
- **Privacy policy:** AMO wants the text itself: paste `store/PRIVACY.md` (or the page at
  https://tirekick.app/privacy.html).
- **Screenshots:** the captioned set from `store/screenshots/captioned/`, the same as Chrome's. They show Vivaldi; the
  panel looks the same in Firefox.
- **Icon:** AMO takes it from the zip (`icons/icon128.png`).

### Data collection (Firefox asks about it; set in the zip's manifest)

`data_collection_permissions` in `scripts/pack.mjs`: **required: none, optional: website content.** What each
answer means, so the listing and the reviewer notes say the same:

- **Website content, optional:** listing text and photos go to the AI service the person picked, only when they
  press Scan, Analyze, Search ideas or Check photo, or turned on automatic scanning. Firefox asks when the AI is
  turned on in settings (`aiConsent` in `options/options.js`); saying no leaves the AI off, turning the AI off gives
  the yes back, and without it the background refuses every AI call (`needsAI` in `background.js`). Without the AI,
  nothing from a page leaves the browser except the sold-price lookups below.
- **Not declared, and why:**
  - The person's own API key (authentication information): it's theirs, typed in by them, kept in the browser and
    sent only to the service that issued it, to use that service. Nothing reaches the developer. The Chrome Web
    Store's form does list it; AMO's "authentication information" is about logins collected by the add-on.
  - Sold-price lookups: the search words go to eBay's own sold-listings search, from the person's browser, on a
    search they're looking at or when they press a button (at most eight an hour). It's the store the add-on works
    on, answering a search, not data sent to the developer or anyone else. If the review asks for "search terms",
    it can be added as optional and asked for with **Compare prices with recent eBay sales**.
  - Marketplace thumbnails fetched from fbcdn.net without cookies to fingerprint them on the computer: the same
    picture the page already shows; nothing about the person goes with it.

### Notes to reviewer (paste into AMO)

Tirekick adds price checks and scam marks to eBay and Facebook Marketplace pages the user is looking at. All code is
in the zip as written, with no build step, no remote code and no eval.

To try it without an AI key: open an eBay search (for example https://www.ebay.com/sch/i.html?_nkw=pentax+k1000).
Cards get price tags and scam marks; the "Tirekick" tab on the right edge (or Alt+Shift+L) opens the panel. Press
"Typical price", try the filter bar, save a listing, and open the Home tab. The toolbar icon opens Tirekick's own page
elsewhere. AI scores need the user's own API key; turning the AI on in settings asks Firefox for the optional
"website content" data permission, and no AI request is made without it.

Network requests: the AI service the user configured (only on a button press, or automatic scanning the user turned
on); eBay's sold-listings search for typical prices (a few an hour at most, from the user's browser); Facebook's
image host for thumbnails already on screen (no cookies). Nothing goes to the developer: there is no server or
analytics.

innerHTML: the linter's seven notes are static markup. The panel's and toast's shadow-root stylesheets
(`content/panel.js`, built from the theme's constants), a camera icon, the panel's summary line (numbers and fixed
words), and the logo SVG in `hub/hub.js` and `options/options.js` (`TKTheme.logoMark`, numbers only). Listing text
is always set with textContent.

Optional permissions: notifications (asked when the user turns on great-find notifications); Craigslist (asked when
the user turns on Craigslist); any http/https origin (asked for one address at a time, only for a custom
OpenAI-compatible AI address the user types in).

## Before you submit

- [ ] A Chrome Web Store developer account (one-time fee)
- [ ] Host the privacy policy at a public address
- [x] Real captures for screenshots 1 to 3 (0.49.1)
- [ ] `deno task test`, then `deno task pack`; unzip the package into a folder and load it with Load unpacked to check it runs
- [ ] Reread the marketplaces' rules about automated access: the README's "Ground rules" explain what the extension does and won't do
- [ ] Clear the name: search the trademark office (USPTO) for "Tirekick" in software (classes 9 and 42) and the Chrome Web Store for extensions with the same name before publishing; `docs/renaming.md` lists what a rename touches
- [ ] Optional: an hour with an internet or IP lawyer on eBay's and Meta's terms and the sold-price lookups
