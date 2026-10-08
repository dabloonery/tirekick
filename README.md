# Second Look

A browser extension that scans an eBay or Facebook Marketplace search results page,
ranks every listing with a language model (the Claude API, or Ollama on your own
laptop), and puts a score sticker on each card. Optional: compare prices against recent eBay sold
listings, and ask a vision model to look at a listing photo.

Listing titles and card text go to whichever model provider you pick; with Ollama
nothing leaves your computer except one ordinary eBay sold-listings search per scan
(turn that off in settings if you like).

## Quick start (Claude API, about 5 minutes)

1. In Vivaldi/Chrome open `vivaldi://extensions` (or `chrome://extensions`), turn on
   Developer mode, click **Load unpacked**, pick this folder.
2. Open the extension's options, paste a Claude API key (console.anthropic.com),
   and save. The default model is `claude-opus-5-5`; `claude-haiku-4-5` is cheaper.
3. Search eBay or Facebook Marketplace. A slim **Second Look** tab sits on the right edge of
   the page; pull it out to open the panel. Press **Scan this page**. Scroll for more
   listings and the button turns into "Scan N new listings" (only the new ones are scored).
   The toolbar button isn't needed; right-click it and hide it if you like.
   If eBay ever misbehaves, untick "Show a slim tab" in options: the panel then loads
   only when you click the toolbar icon. Each listing gets a
   badge like "91 · Great deal · Second Look score" (the number is out of 100). Hover it
   for the reason.
4. Open a single listing and press **Analyze this listing** for a verdict, red flags,
   questions to ask the seller, a suggested offer, and a photo check.
5. Open **Search ideas** in the panel (it's open by default on eBay's home page). Describe what
   you want, or leave it blank after a scan to get refinements from the results you're seeing:
   tighter searches that cut junk, looser ones, common misspellings, alternative names, and a
   price cap based on the sold median. Click a suggestion to run it. One model call per
   request; nothing runs on its own.
6. Right-click any photo on eBay or Facebook and choose **Check this photo with Second Look**.
   Photo checks (the "Check photo" buttons too) change the rating: a stock photo, visible damage,
   or a photo that doesn't match the title lowers the score (and can mark a listing suspicious);
   a clear real photo of an item in good shape adds a little. The adjustment rules are fixed in
   `photoAdjust` in `background.js`, so you can tune them.

## Use, Fix, Flip

The switch at the top of the panel sets what you want a listing *for*, and scores follow it:

| Lens | Scores high | Sticker shows |
|---|---|---|
| **Use** | Working items at a good price; "for parts" and "as is" are marked down | Verdict and score |
| **Fix** | Broken or untested items with a likely easy, cheap fix, priced near what broken ones sell for | "Easy fix · ~$10 parts", likely fault on hover |
| **Flip** | The biggest margin: used sold median, minus eBay fees, minus the price, minus likely parts | "≈ $26 margin" |

- **What I want** (under the switch) feeds every scan, single-listing analysis and Search ideas:
  "working, with controllers, under $80". A listing that misses something says so.
- **Price comparisons use what you'd actually pay**: price plus shipping when the card shows it, against
  what sold listings went for including shipping. Fix and Flip also look up the **for-parts** median:
  pay less than that and the worst case is reselling it broken. "See the sales" lists the sales
  behind each number.
- **Analyze this listing** in Fix or Flip adds a repair plan (likely faults, parts, tools, difficulty)
  and, for anything with a scene, a homebrew note with firmware/model caveats.
- **Settings**: "What you're into" tells Fix and Flip which repair and homebrew knowledge applies
  (it starts as electronics, retro tech, games and homebrew). Set "eBay fees" to your category's
  final value fee so Flip margins match what you'd really clear. The repair rules of thumb live
  in `FIX_KNOWLEDGE` in `background.js`; add what you learn.
- Repair guesses are the least reliable thing here: the model only sees the listing text. Use them
  to decide what to ask the seller, not as a diagnosis.

## Browsing with no search

On the Marketplace home feed (or a category page) there's nothing to compare prices against, so
a scan works differently:

- **Your interests are the guide.** "What you're into" (settings) and "What I want" decide what's
  relevant; anything else reads "Not your thing" and counts as Skip unless it's an exceptional deal,
  so "Skipped listings: Hide" clears the feed down to your kind of thing. Category pages
  (e.g. `/marketplace/nyc/videogames`) tell the model which category it's looking at.
- **Prices are estimates, and say so.** The model gives a typical used price range from general
  knowledge; stickers read "~50% of typical price (est.)".
- **Real numbers on request.** "Check sold prices" on any listing runs one eBay sold search the
  model wrote for that exact item (same gentle limits as always) and swaps the estimate for real
  sold data. Nothing is looked up on eBay while you browse.

Type a search into "Compare prices against" to compare everything against one sold price instead.

## Without any AI

These run on every results page before you scan, cost nothing, and keep working with no API key:

- **Auctions** are recognised from "3 bids · 2d 4h left". Their price is treated as a current bid,
  never as a deal on its own; the sticker shows the most worth bidding instead ("Bid ≤ $100"):
  the sold price in Use, the for-parts price in Fix, break-even after fees and parts in Flip.
- **Lots** ("lot of 6", "10 pc lot") show a price per item and aren't compared with a single
  item's sold price. **Offers** ("or Best Offer", "OBO") get a chip.
- **New to you**: listings you haven't seen before on a search you've looked at before.
- **Price drops**: "↓ $15 since Oct 3" when a listing you've seen is now cheaper (item price,
  not shipping; auctions aren't tracked).
- **Not interested** (in a sticker's hover card or the panel) hides a listing everywhere from now
  on. Undo right away, or bring hidden ones back with "show" in the panel or in settings.
- **Filters** in settings: words that always hide a listing (starts with replica, repro, box only
  and friends) and words a title must have. Hidden and filtered listings are never sent to a model.
- **Seller warnings** for few ratings or a low positive percentage (eBay; thresholds in settings).
- **Duplicates**: the same title or photo on several listings on one page.
- **Search this photo** opens a reverse image search, to catch photos lifted from elsewhere.
- **Skipped listings**: after a scan, show, dim or hide the ones marked Skip.

What you've seen and hidden is kept only in this browser (90 days for seen listings) and can be
cleared from settings. Turn off "Mark cards before you scan" to keep cards untouched until you scan.

## Look

Two looks, picked at the top of the settings page (it switches straight away, open tabs too):

- **Classic**: paper and ink. A Fraunces serif for the wordmark, scores and prices, your system
  font for everything else, and colour only where it means something (the verdict).
- **Pocket**: a retro handheld LCD in greens, mono type and hard pixel shadows. In dark mode it
  becomes a backlit screen.

Both follow your system's light/dark setting. The fonts ship in `fonts/` (SIL Open Font License,
see `fonts/LICENSE.md`) and are loaded from inside the extension, so no site can block them or
use them to tell the extension is installed. All the colours and type live in `THEME_CSS` near
the top of `content/panel.js`.

## Local setup with Ollama (CachyOS, about 30 minutes, mostly downloads)

Choose "Ollama (local)" as the provider in settings, then:

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
3. **Load the extension, then let Ollama accept it**
   - In Vivaldi open `vivaldi://extensions`, turn on Developer mode, click
     **Load unpacked**, pick this folder. Copy the extension's ID (32 letters).
     Keep the folder where it is: the ID is tied to its path.
   - `sudo systemctl edit ollama` and add:
     ```
     [Service]
     Environment="OLLAMA_ORIGINS=chrome-extension://PASTE_ID_HERE"
     ```
   - `sudo systemctl restart ollama`
   - Open the extension's options (right-click its icon, Options) and press
     **Test connection**. It should list your installed models.
4. **Use it.** Search eBay or Facebook Marketplace, scroll so results load, pull out the
   **Second Look** tab on the right edge (or click the toolbar icon), then press
   **Scan this page**. Click a title in the panel to jump to that card.

## How the pieces fit

| File | Job |
|---|---|
| `manifest.json` | Permissions. No content scripts are declared here: with "Show a slim tab" on, `background.js` registers `content/*` for eBay and Facebook pages; with it off, they load only when you click the toolbar icon |
| `content/adapters.js` | Reads listings off each site into one shared shape; computes the sold-price median |
| `content/panel.js` | The panel, the scan loop, the badges on cards, the single-listing view, the photo-check popup |
| `background.js` | Talks to Claude or Ollama (with retries and timeouts), fetches photos, and fetches eBay sold results for Facebook pages; holds the prompts |
| `options/` | Settings page |
| `fonts/`, `icons/` | Bundled typefaces (OFL) and the toolbar icon |

Both providers sit behind `rankBatch` and `checkPhoto`, so adding another is small.
The ranking prompt (`RANK_SYSTEM` in `background.js`) is the part most worth tuning.

## When it breaks

Both sites change their markup without warning. If a scan says "No listings found":

- **eBay**: in DevTools (F12), inspect a result card. Current layout uses
  `li.s-card` with `.s-card__title` / `.s-card__price`; the older one used `s-item`.
  Add whatever you find to the selector lists at the top of `extractEbay`.
- **Facebook**: the adapter doesn't use class names at all. It finds every link to
  `/marketplace/item/<id>` and reads the text inside. If that breaks, check what the
  card links look like now.

**eBay pages stop loading or show "Checking your browser"**: eBay does this to traffic that
looks automated, and once it trips, ordinary page loads get it too for a while (refreshing
usually clears it). Second Look's only automated traffic is the sold-price lookups, now kept
to a trickle and stopped at the first check. If it keeps happening, untick "Compare prices
with recent eBay sales" in settings and see whether it stops; if it still happens with the
lookups off, untick "Show a slim tab" too, which leaves eBay pages completely untouched until
you click the toolbar icon.

After editing, hit the reload arrow on the extension in `vivaldi://extensions` and
refresh the tab.

## Things to know

- A 4B model is a quick first filter, not an appraiser. Read its reasons.
- The sold-price median is only as good as your search words. "Pentax K1000 body"
  compares better than "camera". eBay's "results matching fewer words" are left out of it.
- Sold-price lookups are remembered for 6 hours per search, so re-scans and new pages with
  the same words don't ask eBay again. They're spaced at least 5 seconds apart, capped at 8 an
  hour, and pause for an hour the moment eBay answers with a browser check. The price box then
  links to eBay's own sold listings so you can look yourself.
- Scores are remembered for a day per listing, lens, wants and price: re-scanning, coming back to
  a search, or switching lenses back and forth costs nothing the second time.
- **Model and spending, at the bottom of the panel.** Pick Opus 5.5 (best), Sonnet 5.5 (half the
  price), Haiku 4.5 (a quarter) or your Ollama model; it applies straight away. Next to it is this
  month's Claude spend: click it for today, this month, last month and a per-model breakdown.
  Set a monthly budget in settings and Claude calls stop when it's reached. These are estimates
  from token counts at list price; a regular API key can't read your real balance (that's at
  console.anthropic.com).
- With the Claude API, up to 3 batches are ranked at once; Ollama runs one at a time. If a
  request fails, the listings it carried are offered again on the next scan.
- Your 3050 Ti has 4 GB of VRAM. If scans are slow, lower "Listings per request"
  or try `llama3.2:3b` as the ranking model.
- This reads pages you're already looking at, one scan at a time when you press the
  button. Keep it that way: automated, unattended collection is what Meta and eBay's
  terms prohibit and what gets accounts flagged.
