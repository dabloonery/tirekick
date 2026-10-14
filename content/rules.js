// Tirekick: the plain rules behind the panel, as functions with no page, storage or network in them.
// Word matching and filters, scam signs, what counts as a fix-up project, how a photo check moves a
// verdict, and a few small formatters. The panel (content/panel.js) holds the state and calls these;
// tests/unit.test.mjs runs them on their own.

(() => {
  const R = (window.TKRules = {});

  R.clamp100 = (n) => Math.max(0, Math.min(100, n));
  R.RANK = { pass: 0, fair: 1, good: 2, great: 3 };
  // Each verdict's range of scores. The model picks both; when they disagree (a "great" at 55), the verdict
  // is the judgment and the score moves into its range, so the number and the word on a tag never conflict.
  // The same lines as adjustedVerdict's: under 45 a pass, under 60 fair, under 75 good.
  R.BANDS = { great: [75, 100], good: [60, 74], fair: [45, 59], pass: [0, 44], suspicious: [0, 30] };
  R.fitScore = (verdict, score) => {
    const [lo, hi] = R.BANDS[verdict] || [0, 100];
    return Math.max(lo, Math.min(hi, Math.round(Number(score) || 0)));
  };
  R.signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "±0");
  R.dollars = (n) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
  const SHORT_DATE = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }); // made once: it's slow to make
  R.shortDate = (ts) => SHORT_DATE.format(new Date(ts));
  // Accents don't change a word ("Pokémon" is "pokemon"), and letters in any alphabet are letters.
  R.fold = (t) => String(t ?? "").normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase();
  R.normTitle = (t) => R.fold(t).replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  R.hash = (str) => {
    let x = 5381;
    for (let i = 0; i < str.length; i++) x = ((x << 5) + x + str.charCodeAt(i)) | 0;
    return (x >>> 0).toString(36);
  };

  // A photo can only pull a verdict down (or mark it suspicious), never talk it up.
  R.adjustedVerdict = (base, score, photos) => {
    if (base === "suspicious") return base;
    if (photos.some((p) => p.matchesTitle === "no")) return "suspicious";
    const cap = score < 45 ? 0 : score < 60 ? 1 : score < 75 ? 2 : 3;
    const rank = Math.min(R.RANK[base] ?? 1, cap);
    return Object.keys(R.RANK).find((k) => R.RANK[k] === rank);
  };

  // ---------- words ----------
  // Words work like an eBay search: "dmg -case -game" needs dmg and drops anything with case or game;
  // "a/b" is either; quotes keep a phrase together.
  const reEscape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // "charger/adapter" = either word. Matches whole words, so "repro" doesn't catch "reproduced".
  // Accents are ignored on both sides, and a word's edges are any non-letter in any alphabet (so "mara"
  // doesn't match inside "cámara").
  R.hasWord = (text, w) => {
    const t = R.fold(text);
    return String(w).split("/").some((alt) => {
      const a = R.fold(alt).trim();
      return a && new RegExp(`(^|[^\\p{L}\\p{N}])${reEscape(a)}($|[^\\p{L}\\p{N}])`, "u").test(t);
    });
  };
  // A quote left open ('"must go') reads as the words in it, not as a word that starts with a quote mark
  // (which nothing has, so every listing would be filtered out).
  R.quickTerms = (words) =>
    [...(typeof words === "string" ? words : "").matchAll(/(-?)"([^"]+)"|(-?)(\S+)/g)]
      .map((m) => ({ not: !!(m[1] || m[3]), w: (m[2] || m[4] || "").replace(/"/g, "").trim().toLowerCase() }))
      .filter((t) => t.w && t.w !== "-");
  // Why `text` fails a line of words ("" if it passes).
  R.termsReason = (text, words) => {
    for (const t of R.quickTerms(words)) {
      if (t.not && R.hasWord(text, t.w)) return `“${t.w}”`;
      if (!t.not && !R.hasWord(text, t.w)) return `no “${t.w}”`;
    }
    return "";
  };

  // The filter bar: words (title and card text), a price range (shipping included when the card shows it),
  // "seen before", and broken listings ("hide" drops them, "only" keeps just those).
  R.quickReason = (f, quick) => {
    const why = R.termsReason(`${f.title || ""} ${f.text || ""}`, quick.words);
    if (why) return why;
    const p = f.total ?? f.price;
    if (quick.min > 0 && p != null && p < quick.min) return `under $${quick.min}`;
    if (quick.max > 0 && p != null && p > quick.max) return `over $${quick.max}`;
    if (quick.fresh && f.known) return "seen before";
    if (quick.broken === "only" && !f.project) return "not broken";
    if (quick.broken === "hide" && f.project) return `“${f.project}”`;
    return "";
  };

  // A likely scam without asking a model: a reposted listing, a code on the end of the title (until a
  // scan says it's the real model number), or a disguised way to get in touch off the site.
  R.likelyScam = (f) => !!(f && (f.campaign || (f.titleCode && !f.codeOk) || f.offSite?.sure));
  // At or under your price for this search, and not a likely scam.
  R.isDeal = (f, dealPrice) => dealPrice > 0 && f.total != null && f.total <= dealPrice && !R.likelyScam(f);

  R.sellerWarning = (f, { minSellerRatings, minSellerPct }) => {
    if (f.sellerCount != null && f.sellerCount < minSellerRatings) return f.sellerCount === 0 ? "New seller" : `Seller: ${f.sellerCount} ratings`;
    if (f.sellerPct != null && f.sellerPct < minSellerPct) return `Seller ${f.sellerPct}% positive`;
    return "";
  };

  // Words that say "fix-up project" (what a fixer hunts for, and Marketplace can't search for all at
  // once) and words that say the seller wants it gone. Read from the title and card text.
  R.PROJECT =
    /\b(for parts(?: or repair| only)?|parts only|parts or repair|not working|non[- ]?working|untested|as[- ]is|broken|no power|won'?t (?:turn|power) on|doesn'?t (?:work|turn on|power on)|needs (?:repair|work|fixing|a new \w+)|faulty|for repair|disc read error|no (?:display|video|sound|picture)|red ring|yellow light|cracked screen|water damage)\b/i;
  R.MOTIVATED = /\b(moving(?: sale)?|must go|need(?:s)? (?:it )?gone|estate sale|cleaning out|garage sale|downsizing|first come first served|priced to sell|quick sale)\b/i;
  R.clueOf = (re, text) => (text.match(re)?.[1] || "").toLowerCase().replace(/\s+/g, " ");

  // ---------- what's remembered about listings you've seen ----------
  // A drop: at least 3% or a dollar under the last price seen (the same rule as a saved listing's alert).
  R.isDrop = (from, to) => from != null && to != null && to < from - Math.max(1, from * 0.03);
  // One sighting of a listing, against what was remembered about it (rec, or nothing). Returns the record
  // to keep and what's new about it: isNew (not seen before, on a search you've looked at before), known,
  // and drop ({ from, since }) when the price fell. Auctions keep the last fixed price: a bid says nothing
  // about drops. Each price change is kept (the last five) so a listing page can show its history.
  // rec: { p: last price, pa: since when, f: first seen, a: last seen, o: first opened, h: [[price, since]] }
  R.sighting = (rec, price, { now = Date.now(), pageHadKnown = false, auction = false } = {}) => {
    const old = rec && typeof rec === "object" ? rec : null;
    const out = { isNew: !old && !!pageHadKnown, known: !!old };
    if (auction || !Number.isFinite(price)) price = null;
    const last = Number.isFinite(old?.p) ? old.p : null;
    if (old && price != null && R.isDrop(last, price)) out.drop = { from: last, since: old.pa };
    const changed = old && price != null && last != null && last !== price;
    const hist = changed ? [...(Array.isArray(old.h) ? old.h : []), [last, old.pa]].slice(-5) : old?.h;
    const next = { p: price ?? last, pa: old && (price == null || last === price) ? old.pa : now, f: old?.f ?? now, a: now, ...(old?.o && { o: old.o }), ...(hist?.length && { h: hist }) };
    return { out, rec: next };
  };

  // Listings on one page that share a title (4+ words, so "Nikon camera" doesn't count) or a photo:
  // reposts, or one seller with several. Returns item -> how many share it (only for those that do).
  R.duplicates = (items, isPlaceholder = () => false) => {
    const groups = new Map();
    const add = (k, it) => (groups.get(k) || groups.set(k, []).get(k)).push(it);
    for (const it of items) {
      const t = R.normTitle(it.title || "");
      if (t.split(" ").length >= 4) add(`t:${t}`, it);
      if (it.imageUrl && !isPlaceholder(it.imageUrl)) add(`i:${it.imageUrl}`, it);
    }
    const dup = new Map();
    for (const list of groups.values()) if (list.length > 1) for (const it of list) dup.set(it, Math.max(dup.get(it) || 0, list.length));
    return dup;
  };

  // The other codes a scam title has been posted under, by other listings. stemRec: { c: { code: key } }.
  R.otherCodes = (stemRec, key, code) => Object.entries(stemRec?.c || {}).filter(([c, k]) => c !== code && k !== key).map(([c]) => c);

  // ---------- did the page reader keep up with the site? ----------
  // links: listings linked on the page (any link to a listing, counted once each), items: listings the
  // adapter read, priced: how many of those came with a price. Sites change their markup without notice,
  // and when the adapter misses, the panel would otherwise just show fewer listings, or none.
  // partialOk: a page where many links sit outside the results (carousels on a category page) can't be
  // judged by the share read, only by nothing read at all.
  // level: "ok", "few" (too few listings to tell), "broken" (none read), "partial" (under a third read),
  // "prices" (read, but most without a price).
  R.readHealth = ({ links = 0, items = 0, priced = 0 }, { partialOk = false } = {}) => {
    const out = { links, items, priced };
    if (links < 6 && items < 6) return { ...out, level: "few" };
    if (!items) return { ...out, level: "broken" };
    if (!partialOk && links >= 10 && items < links / 3) return { ...out, level: "partial" };
    if (items >= 6 && priced < items / 2) return { ...out, level: "prices" };
    return { ...out, level: "ok" };
  };
  // What to tell you about it, in a sentence ("" when there's nothing to say).
  R.healthNote = (hl, siteName) =>
    hl.level === "broken"
      ? `${siteName} changed this page and Tirekick can't read its listings (${hl.links} on the page, none read). Scores, marks and filters won't work here until it's fixed.`
      : hl.level === "partial"
        ? `${siteName} may have changed this page: Tirekick read ${hl.items} of the ${hl.links} listings on it. The rest get no marks, filters or scores.`
        : hl.level === "prices"
          ? `${siteName} may have changed this page: Tirekick read ${hl.items} listings but found a price on only ${hl.priced}. Deals, price filters and sold-price comparisons need it.`
          : "";
})();
