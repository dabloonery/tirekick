// Second Look — site adapters.
// Each adapter turns a results page into a list of listings in one shared shape:
//   { id, site, title, priceText, price, url, imageUrl, raw, el }
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

  const firstImage = (root) => {
    const img = root.querySelector("img");
    if (!img) return "";
    return img.getAttribute("src") || img.getAttribute("data-src") || img.getAttribute("data-defer-load") || "";
  };

  const squash = (s, max = 300) => (s || "").replace(/\s+/g, " ").trim().slice(0, max);

  // ---------- eBay ----------
  // 2025+ layout: li.s-card. Older layout: li.s-item. Both still appear in guides.

  SL.extractEbay = (root = document) => {
    const cards = root.querySelectorAll("li.s-card, li.s-item");
    const out = [];
    const seen = new Set();
    cards.forEach((card) => {
      if (card.classList.contains("srp-river-answer")) return;
      const link = card.querySelector('a[href*="/itm/"]');
      if (!link) return;
      const url = link.href || link.getAttribute("href");
      const itemId = (url.match(/\/itm\/(?:[^/?]+\/)?(\d{9,})/) || [])[1] || url;
      if (seen.has(itemId)) return;
      seen.add(itemId);

      let title = firstText(card, [".s-card__title", ".s-item__title", '[role="heading"]', "h3"]) || link.textContent;
      title = squash(title.replace(/^New Listing/i, "").replace(/Opens in a new window or tab$/i, ""), 160);
      if (!title || /^shop on ebay$/i.test(title)) return;

      const priceText = squash(firstText(card, [".s-card__price", ".s-item__price"]) || (card.textContent.match(/\$\s?[\d,]+(?:\.\d{2})?/) || [""])[0], 60);

      out.push({
        site: "ebay",
        title,
        priceText,
        price: SL.parsePrice(priceText),
        url,
        imageUrl: firstImage(card),
        raw: squash(card.innerText || card.textContent),
        el: card,
      });
    });
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

      out.push({
        site: "facebook",
        title,
        priceText: priceLine,
        price: /^free$/i.test(priceLine) ? 0 : SL.parsePrice(priceLine),
        url: new URL(href, location.origin).href.split("?")[0],
        imageUrl: firstImage(a),
        raw: squash(lines.join(" | ")),
        el: a,
      });
    });
    return out;
  };

  SL.facebookQuery = () => new URLSearchParams(location.search).get("query") || "";

  // ---------- single listing pages ----------
  // Layered the same way: site-specific selectors first, then generic page metadata
  // (og: tags) and the visible text of the main area as a fallback.

  const meta = (prop) =>
    document.querySelector(`meta[property="${prop}"], meta[name="${prop}"]`)?.getAttribute("content")?.trim() || "";

  const bigEbayImage = (u) => u.replace(/s-l\d+\./, "s-l1600.");

  const uniq = (arr) => [...new Set(arr.filter(Boolean))];

  SL.extractItem = () => {
    const site = SL.currentSite();
    if (site === "ebay") {
      const title = squash(firstText(document, ["h1.x-item-title__mainTitle", '[data-testid="x-item-title"]', "h1"]) || meta("og:title"), 200);
      const priceText = squash(firstText(document, [".x-price-primary", '[data-testid="x-price-primary"]']), 60);
      const imgs = [...document.querySelectorAll('.ux-image-carousel img, [data-testid="ux-image-carousel"] img')].map(
        (i) => i.getAttribute("src") || i.getAttribute("data-src") || ""
      );
      return {
        site,
        title,
        priceText,
        price: SL.parsePrice(priceText),
        condition: squash(firstText(document, [".x-item-condition-text", '[data-testid="x-item-condition"]']), 120),
        seller: squash(firstText(document, [".x-sellercard-atf", '[data-testid="x-sellercard-atf"]']), 300),
        shipping: squash(firstText(document, [".ux-labels-values--shipping", '[data-testid="x-shipping"]']), 300),
        details: squash(firstText(document, [".x-about-this-item", '[data-testid="x-about-this-item"]']) || meta("og:description"), 1200),
        imageUrls: uniq([...imgs, meta("og:image")]).filter((u) => /^(https?:|data:image)/.test(u)).map(bigEbayImage).slice(0, 4),
        url: location.href.split("?")[0],
      };
    }
    // Facebook Marketplace: class names are useless, so lean on metadata + visible text.
    const main = document.querySelector('[role="main"]') || document.body;
    const priceNode = [...main.querySelectorAll("span")].find((n) => /^(\$\s?[\d,]+(\.\d\d)?|free)$/i.test(n.textContent.trim()));
    const priceText = priceNode ? priceNode.textContent.trim() : "";
    const imgs = [...main.querySelectorAll("img")]
      .filter((i) => /scontent|fbcdn/.test(i.src) && (i.naturalWidth || i.width) >= 200)
      .map((i) => i.src);
    return {
      site: "facebook",
      title: squash(firstText(main, ["h1"]) || meta("og:title"), 200),
      priceText,
      price: /^free$/i.test(priceText) ? 0 : SL.parsePrice(priceText),
      condition: "",
      seller: "",
      shipping: "",
      details: squash(meta("og:description") || main.innerText, 2500),
      imageUrls: uniq([meta("og:image"), ...imgs]).slice(0, 4),
      url: location.href.split("?")[0],
    };
  };

  // A short search phrase for the sold-price comparison, taken from a listing title.
  SL.titleToQuery = (title) =>
    (title || "")
      .replace(/[^\p{L}\p{N}\s.-]/gu, " ")
      .split(/\s+/)
      .filter(Boolean)
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

  SL.summarizeSold = (html) => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const prices = SL.extractEbay(doc)
      .map((it) => it.price)
      .filter((p) => p != null && p > 0)
      .sort((a, b) => a - b);
    if (prices.length < 5) return null; // too few sales to trust
    const r = (n) => Math.round(n);
    return {
      n: prices.length,
      median: r(quantile(prices, 0.5)),
      p25: r(quantile(prices, 0.25)),
      p75: r(quantile(prices, 0.75)),
      currency: "$",
    };
  };
})();
