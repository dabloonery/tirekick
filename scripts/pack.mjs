// Builds dist/second-look-<version>.zip: only what the extension needs, checked first.
//   deno task pack     (or: node scripts/pack.mjs)
// No dependencies: it writes the zip itself (deflate, fixed timestamps, so the same files give the same zip).

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const problems = [];
const fail = (msg) => problems.push(msg);

// ---------- what ships ----------
const SHIP = ["manifest.json", "background.js", "content", "options", "lib", "icons"];
const files = [];
const walk = (rel) => {
  const full = path.join(ROOT, rel);
  if (fs.statSync(full).isDirectory()) for (const n of fs.readdirSync(full).sort()) walk(path.posix.join(rel.split(path.sep).join("/"), n));
  else files.push(rel.split(path.sep).join("/"));
};
for (const s of SHIP) fs.existsSync(path.join(ROOT, s)) ? walk(s) : fail(`missing: ${s}`);

// ---------- checks ----------
const manifest = JSON.parse(read("manifest.json"));
if (manifest.description.length > 132) fail(`the description is ${manifest.description.length} characters; the Chrome Web Store allows 132`);
for (const size of Object.keys(manifest.icons || {})) if (!files.includes(manifest.icons[size])) fail(`icon not found: ${manifest.icons[size]}`);
for (const f of [manifest.background?.service_worker, manifest.options_ui?.page]) if (f && !files.includes(f)) fail(`not found: ${f}`);
// every file the background script injects into pages, and every script a page of ours loads
const bg = read("background.js");
for (const [, f] of bg.matchAll(/"((?:content|lib)\/[\w.-]+\.js)"/g)) if (!files.includes(f)) fail(`background.js names ${f}, which isn't there`);
for (const html of files.filter((f) => f.endsWith(".html"))) {
  for (const [, src] of read(html).matchAll(/<script[^>]+src="([^"]+)"/g)) {
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(html), src));
    if (!files.includes(target)) fail(`${html} loads ${src}, which isn't there`);
  }
}
if (files.some((f) => /\.map$|^tests\/|node_modules|\.test\./.test(f))) fail("test or build files would ship");
const bigNames = files.filter((f) => fs.statSync(path.join(ROOT, f)).size > 400 * 1024);
if (bigNames.length) fail(`unusually large: ${bigNames.join(", ")}`);
if (problems.length) {
  console.error(problems.map((p) => `  ✗ ${p}`).join("\n"));
  (globalThis.Deno ? Deno.exit : process.exit)(1);
}

// ---------- zip ----------
// zlib.crc32 is in Node 22 and later; otherwise the usual table-driven CRC-32.
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crcOf =
  zlib.crc32 ??
  ((buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  });
const parts = [];
const central = [];
let offset = 0;
const DOS_DATE = (0 << 9) | (1 << 5) | 1; // 1980-01-01
for (const name of files) {
  const data = fs.readFileSync(path.join(ROOT, name));
  const deflated = zlib.deflateRawSync(data, { level: 9 });
  const [method, body] = deflated.length < data.length ? [8, deflated] : [0, data];
  const nameBuf = Buffer.from(name, "utf8");
  const crc = crcOf(data);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6); // names are UTF-8
  local.writeUInt16LE(method, 8);
  local.writeUInt16LE(0, 10);
  local.writeUInt16LE(DOS_DATE, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(body.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBuf.length, 26);
  parts.push(local, nameBuf, body);
  const entry = Buffer.alloc(46);
  entry.writeUInt32LE(0x02014b50, 0);
  entry.writeUInt16LE((3 << 8) | 20, 4);
  entry.writeUInt16LE(20, 6);
  entry.writeUInt16LE(0x0800, 8);
  entry.writeUInt16LE(method, 10);
  entry.writeUInt16LE(0, 12);
  entry.writeUInt16LE(DOS_DATE, 14);
  entry.writeUInt32LE(crc, 16);
  entry.writeUInt32LE(body.length, 20);
  entry.writeUInt32LE(data.length, 24);
  entry.writeUInt16LE(nameBuf.length, 28);
  entry.writeUInt32LE((0o100644 << 16) >>> 0, 38);
  entry.writeUInt32LE(offset, 42);
  central.push(entry, nameBuf);
  offset += local.length + nameBuf.length + body.length;
}
const centralBuf = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralBuf.length, 12);
end.writeUInt32LE(offset, 16);
const zip = Buffer.concat([...parts, centralBuf, end]);

fs.mkdirSync(path.join(ROOT, "dist"), { recursive: true });
const out = path.join(ROOT, "dist", `second-look-${manifest.version}.zip`);
fs.writeFileSync(out, zip);
console.log(`${files.length} files, ${(zip.length / 1024).toFixed(0)} KB → ${path.relative(ROOT, out)}`);
