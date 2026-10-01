// Second Look — on-page panel and scan flow.
// Flow: extract listings -> (optional) get eBay sold prices -> rank in batches
// with the chosen model -> show ranked list + stickers on the cards themselves.

(() => {
  const SL = window.SecondLook;
  if (!SL || window.__secondLookPanel) return;
  window.__secondLookPanel = true;

  // Verdict colours come from the theme (--v-great etc.), keyed by data-v.
  const VERDICT = {
    great: { label: "Great deal" },
    good: { label: "Worth a look" },
    fair: { label: "Market price" },
    pass: { label: "Skip" },
    suspicious: { label: "Suspicious" },
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
  // The host's box covers the whole drawer area even when the panel is tucked away, so it must not
  // take clicks itself: only the tab and the open panel do (see .tab / .open .panel below).
  host.style.cssText = "position:fixed;right:0;bottom:20px;z-index:2147483646;pointer-events:none;";
  const root = host.attachShadow({ mode: "open" });
  // The mark: a loupe with a vermilion dot. Retro swaps in a pixel-drawn version of the same thing.
  const MARK = `<svg class="m-vec" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="10" cy="10" r="6.5"/><path d="M14.8 14.8 20.5 20.5"/><circle class="dot" cx="10" cy="10" r="2" stroke="none"/></svg><svg class="m-px" viewBox="0 0 12 12" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="M2 0h4v1H2zM1 1h1v1H1zM6 1h1v1H6zM0 2h1v4H0zM7 2h1v4H7zM1 6h1v1H1zM6 6h1v1H6zM2 7h4v1H2zM7 7h1v1H7zM8 7h1v2H8zM9 9h1v1H9zM9 8h1v1H9zM10 9h1v2h-1zM11 10h1v2h-1z"/><path class="dot" d="M3 3h2v2H3z"/></svg>`;

  // Colour, type and shape for both looks. Shared by the panel and the photo-check card.
  const THEME_CSS = `
    /* ---------- tokens: classic (paper and ink) ---------- */
    .wrap {
      --w: min(380px, calc(100vw - 32px)); --gap: 16px;
      --paper:#FBFAF7; --paper-2:#F2EFE9; --ink:#1C1B19; --on-ink:#FBFAF7; --muted:#6B675F; --rule:#E3DED5; --accent:#C8461F;
      --v-great:#2F7D4F; --v-good:#5E7D2A; --v-fair:#A86A12; --v-pass:#8A857C; --v-suspicious:#B3261E;
      --r:14px; --r-sm:8px; --bw:1px; --press:none;
      --shadow:0 1px 2px rgba(28,27,25,.06), 0 18px 44px -14px rgba(28,27,25,.32);
      --ui:system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", Cantarell, sans-serif;
      --display:"SL Fraunces", "Iowan Old Style", "Palatino Linotype", Georgia, serif;
      font:13px/1.5 var(--ui); color:var(--ink); -webkit-font-smoothing:antialiased;
    }
    @media (prefers-color-scheme: dark) {
      .wrap:not([data-theme="retro"]) {
        --paper:#1D1C1A; --paper-2:#272522; --ink:#EEEAE2; --on-ink:#1D1C1A; --muted:#A39E94; --rule:#37342F; --accent:#E2673C;
        --v-great:#62B788; --v-good:#A3BE62; --v-fair:#DDA552; --v-pass:#A39E94; --v-suspicious:#EF7A6E;
        --shadow:0 0 0 1px rgba(255,255,255,.03), 0 18px 44px -12px rgba(0,0,0,.7);
      }
    }
    /* ---------- tokens: retro (pocket LCD) ---------- */
    .wrap[data-theme="retro"] {
      --paper:#CDD6A5; --paper-2:#BDC894; --ink:#1F3A1F; --on-ink:#CDD6A5; --muted:#41613A; --rule:#1F3A1F; --accent:#8E1D50;
      --v-great:#1F3A1F; --v-good:#3E6A2B; --v-fair:#6E5E0E; --v-pass:#5E6A4E; --v-suspicious:#8E1D50;
      --r:3px; --r-sm:2px; --bw:2px; --press:3px 3px 0 var(--muted);
      --shadow:6px 6px 0 rgba(31,58,31,.9);
      --ui:"SL Mono", "IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace;
      --display:"SL Mono", ui-monospace, monospace; /* numbers and small labels: the pixel font blurs 5/8 and C/O when small */
      --pixel:"SL Pixel", "SL Mono", ui-monospace, monospace; /* wordmark and tab only */
      font-size:12px;
    }
    @media (prefers-color-scheme: dark) {
      .wrap[data-theme="retro"] {
        --paper:#132613; --paper-2:#1A321A; --ink:#A9C84B; --on-ink:#132613; --muted:#7F9C3B; --rule:#A9C84B; --accent:#E36FA4;
        --v-great:#BCDA5C; --v-good:#93B347; --v-fair:#DCC45C; --v-pass:#7F9C3B; --v-suspicious:#E36FA4;
        --press:3px 3px 0 #050D05; --shadow:6px 6px 0 #050D05;
      }
    }

`;

  root.innerHTML = `<style>
    :host { all: initial; }
    * { box-sizing: border-box; }

    ${THEME_CSS}
    /* ---------- drawer: tab on the edge, panel slides out ---------- */
    .wrap, .drawer { pointer-events:none; }
    .drawer { display:flex; align-items:flex-end; transform:translateX(calc(var(--w) + var(--gap))); transition:transform .32s cubic-bezier(.2,.7,.2,1); }
    .open .drawer { transform:none; }
    .panel { visibility:hidden; pointer-events:none; transition:visibility 0s .35s; }
    .open .panel { visibility:visible; pointer-events:auto; transition-delay:0s; }

    .tab { position:relative; flex:none; display:flex; flex-direction:column; align-items:center; gap:12px; width:34px; padding:14px 0 16px; margin-bottom:12px;
      background:var(--paper); color:var(--ink); border:var(--bw) solid var(--rule); border-right:0; border-radius:var(--r) 0 0 var(--r);
      box-shadow:var(--shadow); cursor:pointer; pointer-events:auto; transition:width .18s ease; }
    .tab:hover { width:40px; }
    .open .tab { width:0; padding:0; border:0; opacity:0; pointer-events:none; box-shadow:none; overflow:hidden; }
    .tab .mark { width:18px; height:18px; }
    .tab .tab-label { writing-mode:vertical-rl; font:500 14px/1 var(--display); letter-spacing:.01em; }
    .count { position:absolute; top:-9px; left:-9px; min-width:20px; height:20px; padding:0 6px; border-radius:10px; background:var(--ink); color:var(--on-ink);
      font:600 11px/20px var(--ui); font-style:normal; text-align:center; font-variant-numeric:tabular-nums; }
    .count.new { background:var(--accent); color:#fff; }
    .open .count { display:none; }

    /* ---------- panel ---------- */
    .panel { width:var(--w); max-height:calc(100vh - 48px); display:flex; flex-direction:column; overflow:hidden; margin-right:var(--gap);
      background:var(--paper); border:var(--bw) solid var(--rule); border-radius:var(--r); box-shadow:var(--shadow); }
    .head { display:flex; align-items:center; gap:10px; padding:14px 12px 12px 16px; border-bottom:var(--bw) solid var(--rule); }
    .mark { flex:none; width:22px; height:22px; display:grid; color:var(--ink); }
    .mark svg { width:100%; height:100%; }
    .mark .dot { fill:var(--accent); }
    .m-px { display:none; }
    .grow { flex:1; min-width:0; }
    .wordmark { font:600 19px/1.1 var(--display); letter-spacing:-.01em; }
    .wordmark em { font-style:italic; font-weight:400; }
    .head small { display:block; color:var(--muted); font-size:11.5px; margin-top:2px; }
    .icon-btn { flex:none; width:30px; height:30px; display:grid; place-items:center; border:0; border-radius:var(--r-sm); background:none; color:var(--muted); cursor:pointer; }
    .icon-btn svg { width:16px; height:16px; }
    .icon-btn:hover { background:var(--paper-2); color:var(--ink); }

    .body { flex:1; min-height:0; overflow-y:auto; scrollbar-width:thin; scrollbar-color:var(--rule) transparent; }
    .controls { padding:14px 16px 12px; display:grid; grid-template-columns:minmax(0, 1fr); gap:12px; }
    label { display:block; margin-bottom:6px; color:var(--muted); font:600 10.5px/1 var(--ui); letter-spacing:.08em; text-transform:uppercase; }
    input { width:100%; padding:9px 11px; border:var(--bw) solid var(--rule); border-radius:var(--r-sm); background:var(--paper); color:var(--ink); font:inherit; transition:border-color .15s; }
    input::placeholder { color:var(--muted); opacity:.7; }
    input:focus { outline:none; border-color:var(--ink); }

    .lens { display:grid; grid-template-columns:repeat(3,1fr); gap:2px; padding:2px; border:var(--bw) solid var(--rule); border-radius:var(--r-sm); }
    .lens button { border:0; border-radius:calc(var(--r-sm) - 2px); background:none; color:var(--muted); font:600 12.5px/1 var(--ui); padding:8px 0; cursor:pointer; transition:background .15s, color .15s; }
    .lens button:hover { color:var(--ink); }
    .lens button[aria-checked="true"] { background:var(--ink); color:var(--on-ink); }
    .hint { color:var(--muted); font-size:12px; }
    .lens-hint { margin-top:6px; }

    .scan { background:var(--ink); color:var(--on-ink); border:var(--bw) solid var(--ink); border-radius:var(--r-sm); padding:11px; font:600 13.5px/1 var(--ui);
      box-shadow:var(--press); cursor:pointer; transition:opacity .15s, transform .08s, box-shadow .08s; }
    .scan:hover:not(:disabled) { opacity:.88; }
    .scan:disabled { opacity:.55; cursor:progress; }
    .status { color:var(--muted); font-size:12px; }
    .status:empty { display:none; }
    .status.err { color:var(--v-suspicious); border-left:2px solid currentColor; padding-left:10px; }
    .busy .status:not(.err):not(:empty)::before { content:""; display:inline-block; width:10px; height:10px; margin-right:8px; vertical-align:-1px;
      border:1.5px solid var(--rule); border-top-color:var(--ink); border-radius:50%; animation:spin .8s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
    .actions { display:flex; gap:16px; font-size:12px; font-weight:600; }
    .controls > .actions:not(:has(:not([hidden]))) { display:none; }
    .actions a, .actions button { color:var(--ink); background:none; border:0; padding:0; font:inherit; cursor:pointer;
      text-decoration:underline; text-decoration-color:var(--rule); text-underline-offset:3px; text-decoration-thickness:1px; }
    .actions a:hover, .actions button:hover:not(:disabled) { text-decoration-color:currentColor; }

    /* sold prices */
    .market { font-size:12px; }
    .market:not(:empty) { background:var(--paper-2); padding:11px 12px; border-radius:var(--r-sm); }
    .mgrid { display:grid; grid-template-columns:repeat(auto-fit, minmax(0,1fr)); gap:12px; }
    .mlabel { color:var(--muted); font-size:11px; }
    .mval { display:block; font:600 22px/1.15 var(--display); font-variant-numeric:lining-nums; margin:2px 0 1px; }
    .msub { color:var(--muted); font-size:11px; }
    .comps { margin-top:8px; }
    .comps summary { cursor:pointer; color:var(--ink); font-weight:600; font-size:12px; list-style:none; }
    .comps summary::-webkit-details-marker { display:none; }
    .comps summary::before { content:"+ "; color:var(--muted); }
    .comps[open] summary::before { content:"\\2212  "; }
    .comps b { display:block; margin:8px 0 2px; color:var(--muted); font-size:10.5px; letter-spacing:.08em; text-transform:uppercase; }
    .comps ul { list-style:none; margin:0; padding:0; }
    .comps li a { display:flex; gap:10px; padding:3px 0; color:var(--ink); text-decoration:none; }
    .comps li a:hover .ct { text-decoration:underline; }
    .comps .cp { flex:none; width:44px; font-weight:600; font-variant-numeric:tabular-nums; }
    .comps .ct { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--muted); }

    /* results */
    .list, .itemout { padding:0 16px 12px; }
    .list:empty, .itemout:empty { display:none; }
    .row { display:grid; grid-template-columns:44px 1fr; gap:12px; padding:14px 0; border-top:var(--bw) solid var(--rule); animation:fade .25s ease both; }
    .row.still { animation:none; }
    .itemout > .row:first-child { border-top:0; }
    @keyframes fade { from { opacity:0; } to { opacity:1; } }
    .tag { --p:50; --c:var(--v-fair); width:44px; height:44px; border-radius:50%; position:relative; display:grid; place-items:center;
      background:conic-gradient(var(--c) calc(var(--p) * 1%), var(--rule) 0); }
    .tag::before { content:""; position:absolute; inset:2px; border-radius:50%; background:var(--paper); }
    .tag span { position:relative; font:600 17px/1 var(--display); color:var(--c); font-variant-numeric:lining-nums tabular-nums; }
    [data-v="great"] { --c:var(--v-great); } [data-v="good"] { --c:var(--v-good); } [data-v="fair"] { --c:var(--v-fair); }
    [data-v="pass"] { --c:var(--v-pass); } [data-v="suspicious"] { --c:var(--v-suspicious); }
    .title { display:block; background:none; border:0; padding:0; color:var(--ink); font:600 13.5px/1.35 var(--ui); text-align:left; cursor:pointer; }
    button.title:hover { text-decoration:underline; text-decoration-thickness:1px; text-underline-offset:3px; }
    .verdict { color:var(--c); font-weight:600; }
    .meta { color:var(--muted); font-size:12px; margin-top:3px; }
    .lensinfo { margin-top:4px; font-size:12px; font-weight:600; }
    .lensinfo.neg { color:var(--v-suspicious); }
    .reason { margin-top:6px; }
    .flags { display:flex; flex-wrap:wrap; gap:4px; margin-top:8px; }
    .flag { font-size:11px; padding:1px 8px; border:1px solid var(--rule); border-radius:999px; color:var(--muted); }
    .row .actions { margin-top:8px; }
    .photo { margin-top:8px; font-size:12px; padding:8px 10px; background:var(--paper-2); border-left:2px solid var(--ink); border-radius:0 var(--r-sm) var(--r-sm) 0; }
    .photo.drop { border-left-color:var(--v-suspicious); }
    [hidden] { display:none !important; }

    /* search ideas */
    .ideas { margin:0 16px 14px; border:var(--bw) solid var(--rule); border-radius:var(--r-sm); }
    .ideas > summary { list-style:none; cursor:pointer; padding:11px 12px; font-weight:600; display:flex; align-items:center; gap:8px; }
    .ideas > summary::-webkit-details-marker { display:none; }
    .ideas > summary::after { content:""; margin:0 4px 0 auto; width:6px; height:6px; border-right:1.5px solid var(--muted); border-bottom:1.5px solid var(--muted);
      transform:rotate(45deg); transition:transform .2s; }
    .ideas[open] > summary::after { transform:rotate(-135deg); }
    .ideas-body { padding:0 12px 12px; display:grid; gap:10px; }
    .ghost { background:none; color:var(--ink); border:var(--bw) solid var(--ink); border-radius:var(--r-sm); padding:9px; font:600 13px/1 var(--ui); cursor:pointer; transition:background .15s, color .15s; }
    .ghost:hover:not(:disabled) { background:var(--ink); color:var(--on-ink); }
    .ghost:disabled { opacity:.55; cursor:progress; }
    .ideas-list:empty { display:none; }
    .idea { display:block; padding:10px 0; border-top:1px solid var(--rule); color:var(--ink); text-decoration:none; animation:fade .25s ease both; }
    .idea:hover .q { text-decoration:underline; text-decoration-thickness:1px; text-underline-offset:3px; }
    .kind { color:var(--muted); font-size:10.5px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; }
    .idea .q { font:500 15px/1.3 var(--display); margin-top:2px; word-break:break-word; }
    .idea .why { color:var(--muted); font-size:12px; margin-top:2px; }
    .idea .chips { display:flex; flex-wrap:wrap; gap:4px; margin-top:6px; }
    .chip { font-size:11px; padding:1px 7px; border:1px solid var(--rule); border-radius:999px; color:var(--muted); }

    /* one listing */
    .sect { margin-top:12px; padding-top:12px; border-top:var(--bw) solid var(--rule); font-size:12.5px; }
    .sect > strong:first-child { display:block; margin-bottom:4px; }
    .sect ol { margin:4px 0 6px; padding-left:18px; }
    .sect li { margin:2px 0; }
    .sect .actions { margin-top:8px; }
    .offer { margin-top:12px; padding:11px 12px; background:var(--paper-2); border-radius:var(--r-sm); font-size:12.5px; }
    .offer b { font:600 19px/1 var(--display); font-variant-numeric:lining-nums; margin:0 2px; }
    .adjust { margin-top:6px; font-size:12px; font-weight:600; color:var(--v-suspicious); }
    .adjust.up { color:var(--v-great); }

    button:focus-visible, input:focus-visible, a:focus-visible, summary:focus-visible { outline:2px solid var(--ink); outline-offset:2px; }

    /* ---------- retro: same layout, pocket-LCD finish ---------- */
    [data-theme="retro"] .m-vec { display:none; }
    [data-theme="retro"] .m-px { display:block; }
    [data-theme="retro"] .panel, [data-theme="retro"] .tab { border-color:var(--ink); }
    [data-theme="retro"] .head { background:var(--ink); color:var(--on-ink); border-bottom:0; }
    [data-theme="retro"] .head .mark, [data-theme="retro"] .icon-btn { color:var(--on-ink); }
    [data-theme="retro"] .head small { color:var(--on-ink); opacity:.75; }
    [data-theme="retro"] .icon-btn:hover { background:none; opacity:.7; }
    [data-theme="retro"] .wordmark { font:600 18px/1 var(--pixel); letter-spacing:.06em; text-transform:uppercase; }
    [data-theme="retro"] .wordmark em { font-style:normal; font-weight:600; }
    [data-theme="retro"] .tab .tab-label { font:600 14px/1 var(--pixel); letter-spacing:.1em; text-transform:uppercase; }
    [data-theme="retro"] .count { border-radius:var(--r-sm); }
    [data-theme="retro"] .lens { padding:0; gap:0; }
    [data-theme="retro"] .lens button { border-radius:0; font:600 12px/1 var(--display); text-transform:uppercase; letter-spacing:.08em; padding:9px 0; }
    [data-theme="retro"] .lens button + button { border-left:var(--bw) solid var(--rule); }
    [data-theme="retro"] .scan, [data-theme="retro"] .ghost { font:600 12.5px/1 var(--display); letter-spacing:.1em; text-transform:uppercase; }
    [data-theme="retro"] .ghost { box-shadow:var(--press); }
    [data-theme="retro"] .scan:active:not(:disabled), [data-theme="retro"] .ghost:active:not(:disabled) { transform:translate(3px,3px); box-shadow:none; }
    [data-theme="retro"] input { background:var(--paper-2); }
    [data-theme="retro"] .market:not(:empty), [data-theme="retro"] .offer { background:var(--paper-2); border:var(--bw) solid var(--ink); }
    [data-theme="retro"] .mval { font-size:20px; }
    [data-theme="retro"] .row { border-top-style:dashed; }
    [data-theme="retro"] .tag { border-radius:var(--r-sm); border:var(--bw) solid var(--c);
      background:linear-gradient(to top, color-mix(in srgb, var(--c) 22%, transparent) calc(var(--p) * 1%), transparent 0); }
    [data-theme="retro"] .tag::before { display:none; }
    [data-theme="retro"] .tag span { font-size:16px; }
    [data-theme="retro"] .flag, [data-theme="retro"] .chip { border-radius:0; border-color:var(--muted); }
    [data-theme="retro"] .idea .q { font:600 13px/1.35 var(--display); }
    [data-theme="retro"] .ideas > summary { font:600 12px/1 var(--display); letter-spacing:.1em; text-transform:uppercase; }
    [data-theme="retro"] .busy .status:not(.err):not(:empty)::before { content:"\\25AE"; width:auto; height:auto; border:0; margin-right:6px; vertical-align:0; animation:blink 1s steps(1) infinite; }
    @keyframes blink { 50% { opacity:0; } }

    @media (prefers-reduced-motion: reduce) { .drawer, .tab, .row, .idea, .busy .status::before { transition:none !important; animation:none !important; } }
  </style>
  <div class="wrap">
   <div class="drawer">
    <button class="tab" data-act="tab" aria-label="Open Second Look" title="Second Look">
      <span class="mark">${MARK}</span>
      <span class="tab-label">Second Look</span><i class="count" hidden></i>
    </button>
    <div class="panel">
      <div class="head">
        <span class="mark">${MARK}</span>
        <div class="grow"><div class="wordmark">Second <em>Look</em></div><small>for careful buyers</small></div>
        <button class="icon-btn" data-act="toggle" aria-label="Tuck panel away"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5 10.5 8 6 12.5"/></svg></button>
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
  const panel = $(".panel");
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

  // ---------- look: classic or retro ----------
  // Fonts ship inside the extension and are added with the FontFace API from bytes the background
  // hands over: no web-accessible files (pages can't spot the extension) and no site font rules apply.
  const FONTS = {
    classic: [
      ["SL Fraunces", "fraunces-400.woff2", { weight: "400" }],
      ["SL Fraunces", "fraunces-400-italic.woff2", { weight: "400", style: "italic" }],
      ["SL Fraunces", "fraunces-600.woff2", { weight: "600" }],
    ],
    retro: [
      ["SL Pixel", "pixelify-400.woff2", { weight: "400" }],
      ["SL Pixel", "pixelify-600.woff2", { weight: "600" }],
      ["SL Mono", "plex-mono-400.woff2", { weight: "400" }],
      ["SL Mono", "plex-mono-600.woff2", { weight: "600" }],
    ],
  };
  const fontsLoaded = new Set();
  const loadFonts = async (look) => {
    // Classic numerals appear on retro stickers' fallbacks too, so classic always loads.
    for (const set of new Set(["classic", look])) {
      if (fontsLoaded.has(set) || !FONTS[set]) continue;
      fontsLoaded.add(set);
      for (const [family, file, desc] of FONTS[set]) {
        try {
          const b64 = await send("getFont", { file });
          const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
          document.fonts.add(await new FontFace(family, bytes.buffer, desc).load());
        } catch (e) {
          console.warn("[Second Look] font", file, e.message);
        }
      }
    }
  };

  let theme = "classic";
  const setTheme = (next) => {
    theme = next === "retro" ? "retro" : "classic";
    wrap.dataset.theme = theme;
    loadFonts(theme);
    scored.forEach((it) => stick(it)); // re-dress any stickers already on the page
  };
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.theme && alive()) setTheme(changes.theme.newValue);
  });

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
  chrome.storage.local.get({ lens: "use", want: "", theme: "classic" }).then((v) => {
    lens = LENS[v.lens] ? v.lens : "use";
    if (!wantEl.value) wantEl.value = v.want;
    showLens();
    setTheme(v.theme);
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
    return it.vsWorking != null ? `${Math.round(it.vsWorking * 100)}% of sold price` : "";
  };

  const dollars = (n) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
  const priceStr = (it) =>
    it.total == null ? it.priceText || "no price" : `${dollars(it.total)}${it.shipping > 0 ? ` incl. ${dollars(it.shipping)} shipping` : ""}`;

  const setCount = (n) => {
    countEl.textContent = String(n);
    countEl.hidden = !n;
  };

  // ---------- stickers on the listing cards ----------

  // The sticker lives in the page, so its CSS is injected into the page once.
  // Stickers live in the page, so their CSS goes into the page once. They read as a small paper tag
  // (or an LCD tag in retro) whatever the site's own colours are.
  const ensureStickerStyles = () => {
    if (document.getElementById("second-look-styles")) return;
    const st = document.createElement("style");
    st.id = "second-look-styles";
    st.textContent = `
      .second-look-sticker { --sl-paper:#FBFAF7; --sl-ink:#1C1B19; --sl-muted:#6B675F; --sl-rule:rgba(28,27,25,.14);
        --v-great:#2F7D4F; --v-good:#5E7D2A; --v-fair:#A86A12; --v-pass:#8A857C; --v-suspicious:#B3261E; --c:var(--v-fair);
        position:absolute; top:10px; left:10px; z-index:50; display:flex; align-items:center; gap:9px; padding:4px 12px 4px 4px; max-width:calc(100% - 20px);
        background:var(--sl-paper); color:var(--sl-ink); border-radius:10px; box-shadow:0 0 0 1px var(--sl-rule), 0 6px 18px -6px rgba(28,27,25,.38);
        font:500 12px/1.2 system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans",sans-serif; text-align:left; letter-spacing:normal; cursor:help;
        animation:sl-in .2s ease-out both; }
      @keyframes sl-in { from { opacity:0; } to { opacity:1; } }
      .second-look-sticker[data-v="great"] { --c:var(--v-great); } .second-look-sticker[data-v="good"] { --c:var(--v-good); }
      .second-look-sticker[data-v="pass"] { --c:var(--v-pass); } .second-look-sticker[data-v="suspicious"] { --c:var(--v-suspicious); }
      .second-look-sticker .sl-score { flex:none; width:36px; height:36px; border-radius:7px; background:var(--c); color:#fff; display:grid; place-items:center;
        font:600 18px/1 "SL Fraunces","Iowan Old Style",Georgia,serif; font-variant-numeric:lining-nums tabular-nums; }
      .second-look-sticker .sl-text { display:flex; flex-direction:column; gap:2px; min-width:0; }
      .second-look-sticker .sl-verdict { font-weight:650; font-size:13px; white-space:nowrap; }
      .second-look-sticker .sl-sub { font-size:11px; color:var(--sl-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .second-look-sticker .sl-chip { position:absolute; left:6px; top:100%; margin-top:5px; display:flex; align-items:center; gap:3px; padding:2px 7px;
        border-radius:999px; background:var(--sl-ink); color:var(--sl-paper); font-weight:600; font-size:10.5px; }
      .second-look-sticker .sl-chip svg { width:11px; height:11px; }
      .second-look-sticker .sl-pop { display:none; position:absolute; top:100%; left:0; margin-top:8px; width:264px; padding:12px 14px;
        background:var(--sl-paper); color:var(--sl-ink); border-radius:10px; box-shadow:0 0 0 1px var(--sl-rule), 0 16px 36px -10px rgba(28,27,25,.45);
        font:400 12px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans",sans-serif; white-space:normal; text-transform:none; cursor:auto; }
      .second-look-sticker:hover .sl-pop { display:block; }
      .second-look-sticker.has-chip .sl-pop { margin-top:30px; }
      .second-look-sticker .sl-pop b { display:block; margin-bottom:4px; font:600 15px/1.25 "SL Fraunces","Iowan Old Style",Georgia,serif; }
      .second-look-sticker .sl-pop b span { color:var(--c); }
      .second-look-sticker .sl-flags { margin-top:6px; color:var(--sl-muted); }
      .second-look-sticker.sl-retro { --sl-paper:#CDD6A5; --sl-ink:#1F3A1F; --sl-muted:#41613A; --sl-rule:#1F3A1F;
        --v-great:#1F3A1F; --v-good:#3E6A2B; --v-fair:#6E5E0E; --v-pass:#5E6A4E; --v-suspicious:#8E1D50;
        border-radius:2px; box-shadow:0 0 0 2px var(--sl-ink), 4px 4px 0 2px var(--sl-ink); font:500 11px/1.2 "SL Mono",ui-monospace,Menlo,monospace; }
      .second-look-sticker.sl-retro .sl-score { border-radius:1px; color:var(--sl-paper); font:600 16px/1 "SL Mono",ui-monospace,monospace; }
      .second-look-sticker.sl-retro .sl-verdict { font:600 11.5px/1 "SL Mono",ui-monospace,monospace; letter-spacing:.08em; text-transform:uppercase; }
      .second-look-sticker.sl-retro .sl-chip { border-radius:1px; }
      .second-look-sticker.sl-retro .sl-pop { border-radius:2px; box-shadow:0 0 0 2px var(--sl-ink), 5px 5px 0 2px var(--sl-ink); font:400 11.5px/1.55 "SL Mono",ui-monospace,monospace; }
      .second-look-sticker.sl-retro .sl-pop b { font:600 12px/1.3 "SL Mono",ui-monospace,monospace; letter-spacing:.08em; text-transform:uppercase; }
      .second-look-flash { outline:2px solid #C8461F !important; outline-offset:4px; animation:sl-flash 2s ease-out both; }
      @keyframes sl-flash { 0%, 60% { outline-color:#C8461F; } 100% { outline-color:transparent; } }`;
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
    const sub = lensLine(item);
    let chip = null;
    if (item.photoAdjust) {
      chip = h("div", { class: "sl-chip", title: "Photo check" }, signed(item.photoAdjust));
      chip.insertAdjacentHTML("afterbegin", CAMERA); // static markup, no page text involved
    }
    const s = h(
      "div",
      { class: `second-look-sticker${theme === "retro" ? " sl-retro" : ""}${chip ? " has-chip" : ""}`, "data-v": item.verdict },
      h("div", { class: "sl-score" }, String(item.score)),
      h("div", { class: "sl-text" }, h("div", { class: "sl-verdict" }, v.label), sub ? h("div", { class: "sl-sub" }, sub) : null),
      chip,
      h(
        "div",
        { class: "sl-pop" },
        h("b", {}, h("span", {}, String(item.score)), ` \u00b7 ${v.label}`),
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
          h("div", { class: "tag", "data-v": it.verdict, style: `--p:${it.score}`, "aria-label": `Score ${it.score}` }, h("span", {}, String(it.score))),
          h(
            "div",
            {},
            h("button", { class: "title", onclick: () => focusCard(it) }, it.title),
            h("div", { class: "meta", "data-v": it.verdict }, h("span", { class: "verdict" }, v.label), `${it.related === false ? " (not your search)" : ""} · ${priceStr(it)}${it.related === false ? "" : vsMarket}`),
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

  // Scroll to the card and outline it for a moment. If the open panel would cover it, tuck the
  // panel away (the tab stays, one click brings it back) so you can actually see the listing.
  const focusCard = (it) => {
    if (!it.el?.isConnected) return window.open(it.url, "_blank", "noopener");
    const card = stickerHost(it.el);
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    const c = card.getBoundingClientRect();
    if (wrap.classList.contains("open") && c.right > panel.getBoundingClientRect().left) showOpen(false);
    ensureStickerStyles();
    card.classList.remove("second-look-flash");
    void card.offsetWidth; // restart the animation if it's still running
    card.classList.add("second-look-flash");
    setTimeout(() => card.classList.remove("second-look-flash"), 2200);
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

  const priceCell = (label, m) =>
    h("div", {}, h("span", { class: "mlabel" }, label), h("span", { class: "mval" }, `$${m.median}`), h("span", { class: "msub" }, `$${m.p25}\u2013$${m.p75} \u00b7 ${m.n} sales`));
  const renderMarket = (market) => {
    if (!market) return marketEl.replaceChildren("Not enough eBay sales found to set a market price.");
    const groups = [
      market.median != null && ["Working / used", market.samples],
      market.parts && ["For parts", market.parts.samples],
    ].filter((g) => g && g[1]?.length);
    const cells = [
      market.median != null && priceCell(`Sold${market.condition === "used" ? ", used" : ""}`, market),
      market.parts && priceCell("Sold for parts", market.parts),
    ].filter(Boolean);
    marketEl.replaceChildren(
      ...[
        h("div", { class: "mgrid" }, cells),
        groups.length &&
          h(
            "details",
            { class: "comps" },
            h("summary", {}, "The sales behind these"),
            groups.flatMap(([label, list]) => [
              h("b", {}, label),
              h("ul", {}, list.map((x) => h("li", {}, h("a", { href: x.url, target: "_blank", rel: "noopener" }, h("span", { class: "cp" }, dollars(x.total)), h("span", { class: "ct" }, x.title))))),
            ])
          ),
      ].filter(Boolean)
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
        h("div", { class: "tag", "data-v": r.verdict, style: `--p:${score}`, "aria-label": `Score ${score}` }, h("span", {}, String(score))),
        h(
          "div",
          {},
          h("div", { class: "title", "data-v": r.verdict }, h("span", { class: "verdict" }, v.label), ` \u00b7 ${score} out of 100`),
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
        ${THEME_CSS}
        .wrap { box-sizing:border-box; width:340px; display:grid; grid-template-columns:60px 1fr auto; gap:12px; padding:12px;
          background:var(--paper); border:var(--bw) solid var(--rule); border-radius:var(--r); box-shadow:var(--shadow); }
        [data-theme="retro"].wrap { border-color:var(--ink); }
        img { width:60px; height:60px; object-fit:cover; border-radius:var(--r-sm); background:var(--paper-2); }
        b { display:block; margin-bottom:3px; font:600 14px/1.2 var(--display); }
        [data-theme="retro"] b { font-size:12.5px; text-transform:uppercase; letter-spacing:.1em; }
        .err { color:var(--v-suspicious); }
        button { width:26px; height:26px; display:grid; place-items:center; background:none; border:0; border-radius:var(--r-sm); color:var(--muted); cursor:pointer; align-self:start; font:16px/1 var(--ui); }
        button:hover { color:var(--ink); background:var(--paper-2); }
      </style><div class="wrap"><img alt=""><div><b>Photo check</b><span class="txt"></span></div><button aria-label="Close">\u00d7</button></div>`;
      toastRoot.querySelector("button").addEventListener("click", () => host.remove());
    }
    const host = toastRoot.host;
    if (!host.isConnected) document.documentElement.append(host);
    toastRoot.querySelector(".wrap").dataset.theme = theme;
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
