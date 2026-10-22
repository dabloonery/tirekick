# The browser the tests drive, for tests/run.sh and tests/e2e/run.sh (sourced, not run). $CHROME_BIN wins; then an
# installed Chrome or Chromium; then Playwright's Chromium, which cloud containers ship under /opt/pw-browsers.
CHROME="${CHROME_BIN:-$(command -v google-chrome-stable || command -v chromium || command -v chromium-browser || ls /opt/pw-browsers/chromium-*/chrome-linux/chrome 2>/dev/null | tail -n 1)}"
CHROME="${CHROME:-google-chrome-stable}"
# Every page is local, so no proxy (a container's proxy would get the fake eBay's requests instead), and the
# Chromium builds that turn --load-extension off get it back.
CHROME_FLAGS="--no-proxy-server --disable-features=DisableLoadExtensionCommandLineSwitch"
