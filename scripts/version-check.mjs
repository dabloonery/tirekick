// Fails if manifest.json's version is lower than on the branch a change is going into. The same number is
// fine: main carries the next upload's number and moves one step per Chrome Web Store upload (dabloonery,
// 2026-10-28), so pull requests in between keep it as it is.
// Usage: deno run --allow-read --allow-run --allow-env scripts/version-check.mjs origin/main   (CI passes the PR's base)
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const base = process.argv[2] || "origin/main";
const parse = (v) => String(v).split(".").map((n) => Number(n) || 0);
const newer = (a, b) => {
  const x = parse(a), y = parse(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
};
const here = JSON.parse(fs.readFileSync(new URL("../manifest.json", import.meta.url), "utf8")).version;
let there;
try {
  there = JSON.parse(execFileSync("git", ["show", `${base}:manifest.json`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })).version;
} catch {
  console.log(`version ${here}: no manifest on ${base} to compare with`);
  process.exit(0);
}
if (newer(there, here)) {
  console.error(`FAIL version ${here} is lower than ${there} on ${base}: put "version" in manifest.json back`);
  process.exit(1);
}
console.log(`version ${here} (was ${there} on ${base})`);
