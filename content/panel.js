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
  host.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483646;";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>
    :host { all: initial; }
    * { box-sizing: border-box; }
    .panel { --ink:#1E2A38; --paper:#FFFFFF; --rule:#D8DEE6; --muted:#5B6776; --accent:#2B5A8A;
      font: 13px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: var(--ink);
      background: var(--paper); border: 1px solid var(--rule); border-radius: 10px; width: 360px;
      max-height: 72vh; display: flex; flex-direction: column; box-shadow: 0 6px 24px rgba(30,42,56,.18); }
    @media (prefers-color-scheme: dark) {
      .panel { --ink:#E6EBF1; --paper:#18212B; --rule:#2E3B49; --muted:#9AA7B5; --accent:#7FB0E0; }
    }
    .head { display:flex; align-items:center; justify-content:space-between; padding:10px 12px; border-bottom:1px solid var(--rule); }
    .head strong { font-size:14px; letter-spacing:.01em; }
    .icon-btn { background:none; border:0; color:var(--muted); font-size:16px; cursor:pointer; padding:2px 6px; border-radius:6px; }
    .controls { padding:10px 12px; display:grid; gap:8px; border-bottom:1px solid var(--rule); }
    label { color:var(--muted); font-size:12px; }
    input { width:100%; padding:6px 8px; border:1px solid var(--rule); border-radius:6px; background:transparent; color:var(--ink); font:inherit; }
    .scan { background:var(--accent); color:var(--paper); border:0; border-radius:6px; padding:8px; font:600 13px/1 system-ui, sans-serif; cursor:pointer; }
    .scan:disabled { opacity:.6; cursor:progress; }
    .status { color:var(--muted); font-size:12px; min-height:1em; }
    .status.err { color:#B42318; }
    .market { font-size:12px; }
    .list { overflow:auto; padding:4px 0; }
    .row { display:grid; grid-template-columns:44px 1fr; gap:10px; padding:10px 12px; border-bottom:1px solid var(--rule); }
    .row:last-child { border-bottom:0; }
    .tag { width:40px; height:40px; border-radius:8px 8px 8px 20px; color:#fff; display:grid; place-items:center;
      font:700 15px/1 system-ui, sans-serif; font-variant-numeric:tabular-nums; position:relative; }
    .tag::after { content:""; position:absolute; top:5px; left:5px; width:5px; height:5px; border-radius:50%; background:var(--paper); }
    .title { background:none; border:0; padding:0; color:var(--ink); font:600 13px/1.35 system-ui, sans-serif; text-align:left; cursor:pointer; }
    .title:hover { text-decoration:underline; }
    .meta { color:var(--muted); font-size:12px; margin-top:2px; }
    .reason { margin-top:4px; }
    .flags { display:flex; flex-wrap:wrap; gap:4px; margin-top:6px; }
    .flag { font-size:11px; padding:1px 6px; border:1px solid var(--rule); border-radius:999px; color:var(--muted); }
    .actions { display:flex; gap:10px; margin-top:6px; font-size:12px; }
    .actions a, .actions button { color:var(--accent); background:none; border:0; padding:0; font:inherit; cursor:pointer; text-decoration:none; }
    .photo { margin-top:6px; font-size:12px; color:var(--muted); border-left:2px solid var(--rule); padding-left:8px; }
    .collapsed .controls, .collapsed .list, .collapsed .itemout { display:none; }
    [hidden] { display:none !important; }
    .itemout { overflow:auto; }
    .sect { padding:8px 12px; border-top:1px solid var(--rule); font-size:12px; }
    .sect ol { margin:4px 0 0; padding-left:18px; }
    .sect li { margin:2px 0; }
    .offer { padding:8px 12px; border-top:1px solid var(--rule); font-size:13px; }
    .offer b { color:var(--accent); }
    button:focus-visible, input:focus-visible, a:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
  </style>
  <div class="panel">
    <div class="head"><strong>Second Look</strong><button class="icon-btn" data-act="toggle" aria-label="Collapse panel">–</button></div>
    <div class="controls">
      <div><label for="q">Compare prices against</label><input id="q" placeholder="e.g. Pentax K1000"></div>
      <button class="scan" data-act="scan">Scan this page</button>
      <button class="scan" data-act="analyze" hidden>Analyze this listing</button>
      <div class="market"></div>
      <div class="status" role="status"></div>
    </div>
    <div class="list"></div>
    <div class="itemout"></div>
  </div>`;

  const $ = (sel) => root.querySelector(sel);
  const panel = $(".panel");
  const statusEl = $(".status");
  const marketEl = $(".market");
  const listEl = $(".list");
  const queryEl = $("#q");
  const scanBtn = $('[data-act="scan"]');
  const analyzeBtn = $('[data-act="analyze"]');
  const itemEl = $(".itemout");

  const setStatus = (text, isErr = false) => {
    statusEl.textContent = text;
    statusEl.classList.toggle("err", isErr);
  };

  $('[data-act="toggle"]').addEventListener("click", (e) => {
    const collapsed = panel.classList.toggle("collapsed");
    e.currentTarget.textContent = collapsed ? "+" : "–";
    e.currentTarget.setAttribute("aria-label", collapsed ? "Expand panel" : "Collapse panel");
  });

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

  const clearStickers = () => {
    document.querySelectorAll("[data-second-look]").forEach((el) => {
      if (el.dataset.secondLookPos) el.style.position = "";
      el.removeAttribute("data-second-look");
      el.removeAttribute("data-second-look-pos");
    });
    document.querySelectorAll(".second-look-sticker").forEach((s) => s.remove());
  };

  const stick = (item) => {
    const el = item.el;
    if (!el?.isConnected) return;
    ensureStickerStyles();
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
      h("div", { class: "sl-text" }, h("div", { class: "sl-verdict" }, v.label), h("div", { class: "sl-sub" }, "Second Look score")),
      h(
        "div",
        { class: "sl-pop" },
        h("b", {}, `${item.score} out of 100: ${v.label}`),
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
          h("div", { class: "tag", style: `background:${v.color}`, "aria-label": `Score ${it.score}` }, String(it.score)),
          h(
            "div",
            {},
            h("button", { class: "title", onclick: () => focusCard(it) }, it.title),
            h("div", { class: "meta" }, `${v.label} · ${it.priceText || "no price"}${vsMarket}`),
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

  const getMarket = async (settings, query) => {
    if (!settings.useSoldComps || !query) return null;
    setStatus(`Checking recent eBay sales for "${query}"…`);
    let market = null;
    try {
      market = SL.summarizeSold(await send("fetchSoldHtml", { query }));
    } catch (e) {
      console.warn("[Second Look] sold comps failed:", e);
    }
    marketEl.textContent = market
      ? `eBay sold: median $${market.median}, middle half $${market.p25}–$${market.p75} (${market.n} sales)`
      : "Not enough eBay sales found to set a market price.";
    return market;
  };

  const scan = async () => {
    if (scanning) return;
    scanning = true;
    scanBtn.disabled = true;
    clearStickers();
    listEl.replaceChildren();
    marketEl.textContent = "";

    try {
      const settings = await send("getSettings");
      const items = SL.extract();
      if (!items.length) {
        setStatus("No listings found on this page. Scroll so results load, or the site layout may have changed (README: When it breaks).", true);
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
            flags: (r.flags || []).slice(0, 4),
            reason: r.reason,
          });
          stick(it);
        }
        render(items);
      }
      const missed = items.filter((it) => it.score == null).length;
      setStatus(`Ranked ${items.length - missed} of ${items.length} listings.${missed ? " The model skipped some; try a smaller batch size in settings." : ""}`);
    } catch (e) {
      setStatus(e.message, true);
    } finally {
      scanning = false;
      scanBtn.disabled = false;
    }
  };

  scanBtn.addEventListener("click", scan);

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
        h("div", { class: "tag", style: `background:${v.color}`, "aria-label": `Score ${score}` }, String(score)),
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
      setStatus("");
    } catch (e) {
      setStatus(e.message, true);
    } finally {
      analyzing = false;
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
      itemEl.replaceChildren();
      listEl.replaceChildren();
      marketEl.textContent = "";
      setStatus("");
    }
  };
  sync();
  setInterval(sync, 1000);
})();
