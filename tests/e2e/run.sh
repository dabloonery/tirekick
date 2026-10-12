#!/bin/sh
# Real-extension check: loads the unpacked extension in headless Chrome, serves eBay-shaped pages as
# https://www.ebay.com (host-mapped to localhost) and a mock Claude API, then drives it over DevTools.
# Needs google-chrome-stable, deno, openssl. Usage: tests/e2e/run.sh scores-persist.ts
cd "$(dirname "$0")" || exit 1
# The throwaway test certificate and extension id live outside the extension folder (Chrome warns about key files inside it).
export E2E_TMP="$(mktemp -d)"
openssl req -x509 -newkey rsa:2048 -nodes -keyout "$E2E_TMP/key.pem" -out "$E2E_TMP/cert.pem" -days 2 -subj "/CN=www.ebay.com" -addext "subjectAltName=DNS:www.ebay.com" 2>/dev/null
deno run -A server.ts >/dev/null 2>&1 &
SRV=$!
google-chrome-stable --headless=new --no-sandbox --disable-gpu --user-data-dir="$(mktemp -d)" --remote-debugging-port=9222 \
  --enable-unsafe-extension-debugging --ignore-certificate-errors --host-resolver-rules="MAP www.ebay.com 127.0.0.1:8443" about:blank >/dev/null 2>&1 &
CH=$!
sleep 3
deno run -A load.ts >/dev/null 2>&1; sleep 2
deno run -A "${1:-scores-persist.ts}"
kill $CH $SRV 2>/dev/null; rm -rf "$E2E_TMP"
