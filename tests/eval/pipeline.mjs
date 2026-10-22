// Runs labeled listings (tests/eval/cases.mjs) through the same free checks the panel runs on a results page,
// and scores what a buyer would see against what each listing really is. No page, no storage, no model: the
// card is read with the adapters' own helpers (TK.cardFacts, TK.titleCode, TK.offSite) and judged with
// TKRules (compareFacts, freeRead, priceVerdict), so a change to the rules shows up here as a changed score.
//   deno task eval              the scorecard and every listing that came out wrong
//   EVAL_ALL=1 deno task eval   every listing
import { loadScripts } from "../helpers/load.mjs";
import { MARKETS, CASES, CHEAP } from "./cases.mjs";

const { R, TK } = await loadScripts();
const SETTINGS = { minSellerRatings: 10, minSellerPct: 97 }; // the defaults (background.js)
const NOW = Date.parse("2026-10-21T12:00:00Z");

// A case's card as the adapters would read it: price, shipping, total, the card facts.
const readCard = (c) => {
  const shipping = c.shipping ?? null;
  const it = { site: c.site, title: c.title, price: c.price, shipping, total: c.price == null ? null : Math.round((c.price + (shipping || 0)) * 100) / 100 };
  Object.assign(it, TK.cardFacts(c.text || "", c.title));
  if (c.foreign) it.foreign = c.foreign; // the card's currency, when it isn't US dollars (TK.currencyOf)
  it.titleCode = TK.titleCode(c.title);
  // Cards are checked for off-site contact in the title only; a Marketplace listing's page in full (with the
  // seller's join date) once it's opened.
  const contact = c.page ? `${c.title} ${c.page}` : c.title;
  if (TK.offSite(contact)) it.offSite = TK.offSite(contact);
  if (c.page) it.sellerJoined = TK.joinedYear(c.page);
  return it;
};

// What every case on one search shows, worked out the way pagePass does it: reposts found across the
// search's cards first (the same title under another code), then each card on its own.
export function runCases(cases = [...CASES, ...CHEAP]) {
  const stems = new Map(); // site|stem -> Set of codes
  const cards = cases.map((c) => ({ c, it: readCard(c) }));
  for (const { c, it } of cards) {
    if (!it.titleCode) continue;
    const stem = TK.titleStem(c.title, it.titleCode);
    if (stem.split(" ").length < 4) continue;
    const k = `${c.site}|${stem}`;
    (stems.get(k) || stems.set(k, new Set()).get(k)).add(it.titleCode);
  }
  return cards.map(({ c, it }) => {
    const f = { ...it };
    if (it.titleCode) {
      const codes = stems.get(`${c.site}|${TK.titleStem(c.title, it.titleCode)}`);
      const others = codes ? [...codes].filter((x) => x !== it.titleCode) : [];
      if (others.length) f.campaign = others;
    }
    if (it.titleCode && R.codeInSearch(it.titleCode, c.query)) f.codeOk = true;
    f.sellerWarn = R.sellerWarning(it, SETTINGS, NOW);
    f.sellerRisk = R.riskySeller(it, NOW);
    f.project = R.clueOf(R.PROJECT, `${c.title} ${c.text || ""}`);
    const base = MARKETS[c.query];
    const market = R.forPickup(base, f, c.site === "facebook");
    f.vsSold = R.compareFacts(f, market, c.query);
    const free = R.freeRead(f, market);
    const card = free?.v === "suspicious" ? (free.word === "Likely scam" ? "red" : "amber") : free?.word === "Off-topic" ? "off" : "clean";
    const word = free && free.v !== "suspicious" && free.word !== "Off-topic" && free.word !== "Price dropped" ? free.v : "none";
    // After a scan: the scripted model verdict, through the price check that wins over it.
    const scanned = { ...f, related: c.scanRelated ?? f.related, score: 70, ...(c.cheapWhy && { cheapWhy: c.cheapWhy }) };
    const shown = c.scan ? R.priceVerdict(c.scan, scanned, market).v : null;
    // The same answer from Analyze, which may clear more (priceVerdict's deep).
    const deep = c.scan ? R.priceVerdict(c.scan, scanned, market, { deep: true }).v : null;
    return { c, f, free, card, word, shown, deep };
  });
}

// The scorecard: scams caught (red or amber) and missed, honest listings marked, price words that match.
// Honest cheap listings (group "cheap") are scored on their own: how many that say why they're cheap are still
// marked Likely scam before a scan, and still a warning after one.
export function score(rows) {
  const scams = rows.filter((r) => r.c.truth === "scam");
  const honest = rows.filter((r) => r.c.truth === "honest" && r.c.group !== "cheap");
  const clear = rows.filter((r) => r.c.group === "cheap" && r.c.expect === "clear");
  const warn = rows.filter((r) => r.c.group === "cheap" && r.c.expect === "warn");
  const priced = honest.filter((r) => r.c.word);
  const scanned = rows.filter((r) => r.c.scan && r.c.group !== "cheap");
  const okShown = (r) => (r.c.truth === "scam" ? r.shown === "suspicious" || r.shown === "pass" : r.shown === (r.c.shown || r.c.scan));
  return {
    scams: scams.length,
    red: scams.filter((r) => r.card === "red").length,
    amber: scams.filter((r) => r.card === "amber").length,
    missed: scams.filter((r) => r.card !== "red" && r.card !== "amber"),
    honest: honest.length,
    falseRed: honest.filter((r) => r.card === "red"),
    falseAmber: honest.filter((r) => r.card === "amber"),
    priced: priced.length,
    wrongWord: priced.filter((r) => r.word !== r.c.word),
    scanned: scanned.length,
    wrongShown: scanned.filter((r) => !okShown(r)),
    deepCleared: scams.filter((r) => r.deep && r.deep !== "suspicious" && r.deep !== "pass"),
    clear: clear.length,
    clearRed: clear.filter((r) => r.card === "red"),
    clearAmber: clear.filter((r) => r.card === "amber"),
    clearStuck: clear.filter((r) => r.shown === "suspicious"),
    clearWrong: clear.filter((r) => r.shown !== r.c.shown),
    warn: warn.length,
    warnRed: warn.filter((r) => r.card === "red"),
    warnMarked: warn.filter((r) => r.card === "red" || r.card === "amber"),
  };
}

const line = (r) => `  ${r.c.site === "ebay" ? "eBay" : "FB  "} $${r.c.price}${r.c.shipping ? `+${r.c.shipping}` : ""} "${r.c.title}" [${r.c.query}]: ${r.free?.word || "no mark"}${r.shown ? `, after a scan ${r.shown}` : ""}${r.c.note ? `  (${r.c.note})` : ""}`;
export function report(rows = runCases(), all = false) {
  const s = score(rows);
  const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : "-");
  const out = [
    `Free checks on ${rows.length} labeled listings (${s.scams} scams, ${s.honest} honest, ${s.clear + s.warn} honest and far under typical)`,
    `  scams marked Likely scam: ${s.red} of ${s.scams} (${pct(s.red, s.scams)}); Check first: ${s.amber}; missed: ${s.missed.length}`,
    `  honest marked Likely scam: ${s.falseRed.length} of ${s.honest}; Check first: ${s.falseAmber.length} (${pct(s.falseAmber.length, s.honest)})`,
    `  price word as labeled: ${s.priced - s.wrongWord.length} of ${s.priced}`,
    `  after a scan, shown verdict as labeled: ${s.scanned - s.wrongShown.length} of ${s.scanned}; scams Analyze would clear: ${s.deepCleared.length}`,
    `Honest listings far under typical (${s.clear} that should clear: they say why, sales go that low, or the site explains it; ${s.warn} that don't)`,
    `  should clear, marked Likely scam: ${s.clearRed.length}; Check first: ${s.clearAmber.length}; still a warning after a scan: ${s.clearStuck.length}; verdict as labeled: ${s.clear - s.clearWrong.length} of ${s.clear}`,
    `  the rest, marked Likely scam: ${s.warnRed.length}; marked at all: ${s.warnMarked.length} of ${s.warn}`,
  ];
  const group = (title, list) => list.length && out.push(title, ...list.map(line));
  group("Scams missed:", s.missed);
  group("Honest listings marked Likely scam:", s.falseRed);
  group("Honest listings marked Check first:", s.falseAmber);
  group("Price word not as labeled:", s.wrongWord.map((r) => ({ ...r, c: { ...r.c, note: `labeled ${r.c.word}, read ${r.word}` } })));
  group("After a scan, not as labeled:", s.wrongShown);
  group("Scams Analyze would clear:", s.deepCleared);
  group("Honest and cheap for a reason, marked Likely scam:", s.clearRed);
  group("Honest and cheap for a reason, not as labeled after a scan:", s.clearWrong.map((r) => ({ ...r, c: { ...r.c, note: `labeled ${r.c.shown}, ${r.c.note}` } })));
  if (all) group("Every listing:", rows);
  return out.join("\n");
}

if (import.meta.main) console.log(report(runCases(), !!Deno.env.get("EVAL_ALL")));
