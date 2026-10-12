#!/bin/sh
# Everything: the fixture pages and plain rules, then the real extension. Fails if any line says FAIL.
# Usage: tests/all.sh   (or: deno task test)
cd "$(dirname "$0")" || exit 1
out=$(./run.sh); echo "$out"
echo "$out" | grep -q '^FAIL' && exit 1
for t in adapters.ts features.ts ux.ts scores-persist.ts marketplace.ts; do
  echo "== e2e/$t"
  out=$(e2e/run.sh "$t" 2>&1); echo "$out"
  echo "$out" | grep -qE '^FAIL|error: Uncaught' && exit 1
done
rm -f e2e/*.png
echo "all tests passed"
