#!/bin/sh
# Renders store/art.html into the store's promo tiles and captioned screenshots:
# Also puts the panel in screenshots 4 and 5 over the real eBay page from screenshot 1.
#   store/promo-small.png (440 x 280), store/promo-marquee.png (1400 x 560), store/screenshots/captioned/N.png (1280 x 800).
# Headless Chrome's viewport is shorter than its window, so each piece is shot in a tall window and cropped.
# Needs google-chrome-stable or chromium, and python3 with Pillow. Usage: scripts/store-art.sh
CHROME="${CHROME_BIN:-$(command -v google-chrome-stable || command -v chromium || echo chromium)}"
cd "$(dirname "$0")/.." || exit 1
TMP="$(mktemp -d)"
mkdir -p store/screenshots/captioned
shoot() { # art width height out
  "$CHROME" --headless=new --no-sandbox --disable-gpu --hide-scrollbars --allow-file-access-from-files --virtual-time-budget=3000 \
    --user-data-dir="$TMP/p" --screenshot="$TMP/s.png" --window-size="$2,$(($3 + 300))" "file://$PWD/store/art.html?art=$1" 2>/dev/null
  python3 -c "import sys; from PIL import Image; Image.open(sys.argv[1]).convert('RGB').crop((0,0,int(sys.argv[2]),int(sys.argv[3]))).save(sys.argv[4], optimize=True)" "$TMP/s.png" "$2" "$3" "$4"
  echo "$4"
}
# 4 and 5 come from tests/e2e/screenshots.ts on a test page; put their panel over the real eBay search from 1
# instead, so the page behind is a real one. The panel sits at the same place in both, so this can run twice.
python3 - <<'PY'
from PIL import Image, ImageDraw
back = Image.open("store/screenshots/1-ebay-search.png").convert("RGB")
ImageDraw.Draw(back).rectangle((1264, 190, 1279, 799), fill=back.getpixel((1275, 150)))  # the edge of the old panel
for n in ("4-home", "5-saved"):
    shot = Image.open(f"store/screenshots/{n}.png").convert("RGB")
    panel = shot.crop((884, 28, 1264, 780))
    mask = Image.new("L", panel.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, panel.width - 1, panel.height - 1), radius=12, fill=255)
    out = back.copy(); out.paste(panel, (884, 28), mask); out.save(f"store/screenshots/{n}.png", optimize=True)
PY
shoot small 440 280 store/promo-small.png
shoot marquee 1400 560 store/promo-marquee.png
for n in 1 2 3 4 5; do
  f=$(ls store/screenshots/$n-*.png | head -1)
  shoot "shot$n" 1280 800 "store/screenshots/captioned/$(basename "$f")"
done
rm -rf "$TMP"
