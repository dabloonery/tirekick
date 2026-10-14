// Draws the toolbar and store icons (icons/icon16|32|48|128.png) from lib/theme.js, so a color or
// tread change there can be carried to the icons too. Each size is drawn for its size, not scaled:
//   16  an orange dot with a navy hub (a tire at a glance, no detail to blur)
//   32  the dot with 12 tread marks and the hub
//   48+ the dot with 22 tread marks and the hub, on a navy tile
// The same mark as the panel header and the settings page: one logo everywhere.
// Needs Playwright and a Chromium (not a dependency of the extension):
//   node scripts/icons.mjs [path to playwright's index.mjs] [path to chromium]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
globalThis.self = globalThis;
await import(pathToFileURL(path.join(ROOT, "lib/theme.js")).href);
const T = self.TKTheme;
const { chromium } = await import(process.argv[2] || "playwright");

const mix = (a, b, t) => "#" + [1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t).toString(16).padStart(2, "0")).join("");
const SHADE = mix(T.ORANGE, T.NAVY, 0.3); // the tread marks: the orange, darkened toward navy
const tread = (c, r, n, w, len) =>
  Array.from({ length: n }, (_, i) => {
    const y0 = c - r * 0.92;
    return `<path d="M${c} ${y0.toFixed(2)}L${(c + len * 0.75).toFixed(2)} ${(y0 + len).toFixed(2)}" stroke="${SHADE}" stroke-width="${w.toFixed(2)}" stroke-linecap="round" transform="rotate(${((360 / n) * i).toFixed(2)} ${c} ${c})"/>`;
  }).join("");
const svg = (vb, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vb} ${vb}" width="SIZE" height="SIZE">${body}</svg>`;
const ICON = {
  16: svg(16, `<rect width="16" height="16" rx="3.5" fill="${T.NAVY}"/><circle cx="8" cy="8" r="6.8" fill="${T.ORANGE}"/><circle cx="8" cy="8" r="2.5" fill="${T.NAVY}"/>`),
  32: svg(32, `<rect width="32" height="32" rx="7" fill="${T.NAVY}"/><circle cx="16" cy="16" r="13.8" fill="${T.ORANGE}"/>${tread(16, 13.8, 12, 13.8 * 0.09, 13.8 * 0.16)}<circle cx="16" cy="16" r="4.6" fill="${T.NAVY}"/>`),
  128: svg(
    128,
    `<rect width="128" height="128" rx="28" fill="${T.NAVY}"/><circle cx="64" cy="64" r="47" fill="${T.ORANGE}"/>${tread(64, 47, 22, 47 * 0.065, 47 * 0.1)}` +
      `<circle cx="64" cy="64" r="16" fill="${T.NAVY}"/>`
  ),
};
ICON[48] = ICON[128];

const font = fs.readFileSync(path.join(ROOT, "fonts", T.FONT_FILE)).toString("base64");
const browser = await chromium.launch({ executablePath: process.argv[3] || undefined, args: ["--no-proxy-server"] });
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const size of [16, 32, 48, 128]) {
  await page.setContent(
    `<style>@font-face { font-family:"TK Display"; font-weight:700 800; font-stretch:85%; src:url(data:font/woff2;base64,${font}); } body { margin:0; }</style>${ICON[size].replaceAll("SIZE", size)}`
  );
  await page.evaluate(() => document.fonts.load('800 44px "TK Display"'));
  fs.writeFileSync(path.join(ROOT, "icons", `icon${size}.png`), await page.locator("svg").screenshot({ omitBackground: true }));
  console.log(`icons/icon${size}.png`);
}
await browser.close();
