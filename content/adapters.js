// Tirekick — site adapters.
// Each adapter turns a results page into a list of listings in one shared shape:
//   { id, site, title, priceText, price, shipping, total, url, imageUrl, raw, el }
// shipping is a number when the card says (0 = free), null when it doesn't; total = price + shipping.
// Selectors are deliberately layered (newest layout first, then older ones,
// then a generic fallback) because both sites change their markup without notice.
// If a site stops working, this is the file to fix. See README "When it breaks".

(() => {
  const TK = (window.Tirekick = window.Tirekick || {});
  const Sites = window.TKSites; // lib/sites.js: names, addresses, keys and page types per site

  // ---------- shared helpers ----------

  TK.parsePrice = (text) => {
    if (!text) return null;
    // First money-looking number: "$1,249.99", "$45 to $60", "US $20.00"
    const m = text.replace(/\u00a0/g, " ").match(/\$\s?([\d,]+(?:\.\d{1,2})?)/);
    if (!m) return null;
    const n = parseFloat(m[1].replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  };

  // eBay.com shows some sellers' prices in their own currency ("C $20.00", "AU $35.00", "£15.00"). Reading
  // those as US dollars would be wrong by a third or more, so such a price is treated as unknown, unless
  // the same text also gives eBay's US-dollar conversion ("Approximately US $14.60").
  TK.foreignCurrency = (text) => /(?:^|[^A-Za-z])(?:C|CA|AU|A|NZ|HK|S|SG)\s?\$|[£€¥]|\b(?:GBP|EUR|CAD|AUD|JPY)\b/.test((text || "").replace(/\u00a0/g, " "));
  TK.usdPrice = (priceText, context = "") => {
    if (!TK.foreignCurrency(priceText)) return TK.parsePrice(priceText);
    const us = (context || "").replace(/\u00a0/g, " ").match(/US\s?\$\s?([\d,]+(?:\.\d{1,2})?)/);
    return us ? parseFloat(us[1].replace(/,/g, "")) : null;
  };
  // "$45.00 to $60.00": a listing with several versions at different prices.
  TK.isPriceRange = (text) => /\$\s?[\d,.]+\s*(?:to|-|–)\s*(?:US\s?)?\$/.test(text || "");

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
  TK.isPlaceholder = isPlaceholder;
  const firstImage = (root) => {
    const img = root.querySelector("img");
    if (!img) return "";
    const urls = [img.getAttribute("src"), img.getAttribute("data-src"), img.getAttribute("data-defer-load")].filter(Boolean);
    return urls.find((u) => !isPlaceholder(u)) || urls[0] || "";
  };

  // One stable key per listing, used to remember what's been scored across re-scans and scrolling.
  TK.keyOf = (url) => Sites.keyOf(url);

  // eBay thumbnails on result cards are small (s-l140 to s-l500); a photo check needs the big one.
  TK.bigImage = (u) => (/ebayimg\.com/.test(u || "") ? u.replace(/s-l\d+\./, "s-l1600.") : u || "");

  // "+$12.35 delivery", "+$5 shipping estimate", "Free delivery", "Free International Shipping"
  // loose: for a listing page's own shipping line, where the amount comes without a "+" ("US $8.50 Standard
  // Shipping"). Not for cards, where a price sits right next to the words.
  TK.parseShipping = (text, loose = false) => {
    if (!text) return null;
    const t = text.replace(/\u00a0/g, " ");
    const paid = t.match(/\+\s?\$\s?([\d,]+(?:\.\d{1,2})?)\s*(?:delivery|shipping|postage)/i);
    if (paid) return parseFloat(paid[1].replace(/,/g, ""));
    if (/free\s+(?:[\w-]+\s+){0,2}(?:delivery|shipping)/i.test(t)) return 0; // "Free 2-4 day delivery"
    const bare = loose && t.match(/\$\s?([\d,]+(?:\.\d{1,2})?)\s*(?:[A-Za-z]+\s+){0,2}(?:delivery|shipping|postage)/i);
    return bare ? parseFloat(bare[1].replace(/,/g, "")) : null;
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
  TK.lotSize = (title) => {
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
  TK.spacedText = (el) => {
    if (!el) return "";
    const out = [];
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) out.push(n.nodeValue);
    return out.join(" ").replace(/\s+/g, " ");
  };

  TK.cardFacts = (text, title = "") => {
    const t = (text || "").replace(/\u00a0/g, " ");
    const f = {};
    const bids = t.match(/\b(\d+)\s+bids?\b/i);
    const left = t.match(/\b(\d+[dhms](?:\s*\d+[hms]){0,2})\s+left\b/i) || t.match(/time left[:\s]+(\d+[dhms](?:\s*\d+[hms]){0,2})/i) || t.match(/\bends?\s+in\s+(\d+[dhms](?:\s*\d+[hms]){0,2})/i); // cards say "6d left", listing pages "Ends in 6d 20h"
    if (bids || (left && /bid/i.test(t))) {
      f.auction = true;
      f.bids = bids ? +bids[1] : 0;
      if (left) {
        f.timeLeft = left[1].replace(/\s+/g, " ");
        f.hoursLeft = hoursLeft(left[1]);
      }
    }
    if (/\bor best offer\b|\bobo\b|\bor best\b|make (?:me )?an offer|open to offers/i.test(t + " " + title) && !/best offer accepted/i.test(t)) f.bestOffer = true;
    const lot = TK.lotSize(title);
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

  // The year a seller's account was made, where the listing says ("Joined Facebook in 2019"); null otherwise.
  TK.joinedYear = (text) => {
    const y = Number(String(text || "").match(/\bjoined (?:facebook )?in (\d{4})\b/i)?.[1]);
    return y >= 2004 && y <= new Date().getFullYear() ? y : null;
  };
  // How many days ago a listing went up, from "Listed 3 weeks ago" (Marketplace) or "Listed on Oct 3, 2026"
  // (eBay); approximate for the relative kind. null when the page doesn't say.
  const AGO = { minute: 1 / 1440, hour: 1 / 24, day: 1, week: 7, month: 30, year: 365 };
  TK.listedDaysAgo = (text, now = Date.now()) => {
    const t = String(text || "");
    const rel = t.match(/\blisted (?:about |over )?(a|an|a few|\d+) (minute|hour|day|week|month|year)s? ago\b/i);
    if (rel) {
      const n = /^an?$/i.test(rel[1]) ? 1 : /few/i.test(rel[1]) ? 3 : Number(rel[1]);
      return Math.round(n * AGO[rel[2].toLowerCase()] * 10) / 10;
    }
    const on = t.match(/\blisted on:? ([a-z]{3,9} \d{1,2}, \d{4})\b/i);
    const at = on ? Date.parse(on[1]) : NaN;
    return Number.isFinite(at) && at <= now ? Math.floor((now - at) / 864e5) : null;
  };

  // ---------- scam patterns (Facebook) ----------
  // Bulk-posted fake listings end their titles with a short random code ("Game Boy Advance SP M2465",
  // "Halo Special Edition Xbox S1337", "... U2X503") so no two look identical. A real model number
  // can look the same ("Pentax K1000"), so on its own a code is a hint for the model; the same title
  // posted again with a different code is certain (see the page pass in panel.js).
  const NOT_CODE =
    /^(?:\d+(?:GB|TB|MB|MHZ|GHZ|HZ|MM|CM|IN|W|V|MAH|P|K|X|PCS?|FT|LBS?|OZ)|XBOX\d+|PS\d\w*|[23]DS\w*|N64\w*|NDS\w*|GBA\w*|SNES\w*|DSI\w*|RTX\d+|GTX\d+|RX\d+|GEN\d+|MK\d+|USB\w*|HDMI\w*|4K\w*|1080P?|720P?)$/;
  TK.titleCode = (title) => {
    const words = (title || "").trim().split(/\s+/);
    if (words.length < 3) return "";
    const last = words.at(-1).replace(/^[#([]+|[)\].,!]+$/g, "");
    if (!/^[A-Z0-9]{4,8}$/.test(last) || !/[A-Z]/.test(last) || !/\d/.test(last) || NOT_CODE.test(last)) return "";
    return last;
  };
  // The title without its code, for spotting the same listing posted again under another code.
  TK.titleStem = (title, code) => (code ? title.trim().slice(0, -code.length) : title).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  // Moving the sale off the site is how these scams get paid. Returns { sure, why[] }: sure when
  // the contact is disguised to slip past Facebook's filters ("www . jmyzl . com", "remove the
  // spaces", "505_507__6507", "text me a screenshot"); a plain phone number or website is only a hint.
  // Addresses written to slip past a filter. Ordinary sentences must not match: "Works perfectly. Me and
  // my wife…" has the same shape as "name. me", so a gap after the dot alone only counts for endings no
  // sentence starts with, in lower case, and "polka dot top" needs a real ending too.
  const TLD = "(?:com|net|org|shop|store|top|xyz|site|online|club|vip|cc|co|us|io|me)";
  const REAL = "(?:com|net|org|shop|xyz|vip|cc|io)";
  const LABEL = "[a-z0-9-]{3,}";
  const WWW = String.raw`(?:w\s*w\s*w\s*(?:\.|\(dot\)|\[dot\]|\bdot\b)\s*)?`;
  const SPACED = [
    new RegExp(String.raw`\b${WWW}${LABEL}\s*(?:\(dot\)|\[dot\])\s*${TLD}\b`, "i"), // name [dot] shop
    new RegExp(String.raw`\b${WWW}${LABEL}\s+\.\s*${REAL}\b`, "i"), // www . name . com
    new RegExp(String.raw`\b${WWW}${LABEL}\s+dot\s+${REAL}\b`, "i"), // name dot com
    new RegExp(String.raw`\b[a-zA-Z0-9-]{3,}\.\s+${REAL}\b`), // name. com (lower case ending)
  ];
  const PLAIN_SITE = new RegExp(String.raw`\b(?:www\.)?${LABEL}\.${TLD}\b`, "i");
  TK.offSite = (text) => {
    const t = (text || "").replace(/\u00a0/g, " ");
    const why = [];
    let sure = false;
    let site = null;
    for (const re of SPACED) if ((site = t.match(re))) break;
    const hidden = !!site;
    site ||= t.match(PLAIN_SITE);
    if (site) {
      if (hidden) sure = true;
      if (!/facebook|ebay/i.test(site[0])) why.push(`${hidden ? "disguised " : ""}web address “${site[0].trim()}”`);
    }
    if (/remove (?:the |all )?(?:spaces|dots|symbols|underscores)|without (?:the )?spaces|no spaces/i.test(t)) {
      sure = true;
      why.push("says to remove the spaces");
    }
    const phone = t.match(/(?<![\d$])\(?(\d{3})\)?([\s_.*\/-]{0,3})(\d{3})([\s_.*\/-]{0,3})(\d{4})(?!\d)/);
    // Ten digits with nothing between them is more likely a serial or part number than a phone.
    if (phone && (phone[2] + phone[4] || /^\(/.test(phone[0]))) {
      const seps = phone[2] + phone[4];
      const odd = /[_*\/]/.test(seps) || phone[2].length > 1 || phone[4].length > 1;
      if (odd) sure = true;
      why.push(odd ? `disguised phone number “${phone[0].trim()}”` : "phone number in the listing");
    }
    const apps = t.match(/\b(whats\s?app|telegram|signal app|wechat|kik|cash\s?app|zelle|venmo|gift ?cards?|e-?mail me|text me|screenshot)\b/gi);
    if (apps) {
      const list = [...new Set(apps.map((a) => a.toLowerCase().replace(/\s+/g, " ")))];
      why.push(`mentions ${list.join(", ")}`);
      // "call or text" alone is ordinary, and so is "screenshot of the battery health" or "comes with a $20 gift
      // card": those only count when they ask you to send one, or ask to be paid with one.
      const asksScreenshot = /(?:text|send|dm|message|e-?mail)[^.\n]{0,40}screenshot|screenshot[^.\n]{0,30}(?:to me|to this|back to)/i.test(t);
      const giftPay = /(?:pay|payment|accept|take|only)[^.\n]{0,30}gift ?cards?|gift ?cards? (?:only|as payment|payment)/i.test(t);
      if (list.some((a) => /whats|telegram/.test(a)) || asksScreenshot || giftPay) sure = true;
    }
    return why.length ? { sure, why } : null;
  };

  // ---------- eBay ----------
  // 2025+ layout: li.s-card. Older layout: li.s-item. Both still appear in guides. Category pages
  // (/b/...) use their own cards, li.brwrvr__item-card with bsig__ parts.

  // strict: stop at eBay's "Results matching fewer words" divider (used for the sold-price median,
  // where those looser matches would skew the numbers).
  TK.EBAY_CARDS = "li.s-card, li.s-item, li.brwrvr__item-card";
  TK.extractEbay = (root = document, { strict = false } = {}) => {
    const cards = root.querySelectorAll(`${TK.EBAY_CARDS}, li.srp-river-answer`);
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
      const key = TK.keyOf(url);
      if (seen.has(key)) continue;
      seen.add(key);

      let title = firstText(card, [".s-card__title", ".s-item__title", ".bsig__title__text", ".bsig__title", '[role="heading"]', "h3"]) || link.textContent;
      title = squash(title.replace(/^New Listing/i, "").replace(/Opens in a new window or tab$/i, ""), 160);
      if (!title || /^shop on ebay$/i.test(title)) continue;

      const priceText = squash(firstText(card, [".s-card__price", ".s-item__price", ".bsig__price"]) || (card.textContent.match(/\$\s?[\d,]+(?:\.\d{2})?/) || [""])[0], 60);

      const text = card.innerText || card.textContent;
      out.push(
        withTotal({
          site: "ebay",
          title,
          priceText,
          price: TK.usdPrice(priceText, text),
          shipping: TK.parseShipping(text),
          url,
          imageUrl: firstImage(card),
          raw: squash(text),
          el: card,
          ...TK.cardFacts(TK.spacedText(card), title),
          // Titles only on eBay: card text has too many numbers to trust a phone check there.
          ...(TK.offSite(title) && { offSite: TK.offSite(title) }),
        })
      );
    }
    return out;
  };

  TK.ebayQuery = () => Sites.get("ebay").queryOf(location);
  // The links to listings in a site's result cards, per site: what the panel counts as "on the page".
  TK.LISTING_LINKS = {
    ebay: TK.EBAY_CARDS.split(", ").map((c) => `${c} a[href*="/itm/"]`).join(", "),
    facebook: 'a[href*="/marketplace/item/"]',
  };
  TK.listingLinks = () => TK.LISTING_LINKS[TK.currentSite()] || TK.LISTING_LINKS.ebay;
  // Every listing linked from the results, whatever card it sits in, counted once: what a page reader that
  // kept up with the site would find. Looks in the results area when there is one (eBay's "recently viewed"
  // and other carousels sit outside it), else the whole page. Used only to notice when the cards change.
  TK.linkedListings = (root = document) => {
    const area = ["#srp-river-results", ".srp-results", '[role="main"]'].map((s) => root.querySelector(s)).find(Boolean) || root;
    const keys = new Set();
    for (const a of area.querySelectorAll('a[href*="/itm/"], a[href*="/marketplace/item/"]')) {
      const key = Sites.keyOf(a.getAttribute("href") || "");
      if (/^\w+:\d+$/.test(key)) keys.add(key);
    }
    return keys.size;
  };
  // A listing's card on the page, found again from its key (per site: a new site adds its own). The first
  // link to an item can sit outside the results (a carousel, "recently viewed"), so prefer one in a card.
  TK.CARD_FINDERS = {
    ebay: (key, id) => {
      const links = [...document.querySelectorAll(`a[href*="/itm/"][href*="${id}"]`)].filter((a) => TK.keyOf(a.href) === key);
      return links.map((a) => a.closest(TK.EBAY_CARDS)).find(Boolean) || null;
    },
    facebook: (key, id) => {
      const links = [...document.querySelectorAll(`a[href*="/marketplace/item/${id}"]`)];
      return links.find((a) => a.closest("[data-tirekick-key]")) || links.find((a) => a.getClientRects().length) || links[0] || null;
    },
  };
  TK.cardFor = (key) => TK.CARD_FINDERS[Sites.ofKey(key).id](key, key.split(":")[1]);

  // ---------- Facebook Marketplace ----------
  // FB class names are generated and change constantly, so this adapter avoids
  // them entirely. Every listing card is a link to /marketplace/item/<id>; we read
  // the visible text lines inside that link instead.

  const FB_LABELS = /^(just listed|sponsored|price dropped|partner listing|new listing|shipping available|ships to you|free shipping|pending|sold)$/i;
  // A card that hasn't changed since it was last read (same link, same text) isn't read again: the feed is
  // read whenever more listings load, and reading every card each time made long feeds stutter. The photo
  // is looked up every time (Facebook swaps a placeholder for the real one without changing the text).
  const fbRead = new WeakMap(); // link element -> { href, text, item }
  TK.extractFacebook = (root = document) => {
    const links = root.querySelectorAll('a[href*="/marketplace/item/"]');
    const out = [];
    const seen = new Set();
    links.forEach((a) => {
      const href = a.getAttribute("href") || "";
      const itemId = (href.match(/\/marketplace\/item\/(\d+)/) || [])[1];
      if (!itemId || seen.has(itemId)) return;
      seen.add(itemId);
      const text = a.textContent;
      const hit = fbRead.get(a);
      if (hit && hit.href === href && hit.text === text) {
        out.push({ ...hit.item, imageUrl: firstImage(a), el: a });
        return;
      }

      // innerText gives one line per text block, but only for cards being shown; a card we've hidden
      // (filtered, not interested) falls back to its text pieces, which split the same way here.
      let lines = (a.innerText || "").split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length < 2 && !a.getClientRects().length) {
        const walk = document.createTreeWalker(a, NodeFilter.SHOW_TEXT);
        lines = [];
        for (let n = walk.nextNode(); n; n = walk.nextNode()) if (n.nodeValue.trim() && !n.parentElement.closest(".tirekick-sticker, .tirekick-marks")) lines.push(n.nodeValue.trim());
      }
      if (!lines.length) return;
      const priceLine = lines.find((l) => /\$\s?[\d,]|^free$/i.test(l)) || "";
      // Facebook's own labels on the photo are lines too; they're never the title.
      const rest = lines.filter((l) => l !== priceLine && !/^\$\s?[\d,]/.test(l) && !FB_LABELS.test(l));
      const title = squash(rest[0] || "", 160);
      if (!title) return;
      // A marked-down listing shows the new price first and the old one struck through after it ("$165" "$180").
      const now = TK.parsePrice(priceLine);
      const was = lines.slice(lines.indexOf(priceLine) + 1).map((l) => (/^\$\s?[\d,]/.test(l) ? TK.parsePrice(l) : null)).find((n) => n != null);

      const item = withTotal({
          site: "facebook",
          title,
          priceText: priceLine,
          price: /^free$/i.test(priceLine) ? 0 : TK.parsePrice(priceLine),
          shipping: TK.parseShipping(lines.join(" ")), // usually null: most Marketplace sales are local pickup
          url: new URL(href, location.origin).href.split("?")[0],
          imageUrl: firstImage(a),
          raw: squash(lines.join(" | ")),
          el: a,
          ...TK.cardFacts(TK.spacedText(a), title),
          titleCode: TK.titleCode(title),
          // The title only, as on eBay: a phone number or app in it is visible before the listing is opened.
          ...(TK.offSite(title) && { offSite: TK.offSite(title) }),
          ...(was != null && now != null && was > now && { wasPrice: was }),
          ...(lines.some((l) => /^just listed$/i.test(l)) && { justListed: true }),
        });
      fbRead.set(a, { href, text, item });
      out.push(item);
    });
    return out;
  };

  TK.facebookQuery = () => Sites.get("facebook").queryOf(location);

  // With no search, what is this page? Marketplace addresses look like /marketplace/ (home feed),
  // /marketplace/<city>/ or /marketplace/<city>/<category> (a category such as "videogames").
  const NOT_CATEGORY = /^(search|item|you|inbox|notifications|create|selling|buying|saved|category)$/i;
  // Per site (a new site adds its own); anything not listed is read as eBay's.
  TK.BROWSE_CONTEXT = {
    ebay: () => {
      const cat = location.pathname.match(/^\/b\/([^/]+)/);
      return cat ? `eBay category "${decodeURIComponent(cat[1]).replace(/-/g, " ")}" (no search)` : "eBay page with no search";
    },
    facebook: () => facebookContext(),
  };
  TK.browseContext = () => (TK.BROWSE_CONTEXT[TK.currentSite()] || TK.BROWSE_CONTEXT.ebay)();
  const facebookContext = () => {
    const parts = location.pathname.split("/").filter(Boolean).slice(1); // after "marketplace"
    const cat = parts.find((p, i) => i > 0 && !NOT_CATEGORY.test(p) && !/^\d+$/.test(p)) || "";
    const pretty = cat && cat.replace(/[-_]/g, " ").replace(/([a-z])(games|consoles|electronics)$/i, "$1 $2");
    return pretty ? `Facebook Marketplace category "${pretty}" (no search)` : "Facebook Marketplace home feed: mixed items for sale near the buyer (no search)";
  };

  // ---------- single listing pages ----------
  // Layered the same way: site-specific selectors first, then generic page metadata
  // (og: tags) and the visible text of the main area as a fallback.

  const meta = (prop) =>
    document.querySelector(`meta[property="${prop}"], meta[name="${prop}"]`)?.getAttribute("content")?.trim() || "";

  const uniq = (arr) => [...new Set(arr.filter(Boolean))];

  // One listing's page, read per site (a new site adds its own). Any page that isn't eBay's is read the
  // Marketplace way: visible text and metadata, no class names.
  TK.ITEM_READERS = {
    ebay: () => {
      const site = "ebay";
      const title = squash(firstText(document, ["h1.x-item-title__mainTitle", '[data-testid="x-item-title"]', "h1"]) || meta("og:title"), 200);
      const priceText = squash(firstText(document, [".x-price-primary", '[data-testid="x-price-primary"]']), 60);
      const imgs = [...document.querySelectorAll('.ux-image-carousel img, [data-testid="ux-image-carousel"] img')].map(
        (i) => i.getAttribute("src") || i.getAttribute("data-src") || ""
      );
      const shippingText = squash(firstText(document, [".ux-labels-values--shipping", '[data-testid="x-shipping"]']), 300);
      const sellerEl = document.querySelector('.x-sellercard-atf, [data-testid="x-sellercard-atf"]');
      const seller = squash(TK.spacedText(sellerEl), 300);
      // Bids, time left and "or Best Offer" live in the buy box; fall back to the top of the page.
      const boxEl = document.querySelector('.x-buybox, [data-testid="x-buybox"], .x-price-section');
      const buyBox = boxEl ? TK.spacedText(boxEl) : TK.spacedText(document.querySelector("main, #mainContent") || document.body).slice(0, 4000);
      return withTotal({
        ...TK.cardFacts(`${buyBox} ${seller}`, title),
        site,
        title,
        priceText,
        price: TK.usdPrice(priceText, firstText(document, [".x-price-approx", '[data-testid="x-price-approx"]'])),
        shipping: TK.parseShipping(shippingText, true),
        // the label sits in .ux-textspans (the text beside it repeats it for screen readers and adds a "More information" button)
        condition: squash(firstText(document, [".x-item-condition-text .ux-textspans", ".x-item-condition-text", '[data-testid="x-item-condition"]']), 120),
        seller,
        shippingText,
        details: squash(firstText(document, [".x-about-this-item", '[data-testid="x-about-this-item"]']) || meta("og:description"), 1200),
        imageUrls: uniq([...imgs, meta("og:image")]).filter((u) => /^(https?:|data:image)/.test(u)).map(TK.bigImage).slice(0, 4),
        url: location.href.split("?")[0],
        listedDays: TK.listedDaysAgo(TK.spacedText(document.querySelector("main, #mainContent") || document.body).slice(0, 20000)),
      });
    },
    facebook: () => {
      // Facebook Marketplace: class names are useless, so lean on visible text + metadata.
      // A listing opened from the feed is an overlay (a dialog) over the feed, with the feed still in
      // [role=main] and the page's og: tags still the feed's; opened directly, it's the main area.
      // Only a dialog you can see: Facebook keeps hidden ones (a "Notifications" flyout) in the page.
      const dialog = [...document.querySelectorAll('[role="dialog"]')].filter((d) => d.querySelector("h1") && d.getClientRects().length).at(-1);
      const main = dialog || document.querySelector('[role="main"]') || document.body;
      const priceNode = [...main.querySelectorAll("span")].find((n) => /^(\$\s?[\d,]+(\.\d\d)?|free)$/i.test(n.textContent.trim()));
      const priceText = priceNode ? priceNode.textContent.trim() : "";
      const imgs = [...main.querySelectorAll("img")]
        .filter((i) => /scontent|fbcdn/.test(i.src) && (i.naturalWidth || i.width) >= 200)
        .map((i) => i.src);
      const title = squash(firstText(main, ["h1"]) || (dialog ? "" : meta("og:title")), 200);
      const text = main.innerText || "";
      return withTotal({
        ...TK.cardFacts(text, title),
        site: "facebook",
        title,
        priceText,
        price: /^free$/i.test(priceText) ? 0 : TK.parsePrice(priceText),
        shipping: null,
        condition: "",
        seller: "",
        shippingText: "",
        details: squash(dialog ? text : meta("og:description") || text, 2500),
        imageUrls: uniq([dialog ? "" : meta("og:image"), ...imgs]).slice(0, 4),
        url: location.href.split("?")[0],
        titleCode: TK.titleCode(title),
        offSite: TK.offSite(text),
        sellerJoined: TK.joinedYear(text),
        listedDays: TK.listedDaysAgo(text),
      });
    },
  };
  TK.extractItem = () => (TK.ITEM_READERS[TK.currentSite()] || TK.ITEM_READERS.facebook)();

  // A short search phrase for the sold-price comparison, taken from a listing title. Condition and
  // fault words ("for parts", "untested", "blinking red light") would skew the sold search, so they go.
  const NOISE =
    /\b(for parts( or repair| only)?|not working|non[- ]?working|untested|tested|works?|working|broken|as[- ]is|read( description)?|please read|parts|repair|faulty|damaged|no power|powers on|blinking( red)?( light)?|red light|cracked|(great|good|nice) condition|great|good|nice|clean|excellent|mint|rare|vintage|lot|bundle|free shipping|fast shipping|l@@k|wow)\b/gi;
  // On Facebook a trailing code ("... U2X503") would only make the sold search come back empty.
  TK.titleToQuery = (title) =>
    (title || "")
      .slice(0, TK.site()?.titleCodes && TK.titleCode(title) ? -TK.titleCode(title).length : undefined)
      .replace(NOISE, " ")
      .replace(/[^\p{L}\p{N}\s.-]/gu, " ")
      .split(/\s+/)
      .map((w) => w.replace(/^[-.]+|[-.]+$/g, "")) // keep "PSP-3001", drop a lone "-" (eBay reads it as "exclude")
      .filter((w) => w && !/^w$/i.test(w))
      .slice(0, 6)
      .join(" ");

  // ---------- pick the adapter for this page ----------

  // Every eBay page and every Marketplace page get the tab; what the panel can do depends on the page.
  TK.currentSite = () => Sites.here(location)?.id ?? null;
  // This page's site entry (lib/sites.js), or null.
  TK.site = () => Sites.here(location);

  // "results" = search results or a category, "item" = one listing, "home" = eBay's front page,
  // "other" = any other eBay page (the panel still has Saved), null = not ours.
  TK.pageType = () => TK.site()?.pageType(location) ?? null;

  // Each site's card reader, by site id: a new site adds its own here.
  TK.READERS = { ebay: (root) => TK.extractEbay(root), facebook: (root) => TK.extractFacebook(root) };
  TK.extract = () => {
    const read = TK.READERS[TK.currentSite()];
    const items = read ? read() : [];
    return items.map((it, i) => ({ ...it, id: i + 1 }));
  };

  TK.detectQuery = () => {
    if (TK.pageType() === "item") return TK.titleToQuery(TK.extractItem().title);
    return TK.site()?.queryOf(location) ?? "";
  };

  // The address for a suggested search, per site (a new site adds its own). The search words go in the
  // URL, which is sturdier than typing into the page's own search box. Price cap and sort are best-effort.
  TK.SEARCH_BUILDERS = {
    ebay: ({ query, maxPrice, newest }) => {
      const u = new URL("https://www.ebay.com/sch/i.html");
      u.searchParams.set("_nkw", query);
      if (maxPrice > 0) u.searchParams.set("_udhi", String(maxPrice));
      if (newest) u.searchParams.set("_sop", "10");
      return u.href;
    },
    facebook: ({ query, maxPrice, newest }) => {
      // Facebook search has no operators: drop minus terms, quotes and brackets so they aren't searched literally.
      query = query.replace(/(^|\s)-\S+/g, " ").replace(/["()]/g, "").replace(/\s+/g, " ").trim();
      const u = new URL(location.href); // keeps the city/location part of the Marketplace address
      u.search = "";
      if (!/\/search\/?$/.test(u.pathname)) u.pathname = "/marketplace/search";
      u.searchParams.set("query", query);
      if (maxPrice > 0) u.searchParams.set("maxPrice", String(maxPrice));
      if (newest) u.searchParams.set("sortBy", "creation_time_descend");
      return u.href;
    },
  };
  TK.searchUrl = (opts) => (TK.SEARCH_BUILDERS[TK.currentSite()] || TK.SEARCH_BUILDERS.facebook)(opts);

  // ---------- market reference from eBay sold listings ----------

  const quantile = (sorted, q) => {
    const pos = (sorted.length - 1) * q;
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  };

  // eBay's condition filter: 3000 = used, 7000 = for parts or not working. "" = any condition.
  TK.SOLD_CONDITION = { used: "3000", parts: "7000", any: "" };
  TK.soldUrl = (query, condition = "") => {
    const u = new URL("https://www.ebay.com/sch/i.html");
    u.searchParams.set("_nkw", query);
    u.searchParams.set("LH_Sold", "1");
    u.searchParams.set("LH_Complete", "1");
    u.searchParams.set("_ipg", "60");
    u.searchParams.set("_sop", "13"); // most recently ended first: today's prices, not last season's
    if (condition) u.searchParams.set("LH_ItemCondition", condition);
    return u.href;
  };

  // Median of what buyers paid (price + shipping when the card shows it), plus the few sales
  // closest to the median so you can see what the number is made of. Only sales that are the thing
  // itself count:
  //  - "Best offer accepted": the card shows the asking price, not what was paid (always lower), so
  //    those would pull the median up. Left out.
  //  - lots and bundles: not one item's price.
  //  - for parts, not working, as is (when looking at working ones): sellers often list these under
  //    "used" anyway.
  //  - titles missing a model number from the search ("k1000", "ps2"): eBay matches loosely.
  //  - outliers: far outside the rest (a box alone, a mint boxed kit), by Tukey's fences on log prices,
  //    never nearer than 2.5x the median.
  // confidence says how far to trust the number: "good" (15+ sales, middle half within 2x),
  // "fair" (8+, within 3x), else "rough". ship: what buyers paid for shipping when they paid it (median),
  // a fair guess at what sending one on would cost you.
  const PARTSY = /\b(for parts|parts only|not working|non[- ]?working|doesn'?t work|does not work|as[- ]is|broken|untested|for repair|faulty|spares)\b/i;
  const alnum = (x) => x.toLowerCase().replace(/[^a-z0-9]/g, "");
  // What a sold-price summary left out, as phrases for "Left out: …" (the panel and the hub page).
  TK.leftOutSold = (d) =>
    d
      ? [
          d.offers && `${d.offers} best-offer ${d.offers === 1 ? "sale" : "sales"} (the real price isn't shown)`,
          d.lots && `${d.lots} ${d.lots === 1 ? "lot" : "lots"}`,
          d.parts && `${d.parts} for parts`,
          d.unrelated && `${d.unrelated} without the model number`,
          d.outliers && `${d.outliers} far-off ${d.outliers === 1 ? "price" : "prices"}`,
          d.foreign && `${d.foreign} in another currency`,
          d.ranges && `${d.ranges} with a price range`,
        ].filter(Boolean)
      : [];
  TK.summarizeSold = (html, { query = "", condition = "" } = {}) => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const read = TK.extractEbay(doc, { strict: true });
    const dropped = { offers: 0, lots: 0, parts: 0, unrelated: 0, outliers: 0, foreign: 0, ranges: 0 };
    // Another currency (no US price given) and price ranges (which version sold isn't shown) say nothing
    // reliable about what one sold for.
    const all = read.filter((it) => {
      const why = TK.foreignCurrency(it.priceText) && it.price == null ? "foreign" : TK.isPriceRange(it.priceText) ? "ranges" : "";
      if (why) dropped[why]++;
      return !why && it.total != null && it.total > 0;
    });
    // Model numbers in the search must be in the title: tokens with a digit and a letter, or 3+ digits.
    const codes = query.split(/\s+/).filter((w) => (/\d/.test(w) && /[a-z]/i.test(w)) || /^\d{3,}$/.test(w)).map(alnum).filter((w) => w.length >= 2);
    let sales = all.filter((it) => {
      const why = /best offer accepted/i.test(it.el?.textContent || it.raw || "") ? "offers" : it.lot ? "lots" : condition !== "parts" && PARTSY.test(it.title) ? "parts" : codes.length && !codes.every((c) => alnum(it.title).includes(c)) ? "unrelated" : "";
      if (why) dropped[why]++;
      return !why;
    });
    if (sales.length >= 8) {
      const logs = sales.map((it) => Math.log(it.total)).sort((a, b) => a - b);
      const q1 = quantile(logs, 0.25);
      const q3 = quantile(logs, 0.75);
      // Never closer than 2.5x either side of the median: when prices cluster tightly, the fences alone
      // would throw out ordinary sales.
      const mid = quantile(logs, 0.5);
      const lo = Math.min(q1 - 1.5 * (q3 - q1), mid - Math.log(2.5));
      const hi = Math.max(q3 + 1.5 * (q3 - q1), mid + Math.log(2.5));
      const kept = sales.filter((it) => Math.log(it.total) >= lo && Math.log(it.total) <= hi);
      dropped.outliers = sales.length - kept.length;
      sales = kept;
    }
    if (sales.length < 5) return null; // too few sales to trust
    const totals = sales.map((it) => it.total).sort((a, b) => a - b);
    const r = (n) => Math.round(n);
    const median = quantile(totals, 0.5);
    const p25 = quantile(totals, 0.25);
    const p75 = quantile(totals, 0.75);
    const spread = p25 > 0 ? p75 / p25 : Infinity;
    const confidence = totals.length >= 15 && spread <= 2 ? "good" : totals.length >= 8 && spread <= 3 ? "fair" : "rough";
    const ships = sales.map((it) => it.shipping).filter((x) => x > 0).sort((a, b) => a - b);
    const samples = [...sales]
      .sort((a, b) => Math.abs(a.total - median) - Math.abs(b.total - median))
      .slice(0, 5)
      .sort((a, b) => a.total - b.total)
      .map((it) => ({ title: it.title, total: it.total, url: it.url }));
    return { n: totals.length, median: r(median), p25: r(p25), p75: r(p75), confidence, ship: ships.length >= 3 ? r(quantile(ships, 0.5)) : null, dropped, currency: "$", samples };
  };
})();
