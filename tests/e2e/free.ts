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
await waitFor(async () => JSON.stringify(await chips()).includes("typical"));
const cs = await chips();
const of = (price: string) => (cs.find(([pr]: string[]) => pr === price) || [])[1] || "";
ok("a card far under a trusted sold median is marked Likely scam? with the share", /Likely scam\? Typical is \$300/.test(of("$85.00")), cs);
ok("…one well under it says Too cheap?", /Too cheap\? Typical is \$300/.test(of("$140.00")), cs);
ok("…a broken one is never marked (the median is for working ones)", !/Too cheap|Likely scam\?/.test(of("$35.00")), cs);
ok("…and an auction isn't either (a bid isn't a price)", !/Too cheap|Likely scam\?/.test(of("$60.00")), cs);
// An accessory for the search, added the way a feed adds cards as you scroll: no price check, no scam mark.
await p.ev(`document.querySelector('ul').insertAdjacentHTML('beforeend', '<li class="s-card"><img alt=""><div class="s-card__title">Pentax K1000 lens cap</div><div class="s-card__price">$8.00</div><a href="https://www.ebay.com/itm/7777777777">item</a></li>')`);
await waitFor(async () => /No price check/.test(((await chips()).find(([pr]: string[]) => pr === "$8.00") || [])[1] || ""));
const capChips = ((await chips()).find(([pr]: string[]) => pr === "$8.00") || [])[1] || "";
ok("an accessory for the search isn't compared with the thing's typical price, so it's no scam", /No price check/.test(capChips) && !/Too cheap|Likely scam|typical/.test(capChips), capChips);
await p.close();

// ---------- eBay changed its cards ----------
// A renamed price class with a "Save $5.00" coupon above each price: the same prices, so the same marks (the
// first dollar amount on the card would make every one "Likely scam").
{
  const q = await open("https://www.ebay.com/sch/i.html?_nkw=pentax+k1000&changed=price");
  const qchips = () => q.ev(`[...document.querySelectorAll('.s-card')].map(c => [c.querySelector('.s-card__amount')?.textContent, [...(c.querySelector('.tirekick-sticker')?.shadowRoot || c).querySelectorAll('.tk-chip')].map(x => x.textContent).join(' | ')])`);
  await waitFor(async () => JSON.stringify(await qchips()).includes("typical"));
  const qs = await qchips();
  ok("a renamed price class next to a coupon: every card shows the marks it had before", JSON.stringify(qs) === JSON.stringify(cs), { now: qs, before: cs });
  await q.close();
  // No price readable at all: no price marks, and the panel says it couldn't read the prices.
  const n = await open("https://www.ebay.com/sch/i.html?_nkw=pentax+k1000&changed=noprice");
  const warned = await waitFor(() => R(n, `const w=r.querySelector('.readwarn'); return !w.hidden && /found a price on only 0/.test(w.textContent)`));
  const nchips = await n.ev(`[...document.querySelectorAll('.s-card')].map(c => [...(c.querySelector('.tirekick-sticker')?.shadowRoot || c).querySelectorAll('.tk-chip')].map(x => x.textContent).join(' | ')).join(' || ')`);
  ok("prices gone from the cards: the panel says so, and no card gets a price mark", warned && !/Too cheap|Likely scam\?|typical/.test(nchips), { warned, nchips, note: await R(n, `return r.querySelector('.readwarn').textContent`) });
  await n.close();
}

// ---------- a pickup listing, against eBay totals that include shipping ----------
await store(`{soldCache:{"v2:used:pentax k1000":{at:Date.now(), market:${JSON.stringify({ ...MARKET, median: 100, p25: 90, p75: 115, ship: 12 })}}}}`);
const fb = await open("https://www.facebook.com/marketplace/search?query=pentax+k1000");
const fbChip = () => fb.ev(`[...document.querySelectorAll('[data-tirekick-key]')].filter(c=>c.querySelector('a[href*="/item/111/"]')||c.matches('a[href*="/item/111/"]')).map(c=>[...c.querySelectorAll('.tk-chip')].map(x=>x.textContent+' ~ '+(x.title||'')).join(' | ')).join(' || ')`);
await waitFor(async () => /typical/.test(await fbChip()));
const pick = await fbChip();
ok("a $85 pickup listing is compared with the typical price less shipping ($88), not eBay's $100 total", /about typical/.test(pick) && !/\$15 below/.test(pick), pick);
await fb.close();
// The same card priced in Canadian dollars (a buyer in Canada): not held against US-dollar sales.
const fbc = await open("https://www.facebook.com/marketplace/search?query=pentax+k1000&currency");
const fbcChip = () => fbc.ev(`[...document.querySelectorAll('[data-tirekick-key]')].filter(c=>c.querySelector('a[href*="/item/111/"]')||c.matches('a[href*="/item/111/"]')).map(c=>[...c.querySelectorAll('.tk-chip')].map(x=>x.textContent+' ~ '+(x.title||'')).join(' | ')).join(' || ')`);
await waitFor(async () => /No price check/.test(await fbcChip()));
const cad = await fbcChip();
ok("a CA$85 Marketplace listing gets no price check against US-dollar sales, and says why", /No price check ~ Priced in CA\$/.test(cad) && !/typical/.test(cad.split("~")[0]), cad);
await fbc.close();
await store(`{soldCache:{}}`);

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
const offer = await R(it, `const b=r.querySelector('.pi-line .offer'); return b && { text: b.textContent, msg: b.querySelector('textarea')?.value, kinds: [...b.querySelectorAll('.msg-kind button')].map(o=>o.textContent) }`);
ok("a listing page offers an opening price and a walk-away price from sold prices, before any analysis", /Offer \$270, walk away above \$290/.test(offer?.text || ""), { words, offer });
ok("…says where they come from", /From recent eBay sales; your AI isn't used: the typical price is \$250–\$340 \(20 recent eBay sales\)/.test(offer?.text || ""), offer);
ok("…with a message to edit and three kinds to pick from", offer?.msg === "Hi! Is this still available? Would you take $270?" && offer?.kinds?.join() === "Friendly,Direct,With a reason", offer);
await R(it, `r.querySelector('.pi-line .offer .msg-kind [data-kind=direct]').click()`);
ok("…and picking another kind changes the message", /^Hi, I can offer \$270\. Let me know/.test(await R(it, `return r.querySelector('.pi-line .offer textarea').value`)));
// The seller answers: what to do, and the message rewritten to match.
const said = (n: number) => R(it, `const i=r.querySelector('.pi-line .offer input.said'); i.value='${n}'; i.dispatchEvent(new Event('input')); return { answer: r.querySelector('.pi-line .said-answer').textContent, msg: r.querySelector('.pi-line .offer textarea').value }`);
const s1 = await said(285);
ok("\"They said $285\" (close to the walk-away) says take it, not another round", /^Take it at \$285: that's within what you planned to pay/.test(s1?.answer) && s1?.msg === "Deal, $285 works for me.", s1);
const s2 = await said(320);
ok("…$320 (over it) says to offer the walk-away price once", /^Offer \$290 once, then walk away/.test(s2?.answer) && /^Thanks, but \$290 is the most I can do/.test(s2?.msg), s2);
const s3 = await said(265);
ok("…and $265 (under the opening offer) says take it too", /^Take it at \$265: that's at or under your opening offer/.test(s3?.answer) && /^Deal, \$265 works for me\./.test(s3?.msg), s3);
// With a key: the plan goes to the analysis, and its range stays near the plan.
await store(`{useAI:true, anthropicKey:'sk-ant-test', anthropicUrl:'http://localhost:1234', useSoldComps:true}`);
await fetch("http://localhost:1234/calls", { method: "DELETE" });
await R(it, `r.querySelector('[data-act=analyze]').click()`);
await waitFor(() => R(it, `return /Suggested offer/.test(r.querySelector('.offer')?.textContent || '')`), 10000);
const calls = await (await fetch("http://localhost:1234/calls")).json();
ok("the analysis is told listing text is data, and asked why a low price is low", calls.some((c: any) => c.dataRule && /different model/.test(c.cheapWhy)), calls.map((c: any) => [c.dataRule, c.cheapWhy]));
ok("the analysis is told the offer plan from sold prices", calls.some((c: any) => /open at \$270, walk away above \$290/.test(c.plan)), calls);
const an = await R(it, `const b=[...r.querySelectorAll('.offer')].find(x=>/Suggested offer/.test(x.textContent)); return b && { text: b.textContent, msg: b.querySelector('textarea')?.value, said: !!b.querySelector('input.said') }`);
ok("…a lowball range from the model ($230–$260) is kept near the plan ($240–$260)", /Suggested offer: \$240–\$260/.test(an?.text || "") && /Kept near the plan from the typical price/.test(an?.text || ""), an);
ok("…with the same editable message and \"They said\" box", /Would you take \$240\?/.test(an?.msg || "") && an?.said, an);
await it.close();
await store(`{useAI:true, anthropicKey:'', useSoldComps:false}`);

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

// ---------- a category's name, and pricing one listing from its own title ----------
await store(`{useSoldComps:true, soldCache:{}}`);
const cat = await open("https://www.ebay.com/sch/i.html?_nkw=electronics");
await sleep(1200);
await R(cat, `r.querySelector('[data-act=tab]').click()`);
await sleep(600);
const qsum = await R(cat, `return r.querySelector('.q-sum-text').textContent`);
ok("a category's name is called too broad for one typical price", /whole category, too broad for one typical price/.test(qsum), qsum);
ok("…and gets no page-wide price button", await R(cat, `return r.querySelector('[data-act=prices]').hidden`));
const cardText = (i: number) => cat.ev(`(()=>{const c=document.querySelectorAll('.s-card')[${i}]; return [...(c.querySelector('.tirekick-sticker')?.shadowRoot || c).querySelectorAll('.tk-chip, .tk-btn')].map(x=>x.textContent).join('|')})()`);
ok("…each card offers its own typical price", /Typical price/.test(await cardText(1)), await cardText(1));
await cat.ev(`(()=>{const c=document.querySelectorAll('.s-card')[1]; [...(c.querySelector('.tirekick-sticker')?.shadowRoot || c).querySelectorAll('button')].find(b=>b.textContent==='Typical price').click()})()`);
await waitFor(async () => /typical/.test(await cardText(1)), 15000);
ok("…which looks up that listing's own title and marks the card", /(below|above) typical/.test(await cardText(1)), await cardText(1));
const soldKeys = Object.keys((await o.ev(`chrome.storage.local.get('soldCache')`)).soldCache || {});
ok("…and never the category's name", soldKeys.length === 1 && !soldKeys.some((k) => /electronics/.test(k)), soldKeys);
await store(`{useSoldComps:false}`);
await cat.close();

// A scan is told the cards' price lines and the free scam signs, so its verdict starts where the card's word does.
await store(`{useAI:true, anthropicKey:'sk-ant-test', anthropicUrl:'http://localhost:1234', useSoldComps:true}`);
await soldFor("pentax k1000");
await fetch("http://localhost:1234/calls", { method: "DELETE" });
const sp = await open("https://www.ebay.com/sch/i.html?_nkw=pentax+k1000");
await sleep(1200);
await R(sp, `r.querySelector('[data-act=tab]').click()`);
await sleep(400);
await R(sp, `r.querySelector('[data-act=scan]').click()`);
await waitFor(async () => (await (await fetch("http://localhost:1234/calls")).json()).length > 0, 10000);
const scanCalls = await (await fetch("http://localhost:1234/calls")).json();
ok("a scan gets the same price lines as the cards' free read", scanCalls.length && scanCalls.every((x: any) => x.bands), scanCalls);
ok("…is told listing text is data, not instructions, and asked why a low price is low", scanCalls.every((x: any) => x.dataRule && x.cheapWhy === "none,flaw,missing parts,different model,quick sale"), scanCalls.map((x: any) => [x.dataRule, x.cheapWhy]));
ok("…and is told a bait price as a scam signal", scanCalls.some((x: any) => x.scam.some((s: string) => /the total is 32% of the typical price/.test(s))), scanCalls.map((x: any) => x.scam));
await sleep(1500);
await sp.close();

ok("no page logged an error", !errors.length, errors.slice(0, 5));
console.log(fails ? `${fails} FAILED` : "all passed");
c.close();
