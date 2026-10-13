// Second Look — eBay sold-price lookups, with one pace for every page that makes them.
// The panel (on eBay and Marketplace) and the hub page share the cache, the spacing and the back-off,
// all kept in storage, so a lookup from one never makes the other trip eBay's browser check.
// Needs SecondLook (content/adapters.js) for the sold-search parser.
//
//   const soldMarket = SLSold.create({ fetchHtml, send, isStopped });
//   const market = await soldMarket("pentax k1000", "used"); // a summary, or null with too few sales
//
// fetchHtml(query, condition) -> { status, html, via?, pausedUntil? }: how this page reaches eBay.

(() => {
  const SL = (globalThis.SecondLook = globalThis.SecondLook || {});
  const TTL_MS = 6 * 60 * 60 * 1000; // an answer is good for six hours
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
      const { soldCache = {}, soldCooldownUntil = 0, soldLog = [] } = await chrome.storage.local.get(["soldCache", "soldCooldownUntil", "soldLog"]);
      const hit = soldCache[key];
      if (hit && Date.now() - hit.at < TTL_MS) return hit.market;
      if (Date.now() < soldCooldownUntil) throw new Error(pausedMsg(soldCooldownUntil));
      const recent = soldLog.filter((t) => Date.now() - t < 60 * 60 * 1000);
      if (recent.length >= PER_HOUR) throw new Error(`Price lookups resting: ${PER_HOUR} this hour is plenty for eBay.`);
      const wait = (recent.at(-1) || 0) + GAP_MS - Date.now();
      if (wait > 0) await sleep(wait);
      if (isStopped()) throw new Error("Stopped.");
      await chrome.storage.local.set({ soldLog: [...recent, Date.now()] });

      const pause = async () => {
        const until = Date.now() + COOLDOWN_MS;
        await chrome.storage.local.set({ soldCooldownUntil: until });
        throw new Error(pausedMsg(until));
      };
      const { status, html, via, pausedUntil } = await fetchHtml(query, condition);
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
      const market = SL.summarizeSold(html, { query, condition });
      // Keep the cache small: drop expired entries, cap at 100 searches.
      const fresh = Object.entries(soldCache).filter(([, v]) => Date.now() - v.at < TTL_MS).slice(-99);
      await chrome.storage.local.set({ soldCache: Object.fromEntries([...fresh, [key, { at: Date.now(), market }]]) });
      return market;
    };

  globalThis.SLSold = { create, TTL_MS, PER_HOUR };
})();
