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
2. Paste a Claude API key (from console.anthropic.com). Settings save as you go, the key is checked
   the moment you paste it, and a banner at the top says whether you're ready (or the one thing missing),
   with links to try it on eBay or Marketplace. **Show** reveals a key to check for typos.
3. Search eBay or Facebook Marketplace. A slim **Second Look** tab sits on the right edge of every
   eBay and Marketplace page; the free marks on the cards work with the panel closed. Click the tab
   (or press **Alt+Shift+L**) to open the panel, and press **Scan**.

The first time, the panel opens by itself with a three-step welcome (choose Use or Fix & flip, say
what you want, press Scan); each step is a link that jumps to the right box. **Got it** closes it for
good, and the **?** button in the panel header brings it back.

The panel has two views: **This page** (everything below) and **Saved** (your saved listings and
searches, and everything you've hidden), which works on any eBay or Marketplace page.

Every listing gets a tag: a score out of 100, a verdict (Great deal, Worth a look, Market price,
Skip, Suspicious) and one line on the price. Hover it for the reasons. Scroll for more and the
button becomes "Scan N new listings"; only the new ones are scored.

## Scams

The most common Marketplace scam is one fake listing posted many times, each copy with a random
code on the end of the title: "Nintendo Game Boy Advance SP M2465", "Halo Special Edition Xbox
S1337". Second Look watches for it:

- **Reposted under new codes**: the same title seen with two different codes, on one page or any
  page in the last month, is marked "Scam: reposted" and greyed out straight away,
  with no model and no key needed. A scan marks these Suspicious without sending them to the model.
- **Code in title**: a lone code gets a chip and counts as a likely scam straight away: greyed out,
  last in every sort, never a deal at your price. A scan spells it out for the model, which marks
  it Suspicious unless the code is the item's real model number (Pentax K1000, PS Vita PCH1001);
  then the chip and the greying go away.
- **Contact off the site**: on a listing, a disguised web address ("www . jmyzl . com", "remove the
  spaces"), an oddly written phone number ("505_507__6507"), "text me a screenshot", WhatsApp or
  Telegram shows a "Likely scam" note, and the analysis is Suspicious whatever the model thought.
  A plain phone number ("call or text") is only a hint.

Suspicious listings are greyed out along with skipped ones (Show / Dim / Hide above the results).

## Everyday use

- **Buying to: Use / Fix & flip** at the top of the panel says what you want listings for (see below).
- **What I want**: "working, with charger, under $80". Every scan, analysis and search idea
  takes it into account, and a listing that misses something says so. After a scan it folds into
  one line with the compare words (**Edit** opens them); change either and the button becomes
  **Rescan with your changes**.
- **Click a title** in the panel to jump to that card. If the panel would cover it, it tucks
  away and the card flashes.
- **Sort** the list by best (what you searched for first), cheapest, furthest under the sold
  price, auctions ending soonest, biggest margin, or new and cheaper first.
- **Skipped and suspicious listings are greyed out** on the page; switch to Show or Hide in the
  bar above the results.
- **Not interested**: hover any card and press "✕ Not interested" to hide it everywhere from
  now on. Undo is right there; **Saved → Hidden** lists everything you've hidden, each with Undo.
- **Analyze this listing** on a listing page gives a verdict, red flags, questions to ask the
  seller (copyable), a suggested offer with a ready-to-send message, and a photo check.
- **✦ Ideas** (next to Save search) suggests other ways to search for what's on the page: the
  misspellings sellers make, other model names, tighter or looser words. Click one to run it,
  ☆ to save it, hover for why. On eBay's front page, "Find searches for what I want" does the same
  from "What I want".
- **Right-click any photo** and choose "Check this photo with Second Look".
- **Start over** clears the page's scores (Undo is right there); the free marks stay.
- **Esc** tucks the panel away; the sliders icon opens settings. On a page Second Look doesn't
  work on, the toolbar icon shows a "?" for a moment instead of opening.

## Use, or Fix & flip

| Buying to | Scores high | The tag shows |
|---|---|---|
| **Use** | Working items for yourself at a good price; "for parts" and "as is" are marked down | How the price compares with sold ones |
| **Fix & flip** | Projects: an easy, cheap fix, a resale margin after eBay fees and parts, or both; broken and untested ones are welcome | "Easy fix · ≈ $16 margin", or "≈ $26 margin" for one that works; the likely fault on hover |

Fix & flip knows the usual faults for electronics, retro tech and consoles (dirty cartridge
connectors, tired capacitors, worn disc drives…) and what has a homebrew scene; "What you're
into" in settings steers that, and the rules of thumb live in `FIX_KNOWLEDGE` in
`background.js`. On a listing page it adds a repair plan: likely faults, parts, tools,
difficulty. Repair guesses come from the listing text only: use them to decide what to ask the
seller, not as a diagnosis. Set "eBay fees" in settings to your category's fee so margins are real.

The filter bar's broken-listing switch follows the mode: **Hide broken** in Use, **Broken only**
in Fix & flip (for when you only want fix-ups).

## Prices

- Comparisons use what you'd actually pay (price plus shipping) against what sold listings went
  for. The used median comes from recent eBay sales; Fix & flip also looks up what **broken** ones
  sell for (when the page has broken or untested listings): pay less than that and the worst case is reselling it as-is. "The sales behind these"
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

**Filtering a search** (the bar above the list; each search remembers its own):

- **Words**, like an eBay search: `dmg -case -game` keeps listings with "dmg" and drops any with
  "case" or "game"; `1000/2000` is either; `"must go"` is a phrase. They match the title and the
  card's text, so `-china` drops "from China" on eBay.
- **$ min – max**, shipping included: a minimum clears out the cases and cables.
- **New only** hides everything you've seen before, for the searches you check every day.
- **Hide broken** (Use) or **Broken only** (Fix & flip) acts on listings that say broken, untested,
  for parts, no power, disc read error and the like: the "any of these words" search Marketplace
  can't do. Those words also show as a chip on cards (and moving sale, must go, estate sale:
  sellers who want it gone).
- **Deal at ≤ $** is your price for this search (it stays when you clear the filter with ×). Listings at or under it get an "At your $60" mark,
  and the slim tab on the edge of the page counts them (★3) even with the panel closed. When sold
  prices are known it suggests 70% of the median.

Filtered listings are never sent to a model, so filtering before a scan also makes it cheaper.

**In the panel**:

- **Just compare sold prices** (under the Scan button): the eBay sold-price lookup on its own, with
  no model. Prices already looked up for a search in the last six hours apply by themselves.
- **The list** shows every listing on the page before any scan, priced with shipping, and sorts
  by cheapest (lots per item), furthest under the sold price, auctions ending soonest, or new and
  cheaper first. Click a title to jump to the card.
- **Saved**: listings you save, from either site, with the price when you saved them and the
  latest you've seen ("$52 (↓ from $60)"), and searches you save with **Save this search**, which
  remember when you last looked and how many were at your price; they're in the **Saved** view, which
  also lists what you've hidden. **Open all searches** opens each
  in a background tab, for a daily round. "Copy the list" gives you titles, prices and links as text.
  Prices update whenever a saved listing is on your screen again; nothing is checked in the
  background.
- **Try on Marketplace / Try on eBay** runs your words on the other site.

**On a listing page**: when you saw it before, its price history ("$70 (Sep 30) → $60 (Oct 5) →
$55 now"), Save, Not interested, and Sold on eBay.

**In settings**: words that always hide a listing (starts with replica, repro, box only…) and
words a title must have. Hidden and filtered listings are never sent to a model. **Find photo**
(in a tag's hover card or the listing view) runs a reverse image search, to catch photos lifted
from elsewhere.

Turn off "Mark cards before you scan" in settings to keep cards untouched until you scan.

## Model and cost

The menu at the bottom of the panel switches models straight away: **Opus 5.5** (best),
**Sonnet 5.5** (half the price), **Haiku 4.5** (a quarter), the other AI service you've set up,
or your **Ollama** model (free, local). Next to it is this month's spend on paid AI; click it for
today, this month, last month and each model's cost per call. Set a monthly budget in settings and
paid AI stops when it's reached.

The **Scan** button says how many listings it would send and about what that costs ("Scan 48
listings · about $0.26"), from what scoring has actually cost you per listing with that model.
**Stop** appears beside the status line while the model works (scans, analyses, photo checks,
ideas): nothing new is sent, requests under way are cancelled, and what already came back stays.

### Other AI services

Settings → Model → "Other AI services" works with anything that speaks the OpenAI chat API:

| Service | Notes |
|---|---|
| **OpenRouter** | One key for hundreds of models (Google, Meta, Mistral, DeepSeek, Qwen…); reports its own costs, so spending is exact |
| **OpenAI** | Key at platform.openai.com |
| **Google Gemini** | Key at aistudio.google.com; free tier with rate limits |
| **DeepSeek**, **Mistral**, **xAI** | Keys from each console |
| **LM Studio** | On your own computer, free and private: load a model and start its server |
| Anything else | Enter its /v1 address; Test connection asks your permission to reach it |

Pick the service, paste the key, press **Test connection** (it lists the models), and pick one. A
separate photo model is optional (it has to accept images). For spending on services other than
Claude and OpenRouter, enter their prices per million tokens. If a model can't do structured
output, Second Look falls back to plain JSON, so most chat models work; small ones judge less well.

To keep costs down, scores are remembered for a day (re-scans and coming back are free), up to
three requests run at once, and a failed request's listings come back on the next scan. Spending
is estimated from token counts at list price: a regular API key can't read your real balance,
which is at console.anthropic.com.

## Look

Paper and ink, with colour only where it means something; it follows your system's light/dark
setting. The serif ships in `fonts/` (SIL Open Font License, see `fonts/LICENSE.md`) and loads
from inside the extension. Colours and type live in `THEME_CSS` near the top of `content/panel.js`.

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

Listing titles and card text go to the model you pick; with Ollama or LM Studio nothing leaves your computer
except eBay sold-price searches (turn those off in settings). What you've seen, saved, hidden and spent
is kept only in this browser. Settings can clear what's seen and hidden; remove saved things from
the Saved section. **Settings → Backup** saves it all to a file (never your API keys) and restores
it in another browser or profile, adding to what's there.

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
| `background.js` | Talks to Claude, other AI services or Ollama (retries, timeouts, Stop, cost tracking, budget), fetches photos and eBay sold results for Facebook pages; holds the prompts |
| `options/` | Settings page |
| `fonts/`, `icons/` | The bundled serif (OFL) and the toolbar icon |

The ranking prompt (`RANK_BASE`, `SCAM_RULE` and `LENS_RULES` in `background.js`) is the part most worth tuning.
Keep it to pages you're looking at, one scan when you press the button: automated, unattended
collection is what Meta's and eBay's terms prohibit and what gets accounts flagged.
