// A search the way buyers meet it, end to end on the real extension: "nintendo switch oled" on eBay (the ?real
// page in server.ts), typical price from the fake sold search, the free read, then a scan whose model answers
// the way a model plausibly would, mistakes included. Checks that what each card and row says agrees with
// itself and with the checks behind it. Prints PASS/FAIL lines; REAL_DUMP=1 prints what every card shows.
//   tests/e2e/run.sh real.ts
import { start, EXT, sleep } from "./lib.ts";
const { open, c } = await start();
const API = "http://localhost:1234";
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
await o.ev(`chrome.storage.local.set({anthropicKey:'sk-ant-test', anthropicUrl:'${API}', useSoldComps:true, introDone:true})`);
const R = (p: any, js: string) => p.ev(`(()=>{const r=document.getElementById('tirekick-host')?.shadowRoot; if(!r) return 'NO HOST'; ${js}})()`);
const waitFor = async (fn: () => Promise<unknown>, ms = 10000) => {
  for (let t = 0; t < ms; t += 250) {
    if (await fn()) return true;
    await sleep(250);
  }
  return false;
};

const p = await open("https://www.ebay.com/sch/i.html?_nkw=nintendo+switch+oled&real=1");
await sleep(800);
await R(p, `r.querySelector('[data-act=tab]').click()`);
await sleep(400);
await R(p, `r.querySelector('[data-act=prices]').click()`);
await waitFor(async () => /Typical price/.test(await R(p, `return r.querySelector('.market')?.textContent || ''`)));
await sleep(1500);
// What each card shows: its tag (word and number), the chips under it, and the hover card's lines.
const cards = () => p.ev(`[...document.querySelectorAll('.s-card')].map(c => {
  const s = c.querySelector('.tirekick-sticker'), m = c.querySelector('.tirekick-marks');
  const q = (el, sel) => el ? [...el.querySelectorAll(sel)].map(x => x.textContent.trim()) : [];
  return { title: c.querySelector('.s-card__title').textContent, price: c.querySelector('.s-card__price').textContent,
    v: s?.dataset.v || m?.dataset?.v || c.getAttribute('data-tk-v') || '', word: s?.querySelector('.tk-verdict')?.textContent || '',
    score: s ? +s.querySelector('.tk-score b')?.textContent : null, dial: s?.querySelector('.tk-score i')?.textContent || '',
    chips: q(s || m || c, '.tk-chip').filter(t => !/^(Save|Saved|Sold ↗|Typical price|Not interested)$/.test(t)), pop: q(s, '.tk-pop > *').concat(s ? [] : []), popText: s?.querySelector('.tk-pop')?.textContent || '' };
})`);
const rows = () => R(p, `return [...r.querySelectorAll('.list .row')].map(x => ({ title: x.querySelector('.title')?.textContent, tag: x.querySelector('.tag') ? [x.querySelector('.tag').dataset.v, +x.querySelector('.tag span').textContent, x.querySelector('.tag i').textContent] : null, meta: [...x.querySelectorAll('.meta')].map(m=>m.textContent).join(' / '), reason: x.querySelector('.reason')?.textContent || '', flags: [...x.querySelectorAll('.fchip,.flag')].map(f=>f.textContent).join(' | '), skip: x.classList.contains('skip') }))`);
const dump = (label: string, cs: any[], rs: any[]) => {
  if (!Deno.env.get("REAL_DUMP")) return;
  console.log(`\n--- ${label}: cards`);
  for (const x of cs) console.log(`${x.price.padEnd(8)} ${x.title.slice(0, 44).padEnd(44)} | ${x.v} ${x.score ?? ""} ${x.dial} ${x.word} | ${x.chips.join(" · ")}${x.popText ? "\n           hover: " + x.popText.slice(0, 400) : ""}`);
  console.log(`--- ${label}: panel rows`);
  for (const x of rs) console.log(`${(x.tag || []).join(" ").padEnd(16)} ${String(x.title).slice(0, 44).padEnd(44)} | ${x.meta} | ${x.reason} | ${x.flags}${x.skip ? " [skip]" : ""}`);
};
const BANDS: Record<string, number[]> = { great: [75, 100], good: [60, 74], fair: [45, 59], pass: [0, 44], suspicious: [0, 30] };
const card = (list: any[], t: string) => list.find((x) => x.title.startsWith(t)) || {};
const row = (list: any[], t: string) => list.find((x) => String(x.title).startsWith(t)) || {};
const PRAISE = /Great price|Good price/;

// ---------- before a scan: the free read ----------
const free = await cards();
const freeRows = await rows();
dump("before a scan", free, freeRows);
ok("the typical price comes from the fake sold search (about $252)", /\$252/.test(JSON.stringify(free)), free.map((x: any) => x.chips));
ok("bait at 35% of typical is Likely scam", /Likely scam\? Typical is \$252/.test(card(free, "Nintendo Switch OLED console - fast").chips.join()), card(free, "Nintendo Switch OLED console - fast"));
ok("a game named after the console gets no price check, so no scam mark", /No price check/.test(card(free, "Mario Kart").chips.join()) && !/Too cheap|Likely scam/.test(card(free, "Mario Kart").chips.join()), card(free, "Mario Kart"));
ok("a case for it gets no price check", /No price check/.test(card(free, "Nintendo Switch OLED carrying case").chips.join()), card(free, "Nintendo Switch OLED carrying case"));
ok("a console sold \"+ 3 games + case\" is priced as a console", /above typical/.test(card(free, "Nintendo Switch OLED white + 3").chips.join()), card(free, "Nintendo Switch OLED white + 3"));
ok("a contact-me-on-WhatsApp post is a scam, with no \"Great price\" beside it", /Scam: off-site contact/.test(card(free, "Nintendo Switch OLED white text me").chips.join()) && !PRAISE.test(card(free, "Nintendo Switch OLED white text me").chips.join()), card(free, "Nintendo Switch OLED white text me"));
ok("a for-parts one isn't too cheap and gets no price word", !/Too cheap|Likely scam|Great price|Good price/.test(card(free, "Nintendo Switch OLED for parts").chips.join()), card(free, "Nintendo Switch OLED for parts"));
ok("…and is set against working ones, saying so", /\$\d+ below working ones/.test(card(free, "Nintendo Switch OLED for parts").chips.join()) && /typical price of a working one/.test(row(freeRows, "Nintendo Switch OLED for parts").meta), [card(free, "Nintendo Switch OLED for parts").chips, row(freeRows, "Nintendo Switch OLED for parts").meta]);
// Each warning says why on the card itself (hover or focus), not only in a tooltip.
const whyOf = (t: string) => p.ev(`[...document.querySelectorAll('.s-card')].find(c => c.querySelector('.s-card__title').textContent.startsWith(${JSON.stringify(t)}))?.querySelector('.tirekick-marks .tk-why')?.textContent || ''`);
ok("the bait's card says why it's marked", /35% of the typical price.*usual bait/.test(await whyOf("Nintendo Switch OLED console - fast")), await whyOf("Nintendo Switch OLED console - fast"));
ok("the WhatsApp post's card says what it asks", /Asks to talk off the site \(.*whatsapp.*buyer protection/.test(await whyOf("Nintendo Switch OLED white text me")), await whyOf("Nintendo Switch OLED white text me"));
ok("the new seller's card says what the rule is", /Seller: 3 ratings \(your rule: at least 10 ratings/.test(await whyOf("Nintendo Switch OLED Splatoon")), await whyOf("Nintendo Switch OLED Splatoon"));
ok("a card with nothing to warn about has no reasons box", !(await whyOf("Nintendo Switch OLED Model White")), await whyOf("Nintendo Switch OLED Model White"));
const freeLine = await R(p, `return r.querySelector('.pi-line')?.textContent || ''`);
const count = (w: string) => freeRows.filter((x: any) => x.meta.startsWith(w)).length;
ok("the page line counts scams and warnings the way the cards show them", freeLine.includes(`${count("Likely scam")} possible scam`) && freeLine.includes(`${count("Check first")} to be careful with`), { freeLine, scams: count("Likely scam"), careful: count("Check first") });
await p.shot("real_free.png");
ok("a seller with 3 ratings is Check first", /Check first/.test(row(freeRows, "Nintendo Switch OLED Splatoon").meta), row(freeRows, "Nintendo Switch OLED Splatoon"));

// ---------- a scan, with a model that makes the usual mistakes ----------
await R(p, `r.querySelector('[data-act=scan]').click()`);
await sleep(500);
await waitFor(async () => !(await R(p, `return r.querySelector('[data-act=scan]').disabled`)), 20000);
await sleep(1500);
const after = await cards();
const afterRows = await rows();
dump("after a scan", after, afterRows);
const tagged = after.filter((x: any) => x.score != null);
ok("every card is scored", tagged.length === after.length, after.map((x: any) => [x.title, x.score]));
ok("every card's number sits inside its word's range", tagged.every((x: any) => x.score >= BANDS[x.v][0] && x.score <= BANDS[x.v][1]), tagged.map((x: any) => [x.title.slice(0, 30), x.v, x.score]));
ok("every row's number sits inside its word's range", afterRows.every((x: any) => x.tag && x.tag[1] >= BANDS[x.tag[0]][0] && x.tag[1] <= BANDS[x.tag[0]][1]), afterRows.map((x: any) => x.tag));
const same = (x: any) => afterRows.find((r: any) => r.title === x.title) || {};
ok("each card and its row say the same", tagged.every((x: any) => same(x).tag?.[0] === x.v && same(x).tag?.[1] === x.score), tagged.map((x: any) => [x.title.slice(0, 30), x.v, x.score, same(x).tag]));
const bait = card(after, "Nintendo Switch OLED console - fast");
ok("the model's 91 \"great\" on the bait shows as a warning with a warning's number", bait.v === "suspicious" && bait.score <= 30 && /if it’s real/.test(bait.word), bait);
ok("…without the too-cheap chip its label already says", !/Likely scam\?|Too cheap\?/.test(bait.chips.join()), bait.chips);
ok("…and its hover says why, and what the scan said", /usual bait/.test(bait.popText) && /The scan said Great deal \(91\)/.test(bait.popText), bait.popText);
ok("the bait doesn't head the list", afterRows[0]?.tag?.[0] !== "suspicious", afterRows.map((x: any) => x.tag));
const dear = card(after, "Nintendo Switch OLED 64GB White - NEW SEALED");
ok("the model's 82 \"great\" at 131% of typical is held at Fair price, with a Fair number", dear.v === "fair" && dear.score === 59 && /Held at Fair price: \$329 is 131%/.test(dear.popText), dear);
ok("its row says so too", /Held at Fair price/.test(row(afterRows, "Nintendo Switch OLED 64GB").meta), row(afterRows, "Nintendo Switch OLED 64GB"));
const game = card(after, "Mario Kart");
ok("once the scan says the game isn't the search, no price warning is left on it", !/Too cheap|Likely scam/.test(game.chips.join() + row(afterRows, "Mario Kart").flags), [game.chips, row(afterRows, "Mario Kart").flags]);
ok("the WhatsApp post stays a Likely scam", card(after, "Nintendo Switch OLED white text me").v === "suspicious", card(after, "Nintendo Switch OLED white text me"));
const head = await R(p, `return r.querySelector('.pi-head')?.textContent || ''`);
const worth = afterRows.filter((x: any) => x.tag && (x.tag[0] === "good" || x.tag[0] === "great") && !/not your search/.test(x.meta)).length;
ok("the page summary counts what the rows show (not the game the scan set aside)", head.startsWith(`${worth} worth a look`), { head, worth });
const line = await R(p, `return r.querySelector('.pi-line')?.textContent || ''`);
const scams = afterRows.filter((x: any) => x.tag?.[0] === "suspicious").length;
ok("…and as many possible scams as the tags say", line.includes(`${scams} possible scam`), { line, scams });
await p.shot("real_scan.png");

// ---------- Analyze on a listing page: the same rule, the same number ----------
const it = await open("https://www.ebay.com/itm/184891897312");
await sleep(800);
await R(it, `r.querySelector('[data-act=tab]').click()`);
await sleep(400);
await R(it, `r.querySelector('[data-act=analyze]').click()`);
await waitFor(async () => /out of 100/.test(await R(it, `return r.textContent`)), 10000);
const res = await R(it, `const t=r.querySelector('.tag'); return t ? [t.dataset.v, +t.querySelector('span').textContent, r.querySelector('.title[data-v]')?.textContent || '', [...r.querySelectorAll('.pricewhy')].map(x=>x.textContent).join()] : null`);
console.log("analysis:", JSON.stringify(res));
ok("an analysis the price check overrules shows the new word with a number in its range", res && res[1] >= BANDS[res[0]][0] && res[1] <= BANDS[res[0]][1] && res[2].includes(`${res[1]} out of 100`), res);

console.log(errors.length ? "errors: " + errors.join("\n") : "no errors");
ok("no page logged an error", !errors.length, errors);
console.log(fails ? `${fails} FAILED` : "all passed");
c.close();
