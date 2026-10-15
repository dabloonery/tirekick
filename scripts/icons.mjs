// Draws the toolbar and store icons (icons/icon16|32|48|128.png) from lib/theme.js, so a color or
// tread change there can be carried to the icons too. Each size is drawn for its size, not scaled:
//   16  the dot with 6 chunky tread marks and the hub, no tile (the toolbar is its background)
//   32  the dot with 8 tread marks and the hub, no tile
//   48+ the dot with 12 tread marks and the hub, on a navy tile (T.logoTread picks the count)
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

const svg = (vb, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vb} ${vb}" width="SIZE" height="SIZE">${body}</svg>`;
const ICON = {
  16: svg(16, `<circle cx="8" cy="8" r="7.75" fill="${T.ORANGE}"/>${T.logoTread(8, 7.75, 16)}<circle cx="8" cy="8" r="2.5" fill="${T.NAVY}"/>`),
  32: svg(32, `<circle cx="16" cy="16" r="15.5" fill="${T.ORANGE}"/>${T.logoTread(16, 15.5, 32)}<circle cx="16" cy="16" r="4.6" fill="${T.NAVY}"/>`),
  128: svg(
    128,
    `<rect width="128" height="128" rx="28" fill="${T.NAVY}"/><circle cx="64" cy="64" r="47" fill="${T.ORANGE}"/>${T.logoTread(64, 47, 128)}` +
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
