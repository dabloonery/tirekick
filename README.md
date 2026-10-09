# Second Look

A browser extension for buying second-hand on eBay and Facebook Marketplace. It puts a small
score tag on every listing you're looking at, compares prices with what the same thing actually
sold for, flags likely scams, and remembers what you've already seen. A language model (the
Claude API, or Ollama on your own computer) does the judging; a lot of the useful parts don't
need a model at all.

It only works on pages you're looking at, when you ask. Nothing browses or checks prices in the
background.

## Quick start (Claude API, about 5 minutes)

1. In Vivaldi/Chrome open `vivaldi://extensions` (or `chrome://extensions`), turn on
   Developer mode, click **Load unpacked**, and pick this folder. The settings page opens.
2. Paste a Claude API key (from console.anthropic.com). Settings save as you go.
3. Search eBay or Facebook Marketplace. Pull out the slim **Second Look** tab on the right edge
   (or press **Alt+Shift+L**) and press **Scan this page**.

Every listing gets a tag: a score out of 100, a verdict (Great deal, Worth a look, Market price,
Skip, Suspicious) and one line on the price. Hover it for the reasons. Scroll for more and the
button becomes "Scan N new listings"; only the new ones are scored.

## Scams

The most common Marketplace scam is one fake listing posted many times, each copy with a random
code on the end of the title: "Nintendo Game Boy Advance SP M2465", "Halo Special Edition Xbox
S1337". Second Look watches for it:

- **Reposted under new codes**: the same title seen with two different codes, on one page or any
  page in the last month, is marked "Scam: reposted under new codes" and greyed out straight away,
  with no model and no key needed. A scan marks these Suspicious without sending them to the model.
- **Code in title**: a lone code gets a chip and is spelled out for the model, which marks it
  Suspicious unless the code is the item's real model number (Pentax K1000, PS Vita PCH1001); the
  chip goes away when it is.
- **Contact off the site**: on a listing, a disguised web address ("www . jmyzl . com", "remove the
  spaces"), an oddly written phone number ("505_507__6507"), "text me a screenshot", WhatsApp or
  Telegram shows a "Likely scam" note, and the analysis is Suspicious whatever the model thought.
  A plain phone number ("call or text") is only a hint.

Suspicious listings are greyed out along with skipped ones (Show / Dim / Hide above the results).

## Everyday use

- **Use / Fix / Flip** at the top of the panel says what you want a listing for (see below).
- **What I want**: "working, with charger, under $80". Every scan, analysis and search idea
  takes it into account, and a listing that misses something says so. Change it (or the compare
  words) after a scan and the button becomes **Rescan with your changes**.
- **Click a title** in the panel to jump to that card. If the panel would cover it, it tucks
  away and the card flashes.
- **Sort** the list by best (what you searched for first), cheapest, furthest under the sold
  price, auctions ending soonest, biggest margin, or new and cheaper first.
- **Skipped and suspicious listings are greyed out** on the page; switch to Show or Hide in the
  bar above the results.
- **Not interested**: hover any card and press "✕ Not interested" to hide it everywhere from
  now on. Undo is right there, and "show" in the panel brings hidden ones back.
- **Analyze this listing** on a listing page gives a verdict, red flags, questions to ask the
  seller (copyable), a suggested offer with a ready-to-send message, and a photo check.
- **Search ideas** (at the bottom of the panel) suggests better searches: tighter, looser, common
  misspellings, other names.
- **Right-click any photo** and choose "Check this photo with Second Look".
- **Esc** tucks the panel away; the sliders icon opens settings. On a page Second Look doesn't
  work on, the toolbar icon shows a "?" for a moment instead of opening.

## Use, Fix, Flip

| Lens | Scores high | The tag shows |
|---|---|---|
| **Use** | Working items at a good price; "for parts" and "as is" are marked down | How the price compares with sold ones |
| **Fix** | Broken or untested items with a likely easy, cheap fix, priced near what broken ones sell for | "Easy fix · ~$10 parts"; the likely fault on hover |
| **Flip** | The biggest margin: sold price, minus eBay fees, minus the price, minus likely parts | "≈ $26 margin" |

Fix and Flip know the usual faults for electronics, retro tech and consoles (dirty cartridge
connectors, tired capacitors, worn disc drives…) and what has a homebrew scene; "What you're
into" in settings steers that, and the rules of thumb live in `FIX_KNOWLEDGE` in
`background.js`. On a listing page they add a repair plan: likely faults, parts, tools,
difficulty. Repair guesses come from the listing text only: use them to decide what to ask the
seller, not as a diagnosis. Set "eBay fees" in settings to your category's fee so margins are real.

## Prices

- Comparisons use what you'd actually pay (price plus shipping) against what sold listings went
  for. The used median comes from recent eBay sales; Fix and Flip also look up what **broken** ones
  sell for: pay less than that and the worst case is reselling it as-is. "The sales behind these"
  lists the sales behind each number. eBay's "results matching fewer words" are left out.
- The comparison is only as good as the search words: "Pentax K1000 body" beats "camera". Edit
  "Compare prices against" if the page's search is vague.
- **Auctions** are recognised ("3 bids · 2d 4h left"). Their price is only a current bid, so the
  tag shows the most worth bidding instead: "Bid ≤ $100".
- **Lots** ("lot of 6") show a price per item. "Or Best Offer" / OBO gets an "Offers" chip.

### Browsing with no search

On the Marketplace home feed, or a Marketplace or eBay category page, there's nothing to compare
against, so your interests (settings) and "What I want" decide what's relevant. Everything else
reads "Not your thing" and is greyed out with the skipped listings. Prices are compared with the model's
estimate of what that kind of item usually sells for, always marked **est.**; press
**Sold prices** on a listing for real eBay numbers for that exact item.

## Without any AI

Everything here is free, needs no API key, and runs only on pages you're looking at.

**On the cards**, as soon as a results page loads:

- **Scam marks**: reposts under new codes, codes in titles, contact off the site (see Scams).
- **% of sold**: once sold prices are known for the search, every card says how its price
  (with shipping) compares, in green when it's 70% or less. Lots and auctions are left out.
- **Price drops**: "↓ $15 since Oct 3" when a listing you've seen got cheaper.
- **New to you** on a search you've looked at before (not on feeds, and not when most of the
  page is new anyway).
- **Auctions ending soon**: "Ends in 45m · no bids" in the last three hours.
- **Seller warnings** for few ratings or a low positive percentage (eBay; limits in settings), and
  **duplicates**: the same title or photo on several listings on one page.
- **On hover**: ☆ **Save**, **Sold ↗** (eBay's sold listings for that title, in a new tab) and
  ✕ **Not interested**.

**In the panel**:

- **Just compare sold prices** (under the Scan button): the eBay sold-price lookup on its own, with
  no model. Prices already looked up for a search in the last six hours apply by themselves.
- **The list** shows every listing on the page before any scan, priced with shipping, and sorts
  by cheapest (lots per item), furthest under the sold price, auctions ending soonest, or new and
  cheaper first. Click a title to jump to the card.
- **Saved**: listings you save, from either site, with the price when you saved them and the
  latest you've seen ("$52 (↓ from $60)"), and searches you save with **Save this search**, which
  remember when you last looked. "Copy the list" gives you titles, prices and links as text.
  Prices update whenever a saved listing is on your screen again; nothing is checked in the
  background.
- **Same search on Marketplace / on eBay** runs your words on the other site.

**On a listing page**: when you saw it before, its price history ("$70 (Sep 30) → $60 (Oct 5) →
$55 now"), Save, Not interested, and Sold on eBay.

**In settings**: words that always hide a listing (starts with replica, repro, box only…) and
words a title must have. Hidden and filtered listings are never sent to a model. **Find photo**
(in a tag's hover card or the listing view) runs a reverse image search, to catch photos lifted
from elsewhere.

Turn off "Mark cards before you scan" in settings to keep cards untouched until you scan.

## Model and cost

The menu at the bottom of the panel switches models straight away: **Opus 5.5** (best),
**Sonnet 5.5** (half the price), **Haiku 4.5** (a quarter), or your **Ollama** model (free, local).
Next to it is this month's Claude spend; click it for today, this month, last month and each
model's cost per call. Set a monthly budget in settings and Claude calls stop when it's reached.

To keep costs down, scores are remembered for a day (re-scans and coming back are free), up to
three requests run at once, and a failed request's listings come back on the next scan. Spending
is estimated from token counts at list price: a regular API key can't read your real balance,
which is at console.anthropic.com.

## Look

Two looks, picked at the top of settings; open tabs switch straight away:

- **Classic**: paper and ink, with colour only where it means something.
- **Pocket**: a retro handheld LCD in greens; a backlit screen in dark mode.

Both follow your system's light/dark setting. The fonts ship in `fonts/` (SIL Open Font License,
see `fonts/LICENSE.md`) and load from inside the extension. Colours and type live in `THEME_CSS`
near the top of `content/panel.js`.

## Local setup with Ollama (CachyOS, about 30 minutes, mostly downloads)

1. **Install Ollama with NVIDIA support and start it**
   ```
   sudo pacman -S ollama-cuda
   sudo systemctl enable --now ollama
   ```
2. **Pull the two models** (~2.5 GB and ~1.7 GB)
   ```
   ollama pull qwen3:4b
   ollama pull moondream
   ollama run qwen3:4b "say hi"        # sanity check; watch nvidia-smi in another terminal
   ```
3. **Let Ollama accept the extension.** Copy the extension's ID (32 letters) from
   `vivaldi://extensions`; keep the folder where it is, since the ID is tied to its path. Then
   `sudo systemctl edit ollama`, add the lines below, and `sudo systemctl restart ollama`.
   ```
   [Service]
   Environment="OLLAMA_ORIGINS=chrome-extension://PASTE_ID_HERE"
   ```
4. Choose Ollama in the panel's model menu (or in settings) and press **Test connection** in
   settings; it should list your models.

A 4B model is a quick first filter, not an appraiser: read its reasons. With 4 GB of VRAM
(a 3050 Ti), lower "Listings per request" if scans are slow, or try `llama3.2:3b`.

## Privacy

Listing titles and card text go to the model you pick; with Ollama nothing leaves your computer
except eBay sold-price searches (turn those off in settings). What you've seen, saved, hidden and spent
is kept only in this browser. Settings can clear what's seen and hidden; remove saved things from
the Saved section.

## When it breaks

Both sites change their markup without warning. If a scan says "No listings found":

- **eBay**: in DevTools (F12), inspect a result card. Current layout uses `li.s-card` with
  `.s-card__title` / `.s-card__price`; the older one used `s-item`; category pages (`/b/…`) use
  `li.brwrvr__item-card`. Add what you find to `EBAY_CARDS` and the selector lists in
  `extractEbay` (`content/adapters.js`).
- **Facebook**: the adapter doesn't use class names. It finds every link to
  `/marketplace/item/<id>` and reads the text inside; check what card links look like now.

**eBay shows "Checking your browser" or won't load**: eBay does this to traffic that looks
automated, and then ordinary page loads get it too for a while (refreshing usually clears it).
Second Look's only automated traffic is the sold-price lookups: at least 5 seconds apart, at
most 8 an hour, remembered for 6 hours, and paused for an hour at the first check (the price
box then links to eBay's own sold listings). On Facebook, keep an eBay tab open: lookups then run
from that tab, like eBay's own pages, which eBay questions far less. If it keeps happening, untick "Compare prices with
recent eBay sales"; if it still happens, untick "Show a slim tab" too, which leaves eBay pages
untouched until you click the toolbar icon.

After editing any file, press the reload arrow on the extension in `vivaldi://extensions` and
refresh the tab. The version number there tells you which copy is running.

## How the pieces fit

| File | Job |
|---|---|
| `manifest.json` | Permissions, icon, keyboard shortcut. With "Show a slim tab" on, `background.js` registers `content/*` for eBay and Facebook pages; with it off, they load only when you click the toolbar icon |
| `content/adapters.js` | Reads listings (and auctions, lots, offers, seller ratings, scam signs) off each site into one shared shape; the sold-price median |
| `content/panel.js` | The panel, tags on cards, the scan, memory of seen and hidden listings, filters, the listing view |
| `background.js` | Talks to Claude or Ollama (retries, timeouts, cost tracking, budget), fetches photos and eBay sold results for Facebook pages; holds the prompts |
| `options/` | Settings page |
| `fonts/`, `icons/` | Bundled typefaces (OFL) and the toolbar icon |

The ranking prompt (`RANK_BASE`, `SCAM_RULE` and `LENS_RULES` in `background.js`) is the part most worth tuning.
Keep it to pages you're looking at, one scan when you press the button: automated, unattended
collection is what Meta's and eBay's terms prohibit and what gets accounts flagged.
