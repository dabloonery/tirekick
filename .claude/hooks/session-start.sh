#!/bin/sh
# Cloud sessions only: make `deno task test` runnable. deno.land is blocked there, but npm carries deno.
# Chrome needs nothing: tests/chrome.sh finds the Chromium the container ships.
[ "$CLAUDE_CODE_REMOTE" = "true" ] || exit 0
command -v deno >/dev/null 2>&1 && exit 0
npm install -g deno >/dev/null 2>&1 || echo "Couldn't install deno with npm; tests won't run until it's installed." >&2
exit 0
