// Tirekick — the sites it works on, in one place.
// Everything that differs between eBay and Facebook Marketplace and isn't about reading a page's cards
// lives here: names, addresses, how a listing's key is made, which page is a search and which a listing,
// where photos may come from, and how the site's cards behave on screen. The background script, the
// page scripts, the hub and settings all ask this table instead of naming a site themselves, so adding
// one (see docs/adding-a-site.md) starts with an entry here.
//
// Loaded first everywhere (worker, pages, hub, settings, tests); plain data and small pure functions only.

(() => {
  const enc = encodeURIComponent;
  const CL_VIEW = /^\/view\/(?:d\/[^/]+\/)?([A-Za-z0-9]{16,40})\/?$/; // a Craigslist post, as addressed since 2026

  /** @typedef {{
   *  id: string,            // stored with saved searches and listing facts ("ebay", "facebook")
   *  name: string,          // what the person reads: "eBay", "Marketplace"
   *  owner: string,         // who runs it, for "outside Facebook" and the not-affiliated line
   *  key: string,           // listing keys are `${key}:${itemId}`
   *  hosts: string[],       // exact host names
   *  matches: string[],     // URL patterns for page scripts and menus (also in manifest.json)
   *  imageHosts: RegExp,    // hosts a listing photo may be fetched from for a photo check
   *  isHere: (loc: Location | URL) => boolean,
   *  pageType: (loc: Location | URL) => "results" | "item" | "home" | "other",
   *  queryOf: (loc: Location | URL) => string,   // the search words in a results address
   *  itemId: (url: string) => string | undefined,
   *  itemUrl: (id: string) => string,
   *  searchUrl: (q: string) => string,
   *  isSearchUrl: (u: URL) => boolean,          // an address it's safe to open as a saved search
   *  home: string,
   *  local: boolean,        // mostly local pickup: no shipping on cards, offers say "I can pick up"
   *  cards: {             // how its result cards behave, for the tags put on them
   *    corner: "left" | "right", // which top corner the tag sits in
   *    nested: boolean,     // a card is a link deep inside boxes: climb to the box that holds one listing
   *    fitToPhoto: boolean, // size the tag to the card's photo
   *    compactUnder: number,// cards narrower than this get the compact tag (0 = never)
   *    overlaps: boolean,   // later cards paint over earlier ones: lift the one you're pointing at
   *    recycles: boolean,   // cards are reused as you scroll: put tags back when a card comes back
   *  },
   *  titleCodes: boolean,   // bulk-posted scams end titles with a random code here ("… M2465")
   *  photoTwins: boolean,   // mark a photo seen on other listings under other titles (stolen or stock photos).
   *                         // Off on eBay, where sellers reuse their own photos across listings and cards don't say who
   *  soldReference: boolean, // its sold listings are the price reference (eBay only)
   *  storeFilters: StoreFilter[], // filters the store has, as page address settings (readFilters, withFilters)
   *  pageParams: string[],  // address settings dropped when the filters change (a results page number)
   *  setting?: string,      // an opt-in store: the setting that turns it on (its hosts are asked for then, not at install)
   *  isHost?: (host: string) => boolean, // for a store with a host per city: is this one of its hosts
   *  photoOrigins?: string[], // an opt-in store's photo hosts, asked for with its pages
   *  idPattern?: string,    // what an item id looks like in a key, when it isn't only digits (a regular expression)
   * }} Site */

  /** A filter the store has, set in its page address. A price (money: which way to round to whole dollars), or a
   *  choice: each choice is the address settings it stands for, and none of them set is "any". Choices that need
   *  several values of one setting list them in one string, as the store writes them.
   *  @typedef {{ name: string, label?: string, param?: string, money?: "down" | "up",
   *    choices?: { value: string, label: string, params: Record<string, string> }[] }} StoreFilter */

  /** @type {Site[]} */
  const SITES = [
    {
      id: "ebay",
      name: "eBay",
      owner: "eBay",
      key: "ebay",
      hosts: ["www.ebay.com"],
      matches: ["https://www.ebay.com/*"],
      imageHosts: /(^|\.)(ebayimg\.com|ebaystatic\.com|ebay\.com)$/,
      isHere: (loc) => loc.hostname === "www.ebay.com",
      pageType: (loc) => {
        const path = loc.pathname;
        return path === "/" ? "home" : path.startsWith("/itm/") ? "item" : /^\/(sch|b)\//.test(path) ? "results" : "other";
      },
      queryOf: (loc) => new URLSearchParams(loc.search).get("_nkw") || "",
      itemId: (url) => url.match(/\/itm\/(?:[^/?]+\/)?(\d{9,})/)?.[1],
      itemUrl: (id) => `https://www.ebay.com/itm/${id}`,
      searchUrl: (q) => `https://www.ebay.com/sch/i.html?_nkw=${enc(q)}`,
      isSearchUrl: (u) => u.hostname === "www.ebay.com" && /^\/(sch|b)\//.test(u.pathname),
      home: "https://www.ebay.com/",
      local: false,
      cards: { corner: "left", nested: false, fitToPhoto: true, compactUnder: 0, overlaps: false, recycles: false },
      titleCodes: false,
      photoTwins: false,
      soldReference: true,
      // eBay's price range is the item's price, without shipping
      storeFilters: [
        { name: "min", param: "_udlo", money: "down" },
        { name: "max", param: "_udhi", money: "up" },
        { name: "cond", label: "Condition", choices: [
          { value: "new", label: "New", params: { LH_ItemCondition: "1000" } },
          { value: "used", label: "Used", params: { LH_ItemCondition: "3000" } },
          { value: "parts", label: "For parts", params: { LH_ItemCondition: "7000" } },
        ] },
        { name: "format", label: "Format", choices: [
          { value: "bin", label: "Buy It Now", params: { LH_BIN: "1" } },
          { value: "auction", label: "Auction", params: { LH_Auction: "1" } },
        ] },
        { name: "freeShip", label: "Free shipping", choices: [{ value: "on", label: "Free shipping", params: { LH_FS: "1" } }] },
        { name: "usOnly", label: "US only", choices: [{ value: "on", label: "US only", params: { LH_PrefLoc: "1" } }] },
      ],
      pageParams: ["_pgn"],
    },
    {
      id: "facebook",
      name: "Marketplace",
      owner: "Facebook",
      key: "fb",
      hosts: ["www.facebook.com"],
      matches: ["https://www.facebook.com/*"],
      imageHosts: /(^|\.)(fbcdn\.net|facebook\.com)$/,
      isHere: (loc) => loc.hostname === "www.facebook.com" && loc.pathname.startsWith("/marketplace"),
      pageType: (loc) => (loc.pathname.startsWith("/marketplace/item/") ? "item" : "results"),
      queryOf: (loc) => new URLSearchParams(loc.search).get("query") || "",
      itemId: (url) => url.match(/\/marketplace\/item\/(\d+)/)?.[1],
      itemUrl: (id) => `https://www.facebook.com/marketplace/item/${id}/`,
      searchUrl: (q) => `https://www.facebook.com/marketplace/search?query=${enc(q)}`,
      isSearchUrl: (u) => u.hostname === "www.facebook.com" && u.pathname.startsWith("/marketplace"),
      home: "https://www.facebook.com/marketplace/",
      local: true,
      // Facebook puts "Just listed" in the top-left corner and reuses card elements as you scroll; its
      // narrow grid cells get the compact tag
      cards: { corner: "right", nested: true, fitToPhoto: false, compactUnder: 250, overlaps: true, recycles: true },
      titleCodes: true,
      photoTwins: true,
      soldReference: false,
      storeFilters: [
        { name: "min", param: "minPrice", money: "down" },
        { name: "max", param: "maxPrice", money: "up" },
        { name: "cond", label: "Condition", choices: [
          { value: "new", label: "New", params: { itemCondition: "new" } },
          { value: "used", label: "Used", params: { itemCondition: "used_like_new,used_good,used_fair" } },
        ] },
        { name: "delivery", label: "Delivery", choices: [
          { value: "pickup", label: "Pickup", params: { deliveryMethod: "local_pick_up" } },
          { value: "ship", label: "Shipping", params: { deliveryMethod: "shipping" } },
        ] },
        { name: "listed", label: "Listed", choices: [
          { value: "1", label: "Last day", params: { daysSinceListed: "1" } },
          { value: "7", label: "Last week", params: { daysSinceListed: "7" } },
          { value: "30", label: "Last month", params: { daysSinceListed: "30" } },
        ] },
      ],
      pageParams: [],
    },
    {
      // Opt in (ROADMAP Brief 5): its hosts are optional, asked for when it's turned on in settings.
      id: "craigslist",
      name: "Craigslist",
      owner: "Craigslist",
      key: "cl",
      hosts: ["www.craigslist.org"],
      isHost: (host) => /^[a-z0-9-]+\.craigslist\.org$/.test(host), // a host per city: sfbay.craigslist.org
      matches: ["https://*.craigslist.org/*"],
      imageHosts: /^images\.craigslist\.org$/,
      isHere: (loc) => /^[a-z0-9-]+\.craigslist\.org$/.test(loc.hostname),
      pageType: (loc) => {
        const path = loc.pathname;
        return path === "/" ? "home" : CL_VIEW.test(path) || /\/\d{8,12}\.html$/.test(path) ? "item" : path.startsWith("/search/") ? "results" : "other";
      },
      queryOf: (loc) => new URLSearchParams(loc.search).get("query") || "",
      // Today a post is www.craigslist.org/view/d/<slug>/<code> (2026-10, real saved pages): the code is the key. Older
      // addresses, <city>.craigslist.org/…/<post number>.html, still work and key by the number.
      itemId: (url) => {
        const u = /^https:\/\/[a-z0-9-]+\.craigslist\.org(\/[^?#]*)/.exec(url)?.[1] || "";
        return CL_VIEW.exec(u)?.[1] || u.match(/\/(\d{8,12})\.html$/)?.[1];
      },
      idPattern: "[A-Za-z0-9]{8,40}",
      // /view/<code> opens the post (Craigslist's own prev and next links); an old post number needs its city and
      // category, so saved ones keep their own address.
      itemUrl: (id) => (/^\d+$/.test(id) ? "" : `https://www.craigslist.org/view/${id}`),
      // Craigslist sends www to the nearest city
      searchUrl: (q) => `https://www.craigslist.org/search/sss?query=${enc(q)}`,
      isSearchUrl: (u) => /^[a-z0-9-]+\.craigslist\.org$/.test(u.hostname) && u.pathname.startsWith("/search/"),
      home: "https://www.craigslist.org/",
      local: true,
      cards: { corner: "right", nested: false, fitToPhoto: true, compactUnder: 0, overlaps: false, recycles: true },
      titleCodes: false,
      photoTwins: false,
      soldReference: false,
      storeFilters: [
        { name: "min", param: "min_price", money: "down" },
        { name: "max", param: "max_price", money: "up" },
      ],
      pageParams: [],
      setting: "onCraigslist",
      photoOrigins: ["https://images.craigslist.org/*"],
    },
  ];

  // Which of a filter's choices an address has: "" for none of its settings, "?" for settings no choice matches.
  const choiceIn = (f, params) => {
    const keys = [...new Set(f.choices.flatMap((c) => Object.keys(c.params)))];
    if (!keys.some((k) => params.has(k))) return "";
    const hit = f.choices.find((c) => keys.every((k) => (params.get(k) ?? undefined) === c.params[k]));
    return hit ? hit.value : "?";
  };

  const byId = Object.fromEntries(SITES.map((s) => [s.id, s]));
  const byKey = Object.fromEntries(SITES.map((s) => [s.key, s]));

  const S = {
    all: SITES,
    /** @returns {Site | undefined} */
    get: (id) => byId[id],
    /** The site this page is on, or null. */
    here: (loc = globalThis.location) => (loc ? SITES.find((s) => s.isHere(loc)) || null : null),
    /** A listing's key ("ebay:123", "fb:456"), or its address without the query when it's no site's. */
    keyOf: (url) => {
      for (const s of SITES) {
        const id = s.itemId(url);
        if (id) return `${s.key}:${id}`;
      }
      return url.split("?")[0];
    },
    /** The site a listing key belongs to (eBay when it can't tell, as before). */
    ofKey: (key) => byKey[String(key).split(":")[0]] || byKey[String(key).startsWith("fb") ? "fb" : "ebay"],
    itemUrl: (key) => {
      const s = S.ofKey(key);
      return s.itemUrl(String(key).slice(s.key.length + 1));
    },
    /** What a person reads for a key or a site id: "eBay", "Marketplace". */
    nameOf: (keyOrId) => (byId[keyOrId] || S.ofKey(keyOrId)).name,
    /** The other sites, for "Try on …" and searching everywhere. */
    others: (id) => SITES.filter((s) => s.id !== id),
    /** The sites Tirekick works on with these settings: the opt-in ones only once turned on. */
    inUse: (settings = {}) => SITES.filter((s) => !s.setting || settings[s.setting] === true),
    /** URL patterns for page scripts and menus: every site's, or these sites'. */
    matches: (sites = SITES) => sites.flatMap((s) => s.matches),
    /** The host access an opt-in site asks for when it's turned on: its pages and its photos. */
    originsOf: (s) => [...s.matches, ...(s.photoOrigins || [])],
    /** Hosts a link may point at (saved listings and searches, restored backups). */
    isSiteHost: (host) => SITES.some((s) => s.hosts.includes(host) || !!s.isHost?.(host)),
    isImageHost: (host) => SITES.some((s) => s.imageHosts.test(host)),
    isSearchUrl: (u) => SITES.some((s) => s.isSearchUrl(u)),
    /** The store's own filters in a results address, as Tirekick's filter fields: prices in whole dollars (0 = not
     *  set), choices by value ("" = any, "?" = set to something Tirekick doesn't offer, which it leaves alone). */
    readFilters: (url) => {
      const u = new URL(String(url));
      const out = {};
      for (const f of S.here(u)?.storeFilters || []) out[f.name] = f.money ? Number(S.storeValue(f, u.searchParams.get(f.param))) || 0 : choiceIn(f, u.searchParams);
      return out;
    },
    /** The same address with the store's filters set to Tirekick's (a field left out, or "?", stays as it is; 0 or
     *  "" takes it off). Prices go as whole dollars: a minimum rounded down, a maximum up, so the store keeps every
     *  listing Tirekick would. A change starts again from the first page of results. */
    withFilters: (url, filters) => {
      const u = new URL(String(url));
      const site = S.here(u);
      if (!site || S.hasFilters(u, filters)) return u.href; // untouched, so the address stays exactly as it was
      for (const f of site.storeFilters) {
        if (!(f.name in filters) || filters[f.name] === "?") continue;
        if (f.money) {
          const v = S.storeValue(f, filters[f.name]);
          if (v) u.searchParams.set(f.param, v);
          else u.searchParams.delete(f.param);
          continue;
        }
        for (const c of f.choices) for (const p of Object.keys(c.params)) u.searchParams.delete(p);
        const pick = f.choices.find((c) => c.value === filters[f.name]);
        for (const [p, v] of Object.entries(pick?.params || {})) u.searchParams.set(p, v);
      }
      site.pageParams.forEach((p) => u.searchParams.delete(p));
      return u.href;
    },
    /** A price as the store's address has it ("" = not set). */
    storeValue: (f, value) => {
      const v = Number(value) || 0;
      return v > 0 ? String(f.money === "up" ? Math.ceil(v) : Math.floor(v)) : "";
    },
    /** Does the address already carry these filters? */
    hasFilters: (url, filters) => {
      const u = new URL(String(url));
      return (S.here(u)?.storeFilters || []).every((f) => {
        if (!(f.name in filters) || filters[f.name] === "?") return true;
        if (f.money) return S.storeValue(f, u.searchParams.get(f.param)) === S.storeValue(f, filters[f.name]);
        return choiceIn(f, u.searchParams) === (filters[f.name] || "");
      });
    },
    /** Where price references come from (eBay's sold listings). */
    soldSite: () => SITES.find((s) => s.soldReference),
  };

  globalThis.TKSites = S;
})();
