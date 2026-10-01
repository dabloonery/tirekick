// Second Look — on-page panel and scan flow.
// Flow: extract listings -> (optional) get eBay sold prices -> rank in batches
// with Ollama -> show ranked list + stickers on the cards themselves.

(() => {
  const SL = window.SecondLook;
  if (!SL || window.__secondLookPanel) return;
  window.__secondLookPanel = true;

  const VERDICT = {
    great: { color: "#1F7A4D", label: "Great deal" },
    good: { color: "#4F7D1F", label: "Worth a look" },
    fair: { color: "#8A6D00", label: "Market price" },
    pass: { color: "#6B7280", label: "Skip" },
    suspicious: { color: "#B42318", label: "Suspicious" },
  };

  const send = (type, payload) =>
    new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type, payload }, (res) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        res?.ok ? resolve(res.data) : reject(new Error(res?.error || "Unknown error"));
      });
    });

  // Small DOM builder: always uses textContent, so listing text can't inject HTML.
  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") el.className = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (v != null) el.setAttribute(k, v);
    }
    kids.flat().forEach((k) => k != null && el.append(k instanceof Node ? k : document.createTextNode(String(k))));
    return el;
  };

  // ---------- panel shell (shadow DOM keeps site CSS out) ----------

  const host = h("div", { id: "second-look-host" });
  host.style.cssText = "position:fixed;right:0;top:96px;z-index:2147483646;";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>
    :host { all: initial; }
    * { box-sizing: border-box; }
    .wrap { --w: 380px; --ink:#1B2733; --paper:#FFFFFF; --soft:#F4F6F9; --rule:#E3E8EE; --muted:#5F6B7A; --accent:#2A5FBF;
      font: 13px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: var(--ink); }
    @media (prefers-color-scheme: dark) {
      .wrap { --ink:#E8EDF3; --paper:#18212B; --soft:#202B37; --rule:#2E3B49; --muted:#9AA7B5; --accent:#7FB0F0; }
    }

    /* the drawer slides in from the right edge; the tab stays visible when it's closed */
    .drawer { display:flex; align-items:flex-start; transform:translateX(var(--w)); transition:transform .28s cubic-bezier(.2,.8,.2,1); }
    .open .drawer { transform:none; }
    .panel { visibility:hidden; transition:visibility 0s .28s; }
    .open .panel { visibility:visible; transition-delay:0s; }

    .tab { position:relative; display:flex; flex-direction:column; align-items:center; gap:8px; width:34px; padding:12px 0;
      background:var(--accent); color:#fff; border:0; border-radius:12px 0 0 12px; cursor:pointer;
      box-shadow:-2px 3px 12px rgba(20,30,50,.28); transition:width .15s, background .15s; }
    .tab:hover { width:38px; }
    .tab svg { width:18px; height:18px; }
    .tab span { writing-mode:vertical-rl; font:700 12px/1 system-ui,sans-serif; letter-spacing:.06em; text-transform:uppercase; }
    .count { position:absolute; top:-7px; left:-7px; min-width:20px; height:20px; padding:0 5px; border-radius:10px; background:#2F9E6B; color:#fff;
      font:700 11px/20px system-ui,sans-serif; text-align:center; box-shadow:0 0 0 2px var(--paper); }
    .count.new { background:#E8890C; }
    .open .count { display:none; }

    .panel { width:var(--w); max-height:calc(100vh - 128px); display:flex; flex-direction:column; overflow:hidden;
      background:var(--paper); border:1px solid var(--rule); border-right:0; border-radius:14px 0 0 14px;
      box-shadow:-6px 8px 30px rgba(20,30,50,.22); }
    .head { display:flex; align-items:center; gap:10px; padding:12px 14px; border-bottom:1px solid var(--rule); }
    .logo { width:28px; height:28px; border-radius:9px; background:var(--accent); color:#fff; display:grid; place-items:center; flex:none; }
    .logo svg { width:16px; height:16px; }
    .head strong { font-size:15px; letter-spacing:-.01em; }
    .head small { display:block; color:var(--muted); font-size:11px; }
    .head .grow { flex:1; min-width:0; }
    .icon-btn { background:none; border:0; color:var(--muted); font-size:20px; line-height:1; cursor:pointer; padding:4px 8px; border-radius:8px; }
    .icon-btn:hover { background:var(--soft); color:var(--ink); }

    .controls { padding:12px 14px; display:grid; gap:10px; border-bottom:1px solid var(--rule); }
    label { color:var(--muted); font-size:11px; font-weight:600; letter-spacing:.03em; text-transform:uppercase; }
    input { width:100%; margin-top:4px; padding:8px 10px; border:1px solid var(--rule); border-radius:9px; background:var(--soft); color:var(--ink); font:inherit; }
    input:focus { outline:2px solid var(--accent); outline-offset:0; background:var(--paper); }
    .scan { background:var(--accent); color:#fff; border:0; border-radius:10px; padding:11px; font:700 13px/1 system-ui, sans-serif; cursor:pointer;
      box-shadow:0 2px 6px rgba(42,95,191,.35); transition:transform .1s, filter .15s; }
    .scan:hover:not(:disabled) { filter:brightness(1.08); }
    .scan:active:not(:disabled) { transform:translateY(1px); }
    .scan:disabled { opacity:.65; cursor:progress; box-shadow:none; }
    .status { color:var(--muted); font-size:12px; min-height:1em; }
    .status.err { color:#D92D20; background:rgba(217,45,32,.08); padding:6px 8px; border-radius:8px; }
    .busy .status:not(.err):not(:empty)::before { content:""; display:inline-block; width:11px; height:11px; margin-right:7px; vertical-align:-1px;
      border:2px solid var(--rule); border-top-color:var(--accent); border-radius:50%; animation:spin .7s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
    .market { font-size:12px; color:var(--ink); }
    .market:not(:empty) { background:var(--soft); padding:7px 9px; border-radius:8px; }

    .list, .itemout { overflow:auto; }
    .list:empty, .itemout:empty { display:none; }
    .row { display:grid; grid-template-columns:50px 1fr; gap:12px; padding:12px 14px; border-bottom:1px solid var(--rule); }
    .row:last-child { border-bottom:0; }
    .list .row:hover { background:var(--soft); }
    .tag { --p:50; --c:#666; width:46px; height:46px; border-radius:50%; position:relative; display:grid; place-items:center;
      background:conic-gradient(var(--c) calc(var(--p) * 1%), var(--rule) 0); }
    .tag::before { content:""; position:absolute; inset:4px; border-radius:50%; background:var(--paper); }
    .tag span { position:relative; font:800 15px/1 system-ui,sans-serif; color:var(--c); font-variant-numeric:tabular-nums; }
    .title { background:none; border:0; padding:0; color:var(--ink); font:700 13px/1.35 system-ui, sans-serif; text-align:left; cursor:pointer; }
    button.title:hover { text-decoration:underline; }
    .meta { color:var(--muted); font-size:12px; margin-top:2px; }
    .reason { margin-top:5px; }
    .flags { display:flex; flex-wrap:wrap; gap:5px; margin-top:7px; }
    .flag { font-size:11px; padding:2px 8px; background:var(--soft); border-radius:999px; color:var(--muted); }
    .actions { display:flex; gap:12px; margin-top:8px; font-size:12px; font-weight:600; }
    .actions a, .actions button { color:var(--accent); background:none; border:0; padding:0; font:inherit; cursor:pointer; text-decoration:none; }
    .actions a:hover, .actions button:hover { text-decoration:underline; }
    .photo { margin-top:7px; font-size:12px; color:var(--muted); background:var(--soft); border-radius:8px; padding:7px 9px; }
    [hidden] { display:none !important; }
    .sect { padding:10px 14px; border-top:1px solid var(--rule); font-size:12px; }
    .sect ol { margin:5px 0 0; padding-left:18px; }
    .sect li { margin:3px 0; }
    .offer { padding:10px 14px; border-top:1px solid var(--rule); font-size:13px; }
    .offer b { color:var(--accent); }
    button:focus-visible, input:focus-visible, a:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
    @media (prefers-reduced-motion: reduce) { .drawer, .tab, .scan, .busy .status::before { transition:none; animation:none; } }
  </style>
  <div class="wrap">
   <div class="drawer">
    <button class="tab" data-act="tab" aria-label="Open Second Look" title="Second Look">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/></svg>
      <span>Second Look</span><i class="count" hidden></i>
    </button>
    <div class="panel">
      <div class="head">
        <div class="logo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/></svg></div>
        <div class="grow"><strong>Second Look</strong><small>Spot the deals worth opening</small></div>
        <button class="icon-btn" data-act="toggle" aria-label="Tuck panel away">›</button>
      </div>
      <div class="controls">
        <div><label for="q">Compare prices against</label><input id="q" placeholder="e.g. Pentax K1000"></div>
        <button class="scan" data-act="scan">Scan this page</button>
        <button class="scan" data-act="analyze" hidden>Analyze this listing</button>
        <div class="market"></div>
        <div class="status" role="status"></div>
        <div class="actions"><button data-act="reset" hidden>Start over</button></div>
      </div>
      <div class="list"></div>
      <div class="itemout"></div>
    </div>
   </div>
  </div>`;

  const $ = (sel) => root.querySelector(sel);
  const wrap = $(".wrap");
  const panel = $(".panel");
  const countEl = $(".count");
  const statusEl = $(".status");
  const marketEl = $(".market");
  const listEl = $(".list");
  const queryEl = $("#q");
  const scanBtn = $('[data-act="scan"]');
  const analyzeBtn = $('[data-act="analyze"]');
  const resetBtn = $('[data-act="reset"]');
  const itemEl = $(".itemout");

  const setStatus = (text, isErr = false) => {
    statusEl.textContent = text;
    statusEl.classList.toggle("err", isErr);
  };

  // Open/closed: the tab is always there; the panel slides out when you pull the tab.
  const setOpen = (open) => {
    wrap.classList.toggle("open", open);
    $('[data-act="tab"]').setAttribute("aria-label", open ? "Tuck Second Look away" : "Open Second Look");
    try {
      chrome.storage.local.set({ panelOpen: open });
    } catch {}
  };
  const toggleOpen = () => setOpen(!wrap.classList.contains("open"));
  $('[data-act="tab"]').addEventListener("click", toggleOpen);
  $('[data-act="toggle"]').addEventListener("click", () => setOpen(false));
  chrome.storage.local.get({ panelOpen: false }).then(({ panelOpen }) => setOpen(!!panelOpen));

  const setCount = (n) => {
    countEl.textContent = String(n);
    countEl.hidden = !n;
  };

  // ---------- stickers on the listing cards ----------

  // The sticker lives in the page, so its CSS is injected into the page once.
  const ensureStickerStyles = () => {
    if (document.getElementById("second-look-styles")) return;
    const st = document.createElement("style");
    st.id = "second-look-styles";
    st.textContent = `
      .second-look-sticker { position:absolute; top:8px; left:8px; z-index:50; display:flex; align-items:center;
        background:var(--sl-c); color:#fff; border-radius:999px; box-shadow:0 0 0 2px #fff, 0 3px 10px rgba(0,0,0,.4);
        font:600 13px/1.15 system-ui,-apple-system,"Segoe UI",sans-serif; cursor:help; }
      .second-look-sticker .sl-score { background:#fff; color:var(--sl-c); font-weight:800; font-size:18px;
        min-width:40px; height:40px; margin:2px; border-radius:999px; display:grid; place-items:center; font-variant-numeric:tabular-nums; }
      .second-look-sticker .sl-text { display:flex; flex-direction:column; padding:0 14px 0 8px; }
      .second-look-sticker .sl-verdict { font-weight:800; font-size:14px; white-space:nowrap; }
      .second-look-sticker .sl-sub { font-size:9.5px; font-weight:600; letter-spacing:.05em; text-transform:uppercase; opacity:.92; white-space:nowrap; }
      .second-look-sticker .sl-pop { display:none; position:absolute; top:100%; left:0; margin-top:8px; width:240px;
        background:#fff; color:#1E2A38; border-radius:10px; padding:10px 12px; font:400 12px/1.4 system-ui,sans-serif;
        box-shadow:0 6px 20px rgba(0,0,0,.3); white-space:normal; }
      .second-look-sticker:hover .sl-pop { display:block; }
      .second-look-sticker .sl-pop b { display:block; margin-bottom:4px; }
      .second-look-sticker .sl-flags { margin-top:6px; color:#5B6776; }`;
    document.head.append(st);
  };

  // Facebook recycles card elements as you scroll, which drops our stickers. Remember each
  // scored listing by its URL and put the sticker back when its card reappears.
  const scored = new Map(); // key -> scored item
  const seen = new Set(); // keys we've already sent for scoring, so a re-scan only does what's new
  const keyOf = (url) => (url.match(/\/itm\/(?:[^/?]+\/)?(\d{9,})/) || [])[1] || url.split("?")[0];
  const reapplyFacebook = () => {
    if (!scored.size || SL.currentSite() !== "facebook") return;
    document.querySelectorAll(ITEM_LINK).forEach((a) => {
      const item = scored.get(keyOf(new URL(a.getAttribute("href"), location.origin).href));
      if (!item) return;
      const host = stickerHost(a);
      if (host.querySelector(":scope > .second-look-sticker")) return;
      item.el = a;
      stick(item);
    });
  };
  setInterval(reapplyFacebook, 1500);

  const clearStickers = () => {
    scored.clear();
    seen.clear();
    document.querySelectorAll("[data-second-look]").forEach((el) => {
      if (el.dataset.secondLookPos) el.style.position = "";
      el.removeAttribute("data-second-look");
      el.removeAttribute("data-second-look-pos");
    });
    document.querySelectorAll(".second-look-sticker").forEach((s) => s.remove());
  };

  const ITEM_LINK = 'a[href*="/marketplace/item/"]';

  // Where the sticker goes. eBay cards are fine as they are. A Facebook card is a link that may be
  // inline or zero-height, so climb to the nearest real box that still holds only this one listing.
  const stickerHost = (el) => {
    if (SL.currentSite() !== "facebook") return el;
    let node = el;
    for (let i = 0; i < 6 && node; i++) {
      const r = node.getBoundingClientRect();
      if (getComputedStyle(node).display !== "inline" && r.width >= 100 && r.height >= 100) return node;
      const up = node.parentElement;
      if (!up || up.querySelectorAll(ITEM_LINK).length > 1) break;
      node = up;
    }
    return el;
  };

  const stick = (item) => {
    if (!item.el?.isConnected) return;
    ensureStickerStyles();
    const el = stickerHost(item.el);
    const v = VERDICT[item.verdict] || VERDICT.fair;
    el.setAttribute("data-second-look", item.verdict);
    if (getComputedStyle(el).position === "static") {
      el.style.position = "relative";
      el.setAttribute("data-second-look-pos", "1");
    }
    el.querySelector(":scope > .second-look-sticker")?.remove();
    const s = h(
      "div",
      { class: "second-look-sticker", style: `--sl-c:${v.color}` },
      h("div", { class: "sl-score" }, String(item.score)),
      h("div", { class: "sl-text" }, h("div", { class: "sl-verdict" }, v.label), h("div", { class: "sl-sub" }, item.related === false ? "Not your search" : "Second Look score")),
      h(
        "div",
        { class: "sl-pop" },
        h("b", {}, `${item.score} out of 100: ${v.label}`),
        item.related === false ? h("div", { class: "sl-flags" }, "Not what you searched for, scored on the deal alone.") : null,
        item.reason || "",
        item.flags?.length ? h("div", { class: "sl-flags" }, item.flags.join(" · ")) : null
      )
    );
    el.append(s);
  };

  // ---------- results list ----------

  const render = (items) => {
    listEl.replaceChildren();
    [...items]
      .filter((it) => it.score != null)
      .sort((a, b) => b.score - a.score)
      .forEach((it) => {
        const v = VERDICT[it.verdict] || VERDICT.fair;
        const photoBox = h("div");
        const vsMarket = it.priceVsMarket != null ? ` · ${Math.round(it.priceVsMarket * 100)}% of sold median` : "";
        const row = h(
          "div",
          { class: "row" },
          h("div", { class: "tag", style: `--c:${v.color};--p:${it.score}`, "aria-label": `Score ${it.score}` }, h("span", {}, String(it.score))),
          h(
            "div",
            {},
            h("button", { class: "title", onclick: () => focusCard(it) }, it.title),
            h("div", { class: "meta" }, `${v.label}${it.related === false ? " (not your search)" : ""} · ${it.priceText || "no price"}${it.related === false ? "" : vsMarket}`),
            h("div", { class: "reason" }, it.reason || ""),
            it.flags?.length ? h("div", { class: "flags" }, it.flags.map((f) => h("span", { class: "flag" }, f))) : null,
            h(
              "div",
              { class: "actions" },
              h("a", { href: it.url, target: "_blank", rel: "noopener" }, "Open listing"),
              it.imageUrl ? h("button", { onclick: (e) => runPhotoCheck(it, photoBox, e.currentTarget) }, "Check photo") : null
            ),
            photoBox
          )
        );
        listEl.append(row);
      });
  };

  const focusCard = (it) => {
    if (!it.el?.isConnected) return window.open(it.url, "_blank", "noopener");
    it.el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const runPhotoCheck = async (it, box, btn) => {
    btn.disabled = true;
    box.replaceChildren(h("div", { class: "photo" }, "Looking at the photo…"));
    try {
      const text = await send("checkPhoto", { imageUrl: it.imageUrl, title: it.title });
      box.replaceChildren(h("div", { class: "photo" }, text.trim()));
    } catch (e) {
      box.replaceChildren(h("div", { class: "photo" }, e.message));
    } finally {
      btn.disabled = false;
    }
  };

  // ---------- scan ----------

  let scanning = false;

  // On eBay the sold-listings search is made from the eBay page itself (same site, your cookies,
  // normal browser headers), like any request eBay's own pages make. From Facebook it has to go
  // through the background script. Either way: cached, and paused if eBay pushes back.
  const soldCache = new Map();
  const COOLDOWN_MS = 30 * 60 * 1000;
  const blockedPage = (html) =>
    /captcha|pardon our interruption|verify yourself|security measure/i.test(html.slice(0, 20000)) && !/s-card|s-item/.test(html);

  const fetchSold = async (query) => {
    if (location.hostname !== "www.ebay.com") return send("fetchSoldHtml", { query });
    const key = query.toLowerCase();
    const hit = soldCache.get(key);
    if (hit && Date.now() - hit.at < 15 * 60 * 1000) return hit.html;

    const { soldCooldownUntil = 0 } = await chrome.storage.local.get("soldCooldownUntil");
    if (Date.now() < soldCooldownUntil) {
      throw new Error(`Price lookups paused for ${Math.ceil((soldCooldownUntil - Date.now()) / 60000)} more min because eBay pushed back.`);
    }
    const pause = async (why) => {
      await chrome.storage.local.set({ soldCooldownUntil: Date.now() + COOLDOWN_MS });
      throw new Error(`${why} Paused price lookups for 30 minutes.`);
    };
    const url = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Sold=1&LH_Complete=1&_ipg=60`;
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) return pause(`eBay answered HTTP ${res.status}.`);
    const html = await res.text();
    if (blockedPage(html)) return pause("eBay showed a verification page.");
    soldCache.set(key, { at: Date.now(), html });
    return html;
  };

  const getMarket = async (settings, query) => {
    if (!settings.useSoldComps || !query) return null;
    setStatus(`Checking recent eBay sales for "${query}"…`);
    let market = null;
    try {
      market = SL.summarizeSold(await fetchSold(query));
    } catch (e) {
      console.warn("[Second Look] sold comps failed:", e);
      marketEl.textContent = e.message;
      return null;
    }
    marketEl.textContent = market
      ? `eBay sold: median $${market.median}, middle half $${market.p25}–$${market.p75} (${market.n} sales)`
      : "Not enough eBay sales found to set a market price.";
    return market;
  };

  // ---------- listings that loaded after the last scan ----------

  const currentKeys = () => {
    const sel = SL.currentSite() === "facebook" ? ITEM_LINK : 'li.s-card a[href*="/itm/"], li.s-item a[href*="/itm/"]';
    const keys = new Set();
    document.querySelectorAll(sel).forEach((a) => keys.add(keyOf(new URL(a.getAttribute("href"), location.origin).href)));
    return keys;
  };

  const refreshPending = () => {
    if (scanning || SL.pageType() !== "results") return;
    let n = 0;
    if (seen.size) currentKeys().forEach((k) => !seen.has(k) && n++);
    scanBtn.textContent = n ? `Scan ${n} new listing${n > 1 ? "s" : ""}` : seen.size ? "Scan again" : "Scan this page";
    countEl.classList.toggle("new", n > 0);
    if (n) {
      countEl.textContent = `+${n}`;
      countEl.hidden = false;
    } else setCount(scored.size);
    resetBtn.hidden = !seen.size;
  };
  setInterval(refreshPending, 2000);

  const scan = async () => {
    if (scanning) return;
    scanning = true;
    wrap.classList.add("busy");
    scanBtn.disabled = true;

    try {
      const settings = await send("getSettings");
      // Only listings we haven't scored yet: scrolling loads more, and a re-scan adds just those.
      const wanted = currentKeys();
      const items = SL.extract().filter((it) => !seen.has(keyOf(it.url)));
      wanted.forEach((k) => seen.add(k));
      items.forEach((it) => seen.add(keyOf(it.url)));
      if (!items.length) {
        setStatus(
          scored.size
            ? "Nothing new since your last scan. Scroll down to load more listings."
            : "No listings found on this page. Scroll so results load, or the site layout may have changed (README: When it breaks).",
          !scored.size
        );
        return;
      }

      const query = queryEl.value.trim();
      const market = await getMarket(settings, query);
      if (market) items.forEach((it) => (it.priceVsMarket = it.price != null && market.median > 0 ? it.price / market.median : null));

      const size = Math.max(1, settings.batchSize | 0);
      for (let i = 0; i < items.length; i += size) {
        const batch = items.slice(i, i + size);
        setStatus(`Ranking ${Math.min(i + size, items.length)} of ${items.length} listings with ${settings.provider === "anthropic" ? settings.anthropicModel : settings.textModel}…`);
        const payload = batch.map(({ el, ...rest }) => rest); // DOM nodes can't be sent
        const results = await send("rankBatch", { items: payload, query, market });
        for (const r of results) {
          const it = items.find((x) => x.id === r.id);
          if (!it) continue;
          Object.assign(it, {
            score: Math.max(0, Math.min(100, r.score | 0)),
            verdict: VERDICT[r.verdict] ? r.verdict : "fair",
            related: r.related !== false,
            flags: (r.flags || []).slice(0, 4),
            reason: r.reason,
          });
          stick(it);
          scored.set(keyOf(it.url), it);
        }
        render([...scored.values()]);
      }
      const missed = items.filter((it) => it.score == null).length;
      setCount(scored.size);
      setStatus(`Ranked ${items.length - missed} of ${items.length} new listings.${missed ? " The model skipped some; try a smaller batch size in settings." : ""}`);
    } catch (e) {
      setStatus(e.message, true);
    } finally {
      scanning = false;
      wrap.classList.remove("busy");
      scanBtn.disabled = false;
      refreshPending();
    }
  };

  scanBtn.addEventListener("click", scan);
  resetBtn.addEventListener("click", () => {
    clearStickers();
    listEl.replaceChildren();
    marketEl.textContent = "";
    setCount(0);
    setStatus("");
    refreshPending();
  });

  // ---------- one listing, in depth ----------

  let analyzing = false;

  const renderItem = (listing, r, market) => {
    const v = VERDICT[r.verdict] || VERDICT.fair;
    const score = Math.max(0, Math.min(100, r.score | 0));
    const vs = market && listing.price != null && market.median > 0 ? ` · ${Math.round((listing.price / market.median) * 100)}% of sold median` : "";
    const questions = (r.questions || []).slice(0, 6);
    const photoBox = h("div");
    const parts = [
      h(
        "div",
        { class: "row" },
        h("div", { class: "tag", style: `--c:${v.color};--p:${score}`, "aria-label": `Score ${score}` }, h("span", {}, String(score))),
        h(
          "div",
          {},
          h("div", { class: "title" }, `${v.label} (${score}/100)`),
          h("div", { class: "meta" }, `${listing.priceText || "no price"}${vs}`),
          h("div", { class: "reason" }, r.summary || ""),
          r.flags?.length ? h("div", { class: "flags" }, r.flags.slice(0, 5).map((f) => h("span", { class: "flag" }, f))) : null
        )
      ),
    ];
    if (r.offerHigh > 0) {
      parts.push(h("div", { class: "offer" }, "Suggested offer: ", h("b", {}, `$${r.offerLow}–$${r.offerHigh}`)));
    }
    if (questions.length) {
      const copyBtn = h("button", {
        onclick: async () => {
          try {
            await navigator.clipboard.writeText(questions.map((q, i) => `${i + 1}. ${q}`).join("\n"));
            copyBtn.textContent = "Copied";
          } catch {
            copyBtn.textContent = "Couldn't copy";
          }
        },
      }, "Copy questions");
      parts.push(
        h("div", { class: "sect" }, h("strong", {}, "Ask the seller"), h("ol", {}, questions.map((q) => h("li", {}, q))), h("div", { class: "actions" }, copyBtn))
      );
    }
    if (listing.imageUrls?.length) {
      const btn = h("button", { onclick: () => checkPhotos(listing, photoBox, btn) }, `Check ${Math.min(3, listing.imageUrls.length)} photo${listing.imageUrls.length > 1 ? "s" : ""}`);
      parts.push(h("div", { class: "sect" }, h("div", { class: "actions" }, btn), photoBox));
    }
    itemEl.replaceChildren(...parts);
  };

  const checkPhotos = async (listing, box, btn) => {
    btn.disabled = true;
    box.replaceChildren();
    for (const [i, url] of listing.imageUrls.slice(0, 3).entries()) {
      const line = h("div", { class: "photo" }, `Photo ${i + 1}: looking…`);
      box.append(line);
      try {
        line.textContent = `Photo ${i + 1}: ${(await send("checkPhoto", { imageUrl: url, title: listing.title })).trim()}`;
      } catch (e) {
        line.textContent = `Photo ${i + 1}: ${e.message}`;
      }
    }
    btn.disabled = false;
  };

  const analyze = async () => {
    if (analyzing) return;
    analyzing = true;
    wrap.classList.add("busy");
    analyzeBtn.disabled = true;
    itemEl.replaceChildren();
    marketEl.textContent = "";
    try {
      const settings = await send("getSettings");
      const listing = SL.extractItem();
      if (!listing.title) {
        setStatus("Couldn't read this listing. Let it finish loading and try again, or the layout may have changed (README: When it breaks).", true);
        return;
      }
      if (!queryEl.value.trim()) queryEl.value = SL.titleToQuery(listing.title);
      const query = queryEl.value.trim();
      const market = await getMarket(settings, query);
      setStatus("Analyzing this listing…");
      const r = await send("analyzeListing", { listing, query, market });
      renderItem(listing, r, market);
      setCount(1);
      setStatus("");
    } catch (e) {
      setStatus(e.message, true);
    } finally {
      analyzing = false;
      wrap.classList.remove("busy");
      analyzeBtn.disabled = false;
    }
  };

  analyzeBtn.addEventListener("click", analyze);

  // ---------- right-click a photo -> result card ----------

  let toastRoot = null;
  const toast = (imageUrl) => {
    if (!toastRoot) {
      const host = h("div", { id: "second-look-toast" });
      host.style.cssText = "position:fixed;left:16px;bottom:16px;z-index:2147483647;";
      toastRoot = host.attachShadow({ mode: "open" });
      toastRoot.innerHTML = `<style>
        :host { all: initial; }
        .card { box-sizing:border-box; width:340px; display:grid; grid-template-columns:64px 1fr auto; gap:10px; padding:10px 12px;
          background:#fff; color:#1E2A38; border:1px solid #D8DEE6; border-radius:10px; box-shadow:0 6px 24px rgba(30,42,56,.25);
          font:13px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif; }
        @media (prefers-color-scheme: dark) { .card { background:#18212B; color:#E6EBF1; border-color:#2E3B49; } }
        img { width:64px; height:64px; object-fit:cover; border-radius:6px; background:#D8DEE6; }
        b { display:block; font-size:12px; margin-bottom:2px; }
        .err { color:#B42318; }
        button { background:none; border:0; font-size:16px; color:inherit; opacity:.6; cursor:pointer; align-self:start; }
      </style><div class="card"><img alt=""><div><b>Second Look photo check</b><span class="txt"></span></div><button aria-label="Close">×</button></div>`;
      toastRoot.querySelector("button").addEventListener("click", () => host.remove());
    }
    const host = toastRoot.host;
    if (!host.isConnected) document.documentElement.append(host);
    toastRoot.querySelector("img").src = imageUrl;
    const txt = toastRoot.querySelector(".txt");
    return (text, isErr = false) => {
      txt.textContent = text;
      txt.className = isErr ? "txt err" : "txt";
    };
  };

  const checkPhotoFromMenu = async (imageUrl) => {
    const say = toast(imageUrl);
    say("Looking at the photo…");
    try {
      const title = SL.pageType() === "item" ? SL.extractItem().title : "";
      say((await send("checkPhoto", { imageUrl, title })).trim());
    } catch (e) {
      say(e.message, true);
    }
  };

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "second-look-check-photo" && msg.imageUrl) checkPhotoFromMenu(msg.imageUrl);
  });

  // ---------- show only on results pages (FB is a single-page app) ----------

  let lastHref = "";
  window.addEventListener("second-look-toggle", toggleOpen); // toolbar icon, if you use it
  const sync = () => {
    if (location.href === lastHref) return;
    lastHref = location.href;
    const type = SL.pageType();
    const onResults = !!type;
    if (onResults && !host.isConnected) document.documentElement.append(host);
    if (!onResults && host.isConnected) host.remove();
    if (onResults) {
      scanBtn.hidden = type === "item";
      analyzeBtn.hidden = type !== "item";
      queryEl.value = SL.detectQuery();
      clearStickers();
      itemEl.replaceChildren();
      listEl.replaceChildren();
      marketEl.textContent = "";
      setCount(0);
      setStatus("");
    }
  };
  sync();
  setInterval(sync, 1000);
})();
