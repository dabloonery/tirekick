#!/bin/sh
# Loads each fixture in headless Chrome and prints PASS/FAIL lines.
# Usage: tests/run.sh   (needs google-chrome-stable and python3)
cd "$(dirname "$0")" || exit 1
PORT=${PORT:-8765}
python3 -m http.server "$PORT" >/dev/null 2>&1 &
SRV=$!
PROFILES="$(mktemp -d)" # browser profiles for this run, removed at the end
trap 'kill $SRV; rm -rf "$PROFILES"' EXIT
sleep 1
for path in "sch/i.html?_nkw=pentax+k1000" "marketplace/item/1590480216438381/" "itm/184891897312.html"; do
  google-chrome-stable --headless=new --disable-gpu --no-sandbox --user-data-dir="$(mktemp -d -p "$PROFILES")" \
    --host-resolver-rules="MAP www.ebay.com 127.0.0.1" --virtual-time-budget=5000 --dump-dom \
    "http://www.ebay.com:$PORT/$path" 2>/dev/null \
    | sed -n '/<pre id="result">/,/<\/pre>/p' | sed 's/<[^>]*>//g' | grep -E '^(PASS|FAIL)'
done
# the real settings page, with stubbed extension APIs injected around it
sed -e 's#<script src="options.js">#<script src="/opts-stub.js"></script><script src="options.js">#' \
    -e 's#</body>#<script src="/opts.test.js"></script></body>#' \
    -e 's#<head>#<head><base href="/options/">#' ../options/options.html > _opts.html
google-chrome-stable --headless=new --disable-gpu --no-sandbox --user-data-dir="$(mktemp -d -p "$PROFILES")" \
  --host-resolver-rules="MAP www.ebay.com 127.0.0.1" --virtual-time-budget=6000 --dump-dom \
  "http://www.ebay.com:$PORT/_opts.html" 2>/dev/null \
  | sed -n '/<pre id="result">/,/<\/pre>/p' | sed 's/<[^>]*>//g' | grep -E '^(PASS|FAIL)'
rm -f _opts.html

# the scam rules on their own
deno run --allow-read offsite.test.mjs
deno test --allow-read unit/ >/dev/null 2>&1 && echo "PASS unit tests (rules, shared, adapters)" || echo "FAIL unit tests: run  deno test --allow-read tests/unit/  for details"
