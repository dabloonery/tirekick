#!/bin/sh
# The Firefox zip (what goes to addons.mozilla.org) in headless Firefox, against the same fake eBay, Facebook and AI
# server as the Chrome runs: tests/e2e/firefox.ts over WebDriver BiDi (bidi.ts). Builds the zips first.
# Needs Firefox 140 or later (FIREFOX_BIN, or firefox on the PATH), deno and openssl.
#   tests/e2e/firefox.sh            FIREFOX_BIN=/path/to/firefox tests/e2e/firefox.sh
cd "$(dirname "$0")" || exit 1
FIREFOX="${FIREFOX_BIN:-$(command -v firefox)}"
[ -x "$FIREFOX" ] || { echo "SKIP firefox.ts: no Firefox (set FIREFOX_BIN)"; exit 0; }
"$FIREFOX" --version
deno run -A ../../scripts/pack.mjs >/dev/null || exit 1
export E2E_TMP="$(mktemp -d)"
export EXT_DIR="$E2E_TMP/ext"
mkdir -p "$EXT_DIR" && (cd "$EXT_DIR" && unzip -q "$OLDPWD"/../../dist/tirekick-*-firefox.zip)
openssl req -x509 -newkey rsa:2048 -nodes -keyout "$E2E_TMP/key.pem" -out "$E2E_TMP/cert.pem" -days 2 -subj "/CN=www.ebay.com" -addext "subjectAltName=DNS:www.ebay.com,DNS:www.facebook.com,DNS:scontent.test.fbcdn.net" 2>/dev/null
deno run -A server.ts >/dev/null 2>&1 &
SRV=$!
# A fresh profile. The store hosts resolve here and port 443 goes to the fake server's 8443 (Chrome's runs map hosts
# with --host-resolver-rules); no proxy, even if the machine has one; the remote debugging server for installing the
# add-on; optional permissions granted without a prompt (nobody is there to click it); the add-on's moz-extension://
# address pinned (UUID in bidi.ts); the extension's console on stdout, for FIREFOX_LOG. MOZ_REMOTE_ALLOW_SYSTEM_ACCESS lets newer
# Firefox run scripts in moz-extension:// pages over BiDi.
PROFILE="$E2E_TMP/profile"
mkdir -p "$PROFILE"
cat > "$PROFILE/user.js" <<'EOF'
user_pref("network.dns.localDomains", "www.ebay.com,www.facebook.com,sfbay.craigslist.org,www.craigslist.org,scontent.test.fbcdn.net");
user_pref("network.socket.forcePort", "443=8443");
user_pref("network.proxy.type", 0);
user_pref("devtools.debugger.remote-enabled", true);
user_pref("devtools.chrome.enabled", true);
user_pref("devtools.debugger.prompt-connection", false);
user_pref("extensions.webextOptionalPermissionPrompts", false);
user_pref("extensions.webextensions.uuids", "{\"tirekick@tirekick.app\":\"7e5e7e5e-1111-4222-8333-944444444444\"}");
user_pref("devtools.console.stdout.chrome", true);
user_pref("browser.shell.checkDefaultBrowser", false);
user_pref("browser.startup.homepage_override.mstone", "ignore");
user_pref("datareporting.policy.dataSubmissionEnabled", false);
user_pref("toolkit.telemetry.reportingpolicy.firstRun", false);
user_pref("app.update.disabledForTesting", true);
user_pref("browser.aboutwelcome.enabled", false);
EOF
LOG="${FIREFOX_LOG:-$E2E_TMP/firefox.log}"
MOZ_REMOTE_ALLOW_SYSTEM_ACCESS=1 "$FIREFOX" -headless -no-remote -profile "$PROFILE" --remote-debugging-port 9223 -start-debugger-server 6000 about:blank >"$LOG" 2>&1 &
FF=$!
for _ in $(seq 1 60); do grep -q "WebDriver BiDi listening" "$LOG" 2>/dev/null && break; sleep 0.5; done
deno run -A firefox.ts
CODE=$?
kill $FF $SRV 2>/dev/null; wait $FF 2>/dev/null; sleep 1; rm -rf "$E2E_TMP" 2>/dev/null
exit $CODE
