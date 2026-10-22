// The same photo on other listings (Marketplace), on the real extension with no model: one picture uploaded
// again under another title is marked on both cards, the same file (a relist) and other pictures aren't, and
// it's remembered for later pages. Prints PASS/FAIL lines.
//   tests/e2e/run.sh photos.ts
import { start, EXT, sleep } from "./lib.ts";
const { open, c } = await start();
let fails = 0;
const ok = (name: string, cond: unknown, why: unknown = "") => {
  if (!cond) fails++;
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${cond ? "" : ": " + (typeof why === "string" ? why : JSON.stringify(why))}`);
};
const errors: string[] = [];
c.on((m: any) => {
  if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text);
});
const o = await open(`chrome-extension://${EXT}/options/options.html`);
await o.ev(`chrome.storage.local.clear()`);
await o.ev(`chrome.storage.local.set({introDone:true, useSoldComps:false})`);
const waitFor = async (fn: () => Promise<unknown>, ms = 10000) => {
  for (let t = 0; t < ms; t += 250) {
    if (await fn()) return true;
    await sleep(250);
  }
  return false;
};
// Each card's chips, by listing number.
const marks = (p: any) => p.ev(`Object.fromEntries([...document.querySelectorAll('main a[href*="/item/"]')].map(a => [a.getAttribute('href').match(/\\d+/)[0], (a.closest('[data-tk-cell]')?.querySelector('.tirekick-marks, .tirekick-sticker')?.textContent || '').replace(/\\s+/g, ' ').trim()]))`);


const a = await open("https://www.facebook.com/marketplace/search?query=film+camera&photos=1");
await waitFor(async () => /Same photo/.test(JSON.stringify(await marks(a))));
const m1 = await marks(a);
ok("a picture uploaded again under another title is marked on both cards", /Same photo as 1 other listing/.test(m1["7001"]) && /Same photo as 2 other listings/.test(m1["7002"]), m1);
ok("…the same file under another title (the seller's own) isn't counted against its twin", /Same photo as 1 other listing/.test(m1["7003"]), m1);
ok("…and a different picture isn't marked", !/Same photo/.test(m1["7004"]), m1);
// saved within ten seconds, several batches in one write
const keptKeys = () => o.ev(`chrome.storage.local.get('photoSeen').then(v => Object.keys(v.photoSeen || {}).sort().join())`);
await waitFor(async () => (await keptKeys()) === "fb:7001,fb:7002,fb:7003,fb:7004", 15000);
const seen = await keptKeys();
ok("fingerprints are kept with each listing", seen === "fb:7001,fb:7002,fb:7003,fb:7004", seen);
await a.close();

const b = await open("https://www.facebook.com/marketplace/search?query=film+camera&photos=2");
await waitFor(async () => /Same photo/.test(JSON.stringify(await marks(b))));
const m2 = await marks(b);
ok("on a later page, the same picture (a little brighter) matches the ones seen before", /Same photo as 3 other listings/.test(m2["7005"]), m2);
const why = await b.ev(`[...document.querySelectorAll('.tk-chip')].find(x => /Same photo/.test(x.textContent))?.title || ''`);
ok("…and the mark says what it means and what to do", /stolen or stock photo\. Ask the seller for a photo with today's date/.test(why), why);
await b.close();

// Back to the first page: fingerprints aren't fetched again.
const before = await o.ev(`chrome.storage.local.get('photoSeen').then(v => Object.values(v.photoSeen || {}).map(r => r.a).join())`);
const a2 = await open("https://www.facebook.com/marketplace/search?query=film+camera&photos=1");
await waitFor(async () => /Same photo/.test(JSON.stringify(await marks(a2))));
const m3 = await marks(a2);
const after = await o.ev(`chrome.storage.local.get('photoSeen').then(v => Object.values(v.photoSeen || {}).map(r => r.a).join())`);
ok("coming back, the marks are there at once, from what was kept (no new fingerprints)", /Same photo as 2 other listings/.test(m3["7001"]) && before === after, { m3, before, after });
await a2.close();

// eBay doesn't take part: sellers there reuse their own photos across listings.
const e = await open("https://www.ebay.com/sch/i.html?_nkw=pentax+k1000");
await sleep(1500);
ok("eBay cards are never fingerprinted", !(await e.ev(`document.body.textContent.includes('Same photo')`)));
await e.close();

await o.ev(`document.getElementById('clearMemory').click()`);
await sleep(300);
ok("\"Forget seen listings\" forgets the fingerprints too", await o.ev(`chrome.storage.local.get('photoSeen').then(v => !v.photoSeen)`));
ok("no page logged an error", !errors.length, errors.slice(0, 5));
console.log(fails ? `${fails} FAILED` : "all passed");
c.close();
