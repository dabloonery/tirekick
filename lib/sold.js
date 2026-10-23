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
  // An answer is good for a day: it's the middle of the last 60 sales, which barely moves in a day, and each
  // lookup not made is one less for eBay's browser check to count. (Six hours until the pacing round in 0.58.)
  const TTL_MS = 24 * 60 * 60 * 1000;
  const NONE_TTL_MS = 60 * 60 * 1000;
  // eBay answers fast scripted traffic with a browser check ("Checking your browser before you
  // access eBay", "Pardon Our Interruption"), and once that trips, your ordinary page loads get it
  // too until it clears. So: few lookups, well spaced, and a long stop at the first sign of it, longer
  // each time it comes back the same day (TKShared.soldCooldown), with a slower pace for a day after.
  // An answer that only looks wrong (small, no results markup, no check wording) may be eBay trying new
  // markup rather than a check: a short wait, said as what it is. Real-site check, 0.49.1.
  const ODD_COOLDOWN_MS = 10 * 60 * 1000;
  const GAP_MS = 5000; // between lookups, across all tabs
  const PER_HOUR = 8;
  const CHALLENGE = /checking your browser|pardon our interruption|verify yourself|captcha|security measure|access denied|unusual (traffic|activity)/i;
  const RESULTS = /s-card|s-item|srp-results|srp-river|no exact matches|\b0 results\b/i;
  // A real results page (even an empty one) is large and has the results markup; a check page is small and doesn't.
  // "check" when the page says so, "odd" when it's only small with no results in it, "" for a results page.
  const blockedPage = (html) => (RESULTS.test(html) ? "" : CHALLENGE.test(html.slice(0, 30000)) ? "check" : html.length < 150000 ? "odd" : "");
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // "45 min", "2 h 10 min": a pause can run to six hours.
  const mins = (until) => {
    const m = Math.ceil((until - Date.now()) / 60000);
    return m < 90 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}`;
  };
  const pausedMsg = (until, why = "check") =>
    why === "odd"
      ? `Price lookups paused ${mins(until)}: eBay's answer didn't look like a results page.`
      : `Price lookups paused ${mins(until)} (eBay asked for a browser check).`;
  const workerMsg = (until) => `Price lookups from outside eBay paused ${mins(until)}: eBay asked for a browser check. Open eBay in another tab and they work again.`;

  // One spelling per search, so "Pentax  K1000 " and "pentax k1000" share an answer (eBay's search ignores case and spacing).
  const tidy = (query) => String(query || "").trim().replace(/\s+/g, " ");
  const keyOf = (query, condition) => `v2:${condition}:${tidy(query).toLowerCase()}`; // v2: sales filtered and rated (0.35)
  const cached = async (key) => {
    const { soldCache = {} } = await chrome.storage.local.get("soldCache");
    const hit = soldCache[key];
    // "Too few sales" is kept for an hour, not a day: a search with few sales gets more as they end.
    return hit && Date.now() - hit.at < (hit.market ? TTL_MS : NONE_TTL_MS) ? hit : null;
  };

  const create = ({ fetchHtml, send, isStopped = () => false }) => {
    // The same search asked twice on this page while the first is still out (a second scan, a double click)
    // shares the first's answer instead of taking another turn.
    const inflight = new Map();
    const lookup = async (query, condition, key) => {
      let hit = await cached(key);
      if (hit) return hit.market;
      // The turn is booked by the background script, so two tabs can't both take the last one this hour.
      let slot = await send("soldSlot", { perHour: PER_HOUR, gap: GAP_MS, key });
      // Another tab is looking this search up right now: wait for its answer in the shared cache, then
      // ask for a turn of our own only if it didn't get one (refused, timed out, or the tab closed).
      for (let waited = 0; slot.pending > 0 && waited < 45000; ) {
        const step = Math.min(slot.pending, 2000);
        await sleep(step);
        waited += step;
        if (isStopped()) throw new Error("Stopped.");
        if ((hit = await cached(key))) return hit.market;
        slot = await send("soldSlot", { perHour: PER_HOUR, gap: GAP_MS, key });
      }
      if (slot.pausedUntil) {
        const { soldCooldownWhy } = await chrome.storage.local.get("soldCooldownWhy");
        throw new Error(pausedMsg(slot.pausedUntil, soldCooldownWhy));
      }
      if (slot.full) throw new Error(`Price lookups resting: ${slot.perHour || PER_HOUR} this hour is plenty for eBay${slot.perHour < PER_HOUR ? " so soon after its browser check" : ""}.`);
      if (slot.pending > 0) throw new Error("eBay is slow to answer this search from another tab. Try again in a minute.");
      try {
        if (slot.wait > 0) await sleep(slot.wait);
        if (isStopped()) throw new Error("Stopped.");
        // Another tab may have answered it while this one waited its turn.
        if ((hit = await cached(key))) return hit.market;
        return await ask(query, condition, key);
      } finally {
        send("soldDone", { key }).catch(() => {});
      }
    };

    const ask = async (query, condition, key) => {
      const pause = async (why = "check") => {
        let until = Date.now() + ODD_COOLDOWN_MS;
        if (why === "odd") await chrome.storage.local.set({ soldCooldownUntil: until, soldCooldownWhy: why });
        else {
          const { soldStrikes } = await chrome.storage.local.get("soldStrikes");
          const next = TKShared.soldCooldown(soldStrikes);
          until = next.until;
          await chrome.storage.local.set({ soldCooldownUntil: until, soldCooldownWhy: why, soldStrikes: next.strikes });
        }
        throw new Error(pausedMsg(until, why));
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
      const refused = async (why = "check") => {
        if (via !== "worker") return pause(why);
        await send("soldWorkerBlocked");
        throw new Error(workerMsg(Date.now() + 30 * 60 * 1000));
      };
      if (status === 403 || status === 429 || status === 503) return refused();
      if (!html) throw new Error(`eBay sold search failed (${status}).`);
      const blocked = blockedPage(html);
      if (blocked) return refused(blocked); // never cache a check page as "no sales"
      const market = TK.summarizeSold(html, { query, condition });
      // Keep the cache small: drop expired entries, cap at 100 searches. Not keeping it only costs a lookup.
      await send("storeEdit", { name: "soldCache", edit: { set: { [key]: { at: Date.now(), market } }, cap: { max: 100, by: "at", maxAge: TTL_MS } } }).catch(() => {});
      return market;
    };

    // Resolves to a market summary, or null when there were too few sales to trust.
    return (query, condition) => {
      query = tidy(query);
      const key = keyOf(query, condition);
      if (!inflight.has(key)) inflight.set(key, lookup(query, condition, key).finally(() => inflight.delete(key)));
      return inflight.get(key);
    };
  };

  globalThis.TKSold = { create, keyOf, TTL_MS, PER_HOUR };
})();
