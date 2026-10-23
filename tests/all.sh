#!/bin/sh
# Everything: the fixture pages and plain rules, then the real extension. Fails if any line says FAIL.
# Usage: tests/all.sh   (or: deno task test)
# (Deno colors "error:", so a crash is caught by "Uncaught" alone.)
cd "$(dirname "$0")" || exit 1
export NO_COLOR=1 # deno colors "error: Uncaught", which the checks below look for
out=$(./run.sh); echo "$out"
echo "$out" | grep -q '^FAIL' && exit 1
for t in adapters.ts features.ts ux.ts states.ts first-run.ts scores-persist.ts marketplace.ts rename.ts robust.ts free.ts photos.ts tidy.ts real.ts marks.ts ai-off.ts; do
  echo "== e2e/$t"
  out=$(e2e/run.sh "$t" 2>&1); echo "$out"
  echo "$out" | grep -qE '^FAIL|Uncaught' && exit 1
done
echo "== e2e/perf.ts (guard)"
out=$(PERF_GUARD=1 PERF_MEMORY=5000 e2e/run.sh perf.ts 2>&1); echo "$out"
echo "$out" | grep -qE '^FAIL|Uncaught' && exit 1
rm -f e2e/*.png
echo "all tests passed"
