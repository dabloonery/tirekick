// Fails unless manifest.json's version is higher than on the branch a change is going into, so every
// change ships with a new number and the extensions page always tells which copy is running.
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
if (!newer(here, there)) {
  console.error(`FAIL version ${here} isn't higher than ${there} on ${base}: bump "version" in manifest.json`);
  process.exit(1);
}
console.log(`version ${here} (was ${there} on ${base})`);
