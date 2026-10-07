// Second Look — site adapters.
// Each adapter turns a results page into a list of listings in one shared shape:
//   { id, site, title, priceText, price, shipping, total, url, imageUrl, raw, el }
// shipping is a number when the card says (0 = free), null when it doesn't; total = price + shipping.
// Selectors are deliberately layered (newest layout first, then older ones,
// then a generic fallback) because both sites change their markup without notice.
// If a site stops working, this is the file to fix. See README "When it breaks".

(() => {
  const SL = (window.SecondLook = window.SecondLook || {});

  // ---------- shared helpers ----------

  SL.parsePrice = (text) => {
    if (!text) return null;
    // First money-looking number: "$1,249.99", "$45 to $60", "US $20.00"
    const m = text.replace(/\u00a0/g, " ").match(/\$\s?([\d,]+(?:\.\d{1,2})?)/);
    if (!m) return null;
    const n = parseFloat(m[1].replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  };

  const firstText = (root, selectors) => {
    for (const sel of selectors) {
      const node = root.querySelector(sel);
      const t = node?.textContent?.trim();
      if (t) return t;
    }
    return "";
  };

  // Lazy-loaded cards often carry a 1x1 placeholder in src and the real photo in a data- attribute.
  const isPlaceholder = (u) => /^data:|\.gif(\?|$)/i.test(u);
  const firstImage = (root) => {
    const img = root.querySelector("img");
    if (!img) return "";
    const urls = [img.getAttribute("src"), img.getAttribute("data-src"), img.getAttribute("data-defer-load")].filter(Boolean);
    return urls.find((u) => !isPlaceholder(u)) || urls[0] || "";
  };

  // One stable key per listing, used to remember what's been scored across re-scans and scrolling.
  SL.keyOf = (url) => {
    const ebay = url.match(/\/itm\/(?:[^/?]+\/)?(\d{9,})/);
    if (ebay) return `ebay:${ebay[1]}`;
    const fb = url.match(/\/marketplace\/item\/(\d+)/);
    if (fb) return `fb:${fb[1]}`;
    return url.split("?")[0];
  };

  // eBay thumbnails on result cards are small (s-l140 to s-l500); a photo check needs the big one.
  SL.bigImage = (u) => (/ebayimg\.com/.test(u || "") ? u.replace(/s-l\d+\./, "s-l1600.") : u || "");

  // "+$12.35 delivery", "+$5 shipping estimate", "Free delivery", "Free International Shipping"
  SL.parseShipping = (text) => {
    if (!text) return null;
    const t = text.replace(/\u00a0/g, " ");
    const paid = t.match(/\+\s?\$\s?([\d,]+(?:\.\d{1,2})?)\s*(?:delivery|shipping|postage)/i);
    if (paid) return parseFloat(paid[1].replace(/,/g, ""));
    if (/free\s+(?:\w+\s+){0,2}(?:delivery|shipping)/i.test(t)) return 0;
    return null;
  };
  const withTotal = (it) => ({ ...it, total: it.price == null ? null : Math.round((it.price + (it.shipping || 0)) * 100) / 100 });

  // ---------- facts read straight off a card (no AI) ----------
  // Auctions: the price is only the current bid. "3 bids · 2d 4h left", "Time left 4h 12m".
  const hoursLeft = (t) => {
    let h = 0;
    for (const [, n, u] of t.matchAll(/(\d+)\s*([dhms])/gi)) h += +n * { d: 24, h: 1, m: 1 / 60, s: 1 / 3600 }[u.toLowerCase()];
    return Math.round(h * 10) / 10;
  };
  // "1.2K" -> 1200
  const count = (n, k) => Math.round(parseFloat(n.replace(/,/g, "")) * (k ? { K: 1e3, M: 1e6 }[k.toUpperCase()] : 1));

  // Lots and bundles, only when the title says so outright: "lot of 6", "bundle of 12", "10 pc lot".
  SL.lotSize = (title) => {
    const m =
      title.match(/\b(?:lot|bundle|set|bulk lot)\s+of\s+(\d{1,3})\b/i) ||
      title.match(/\b(\d{1,3})\s*-?\s*(?:pc|pcs|piece|pieces|game|games|item|items|cart|carts|disc|discs)\s+(?:lot|bundle)\b/i) ||
      title.match(/\b(\d{1,3})\s*-?\s*lot\b/i) ||
      title.match(/\blot\s*\((\d{1,3})\)/i);
    const n = m ? +m[1] : 0;
    return n >= 2 && n <= 200 ? n : 0;
  };

  // Every text piece with a space between, so neighbours like "3 bids" + "Ends in 2d" don't run
  // together ("3 bidsEnds in 2d") the way textContent joins them.
  SL.spacedText = (el) => {
    if (!el) return "";
    const out = [];
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) out.push(n.nodeValue);
    return out.join(" ").replace(/\s+/g, " ");
  };

  SL.cardFacts = (text, title = "") => {
    const t = (text || "").replace(/\u00a0/g, " ");
    const f = {};
    const bids = t.match(/\b(\d+)\s+bids?\b/i);
    const left = t.match(/\b(\d+[dhms](?:\s*\d+[hms]){0,2})\s+left\b/i) || t.match(/time left[:\s]+(\d+[dhms](?:\s*\d+[hms]){0,2})/i);
    if (bids || (left && /bid/i.test(t))) {
      f.auction = true;
      f.bids = bids ? +bids[1] : 0;
      if (left) {
        f.timeLeft = left[1].replace(/\s+/g, " ");
        f.hoursLeft = hoursLeft(left[1]);
      }
    }
    if (/\bor best offer\b|\bobo\b|\bor best\b|make (?:me )?an offer|open to offers/i.test(t + " " + title) && !/best offer accepted/i.test(t)) f.bestOffer = true;
    const lot = SL.lotSize(title);
    if (lot) f.lot = lot;
    // Seller rating: "99.5% positive (1.2K)" (2025 cards), "name (1,234) 99.5%" (older), or the listing page's seller card.
    const a = t.match(/(\d{2,3}(?:\.\d+)?)%\s*positive(?:\s*feedback)?\s*\(([\d,.]+)\s*([KM])?\)/i);
    const b = t.match(/\(([\d,.]+)\s*([KM])?\)\s*(\d{2,3}(?:\.\d+)?)%/);
    const pct = t.match(/(\d{2,3}(?:\.\d+)?)%\s*positive/i);
    if (a) Object.assign(f, { sellerPct: +a[1], sellerCount: count(a[2], a[3]) });
    else if (b) Object.assign(f, { sellerPct: +b[3], sellerCount: count(b[1], b[2]) });
    else if (pct) f.sellerPct = +pct[1];
    const ratings = !a && !b && t.match(/\(([\d,.]+)\s*([KM])?\)\s*(?:feedback|ratings?)/i);
    if (ratings) f.sellerCount = count(ratings[1], ratings[2]);
    return f;
  };

  const squash = (s, max = 300) => (s || "").replace(/\s+/g, " ").trim().slice(0, max);

  // ---------- eBay ----------
  // 2025+ layout: li.s-card. Older layout: li.s-item. Both still appear in guides.

  // strict: stop at eBay's "Results matching fewer words" divider (used for the sold-price median,
  // where those looser matches would skew the numbers).
  SL.extractEbay = (root = document, { strict = false } = {}) => {
    const cards = root.querySelectorAll("li.s-card, li.s-item, li.srp-river-answer");
    const out = [];
    const seen = new Set();
    for (const card of cards) {
      if (card.classList.contains("srp-river-answer")) {
        if (strict && /fewer words/i.test(card.textContent)) break;
        continue;
      }
      const link = card.querySelector('a[href*="/itm/"]');
      if (!link) continue;
      const url = link.href || link.getAttribute("href");
      const key = SL.keyOf(url);
      if (seen.has(key)) continue;
      seen.add(key);

      let title = firstText(card, [".s-card__title", ".s-item__title", '[role="heading"]', "h3"]) || link.textContent;
      title = squash(title.replace(/^New Listing/i, "").replace(/Opens in a new window or tab$/i, ""), 160);
      if (!title || /^shop on ebay$/i.test(title)) continue;

      const priceText = squash(firstText(card, [".s-card__price", ".s-item__price"]) || (card.textContent.match(/\$\s?[\d,]+(?:\.\d{2})?/) || [""])[0], 60);

      const text = card.innerText || card.textContent;
      out.push(
        withTotal({
          site: "ebay",
          title,
          priceText,
          price: SL.parsePrice(priceText),
          shipping: SL.parseShipping(text),
          url,
          imageUrl: firstImage(card),
          raw: squash(text),
          el: card,
          ...SL.cardFacts(SL.spacedText(card), title),
        })
      );
    }
    return out;
  };

  SL.ebayQuery = () => new URLSearchParams(location.search).get("_nkw") || "";

  // ---------- Facebook Marketplace ----------
  // FB class names are generated and change constantly, so this adapter avoids
  // them entirely. Every listing card is a link to /marketplace/item/<id>; we read
  // the visible text lines inside that link instead.

  SL.extractFacebook = (root = document) => {
    const links = root.querySelectorAll('a[href*="/marketplace/item/"]');
    const out = [];
    const seen = new Set();
    links.forEach((a) => {
      const href = a.getAttribute("href") || "";
      const itemId = (href.match(/\/marketplace\/item\/(\d+)/) || [])[1];
      if (!itemId || seen.has(itemId)) return;
      seen.add(itemId);

      const lines = (a.innerText || "").split("\n").map((l) => l.trim()).filter(Boolean);
      if (!lines.length) return;
      const priceLine = lines.find((l) => /\$\s?[\d,]|^free$/i.test(l)) || "";
      const rest = lines.filter((l) => l !== priceLine && !/^\$\s?[\d,]/.test(l));
      const title = squash(rest[0] || "", 160);
      if (!title) return;

      out.push(
        withTotal({
          site: "facebook",
          title,
          priceText: priceLine,
          price: /^free$/i.test(priceLine) ? 0 : SL.parsePrice(priceLine),
          shipping: SL.parseShipping(lines.join(" ")), // usually null: most Marketplace sales are local pickup
          url: new URL(href, location.origin).href.split("?")[0],
          imageUrl: firstImage(a),
          raw: squash(lines.join(" | ")),
          el: a,
          ...SL.cardFacts(SL.spacedText(a), title),
        })
      );
    });
    return out;
  };

  SL.facebookQuery = () => new URLSearchParams(location.search).get("query") || "";

  // ---------- single listing pages ----------
  // Layered the same way: site-specific selectors first, then generic page metadata
  // (og: tags) and the visible text of the main area as a fallback.

  const meta = (prop) =>
    document.querySelector(`meta[property="${prop}"], meta[name="${prop}"]`)?.getAttribute("content")?.trim() || "";

  const uniq = (arr) => [...new Set(arr.filter(Boolean))];

  SL.extractItem = () => {
    const site = SL.currentSite();
    if (site === "ebay") {
      const title = squash(firstText(document, ["h1.x-item-title__mainTitle", '[data-testid="x-item-title"]', "h1"]) || meta("og:title"), 200);
      const priceText = squash(firstText(document, [".x-price-primary", '[data-testid="x-price-primary"]']), 60);
      const imgs = [...document.querySelectorAll('.ux-image-carousel img, [data-testid="ux-image-carousel"] img')].map(
        (i) => i.getAttribute("src") || i.getAttribute("data-src") || ""
      );
      const shippingText = squash(firstText(document, [".ux-labels-values--shipping", '[data-testid="x-shipping"]']), 300);
      const sellerEl = document.querySelector('.x-sellercard-atf, [data-testid="x-sellercard-atf"]');
      const seller = squash(SL.spacedText(sellerEl), 300);
      // Bids, time left and "or Best Offer" live in the buy box; fall back to the top of the page.
      const boxEl = document.querySelector('.x-buybox, [data-testid="x-buybox"], .x-price-section');
      const buyBox = boxEl ? SL.spacedText(boxEl) : SL.spacedText(document.querySelector("main, #mainContent") || document.body).slice(0, 4000);
      return withTotal({
        ...SL.cardFacts(`${buyBox} ${seller}`, title),
        site,
        title,
        priceText,
        price: SL.parsePrice(priceText),
        shipping: SL.parseShipping(shippingText),
        condition: squash(firstText(document, [".x-item-condition-text", '[data-testid="x-item-condition"]']), 120),
        seller,
        shippingText,
        details: squash(firstText(document, [".x-about-this-item", '[data-testid="x-about-this-item"]']) || meta("og:description"), 1200),
        imageUrls: uniq([...imgs, meta("og:image")]).filter((u) => /^(https?:|data:image)/.test(u)).map(SL.bigImage).slice(0, 4),
        url: location.href.split("?")[0],
      });
    }
    // Facebook Marketplace: class names are useless, so lean on metadata + visible text.
    const main = document.querySelector('[role="main"]') || document.body;
    const priceNode = [...main.querySelectorAll("span")].find((n) => /^(\$\s?[\d,]+(\.\d\d)?|free)$/i.test(n.textContent.trim()));
    const priceText = priceNode ? priceNode.textContent.trim() : "";
    const imgs = [...main.querySelectorAll("img")]
      .filter((i) => /scontent|fbcdn/.test(i.src) && (i.naturalWidth || i.width) >= 200)
      .map((i) => i.src);
    return withTotal({
      site: "facebook",
      title: squash(firstText(main, ["h1"]) || meta("og:title"), 200),
      priceText,
      price: /^free$/i.test(priceText) ? 0 : SL.parsePrice(priceText),
      shipping: null,
      condition: "",
      seller: "",
      shippingText: "",
      details: squash(meta("og:description") || main.innerText, 2500),
      imageUrls: uniq([meta("og:image"), ...imgs]).slice(0, 4),
      url: location.href.split("?")[0],
    });
  };

  // A short search phrase for the sold-price comparison, taken from a listing title. Condition and
  // fault words ("for parts", "untested", "blinking red light") would skew the sold search, so they go.
  const NOISE =
    /\b(for parts( or repair| only)?|not working|non[- ]?working|untested|tested|works?|working|broken|as[- ]is|read( description)?|please read|parts|repair|faulty|damaged|no power|powers on|blinking( red)?( light)?|red light|cracked|(great|good|nice) condition|great|good|nice|clean|excellent|mint|rare|vintage|lot|bundle|free shipping|fast shipping|l@@k|wow)\b/gi;
  SL.titleToQuery = (title) =>
    (title || "")
      .replace(NOISE, " ")
      .replace(/[^\p{L}\p{N}\s.-]/gu, " ")
      .split(/\s+/)
      .map((w) => w.replace(/^[-.]+|[-.]+$/g, "")) // keep "PSP-3001", drop a lone "-" (eBay reads it as "exclude")
      .filter((w) => w && !/^w$/i.test(w))
      .slice(0, 6)
      .join(" ");

  // ---------- pick the adapter for this page ----------

  SL.currentSite = () => {
    if (location.hostname === "www.ebay.com" && (location.pathname === "/" || /^\/(sch|itm)\//.test(location.pathname))) return "ebay";
    if (location.hostname === "www.facebook.com" && location.pathname.startsWith("/marketplace")) return "facebook";
    return null;
  };

  // "results" = a search results page, "item" = one listing, null = not ours.
  SL.pageType = () => {
    const site = SL.currentSite();
    if (site === "ebay") return location.pathname === "/" ? "home" : location.pathname.startsWith("/itm/") ? "item" : "results";
    if (site === "facebook") return location.pathname.startsWith("/marketplace/item/") ? "item" : "results";
    return null;
  };

  SL.extract = () => {
    const site = SL.currentSite();
    const items = site === "ebay" ? SL.extractEbay() : site === "facebook" ? SL.extractFacebook() : [];
    return items.map((it, i) => ({ ...it, id: i + 1 }));
  };

  SL.detectQuery = () => {
    const site = SL.currentSite();
    if (SL.pageType() === "item") return SL.titleToQuery(SL.extractItem().title);
    return site === "ebay" ? SL.ebayQuery() : site === "facebook" ? SL.facebookQuery() : "";
  };

  // The address for a suggested search. Both sites take the search words in the URL, which is
  // sturdier than typing into the page's own search box. Price cap and sort are best-effort.
  SL.searchUrl = ({ query, maxPrice, newest }) => {
    const site = SL.currentSite();
    if (site === "ebay") {
      const u = new URL("https://www.ebay.com/sch/i.html");
      u.searchParams.set("_nkw", query);
      if (maxPrice > 0) u.searchParams.set("_udhi", String(maxPrice));
      if (newest) u.searchParams.set("_sop", "10");
      return u.href;
    }
    // Facebook search has no operators: drop minus terms, quotes and brackets so they aren't searched literally.
    query = query.replace(/(^|\s)-\S+/g, " ").replace(/["()]/g, "").replace(/\s+/g, " ").trim();
    const u = new URL(location.href); // keeps the city/location part of the Marketplace address
    u.search = "";
    if (!/\/search\/?$/.test(u.pathname)) u.pathname = "/marketplace/search";
    u.searchParams.set("query", query);
    if (maxPrice > 0) u.searchParams.set("maxPrice", String(maxPrice));
    if (newest) u.searchParams.set("sortBy", "creation_time_descend");
    return u.href;
  };

  // ---------- market reference from eBay sold listings ----------

  const quantile = (sorted, q) => {
    const pos = (sorted.length - 1) * q;
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  };

  // eBay's condition filter: 3000 = used, 7000 = for parts or not working. "" = any condition.
  SL.SOLD_CONDITION = { used: "3000", parts: "7000", any: "" };
  SL.soldUrl = (query, condition = "") => {
    const u = new URL("https://www.ebay.com/sch/i.html");
    u.searchParams.set("_nkw", query);
    u.searchParams.set("LH_Sold", "1");
    u.searchParams.set("LH_Complete", "1");
    u.searchParams.set("_ipg", "60");
    if (condition) u.searchParams.set("LH_ItemCondition", condition);
    return u.href;
  };

  // Median of what buyers paid (price + shipping when the card shows it), plus the few sales
  // closest to the median so you can see what the number is made of.
  SL.summarizeSold = (html) => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const sales = SL.extractEbay(doc, { strict: true }).filter((it) => it.total != null && it.total > 0);
    if (sales.length < 5) return null; // too few sales to trust
    const totals = sales.map((it) => it.total).sort((a, b) => a - b);
    const r = (n) => Math.round(n);
    const median = quantile(totals, 0.5);
    const samples = [...sales]
      .sort((a, b) => Math.abs(a.total - median) - Math.abs(b.total - median))
      .slice(0, 5)
      .sort((a, b) => a.total - b.total)
      .map((it) => ({ title: it.title, total: it.total, url: it.url }));
    return { n: totals.length, median: r(median), p25: r(quantile(totals, 0.25)), p75: r(quantile(totals, 0.75)), currency: "$", samples };
  };
})();
