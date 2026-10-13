// Second Look: the plain rules behind the panel, as functions with no page, storage or network in them.
// Word matching and filters, scam signs, what counts as a fix-up project, how a photo check moves a
// verdict, and a few small formatters. The panel (content/panel.js) holds the state and calls these;
// tests/unit.test.mjs runs them on their own.

(() => {
  const R = (window.SLRules = {});

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
  R.normTitle = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
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
  R.hasWord = (text, w) => w.split("/").some((alt) => alt.trim() && new RegExp(`(^|[^a-z0-9])${reEscape(alt.trim())}($|[^a-z0-9])`, "i").test(text));
  R.quickTerms = (words) =>
    [...(words || "").matchAll(/(-?)"([^"]+)"|(-?)(\S+)/g)]
      .map((m) => ({ not: !!(m[1] || m[3]), w: (m[2] || m[4] || "").toLowerCase() }))
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
})();
