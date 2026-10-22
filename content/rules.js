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
  // Kept for the texts seen lately: every card's title and text are folded again each time a feed loads more.
  const folded = new Map();
  R.fold = (t) => {
    const s = String(t ?? "");
    let out = folded.get(s);
    if (out === undefined) {
      if (folded.size > 5000) folded.clear();
      folded.set(s, (out = s.normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase()));
    }
    return out;
  };
  R.normTitle = (t) => R.fold(t).replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  R.hash = (str) => {
    let x = 5381;
    for (let i = 0; i < str.length; i++) x = ((x << 5) + x + str.charCodeAt(i)) | 0;
    return (x >>> 0).toString(36);
  };

  // Words too broad to price: a store's category ("Electronics", "Video Games & Consoles") or a word like
  // "stuff". A median of everything sold under "electronics" says nothing about one listing, so these get no
  // page-wide comparison; each listing can still be priced from its own title.
  const BROAD = new Set(("electronics|video games|video games consoles|games|consoles|cell phones|cell phones accessories|phones|" +
    "computers|computers tablets networking|tablets|cameras|cameras photo|home|home garden|garden|home improvement|household|" +
    "furniture|appliances|clothing|clothing shoes accessories|clothes|shoes|accessories|toys|toys hobbies|toys games|hobbies|" +
    "collectibles|collectibles art|art|antiques|sporting goods|sports|sports outdoors|outdoors|books|books movies music|movies|" +
    "music|musical instruments|instruments|jewelry|jewelry watches|watches|health beauty|beauty|baby|baby kids|kids|pet supplies|" +
    "pets|business industrial|office supplies|motors|vehicles|auto parts|parts accessories|tools|tools workshop equipment|" +
    "crafts|arts crafts|entertainment|family|free|free stuff|garage sale|miscellaneous|misc|other|stuff|things|deals|" +
    "all|everything|for sale|electronics accessories|video gaming|gaming|tv|tvs|audio|tv audio|tv video home audio").split("|"));
  R.broadQuery = (q) => {
    const words = R.normTitle(q).replace(/\b(and|amp)\b/g, " ").replace(/\s+/g, " ").trim();
    return !!words && BROAD.has(words);
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
  const wordRe = new Map(); // a word -> its pattern, made once
  R.hasWord = (text, w) => {
    const t = R.fold(text);
    return String(w).split("/").some((alt) => {
      const a = R.fold(alt).trim();
      if (!a) return false;
      let re = wordRe.get(a);
      if (!re) {
        if (wordRe.size > 2000) wordRe.clear();
        wordRe.set(a, (re = new RegExp(`(^|[^\\p{L}\\p{N}])${reEscape(a)}($|[^\\p{L}\\p{N}])`, "u")));
      }
      return re.test(t);
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
    if (quick.junk) {
      const off = R.offTopic(f);
      if (off) return `off-topic: ${off}`;
    }
    return "";
  };

  // Off-topic: a card that isn't an item for sale, the clutter of a browse feed like the Marketplace home
  // page. Rentals and housing, services (massage, cleaning, hair), jobs, pets, "looking for" posts, and $0–$1
  // placeholder prices on something that isn't free. Returns a short reason, or "" for an ordinary listing.
  // Kept narrow on purpose: a word that also names an item ("apartment-size fridge", "kitten heels") doesn't count.
  const OFF = [
    ["wanted post", /^(?:looking for|lf\b|wtb\b|iso\b|in search of|searching for|seeking|need(?:ing)? (?:a|an|someone|help)\b|wanted\b)|\b(?:looking to (?:rent|buy)|want to buy)\b/i],
    ["rental", /\b(?:for rent|for lease|rentals?|rent to own|room(?:s)? (?:for|available)|roommate|sublease|sublet|casita|\d\s?(?:bd|br|bed(?:room)?s?)\b.*\b(?:\d\s?(?:ba|bath)s?|rent|house|home|apt)|apartments? (?:for|available)|house for|move[- ]in)\b/i],
    ["service", /\b(?:massages?|massage therapy|cleaning services?|house cleaning|handyman|lawn (?:care|service|mowing)|landscaping services?|hair (?:braid(?:ing|s)?|stylist)|lash(?:es)? (?:extensions?|tech)|nail tech|tattoos? (?:artist|shop)|tutor(?:ing)?|photography services?|dj services?|junk removal|moving services?|services? (?:available|offered)|we (?:buy|fix|repair|clean|install)|free (?:estimate|quote)s?|call (?:now|today)|now booking|book (?:now|today|your))\b/i],
    ["job", /\b(?:now hiring|we(?:'re| are) hiring|hiring|job (?:opening|opportunity)|positions? available|work from home|earn \$|make money)\b/i],
    ["pets", /\b(?:kittens?|puppies|puppy|rehom(?:e|ing)|for adoption|adopt me)\b(?!.*\b(?:food|toys?|beds?|crate|cage|carrier|collar|leash|supplies|figure|plush|heels)\b)/i],
    ["adult", /\b(?:escorts?|sugar (?:daddy|baby|mama)|onlyfans|companionship|feel (?:good|relaxed) tonight|incall|outcall)\b/i],
  ];
  const THING = /\b(?:chairs?|guns?|tables?|pillows?|cushions?|seats?|pads?|devices?|machines?|massagers?|kits?|books?|dvds?)\b/i; // "massage chair" is an item
  // A stand-in asking price: "$1234", "$12,345", "$1111", "$99999" (sellers use them to mean "message me").
  // Compared with sold prices one read "$12263 above typical" (real-site check, 0.49.1), so it gets no
  // price comparison and says what it is instead.
  R.placeholderPrice = (price) => {
    if (!(price > 0)) return false;
    const d = String(Math.round(price));
    return (d.length >= 4 && "1234567890".startsWith(d)) || /^1{4,}$|^9{5,}$/.test(d);
  };
  // So far from the typical price (20 times or more) that the two can't be about the same thing: a different
  // item in the search, or a stand-in price. Either way a dollar gap would mislead.
  R.tooFarToCompare = (price, typical) => R.placeholderPrice(price) || (price > 0 && typical > 0 && price >= typical * 20);
  R.offTopic = (f = {}) => {
    const t = `${f.title || ""}`;
    for (const [why, re] of OFF) if (re.test(t) && !(why === "service" && THING.test(t))) return why;
    if (f.price != null && f.price > 0 && f.price <= 1) return "$1 placeholder";
    if (R.placeholderPrice(f.price)) return "placeholder price";
    return "";
  };

  // A free read of a listing before any AI: one word from what's known without a model (sold prices,
  // scam signs, the seller, off-topic). null when there's nothing to go on. `v` uses the verdict names so
  // it takes their colors and glyphs; `rank` sorts unscored listings (higher first).
  R.freeRead = (f = {}, market) => {
    const cheap = f.vsSold != null ? R.tooCheap(f, market) : null;
    const said = f.vsSold != null && !cheap ? R.cheapForReason(f, market) : null; // cheap, and says why: still backs a code
    if (R.likelyScam(f) || R.codeBacked(f, cheap || said) || cheap?.level === "far") return { v: "suspicious", word: "Likely scam", rank: -2 };
    if (f.photoTwins || f.sellerWarn || (f.offSite && !f.offSiteOk) || cheap || f.dup || (f.titleCode && !f.codeOk)) return { v: "suspicious", word: "Check first", rank: -1 };
    const off = R.offTopic(f);
    if (off) return { v: "pass", word: "Off-topic", rank: -1 };
    // A broken or untested one is compared with working ones' prices: cheap for a reason, so no price word. So is
    // one that says why it's cheap (a flaw, something missing): it isn't a great price on the thing searched for.
    if (f.vsSold == null || f.project || said) return f.drop ? { v: "good", word: "Price dropped", rank: 1 } : null;
    return R.priceWord(f.vsSold);
  };
  // The price against the typical price (the middle of recent eBay sales, or the model's estimate), in dollars:
  // "$53 below typical", "$20 above typical", "about typical" (within 5%). testers found both "65% of sold" and the
  // word "sold" confusing on a card, so the chip says "typical" and its hover says where that comes from.
  // `working`: a broken or untested one, compared with what working ones sell for ("$147 below working ones"),
  // so a for-parts price doesn't read as a bargain on the same thing.
  R.vsText = (total, ref, { rough = false, est = false, long = false, working = false } = {}) => {
    if (!(ref > 0) || total == null) return "";
    const what = working ? (long ? "the typical price of a working one" : "working ones") : long ? "the typical price" : "typical";
    const d = Math.round(total - ref);
    const t = Math.abs(total - ref) <= ref * 0.05 ? `about ${what}` : `$${Math.abs(d)} ${d < 0 ? "below" : "above"} ${what}`;
    return `${rough || est ? "~" : ""}${t}${est ? " (est.)" : ""}`;
  };
  R.SOLD_CHIP = / (below|above) (typical|working ones)$|about (typical|working ones)$/; // the cards' price chip, to leave out where it would repeat

  // The price against the sold median, in a word.
  R.priceWord = (vs) =>
    vs <= 0.6 ? { v: "great", word: "Great price", rank: 4 }
    : vs <= 0.8 ? { v: "good", word: "Good price", rank: 3 }
    : vs <= 1.05 ? { v: "fair", word: "Fair price", rank: 2 }
    : { v: "pass", word: "Above typical", rank: 0 };

  // A likely scam without asking a model: a reposted listing, a disguised way to get in touch off the site,
  // or a code on the end of the title with another sign beside it (R.codeBacked). A code on its own is only
  // "Check first": real model numbers have the same shape ("ThinkPad T480", "Bose QC35", "DeWalt DCD771C2"),
  // and 17 of 19 ordinary Marketplace titles tried read as one (2026-10-21). A scan clears a code it judges
  // to be the model number (codeOk).
  R.likelyScam = (f) => !!(f && (f.campaign || f.offSite?.sure || R.codeBacked(f)));
  // What backs up a title code, as a few words ("" if nothing does): a price under the typical one (f.cheap,
  // set by the panel from tooCheap), the same photo on other listings, or a warning about the seller.
  R.codeBacked = (f, cheap = f?.cheap) => {
    if (!f?.titleCode || f.codeOk) return "";
    if (cheap) return "a price far under the typical one";
    if (f.photoTwins) return "a photo seen on other listings";
    return f.sellerWarn ? String(f.sellerWarn).toLowerCase().replace(/^seller: /, "a seller with ") : "";
  };
  // At or under your price for this search, and not a likely scam (nor a title code no scan has cleared yet).
  R.isDeal = (f, dealPrice) => dealPrice > 0 && f.total != null && f.total <= dealPrice && !R.likelyScam(f) && !(f.titleCode && !f.codeOk);

  // sellerJoined: the year the seller's account was made, where the site says (Marketplace: "Joined
  // Facebook in 2026"). An account made this year is how most Marketplace scams start.
  R.sellerWarning = (f, { minSellerRatings, minSellerPct }, now = Date.now()) => {
    if (f.sellerCount != null && f.sellerCount < minSellerRatings) return f.sellerCount === 0 ? "New seller" : `Seller: ${f.sellerCount} rating${f.sellerCount === 1 ? "" : "s"}`;
    if (f.sellerPct != null && f.sellerPct < minSellerPct) return `Seller ${f.sellerPct}% positive`;
    if (f.sellerJoined >= new Date(now).getFullYear()) return `Account made in ${f.sellerJoined}`;
    return "";
  };
  // A seller sign strict enough to make a low price "Likely scam" (cheapLevel), whatever your own limits for the
  // Check first warning are: 4 ratings or fewer, under 95% positive, under 98% with fewer than 20 ratings, or an
  // account made this year. Honest small sellers (6 ratings, all positive) still get the warning, not the mark.
  // Returns a few words ("a seller with 2 ratings") or "".
  R.riskySeller = (f, now = Date.now()) => {
    const n = f?.sellerCount, pct = f?.sellerPct;
    if (n != null && n <= 4) return n === 0 ? "a new seller" : `a seller with ${n} rating${n === 1 ? "" : "s"}`;
    if (pct != null && (pct < 95 || (pct < 98 && n != null && n < 20))) return `a seller at ${pct}% positive`;
    if (f?.sellerJoined >= new Date(now).getFullYear()) return `an account made in ${f.sellerJoined}`;
    return "";
  };

  // A price far under what the same thing sells for is the other half of most scams: the bait. Only with
  // a sold reference worth trusting (not "rough"), and never for what that reference doesn't describe:
  // auctions (a bid isn't a price), lots, and broken ones (the reference is for working ones).
  // Returns { level: "far" | "low", pct } or null. Cutoffs in one place so they can be tuned.
  // Not for something else either: an accessory or part for what was searched (f.accessory, from
  // accessoryOf) or a listing a scan said isn't what you searched for (related false).
  // A title that leaves out a word of the search (f.offWords, from missingWord) may be something else that
  // turned up in it ("Mario Kart 8 Deluxe - Nintendo Switch" in a "switch oled" search), so a price far under
  // is only "low" (Check first), never "far" (Likely scam) on price alone. Bait copies the search's words.
  R.TOO_CHEAP = { far: 0.4, low: 0.55 };
  R.LOCAL_NET = 0.864; // what an eBay seller keeps after fees (13.6%): a pickup seller asking that much nets the same
  R.tooCheap = (f, market) => {
    const c = cheapLevel(f, market);
    return c && c.level !== "reason" ? c : null;
  };
  // Under the softer cutoff with a reason on the card (R.cheapReason), or from an established eBay seller, and nothing
  // else against it: not a warning, but the price chip says why it's cheap. { pct, why, established? } or null
  // (why is "" for an established seller's listing that doesn't say).
  R.cheapForReason = (f, market) => {
    const c = cheapLevel(f, market);
    return c?.level === "reason" ? { pct: c.pct, why: c.why || "", ...(c.established && { established: true }) } : null;
  };
  // Price alone, under the firm cutoff: "far" (Likely scam), unless the title leaves out a search word or says why
  // it's cheap ("low", Check first). Under the softer cutoff: "low", or "reason" when the card says why. A seller
  // with a strong warning (R.riskySeller: a handful of ratings, a poor score, an account made this year) makes the
  // softer band "far" too: in the eval every such listing was a scam and honest new sellers price near the typical
  // price. `seller` on the result is that warning, in words. A reason doesn't clear that pair,
  // but keeps it at "low".
  // `why` (f.saysWhy from compareFacts, or worked out here) is set on "low" and "reason" for the chip to say.
  const cheapLevel = (f, market) => {
    if (!(market?.median > 0) || market.confidence === "rough" || f?.total == null || f.total <= 0) return null;
    if (f.auction || f.lot || f.project || f.accessory || f.foreign || f.priceRange || f.related === false) return null;
    const pct = f.total / market.median;
    const risky = !f.offWords && (f.sellerRisk ?? R.riskySeller(f)); // sellerRisk: worked out by the caller (the eval, at a fixed date)
    // A pickup seller keeps the whole price; an eBay seller pays about 13.6% in fees, so the same net asks less locally.
    // Not beside a strong seller sign: a new account at half price is the scam's look on any site.
    const cut = market.local && !risky ? R.LOCAL_NET : 1;
    if (pct >= R.TOO_CHEAP.low * cut) return null;
    const why = f.saysWhy ?? R.cheapReason(f.title, f.text ?? f.details, market.query || "");
    const out = (level, extra) => ({ level, pct: Math.round(pct * 100), ...(why && level !== "far" && { why }), ...extra });
    // Real sales went this low (the cheapest tenth of them, market.p10): honest prices land here too, as in a search
    // that mixes models ("nintendo switch": Lites, V1s and OLEDs), so it isn't bait on price alone.
    if (market.p10 > 0 && f.total >= market.p10) return why ? out("reason") : null;
    // Under the firm cutoff only something missing or a cheaper version explains it: "minor scratches" doesn't
    // take 60% off, and it's the story bait tells.
    // A "fair" reference (fewer sales, or a wider spread) can't say a price alone is bait: that needs a "good" one.
    const big = why && !FLAW.test(why);
    // An established eBay seller (100 ratings or more, 98% positive): eBay's money-back guarantee stands behind the
    // listing, and fakes rarely come from such accounts at a soft discount. Under the softer cutoff that's no warning;
    // under the firm one it is as for anyone (a fake from an established seller is still in the eval).
    const established = !market.local && f.sellerCount >= 100 && f.sellerPct >= 98;
    if (pct < R.TOO_CHEAP.far * cut) return risky ? out("far", { seller: risky }) : out(f.offWords || big || market.confidence !== "good" ? "low" : "far");
    if (risky) return why ? out("low") : out("far", { seller: risky });
    return why ? out("reason") : established ? out("reason", { established: true }) : out("low");
  };

  // Why a listing says it's cheap, in its own words: a flaw ("dead pixel", "battery 76%", "carrier locked"),
  // something missing ("console only, no dock"), or a cheaper version than the search ("mini" in an iPhone 13
  // search). Returns the words, or "". Said away ("no scratches", "scratch-free") doesn't count, and nor do the
  // quick-sale words ("moving", "must go"): bait uses them as much as anyone. `query`: the search, so a version
  // the search names ("switch lite") isn't a cheaper one.
  const FLAW = new RegExp(String.raw`\b(` + [
    String.raw`(?:dead|stuck|bad) pixels?`, String.raw`scratch(?:ed|es)?`, String.raw`scuff(?:ed|s)?`, String.raw`dent(?:ed|s)?`, String.raw`dings?`,
    String.raw`(?:small |hairline )?cracks? (?:on|in) (?:the )?(?:back|bezel|case|corner|side|frame|housing|lens|glass)`,
    String.raw`cracked (?:back|bezel|case|corner|frame|housing|lens|glass)`, String.raw`(?:small|hairline) crack`, String.raw`chipped`,
    String.raw`(?:heavy|lots of|signs of) wear`, String.raw`(?:well |very )?worn`, String.raw`stain(?:ed|s)?`, String.raw`drift(?:ing)?`,
    String.raw`battery (?:health |life |at )?(?:[1-7]\d|8[0-4]) ?%`, String.raw`(?:[1-7]\d|8[0-4]) ?% battery`, String.raw`(?:bad|weak|swollen) battery`,
    String.raw`needs (?:a )?(?:new )?battery`, String.raw`squeak(?:s|y|ing)?`, String.raw`meter (?:dead|doesn'?t work|not working|is off)`,
    String.raw`(?:needs |new )?light seals?`, String.raw`(?:carrier|network|sim) locked`, String.raw`(?:verizon|at ?t|at&t|t-mobile|sprint|cricket|metro) locked`,
    String.raw`locked to (?:verizon|at ?t|at&t|t-mobile|sprint|cricket|metro|a carrier)`, String.raw`(?:screen |lcd )?burn[- ]?in`,
    String.raw`screen (?:spots?|lines?|bruises?|discolou?ration)`, String.raw`lines? on (?:the )?screen`, String.raw`cosmetic (?:damage|issues?|wear|flaws?)`,
    String.raw`(?:fair|poor|rough) (?:condition|shape)`, String.raw`as found`, String.raw`(?:has|with) (?:some )?(?:issues?|flaws?|problems?)`, String.raw`haze|fungus|separation`,
  ].join("|") + String.raw`)(?!\w)`, "i");
  const PARTS_GONE = String.raw`joy ?cons?|dock|charger|charging (?:cable|case)|controllers?|lens(?:es)?|battery|batteries|cables?|stand|power (?:cord|supply|adapter)|cord|adapter|remote|case|earbuds?|stylus|keyboard|accessories`;
  const MISSING = new RegExp(String.raw`\b((?:missing|without|no) (?:the |its |a |any )?(?:${PARTS_GONE})|missing [\w-]+|(?:console|tablet|body|unit|handheld|screen|tool|phone|laptop|earbuds?|(?:left|right) (?:earbud|airpod|ear|side)) only)\b`, "i");
  const CHEAPER = /\b(lite|mini|1st gen(?:eration)?|first gen(?:eration)?|gen ?1|v1|older model)\b/i;
  const SAID_AWAY = /\b(?:no|not a|not one|zero|without|free of|never|any)\s+(?:\w+\s+)?$/i;
  const cheapSeen = new Map(); // (title, text, search) -> the answer: a feed asks again for every card each time it loads more
  R.cheapReason = (title, text = "", query = "") => {
    const key = `${title || ""}\u0001${text || ""}\u0001${query || ""}`;
    if (cheapSeen.has(key)) return cheapSeen.get(key);
    if (cheapSeen.size > 5000) cheapSeen.clear();
    const out = cheapReasonOf(title, text, query);
    cheapSeen.set(key, out);
    return out;
  };
  const cheapReasonOf = (title, text, query) => {
    const t = R.fold(`${title || ""} ${text || ""}`).replace(/\s+/g, " ");
    const said = (re) => {
      for (const m of t.matchAll(new RegExp(re.source, "gi"))) {
        if (SAID_AWAY.test(t.slice(Math.max(0, m.index - 24), m.index)) || /^[- ]?free\b/.test(t.slice(m.index + m[0].length))) continue;
        return m[1].toLowerCase();
      }
      return "";
    };
    const flaw = said(FLAW);
    if (flaw) return flaw;
    const missing = t.match(MISSING)?.[1];
    if (missing && !/^missing (?:nothing|anything|out)\b/.test(missing.toLowerCase()) && !/\bnot (?:be )?$/.test(t.slice(0, t.indexOf(missing.toLowerCase())))) return missing.toLowerCase();
    const cheaper = t.match(CHEAPER)?.[1];
    if (cheaper && !R.hasWord(query, cheaper)) return cheaper.toLowerCase();
    return R.smallerStorage(t, query);
  };
  // A smaller size than the search names: "64GB" in an "iphone 13 128gb" search. "" when there's none.
  R.smallerStorage = (title, query = "") => {
    const size = (s) => [...R.fold(s).matchAll(/\b(\d+) ?(gb|tb)\b/g)].map((m) => +m[1] * (m[2] === "tb" ? 1024 : 1));
    const want = size(query)[0];
    const have = size(title).filter((n) => n >= 16); // not 8GB of memory beside 256GB of storage
    return want && have.length && Math.max(...have) < want ? `${Math.max(...have) >= 1024 ? Math.max(...have) / 1024 + "TB" : Math.max(...have) + "GB"}` : "";
  };

  // A title code that is the model number you searched for ("DeWalt 20V Max Drill DCD771C2" in a "dewalt dcd771"
  // search) isn't a scammer's code: the search has it, so every honest listing of that model ends with it.
  // A search word counts when it has letters and digits and is 4 or more long, and the code starts with it
  // or it starts with the code.
  R.codeInSearch = (code, query = "") => {
    const c = R.fold(code).replace(/[^a-z0-9]/g, "");
    if (c.length < 4) return false;
    return R.normTitle(query).split(" ").some((w) => w.length >= 4 && /\d/.test(w) && /[a-z]/.test(w) && (c.startsWith(w) || w.startsWith(c)));
  };

  // A card's facts against the search's typical price, the way the panel works them out on every results page
  // (and tests/eval runs them on labeled listings). Sets f.accessory, f.offWords and f.cheap; returns the
  // total as a share of the typical price, or null when the two shouldn't be compared (a lot, an auction, an
  // accessory, a stand-in price). `query`: the search the typical price is for. A listing priced from its own
  // title (f.ownMarket) isn't held against the search's words.
  R.compareFacts = (f, market, query = "") => {
    f.accessory = (!f.ownMarket && R.accessoryOf(f.title, query)) || "";
    f.offWords = (!f.ownMarket && R.missingWord(f.title, query)) || "";
    f.saysWhy = R.cheapReason(f.title, f.text, f.ownMarket ? "" : query); // why it's cheap, in its own words (tooCheap)
    const off = !f.ownMarket && R.offSearch(f.title, query);
    const vs = market?.median > 0 && f.total != null && !f.foreign && !f.priceRange && !f.lot && !f.auction && !f.accessory && !off && !R.tooFarToCompare(f.price ?? f.total, market.median) ? f.total / market.median : null;
    f.cheap = (vs != null && (R.tooCheap(f, market)?.level || (R.cheapForReason(f, market) && "reason"))) || ""; // backs up a title code (codeBacked)
    return vs;
  };

  // Sold totals include the shipping buyers paid; a pickup listing (a local site, no shipping on it) has none
  // to pay, so it's compared with the typical price less the typical shipping. Otherwise a $40 pickup price
  // read as 77% of a $52 total that was $40 plus $12 to post. Only when the sales say what shipping cost
  // (market.ship) and it's under half the price. Returns the market as is, or a copy with pickupShip set.
  // A pickup listing's market also has local set (cheapLevel's fee allowance), with or without shipping taken off.
  R.forPickup = (market, f, local) => {
    const ship = market?.ship;
    if (!local || !(market?.median > 0) || f?.shipping != null || f?.auction) return market;
    if (!(ship > 0) || !(market.median > ship * 2)) return { ...market, local: true };
    const r = (n) => Math.round(n * 100) / 100;
    return { ...market, median: r(market.median - ship), ...(market.p10 > 0 && { p10: r(Math.max(1, market.p10 - ship)) }), p25: r(Math.max(1, (market.p25 ?? market.median) - ship)), p75: r((market.p75 ?? market.median) - ship), pickupShip: ship, local: true };
  };

  // When the score and the price disagree, the price check wins (2026-10-15). Far under the typical
  // price: the bait, so the verdict turns to a warning ("Great price, if it's real"); well over it: no better
  // than Fair price. `it` needs total (and auction/lot/project); market is { median, confidence }.
  // Returns { v, label? }: the verdict to show, and a label when it isn't the verdict's usual one.
  // When it does change the verdict, the score moves into the new verdict's range (as fitScore does for the
  // model's own answer), so the number never says "82" beside "Fair price" or "91" beside a warning, and
  // `why` says what the price check saw, in place of a model reason that may still praise the price.
  R.ABOVE_CAP = 1.25;
  // it.cheapWhy: why the model says a low price is low ("flaw", "missing parts", "different model", "quick sale"
  // or ""). A reason it read in the listing can beat the price check (Myer, 2026-10-21): under the softer cutoff a
  // scan's or Analyze's word stands, no better than Good price; under the firm one only Analyze (opts.deep, which read
  // the whole listing) clears it, no better than Fair price, for something missing or a cheaper version (a flaw doesn't
  // take 60% off: it's the story bait tells, as in cheapLevel), and never beside a strong seller sign or another
  // scam sign. A "quick sale" is no reason: bait tells that story most.
  R.MODEL_WHY = ["flaw", "missing parts", "different model"];
  R.priceVerdict = (verdict, it, market, { deep = false } = {}) => {
    const keep = { v: verdict };
    if (!(verdict in R.RANK) || verdict === "pass" || !it || it.total == null || it.foreign || !(market?.median > 0)) return keep;
    const typical = R.dollars(Math.round(market.median));
    const pct = Math.round((it.total / market.median) * 100);
    const moved = (v, extra) => ({ v, ...(it.score != null ? { score: R.fitScore(v, it.score) } : {}), ...extra });
    // Cheap and saying why (a flaw, something missing, a cheaper version): the scan's word stands, but no better
    // than Good price, since it isn't the whole thing at a great price.
    const said = R.cheapForReason(it, market);
    // A title code no scan has cleared, with a price under the typical one: the bulk-posted fake, whatever the reason.
    if (said && it.titleCode && !it.codeOk) return moved("suspicious", { label: "Great price, if it’s real", why: `${R.dollars(it.total)} is ${said.pct}% of the typical ${typical}, and the title ends with the code ${it.titleCode}, as bulk-posted fakes do: check it's real before you pay.` });
    if (said) return R.RANK[verdict] > R.RANK.good ? moved("good", { why: `Held at Good price: ${R.dollars(it.total)} is ${said.pct}% of the typical ${typical}, ${said.why ? `and the listing says why (“${said.why}”)` : "from an established eBay seller"}.` }) : keep;
    const cheap = R.tooCheap(it, market);
    const read = cheap && verdict !== "suspicious" && R.MODEL_WHY.includes(it.cheapWhy) && R.RANK[verdict] > R.RANK.pass;
    if (read && cheap.level === "low") return R.RANK[verdict] > R.RANK.good ? moved("good", { why: `Held at Good price: ${R.dollars(it.total)} is ${cheap.pct}% of the typical ${typical}; the scan read why (${it.cheapWhy}). Check the photos show it.` }) : keep;
    if (read && deep && it.cheapWhy !== "flaw" && !cheap.seller && !R.likelyScam(it) && !(it.titleCode && !it.codeOk)) return R.RANK[verdict] > R.RANK.fair ? moved("fair", { why: `Held at Fair price: ${R.dollars(it.total)} is ${cheap.pct}% of the typical ${typical}, far under it; the listing gives a reason (${it.cheapWhy}). Check the photos show it before you pay.` }) : keep;
    if (cheap) return moved("suspicious", { level: cheap.level, label: "Great price, if it’s real", why: `${R.dollars(it.total)} is ${cheap.pct}% of the typical ${typical}${cheap.seller ? `, from ${cheap.seller}` : ""}. Far under what the same thing sells for is the usual bait: check it's real before you pay.` });
    if (!it.auction && !it.lot && !it.project && !it.accessory && !it.priceRange && it.related !== false && it.total > market.median * R.ABOVE_CAP && R.RANK[verdict] > R.RANK.fair) return moved("fair", { why: `Held at Fair price: ${R.dollars(it.total)} is ${pct}% of the typical ${typical}.` });
    return keep;
  };
  // The first word of the search that the title doesn't have ("" if it has them all). Spacing and hyphens
  // don't count ("K-1000" has "k1000"), nor a plural "s"; words the search leaves out ("-case") and short ones
  // ("a", "of", "3") are skipped.
  const searchWords = (query) =>
    R.quickTerms(String(query)).filter((t) => !t.not).flatMap((t) => R.normTitle(t.w).split(" ")).filter((w) => w.length >= 3 && !/^(?:and|the|for|with|used|new)$/.test(w));
  const inTitle = (flat, w) => flat.includes(w) || flat.includes(w.replace(/s$/, ""));
  R.missingWord = (title, query = "") => {
    const flat = R.normTitle(title).replace(/\s+/g, "");
    if (!flat) return "";
    return searchWords(query).find((w) => !inTitle(flat, w)) || "";
  };
  // None of the search's words in the title: Marketplace fills a search with whatever is for sale nearby ("Phone",
  // "Bose soundlink" in an "ipod classic" search, 70 of 90 cards in one), and its price says nothing against
  // the search's typical price. Not compared at all (compareFacts), so no "Great price" or "Check first" from it.
  R.offSearch = (title, query = "") => {
    const words = searchWords(query);
    const flat = R.normTitle(title).replace(/\s+/g, "");
    return !!flat && words.length > 0 && !words.some((w) => inTitle(flat, w));
  };

  // An accessory or part for what was searched, not the thing itself: "Case for Nintendo Switch",
  // "Switch carrying case", "Game Boy SP replacement shell", "box only". Its price says nothing against the
  // typical price of the thing (a $15 case is 7% of a $200 console, which read as "Likely scam"), so it gets no
  // page-wide comparison; it can still be priced from its own title. A word the search has ("switch case")
  // doesn't count, and one after "with" or "includes" is what comes with the item ("Switch with case").
  // Returns the word that gave it away, or "".
  const PART = "case|cover|skin|sleeve|bag|pouch|stand|mount|dock|holder|strap|charger|charging cable|cable|cord|power supply|adapter|battery|" +
    "remote|controller|grip|protector|decal|sticker|faceplate|shell|housing|manual|box|lens cap|lens hood|bezel|" +
    "charging station|stylus|knob|buttons?|ribbon cable|hinge|motherboard";
  const PART_LAST = new RegExp(String.raw`(?:^|\s)((?:${PART})s?)$`);
  const PART_FOR = new RegExp(String.raw`(?:^|\s)((?:${PART})s?) (?:only|for)\b`);
  const PART_ANY = /\b(compatible with|for use with|replacement|screen protector|tempered glass|empty box|box only|no (?:console|camera|phone|watch|tablet|laptop|device|unit|handset|system|body)|video game(?! (?:console|system))|game cartridge|(?:cartridge|cart|disc|game|case) only|game disc|physical copy|(?:digital|download) code|game card|(?:(?:left|right) )?(?:earbud|airpod|ear ?bud)s? only)\b/;
  // "with", "in", a count ("2 controllers"), or a word that says it's the whole thing: what comes with the item.
  const WITH = /(?:^|\s)(?:with|w|in|includes?|including|incl|plus|and|console|system|bundle|cib|complete)(?:\s|$)/;
  const PART_AND = new RegExp(String.raw`\b((?:${PART})s?) and (?=(?:${PART})s?\b)`, "g");
  const GAME = /(?:^|\s)(game)(?!\s(?:console|system|boy|cube|gear|pad|controller|card))(?:\s|$)/;
  const comesWith = (t, m) => WITH.test(t.slice(0, m.index + 1)) || (/s$/.test(m[1]) && /(?:^|\s)\d+\s?$/.test(t.slice(0, m.index + 1)));
  // "...NEW BATTERY", "3000mAh Battery", "SSD Wolfson DAC Battery": a battery put in it, the way refurbished
  // iPods, phones and handhelds are sold (12 of 60 cards in a real iPod search), not a battery for sale.
  const FITTED = /(?:^|\s)(?:new|fresh|upgraded|replaced|rebuilt|\d+ ?mah|dac|ssd|mod|modded)\s$/;
  R.accessoryOf = (title, query = "") => {
    // "+" and "&" join what comes with it: "Switch OLED + 3 games + case" is a console with a case.
    // "+" and "&" join what comes with it: "Switch OLED + 3 games + case" is a console with a case. Two parts
    // joined by "and" are both the listing ("Switch OLED dock and charger"), not a console and its charger.
    const t = R.normTitle(String(title ?? "").replace(/\s*[+&]\s*/g, " with ")).replace(/\s+/g, " ").replace(PART_AND, "$1 ");
    if (!t || !String(query).trim()) return "";
    const has = (w) => R.hasWord(query, w) || R.hasWord(query, w.replace(/s$/, ""));
    const any = t.match(PART_ANY)?.[1];
    if (any && !has(any)) return any;
    // "Game" in a console search is a game ("Pokemon Scarlet Nintendo Switch OLED Game"), unless it's the
    // machine ("handheld game console") or comes with it ("console with game").
    const game = PLATFORM.test(R.normTitle(query)) && !has("game") && t.match(GAME);
    if (game && !comesWith(t, game)) return "game";
    const forOnly = t.match(PART_FOR);
    if (forOnly && !has(forOnly[1]) && !comesWith(t, forOnly)) return forOnly[1];
    const last = t.match(PART_LAST);
    if (last && !has(last[1]) && !comesWith(t, last) && !(/^batter/.test(last[1]) && FITTED.test(t.slice(0, last.index + 1)))) return last[1];
    return R.madeFor(title, query);
  };
  // A game (or anything else) named after the thing it's for: "Mario Kart 8 Deluxe - Nintendo Switch", "Zelda:
  // Breath of the Wild (Nintendo Switch)", "Minecraft for Nintendo Switch". The search's words all come after a
  // dash, a bracket or "for", none come before, and what comes before names something: not just "Brand new" or a
  // color. Bait copies the search's words first ("Nintendo Switch OLED - fast shipping"), so it stays priced.
  // Returns what it names (folded, "mario kart 8 deluxe"), or "".
  const FILLER = new Set(("brand|new|sealed|factory|mint|used|working|tested|great|good|excellent|like|rare|clean|nice|wow|look|" +
    "free|fast|shipping|bundle|console|system|lot|oem|genuine|authentic|original|official|the|a|an|white|black|red|blue|neon|gray|" +
    "grey|pink|green|coral|turquoise|purple|yellow|silver|gold|edition|limited|special|hot|sale|deal|cheap|wholesale|unlocked|refurbished|" +
    "renewed|apple|sony|nintendo|microsoft|samsung|google|canon|nikon").split("|"));
  const PLATFORM = /\b(?:switch|ps[1-5]|playstation|xbox|game ?boy|gba|n?3?ds|wii|gamecube|n64|nintendo 64|snes|nes|genesis|dreamcast|vita|psp|steam deck)\b/;
  const MACHINE = /^(?:console|consoles|system|bundle|handheld|lite|oled|slim|pro|modded|jailbroken|hacked|\d+(?:gb|tb))$/;
  const TAIL_OK = new Set("game|games|video|edition|version|physical|digital|ntsc|pal|us|usa|cib|complete|new|sealed|for|the|and".split("|"));
  R.madeFor = (title, query = "") => {
    const raw = String(title ?? "");
    for (const m of raw.matchAll(/\s[-\u2013\u2014|:]\s|\s*[(\[]|\s+for\s+/gi)) {
      const head = raw.slice(0, m.index), tail = raw.slice(m.index + m[0].length);
      // The tail names the search, or the console part of it ("- Nintendo Switch" in a "switch oled" search)…
      if (R.missingWord(tail, query) && !PLATFORM.test(R.normTitle(tail))) continue;
      // …and little else: "- PS5", "(Nintendo Switch, 2017)", not "- Apple iPhone 13 128GB" or "(PS5) Disc Edition".
      const q = R.normTitle(query).split(" ").filter(Boolean);
      const rest = R.normTitle(tail).split(" ").filter((w) => w && !q.some((x) => w.includes(x) || x.includes(w)) && !TAIL_OK.has(w) && !/^(?:19|20)\d\d$/.test(w));
      if (rest.length) return "";
      const words = R.normTitle(head).split(" ").filter(Boolean);
      const flat = words.join("");
      if (R.normTitle(query).split(" ").some((q) => q.length >= 3 && flat.includes(q))) return ""; // named first: the thing itself
      // One word before a dash may be the brand ("Apple - iPhone 13"); before "for" it's the thing ("Minecraft for …").
      const named = words.filter((w) => !FILLER.has(w) && !/^\d+$/.test(w));
      return named.length >= 2 || (named.length && /for/i.test(m[0])) ? words.join(" ") : "";
    }
    // A game console searched for, and the search at the very end with no separator: "Mario Kart 8 Deluxe Nintendo
    // Switch". Two or more words that name something, none that say it's the machine ("console", "bundle", "32gb").
    // Only for consoles: elsewhere the same shape is the thing itself ("Vintage Film Camera Pentax K1000").
    const t = R.normTitle(raw), qn = R.normTitle(query);
    if (!qn || !PLATFORM.test(qn) || !t.endsWith(` ${qn}`)) return "";
    const words = t.slice(0, -qn.length).trim().split(" ");
    const named = words.filter((w) => !FILLER.has(w) && !/^\d+$/.test(w));
    return named.length >= 2 && !words.some((w) => MACHINE.test(w)) ? words.join(" ") : "";
  };

  // "Seller may take less": what a listing shows that usually means room to haggle. Each sign is a short
  // reason; two or more make it likely. drops: price drops you've seen; days: how long it's been listed (or
  // since you first saw it); motivated: "moving sale" and the like; bestOffer: the site's own offer button.
  R.softSeller = ({ drops = 0, days = null, motivated = "", bestOffer = false } = {}) => {
    const why = [];
    if (drops >= 1) why.push(drops === 1 ? "the price dropped once" : `the price dropped ${drops} times`);
    if (days != null && days >= 30) why.push(`listed for ${days >= 60 ? `${Math.round(days / 30)} months` : `${Math.round(days)} days`}`);
    if (motivated) why.push(`“${motivated}”`);
    if (bestOffer) why.push("takes offers");
    return { level: why.length >= 2 ? "likely" : why.length ? "some" : "none", why };
  };

  // Friendly offer amounts: whole dollars under $20, fives under $100, tens above. Always rounded down.
  R.roundOffer = (n) => {
    const step = n < 20 ? 1 : n < 100 ? 5 : 10;
    return Math.max(step, Math.floor(n / step) * step);
  };
  // An opening offer and the most worth paying, worked out from sold prices, with the reasons. Totals
  // include shipping (that's how sold prices compare); the amounts to offer are for the item alone.
  // Opens midway between the cheaper quarter of sales and the median (at the cheaper quarter when the
  // seller looks soft), never above the asking price, never under 60% of it (lower reads as a lowball
  // and gets ignored). Walk away above the median. Returns null when there's nothing solid to go on.
  R.offerPlan = ({ price, shipping = 0, auction, lot, project, foreign, priceRange, soft = "none" } = {}, market) => {
    if (!(market?.median > 0) || !(market.p25 > 0) || price == null || !(price > 0) || auction || lot || project || foreign || priceRange) return null;
    const ship = Number(shipping) || 0;
    const total = price + ship;
    const reasons = [`the typical price is $${market.p25}–$${market.p75} (${market.n} recent eBay sales)`];
    if (total <= market.p25) return { cheap: true, open: null, walkAway: null, reasons: [`it's already under most sales: ${reasons[0]}`], confidence: market.confidence };
    const target = soft === "likely" ? market.p25 : (market.p25 + market.median) / 2;
    const open = R.roundOffer(Math.max(price * 0.6, Math.min(price, target - ship)));
    const walkAway = R.roundOffer(Math.min(price, market.median - ship));
    if (soft !== "none") reasons.push(soft === "likely" ? "the seller looks ready to take less" : "the seller may take less");
    return { cheap: false, open: Math.min(open, walkAway), walkAway, reasons, confidence: market.confidence };
  };
  // Messages to send a seller, from templates (free and predictable). local: pickup sites; bestOffer on
  // eBay means using its Make offer button, so there's no message, only the amount.
  R.offerMessages = (amount, { local = false, bestOffer = false, site = "" } = {}) => {
    if (!(amount > 0)) return [];
    if (bestOffer && site === "ebay") return [{ id: "button", label: "Make offer", text: `Use eBay's Make offer button with $${amount}.`, button: true }];
    const pickup = local ? " I can pick up whenever suits you." : "";
    return [
      { id: "friendly", label: "Friendly", text: `Hi! Is this still available? Would you take $${amount}?${pickup}` },
      { id: "direct", label: "Direct", text: `Hi, I can offer $${amount}${local ? " cash, and pick up today or tomorrow" : ""}. Let me know if that works.` },
      { id: "why", label: "With a reason", text: `Hi! Similar ones have been selling for around this, so would you take $${amount}?${pickup}` },
    ];
  };

  // The analysis's offer range, kept near the plan from sold prices: the model may move it for what it read in
  // the listing, but not below 90% of the plan's opening offer or above its walk-away price. A rough reference,
  // no plan, or a range of 0 (no haggling) leaves the model's numbers as they are. Returns [low, high].
  R.fitOffer = (low, high, plan) => {
    if (!(high > 0) || !plan || plan.cheap || plan.confidence === "rough" || !(plan.open > 0)) return [low, high];
    const top = Math.max(plan.open, plan.walkAway || 0);
    const floor = R.roundOffer(plan.open * 0.9);
    const lo = Math.min(top, Math.max(floor, low | 0));
    return [lo, Math.min(top, Math.max(lo, high | 0))];
  };
  // When the seller answers with a price: take it, meet in the middle, or offer the walk-away price once.
  // plan: { open, walkAway } (from offerPlan, or the analysis's range). Returns { action, amount, why } or null.
  R.counterOffer = (plan, theirs) => {
    theirs = Number(theirs);
    if (!(plan?.open > 0) || !(theirs > 0)) return null;
    const open = plan.open;
    const top = plan.walkAway > open ? plan.walkAway : open;
    if (theirs <= open) return { action: "accept", amount: theirs, why: "that's at or under your opening offer" };
    if (theirs <= top) {
      let mid = R.roundOffer((open + theirs) / 2);
      if (mid <= open) mid = Math.round((open + theirs) / 2); // rounding mustn't land back on the offer they turned down
      if (theirs - mid < Math.max(5, theirs * 0.05)) return { action: "accept", amount: theirs, why: "that's within what you planned to pay" };
      return { action: "counter", amount: mid, why: `it's under your walk-away price, and meeting in the middle saves $${theirs - mid}` };
    }
    return { action: "last", amount: top, why: `it's over your walk-away price of $${top}` };
  };
  // The reply to send for a counterOffer answer. On eBay with best offer, the answer goes through its offer page.
  R.counterMessage = (c, { local = false, bestOffer = false, site = "" } = {}) => {
    if (!c) return "";
    if (bestOffer && site === "ebay") return c.action === "accept" ? `Accept their counteroffer of $${c.amount} on eBay.` : `Counter with $${c.amount} on eBay's offer page.`;
    if (c.action === "accept") return `Deal, $${c.amount} works for me.${local ? " When can I pick it up?" : ""}`;
    if (c.action === "counter") return `Thanks! Could we meet in the middle at $${c.amount}?`;
    return `Thanks, but $${c.amount} is the most I can do. Let me know if that works.`;
  };

  // Words that say "fix-up project" (what a fixer hunts for, and Marketplace can't search for all at
  // once) and words that say the seller wants it gone. Read from the title and card text.
  R.PROJECT =
    /\b(for parts(?: or repair| only)?|parts only|parts or repair|not working|non[- ]?working|untested|as[- ]is|broken|no power|won'?t (?:turn|power) on|doesn'?t (?:work|turn on|power on)|needs (?:repair|work|fixing|a new \w+)|faulty|for repair|disc read error|no (?:display|video|sound|picture)|red ring|yellow light|cracked screen|water damage|(?:icloud|activation|mdm) lock(?:ed)?|bad esn|blacklisted)\b/i;
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

  // ---------- the same photo on other listings ----------
  // How many of two photo hashes' 64 bits differ (64 when either is missing).
  R.hashDistance = (a, b) => {
    if (!/^[0-9a-f]{16}$/.test(a || "") || !/^[0-9a-f]{16}$/.test(b || "")) return 64;
    let d = 0;
    for (let i = 0; i < 16; i += 8) for (let x = parseInt(a.slice(i, i + 8), 16) ^ parseInt(b.slice(i, i + 8), 16); x; x >>>= 1) d += x & 1;
    return d;
  };
  R.PHOTO_NEAR = 4; // bits apart that still count as the same picture
  // The other listings showing this listing's photo, from what you've seen (seen: key -> { h: hash, f: the
  // photo's file name, t: title }). The same file under another listing is the seller's own relist or a catalog
  // photo, and the same title is a relist or a repost already marked elsewhere: neither counts. What's left is
  // the same picture uploaded again under another title: a stolen photo, or a stock one. Returns their keys.
  R.photoTwins = (key, seen) => {
    const me = seen?.[key];
    if (!me?.h) return [];
    const out = [];
    for (const [k, o] of Object.entries(seen)) {
      if (k === key || !o?.h || (o.f && o.f === me.f) || (o.t && o.t === me.t)) continue;
      if (R.hashDistance(me.h, o.h) <= R.PHOTO_NEAR) out.push(k);
    }
    return out;
  };
  // A photo's file name from its address, which stays the same across the sizes a site serves it in (eBay:
  // /images/g/<id>/s-l500.jpg; Facebook: /v/…/<id>_n.jpg?…).
  R.photoFile = (url) => {
    try {
      const parts = new URL(url).pathname.split("/").filter(Boolean);
      let last = parts.pop() || "";
      if (/^s-l\d+\.\w+$/i.test(last)) last = parts.pop() || "";
      return last.replace(/\.\w+$/, "");
    } catch {
      return "";
    }
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
