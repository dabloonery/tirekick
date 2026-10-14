// Tirekick — eBay sold-price lookups, with one pace for every page that makes them.
// The panel (on eBay and Marketplace) and the hub page share the cache, the spacing and the back-off,
// all kept in storage, so a lookup from one never makes the other trip eBay's browser check.
// Needs Tirekick (content/adapters.js) for the sold-search parser.
//
//   const soldMarket = TKSold.create({ fetchHtml, send, isStopped });
//   const market = await soldMarket("pentax k1000", "used"); // a summary, or null with too few sales
//
// fetchHtml(query, condition) -> { status, html, via?, pausedUntil? }: how this page reaches eBay.

(() => {
  const TK = (globalThis.Tirekick = globalThis.Tirekick || {});
  const TTL_MS = 6 * 60 * 60 * 1000; // an answer is good for six hours
  const NONE_TTL_MS = 60 * 60 * 1000;
  // eBay answers fast scripted traffic with a browser check ("Checking your browser before you
  // access eBay", "Pardon Our Interruption"), and once that trips, your ordinary page loads get it
  // too until it clears. So: few lookups, well spaced, and a long stop at the first sign of it.
  const COOLDOWN_MS = 60 * 60 * 1000;
  const GAP_MS = 5000; // between lookups, across all tabs
  const PER_HOUR = 8;
  const CHALLENGE = /checking your browser|pardon our interruption|verify yourself|captcha|security measure|access denied|unusual (traffic|activity)/i;
  const RESULTS = /s-card|s-item|srp-results|srp-river|no exact matches|\b0 results\b/i;
  // A real results page (even an empty one) is large and has the results markup; a check page is small and doesn't.
  const blockedPage = (html) => (CHALLENGE.test(html.slice(0, 30000)) && !RESULTS.test(html)) || (!RESULTS.test(html) && html.length < 150000);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const pausedMsg = (until) => `Price lookups paused ${Math.ceil((until - Date.now()) / 60000)} min (eBay asked for a browser check).`;
  const workerMsg = (until) => `Price lookups from outside eBay paused ${Math.ceil((until - Date.now()) / 60000)} min: eBay asked for a browser check. Open eBay in another tab and they work again.`;

  const create = ({ fetchHtml, send, isStopped = () => false }) =>
    // Resolves to a market summary, or null when there were too few sales to trust.
    async (query, condition) => {
      const key = `v2:${condition}:${query.trim().toLowerCase()}`; // v2: sales filtered and rated (0.35)
      const { soldCache = {} } = await chrome.storage.local.get("soldCache");
      const hit = soldCache[key];
      // "Too few sales" is kept for an hour, not six: a search with few sales gets more as they end.
      if (hit && Date.now() - hit.at < (hit.market ? TTL_MS : NONE_TTL_MS)) return hit.market;
      // The turn is booked by the background script, so two tabs can't both take the last one this hour.
      const slot = await send("soldSlot", { perHour: PER_HOUR, gap: GAP_MS });
      if (slot.pausedUntil) throw new Error(pausedMsg(slot.pausedUntil));
      if (slot.full) throw new Error(`Price lookups resting: ${PER_HOUR} this hour is plenty for eBay.`);
      if (slot.wait > 0) await sleep(slot.wait);
      if (isStopped()) throw new Error("Stopped.");

      const pause = async () => {
        const until = Date.now() + COOLDOWN_MS;
        await chrome.storage.local.set({ soldCooldownUntil: until });
        throw new Error(pausedMsg(until));
      };
      // A lookup that never got an answer says why in plain words, not the browser's "Failed to fetch".
      const { status, html, via, pausedUntil } = await fetchHtml(query, condition).catch((e) => {
        if (globalThis.navigator?.onLine === false) throw new Error("You're offline: sold prices need eBay. They work again once you're back online.");
        if (/timeout|took too long|aborted/i.test(`${e?.name} ${e?.message}`)) throw new Error("eBay took too long to answer. Try again in a minute.");
        throw new Error(`Couldn't reach eBay for sold prices (${e?.message || e}).`);
      });
      // From outside eBay with no eBay tab open, the request goes out from the background script, which
      // eBay trusts less. A refusal there pauses only that route (open eBay in a tab and it works again),
      // not lookups made from eBay's own pages.
      if (pausedUntil) throw new Error(workerMsg(pausedUntil));
      const refused = async () => {
        if (via !== "worker") return pause();
        await send("soldWorkerBlocked");
        throw new Error(workerMsg(Date.now() + 30 * 60 * 1000));
      };
      if (status === 403 || status === 429 || status === 503) return refused();
      if (!html) throw new Error(`eBay sold search failed (${status}).`);
      if (blockedPage(html)) return refused(); // never cache a check page as "no sales"
      const market = TK.summarizeSold(html, { query, condition });
      // Keep the cache small: drop expired entries, cap at 100 searches. Not keeping it only costs a lookup.
      await send("storeEdit", { name: "soldCache", edit: { set: { [key]: { at: Date.now(), market } }, cap: { max: 100, by: "at", maxAge: TTL_MS } } }).catch(() => {});
      return market;
    };

  globalThis.TKSold = { create, TTL_MS, PER_HOUR };
})();
