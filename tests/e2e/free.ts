// The free features added in 0.37.0, on the real extension, with no model: "too cheap" marks from sold prices,
// the offer helper on a listing page, and saved listings as a spreadsheet. Prints PASS/FAIL lines.
//   tests/e2e/run.sh free.ts
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
const store = (js: string) => o.ev(`chrome.storage.local.set(${js})`);
const R = (p: any, js: string) => p.ev(`(()=>{const r=document.getElementById('tirekick-host')?.shadowRoot; if(!r) return 'NO HOST'; ${js}})()`);
const waitFor = async (fn: () => Promise<unknown>, ms = 8000) => {
  for (let t = 0; t < ms; t += 250) {
    if (await fn()) return true;
    await sleep(250);
  }
  return false;
};
// Sold prices for some words, as if looked up a moment ago (they apply by themselves, no lookup, no model).
const MARKET = { n: 20, median: 300, p25: 250, p75: 340, confidence: "good", ship: null, dropped: {}, currency: "$", samples: [] };
const soldFor = (q: string) => store(`{soldCache:{${JSON.stringify(`v2:used:${q.toLowerCase()}`)}:{at:Date.now(), market:${JSON.stringify(MARKET)}}}}`);

await o.ev(`chrome.storage.local.clear()`);
await store(`{introDone:true, useSoldComps:false}`);

// ---------- far under the sold price ----------
await soldFor("pentax k1000");
const p = await open("https://www.ebay.com/sch/i.html?_nkw=pentax+k1000");
const chips = () => p.ev(`[...document.querySelectorAll('.s-card')].map(c => [c.querySelector('.s-card__price')?.textContent, [...(c.querySelector('.tirekick-sticker')?.shadowRoot || c).querySelectorAll('.tk-chip')].map(x => x.textContent).join(' | ')])`);
await waitFor(async () => JSON.stringify(await chips()).includes("% of sold"));
const cs = await chips();
const of = (price: string) => (cs.find(([pr]: string[]) => pr === price) || [])[1] || "";
ok("a card far under a trusted sold median is marked Likely scam? with the share", /Likely scam\? 32% of sold price/.test(of("$85.00")), cs);
ok("…one well under it says Too cheap?", /Too cheap\? 47% of sold price/.test(of("$140.00")), cs);
ok("…a broken one is never marked (the median is for working ones)", !/Too cheap|Likely scam\?/.test(of("$35.00")), cs);
ok("…and an auction isn't either (a bid isn't a price)", !/Too cheap|Likely scam\?/.test(of("$60.00")), cs);
await p.close();

// ---------- the offer helper on a listing page ----------
const it = await open("https://www.ebay.com/itm/184891897312");
await sleep(800);
await R(it, `r.querySelector('[data-act=tab]').click()`);
await sleep(400);
const words = await R(it, `return r.querySelector('#q').value`);
await soldFor(words);
await it.ev(`location.reload()`);
await sleep(2500);
await R(it, `r.querySelector('[data-act=tab]').click()`);
await waitFor(() => R(it, `return !!r.querySelector('.pi-line .offer')`));
const offer = await R(it, `const b=r.querySelector('.pi-line .offer'); return b && { text: b.textContent, msg: b.querySelector('textarea')?.value, kinds: [...b.querySelectorAll('option')].map(o=>o.textContent) }`);
ok("a listing page offers an opening price and a walk-away price from sold prices, before any analysis", /Offer \$270, walk away above \$290/.test(offer?.text || ""), { words, offer });
ok("…says where they come from", /From sold prices, no AI: sold ones go for \$250–\$340 \(20 sales\)/.test(offer?.text || ""), offer);
ok("…with a message to edit and three kinds to pick from", offer?.msg === "Hi! Is this still available? Would you take $270?" && offer?.kinds?.join() === "Friendly,Direct,With a reason", offer);
await R(it, `const s=r.querySelector('.pi-line .offer select'); s.value='direct'; s.dispatchEvent(new Event('change'))`);
ok("…and picking another kind changes the message", /^Hi, I can offer \$270\. Let me know/.test(await R(it, `return r.querySelector('.pi-line .offer textarea').value`)));
await it.close();

// ---------- saved listings as a spreadsheet ----------
await store(`{saved:{'ebay:1111111111':{t:'Pentax K1000 body',u:'https://www.ebay.com/itm/1111111111',p0:120,a0:${Date.now() - 864e5},p:97,a:${Date.now()}}}}`);
const sv = await open("https://www.ebay.com/sch/i.html?_nkw=pentax+k1000");
await sleep(1200);
await R(sv, `r.querySelector('[data-act=tab]').click()`);
await sleep(300);
await R(sv, `r.querySelector('[data-view=saved]').click()`);
await sleep(600);
ok("Saved has a spreadsheet download beside Copy the list", await R(sv, `return [...r.querySelectorAll('.sv-acts button')].map(b=>b.textContent).join('|') === 'Copy the list|Download (CSV)'`));
await sv.close();
await o.ev(`document.getElementById('exportCsv').click()`);
await sleep(400);
ok("settings can download saved listings as a spreadsheet too", /Downloaded 1 saved listing as a spreadsheet/.test(await o.ev(`document.getElementById('msg').textContent`)));

ok("no page logged an error", !errors.length, errors.slice(0, 5));
console.log(fails ? `${fails} FAILED` : "all passed");
c.close();
