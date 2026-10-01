// Second Look — on-page panel and scan flow.
// Flow: extract listings -> (optional) get eBay sold prices -> rank in batches
// with the chosen model -> show ranked list + stickers on the cards themselves.

(() => {
  const SL = window.SecondLook;
  if (!SL || window.__secondLookPanel) return;
  window.__secondLookPanel = true;

  // c = main color, c2 = lighter end of the badge gradient
  const VERDICT = {
    great: { color: "#059B5F", c2: "#2BD98A", label: "Great deal" },
    good: { color: "#4E9A06", c2: "#9BDB2E", label: "Worth a look" },
    fair: { color: "#D97706", c2: "#FBBF24", label: "Market price" },
    pass: { color: "#5B6678", c2: "#94A3B8", label: "Skip" },
    suspicious: { color: "#DC2626", c2: "#FB7185", label: "Suspicious" },
  };

  // ---------- photo checks change the rating ----------
  const clamp100 = (n) => Math.max(0, Math.min(100, n));
  const RANK = { pass: 0, fair: 1, good: 2, great: 3 };
  const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `\u2212${-n}` : "\u00b10");

  // A photo can only pull a verdict down (or mark it suspicious), never talk it up.
  const adjustedVerdict = (base, score, photos) => {
    if (base === "suspicious") return base;
    if (photos.some((p) => p.matchesTitle === "no")) return "suspicious";
    const cap = score < 45 ? 0 : score < 60 ? 1 : score < 75 ? 2 : 3;
    const rank = Math.min(RANK[base] ?? 1, cap);
    return Object.keys(RANK).find((k) => RANK[k] === rank);
  };

  // obj is a scored listing (or the single-listing result): has score + verdict.
  const applyPhotos = (obj, photos) => {
    obj.baseScore ??= obj.score;
    obj.baseVerdict ??= obj.verdict;
    const adj = photos.map((p) => p.adjust || 0);
    const worst = Math.min(...adj);
    obj.photos = photos;
    obj.photoAdjust = worst < 0 ? worst : Math.max(...adj);
    obj.score = clamp100(obj.baseScore + obj.photoAdjust);
    obj.verdict = adjustedVerdict(obj.baseVerdict, obj.score, photos);
  };

  const photoText = (p, label = "") =>
    `${label}${p.summary}${p.concerns?.length ? ` Concerns: ${p.concerns.join(", ")}.` : ""}${
      p.adjust ? ` Rating ${signed(p.adjust)} (${p.why.join("; ")}).` : ""
    }`;

  // After the extension is reloaded or updated, this copy of the script is cut off from it.
  const alive = () => !!chrome.runtime?.id;
  const STALE = "Second Look was updated. Reload this page to keep using it.";

  const send = (type, payload) =>
    new Promise((resolve, reject) => {
      if (!alive()) return reject(new Error(STALE));
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
  host.style.cssText = "position:fixed;right:0;bottom:20px;z-index:2147483646;";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>
    :host { all: initial; }
    * { box-sizing: border-box; }
    .wrap { --w: min(392px, calc(100vw - 36px)); --gap: 18px; --ink:#141B2D; --paper:#FFFFFF; --soft:#F1F3FA; --rule:#E2E6F2; --muted:#5A6479;
      --accent:#5B3DF5; --accent2:#2D6BFF; --grad:linear-gradient(135deg,var(--accent),var(--accent2));
      font: 13px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: var(--ink); }
    @media (prefers-color-scheme: dark) {
      .wrap { --ink:#EDF0FA; --paper:#161B2B; --soft:#1F2640; --rule:#2B3454; --muted:#9BA5C2; --accent:#8B73FF; --accent2:#5B9BFF; }
    }

    /* bottom-right drawer: the tab hugs the edge, the panel springs out from it */
    .drawer { display:flex; align-items:flex-end; gap:0; transform:translateX(calc(var(--w) + var(--gap)));
      transition:transform .38s cubic-bezier(.22,.8,.3,1); }
    .open .drawer { transform:none; }
    .panel { visibility:hidden; transition:visibility 0s .4s; }
    .open .panel { visibility:visible; transition-delay:0s; }

    .tab { position:relative; flex:none; display:flex; flex-direction:column; align-items:center; gap:10px; width:40px; padding:16px 0 18px; margin-bottom:8px;
      background:var(--grad); color:#fff; border:0; border-radius:20px 0 0 20px; cursor:pointer; overflow:visible;
      box-shadow:-4px 6px 16px rgba(70,60,200,.4); transition:width .2s cubic-bezier(.22,.8,.3,1), filter .2s, opacity .2s; }
    .tab:hover { width:48px; filter:brightness(1.1); }
    .open .tab { width:0; padding:0; opacity:0; pointer-events:none; box-shadow:none; overflow:hidden; }
    .tab svg { width:20px; height:20px; }
    .tab span { writing-mode:vertical-rl; font:800 12px/1 system-ui,sans-serif; letter-spacing:.1em; text-transform:uppercase; }
    .count { position:absolute; top:-9px; left:-9px; min-width:22px; height:22px; padding:0 6px; border-radius:11px; background:#10B981; color:#fff;
      font:800 11px/22px system-ui,sans-serif; text-align:center; box-shadow:0 0 0 3px var(--paper); }
    .count.new { background:#F97316; }
    .open .count { display:none; }

    .panel { width:var(--w); max-height:calc(100vh - 56px); display:flex; flex-direction:column; overflow:hidden; margin-right:var(--gap);
      background:var(--paper); border-radius:22px; box-shadow:0 18px 50px rgba(20,27,45,.38), 0 0 0 1px var(--rule); }
    .head { display:flex; align-items:center; gap:11px; padding:14px 14px 14px 16px; background:var(--grad); color:#fff; }
    .logo { width:34px; height:34px; border-radius:12px; background:rgba(255,255,255,.22); display:grid; place-items:center; flex:none; }
    .logo svg { width:19px; height:19px; }
    .head strong { font-size:16px; letter-spacing:-.01em; }
    .head small { display:block; opacity:.85; font-size:11px; }
    .head .grow { flex:1; min-width:0; }
    .icon-btn { background:rgba(255,255,255,.18); border:0; color:#fff; font-size:20px; line-height:1; cursor:pointer; width:30px; height:30px; border-radius:50%; transition:background .15s, transform .2s; }
    .icon-btn:hover { background:rgba(255,255,255,.32); transform:translateX(2px); }

    .controls { padding:14px 16px; display:grid; gap:11px; }
    label { color:var(--muted); font-size:11px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; }
    input { width:100%; margin-top:5px; padding:10px 13px; border:2px solid transparent; border-radius:13px; background:var(--soft); color:var(--ink); font:inherit; transition:border-color .15s, background .15s; }
    input:focus { outline:none; border-color:var(--accent); background:var(--paper); }
    .scan { background:var(--grad); color:#fff; border:0; border-radius:999px; padding:13px; font:800 14px/1 system-ui, sans-serif; cursor:pointer;
      box-shadow:0 6px 18px rgba(80,70,230,.45); transition:transform .15s cubic-bezier(.22,.8,.3,1), filter .15s, box-shadow .15s; }
    .scan:hover:not(:disabled) { transform:translateY(-2px); filter:brightness(1.08); box-shadow:0 10px 24px rgba(80,70,230,.5); }
    .scan:active:not(:disabled) { transform:translateY(0); }
    .scan:disabled { opacity:.7; cursor:progress; box-shadow:none; }
    .status { color:var(--muted); font-size:12px; min-height:1em; }
    .status.err { color:#fff; background:#DC2626; padding:8px 11px; border-radius:12px; }
    .busy .status:not(.err):not(:empty)::before { content:""; display:inline-block; width:12px; height:12px; margin-right:8px; vertical-align:-2px;
      border:2.5px solid var(--rule); border-top-color:var(--accent); border-radius:50%; animation:spin .7s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
    .lens { display:grid; grid-template-columns:repeat(3,1fr); gap:4px; padding:4px; background:var(--soft); border-radius:999px; }
    .lens button { border:0; background:none; color:var(--muted); font:800 13px/1 system-ui,sans-serif; padding:9px 0; border-radius:999px; cursor:pointer; transition:background .15s, color .15s; }
    .lens button[aria-checked="true"] { background:var(--grad); color:#fff; }
    .lens-hint { color:var(--muted); font-size:12px; margin-top:6px; }
    .comps { margin-top:6px; font-weight:400; }
    .comps summary { cursor:pointer; color:var(--accent); font-weight:700; }
    .comps ul { margin:6px 0 0; padding-left:16px; }
    .comps li { margin:3px 0; }
    .comps a { color:var(--ink); }
    .comps b { display:block; margin-top:6px; }
    .lensinfo { margin-top:4px; font-size:12px; font-weight:700; color:var(--accent); }
    .lensinfo.neg { color:#DC2626; }
    .market { font-size:12px; font-weight:600; }
    .market:not(:empty) { background:var(--soft); padding:9px 12px; border-radius:12px; }

    .body { flex:1; min-height:0; overflow-y:auto; scrollbar-gutter:stable; }
    .list, .itemout { padding:2px 12px 12px; }
    .list:empty, .itemout:empty { display:none; padding:0; }
    .body::-webkit-scrollbar { width:12px; }
    .body::-webkit-scrollbar-track { background:transparent; margin:6px 0; }
    .body::-webkit-scrollbar-thumb { background:var(--rule); border-radius:999px; border:3px solid transparent; background-clip:padding-box; }
    .body::-webkit-scrollbar-thumb:hover { background:var(--muted); background-clip:padding-box; border:3px solid transparent; }
    .body::-webkit-scrollbar-button { display:none; height:0; }
    .row { display:grid; grid-template-columns:56px 1fr; gap:13px; padding:13px; margin-top:8px; background:var(--soft); border-radius:18px;
      animation:rise .45s cubic-bezier(.2,.9,.3,1) both; animation-delay:calc(var(--i, 0) * 45ms); transition:transform .2s cubic-bezier(.22,.8,.3,1), box-shadow .2s; }
    .row.still { animation:none; }
    .list .row:hover { transform:translateY(-2px); box-shadow:0 8px 20px rgba(20,27,45,.14); }
    @keyframes rise { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
    .tag { --p:50; --c:#666; width:54px; height:54px; border-radius:50%; position:relative; display:grid; place-items:center;
      background:conic-gradient(var(--c) calc(var(--p) * 1%), var(--rule) 0); }
    .tag::before { content:""; position:absolute; inset:5px; border-radius:50%; background:var(--paper); }
    .tag span { position:relative; font:900 17px/1 system-ui,sans-serif; color:var(--c); font-variant-numeric:tabular-nums; }
    .title { background:none; border:0; padding:0; color:var(--ink); font:800 13px/1.35 system-ui, sans-serif; text-align:left; cursor:pointer; }
    button.title:hover { color:var(--accent); }
    .meta { color:var(--muted); font-size:12px; margin-top:2px; }
    .reason { margin-top:6px; }
    .flags { display:flex; flex-wrap:wrap; gap:5px; margin-top:8px; }
    .flag { font-size:11px; font-weight:600; padding:3px 9px; background:var(--paper); border-radius:999px; color:var(--muted); }
    .actions { display:flex; gap:14px; margin-top:9px; font-size:12px; font-weight:700; }
    .actions a, .actions button { color:var(--accent); background:none; border:0; padding:0; font:inherit; cursor:pointer; text-decoration:none; }
    .actions a:hover, .actions button:hover:not(:disabled) { text-decoration:underline; }
    .photo { margin-top:8px; font-size:12px; color:var(--ink); background:var(--paper); border-radius:12px; padding:9px 11px; border-left:4px solid var(--accent); }
    .photo.drop { border-left-color:#DC2626; }
    [hidden] { display:none !important; }

    .ideas { margin:0 12px 4px; background:var(--soft); border-radius:18px; }
    .ideas > summary { list-style:none; cursor:pointer; padding:12px 14px; font-weight:800; font-size:13px; display:flex; align-items:center; gap:8px; }
    .ideas > summary::-webkit-details-marker { display:none; }
    .ideas > summary::after { content:""; margin:0 4px 0 auto; width:7px; height:7px; border-right:2px solid var(--muted); border-bottom:2px solid var(--muted);
      transform:rotate(-45deg); transition:transform .2s; }
    .ideas[open] > summary::after { transform:rotate(45deg); }
    .ideas-body { padding:0 14px 14px; display:grid; gap:10px; }
    .ideas-body .hint { color:var(--muted); font-size:12px; }
    .ideas-body input { margin-top:0; background:var(--paper); }
    .ghost { background:var(--paper); color:var(--accent); border:2px solid var(--accent); border-radius:999px; padding:9px; font:800 13px/1 system-ui,sans-serif; cursor:pointer; transition:background .15s, color .15s; }
    .ghost:hover:not(:disabled) { background:var(--accent); color:#fff; }
    .ghost:disabled { opacity:.6; cursor:progress; }
    .idea { display:block; padding:11px 12px; background:var(--paper); border-radius:14px; color:var(--ink); text-decoration:none; border:2px solid transparent;
      animation:rise .35s cubic-bezier(.2,.9,.3,1) both; animation-delay:calc(var(--i, 0) * 40ms); transition:border-color .15s, transform .15s; }
    .idea:hover { border-color:var(--accent); transform:translateY(-1px); }
    .idea .q { font-weight:800; font-size:13px; word-break:break-word; }
    .idea .why { color:var(--muted); font-size:12px; margin-top:2px; }
    .idea .chips { display:flex; flex-wrap:wrap; gap:5px; margin-top:7px; }
    .kind { font-size:10px; font-weight:800; letter-spacing:.05em; text-transform:uppercase; padding:2px 8px; border-radius:999px; color:#fff; background:var(--accent); }
    .kind.k-narrow { background:#0E9F6E; } .kind.k-broaden { background:#2563EB; } .kind.k-typo { background:#D97706; }
    .kind.k-alt { background:#7C3AED; } .kind.k-price { background:#DC2626; }
    .chip { font-size:11px; font-weight:700; padding:2px 8px; border-radius:999px; background:var(--soft); color:var(--muted); }
    .sect { margin-top:8px; padding:12px 13px; background:var(--soft); border-radius:18px; font-size:12px; }
    .sect ol { margin:6px 0 0; padding-left:18px; }
    .sect li { margin:3px 0; }
    .offer { margin-top:8px; padding:12px 14px; background:var(--grad); color:#fff; border-radius:18px; font-size:13px; font-weight:600; }
    .offer b { font-size:16px; }
    .adjust { margin-top:6px; font-size:12px; font-weight:700; color:#DC2626; }
    .adjust.up { color:#059B5F; }
    button:focus-visible, input:focus-visible, a:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
    @media (prefers-reduced-motion: reduce) { .drawer, .tab, .scan, .row, .count, .busy .status::before { transition:none; animation:none; } }
  </style>
  <div class="wrap">
   <div class="drawer">
    <button class="tab" data-act="tab" aria-label="Open Second Look" title="Second Look">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/></svg>
      <span>Second Look</span><i class="count" hidden></i>
    </button>
    <div class="panel">
      <div class="head">
        <div class="logo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/></svg></div>
        <div class="grow"><strong>Second Look</strong><small>Spot the deals worth opening</small></div>
        <button class="icon-btn" data-act="toggle" aria-label="Tuck panel away">›</button>
      </div>
      <div class="body">
      <div class="controls">
        <div class="lenswrap">
          <div class="lens" role="radiogroup" aria-label="What it's for">
            <button role="radio" data-lens="use">Use</button><button role="radio" data-lens="fix">Fix</button><button role="radio" data-lens="flip">Flip</button>
          </div>
          <div class="hint lens-hint"></div>
        </div>
        <div><label for="want">What I want</label><input id="want" placeholder="e.g. working, with charger, under $150"></div>
        <div class="qwrap"><label for="q">Compare prices against</label><input id="q" placeholder="e.g. Pentax K1000"></div>
        <button class="scan" data-act="scan">Scan this page</button>
        <button class="scan" data-act="analyze" hidden>Analyze this listing</button>
        <div class="market"></div>
        <div class="status" role="status"></div>
        <div class="actions"><button data-act="reset" hidden>Start over</button></div>
      </div>
      <details class="ideas">
        <summary>Search ideas</summary>
        <div class="ideas-body">
          <div class="hint ideas-hint">Uses "What I want" above, or the results you're looking at if that's blank.</div>
          <button class="ghost" data-act="ideas">Get ideas</button>
          <div class="status ideas-status" role="status"></div>
          <div class="ideas-list"></div>
        </div>
      </details>
      <div class="list"></div>
      <div class="itemout"></div>
      </div>
    </div>
   </div>
  </div>`;

  const $ = (sel) => root.querySelector(sel);
  const wrap = $(".wrap");
  const countEl = $(".count");
  const statusEl = $(".status");
  const marketEl = $(".market");
  const listEl = $(".list");
  const queryEl = $("#q");
  const scanBtn = $('[data-act="scan"]');
  const analyzeBtn = $('[data-act="analyze"]');
  const resetBtn = $('[data-act="reset"]');
  const ideasBox = $(".ideas");
  const ideasBtn = $('[data-act="ideas"]');
  const ideasList = $(".ideas-list");
  const ideasStatus = $(".ideas-status");
  const wantEl = $("#want");
  const lensHint = $(".lens-hint");
  const qwrap = $(".qwrap");
  const itemEl = $(".itemout");

  const setStatus = (text, isErr = false) => {
    statusEl.textContent = text;
    statusEl.classList.toggle("err", isErr);
  };

  // Open/closed: the tab is always there; the panel slides out when you pull the tab.
  let touched = false; // the user (or the toolbar icon) has opened/closed it on this page
  const showOpen = (open) => {
    wrap.classList.toggle("open", open);
    $('[data-act="tab"]').setAttribute("aria-label", open ? "Tuck Second Look away" : "Open Second Look");
  };
  const setOpen = (open) => {
    touched = true;
    showOpen(open);
    if (alive()) chrome.storage.local.set({ panelOpen: open }).catch(() => {});
  };
  const toggleOpen = () => setOpen(!wrap.classList.contains("open"));
  $('[data-act="tab"]').addEventListener("click", toggleOpen);
  $('[data-act="toggle"]').addEventListener("click", () => setOpen(false));
  // Restore last time's state, unless a click got in first (the toolbar icon injects and toggles at once).
  chrome.storage.local.get({ panelOpen: false }).then(({ panelOpen }) => touched || showOpen(!!panelOpen));

  // ---------- lens: what you want the listing for ----------

  const LENS = {
    use: { name: "Use", hint: "Working items at a good price." },
    fix: { name: "Fix", hint: "Broken or untested items with a likely easy fix." },
    flip: { name: "Flip", hint: "Biggest margin after eBay fees and likely repairs." },
  };
  let lens = "use";
  const showLens = () => {
    root.querySelectorAll("[data-lens]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.lens === lens)));
    lensHint.textContent = LENS[lens].hint;
  };
  const setLens = (next) => {
    if (next === lens || !LENS[next]) return;
    lens = next;
    showLens();
    if (alive()) chrome.storage.local.set({ lens }).catch(() => {});
    // Scores mean something different under another lens, so start the page over.
    const had = scored.size || itemEl.childElementCount;
    clearStickers();
    listEl.replaceChildren();
    itemEl.replaceChildren();
    setCount(0);
    if (had) setStatus(`Switched to ${LENS[lens].name}. Scan again to judge these listings for that (anything already judged this way comes back free).`);
    refreshPending();
  };
  root.querySelectorAll("[data-lens]").forEach((b) => b.addEventListener("click", () => setLens(b.dataset.lens)));
  wantEl.addEventListener("change", () => alive() && chrome.storage.local.set({ want: wantEl.value.trim() }).catch(() => {}));
  chrome.storage.local.get({ lens: "use", want: "" }).then((v) => {
    lens = LENS[v.lens] ? v.lens : "use";
    if (!wantEl.value) wantEl.value = v.want;
    showLens();
  });
  showLens();

  const money = (n) => `${n < 0 ? "\u2212" : ""}$${Math.abs(Math.round(n))}`;
  const fmtCost = (usd) => (usd < 0.01 ? "<$0.01" : `$${usd.toFixed(2)}`);
  const DIFFICULTY = ["Fix: can't tell", "Easy fix", "Fairly easy fix", "Moderate fix", "Hard fix", "Very hard fix"];

  // The one-line lens summary for a scored listing: what the sticker and list show under the verdict.
  const lensLine = (it) => {
    if (it.related === false) return "Not your search";
    if (it.lens === "fix") {
      if (/^none$/i.test(it.fault || "")) return "Works as-is";
      return `${DIFFICULTY[it.difficulty] || DIFFICULTY[0]}${it.partsCost > 0 ? ` · ~$${it.partsCost} parts` : ""}`;
    }
    if (it.lens === "flip") return it.margin != null ? `\u2248 ${money(it.margin)} margin` : "Margin unknown";
    return "Second Look score";
  };

  const priceStr = (it) =>
    it.total == null ? it.priceText || "no price" : `$${it.total}${it.shipping > 0 ? ` incl. $${it.shipping} shipping` : ""}`;

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
      .second-look-sticker { position:absolute; top:10px; left:10px; z-index:50; display:flex; align-items:center;
        padding:3px 14px 3px 3px; background:linear-gradient(135deg,var(--sl-c),var(--sl-c2)); color:#fff; border-radius:999px;
        box-shadow:0 0 0 2.5px #fff, 0 6px 16px rgba(0,0,0,.38); cursor:help;
        font:600 13px/1.15 system-ui,-apple-system,"Segoe UI",sans-serif; animation:sl-pop .25s ease-out both;
      }
      @keyframes sl-pop { from { opacity:0; } to { opacity:1; } }
      .second-look-sticker .sl-score { background:#fff; color:var(--sl-c); font-weight:900; font-size:20px;
        width:44px; height:44px; border-radius:50%; display:grid; place-items:center; font-variant-numeric:tabular-nums; }
      .second-look-sticker .sl-text { display:flex; flex-direction:column; padding-left:10px; }
      .second-look-sticker .sl-verdict { font-weight:900; font-size:15px; white-space:nowrap; text-shadow:0 1px 2px rgba(0,0,0,.25); }
      .second-look-sticker .sl-sub { font-size:9.5px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; opacity:.95; white-space:nowrap; }
      .second-look-sticker .sl-chip { position:absolute; left:16px; top:100%; margin-top:-3px; display:flex; align-items:center; gap:4px;
        padding:3px 9px; border-radius:999px; background:#141B2D; box-shadow:0 0 0 2px #fff; font-weight:800; font-size:11px; }
      .second-look-sticker .sl-chip svg { width:12px; height:12px; }
      .second-look-sticker .sl-pop { display:none; position:absolute; top:100%; left:0; margin-top:10px; padding-top:12px; width:250px;
        background:#fff; color:#141B2D; border-radius:16px; padding:12px 14px; font:400 12px/1.45 system-ui,sans-serif;
        box-shadow:0 12px 30px rgba(0,0,0,.35); white-space:normal; text-shadow:none; }
      .second-look-sticker:hover .sl-pop { display:block; }
      .second-look-sticker.has-chip .sl-pop { margin-top:28px; }
      .second-look-sticker .sl-pop b { display:block; margin-bottom:4px; font-size:13px; }
      .second-look-sticker .sl-flags { margin-top:6px; color:#5A6479; }`;
    document.head.append(st);
  };

  // Facebook recycles card elements as you scroll, which drops our stickers. Remember each
  // scored listing by its URL and put the sticker back when its card reappears.
  let scored = new Map(); // key -> scored item
  let seen = new Set(); // keys already sent for scoring (or being scored), so a re-scan only does what's new
  const keyOf = SL.keyOf;
  const ITEM_LINK = 'a[href*="/marketplace/item/"]';
  const reapplyFacebook = () => {
    if (!scored.size || SL.currentSite() !== "facebook") return;
    document.querySelectorAll(ITEM_LINK).forEach((a) => {
      const key = keyOf(a.href);
      // Cheap check first (no layout reads): is this card still wearing the right sticker?
      const tagged = a.closest("[data-second-look]");
      if (tagged?.dataset.secondLookKey === key && tagged.querySelector(":scope > .second-look-sticker")) return;
      const item = scored.get(key);
      if (item) {
        item.el = a;
        stick(item);
      } else if (tagged && (tagged === a || tagged.querySelectorAll(ITEM_LINK).length === 1)) {
        unstick(tagged); // a recycled card that now shows a listing we haven't scored
      }
    });
  };

  const unstick = (el) => {
    if (el.dataset.secondLookPos) el.style.position = "";
    el.removeAttribute("data-second-look");
    el.removeAttribute("data-second-look-key");
    el.removeAttribute("data-second-look-pos");
    el.querySelector(":scope > .second-look-sticker")?.remove();
  };

  const clearStickers = () => {
    scored = new Map();
    seen = new Set();
    document.querySelectorAll("[data-second-look]").forEach(unstick);
    document.querySelectorAll(".second-look-sticker").forEach((s) => s.remove());
  };

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
    el.setAttribute("data-second-look-key", keyOf(item.url));
    if (getComputedStyle(el).position === "static") {
      el.style.position = "relative";
      el.setAttribute("data-second-look-pos", "1");
    }
    el.querySelector(":scope > .second-look-sticker")?.remove();
    const CAMERA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';
    let chip = null;
    if (item.photoAdjust) {
      chip = h("div", { class: "sl-chip", title: "Photo check" }, signed(item.photoAdjust));
      chip.insertAdjacentHTML("afterbegin", CAMERA); // static markup, no page text involved
    }
    const s = h(
      "div",
      { class: `second-look-sticker${chip ? " has-chip" : ""}`, style: `--sl-c:${v.color};--sl-c2:${v.c2}` },
      h("div", { class: "sl-score" }, String(item.score)),
      h("div", { class: "sl-text" }, h("div", { class: "sl-verdict" }, v.label), h("div", { class: "sl-sub" }, lensLine(item))),
      chip,
      h(
        "div",
        { class: "sl-pop" },
        h("b", {}, `${item.score} out of 100: ${v.label}`),
        item.related === false ? h("div", { class: "sl-flags" }, "Not what you searched for, scored on the deal alone.") : null,
        item.reason || "",
        item.fault && !/^none$/i.test(item.fault) ? h("div", { class: "sl-flags" }, `Likely fault: ${item.fault}${item.difficulty ? ` (difficulty ${item.difficulty}/5)` : ""}`) : null,
        item.photoAdjust ? h("div", { class: "sl-flags" }, `Photo check ${signed(item.photoAdjust)}: ${(item.photos || []).flatMap((p) => p.why).join("; ") || "see panel"}`) : null,
        item.flags?.length ? h("div", { class: "sl-flags" }, item.flags.join(" · ")) : null
      )
    );
    el.append(s);
  };

  // ---------- results list ----------

  const photoBox = (it) => {
    const box = h("div");
    (it.photos || []).forEach((p) => box.append(h("div", { class: p.adjust < 0 ? "photo drop" : "photo" }, photoText(p))));
    return box;
  };

  const render = (items) => {
    listEl.replaceChildren();
    [...items]
      .filter((it) => it.score != null)
      .sort((a, b) => b.score - a.score)
      .forEach((it, i) => {
        const v = VERDICT[it.verdict] || VERDICT.fair;
        const box = photoBox(it);
        const vsMarket = it.vsWorking != null ? ` · ${Math.round(it.vsWorking * 100)}% of sold median` : "";
        const line = lensLine(it);
        // Only rows appearing for the first time animate in; re-sorting shouldn't replay it for all.
        const row = h(
          "div",
          { class: it.shown ? "row still" : "row", style: `--i:${Math.min(i, 8)}` },
          h("div", { class: "tag", style: `--c:${v.color};--p:${it.score}`, "aria-label": `Score ${it.score}` }, h("span", {}, String(it.score))),
          h(
            "div",
            {},
            h("button", { class: "title", onclick: () => focusCard(it) }, it.title),
            h("div", { class: "meta" }, `${v.label}${it.related === false ? " (not your search)" : ""} · ${priceStr(it)}${it.related === false ? "" : vsMarket}`),
            it.lens !== "use" && it.related !== false ? h("div", { class: it.margin < 0 ? "lensinfo neg" : "lensinfo" }, line + (it.fault && !/^none|unknown$/i.test(it.fault) ? ` · ${it.fault}` : "")) : null,
            h("div", { class: "reason" }, it.reason || ""),
            it.flags?.length ? h("div", { class: "flags" }, it.flags.map((f) => h("span", { class: "flag" }, f))) : null,
            h(
              "div",
              { class: "actions" },
              h("a", { href: it.url, target: "_blank", rel: "noopener" }, "Open listing"),
              it.imageUrl ? h("button", { onclick: (e) => runPhotoCheck(it, box, e.currentTarget) }, it.photos ? "Re-check photo" : "Check photo") : null
            ),
            box
          )
        );
        it.shown = true;
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
      applyPhotos(it, [await send("checkPhoto", { imageUrl: SL.bigImage(it.imageUrl), title: it.title })]);
      stick(it);
      render([...scored.values()]); // the score may have changed, so the order may too
    } catch (e) {
      box.replaceChildren(h("div", { class: "photo drop" }, e.message));
      btn.disabled = false;
    }
  };

  // ---------- scan ----------

  let scanning = false;

  // On eBay the sold-listings search is made from the eBay page itself (same site, your cookies,
  // normal browser headers), like any request eBay's own pages make. From Facebook it has to go
  // through the background script. Either way the answer (just the summary, not the page) is
  // remembered for a few hours across pages, and lookups pause for 30 minutes if eBay pushes back.
  const SOLD_TTL_MS = 6 * 60 * 60 * 1000;
  const COOLDOWN_MS = 30 * 60 * 1000;
  const blockedPage = (html) =>
    /captcha|pardon our interruption|verify yourself|security measure/i.test(html.slice(0, 20000)) && !/s-card|s-item/.test(html);

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let lastSoldFetch = 0;
  const fetchSoldHtml = async (query, condition) => {
    // Space out back-to-back lookups (working + for-parts) so it reads like a person clicking.
    const wait = lastSoldFetch + 1200 - Date.now();
    if (wait > 0) await sleep(wait);
    lastSoldFetch = Date.now();
    const url = SL.soldUrl(query, SL.SOLD_CONDITION[condition]);
    if (location.hostname !== "www.ebay.com") return send("fetchSoldHtml", { url });
    const res = await fetch(url, { credentials: "include", signal: AbortSignal.timeout(30000) });
    return { status: res.status, html: res.ok ? await res.text() : "" };
  };

  // Resolves to a market summary, or null when there were too few sales to trust.
  const soldMarket = async (query, condition = "any") => {
    const key = `${condition}:${query.trim().toLowerCase()}`;
    const { soldCache = {}, soldCooldownUntil = 0 } = await chrome.storage.local.get(["soldCache", "soldCooldownUntil"]);
    const hit = soldCache[key];
    if (hit && Date.now() - hit.at < SOLD_TTL_MS) return hit.market;
    if (Date.now() < soldCooldownUntil) {
      throw new Error(`Price lookups paused for ${Math.ceil((soldCooldownUntil - Date.now()) / 60000)} more min because eBay pushed back.`);
    }
    const pause = async (why) => {
      await chrome.storage.local.set({ soldCooldownUntil: Date.now() + COOLDOWN_MS });
      throw new Error(`${why} Paused price lookups for 30 minutes.`);
    };
    const { status, html } = await fetchSoldHtml(query, condition);
    if (status === 403 || status === 429 || status === 503) return pause(`eBay answered ${status}.`);
    if (!html) throw new Error(`eBay sold search failed (${status}).`);
    if (blockedPage(html)) return pause("eBay showed a verification page.");
    const market = SL.summarizeSold(html);
    // Keep the cache small: drop expired entries, cap at 100 searches.
    const fresh = Object.entries(soldCache).filter(([, v]) => Date.now() - v.at < SOLD_TTL_MS).slice(-99);
    await chrome.storage.local.set({ soldCache: Object.fromEntries([...fresh, [key, { at: Date.now(), market }]]) });
    return market;
  };

  const summaryLine = (label, m) => `${label}: median $${m.median}, middle half $${m.p25}\u2013$${m.p75} (${m.n} sales)`;
  const renderMarket = (market) => {
    if (!market) return marketEl.replaceChildren("Not enough eBay sales found to set a market price.");
    const groups = [
      market.median != null && ["Working / used", market.samples],
      market.parts && ["For parts", market.parts.samples],
    ].filter((g) => g && g[1]?.length);
    marketEl.replaceChildren(
      market.median != null ? h("div", {}, summaryLine(`eBay sold${market.condition === "used" ? " (used)" : ""}`, market)) : null,
      market.parts ? h("div", {}, summaryLine("For parts", market.parts)) : null,
      groups.length
        ? h(
            "details",
            { class: "comps" },
            h("summary", {}, "See the sales"),
            groups.flatMap(([label, list]) => [
              h("b", {}, label),
              h("ul", {}, list.map((x) => h("li", {}, h("a", { href: x.url, target: "_blank", rel: "noopener" }, `$${x.total} \u00b7 ${x.title}`)))),
            ])
          )
        : null
    );
  };

  // Working price from used sales (falling back to any condition when there are too few);
  // for Fix and Flip also what broken ones sell for, the floor you can always resell at.
  let lastMarket = null;
  const getMarket = async (settings, query, forLens) => {
    if (!settings.useSoldComps || !query) return null;
    setStatus(`Checking recent eBay sales for "${query}"…`);
    let market = null;
    try {
      const used = await soldMarket(query, "used");
      const working = used ? { ...used, condition: "used" } : await soldMarket(query, "any");
      const parts = forLens !== "use" ? await soldMarket(query, "parts") : null;
      market = working || parts ? { ...(working || { median: null }), parts } : null;
    } catch (e) {
      console.warn("[Second Look] sold comps failed:", e);
      marketEl.textContent = e.message;
      return null;
    }
    renderMarket(market);
    lastMarket = market;
    return market;
  };

  // How each listing's total compares with the sold prices; for Flip, the margin before repairs.
  const priceNotes = (it, market, forLens, feePct) => {
    const w = market?.median;
    const pm = market?.parts?.median;
    it.vsWorking = it.total != null && w > 0 ? it.total / w : null;
    it.vsParts = forLens !== "use" && it.total != null && pm > 0 ? it.total / pm : null;
    it.marginBeforeRepair = forLens === "flip" && it.total != null && w > 0 ? Math.round(w * (1 - feePct / 100) - 0.4 - it.total) : null;
  };

  // ---------- remembered scores ----------
  // A listing judged under the same lens, wants, search and prices isn't sent to the model again for a day.
  const SCORE_TTL_MS = 24 * 60 * 60 * 1000;
  const hash = (str) => {
    let x = 5381;
    for (let i = 0; i < str.length; i++) x = ((x << 5) + x + str.charCodeAt(i)) | 0;
    return (x >>> 0).toString(36);
  };
  const scoreKey = (ctx, it) => `${ctx}|${keyOf(it.url)}|${it.total ?? it.priceText}`;

  const applyResult = (it, r, forLens) => {
    Object.assign(it, {
      lens: forLens,
      score: clamp100(r.score | 0),
      verdict: VERDICT[r.verdict] ? r.verdict : "fair",
      related: r.related !== false,
      flags: (r.flags || []).slice(0, 4),
      reason: r.reason,
      fault: r.fault || "",
      difficulty: Math.max(0, Math.min(5, r.difficulty | 0)),
      partsCost: Math.max(0, r.partsCost | 0),
    });
    it.margin = it.marginBeforeRepair != null && it.related ? it.marginBeforeRepair - it.partsCost : null;
    if (it.vsParts != null && it.vsParts <= 1 && it.related && !it.flags.includes("under parts value")) it.flags.unshift("under parts value");
    it.baseScore = it.score;
    it.baseVerdict = it.verdict;
  };

  // ---------- listings that loaded after the last scan ----------

  const currentKeys = () => {
    const sel = SL.currentSite() === "facebook" ? ITEM_LINK : 'li.s-card a[href*="/itm/"], li.s-item a[href*="/itm/"]';
    const keys = new Set();
    document.querySelectorAll(sel).forEach((a) => keys.add(keyOf(a.href)));
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

  // Run fn over the batches with at most `limit` in flight; one failed batch doesn't stop the rest.
  const runBatches = async (batches, limit, fn) => {
    const errors = [];
    let next = 0;
    const worker = async () => {
      while (next < batches.length) {
        const batch = batches[next++];
        try {
          await fn(batch);
        } catch (e) {
          errors.push(e);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(limit, batches.length) }, worker));
    return errors;
  };

  const scan = async () => {
    if (scanning) return;
    scanning = true;
    wrap.classList.add("busy");
    scanBtn.disabled = true;

    try {
      const settings = await send("getSettings");
      // Only listings we haven't scored yet: scrolling loads more, and a re-scan adds just those.
      // Cards the adapter skips (ads, "Shop on eBay") count as seen so they don't show as new.
      const skipped = currentKeys();
      const items = SL.extract().filter((it) => !seen.has(keyOf(it.url)));
      items.forEach((it) => skipped.delete(keyOf(it.url)));
      skipped.forEach((k) => seen.add(k));
      if (!items.length) {
        setStatus(
          scored.size
            ? "Nothing new since your last scan. Scroll down to load more listings."
            : "No listings found on this page. Scroll so results load, or the site layout may have changed (README: When it breaks).",
          !scored.size
        );
        return;
      }
      items.forEach((it) => seen.add(keyOf(it.url)));

      const query = queryEl.value.trim();
      const want = wantEl.value.trim();
      const forLens = lens;
      const market = await getMarket(settings, query, forLens);
      items.forEach((it) => priceNotes(it, market, forLens, settings.feePct));

      // Anything already judged in this exact setting comes back from memory, free.
      const model = settings.provider === "anthropic" ? settings.anthropicModel : settings.textModel;
      const ctx = hash([forLens, want, query, model, market?.median, market?.parts?.median].join("|"));
      const { scoreCache = {} } = await chrome.storage.local.get("scoreCache");
      const fresh = {};
      let fromMemory = 0;
      for (const it of items) {
        const hit = scoreCache[scoreKey(ctx, it)];
        if (hit && Date.now() - hit.at < SCORE_TTL_MS) {
          applyResult(it, hit.r, forLens);
          stick(it);
          scored.set(keyOf(it.url), it);
          fromMemory++;
        }
      }
      if (fromMemory) render([...scored.values()]);
      const toRank = items.filter((it) => it.score == null);
      let cost = 0;

      const size = Math.max(1, settings.batchSize | 0);
      const batches = [];
      for (let i = 0; i < toRank.length; i += size) batches.push(toRank.slice(i, i + size));
      // The Claude API handles a few requests at once; a local Ollama model is fastest one at a time.
      const parallel = settings.provider === "anthropic" ? 3 : 1;
      let done = fromMemory;
      const session = scored; // if you navigate away mid-scan, late answers belong to the old page
      setStatus(`Ranking ${items.length} listing${items.length > 1 ? "s" : ""} with ${model}…`);
      const errors = await runBatches(batches, parallel, async (batch) => {
        const payload = batch.map(({ el, ...rest }) => rest); // DOM nodes can't be sent
        const res = await send("rankBatch", { items: payload, query, market, lens: forLens, want });
        cost += res.cost || 0;
        if (scored !== session) return;
        const byId = new Map(batch.map((it) => [it.id, it]));
        for (const r of res.items) {
          const it = byId.get(r.id);
          if (!it) continue;
          applyResult(it, r, forLens);
          fresh[scoreKey(ctx, it)] = { at: Date.now(), r };
          stick(it);
          scored.set(keyOf(it.url), it);
        }
        done += batch.length;
        render([...scored.values()]);
        if (done < items.length) setStatus(`Ranked ${done} of ${items.length} listings with ${model}…`);
      });

      if (Object.keys(fresh).length) {
        // Keep the memory bounded: drop expired entries, keep the newest 1500.
        const kept = Object.entries(scoreCache).filter(([, v]) => Date.now() - v.at < SCORE_TTL_MS).slice(-(1500 - Object.keys(fresh).length));
        await chrome.storage.local.set({ scoreCache: Object.fromEntries([...kept, ...Object.entries(fresh)]) });
      }
      if (scored !== session) return; // you've moved on to another page
      // Anything not scored (failed batch, or the model skipped it) is offered again next scan.
      const missed = items.filter((it) => it.score == null);
      missed.forEach((it) => seen.delete(keyOf(it.url)));
      setCount(scored.size);
      if (errors.length && missed.length === items.length) throw errors[0];
      const { spend } = await chrome.storage.local.get("spend");
      const costNote =
        settings.provider === "anthropic" && toRank.length ? ` Cost ~${fmtCost(cost)}${spend ? `, this month ~${fmtCost(spend.usd)}` : ""}.` : "";
      setStatus(
        `Ranked ${items.length - missed.length} of ${items.length} new listings${fromMemory ? ` (${fromMemory} from memory)` : ""}.${costNote}` +
          (errors.length ? ` Some requests failed (${errors[0].message}) Scan again to retry the rest.` : "") +
          (!errors.length && missed.length ? " The model skipped some; scan again, or try a smaller batch size in settings." : ""),
        errors.length > 0
      );
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
    const score = clamp100(r.score | 0);
    const vs =
      (listing.vsWorking != null ? ` · ${Math.round(listing.vsWorking * 100)}% of sold median` : "") +
      (listing.vsParts != null ? ` · ${Math.round(listing.vsParts * 100)}% of for-parts median` : "");
    const rep = r.repair;
    const margin = listing.marginBeforeRepair != null ? listing.marginBeforeRepair - (rep?.partsCost || 0) : null;
    const questions = (r.questions || []).slice(0, 6);
    const photoBox = h("div");
    (r.photos || []).forEach((p, i) => photoBox.append(h("div", { class: p.adjust < 0 ? "photo drop" : "photo" }, photoText(p, `Photo ${i + 1}: `))));
    const parts = [
      h(
        "div",
        { class: "row" },
        h("div", { class: "tag", style: `--c:${v.color};--p:${score}`, "aria-label": `Score ${score}` }, h("span", {}, String(score))),
        h(
          "div",
          {},
          h("div", { class: "title" }, `${v.label} (${score}/100)`),
          h("div", { class: "meta" }, `${priceStr(listing)}${vs}`),
          h("div", { class: "reason" }, r.summary || ""),
          r.photoAdjust ? h("div", { class: r.photoAdjust < 0 ? "adjust" : "adjust up" }, `Photo check ${signed(r.photoAdjust)} (was ${r.baseScore})`) : null,
          r.flags?.length ? h("div", { class: "flags" }, r.flags.slice(0, 5).map((f) => h("span", { class: "flag" }, f))) : null
        )
      ),
    ];
    if (r.offerHigh > 0) {
      parts.push(h("div", { class: "offer" }, "Suggested offer: ", h("b", {}, `$${r.offerLow}–$${r.offerHigh}`)));
    }
    if (margin != null) {
      parts.push(
        h("div", { class: "offer" }, "Flip margin: ", h("b", {}, `\u2248 ${money(margin)}`), ` after eBay fees${rep?.partsCost ? ` and ~$${rep.partsCost} parts` : ""}, at the sold median.`)
      );
    }
    if (rep && (rep.faults?.length || rep.notes)) {
      const kv = (label, list) => (list?.length ? h("div", {}, h("strong", {}, `${label}: `), list.join(", ")) : null);
      parts.push(
        h(
          "div",
          { class: "sect" },
          h("strong", {}, `${DIFFICULTY[rep.difficulty] || DIFFICULTY[0]}${rep.difficulty ? ` (${rep.difficulty}/5)` : ""}${rep.partsCost ? ` · ~$${rep.partsCost} parts` : ""}`),
          rep.faults?.length ? h("ol", {}, rep.faults.slice(0, 4).map((f) => h("li", {}, f))) : null,
          kv("Parts", rep.parts),
          kv("Tools", rep.tools),
          rep.notes ? h("div", { class: "meta" }, rep.notes) : null
        )
      );
    }
    if (r.homebrew) parts.push(h("div", { class: "sect" }, h("strong", {}, "Homebrew: "), r.homebrew));
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
      const n = Math.min(3, listing.imageUrls.length);
      const btn = h("button", { onclick: () => checkPhotos(listing, r, market, photoBox, btn) }, `${r.photos ? "Re-check" : "Check"} ${n} photo${n > 1 ? "s" : ""} (adjusts the score)`);
      parts.push(h("div", { class: "sect" }, h("div", { class: "actions" }, btn), photoBox));
    }
    itemEl.replaceChildren(...parts);
  };

  const checkPhotos = async (listing, r, market, box, btn) => {
    btn.disabled = true;
    box.replaceChildren();
    const photos = [];
    for (const [i, url] of listing.imageUrls.slice(0, 3).entries()) {
      const line = h("div", { class: "photo" }, `Photo ${i + 1}: looking…`);
      box.append(line);
      try {
        const p = await send("checkPhoto", { imageUrl: url, title: listing.title });
        photos.push(p);
        line.textContent = photoText(p, `Photo ${i + 1}: `);
      } catch (e) {
        line.textContent = `Photo ${i + 1}: ${e.message}`;
        line.classList.add("drop");
      }
    }
    if (photos.length) {
      applyPhotos(r, photos);
      renderItem(listing, r, market); // redraw with the adjusted score
    } else btn.disabled = false;
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
      const forLens = lens;
      const market = await getMarket(settings, query, forLens);
      priceNotes(listing, market, forLens, settings.feePct);
      setStatus(`Analyzing this listing for ${LENS[forLens].name.toLowerCase()}…`);
      const r = await send("analyzeListing", { listing, query, market, lens: forLens, want: wantEl.value.trim() });
      renderItem(listing, r, market);
      setCount(1);
      setStatus(settings.provider === "anthropic" && r.cost ? `Cost ~${fmtCost(r.cost)}.` : "");
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
      const p = await send("checkPhoto", { imageUrl: SL.bigImage(imageUrl), title });
      // If this photo belongs to a listing we've scored, the check counts toward its rating.
      const big = SL.bigImage(imageUrl);
      const hit = [...scored.values()].find((it) => it.imageUrl && SL.bigImage(it.imageUrl) === big);
      if (hit) {
        applyPhotos(hit, [p]);
        stick(hit);
        render([...scored.values()]);
      }
      say(photoText(p) + (hit ? " Applied to this listing's score." : ""));
    } catch (e) {
      say(e.message, true);
    }
  };

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "second-look-check-photo" && msg.imageUrl) checkPhotoFromMenu(msg.imageUrl);
  });

  // ---------- search ideas ----------

  const KIND = { idea: "Idea", narrow: "Narrow", broaden: "Broaden", typo: "Misspelling", alt: "Alt name", price: "Price cap" };

  const getIdeas = async () => {
    ideasBtn.disabled = true;
    wrap.classList.add("busy");
    ideasList.replaceChildren();
    ideasStatus.classList.remove("err");
    ideasStatus.textContent = "Thinking up searches…";
    try {
      // Titles from what you've scored, else whatever is on the page right now.
      let titles = [...scored.values()].map((it) => it.title);
      if (!titles.length && SL.pageType() === "results") titles = SL.extract().map((it) => it.title);
      const ideas = await send("suggestSearches", {
        site: SL.currentSite(),
        query: queryEl.value.trim(),
        intent: wantEl.value.trim(),
        lens,
        titles: titles.slice(0, 30),
        market: lastMarket,
      });
      if (!ideas.length) throw new Error("No ideas this time. Try describing what you want.");
      ideas.slice(0, 6).forEach((idea, i) => {
        const chips = [];
        if (idea.maxPrice > 0) chips.push(h("span", { class: "chip" }, `up to $${idea.maxPrice}`));
        if (idea.newest) chips.push(h("span", { class: "chip" }, "newest first"));
        // A real link: click to search here, ctrl/middle-click to open it in a new tab.
        ideasList.append(
          h(
            "a",
            { class: "idea", href: SL.searchUrl(idea), style: `--i:${i}` },
            h("div", {}, h("span", { class: `kind k-${idea.kind}` }, KIND[idea.kind] || "Idea")),
            h("div", { class: "q" }, idea.query),
            h("div", { class: "why" }, idea.why),
            chips.length ? h("div", { class: "chips" }, chips) : null
          )
        );
      });
      ideasStatus.textContent = "";
    } catch (e) {
      ideasStatus.classList.add("err");
      ideasStatus.textContent = e.message;
    } finally {
      ideasBtn.disabled = false;
      wrap.classList.remove("busy");
    }
  };
  ideasBtn.addEventListener("click", getIdeas);
  wantEl.addEventListener("keydown", (e) => e.key === "Enter" && ideasBox.open && getIdeas());

  // ---------- show only on results pages (FB is a single-page app) ----------

  // Facebook changes the address without reloading when you open a listing and come back.
  // Keep each results page's scan so Back brings it back instead of starting over.
  const stash = new Map(); // results href -> saved scan
  const saveScan = (href) => {
    if (!scored.size) return;
    stash.delete(href);
    stash.set(href, { scored, seen, lastMarket, lens, query: queryEl.value, market: [...marketEl.childNodes] });
    if (stash.size > 5) stash.delete(stash.keys().next().value);
  };
  const restoreScan = (href) => {
    const saved = stash.get(href);
    if (!saved || saved.lens !== lens) return false;
    ({ scored, seen, lastMarket } = saved);
    queryEl.value = saved.query;
    marketEl.replaceChildren(...saved.market);
    render([...scored.values()]);
    setCount(scored.size);
    return true;
  };

  let lastHref = "";
  let lastType = null;
  window.addEventListener("second-look-toggle", toggleOpen); // toolbar icon, if you use it
  const sync = () => {
    if (location.href === lastHref) return;
    if (lastType === "results") saveScan(lastHref);
    lastHref = location.href;
    const type = (lastType = SL.pageType());
    const onResults = !!type;
    if (onResults && !host.isConnected) document.documentElement.append(host);
    if (!onResults && host.isConnected) host.remove();
    if (onResults) {
      scanBtn.hidden = type !== "results";
      analyzeBtn.hidden = type !== "item";
      qwrap.hidden = type === "home";
      ideasBox.open = type === "home"; // on the home page, ideas are the whole point
      ideasList.replaceChildren();
      ideasStatus.textContent = "";
      lastMarket = null;
      clearStickers();
      itemEl.replaceChildren();
      listEl.replaceChildren();
      marketEl.textContent = "";
      setCount(0);
      setStatus("");
      if (type !== "results" || !restoreScan(lastHref)) queryEl.value = SL.detectQuery();
    }
  };

  // One timer for everything that has to notice page changes: navigation, newly loaded
  // listings, and Facebook dropping our stickers when it recycles cards.
  let ticks = 0;
  const tick = () => {
    if (!alive()) return teardown();
    sync();
    if (document.hidden) return;
    reapplyFacebook();
    if (++ticks % 2 === 0) refreshPending();
  };
  const timer = setInterval(tick, 1000);
  // After an update this copy can't reach the extension any more: get out of the way so the new one can load.
  const teardown = () => {
    clearInterval(timer);
    host.remove();
    toastRoot?.host.remove();
    window.removeEventListener("second-look-toggle", toggleOpen);
    window.__secondLookPanel = false;
  };
  sync();
})();
