// Second Look — the sites it works on, in one place.
// Everything that differs between eBay and Facebook Marketplace and isn't about reading a page's cards
// lives here: names, addresses, how a listing's key is made, which page is a search and which a listing,
// where photos may come from, and how the site's cards behave on screen. The background script, the
// page scripts, the hub and settings all ask this table instead of naming a site themselves, so adding
// one (see docs/adding-a-site.md) starts with an entry here.
//
// Loaded first everywhere (worker, pages, hub, settings, tests); plain data and small pure functions only.

(() => {
  const enc = encodeURIComponent;

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
   *  soldReference: boolean // its sold listings are the price reference (eBay only)
   * }} Site */

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
      soldReference: true,
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
      soldReference: false,
    },
  ];

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
    /** Every site's URL patterns: page scripts, menus. */
    matches: () => SITES.flatMap((s) => s.matches),
    /** Hosts a link may point at (saved listings and searches, restored backups). */
    isSiteHost: (host) => SITES.some((s) => s.hosts.includes(host)),
    isImageHost: (host) => SITES.some((s) => s.imageHosts.test(host)),
    isSearchUrl: (u) => SITES.some((s) => s.isSearchUrl(u)),
    /** Where price references come from (eBay's sold listings). */
    soldSite: () => SITES.find((s) => s.soldReference),
  };

  globalThis.SLSites = S;
})();
