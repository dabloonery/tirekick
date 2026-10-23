# Tirekick

Kick the tires before you buy.

> Want to help? [CONTRIBUTING.md](CONTRIBUTING.md) covers setup, the tests and the house rules. Agents: read
> [AGENTS.md](AGENTS.md) first.

A browser extension for buying on secondhand marketplaces, starting with eBay and Facebook Marketplace. It puts a small
score tag on every listing you're looking at, compares prices with what the same thing actually
sold for, flags likely scams, and remembers what you've already seen. An AI you choose (any
service you have a key for, such as Anthropic, Google Gemini, OpenAI or OpenRouter, or a free model on
your own computer) does the judging; a lot of the useful parts don't
need a model at all.

It only works on pages you're looking at, when you ask. Nothing browses or checks prices in the
background.

## Quick start (about 5 minutes)

1. In Vivaldi/Chrome open `vivaldi://extensions` (or `chrome://extensions`), turn on
   Developer mode, click **Load unpacked**, and pick this folder. The settings page opens.
2. Under **AI service**, choose the one you have a key for (or Ollama or LM Studio on your own
   computer), and paste its key. Settings save as you go, the key is checked
   the moment you paste it, and a banner at the top says whether you're ready (or the one thing missing),
   with links to try it on eBay or Marketplace. **Show** reveals a key to check for typos.
3. Search eBay or Facebook Marketplace. A slim **Tirekick** tab sits on the right edge of every
   eBay and Marketplace page; the free marks on the cards work with the panel closed. Click the tab
   (or press **Alt+Shift+L**) to open the panel, and press **Scan**.

The first time, the panel opens by itself with a short welcome: what Scan does, what Buyer and
Reseller change, and that a card's tag has the reasons. With no model set up yet, adding a key comes
first, with **Open settings** as the one button (the marks on the cards and comparing sold prices work
without one). **Got it** closes it for good, and the **?** button in the panel header brings it back.
Home's **Getting started** keeps track of the first few things to try.

**Where it sits**: docked to the right edge (the default) or the left, in one of three widths.
Drag the header toward a side and let go (both sides light up as you drag) to dock it there, drag the
panel's inner edge and it settles on the nearest width, or click the header and use the arrow keys:
left and right pick the side, up and down the width, Home puts it back. Double-clicking the header also
puts it back. Each site remembers its own, and the panel always fits the window. Esc tucks it away
from anywhere on the page (except while you're typing in the site's own boxes).

Under the header, three tabs: **Home** (what's worth another look, getting started, and a few numbers
that lead to their lists), **This page** (everything below) and
**Saved** (your saved listings and searches; what you've hidden is folded away at the bottom). Beside
them, **Buyer** (to keep and use) or **Reseller** (to fix up and resell) says how you're shopping (see
below). Saved and Home work on any eBay or Marketplace page.

## Home

- **Worth another look**: saved listings that got cheaper since you saved them, and saved searches
  that had listings at your price the last time you looked. New ones also show as a number on the
  toolbar icon; clicking the icon then opens the panel on Home, and looking at Home marks them seen.
  Nothing checks in the background: these update when those listings are on your screen.
- **At a glance**: saved listings, price drops, saved searches and listings at your price.
- **Spent on paid AI, 30 days** (only once something was spent; folded): a bar per day, with
  **Table view** for the numbers and the cost per model.
- **Getting started**: four steps with a check beside each one done; **Hide** folds it away.
- On a page Tirekick doesn't work on, the toolbar icon opens **Tirekick's own page as a popup**: a lookup,
  your saved listings and searches, and Home. **Open in a tab ↗** at its top (or right-click the icon,
  **Open Tirekick in a tab**) gives it a whole tab. On eBay and Marketplace the icon opens the panel instead.

Every listing gets a tag: a score out of 100, a verdict (Great deal, Worth a look, Fair price,
Skip, Likely scam) and one line on the price. Hover it (or Tab to it) for the reasons. When a scan finishes the panel scrolls to the results. Scroll for more and the
button becomes "Scan N new listings"; only the new ones are scored.

**Scores stay with the listing.** Every score (a scan, an analysis, a photo check) is saved in this
browser under the listing, for 60 days. Open the same search in a new tab, the same listing in another
search, or reload, and the tags are already there, with "Scored Oct 11 with Opus 5.5" in the hover card
and no model call. A listing's own page shows what an earlier scan said about it, and Analyze there
updates its card in every search. A saved score only comes back while the price is the one it was judged
at and the mode (Buyer / Reseller) matches; changing what you want offers **Rescan with your changes**,
and **Start over** clears the page without bringing them back until you leave it.

## Scams

The most common Marketplace scam is one fake listing posted many times, each copy with a random
code on the end of the title: "Nintendo Game Boy Advance SP M2465", "Halo Special Edition Xbox
S1337". Tirekick watches for it:

- **Reposted under new codes**: the same title seen with two different codes, on one page or any
  page in the last month, is marked "Scam: reposted" and grayed out straight away,
  with no model and no key needed. A scan marks these Likely scam without sending them to the model.
- **Code in title**: a lone code gets a chip and counts as a likely scam straight away: grayed out,
  last in every sort, never a deal at your price. A scan spells it out for the model, which marks
  it Likely scam unless the code is the item's real model number (Pentax K1000, PS Vita PCH1001);
  then the chip and the graying go away.
- **Contact off the site**: in a title or on a listing, a disguised web address ("www . jmyzl . com", "remove the
  spaces"), an oddly written phone number ("505_507__6507"), "text me a screenshot", WhatsApp or
  Telegram shows a "Likely scam" note, and the analysis is Likely scam whatever the model thought.
  A plain phone number ("call or text") is only a hint.

Likely scams are grayed out along with skipped ones (Skips and scams: Show / Dim / Hide, above the list). Dimming fades the card but not its tag or chips, so a
scam warning stays readable.

## Everyday use

- **What should Tirekick do?**, at the top of settings: **Everything** (the default), **Scam check only** (cards show
  only scam warnings; prices are still looked up to spot listings too cheap to be real, and your AI isn't used) or
  **Without the AI** (every free check and mark). Scam marks stay on in all three; changing a part by hand reads as Custom.
- **Buyer / Reseller**, the switch at the top right of the panel, says what you want listings for (see below). Each
  mode remembers its own sort and skipped-listings setting.
- **What I want**: "working, with charger, under $80". Each search keeps its own (per site and
  mode: what you want from a camera isn't what you want from a console), and a listing you open from
  that search in the same tab uses it. Every scan, analysis and search idea takes it into account, and a
  listing that misses something says so. Your general taste goes in settings ("What you're into").
  After a scan it folds into one line with the compare words (**Edit**, or **Add what you want**);
  change either and the button becomes **Rescan with your changes**.
- **Scan new listings automatically** (the switch under Scan, or in settings): on an eBay or
  Marketplace search you're looking at, listings are scored as they load, so you never press Scan.
  Only while the page is on your screen, never twice for the same listing, and it stops at a problem
  (shown as "!" on the tab) or at your monthly budget.
- **Click a title** in the panel to jump to that card. If the panel would cover it, it tucks
  away and the card flashes.
- **Sort** the list by best (what you searched for first), cheapest, furthest under the sold
  price, auctions ending soonest, biggest margin, or new and cheaper first.
- **Skipped and suspicious listings are grayed out** on the page; switch to Show or Hide with
  **Skips and scams** above the list.
- **Before any scan, each row has a free read**: Great, Good or Fair price, or Above typical, from the sold
  prices; Check first or Likely scam from the free warnings; Off-topic. "Best first" sorts by it until a scan
  gives real scores, and the cards' sold chip says the same word ("Good price · $53 below typical").
- **A row's links**: **Open ↗** is always there; Sold, Save and Hide appear when you point at it or Tab into it,
  so the list reads as titles and prices; a saved listing keeps its "Saved". On a touch screen they always show.
- **Hide**: hover any card and press "✕ Hide" to hide it everywhere from
  now on. Undo is right there; **Saved → Hidden** lists everything you've hidden, each with Unhide.
- **Analyze this listing** on a listing page gives a verdict, red flags, a suggested offer with a ready-to-send message, and a photo check.
- **Search ideas** (under Scan) suggests other ways to search for what's on the page: the
  misspellings sellers make, other model names, tighter or looser words. Click one to run it,
  Save to keep it, hover for why. On eBay's front page, **Search ideas** does the same
  from "What I want".
- **Right-click any photo** and choose "Check this photo with Tirekick".
- **Off eBay and Marketplace**: select a thing's name on any page, right-click, and choose **Look up
  "…" on eBay and Marketplace**. Tirekick's own page opens with what it sells for on eBay (free, without
  the AI) and a search on eBay, on Marketplace, or both. The toolbar icon opens the same page, as a popup, on any other
  site, with your saved listings and searches (each marked eBay or Marketplace) and Home.
- **Start over** clears the page's scores (Undo is right there); the free marks stay.
- **Keyboard**: opening the panel puts focus inside it and Esc/closing puts it back on the tab; Tab also reaches a card's score tag and, from it, the reasons and the Save / Sold / Hide buttons that otherwise show on hover; arrow keys move between This page / Saved / Home, Buyer / Reseller and Show / Dim / Hide.
- **The footer** has the quality menu and this month's spend. With Claude the menu is **Thrifty** (Haiku for everything), **Balanced** (Haiku scans, Sonnet for single listings, photos and search ideas; the default) or **Thorough** (Sonnet scans, Opus for the rest); settings has each model separately, and another pair shows as Custom. The spend: click it for today, this month, last month and per model (Esc or a click elsewhere closes it). How it's counted, and the budget, are in settings.
- **Esc** tucks the panel away; the sliders icon opens settings.

## Buyer and Reseller

| Mode | Scores high | The tag shows |
|---|---|---|
| **Buyer** | Working items for yourself at a good price; "for parts" and "as is" are marked down | How the price compares with sold ones |
| **Reseller** | Projects: an easy, cheap fix, a resale margin after selling fees and parts, or both; broken and untested ones are welcome | "Easy fix · ≈ $16 margin", or "≈ $26 margin" for one that works; the likely fault on hover |

Reseller adds a **Selling fees (%)** box (the same setting as in settings) and sorts by **biggest
margin** to start with. Reseller knows the usual faults for electronics and consoles (dirty cartridge
connectors, tired capacitors, worn disc drives…); "What you're
into" in settings steers that, and the rules of thumb live in `FIX_KNOWLEDGE` in
`background.js`. On a listing page it adds a repair plan: likely faults, parts, tools,
difficulty. Repair guesses come from the listing text only: use them to decide what to ask the
seller, not as a diagnosis. Set the selling fees to your category's fee so margins are real.

The filter bar's broken-listing switch follows the mode: **Hide broken** in Buyer, **Broken only**
in Reseller (for when you only want fix-ups).

## Prices

- Comparisons use what you'd actually pay (price plus shipping) against what sold listings went
  for. The used median comes from recent eBay sales; Reseller also looks up what **broken** ones
  sell for (when the page has broken or untested listings): pay less than that and the worst case is reselling it as-is. "The sales behind these"
  lists the sales behind each number. eBay's "results matching fewer words" are left out, and so are
  sales that would skew it: "best offer accepted" ones (the card shows the asking price, not what was
  paid), lots, for-parts ones listed as used, titles missing a model number from the search, and
  far-off prices. Each price says how far to trust it: from few sales or a wide spread it's shown as
  "~$58 · a rough guide". See `docs/accuracy-audit.md`.
- **Margins** (Reseller) are the sold price less eBay's fee, the shipping buyers paid on those
  sales (what you'd pay to send it on), likely parts and the price; the hover card spells it out.
  Before sales tax and your time.
- The comparison is only as good as the search words: "Pentax K1000 body" beats "camera". Edit
  "Compare prices against" if the page's search is vague.
- **Auctions** are recognized ("3 bids · 2d 4h left"). Their price is only a current bid, so the
  tag shows the most worth bidding instead: "Bid ≤ $100".
- **Lots** ("lot of 6") show a price per item. "Or Best Offer" / OBO gets an "Offers" chip.

### Browsing with no search

On the Marketplace home feed, or a Marketplace or eBay category page, there's nothing to compare
against, so your interests (settings) and "What I want" decide what's relevant. Everything else
reads "Not your thing" and is grayed out with the skipped listings. Prices are compared with the model's
estimate of what that kind of item usually sells for, always marked **est.**; press
**Typical price** on a listing for real eBay numbers for that exact item.

## Without the AI

Tirekick has AI features, and they're optional. Everything here works without them: it's free, needs no API
key, and runs only on pages you're looking at. To keep the AI out of the way altogether, turn off **Use an AI**
in settings (AI scores): Scan, Analyze, Search ideas, photo checks and the model menu go, nothing is sent to any
AI service, and your setup is kept for when you turn it back on.

**On the cards**, as soon as a results page loads:

- **Scam marks**: reposts under new codes, codes in titles, contact off the site (see Scams).
- **Below or above typical**: once sold prices are known for the search, every card says how far its price
  (with shipping) is from the typical price (the middle of recent eBay sales), in dollars: "Good price · $53
  below typical", "$20 above typical", "about typical". Pointing at it says where "typical" comes from. Lots
  and auctions are left out.
- **Too cheap**: under 40% of a trusted typical price reads "Likely scam? Typical is $300", under 55%
  "Too cheap? Typical is $300" (not for broken ones, lots or auctions, and not when the sold prices are
  only a rough guide).
- **Price drops**: "↓ $15 since Oct 3" when a listing you've seen got cheaper. On Marketplace, a listing the seller has marked down also says "↓ was $180" straight away.
- **New to you** on a search you've looked at before (not on feeds, and not when most of the
  page is new anyway).
- **Auctions ending soon**: "Ends in 45m · no bids" in the last three hours.
- **Seller warnings** for few ratings or a low positive percentage (eBay; limits in settings), and
  **duplicates**: the same title or photo on several listings on one page.
- **Same photo as other listings** (Marketplace): a photo you've seen on another listing under another title, on
  any page in the last 90 days: a stolen or stock photo. Tirekick works out a small fingerprint from each thumbnail
  you scroll past (on your computer; only the code is kept), so it catches a photo uploaded again, not just the same
  file. The seller's own relists and identical titles don't count. Not on eBay, where sellers reuse their own photos.
- **On hover**: ☆ **Save**, **Typical price** (free: one eBay sold lookup of that listing's own title,
  for a page with no search or only a category's name; "No price check" and why when it can't be made) or,
  once it has a price, **Sold ↗** (eBay's sold listings for that title, in a new tab), and ✕ **Hide**. They are square buttons with an icon, so they read as actions
  beside the round chips that tell you about the listing.
- **A category isn't a price.** Words like "Electronics" or "Home & Garden" get no page-wide comparison: the
  panel says they're too broad, and each listing can be priced from its own title.

**Filtering a search.** **New only**, **Hide broken** and **Hide off-topic** sit above the list, one click each.
The **Filter** button opens the words, price range and your price, and says how many are set; Enter or Esc
folds them away again, and a search's saved filter applies with the box folded. Each search remembers its own.

- **Hide off-topic** drops what isn't an item for sale: rentals and rooms, services (massage, cleaning, hair),
  jobs, pets, "looking for" posts and $1 placeholder prices. It's on by itself on the Marketplace home page, where
  that clutter lives; turn it off there and Tirekick remembers.

- **Words**, like an eBay search: `dmg -case -game` keeps listings with "dmg" and drops any with
  "case" or "game"; `1000/2000` is either; `"must go"` is a phrase. They match the title and the
  card's text, so `-china` drops "from China" on eBay.
- **$ min – max**, shipping included: a minimum clears out the cases and cables.
- **New only** hides everything you've seen before, for the searches you check every day.
- **Hide broken** (Buyer) or **Broken only** (Reseller) acts on listings that say broken, untested,
  for parts, no power, disc read error and the like: the "any of these words" search Marketplace
  can't do. Those words also show as a chip on cards (and moving sale, must go, estate sale:
  sellers who want it gone).
- **Your price ≤ $** is your price for this search (it stays when you clear the filter with ×). Listings at or under it get an "At your $60" mark,
  and the slim tab on the edge of the page counts them (★3) even with the panel closed. When sold
  prices are known it suggests 70% of the median.

Filtered listings are never sent to a model, so filtering before a scan also makes it cheaper.

**In the panel**:

- **Typical price** (under the Scan button, marked free): the eBay sold-price lookup on its own, with
  no model. Prices already looked up for a search in the last day apply by themselves.
- **The list** shows every listing on the page before any scan, priced with shipping, and sorts
  by cheapest (lots per item), furthest under the sold price, auctions ending soonest, or new and
  cheaper first. Click a title to jump to the card.
- **Saved**: listings you save, from either site, with the price when you saved them and the
  latest you've seen ("$52 (↓ from $60)"), and searches you save with **Save this search**, which
  remember when you last looked and how many were at your price; they're in the **Saved** view, with
  a small line of each saved listing's price over time, and what you've hidden folded away at the bottom. **Open all searches** opens each
  in a background tab, for a daily round. "Copy the list" gives you titles, prices and links as text, and
  **Download (CSV)** a spreadsheet with prices, dates and the latest score (also in Settings → Backup).
  Prices update whenever a saved listing is on your screen again; nothing is checked in the
  background.
- **Try on Marketplace / Try on eBay** runs your words on the other site.

**On a listing page**: when you saw it before, its price history ("$70 (Sep 30) → $60 (Oct 5) →
$55 now", with a small line of it), Save, Hide, and Sold on eBay. How long it's been listed (when the
page says), how a saved one moved ("Down $25 (−21%) since you saved it"), and whether the seller may take less
(price drops, weeks on sale, "moving sale", takes offers). With sold prices known, an **offer**: what to open
at and when to walk away, worked out from the sales, with a message to the seller you can pick, edit and copy
(nothing is typed into the site or sent). When the seller answers, type their price under **They said $** and it
says whether to take it, meet in the middle or make a last offer at your walk-away price, and rewrites the message.
With a key, **Analyze** is given the same plan and keeps its offer range near it. Marketplace listings also warn when the seller's account was made this
year ("Joined Facebook in 2026").

**In settings**: words to always filter by, in the filter bar's syntax (`-replica -repro -"box only"`
drops those; a plain word must be in the title). Older "always hide" and "only show" lists were
turned into this line. Hidden and filtered listings are never sent to a model. **Find photo**
(in a tag's hover card or the listing view) runs a reverse image search, to catch photos lifted
from elsewhere.

**Which marks show** (settings, Filters and marks): scam marks, price words and the other marks (new to you,
drops, auctions, lots) each have a switch, and **Marks per listing** can be 1 (scam marks always come first).
With price words and other marks off, cards carry only scam warnings. Scam marks can be turned off on the cards
too, after a confirm; the panel's list and the listing page still warn, and a likely scam is no longer grayed out.

## Model and cost

Scans use their own model, **Haiku 5.5** by default (about a fortieth of Opus 5.5's price; a scan sends
many listings at once), set under "Model for scans" in settings; analyzing one listing, photo
checks and search ideas use the main model. New installs start the main model on **Sonnet 5.5**, and the scan's fixed instructions are marked for the API's prompt cache, so later batches read them cheaper. Existing installs keep the model they chose. The menu at the bottom of the panel switches models straight away: **Opus 5.5** (best),
**Sonnet 5.5** (half the price), **Haiku 5.5** (about a fortieth), the other AI service you've set up,
or your **Ollama** model (free, local). Next to it is this month's spend on paid AI; click it for
today, this month, last month and each model's cost per call. Set a monthly budget in settings and
paid AI stops when it's reached.

The **Scan** button says how many listings it would send and about what that costs ("Scan 48
listings · about $0.26"), from what scoring has actually cost you per listing with that model.
**Stop** appears beside the status line while the model works (scans, analyses, photo checks,
ideas): nothing new is sent, requests under way are canceled, and what already came back stays.

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

Pick the service, paste the key, press **Test connection** (it lists the models into the Model menu, and remembers them), and pick one. Every model field is a menu (Claude's three models, what Test connection found, your installed Ollama models) with **Another model…** for typing an ID. A
separate photo model is optional (it has to accept images). For spending on services other than
Claude and OpenRouter, enter their prices per million tokens. If a model can't do structured
output, Tirekick falls back to plain JSON, so most chat models work; small ones judge less well.

To keep costs down, scores are remembered for a day (re-scans and coming back are free), up to
three requests run at once, and a failed request's listings come back on the next scan. Spending
is estimated from token counts at list price: a regular API key can't read your real balance,
which is at console.anthropic.com.

## Look

Plain and built to be read: dark first, a hairline and a word beside every color, numbers in a
monospaced face so prices line up. **Settings → On the page → Theme**: *Match the page* (the
default), *Dark* or *Light*. Match gives the panel and the marks on eBay and Marketplace cards the
page's own colors (its real background, so a site's dark mode or a dark-mode extension counts). One scale everywhere (panel, card marks, photo card, settings): sizes 11, 12, 13, 14, 15, 18, 22 (10 only inside the score tag), weights 400 and 600 (800 for numerals and headings). Buttons come in three tiers: filled (the one action to take: Scan, Analyze, Test connection), outlined (other actions), and plain underlined text for actions inside a list; a red outline means it clears something. Color carries meaning only: the verdict colors, red for scams and clearing things, orange for "new" and "at your price". The tag's word and the line beside it use the same vocabulary (Great / Great deal, Fair / Fair price, Scam? / Suspicious). Type is Bricolage Grotesque (bundled), a
narrower cut for the wordmark, headings, scores and prices. Scores are tread dots: the fill is the verdict, and the tread
around it shows how much is left, one mark per 5 points (a full ring is a great deal), Skip is hollow and Likely scam carries a "!" badge, and each verdict word has its own
glyph, so color is never the only cue. Palettes, type, the dot and the glyphs all live in `lib/theme.js`, which the
panel, the card tags and the settings page read. Text contrast is 4.5:1 or better in both themes, and control
borders 3:1 or better.

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

When a scan finds no listings, or a listing can't be read, the status line offers **Check this page**: it counts the cards found, how many had a title, price, photo and seller rating, and the state of the sold-price lookups, then copies that report (counts and three public titles, nothing else) for a bug report.

Both sites change their markup without warning. If a scan says "No listings found":

- **eBay**: in DevTools (F12), inspect a result card. Current layout uses `li.s-card` with
  `.s-card__title` / `.s-card__price`; the older one used `s-item`; category pages (`/b/…`) use
  `li.brwrvr__item-card`. Add what you find to `EBAY_CARDS` and the selector lists in
  `extractEbay` (`content/adapters.js`).
- **Facebook**: the adapter doesn't use class names. It finds every link to
  `/marketplace/item/<id>` and reads the text inside; check what card links look like now.

**eBay shows "Checking your browser" or won't load**: eBay does this to traffic that looks
automated, and then ordinary page loads get it too for a while (refreshing usually clears it).
Tirekick's only automated traffic is the sold-price lookups: at least 5 seconds apart, at
most 8 an hour, remembered for a day, one lookup per search even with several tabs asking, and
paused for an hour at the first check, longer (up to 6 hours) and at half the pace if it comes back the
same day (the price box then links to eBay's own sold listings). On Facebook, keep an eBay tab open: lookups then run
from that tab, like eBay's own pages, which eBay questions far less. If it keeps happening, untick "Compare prices with
recent eBay sales"; if it still happens, untick "Show a slim tab" too, which leaves eBay pages
untouched until you click the toolbar icon.

After editing any file, press the reload arrow on the extension in `vivaldi://extensions` and
refresh the tab. The version number there tells you which copy is running.

## How the pieces fit

| File | Job |
|---|---|
| `manifest.json` | Permissions, icon, keyboard shortcut. With "Show a slim tab" on, `background.js` registers `content/*` for eBay and Facebook pages; with it off, they load only when you click the toolbar icon |
| `lib/sites.js` | The sites it works on, in one table: names, addresses, listing keys, which page is a search or a listing, photo hosts, how each site's cards behave. Loaded first everywhere; adding a site starts here (`docs/adding-a-site.md`) |
| `lib/shared.js` | Small pieces shared by the worker, the pages and settings: the link and photo-host checks, settings limits (also applied to restored backups), alert rules, the spend summary, the price sparkline |
| `lib/theme.js` | The look in one place: both color themes, the Bricolage Grotesque faces, the tread-dot score, the verdict glyphs and the wordmark. Change a color or shape here and the panel, card tags and settings follow; `node scripts/icons.mjs` redraws the toolbar icons from it |
| `content/rules.js` | The plain rules (words and filters, scam signs, photo verdicts, fix-up words) as functions with no page, storage or network |
| `content/home.js` | Home: in the panel's tab and on Tirekick's own page (with its styles) |
| `lib/sold.js` | eBay sold-price lookups with one pace, cache and back-off for every page |
| `hub/hub.html`, `hub/hub.js` | Tirekick's own page, for anywhere: look something up, saved listings and searches, Home |
| `content/adapters.js` | Reads listings (and auctions, lots, offers, seller ratings, scam signs) off each site into one shared shape, through per-site tables (`READERS`, `ITEM_READERS`, `SEARCH_BUILDERS`, `LISTING_LINKS`, `CARD_FINDERS`, `BROWSE_CONTEXT`); the sold-price median |
| `content/panel.js` | The panel, tags on cards, the scan, memory of seen and hidden listings, filters, the listing view |
| `background.js` | Talks to Claude, other AI services or Ollama (retries, timeouts, Stop, cost tracking, budget), fetches photos and eBay sold results for Facebook pages; holds the prompts |
| `options/` | Settings page |
| `icons/` | The toolbar icon |

The ranking prompt (`RANK_BASE`, `SCAM_RULE` and `LENS_RULES` in `background.js`) is the part most worth tuning.

## Ground rules

eBay's and Meta's terms prohibit automated, unattended collection, and that's what gets accounts
flagged. Every change keeps to these:

- **Only pages you're looking at.** Tirekick reads the listings on a page open in your browser, and
  never opens, crawls or refreshes a marketplace page by itself. Automatic scanning reads the search
  you're looking at as it loads, only while that tab is on your screen.
- **Requests to the sites are few, spaced and started by you.** eBay sold-price lookups happen because
  you pressed something (or turned on automatic scanning): at most eight an hour, five seconds apart,
  cached for a day, from your own browser.
- **Never get past a bot check.** At the first sign of eBay's "checking your browser" page, lookups stop
  for an hour (half an hour for the background route) and say so. Nothing tries to solve, avoid or
  disguise itself from a check, a captcha or a rate limit.
- **Nothing leaves the browser except to the AI service you chose, and eBay's own search.** No server,
  no analytics, no account; no listing data is republished anywhere.
- **No logos, no implied endorsement.** "eBay" and "Facebook Marketplace" name what it works with.
- **Estimates, said to be estimates.** Scores, prices, price gaps and warnings help you decide; they aren't
  advice or a guarantee, and the extension says how far each one can be trusted.

## How Tirekick is made

Tirekick's maintainer, dabloonery, writes the basis of Tirekick, meaning who it's for, what it does, and the first version of each
feature, rule and piece of wording. Then it goes through Claude, Anthropic's AI model, to make it more accurate and
efficient, with tighter code, more tests and clearer wording, through pull requests in this repository. Every
change has to pass the full test suite (`deno task test`) before it reaches main, and commits made with Claude say
so in their `Co-Authored-By` line.

**A note on AI.** I use AI to build Tirekick, and I try to weigh what it costs as well as what it gives. The costs
are real. Models take a lot of energy and water to train and run. They make it easier to deceive people, and the
kind of scam listing Tirekick looks for can now be written in seconds. They are also being used to cut jobs and
weaken labor rights, often trained on the work of the very people they replace, while the gains go to a few. I
still believe AI can make us more productive and do real good, but only when it's used with care, where it truly
helps and not where a simpler tool would do. That's the line Tirekick tries to hold. Its core checks are plain
rules that run without any AI, a model is only called when you ask for one, a scan sends as little as it can, and a
person decides what Tirekick does and stands behind what ships.

## License and disclaimer

Copyright 2026 dabloonery and the Tirekick authors. Licensed under the [Apache License 2.0](LICENSE); `NOTICE` has the
attribution, the disclaimer below and the trademark note, and travels with every copy.
The bundled Bricolage Grotesque font is under the SIL Open Font License (`fonts/LICENSE.md`).

Scores, verdicts, price comparisons, margins, scam warnings, repair guesses and suggested offers are
estimates produced by software and AI models from what a listing shows: information, not advice, and
not a guarantee about any item, seller or price. Check listings and sellers yourself.

Not affiliated with or endorsed by eBay Inc. or Meta Platforms, Inc. eBay and Facebook are trademarks of
their respective owners.

## Tests

`deno task test` runs everything (needs Chrome or Chromium, `deno`, `python3` and `openssl`; see CONTRIBUTING.md): the fixture
pages and plain rules (`tests/run.sh`), then the real unpacked extension in headless Chrome against eBay- and
Marketplace-shaped pages and a mock Claude API (`tests/e2e/`), ending with a performance guard on a long
Marketplace feed. Nothing touches the real sites or a real model. `tests/README.md` lists what each file checks and
what to do when eBay or Facebook change their pages.

The version in `manifest.json` changes only when a build goes to the Chrome Web Store; pull requests in between
keep it as it is, and CI fails one that lowers it (`deno task version-check`).
