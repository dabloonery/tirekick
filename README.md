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
5. Right-click any photo on eBay or Facebook and choose **Check this photo with Second Look**.

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
4. **Use it.** Search eBay or Facebook Marketplace, scroll so results load, click the
   toolbar icon to open the panel, then press
   **Scan this page** in the panel at the bottom right. Click a title in the panel
   to jump to that card.

## How the pieces fit

| File | Job |
|---|---|
| `manifest.json` | Permissions. There are no automatic content scripts: `background.js` injects `content/*` only when you click the toolbar icon |
| `content/adapters.js` | Reads listings off each site into one shared shape; computes the sold-price median |
| `content/panel.js` | The panel, the scan loop, the badges on cards, the single-listing view, the photo-check popup |
| `background.js` | Talks to Claude or Ollama, fetches photos and eBay sold results; holds the ranking prompt |
| `options/` | Settings page |

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

After editing, hit the reload arrow on the extension in `vivaldi://extensions` and
refresh the tab.

## Things to know

- A 4B model is a quick first filter, not an appraiser. Read its reasons.
- The sold-price median is only as good as your search words. "Pentax K1000 body"
  compares better than "camera".
- Your 3050 Ti has 4 GB of VRAM. If scans are slow, lower "Listings per request"
  or try `llama3.2:3b` as the ranking model.
- This reads pages you're already looking at, one scan at a time when you press the
  button. Keep it that way: automated, unattended collection is what Meta and eBay's
  terms prohibit and what gets accounts flagged.
