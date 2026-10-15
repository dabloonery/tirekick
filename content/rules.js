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
  R.offTopic = (f = {}) => {
    const t = `${f.title || ""}`;
    for (const [why, re] of OFF) if (re.test(t) && !(why === "service" && THING.test(t))) return why;
    if (f.price != null && f.price > 0 && f.price <= 1) return "$1 placeholder";
    return "";
  };

  // A free read of a listing before any AI: one word from what's known without a model (sold prices,
  // scam signs, the seller, off-topic). null when there's nothing to go on. `v` uses the verdict names so
  // it takes their colors and glyphs; `rank` sorts unscored listings (higher first).
  R.freeRead = (f = {}, market) => {
    const cheap = f.vsSold != null ? R.tooCheap(f, market) : null;
    if (R.likelyScam(f) || cheap?.level === "far") return { v: "suspicious", word: "Likely scam", rank: -2 };
    if (f.photoTwins || f.sellerWarn || f.offSite || cheap || f.dup) return { v: "suspicious", word: "Check first", rank: -1 };
    const off = R.offTopic(f);
    if (off) return { v: "pass", word: "Off-topic", rank: -1 };
    // A broken or untested one is compared with working ones' prices: cheap for a reason, so no price word.
    if (f.vsSold == null || f.project) return f.drop ? { v: "good", word: "Price dropped", rank: 1 } : null;
    return R.priceWord(f.vsSold);
  };
  // The price against the typical price (the middle of recent eBay sales, or the model's estimate), in dollars:
  // "$53 below typical", "$20 above typical", "about typical" (within 5%). Myer found both "65% of sold" and the
  // word "sold" confusing on a card, so the chip says "typical" and its hover says where that comes from.
  R.vsText = (total, ref, { rough = false, est = false, long = false } = {}) => {
    if (!(ref > 0) || total == null) return "";
    const what = long ? "the typical price" : "typical";
    const d = Math.round(total - ref);
    const t = Math.abs(total - ref) <= ref * 0.05 ? `about ${what}` : `$${Math.abs(d)} ${d < 0 ? "below" : "above"} ${what}`;
    return `${rough || est ? "~" : ""}${t}${est ? " (est.)" : ""}`;
  };
  R.SOLD_CHIP = / (below|above) typical$|about typical$/; // the cards' price chip, to leave out where it would repeat

  // The price against the sold median, in a word.
  R.priceWord = (vs) =>
    vs <= 0.6 ? { v: "great", word: "Great price", rank: 4 }
    : vs <= 0.8 ? { v: "good", word: "Good price", rank: 3 }
    : vs <= 1.05 ? { v: "fair", word: "Fair price", rank: 2 }
    : { v: "pass", word: "Above typical", rank: 0 };

  // A likely scam without asking a model: a reposted listing, a code on the end of the title (until a
  // scan says it's the real model number), or a disguised way to get in touch off the site.
  R.likelyScam = (f) => !!(f && (f.campaign || (f.titleCode && !f.codeOk) || f.offSite?.sure));
  // At or under your price for this search, and not a likely scam.
  R.isDeal = (f, dealPrice) => dealPrice > 0 && f.total != null && f.total <= dealPrice && !R.likelyScam(f);

  // sellerJoined: the year the seller's account was made, where the site says (Marketplace: "Joined
  // Facebook in 2026"). An account made this year is how most Marketplace scams start.
  R.sellerWarning = (f, { minSellerRatings, minSellerPct }, now = Date.now()) => {
    if (f.sellerCount != null && f.sellerCount < minSellerRatings) return f.sellerCount === 0 ? "New seller" : `Seller: ${f.sellerCount} ratings`;
    if (f.sellerPct != null && f.sellerPct < minSellerPct) return `Seller ${f.sellerPct}% positive`;
    if (f.sellerJoined >= new Date(now).getFullYear()) return `Account made in ${f.sellerJoined}`;
    return "";
  };

  // A price far under what the same thing sells for is the other half of most scams: the bait. Only with
  // a sold reference worth trusting (not "rough"), and never for what that reference doesn't describe:
  // auctions (a bid isn't a price), lots, and broken ones (the reference is for working ones).
  // Returns { level: "far" | "low", pct } or null. Cutoffs in one place so they can be tuned.
  R.TOO_CHEAP = { far: 0.4, low: 0.55 };
  R.tooCheap = (f, market) => {
    if (!(market?.median > 0) || market.confidence === "rough" || f?.total == null || f.total <= 0) return null;
    if (f.auction || f.lot || f.project) return null;
    const pct = f.total / market.median;
    const level = pct < R.TOO_CHEAP.far ? "far" : pct < R.TOO_CHEAP.low ? "low" : "";
    return level ? { level, pct: Math.round(pct * 100) } : null;
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
  R.offerPlan = ({ price, shipping = 0, auction, lot, project, soft = "none" } = {}, market) => {
    if (!(market?.median > 0) || !(market.p25 > 0) || price == null || !(price > 0) || auction || lot || project) return null;
    const ship = Number(shipping) || 0;
    const total = price + ship;
    const reasons = [`sold ones go for $${market.p25}–$${market.p75} (${market.n} sales)`];
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
