# Second Look

A browser extension that scans an eBay or Facebook Marketplace search results page,
ranks every listing with a model running on your own laptop (Ollama), and puts a
score sticker on each card. Optional: compare prices against recent eBay sold
listings, and ask a vision model to look at a listing photo.

Nothing leaves your computer except one ordinary eBay sold-listings search per scan
(turn that off in settings if you like).

## Setup (CachyOS, about 30 minutes, mostly downloads)

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
4. **Use it.** Search eBay or Facebook Marketplace, scroll so results load, press
   **Scan this page** in the panel at the bottom right. Click a title in the panel
   to jump to that card.

## How the pieces fit

| File | Job |
|---|---|
| `manifest.json` | Permissions and which pages the scripts run on |
| `content/adapters.js` | Reads listings off each site into one shared shape; computes the sold-price median |
| `content/panel.js` | The panel, the scan loop, the stickers on cards |
| `background.js` | Talks to Ollama, fetches photos and eBay sold results; holds the ranking prompt |
| `options/` | Settings page |

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
