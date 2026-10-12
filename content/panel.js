// Second Look — on-page panel and scan flow.
// Flow: extract listings -> (optional) get eBay sold prices -> rank in batches
// with the chosen model -> show ranked list + stickers on the cards themselves.

(() => {
  const SL = window.SecondLook;
  if (!SL || window.__secondLookPanel) return;
  window.__secondLookPanel = true;

  // Verdict colours come from the theme (--v-great etc.), keyed by data-v.
  // A word always sits beside the score: the verdict colours are too close in lightness to tell apart on their own.
  const SHORT = { great: "Great", good: "Good", fair: "Fair", pass: "Skip", suspicious: "Scam?" };
  const VERDICT = {
    great: { label: "Great deal" },
    good: { label: "Worth a look" },
    fair: { label: "Fair price" },
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

  const tagEl = (verdict, score) =>
    h("div", { class: "tag", "data-v": verdict, role: "img", "aria-label": `Score ${score}, ${SHORT[verdict] || verdict}` }, h("span", {}, String(score)), h("i", {}, SHORT[verdict] || ""));

  // ---------- panel shell (shadow DOM keeps site CSS out) ----------

  const host = h("div", { id: "second-look-host" });
  // The host's box covers the whole drawer area even when the panel is tucked away, so it must not
  // take clicks itself: only the tab and the open panel do (see .tab / .open .panel below).
  host.style.cssText = "position:fixed;right:0;bottom:20px;z-index:2147483646;pointer-events:none;";
  const root = host.attachShadow({ mode: "open" });
  // The mark: a loupe with a vermilion dot.
  const MARK = `<svg class="m-vec" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="10" cy="10" r="6.5"/><path d="M14.8 14.8 20.5 20.5"/><circle class="dot" cx="10" cy="10" r="2" stroke="none"/></svg>`;

  // The two palettes. Contrast was measured: every text pair is 4.6:1 or better, control borders (--line) 3:1 or better.
  // --on-v and --on-accent are the text colours that sit on a verdict or accent fill.
  const THEME_DARK = `color-scheme:dark; --paper:#161513; --paper-2:#2B2925; --ink:#ECE9E2; --on-ink:#161513; --muted:#A9A59B; --rule:#34322D; --line:#858176;
      --accent:#E2673C; --on-accent:#161513; --v-great:#5FD08B; --v-good:#B5D36A; --v-fair:#E0B050; --v-pass:#A9A59B; --v-suspicious:#FF8A80; --on-v:#161513;
      --shadow:0 0 0 1px rgba(255,255,255,.04), 0 18px 44px -12px rgba(0,0,0,.75);`;
  const THEME_LIGHT = `color-scheme:light; --paper:#FBFAF6; --paper-2:#F1EEE6; --ink:#1B1A17; --on-ink:#FBFAF6; --muted:#5C5850; --rule:#DDD8CD; --line:#77736A;
      --accent:#C8461F; --on-accent:#fff; --v-great:#0A6B35; --v-good:#4A6500; --v-fair:#85540A; --v-pass:#5C5850; --v-suspicious:#B00020; --on-v:#fff;
      --shadow:0 1px 2px rgba(28,27,25,.06), 0 18px 44px -14px rgba(28,27,25,.32);`;
  // Colour, type and shape. Shared by the panel and the photo-check card.
  const THEME_CSS = `
    /* ---------- tokens: dark first; the light set is used when the browser asks for it or Setup says so ---------- */
    .wrap {
      --w: min(380px, calc(100vw - 32px)); --gap: 16px;
      --r:6px; --r-sm:4px; --bw:1px; --press:none;
      --ui:"Atkinson Hyperlegible Next", "Atkinson Hyperlegible", system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", Cantarell, sans-serif;
      --display:var(--ui);
      --mono:"Atkinson Hyperlegible Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;
      font:14px/1.5 var(--ui); color:var(--ink); -webkit-font-smoothing:antialiased;
      ${THEME_DARK}
    }
    @media (prefers-color-scheme: light) { .wrap { ${THEME_LIGHT} } }
    .wrap[data-theme="dark"] { ${THEME_DARK} }
    .wrap[data-theme="light"] { ${THEME_LIGHT} }
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
    /* Closed, the tab is part of the page: a light page gets a light tab whatever the panel's theme */
    .wrap[data-page-theme="light"] .tab { ${THEME_LIGHT} background:var(--paper); color:var(--ink); border-color:var(--line); }
    .wrap[data-page-theme="dark"] .tab { ${THEME_DARK} background:var(--paper); color:var(--ink); border-color:var(--line); }
    .open .tab { width:0; padding:0; border:0; opacity:0; pointer-events:none; box-shadow:none; overflow:hidden; }
    .tab .mark { width:18px; height:18px; }
    .tab .tab-label { writing-mode:vertical-rl; font:600 14px/1 var(--ui); letter-spacing:.01em; }
    .count { position:absolute; top:-9px; left:-9px; min-width:20px; height:20px; padding:0 6px; border-radius:10px; background:var(--ink); color:var(--on-ink);
      font:600 11px/20px var(--ui); font-style:normal; text-align:center; font-variant-numeric:tabular-nums; }
    .count.new { background:var(--accent); color:var(--on-accent); }
    .open .count { display:none; }

    /* ---------- panel ---------- */
    /* one height for every view, so switching This page / Saved / a listing doesn't move the panel; only the body scrolls */
    .panel { width:var(--w); height:min(760px, calc(100vh - 48px)); display:flex; flex-direction:column; overflow:hidden; margin-right:var(--gap);
      background:var(--paper); border:var(--bw) solid var(--rule); border-radius:var(--r); box-shadow:var(--shadow); }
    .head { display:flex; align-items:center; gap:10px; padding:14px 12px 8px 16px; }
    .nav { display:flex; padding:0 16px; border-bottom:var(--bw) solid var(--rule); }
    .nav button { border:0; background:none; margin:0 18px -1px 0; padding:8px 0 9px; border-bottom:2px solid transparent; color:var(--muted); font:600 13px/1 var(--ui); cursor:pointer; }
    .nav button:hover { color:var(--ink); }
    .nav button[aria-selected="true"] { color:var(--ink); border-bottom-color:var(--ink); }
    .nav .cnt { margin-left:5px; font-weight:400; color:var(--muted); }
    .nav .cnt:empty { display:none; }
    /* how far a scan has got, as a hairline under the tabs (the status says it in words) */
    .progress { height:2px; margin-top:-2px; position:relative; z-index:3; }
    .progress i { display:block; height:100%; width:0; background:var(--accent); transition:width .3s ease; }
    .view-saved { padding:12px 16px 16px; display:grid; gap:4px; }
    .other-note { display:none; }
    .wrap[data-page="other"] .other-note { display:block; }
    .wrap[data-page="other"] .controls > :not(.other-note), .wrap[data-page="other"] .view-page > :not(.controls) { display:none !important; }
    .ideas-inline { display:grid; gap:2px; }
    .idea-row { display:flex; align-items:baseline; gap:8px; padding:6px 0; border-top:1px solid var(--rule); }
    .idea-row:first-child { border-top:0; }
    .idea-row a { flex:1; min-width:0; color:var(--ink); font-weight:600; text-decoration:none; overflow-wrap:anywhere; }
    .idea-row a:hover { text-decoration:underline; text-underline-offset:3px; }
    .idea-row .kind { flex:none; }
    .mark { flex:none; width:22px; height:22px; display:grid; color:var(--ink); }
    .mark svg { width:100%; height:100%; }
    .mark .dot { fill:var(--accent); }
    .grow { flex:1; min-width:0; }
    .wordmark { font:700 16px/1.1 var(--ui); letter-spacing:0; }
    .wordmark em { font-style:normal; font-weight:400; }
    .head small { display:block; color:var(--muted); font-size:12px; margin-top:2px; }
    .icon-btn { flex:none; width:30px; height:30px; display:grid; place-items:center; border:0; border-radius:var(--r-sm); background:none; color:var(--muted); cursor:pointer; }
    .icon-btn svg { width:16px; height:16px; }
    .icon-btn:hover { background:var(--paper-2); color:var(--ink); }

    .body { flex:1; min-height:0; overflow-y:auto; scrollbar-width:thin; scrollbar-color:var(--rule) transparent; }
    .controls { padding:14px 16px 12px; display:grid; grid-template-columns:minmax(0, 1fr); gap:12px; }
    label { display:block; margin-bottom:6px; color:var(--muted); font:600 12px/1.2 var(--ui); }
    input { width:100%; padding:9px 11px; border:var(--bw) solid var(--line); border-radius:var(--r-sm); background:var(--paper); color:var(--ink); font:inherit; transition:border-color .15s; }
    input::placeholder { color:var(--muted); opacity:.7; }
    input:focus { outline:2px solid var(--ink); outline-offset:-1px; }

    .lens { display:grid; grid-template-columns:repeat(2,1fr); gap:2px; padding:2px; border:var(--bw) solid var(--line); border-radius:var(--r-sm); }
    .lens button { border:0; border-radius:calc(var(--r-sm) - 2px); background:none; color:var(--muted); font:600 13px/1 var(--ui); padding:8px 0; cursor:pointer; transition:background .15s, color .15s; }
    .lens button:hover { color:var(--ink); }
    .lens button[aria-checked="true"] { background:var(--ink); color:var(--on-ink); }
    .hint { color:var(--muted); font-size:13px; }
    .lens-hint { margin-top:6px; }
    .lens-label { margin-bottom:6px; }
    .inputs { display:grid; gap:12px; }
    .folded .inputs, .folded .lens-hint { display:none; }
    .inputs-sum { display:flex; gap:10px; align-items:baseline; justify-content:space-between; padding:8px 11px; border:var(--bw) solid var(--rule); border-radius:var(--r-sm); font-size:12px; color:var(--muted); }
    .inputs-sum b { color:var(--ink); font-weight:600; }
    .inputs-sum .sum-text { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .inputs-sum button { all:unset; flex:none; padding:3px 4px; margin:-3px -4px; cursor:pointer; color:var(--ink); font-weight:600; text-decoration:underline; text-decoration-color:var(--rule); text-underline-offset:3px; }
    .inputs-sum button:hover { text-decoration-color:currentColor; }
    .inputs-sum button:focus-visible { outline:2px solid var(--ink); outline-offset:2px; }
    .browse-note { margin-top:6px; }
    .browse-note b { color:var(--ink); font-weight:600; }

    .scan { background:var(--ink); color:var(--on-ink); border:var(--bw) solid var(--ink); border-radius:var(--r-sm); padding:11px; font:600 14px/1 var(--ui);
      box-shadow:var(--press); cursor:pointer; transition:opacity .15s, transform .08s, box-shadow .08s; }
    .scan:hover:not(:disabled) { opacity:.88; }
    .scan .cost, .ghost .cost { font-weight:400; opacity:.75; }
    .scan:disabled { opacity:.55; cursor:progress; }
    .freeprices { margin-top:-4px; text-align:center; color:var(--muted); font-size:12px; }
    .freeprices button { all:unset; padding:3px 0; cursor:pointer; color:var(--ink); font-weight:600; text-decoration:underline; text-decoration-color:var(--rule); text-underline-offset:3px; }
    .freeprices button:hover { text-decoration-color:currentColor; }
    .freeprices button:focus-visible { outline:2px solid var(--ink); outline-offset:2px; }
    .status { color:var(--muted); font-size:13px; white-space:pre-line; }
    .statusrow { display:flex; align-items:flex-start; gap:10px; }
    .statusrow .status { flex:1; min-width:0; }
    .statusrow:not(:has(.status:not(:empty), .stopbtn:not([hidden]))) { display:none; }
    .stopbtn { flex:none; margin-left:auto; border:var(--bw) solid var(--v-suspicious); background:none; color:var(--v-suspicious); border-radius:999px; padding:4px 12px;
      font:600 12px/1.3 var(--ui); cursor:pointer; }
    .stopbtn:hover:not(:disabled) { background:var(--v-suspicious); color:var(--on-v); }
    .stopbtn:disabled { opacity:.6; cursor:progress; }
    .status:empty { display:none; }
    .status.err { color:var(--v-suspicious); border-left:2px solid currentColor; padding-left:10px; }
    .busy .status:not(.err):not(:empty)::before { content:""; display:inline-block; width:10px; height:10px; margin-right:8px; vertical-align:-1px;
      border:1.5px solid var(--rule); border-top-color:var(--ink); border-radius:50%; animation:spin .8s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
    .actions { display:flex; flex-wrap:wrap; gap:6px 16px; font-size:12px; font-weight:600; }
    .actions > * { white-space:nowrap; }
    .controls > .actions:not(:has(:not([hidden]))) { display:none; }
    .actions a, .actions button { color:var(--ink); background:none; border:0; padding:3px 0; margin:-3px 0; font:inherit; line-height:18px; cursor:pointer;
      text-decoration:underline; text-decoration-color:var(--rule); text-underline-offset:3px; text-decoration-thickness:1px; }
    .actions a:hover, .actions button:hover:not(:disabled) { text-decoration-color:currentColor; }

    /* footer: model switch and what it's costing */
    .foot { position:relative; flex:none; border-top:var(--bw) solid var(--rule); background:var(--paper); }
    .foot-row { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:8px 12px 8px 14px; }
    .sr { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); }
    .model-pick { margin:0; display:block; min-width:0; text-transform:none; letter-spacing:normal; }
    .model { max-width:210px; appearance:none; -webkit-appearance:none; border:var(--bw) solid var(--line); border-radius:var(--r-sm); background:var(--paper);
      color:var(--ink); font:600 12px/1 var(--ui); padding:6px 24px 6px 9px; cursor:pointer; text-overflow:ellipsis;
      background-image:linear-gradient(45deg, transparent 50%, var(--muted) 50%), linear-gradient(135deg, var(--muted) 50%, transparent 50%);
      background-position:calc(100% - 13px) 50%, calc(100% - 9px) 50%; background-size:4px 4px; background-repeat:no-repeat; }
    .model:focus { outline:none; border-color:var(--ink); }
    .spend { all:unset; padding:4px 0; cursor:pointer; color:var(--muted); font-size:12px; white-space:nowrap; font-variant-numeric:tabular-nums; }
    .spend b { color:var(--ink); font:600 14px/1 var(--mono); font-variant-numeric:lining-nums tabular-nums; }
    .spend:hover b, .spend[aria-expanded="true"] b { text-decoration:underline; text-underline-offset:3px; text-decoration-thickness:1px; }
    .spend.warn b { color:var(--v-fair); } .spend.over b { color:var(--v-suspicious); }
    .budget { height:3px; background:var(--rule); }
    .budget i { display:block; height:100%; width:0; background:var(--ink); transition:width .3s; }
    .budget.warn i { background:var(--v-fair); } .budget.over i { background:var(--v-suspicious); }
    .spend-detail { position:absolute; left:8px; right:8px; bottom:calc(100% + 6px); padding:12px 14px 10px; font-size:12px; display:grid; gap:8px; max-height:40vh; overflow:auto;
      background:var(--paper); border:var(--bw) solid var(--rule); border-radius:var(--r); box-shadow:var(--shadow); }
    .sd-grid { display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; }
    .sd-grid span { display:block; color:var(--muted); font-size:12px; }
    .sd-grid b { font:600 18px/1.2 var(--mono); font-variant-numeric:lining-nums; }
    .sd-models { display:grid; gap:3px; }
    .sd-models div { display:flex; justify-content:space-between; gap:8px; }
    .sd-models div span:last-child { color:var(--muted); font-variant-numeric:tabular-nums; }
    .sd-note button { all:unset; padding:3px 0; cursor:pointer; color:var(--ink); text-decoration:underline; text-decoration-color:var(--line); text-underline-offset:3px; }
    .sd-note button:hover { text-decoration-color:currentColor; }
    .sd-note button:focus-visible { outline:2px solid var(--ink); outline-offset:2px; }

    /* first-run walkthrough */
    .welcome { display:grid; gap:8px; padding:12px 14px; border:var(--bw) solid var(--ink); border-radius:var(--r-sm); font-size:13px; }
    .welcome b { font:600 15px/1.2 var(--ui); }
    .welcome ol { margin:0; padding:0; list-style:none; display:grid; gap:4px; counter-reset:step; }
    .welcome li { counter-increment:step; position:relative; padding-left:26px; line-height:1.45; }
    .welcome li::before { content:counter(step); position:absolute; left:0; top:1px; width:18px; height:18px; display:grid; place-items:center; border-radius:50%; background:var(--ink); color:var(--paper); font:600 11px/1 var(--ui); }
    .welcome li button { border:0; background:none; padding:0; color:var(--ink); font:inherit; text-align:left; cursor:pointer; text-decoration:underline; text-decoration-color:var(--rule); text-underline-offset:3px; }
    .welcome li button:hover { text-decoration-color:var(--ink); }
    .welcome .tip { color:var(--muted); }
    .welcome .go { justify-self:start; }
    /* No model yet: the key is step 1 and the only call to action; the steps after it are plain text until it's done */
    .welcome .step-key { display:grid; gap:4px; }
    .welcome .step-key b { font:600 13px/1.45 var(--ui); }
    .welcome .step-key .setup-text { color:var(--muted); }
    .welcome li .setup-go { justify-self:start; margin-top:6px; padding:9px 14px; background:var(--ink); color:var(--on-ink); font:600 13px/1 var(--ui); text-decoration:none; cursor:pointer; pointer-events:auto; }
    .welcome:has(.step-key:not([hidden])) li:not(.step-key) { color:var(--muted); }
    .welcome:has(.step-key:not([hidden])) li:not(.step-key)::before { background:none; color:var(--muted); box-shadow:inset 0 0 0 1px var(--line); }
    .welcome:has(.step-key:not([hidden])) li:not(.step-key) button { color:inherit; text-decoration:none; cursor:default; pointer-events:none; }
    /* Model-only controls wait until there is a model: Compare prices against and free sold prices still work */
    .no-model .lenswrap, .no-model .want-field, .no-model [data-act="scan"], .no-model [data-act="analyze"], .no-model [data-act="ideas"] { display:none !important; }

    /* first run, list bar */
    .setup { display:grid; gap:10px; padding:12px; border:var(--bw) solid var(--ink); border-radius:var(--r-sm); font-size:13px; }
    .listbar { position:sticky; top:0; z-index:2; display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:6px 10px; margin:0 16px; padding:10px 0 8px;
      border-top:var(--bw) solid var(--rule); border-bottom:var(--bw) solid var(--rule); background:var(--paper); font-size:12px; color:var(--muted); }
    .listbar + .list > .row:first-child { border-top:0; }
    .sortpick { display:flex; align-items:center; gap:6px; margin:0; font:inherit; letter-spacing:normal; text-transform:none; color:var(--muted); }
    .sort { field-sizing:content; max-width:190px; appearance:none; -webkit-appearance:none; border:0; background:none; color:var(--ink); font:600 12px/1 var(--ui); padding:6px 14px 6px 0; cursor:pointer;
      background-image:linear-gradient(45deg, transparent 50%, var(--muted) 50%), linear-gradient(135deg, var(--muted) 50%, transparent 50%);
      background-position:calc(100% - 6px) 55%, calc(100% - 2px) 55%; background-size:4px 4px; background-repeat:no-repeat; }
    .sort:focus-visible { outline:2px solid var(--ink); outline-offset:2px; }
    .skipwrap { display:flex; align-items:center; gap:8px; }
    .qf { flex:1 1 100%; order:5; display:grid; gap:6px; margin-bottom:4px; }
    .qf[hidden] { display:none; }
    .qf-row { display:flex; gap:6px; align-items:center; flex-wrap:wrap; }
    .qf input { padding:6px 9px; font-size:12px; }
    .qf-wordwrap { position:relative; flex:1 1 140px; display:flex; }
    .qf-words { flex:1; width:auto; padding-right:26px !important; }
    .qf-price { display:flex; align-items:center; gap:3px; color:var(--muted); }
    .qf-price input { width:58px; }
    .qt { border:var(--bw) solid var(--line); background:none; color:var(--muted); font:600 12px/1 var(--ui); padding:5px 10px; border-radius:999px; cursor:pointer; }
    .qt:hover { color:var(--ink); border-color:var(--muted); }
    .qf-toggle.on { color:var(--ink); border-color:var(--ink); }
    .qt[aria-pressed="true"] { background:var(--ink); border-color:var(--ink); color:var(--on-ink); }
    .qf-deal { display:flex; align-items:center; gap:5px; margin:0 0 0 auto; color:var(--muted); font:600 12px/1 var(--ui); letter-spacing:normal; text-transform:none; }
    .qf-deal input { width:62px; }
    .qf-deal:has(input:not(:placeholder-shown)) input { border-color:var(--accent); }
    .qf-clear { position:absolute; right:2px; top:50%; transform:translateY(-50%); width:24px; height:24px; display:grid; place-items:center; border:0; border-radius:var(--r-sm);
      background:none; color:var(--muted); font:16px/1 var(--ui); cursor:pointer; }
    .qf-clear:hover { background:var(--paper-2); color:var(--ink); }
    .qf.on .qf-words, .qf.on .qf-price input:not(:placeholder-shown) { border-color:var(--ink); }
    .skipwrap .seg button { padding:6px 8px; }

    /* what's on this page */
    .pageinfo { font-size:13px; color:var(--muted); }
    .pi-reset { all:unset; padding:3px 0; cursor:pointer; color:var(--muted); font-weight:400; text-decoration:underline; text-decoration-color:var(--rule); text-underline-offset:3px; }
    .actions .pi-reset { color:var(--muted); font-weight:400; }
    .pi-reset:hover, .actions .pi-reset:hover { color:var(--ink); text-decoration-color:currentColor; }
    .pageinfo .chips { margin-top:8px; }
    .pageinfo .pi-acts { margin-top:8px; color:var(--muted); font-weight:400; }
    .pi-acts a, .pi-acts button { color:var(--ink) !important; font-weight:600 !important; }
    .pi-search { margin-top:8px; }
    .pi-search:not(:has(> :not([hidden]))) { display:none; }
    .scamnote { margin-bottom:8px; padding:8px 10px; border-left:3px solid var(--v-suspicious); background:var(--paper-2); color:var(--ink); font-size:13px; line-height:1.45; }
    .scamnote b { color:var(--v-suspicious); }
    .pi-head { margin-bottom:2px; color:var(--ink); font:700 18px/1.3 var(--ui); }
    .pi-head .mono { font-family:var(--mono); }
    .pi-line b { color:var(--ink); font-weight:600; }
    .pi-line button { all:unset; cursor:pointer; color:var(--ink); font-weight:600; text-decoration:underline; text-decoration-color:var(--rule); text-underline-offset:3px; }
    .pi-line button:hover { text-decoration-color:currentColor; }
    .seg { display:inline-grid; grid-auto-flow:column; gap:2px; padding:2px; border:var(--bw) solid var(--line); border-radius:var(--r-sm); }
    .seg button { border:0; background:none; color:var(--muted); font:600 12px/1 var(--ui); padding:6px 10px; border-radius:calc(var(--r-sm) - 2px); cursor:pointer; }
    .seg button[aria-checked="true"] { background:var(--ink); color:var(--on-ink); }
    .status button { all:unset; cursor:pointer; margin-left:6px; color:var(--ink); font-weight:600; text-decoration:underline; text-underline-offset:3px; }
    .chips { display:flex; flex-wrap:wrap; gap:4px; margin-top:6px; }
    .fchip { font-size:12px; padding:1px 8px; border-radius:999px; background:var(--ink); color:var(--on-ink); font-weight:600; }
    .fchip.k-new { background:var(--accent); color:var(--on-accent); } .fchip.k-good { background:var(--v-great); color:var(--on-v); } .fchip.k-warn { background:var(--v-suspicious); color:var(--on-v); }
    .fchip.k-plain { background:none; color:var(--muted); box-shadow:inset 0 0 0 1px var(--rule); }
    .fchip.k-deal { background:var(--accent); color:var(--on-accent); }
    .count.deal { background:var(--accent); color:var(--on-accent); }
    .count.pop { animation:pop .5s cubic-bezier(.3,1.6,.5,1); }
    @keyframes pop { 0% { transform:scale(.6); } 60% { transform:scale(1.25); } 100% { transform:none; } }

    /* sold prices */
    .market { font-size:12px; }
    .market:empty { display:none; }
    .market:not(:empty) { background:var(--paper-2); padding:11px 12px; border-radius:var(--r-sm); }
    .market:has(> .mnote:only-child) { padding:7px 10px; color:var(--muted); font-size:12px; }
    .mnote a { color:var(--ink); font-weight:600; text-underline-offset:3px; }
    .mgrid { display:grid; grid-template-columns:repeat(auto-fit, minmax(0,1fr)); gap:12px; }
    .mlabel { color:var(--muted); font-size:12px; }
    .mval { display:block; font:600 22px/1.15 var(--mono); font-variant-numeric:lining-nums; margin:2px 0 1px; }
    .msub { color:var(--muted); font-size:12px; }
    .comps { margin-top:8px; }
    .comps summary { cursor:pointer; color:var(--ink); font-weight:600; font-size:12px; list-style:none; }
    .comps summary::-webkit-details-marker { display:none; }
    .comps summary::before { content:"+ "; color:var(--muted); }
    .comps[open] summary::before { content:"\\2212  "; }
    .comps b { display:block; margin:8px 0 2px; color:var(--muted); font-size:12px; font-weight:600; }
    .comps ul { list-style:none; margin:0; padding:0; }
    .comps li a { display:flex; gap:10px; padding:3px 0; color:var(--ink); text-decoration:none; }
    .comps li a:hover .ct { text-decoration:underline; }
    .comps .cp { flex:none; width:44px; font:600 12px/1.5 var(--mono); font-variant-numeric:tabular-nums; }
    .comps .ct { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--muted); }

    /* results */
    .list, .itemout { padding:0 16px 12px; }
    .list:empty, .itemout:empty { display:none; }
    .row { display:grid; grid-template-columns:46px minmax(0,1fr) auto; gap:12px; padding:12px 0; border-top:var(--bw) solid var(--rule); animation:fade .25s ease both; }
    .row.still { animation:none; }
    .itemout > .row:first-child { border-top:0; }
    @keyframes fade { from { opacity:0; } to { opacity:1; } }
    .tag { --c:var(--v-fair); width:46px; height:46px; border:1.5px solid var(--c); border-radius:var(--r-sm); display:grid; place-content:center; text-align:center; line-height:1; }
    .tag span { font:700 18px/1 var(--mono); color:var(--c); font-variant-numeric:tabular-nums; }
    .tag i { display:block; margin-top:3px; font:700 10px/1 var(--ui); font-style:normal; letter-spacing:.06em; text-transform:uppercase; color:var(--c); }
    .list .tag, .itemout .tag { height:34px; }
    .list .tag i, .itemout .tag i { display:none; }
    .row.plain { padding:12px 0; grid-template-columns:minmax(0,1fr) auto; }
    .pr { text-align:right; font:700 15px/1.35 var(--mono); font-variant-numeric:tabular-nums; }
    .pr.deal { color:var(--accent); }
    .scamline { color:var(--v-suspicious); font-weight:600; }
    .wrap[data-skipmode="dim"] .row.skip, .wrap[data-skipmode="dim"] .row:has(> .tag[data-v="pass"]), .wrap[data-skipmode="dim"] .row:has(> .tag[data-v="suspicious"]) { opacity:.55; }
    .wrap[data-skipmode="dim"] .row.skip:hover, .wrap[data-skipmode="dim"] .row:hover { opacity:1; }
    .row.plain .actions { margin-top:6px; gap:6px 14px; }
    [data-v="great"] { --c:var(--v-great); } [data-v="good"] { --c:var(--v-good); } [data-v="fair"] { --c:var(--v-fair); }
    [data-v="pass"] { --c:var(--v-pass); } [data-v="suspicious"] { --c:var(--v-suspicious); }
    .title { display:block; background:none; border:0; padding:2px 0; margin:-2px 0; color:var(--ink); font:600 15px/1.35 var(--ui); text-align:left; cursor:pointer; }
    button.title:hover { text-decoration:underline; text-decoration-thickness:1px; text-underline-offset:3px; }
    .verdict { color:var(--c); font-weight:600; }
    .meta { color:var(--muted); font-size:13px; margin-top:3px; }
    .lensinfo { margin-top:4px; font-size:12px; font-weight:600; }
    .lensinfo.neg { color:var(--v-suspicious); }
    .reason { margin-top:6px; font-size:13px; }
    .flags { display:flex; flex-wrap:wrap; gap:4px; margin-top:8px; }
    .flag { font-size:12px; padding:1px 8px; border:1px solid var(--rule); border-radius:999px; color:var(--muted); }
    .row .actions { margin-top:8px; }
    .row { row-gap:0; }
    .row > .row-acts, .row > .row-acts ~ div { grid-column:2 / -1; }
    .row.plain > .row-acts, .row.plain > .row-acts ~ div { grid-column:1 / -1; }
    .row > .row-acts ~ div:empty { display:none; }
    /* With a mouse, a row's links appear when you point at it or Tab into it (like the marks on the cards);
       the space stays, so nothing moves. A saved listing keeps its star. Touch screens always show them. */
    @media (hover:hover) {
      .list .row:not(:hover):not(:focus-within) .row-acts > :not(.on) { visibility:hidden; }
      .row-acts > .on { order:-1; } /* so a lone "Saved" sits at the start, not in a gap */
    }
    /* in the list, actions stay quiet so titles and prices lead */
    .list .actions a, .list .actions button { color:var(--muted); font-weight:400; text-decoration-color:var(--line); }
    .list .actions a:hover, .list .actions button:hover:not(:disabled) { color:var(--ink); text-decoration-color:currentColor; }
    .photo { margin-top:8px; font-size:12px; padding:8px 10px; background:var(--paper-2); border-left:2px solid var(--ink); border-radius:0 var(--r-sm) var(--r-sm) 0; }
    .photo.drop { border-left-color:var(--v-suspicious); }
    [hidden] { display:none !important; }

    /* search ideas */
    .ghost { background:none; color:var(--ink); border:var(--bw) solid var(--ink); border-radius:var(--r-sm); padding:9px; font:600 13px/1 var(--ui); cursor:pointer; transition:background .15s, color .15s; }
    .ghost:hover:not(:disabled) { background:var(--ink); color:var(--on-ink); }
    .ghost:disabled { opacity:.55; cursor:progress; }
    .ideas-list:empty { display:none; }
    .saved-body .sub { display:block; margin:4px 0 0; color:var(--muted); font-size:12px; font-weight:600; }
    .srow { display:flex; gap:8px; align-items:flex-start; padding:8px 0; border-top:1px solid var(--rule); }
    .sub + .srow { border-top:0; }
    .srow > div { flex:1; min-width:0; }
    .srow a { padding:3px 0; color:var(--ink); font-weight:600; text-decoration:none; overflow-wrap:anywhere; }
    .srow a:hover { text-decoration:underline; text-underline-offset:3px; }
    .srow .meta { margin-top:1px; }
    .srow .down { color:var(--v-great); font-weight:600; }
    .sv-acts { margin:4px 0 10px; }
    .view-saved .sub { margin-top:10px; }
    .view-saved .sub:first-of-type { margin-top:0; }
    .sx { flex:none; width:24px; height:24px; display:grid; place-items:center; border:0; border-radius:var(--r-sm); background:none; color:var(--muted); font:16px/1 var(--ui); cursor:pointer; }
    .sx:hover { background:var(--paper-2); color:var(--ink); }
    /* one quiet text action at the end of every Saved row: Remove, or Unhide */
    .srow-act { flex:none; padding:3px 0; border:0; background:none; color:var(--muted); font:400 12px/18px var(--ui); cursor:pointer;
      text-decoration:underline; text-decoration-color:var(--line); text-underline-offset:3px; }
    .srow-act:hover { color:var(--ink); text-decoration-color:currentColor; }
    .actions button.on, .srow-act.on { color:var(--ink) !important; font-weight:600 !important; text-decoration:none; }
    .idea { display:block; padding:10px 0; border-top:1px solid var(--rule); color:var(--ink); text-decoration:none; animation:fade .25s ease both; }
    .idea:hover .q { text-decoration:underline; text-decoration-thickness:1px; text-underline-offset:3px; }
    .kind { color:var(--muted); font-size:12px; font-weight:600; }
    .idea .q { font:600 15px/1.3 var(--ui); margin-top:2px; word-break:break-word; }
    .idea .why { color:var(--muted); font-size:12px; margin-top:2px; }
    .idea .chips { display:flex; flex-wrap:wrap; gap:4px; margin-top:6px; }
    .chip { font-size:12px; padding:1px 7px; border:1px solid var(--rule); border-radius:999px; color:var(--muted); }

    /* one listing */
    .sect { margin-top:12px; padding-top:12px; border-top:var(--bw) solid var(--rule); font-size:13px; }
    .sect > strong:first-child { display:block; margin-bottom:4px; }
    .sect ol { margin:4px 0 6px; padding-left:18px; }
    .sect li { margin:2px 0; }
    .sect .actions { margin-top:8px; }
    .offer { margin-top:12px; padding:11px 12px; background:var(--paper-2); border-radius:var(--r-sm); font-size:13px; }
    .offer-acts { margin-top:8px; }
    .msg-preview { margin-top:8px; color:var(--muted); font-style:italic; }
    .offer b { font:600 18px/1 var(--mono); font-variant-numeric:lining-nums; margin:0 2px; }
    .adjust { margin-top:6px; font-size:12px; font-weight:600; color:var(--v-suspicious); }
    .adjust.up { color:var(--v-great); }

    .panel:focus { outline:none; } /* focus lands on the panel itself when it opens; the controls inside show their own ring */
    button:focus-visible, input:focus-visible, a:focus-visible, summary:focus-visible { outline:2px solid var(--ink); outline-offset:2px; }
    input:focus-visible { outline-offset:-1px; }


    @media (prefers-reduced-motion: reduce) { .drawer, .tab, .row, .idea, .count, .progress i, .busy .status::before { transition:none !important; animation:none !important; } }
  </style>
  <div class="wrap">
   <div class="drawer">
    <button class="tab" data-act="tab" aria-label="Open Second Look" title="Second Look">
      <span class="mark">${MARK}</span>
      <span class="tab-label">Second Look</span><i class="count" hidden></i>
    </button>
    <div class="panel" role="complementary" aria-label="Second Look" tabindex="-1">
      <div class="head">
        <span class="mark">${MARK}</span>
        <div class="grow"><div class="wordmark">Second <em>Look</em></div><small>for careful buyers</small></div>
        <button class="icon-btn" data-act="help" aria-label="How it works" title="How it works"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M6.3 6.2a1.8 1.8 0 1 1 2.6 1.6c-.6.3-.9.7-.9 1.3M8 11.4v.1"/></svg></button>
        <button class="icon-btn" data-act="settings" aria-label="Settings" title="Settings"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2.5 4.5h7M12.5 4.5h1M2.5 11.5h1M6.5 11.5h7"/><circle cx="11" cy="4.5" r="1.6"/><circle cx="5" cy="11.5" r="1.6"/></svg></button>
        <button class="icon-btn" data-act="toggle" aria-label="Tuck panel away" title="Tuck away (Esc)"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5 10.5 8 6 12.5"/></svg></button>
      </div>
      <div class="nav" role="tablist" aria-label="Views">
        <button role="tab" data-view="page" aria-selected="true">This page</button>
        <button role="tab" data-view="saved" aria-selected="false">Saved<span class="cnt"></span></button>
      </div>
      <div class="progress" hidden aria-hidden="true"><i></i></div>
      <div class="body">
      <div class="view view-page">
      <div class="controls">
        <div class="hint other-note">Nothing to scan on this page. Open a search, a category or a listing; your saved listings and searches are under Saved.</div>
        <div class="welcome" hidden>
          <b>Welcome to Second Look</b>
          <ol>
            <li class="step-key" hidden><b class="setup-title"></b> <span class="setup-text"></span>
              <button class="scan setup-go" data-act="open-settings">Open settings</button></li>
            <li><button data-step="lens">Choose what you're buying for</button>: Use, or Fix &amp; flip.</li>
            <li><button data-step="want">Say what you want</button>, like "working, with charger". Optional.</li>
            <li><button data-step="scan">Press Scan</button> and every listing gets a score and a reason.</li>
          </ol>
          <div class="tip">No key yet? The free marks still work: hover a card for scam checks, <i>Save</i> and <i>Sold</i> prices.</div>
          <button class="ghost go" data-act="intro-done">Got it</button>
        </div>
        <div class="setup" hidden><b class="setup-title">Add a Claude API key to start.</b> <span class="setup-text">It takes a minute at console.anthropic.com. Or pick another AI service, or Ollama on your computer, in settings.</span>
          <button class="scan" data-act="open-settings">Open settings</button></div>
        <div class="lenswrap">
          <label class="lens-label" id="lens-label">Buying to</label>
          <div class="lens" role="radiogroup" aria-labelledby="lens-label">
            <button role="radio" data-lens="use">Use</button><button role="radio" data-lens="project">Fix &amp; flip</button>
          </div>
          <div class="hint lens-hint"></div>
        </div>
        <div class="inputs">
        <div class="want-field"><label for="want">What I want</label><input id="want" placeholder="e.g. working, with charger, under $150"></div>
        <div class="qwrap"><label for="q">Compare prices against</label><input id="q" placeholder="e.g. Pentax K1000">
          <div class="hint browse-note" hidden>No search on this page: Second Look goes by what you're into and what you want, and prices are estimates (<i>est.</i>). <b>Sold prices</b> on a listing gets real eBay numbers.</div></div>
        </div>
        <div class="inputs-sum" hidden><span class="sum-text"></span><button data-act="edit-inputs" title="Change what you want or what prices are compared against">Edit</button></div>
        <button class="scan" data-act="scan">Scan this page</button>
        <button class="scan" data-act="analyze" hidden>Analyze this listing</button>
        <button class="ghost" data-act="ideas" hidden>Find searches for what I want</button>
        <div class="freeprices" hidden><button data-act="prices">Just compare sold prices</button> <span>free, no AI</span></div>
        <div class="market"></div>
        <div class="statusrow"><div class="status" role="status"></div><button class="stopbtn" hidden title="Stop the model: nothing new is sent, and requests under way are cancelled">Stop</button></div>
        <div class="pageinfo" hidden><div class="pi-head" hidden></div><span class="pi-line"></span><button class="pi-reset" data-act="reset" hidden title="Clear the scores on this page (the free marks stay)">Start over</button><div class="actions pi-search"></div></div>
        <div class="ideas-inline" hidden><div class="status ideas-status" role="status"></div><div class="ideas-list"></div></div>
      </div>
      <div class="listbar" hidden>
        <button class="qt qf-toggle" aria-expanded="false" aria-controls="qf-box" title="Filter by words and price, hide listings you've seen, set your deal price">Filter</button>
        <div class="qf" id="qf-box" role="search" aria-label="Filter this search" hidden>
          <div class="qf-row">
            <span class="qf-wordwrap"><input class="qf-words" placeholder="Filter: dmg -case -game" aria-label="Words to keep or drop (-word drops)" title="Words a listing must have; -word drops listings with it; a/b = either; &quot;quotes&quot; for a phrase"><button class="qf-clear" hidden title="Clear the filter (your deal price stays)" aria-label="Clear the filter">\u00d7</button></span>
            <span class="qf-price"><input class="qf-min" inputmode="numeric" placeholder="$ min" aria-label="Lowest price, shipping included"><span aria-hidden="true">\u2013</span><input class="qf-max" inputmode="numeric" placeholder="max" aria-label="Highest price, shipping included"></span>
          </div>
          <div class="qf-row qf-toggles">
            <button class="qt" data-q="fresh" aria-pressed="false" title="Hide every listing you've seen before">New only</button>
            <button class="qt qt-broken" aria-pressed="false"></button>
            <label class="qf-deal" title="Your price for this search">Deal at \u2264 <input class="qf-dealin" inputmode="numeric" placeholder="$" aria-label="Your price for this search"></label>
          </div>
          <div class="qf-row skipwrap" title="Listings judged Skip or Suspicious, and likely scams"><span id="skip-label">Skips and scams</span><div class="seg" role="radiogroup" aria-labelledby="skip-label"><button role="radio" data-skip="show">Show</button><button role="radio" data-skip="dim">Dim</button><button role="radio" data-skip="hide">Hide</button></div></div>
        </div>
        <label class="sortpick">Sort <select class="sort">
          <option value="score">best first</option><option value="price">cheapest first</option><option value="value">furthest under sold price</option><option value="ending">auctions ending soonest</option><option value="margin">biggest margin</option><option value="new">new or cheaper first</option>
        </select></label>
      </div>
      <div class="list"></div>
      <div class="itemout"></div>
      </div>
      <div class="view view-saved" hidden><div class="status saved-status" role="status"></div><div class="saved-body"></div></div>
      </div>
      <div class="foot">
        <div class="spend-detail" hidden></div>
        <div class="foot-row">
          <label class="model-pick" title="Which model judges listings. Changes straight away."><span class="sr">Model</span><select class="model"></select></label>
          <button class="spend" aria-expanded="false" title="What Second Look has spent on paid AI services"></button>
        </div>
        <div class="budget" hidden><i></i></div>
      </div>
    </div>
   </div>
  </div>`;

  const $ = (sel) => root.querySelector(sel);
  const wrap = $(".wrap");
  // Theme: Setup's Match (the default) follows the browser, falling back to dark; Dark and Light force one.
  let themePref = "";
  const applyTheme = (t) => {
    themePref = t === "dark" || t === "light" ? t : "";
    if (themePref) wrap.dataset.theme = themePref;
    else delete wrap.dataset.theme;
    const card = toastRoot?.querySelector(".wrap");
    if (card) themePref ? (card.dataset.theme = themePref) : delete card.dataset.theme;
  };
  chrome.storage.local.get("theme").then(({ theme }) => applyTheme(theme)).catch(() => {});
  chrome.storage.onChanged.addListener((changes) => changes.theme && applyTheme(changes.theme.newValue));
  const panel = $(".panel");
  const countEl = $(".count");
  const statusEl = $(".status");
  const marketEl = $(".market");
  const listEl = $(".list");
  const queryEl = $("#q");
  const scanBtn = $('[data-act="scan"]');
  const analyzeBtn = $('[data-act="analyze"]');
  const resetBtn = $('[data-act="reset"]');
  const ideasBtn = $('[data-act="ideas"]');
  const ideasList = $(".ideas-list");
  const ideasStatus = $(".ideas-status");
  const wantEl = $("#want");
  const lensHint = $(".lens-hint");
  const qwrap = $(".qwrap");
  const browseNote = $(".browse-note");
  // Browse mode: a results page with nothing to compare against (e.g. the Marketplace home feed).
  const showBrowseNote = () => (browseNote.hidden = SL.pageType() !== "results" || !!queryEl.value.trim());
  queryEl.addEventListener("input", showBrowseNote);
  const itemEl = $(".itemout");
  const pageInfo = $(".pageinfo");
  const piLine = $(".pi-line");
  const piHead = $(".pi-head");
  const piSearch = $(".pi-search");
  const listBar = $(".listbar");
  const sortSel = $(".sort");
  const setupCard = $(".setup");
  const freeRow = $(".freeprices");

  // action: an optional { label, fn } shown after the text, e.g. Undo.
  const setStatusNow = (text, isErr = false, action = null) => {
    statusEl.textContent = text;
    if (action) statusEl.append(h("button", { onclick: action.fn }, action.label));
    statusEl.classList.toggle("err", isErr);
  };

  // ---------- busy, and the Stop button ----------
  // Anything the model is working on goes through sendAI, so Stop can cancel it in the background.
  const stopBtn = $(".stopbtn");
  const live = new Set(); // request ids under way
  let stopRequested = false;
  let busyN = 0;
  const sendAI = (type, payload) => {
    if (stopRequested) return Promise.reject(new Error("Stopped."));
    const reqId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    live.add(reqId);
    return send(type, { ...payload, reqId }).finally(() => live.delete(reqId));
  };
  const setBusy = (on) => {
    busyN = Math.max(0, busyN + (on ? 1 : -1));
    wrap.classList.toggle("busy", busyN > 0);
    stopBtn.hidden = busyN === 0;
    if (!busyN) {
      stopRequested = false;
      stopBtn.disabled = false;
      stopBtn.textContent = "Stop";
    }
  };
  const isStop = (e) => stopRequested || e?.message === "Stopped.";
  const stopAll = () => {
    if (!busyN) return;
    stopRequested = true;
    stopBtn.disabled = true;
    stopBtn.textContent = "Stopping\u2026";
    if (live.size) send("abort", { ids: [...live] }).catch(() => {});
  };
  stopBtn.addEventListener("click", stopAll);
  // Each page view gets a number; work started on an earlier one keeps quiet when it finishes.
  let pageEpoch = 0;

  // Once the page is scanned (or priced, or analyzed), "What I want" and "Compare prices against" fold
  // into one line, so the results get the room. Edit opens them again until the next scan.
  let editingInputs = false;
  const inputsSum = $(".inputs-sum");
  const updateFold = () => {
    const type = SL.pageType();
    const done = type === "results" ? scored.size > 0 || !!lastMarket : type === "item" ? itemEl.childElementCount > 0 : false;
    const typingHere = root.activeElement && $(".inputs").contains(root.activeElement);
    const fold = done && !editingInputs && !typingHere;
    wrap.classList.toggle("folded", fold);
    inputsSum.hidden = !fold;
    if (!fold) return;
    const q = queryEl.value.trim();
    const want = wantEl.value.trim();
    $(".sum-text").replaceChildren(
      ...[q ? ["Comparing ", h("b", {}, `\u201c${q}\u201d`)] : "No price comparison", " \u00b7 ", want ? ["wants ", h("b", {}, want)] : "no wants set"].flat()
    );
    $(".sum-text").title = `${q ? `Comparing prices with eBay sales of \u201c${q}\u201d` : "No price comparison"}; ${want ? `what you want: ${want}` : "nothing in What I want"}`;
  };
  $('[data-act="edit-inputs"]').addEventListener("click", () => {
    editingInputs = true;
    updateFold();
    wantEl.focus();
  });

  const setStatus = (...a) => setStatusNow(...a);
  // The hairline under the tabs; showProgress(null) takes it away.
  const progressEl = $(".progress");
  const showProgress = (done, total) => {
    progressEl.hidden = done == null || !total;
    if (!progressEl.hidden) progressEl.firstChild.style.width = `${Math.max(4, (done / total) * 100)}%`;
  };

  // Open/closed: the tab is always there; the panel slides out when you pull the tab.
  let touched = false; // the user (or the toolbar icon) has opened/closed it on this page
  const showOpen = (open) => {
    wrap.classList.toggle("open", open);
    $('[data-act="tab"]').setAttribute("aria-label", open ? "Tuck Second Look away" : "Open Second Look");
  };
  // Keyboard users: opening puts focus in the panel and closing puts it back on the tab, so it is
  // never left on a control that just disappeared. Only when focus was in the panel does closing move it.
  const setOpen = (open) => {
    touched = true;
    const inside = !!root.activeElement?.closest(".panel");
    showOpen(open);
    if (open) $(".panel").focus({ preventScroll: true });
    else if (inside) $('[data-act="tab"]').focus({ preventScroll: true });
  };
  const toggleOpen = () => setOpen(!wrap.classList.contains("open"));

  // Tabs and Use/Fix & flip/Skipped-style radios: arrow keys (and Home/End) move and choose; only the
  // chosen one is in the Tab order, as the ARIA patterns say. attr is the state attribute the code already sets.
  const rovingGroup = (group, attr) => {
    const items = [...group.querySelectorAll(`[role="${attr === "aria-selected" ? "tab" : "radio"}"]`)];
    const sync = () => items.forEach((b) => (b.tabIndex = b.getAttribute(attr) === "true" ? 0 : -1));
    new MutationObserver(sync).observe(group, { attributes: true, attributeFilter: [attr], subtree: true });
    sync();
    group.addEventListener("keydown", (e) => {
      const i = items.indexOf(e.target);
      const to = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: items.length - 1 }[e.key];
      if (i < 0 || to == null) return;
      e.preventDefault();
      const next = items[(to + items.length) % items.length];
      next.click();
      next.focus();
    });
  };
  root.querySelectorAll('[role="tablist"]').forEach((g) => rovingGroup(g, "aria-selected"));
  root.querySelectorAll('[role="radiogroup"]').forEach((g) => rovingGroup(g, "aria-checked"));
  $('[data-act="tab"]').addEventListener("click", toggleOpen);
  $('[data-act="toggle"]').addEventListener("click", () => setOpen(false));
  // Every page starts with just the tab: the cards' marks and free checks run without the panel open.

  // ---------- footer: model switch and spending ----------
  // Spending is estimated from token counts at list prices (a regular API key can't read the real
  // balance). The background records it per day and model; the footer reads that record.
  const MODELS = [
    ["anthropic", "claude-opus-5-5", "Opus 5.5 \u00b7 best"],
    ["anthropic", "claude-sonnet-5-5", "Sonnet 5.5 \u00b7 \u00bd price"],
    ["anthropic", "claude-haiku-4-5", "Haiku 4.5 \u00b7 \u00bc price"],
  ];
  const modelSel = $(".model");
  const spendBtn = $(".spend");
  const spendDetail = $(".spend-detail");
  const budgetBar = $(".budget");
  let cfg = {};
  const nameOf = (id) => (MODELS.find(([, m]) => m === id)?.[2].split(" \u00b7")[0]) || id;

  const renderModels = () => {
    const opts = [...MODELS];
    if (cfg.anthropicModel && !opts.some(([, m]) => m === cfg.anthropicModel)) opts.push(["anthropic", cfg.anthropicModel, cfg.anthropicModel]);
    // Another AI service, once one is set up in settings.
    if (cfg.oaiModel) opts.push(["openai", cfg.oaiModel, `${cfg.oaiName} \u00b7 ${cfg.oaiModel.replace(/^[^/]+\//, "")}`]);
    opts.push(["ollama", cfg.textModel || "qwen3:4b", `Ollama \u00b7 ${cfg.textModel || "qwen3:4b"} \u00b7 free`]);
    modelSel.replaceChildren(...opts.map(([prov, m, label]) => h("option", { value: `${prov}|${m}`, title: label }, label)));
    modelSel.value = cfg.provider === "ollama" ? `ollama|${cfg.textModel}` : cfg.provider === "openai" ? `openai|${cfg.oaiModel}` : `anthropic|${cfg.anthropicModel}`;
  };
  const openSettings = () => send("openOptions").catch(() => {});
  $('[data-act="settings"]').addEventListener("click", openSettings);
  root.querySelectorAll('[data-act="open-settings"]').forEach((b) => b.addEventListener("click", openSettings));
  // What's missing before the model can run ([title, text]), or null. With the welcome open it is the
  // welcome's first step, so first run is one card; otherwise it is a card of its own.
  let modelMissing = null;
  const placeSetup = () => {
    const inWelcome = !!modelMissing && !$(".welcome").hidden;
    wrap.classList.toggle("no-model", !!modelMissing);
    setupCard.hidden = !modelMissing || inWelcome;
    $(".step-key").hidden = !inWelcome;
    if (!modelMissing) return;
    root.querySelectorAll(".setup-title").forEach((el) => (el.textContent = modelMissing[0]));
    root.querySelectorAll(".setup-text").forEach((el) => (el.textContent = modelMissing[1]));
  };
  root.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !wrap.classList.contains("open")) return;
    if (!spendDetail.hidden) {
      showSpend(false);
      spendBtn.focus();
    } else setOpen(false);
  });

  modelSel.addEventListener("change", async () => {
    const [provider, model] = modelSel.value.split("|");
    await chrome.storage.local.set(provider === "anthropic" ? { provider, anthropicModel: model } : { provider });
    setStatus(
      provider === "ollama"
        ? `Using ${model} on Ollama (free, on your computer).`
        : provider === "openai"
          ? `Using ${model} on ${cfg.oaiName} from now on.`
          : cfg.hasKey
            ? `Using ${nameOf(model)} from now on. Scores already made by another model stay until you scan again.`
            : "Add a Claude API key in the extension's settings to use Claude.",
      provider === "anthropic" && !cfg.hasKey
    );
  });

  const usageSummary = (usage) => {
    const days = usage?.days || {};
    const now = new Date();
    const day = now.toLocaleDateString("en-CA");
    const month = day.slice(0, 7);
    const last = new Date(now.getFullYear(), now.getMonth() - 1, 15).toLocaleDateString("en-CA").slice(0, 7);
    const sum = { today: 0, month: 0, last: 0, calls: 0, models: {} };
    for (const [d, v] of Object.entries(days)) {
      if (d === day) sum.today += v.usd;
      if (d.startsWith(last)) sum.last += v.usd;
      if (!d.startsWith(month)) continue;
      sum.month += v.usd;
      sum.calls += v.calls;
      for (const [m, mv] of Object.entries(v.models || {})) {
        const t = (sum.models[m] ||= { usd: 0, calls: 0 });
        t.usd += mv.usd;
        t.calls += mv.calls;
      }
    }
    return sum;
  };
  const usd = (n) => (n > 0 && n < 0.01 ? "<$0.01" : `$${n.toFixed(2)}`);
  let lastUsage = null;
  // Always pass the record explicitly: after a reset it's undefined, and that must show $0.00.
  const renderSpend = (usage) => {
    lastUsage = usage;
    const s = usageSummary(usage);
    const budget = +cfg.monthlyBudget || 0;
    const share = budget ? s.month / budget : 0;
    const level = share >= 1 ? "over" : share >= 0.8 ? "warn" : "";
    spendBtn.className = `spend ${level}`;
    spendBtn.replaceChildren(h("b", {}, usd(s.month)), budget ? ` of $${budget} this month` : " this month");
    budgetBar.hidden = !budget;
    budgetBar.className = `budget ${level}`;
    budgetBar.firstChild.style.width = `${Math.min(100, share * 100)}%`;
    if (spendDetail.hidden) return;
    const models = Object.entries(s.models).sort((a, b) => b[1].usd - a[1].usd);
    // Spending recorded before the per-model split (or by an older version) still counts toward the month.
    const rest = s.month - models.reduce((t, [, v]) => t + v.usd, 0);
    spendDetail.replaceChildren(
      h("div", { class: "sd-grid" }, [["Today", s.today], ["This month", s.month], ["Last month", s.last]].map(([l, v]) => h("div", {}, h("span", {}, l), h("b", {}, usd(v))))),
      models.length || rest >= 0.005
        ? h(
            "div",
            { class: "sd-models" },
            models.map(([m, v]) => h("div", {}, h("span", {}, nameOf(m)), h("span", {}, `${usd(v.usd)} \u00b7 ${v.calls} call${v.calls === 1 ? "" : "s"} \u00b7 ~${usd(v.usd / v.calls)} each`))),
            rest >= 0.005 ? h("div", {}, h("span", {}, "Not split by model"), h("span", {}, usd(rest))) : null
          )
        : h("div", { class: "hint" }, "Nothing spent on paid AI this month."),
      // One line here; how it is counted, the budget and the reset are in settings.
      h(
        "div",
        { class: "hint sd-note" },
        budget ? `${Math.round(share * 100)}% of your $${budget} budget. ` : "Estimates, no budget set. ",
        h("button", { onclick: openSettings }, "Budget and how it's counted")
      )
    );
  };
  const showSpend = (show) => {
    spendDetail.hidden = !show;
    spendBtn.setAttribute("aria-expanded", String(show));
    renderSpend(lastUsage);
  };
  spendBtn.addEventListener("click", () => showSpend(spendDetail.hidden));
  // It's a popover: a click anywhere else in the panel, or Esc, closes it.
  root.addEventListener("click", (e) => {
    if (!spendDetail.hidden && !e.composedPath().some((n) => n === spendDetail || n === spendBtn)) showSpend(false);
  });
  const loadFooter = async () => {
    try {
      cfg = await send("getSettings");
    } catch {
      return;
    }
    renderModels();
    // What's missing before the model can run, if anything.
    const keyless = /LM Studio/.test(cfg.oaiName || "");
    const missing =
      cfg.provider === "anthropic" && !cfg.hasKey
        ? ["Add a Claude API key to start.", "It takes a minute at console.anthropic.com. Or pick another AI service, or Ollama on your computer, in settings."]
        : cfg.provider === "openai" && (!cfg.oaiModel || (!cfg.hasOaiKey && !keyless))
          ? [`Finish setting up ${cfg.oaiName || "your AI service"}.`, `It needs ${!cfg.hasOaiKey && !keyless ? "an API key and " : ""}a model. Test connection in settings lists the models.`]
          : null;
    modelMissing = missing;
    placeSetup();
    renderSpend((await chrome.storage.local.get("usage")).usage);
  };
  loadFooter();
  chrome.storage.onChanged.addListener((changes) => {
    if (!alive()) return;
    if (changes.usage) renderSpend(changes.usage.newValue);
    if (["provider", "anthropicModel", "textModel", "anthropicKey", "oaiModel", "oaiKey", "oaiUrl", "oaiPriceIn", "oaiPriceOut", "monthlyBudget", "rankRate", "batchSize"].some((k) => changes[k])) loadFooter().then(refreshPending);
  });


  // ---------- first-run walkthrough ----------
  // Shown once (and again from the ? button). The first time on a search or listing page the panel opens by itself.
  const welcome = $(".welcome");
  const showIntro = (show) => {
    welcome.hidden = !show;
    placeSetup();
    if (show) setView("page");
  };
  $('[data-act="intro-done"]').addEventListener("click", () => {
    showIntro(false);
    introPending = false;
    if (alive()) chrome.storage.local.set({ introDone: true }).catch(() => {});
  });
  $('[data-act="help"]').addEventListener("click", () => {
    if (SL.pageType() === "other") return setStatus("Open an eBay or Marketplace search to try it. Your saved listings and searches are under Saved.");
    showIntro(welcome.hidden);
    if (!welcome.hidden) welcome.scrollIntoView({ block: "nearest" });
  });
  welcome.querySelectorAll("[data-step]").forEach((b) =>
    b.addEventListener("click", () => {
      const step = b.dataset.step;
      if (step === "want") wantEl.focus();
      else if (step === "scan") (scanBtn.hidden ? analyzeBtn : scanBtn).focus();
      else root.querySelector("[data-lens][aria-checked='true']")?.focus();
    })
  );
  let introPending = false;
  let introOpened = false;
  // Called on every page change: the card only appears where there is something to try it on.
  const applyIntro = () => {
    if (!introPending || SL.pageType() === "other") return;
    showIntro(true);
    if (!touched && !introOpened) showOpen(true);
    introOpened = true;
  };
  chrome.storage.local.get("introDone").then(({ introDone }) => {
    introPending = !introDone && alive();
    applyIntro();
  }).catch(() => {});

  // ---------- lens: what you want the listing for ----------

  const LENS = {
    use: { name: "Use", hint: "For yourself: working items at a good price. Broken, untested and for-parts ones score low." },
    project: { name: "Fix & flip", hint: "Projects: an easy fix, a resale margin after eBay fees and parts, or both. Broken and untested ones are welcome." },
  };
  let lens = "use";
  let onLensShown = () => {}; // the filter bar's broken-listing toggle follows the lens (set up further down)
  const showLens = () => {
    root.querySelectorAll("[data-lens]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.lens === lens)));
    lensHint.textContent = LENS[lens].hint;
    onLensShown();
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
    if (had)
      setStatus(
        SL.pageType() === "item"
          ? `Switched to ${LENS[lens].name}. Press Analyze to judge this listing that way.`
          : `Switched to ${LENS[lens].name}. Scan again to judge these listings for that (anything already judged this way comes back free).`
      );
    refreshPending();
  };
  root.querySelectorAll("[data-lens]").forEach((b) => b.addEventListener("click", () => setLens(b.dataset.lens)));
  wantEl.addEventListener("change", () => alive() && chrome.storage.local.set({ want: wantEl.value.trim() }).catch(() => {}));
  // The scan button says when your edits mean a rescan (refreshPending is defined further down).
  for (const el of [wantEl, queryEl]) el.addEventListener("input", () => refreshPending());
  chrome.storage.local.get({ lens: "use", want: "" }).then((v) => {
    lens = v.lens === "fix" || v.lens === "flip" ? "project" : LENS[v.lens] ? v.lens : "use"; // older Fix and Flip are one mode now
    if (!wantEl.value) wantEl.value = v.want;
    showLens();
  });
  showLens();

  const dollars = (n) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
  const money = (n) => `${n < 0 ? "\u2212" : ""}$${Math.abs(Math.round(n))}`;
  const fmtCost = (usd) => (usd < 0.01 ? "under $0.01" : `~$${usd.toFixed(2)}`);
  const DIFFICULTY = ["Repair: difficulty unclear", "Easy fix", "Fairly easy fix", "Moderate fix", "Hard fix", "Very hard fix"];

  // The one-line lens summary for a scored listing: what the sticker and list show under the verdict.
  const lensLine = (it) => {
    if (it.related === false) return it.browse ? "Not your thing" : "Not your search";
    // The number that matters first, so a narrow sticker doesn't cut it off.
    if (it.auction) return [it.bidCap > 0 ? `Bid \u2264 ${dollars(it.bidCap)}` : "Auction", it.timeLeft && `${it.timeLeft} left`].filter(Boolean).join(" \u00b7 ");
    if (it.lot && it.total != null) return `Lot of ${it.lot} \u00b7 ${dollars(Math.round((it.total / it.lot) * 100) / 100)} each`;
    // Fix & flip: how hard the fix is (when there is one) and what it should make; whichever is known.
    if (it.lens === "project") {
      const margin = it.margin != null ? `\u2248 ${money(it.margin)} margin${it.refIsEstimate ? " (est.)" : ""}` : "";
      const broken = it.fault && !/^none$/i.test(it.fault);
      if (broken && it.difficulty > 0) return [DIFFICULTY[it.difficulty], margin || (it.partsCost > 0 && `~$${it.partsCost} parts`)].filter(Boolean).join(" \u00b7 ");
      if (margin) return margin;
      if (broken && it.partsCost > 0) return `~$${it.partsCost} parts`;
    }
    if (it.vsWorking == null) return "";
    return it.refIsEstimate ? `~${Math.round(it.vsWorking * 100)}% of typical price (est.)` : `${Math.round(it.vsWorking * 100)}% of sold price`;
  };

  const priceStr = (it) =>
    (it.auction ? "current bid " : "") +
    (it.total == null ? it.priceText || "no price" : `${dollars(it.total)}${it.shipping > 0 ? ` incl. ${dollars(it.shipping)} shipping` : ""}`);

  const setCount = (n) => {
    countEl.textContent = String(n);
    countEl.hidden = !n;
  };

  // ---------- stickers on the listing cards ----------

  // Stickers live in the page, so their CSS goes into the page once. They read as a small paper tag
  // whatever the site's own colours are.
  // The marks sit on the site's page, so they take its brightness: its real background (so a site's dark mode or
  // a dark-mode extension counts), else the browser's setting, else dark.
  const pageIsDark = () => {
    const lum = (c) => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const [r, g, b, a = 1] = m[1].split(/[\s,\/]+/).filter(Boolean).map(Number);
      if (a < 0.5) return null;
      const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    for (const el of [document.body, document.documentElement]) {
      const l = el && lum(getComputedStyle(el).backgroundColor);
      if (l != null) return l < 0.2;
    }
    return !matchMedia("(prefers-color-scheme: light)").matches;
  };
  const syncPageTheme = () => {
    const t = pageIsDark() ? "dark" : "light";
    if (document.documentElement.dataset.slTheme !== t) document.documentElement.dataset.slTheme = t;
    wrap.dataset.pageTheme = t; // the closed tab takes the page's colours, like the marks on the cards
  };
  syncPageTheme();
  const ensureStickerStyles = () => {
    syncPageTheme();
    if (document.getElementById("second-look-styles")) return;
    const st = document.createElement("style");
    st.id = "second-look-styles";
    // The marks wear the page's own brightness (see syncPageTheme): dark tokens on a dark page, light on a light one.
    const DK = "--sl-paper:#161513; --sl-ink:#ECE9E2; --sl-muted:#A9A59B; --sl-rule:rgba(255,255,255,.14); --sl-line:#858176; --sl-accent:#E2673C; --sl-on-accent:#161513; --sl-on-v:#161513; --sl-shadow:0 6px 18px -6px rgba(0,0,0,.7); --v-great:#5FD08B; --v-good:#B5D36A; --v-fair:#E0B050; --v-pass:#A9A59B; --v-suspicious:#FF8A80;";
    const LT = "--sl-paper:#FBFAF6; --sl-ink:#1B1A17; --sl-muted:#5C5850; --sl-rule:rgba(28,27,25,.14); --sl-line:#77736A; --sl-accent:#C8461F; --sl-on-accent:#fff; --sl-on-v:#fff; --sl-shadow:0 6px 18px -6px rgba(28,27,25,.38); --v-great:#0A6B35; --v-good:#4A6500; --v-fair:#85540A; --v-pass:#5C5850; --v-suspicious:#B00020;";
    st.textContent = `
      html[data-sl-theme="dark"] :is(.second-look-sticker, .second-look-marks) { ${DK} }
      html:not([data-sl-theme="dark"]) :is(.second-look-sticker, .second-look-marks) { ${LT} }
      .second-look-sticker { --c:var(--v-fair);
        position:absolute; top:10px; left:10px; z-index:50; display:flex; align-items:center; gap:9px; padding:4px 12px 4px 4px; max-width:var(--sl-fit, calc(100% - 20px));
        background:var(--sl-paper); color:var(--sl-ink); border-radius:4px; box-shadow:0 0 0 1px var(--sl-line), var(--sl-shadow);
        font:400 12px/1.2 "Atkinson Hyperlegible Next","Atkinson Hyperlegible",system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans",sans-serif; text-align:left; letter-spacing:normal; cursor:help;
        animation:sl-in .2s ease-out both; }
      @media (prefers-reduced-motion: reduce) { .second-look-sticker { animation:none; } }
      @keyframes sl-in { from { opacity:0; } to { opacity:1; } }
      .second-look-sticker[data-v="great"] { --c:var(--v-great); } .second-look-sticker[data-v="good"] { --c:var(--v-good); }
      .second-look-sticker[data-v="pass"] { --c:var(--v-pass); } .second-look-sticker[data-v="suspicious"] { --c:var(--v-suspicious); }
      .second-look-sticker .sl-score { flex:none; width:44px; height:44px; box-sizing:border-box; border:1.5px solid var(--c); border-radius:4px; color:var(--c);
        display:grid; place-content:center; text-align:center; line-height:1; }
      .second-look-sticker .sl-score b { display:block; font:700 18px/1 "Atkinson Hyperlegible Mono",ui-monospace,"SF Mono",Menlo,Consolas,monospace; font-variant-numeric:tabular-nums; }
      .second-look-sticker .sl-score i { display:block; margin-top:3px; font-weight:700; font-size:10px; line-height:1; font-family:inherit; font-style:normal; letter-spacing:.06em; text-transform:uppercase; }
      .second-look-sticker .sl-text { display:flex; flex-direction:column; gap:2px; min-width:0; }
      .second-look-sticker .sl-verdict { font-weight:700; font-size:14px; white-space:nowrap; }
      .second-look-sticker.sl-compact .sl-verdict { display:none; }
      .second-look-sticker.sl-compact .sl-text:not(:has(.sl-sub)) { display:none; }
      .second-look-sticker.sl-compact { padding-right:4px; }
      .second-look-sticker .sl-sub { font-size:12px; color:var(--sl-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      /* small chips: under a sticker, or on their own on a card that hasn't been scored */
      .second-look-sticker .sl-below { position:absolute; left:4px; top:100%; padding-top:5px; display:flex; flex-direction:column; align-items:flex-start; gap:6px; }
      /* Marketplace: top-right, and never into the top-left corner where Facebook puts "Just listed" */
      .second-look-sticker.sl-right, .second-look-marks.sl-right { left:auto; right:10px; max-width:max(120px, calc(100% - 110px)); }
      .second-look-marks.sl-right { justify-content:flex-end; }
      .second-look-sticker.sl-right .sl-below { left:auto; right:4px; align-items:flex-end; }
      .second-look-sticker.sl-right .sl-under { justify-content:flex-end; }
      .second-look-sticker .sl-under { display:flex; flex-wrap:wrap; gap:4px; width:max-content; max-width:var(--sl-fit, 320px); }
      .sl-chip { display:inline-flex; align-items:center; gap:3px; padding:2px 8px; border-radius:4px; background:var(--sl-ink); color:var(--sl-paper);
        font:600 12px/1.35 "Atkinson Hyperlegible Next","Atkinson Hyperlegible",system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans",sans-serif; white-space:nowrap; letter-spacing:normal; text-transform:none; }
      .sl-chip svg { width:11px; height:11px; }
      .sl-chip.k-new { background:var(--sl-accent); color:var(--sl-on-accent); } .sl-chip.k-good { background:var(--v-great); color:var(--sl-on-v); } .sl-chip.k-warn { background:var(--v-suspicious); color:var(--sl-on-v); }
      .sl-chip.k-plain { background:var(--sl-paper); color:var(--sl-ink); box-shadow:inset 0 0 0 1px var(--sl-line); }
      .sl-chip.k-deal { background:var(--sl-accent); color:var(--sl-on-accent); font-size:12px; padding:3px 9px; box-shadow:0 0 0 2px var(--sl-paper); }
      .second-look-marks { position:absolute; top:10px; left:10px; z-index:50; display:flex; flex-wrap:wrap; gap:4px; max-width:var(--sl-fit, calc(100% - 20px));
        filter:drop-shadow(0 2px 6px rgba(0,0,0,.35)); pointer-events:auto; }
      .second-look-marks button, .second-look-sticker .sl-under button { cursor:pointer; border:0; }
      /* Hover-only actions stay in the DOM (clipped, not display:none) so the keyboard can reach them; they show on hover or focus. */
      .sl-x { position:absolute !important; width:1px !important; height:1px !important; margin:-1px !important; padding:0 !important; overflow:hidden !important; clip-path:inset(50%) !important; }
      [data-second-look-key]:hover .sl-x, .second-look-marks:focus-within .sl-x, .second-look-sticker:focus-within .sl-x, .sl-x:focus-visible
        { position:static !important; width:auto !important; height:auto !important; margin:0 !important; padding:2px 7px !important; overflow:visible !important; clip-path:none !important; }
      /* listings you've hidden, filtered out, or (by choice) skipped */
      html:not([data-sl-showhidden]) [data-sl-hide] { display:none !important; }
      html[data-sl-showhidden] [data-sl-hide] { opacity:.45; }
      /* Dim fades the card but not its tag or chips: a scam warning stays the most legible thing on it.
         The fade goes on the biggest parts of the card that hold no tag, so it never stacks. */
      html[data-sl-skip="dim"] :is([data-sl-v="pass"], [data-sl-v="suspicious"]):not(:hover):has(.second-look-sticker, .second-look-marks) > :not(:has(.second-look-sticker, .second-look-marks)):not(.second-look-sticker, .second-look-marks),
      html[data-sl-skip="dim"] :is([data-sl-v="pass"], [data-sl-v="suspicious"]):not(:hover) :has(.second-look-sticker, .second-look-marks) > :not(:has(.second-look-sticker, .second-look-marks)):not(.second-look-sticker, .second-look-marks)
        { opacity:.38; filter:grayscale(1); transition:opacity .2s, filter .2s; }
      html[data-sl-skip="hide"] :is([data-sl-v="pass"], [data-sl-v="suspicious"]) { display:none !important; }
      /* Facebook's later grid cells paint over earlier ones: lift the card whose tag you're hovering */
      [data-sl-cell]:has(.second-look-sticker:hover, .second-look-marks:hover) { position:relative; z-index:2147483000 !important; }
      .second-look-sticker .sl-acts { display:flex; flex-wrap:wrap; gap:6px 12px; margin-top:8px; padding-top:8px; border-top:1px solid var(--sl-rule); }
      .second-look-sticker .sl-acts button, .second-look-sticker .sl-acts a { all:unset; cursor:pointer; color:var(--sl-ink); font-weight:600; font-size:13px;
        text-decoration:underline; text-decoration-color:var(--sl-rule); text-underline-offset:3px; }
      .second-look-sticker .sl-acts :is(button, a):hover { text-decoration-color:currentColor; }
      .second-look-sticker .sl-pop { display:none; width:264px; max-width:min(264px, 80vw); padding:12px 14px;
        background:var(--sl-paper); color:var(--sl-ink); border-radius:4px; box-shadow:0 0 0 1px var(--sl-line), var(--sl-shadow);
        font:400 13px/1.5 "Atkinson Hyperlegible Next","Atkinson Hyperlegible",system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans",sans-serif; white-space:normal; text-transform:none; cursor:auto; }
      .second-look-sticker:hover .sl-pop, .second-look-sticker:focus-within .sl-pop { display:block; }
      .second-look-sticker:focus-visible { outline:2px solid var(--sl-ink); outline-offset:3px; }
      .second-look-sticker .sl-pop b { display:block; margin-bottom:4px; font-weight:700; font-size:15px; line-height:1.3; }
      .second-look-sticker .sl-pop b span { color:var(--c); }
      .second-look-sticker .sl-flags { margin-top:6px; color:var(--sl-muted); }
      .second-look-flash { outline:2px solid #C8461F !important; outline-offset:4px; animation:sl-flash 2s ease-out both; }
      @keyframes sl-flash { 0%, 60% { outline-color:#C8461F; } 100% { outline-color:transparent; } }`;
    document.head.append(st);
  };

  // Facebook recycles card elements as you scroll, which drops our stickers. Remember each
  // listing by its URL and put the decoration back when its card reappears.
  let scored = new Map(); // key -> scored item
  let seen = new Set(); // keys already sent for scoring (or being scored), so a re-scan only does what's new
  const keyOf = SL.keyOf;
  const ITEM_LINK = 'a[href*="/marketplace/item/"]';

  // ---------- what's known about each listing without asking a model ----------
  // Card facts (auction, lot, offers, seller rating) come from the adapters. On top of those:
  // whether you've seen it before and at what price, duplicates on the page, your filters, and
  // listings you've marked "Not interested". All of it stays in this browser.
  const MEMORY_DAYS = 90;
  const MEMORY_MAX = 6000;
  // Prices are the item price without shipping: shipping isn't always readable (and varies), so
  // comparing totals would invent drops. Auctions aren't tracked for drops: their price only rises.
  let memory = {}; // key -> { p: last price seen, pa: since when, f: first seen, a: last seen, o: first opened, h: earlier [price, since] }
  let notInterested = {}; // key -> { t: title, a: when }
  let prefs = { hideWords: "", needWords: "", minSellerRatings: 10, minSellerPct: 97, autoMarks: true };
  let skipMode = "dim";
  let showHidden = false;
  let facts = new Map(); // key -> facts for this page view
  let codeStems = {}; // Facebook title without its trailing code -> { c: { code: listing key }, a: last seen }
  let saved = {}; // key -> { t: title, u: url, img, p0: price when saved, a0: when, p: last price seen, a: last seen }
  let savedSearches = {}; // "site|query" -> { site, q, url, a0: when saved, v: last visit, n: listings then, fresh: new to you then }
  const dirtyMemory = new Set();
  const dirtyStems = new Set();
  const memoryReady = chrome.storage.local.get(["listingMemory", "notInterested", "skipMode", "codeStems", "saved", "savedSearches"]).then((v) => {
    memory = v.listingMemory || {};
    codeStems = v.codeStems || {};
    saved = v.saved || {};
    savedSearches = v.savedSearches || {};
    notInterested = v.notInterested || {};
    skipMode = ["show", "dim", "hide"].includes(v.skipMode) ? v.skipMode : "dim"; // greyed out unless you choose otherwise
    document.documentElement.dataset.slSkip = wrap.dataset.skipmode = skipMode;
  });
  const loadPrefs = () =>
    send("getSettings")
      .then((s) => {
        prefs = { hideWords: s.hideWords, needWords: s.needWords, minSellerRatings: +s.minSellerRatings || 0, minSellerPct: +s.minSellerPct || 0, autoMarks: s.autoMarks !== false };
      })
      .catch(() => {});
  const prefsReady = loadPrefs();

  // Several tabs may write at once, so merge into what's stored instead of overwriting it.
  let memoryTimer = 0;
  const saveMemorySoon = () => {
    clearTimeout(memoryTimer);
    memoryTimer = setTimeout(async () => {
      if (!dirtyMemory.size || !alive()) return;
      const { listingMemory = {} } = await chrome.storage.local.get("listingMemory");
      for (const k of dirtyMemory) listingMemory[k] = memory[k];
      dirtyMemory.clear();
      const cutoff = Date.now() - MEMORY_DAYS * 864e5;
      const kept = Object.entries(listingMemory).filter(([, r]) => r && r.a > cutoff).sort((a, b) => a[1].a - b[1].a).slice(-MEMORY_MAX);
      memory = Object.fromEntries(kept);
      await chrome.storage.local.set({ listingMemory: memory });
    }, 300); // soon: if you click through to a listing, a slower save would be lost
  };

  // Scam campaigns: one fake listing posted over and over, each copy with its own code on the end of
  // the title ("... Advance SP M2465", "... Advance SP K7731"). Two codes on one title, here or on any
  // page in the last month, and every copy is certainly fake; no model needed.
  const STEM_DAYS = 30;
  let stemTimer = 0;
  const noteCode = (key, title, code) => {
    const stem = SL.titleStem(title, code);
    if (stem.split(" ").length < 4) return ""; // short titles ("Nikon camera") collide by chance
    const rec = (codeStems[stem] ||= { c: {}, a: 0 });
    if (rec.c[code] === key) return stem; // nothing new: no write
    rec.c[code] = key;
    rec.a = Date.now();
    dirtyStems.add(stem);
    clearTimeout(stemTimer);
    stemTimer = setTimeout(async () => {
      if (!dirtyStems.size || !alive()) return;
      const { codeStems: stored = {} } = await chrome.storage.local.get("codeStems");
      for (const k of dirtyStems) stored[k] = codeStems[k];
      dirtyStems.clear();
      const cutoff = Date.now() - STEM_DAYS * 864e5;
      codeStems = Object.fromEntries(Object.entries(stored).filter(([, r]) => r?.a > cutoff).sort((a, b) => a[1].a - b[1].a).slice(-3000));
      await chrome.storage.local.set({ codeStems });
    }, 300); // soon: a reload right after would lose it, and this is rare
    return stem;
  };
  // The other codes this title has been posted under (by other listings), if any.
  const otherCodes = (key, stem, code) => Object.entries(codeStems[stem]?.c || {}).filter(([c, k]) => c !== code && k !== key).map(([c]) => c);

  // Records a sighting; returns { isNew, drop } relative to what was remembered before.
  const remember = (key, price, pageHadKnown, auction = false) => {
    const rec = memory[key];
    const now = Date.now();
    const out = { isNew: !rec && pageHadKnown, known: !!rec };
    if (auction) price = null; // keep the last fixed price, if any; a current bid says nothing about drops
    if (rec && price != null && rec.p != null && price < rec.p - Math.max(1, rec.p * 0.03)) out.drop = { from: rec.p, since: rec.pa };
    // Every price change is kept (the last five), so a listing page can show its history.
    const changed = rec && price != null && rec.p != null && rec.p !== price;
    const hist = changed ? [...(rec.h || []), [rec.p, rec.pa]].slice(-5) : rec?.h;
    memory[key] = { p: price ?? rec?.p ?? null, pa: rec && (price == null || rec.p === price) ? rec.pa : now, f: rec?.f ?? now, a: now, ...(rec?.o && { o: rec.o }), ...(hist?.length && { h: hist }) };
    dirtyMemory.add(key);
    saveMemorySoon();
    return out;
  };

  const wordList = (s) => (s || "").split(/[,\n]/).map((w) => w.trim().toLowerCase()).filter(Boolean);
  const reEscape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // "charger/adapter" = either word. Matches whole words, so "repro" doesn't catch "reproduced".
  const hasWord = (text, w) => w.split("/").some((alt) => alt.trim() && new RegExp(`(^|[^a-z0-9])${reEscape(alt.trim())}($|[^a-z0-9])`, "i").test(text));
  // Why a listing is filtered out ("" if it isn't): your settings' word lists, then this search's filter bar.
  const filterReason = (f) => {
    const title = f.title || "";
    for (const w of wordList(prefs.hideWords)) if (hasWord(title, w)) return `“${w}”`;
    for (const w of wordList(prefs.needWords)) if (!hasWord(title, w)) return `no “${w}”`;
    return quickReason(f);
  };

  // ---------- the filter bar: per search, remembered, no AI ----------
  // Words work like an eBay search: "dmg -case -game" needs dmg and drops anything with case or game;
  // "a/b" is either; quotes keep a phrase together. They match the title and the card's text, so
  // "-china" catches "from China" on eBay. Prices include shipping when the card shows it.
  // deal: your own price for this search. Not a filter: cards at or under it are marked, and the tab
  // on the page edge counts them even with the panel closed.
  // broken: "hide" drops listings that say broken/untested/for parts (Use), "only" keeps just those (Fix).
  const NO_QUICK = { words: "", min: 0, max: 0, fresh: false, broken: "", deal: 0 };
  let quick = { ...NO_QUICK };
  let quickReady = Promise.resolve(); // this search's saved filter, loaded on each page change
  const quickTerms = (words) =>
    [...(words || "").matchAll(/(-?)"([^"]+)"|(-?)(\S+)/g)]
      .map((m) => ({ not: !!(m[1] || m[3]), w: (m[2] || m[4] || "").toLowerCase() }))
      .filter((t) => t.w && t.w !== "-");
  const quickReason = (f) => {
    const text = `${f.title || ""} ${f.text || ""}`;
    for (const t of quickTerms(quick.words)) {
      if (t.not && hasWord(text, t.w)) return `“${t.w}”`;
      if (!t.not && !hasWord(text, t.w)) return `no “${t.w}”`;
    }
    const p = f.total ?? f.price;
    if (quick.min > 0 && p != null && p < quick.min) return `under $${quick.min}`;
    if (quick.max > 0 && p != null && p > quick.max) return `over $${quick.max}`;
    if (quick.fresh && f.known) return "seen before";
    if (quick.broken === "only" && !f.project) return "not broken";
    if (quick.broken === "hide" && f.project) return `\u201c${f.project}\u201d`;
    return "";
  };
  const quickActive = () => !!(quick.words.trim() || quick.min || quick.max || quick.fresh || quick.broken);
  const isDeal = (f) => quick.deal > 0 && f.total != null && f.total <= quick.deal && !likelyScam(f);
  const dealCount = () => [...facts.values()].filter((f) => f.deal && !f.hidden && !f.filtered).length;

  // Words that say "fix-up project" (what a fixer hunts for, and Marketplace can't search for all at
  // once) and words that say the seller wants it gone. Read from the title and card text.
  const PROJECT =
    /\b(for parts(?: or repair| only)?|parts only|parts or repair|not working|non[- ]?working|untested|as[- ]is|broken|no power|won'?t (?:turn|power) on|doesn'?t (?:work|turn on|power on)|needs (?:repair|work|fixing|a new \w+)|faulty|for repair|disc read error|no (?:display|video|sound|picture)|red ring|yellow light|cracked screen|water damage)\b/i;
  const MOTIVATED = /\b(moving(?: sale)?|must go|need(?:s)? (?:it )?gone|estate sale|cleaning out|garage sale|downsizing|first come first served|priced to sell|quick sale)\b/i;
  const clueOf = (re, text) => (text.match(re)?.[1] || "").toLowerCase().replace(/\s+/g, " ");
  const sellerWarning = (f) => {
    if (f.sellerCount != null && f.sellerCount < prefs.minSellerRatings) return f.sellerCount === 0 ? "New seller" : `Seller: ${f.sellerCount} ratings`;
    if (f.sellerPct != null && f.sellerPct < prefs.minSellerPct) return `Seller ${f.sellerPct}% positive`;
    return "";
  };
  const normTitle = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const shortDate = (ts) => new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const CARD_FACTS = ["auction", "bids", "timeLeft", "hoursLeft", "bestOffer", "lot", "sellerPct", "sellerCount", "titleCode", "offSite", "justListed", "wasPrice"];
  const lensSearchUrl = (img) => `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(SL.bigImage(img))}`;

  // A likely scam without asking a model: a reposted listing, a code on the end of the title (until a
  // scan says it's the real model number), or a disguised way to get in touch off the site.
  const likelyScam = (f) => !!(f && (f.campaign || (f.titleCode && !f.codeOk) || f.offSite?.sure));

  // The chips a card wears: most useful first, three at most.
  const chipsFor = (f = {}) => {
    const c = [];
    if (showHidden && f.hidden) c.push(["warn", "Not interested"]);
    else if (showHidden && f.filtered) c.push(["warn", `Filtered: ${f.filtered}`]);
    if (f.deal) c.push(["deal", `At your $${quick.deal}`]);
    if (f.campaign) c.push(["warn", "Scam: reposted"]);
    else if (f.offSite?.sure) c.push(["warn", "Scam: off-site contact"]);
    else if (f.titleCode && !f.codeOk) c.push(["warn", `Code in title: ${f.titleCode}`]);
    if (f.offSite && !f.offSite.sure) c.push(["warn", "Contact outside the site?"]);
    if (f.drop && f.price != null) c.push(["good", `↓ ${dollars(Math.round((f.drop.from - f.price) * 100) / 100)} since ${shortDate(f.drop.since)}`]);
    else if (f.wasPrice && f.price != null) c.push(["good", `\u2193 was ${dollars(f.wasPrice)}`]);
    if (f.vsSold != null) c.push([f.vsSold <= 0.7 ? "good" : "plain", `${Math.round(f.vsSold * 100)}% of sold`]);
    if (f.isNew) c.push(["new", "New to you"]);
    // Fixers want "untested" and "no power"; for anyone else it's a warning.
    if (f.project) c.push([lens === "use" ? "plain" : "good", f.project]);
    if (f.motivated) c.push(["plain", f.motivated]);
    if (f.sellerWarn) c.push(["warn", f.sellerWarn]);
    if (f.dup) c.push(["warn", `Same title ×${f.dup}`]);
    // An auction in its last few hours, especially with no bids, is when bargains happen.
    if (f.auction && f.hoursLeft != null && f.hoursLeft <= 3) c.push(["new", `Ends in ${f.timeLeft}${f.bids === 0 ? " · no bids" : ""}`]);
    else if (f.auction) c.push(["plain", `Auction${f.timeLeft ? ` · ${f.timeLeft} left` : ""}`]);
    if (f.lot) c.push(["plain", `Lot of ${f.lot}`]);
    if (f.bestOffer) c.push(["plain", "Offers"]);
    return c.slice(0, 3);
  };
  const chipEls = (f) => chipsFor(f).map(([kind, text]) => h("span", { class: `sl-chip k-${kind}` }, text));

  // Our own buttons sit inside the site's card (on Facebook, inside the link): keep the click ours.
  const own = (fn) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    fn(e);
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
  // What gets hidden or dimmed: the whole grid cell, so Facebook doesn't leave blank holes.
  const cellOf = (el) => {
    if (SL.currentSite() !== "facebook") return el;
    let node = el;
    for (let i = 0; i < 10 && node.parentElement && node.parentElement.querySelectorAll(ITEM_LINK).length === 1; i++) node = node.parentElement;
    return node;
  };

  const undecorate = (host) => {
    if (host.dataset.secondLookPos) host.style.position = "";
    for (const a of ["data-second-look", "data-second-look-key", "data-second-look-pos", "data-sl-hide", "data-sl-v", "data-sl-cell"]) host.removeAttribute(a);
    host.querySelectorAll(":scope > .second-look-sticker, :scope > .second-look-marks").forEach((n) => n.remove());
    const cell = host.closest("[data-sl-hide], [data-sl-v], [data-sl-cell]");
    for (const a of ["data-sl-hide", "data-sl-v", "data-sl-cell"]) cell?.removeAttribute(a);
  };

  // Dress one card: a sticker if it's been scored, otherwise just its chips; hidden if you said so.
  // Redrawing a card's marks replaces their elements; if the keyboard was on one of them (pressing Save
  // turns it into "Saved"), put focus back on the same place in the new marks instead of losing it.
  const decorate = (key, linkEl) => {
    const marks = linkEl?.isConnected ? cellOf(linkEl).querySelector(".second-look-sticker, .second-look-marks") : null;
    const at = marks && marks.contains(document.activeElement) ? [...marks.querySelectorAll("button")].indexOf(document.activeElement) : null;
    redecorate(key, linkEl);
    if (at == null) return;
    const now = cellOf(linkEl).querySelector(".second-look-sticker, .second-look-marks");
    (now?.querySelectorAll("button")[at] || now)?.focus({ preventScroll: true });
  };
  const redecorate = (key, linkEl) => {
    if (!linkEl?.isConnected) return;
    ensureStickerStyles();
    const host = stickerHost(linkEl);
    const cell = cellOf(linkEl);
    const f = facts.get(key) || {};
    const it = scored.get(key);
    host.setAttribute("data-second-look-key", key);
    cell.setAttribute("data-sl-cell", "");
    if (getComputedStyle(host).position === "static") {
      host.style.position = "relative";
      host.setAttribute("data-second-look-pos", "1");
    }
    if (f.hidden || f.filtered) cell.setAttribute("data-sl-hide", f.hidden ? "not-interested" : "filter");
    else cell.removeAttribute("data-sl-hide");
    if (it || likelyScam(f)) cell.setAttribute("data-sl-v", it ? it.verdict : "suspicious");
    else cell.removeAttribute("data-sl-v");
    // Clear the whole cell, not just this host: on Facebook the host can be a different box than
    // last time (layout settles after load), and old marks left on the other one made two layers.
    cell.querySelectorAll(".second-look-sticker, .second-look-marks").forEach((n) => n.remove());
    cell.querySelectorAll("[data-second-look-key]").forEach((n) => n !== host && n.removeAttribute("data-second-look-key"));
    // On eBay the card holds photo and text side by side (list view) or stacked (grid); either way the
    // tag and chips stay on the photo instead of running over the title.
    // On Marketplace, Facebook puts its own labels ("Just listed") at the photo's top-left, so ours
    // go top-right.
    const fit = (node) => {
      const w = SL.currentSite() === "ebay" ? host.querySelector("img")?.getBoundingClientRect().width : 0;
      if (w > 80 && w < host.getBoundingClientRect().width - 40) node.style.setProperty("--sl-fit", `${Math.round(w - 20)}px`);
      if (SL.currentSite() === "facebook") node.classList.add("sl-right");
      // On a narrow card the long verdict ("Great deal") would be cut off; the tag's own word says it already.
      if (SL.currentSite() === "facebook" && host.getBoundingClientRect().width < 250) node.classList.add("sl-compact");
      return node;
    };
    if (it) {
      it.el = linkEl;
      host.setAttribute("data-second-look", it.verdict);
      host.append(fit(stickerEl(it, f, key)));
      return;
    }
    host.removeAttribute("data-second-look");
    if (!prefs.autoMarks && !(showHidden && (f.hidden || f.filtered))) return;
    const chips = chipEls(f);
    if (showHidden && f.hidden) chips.push(h("button", { class: "sl-chip k-plain", onclick: own(() => setInterested(key, true)) }, "Undo"));
    else if (!f.hidden) chips.push(...hoverChips(key, f)); // Save / Sold / Not interested appear when you hover the card
    host.append(fit(h("div", { class: `second-look-marks` }, chips)));
  };
  const stick = (item) => decorate(keyOf(item.url), item.el);
  // "✕ Not interested", shown on any card while you hover it.
  const hideChip = (key) => h("button", { class: "sl-chip k-plain sl-x", title: "Hide this listing everywhere (undo from the panel)", onclick: own(() => setInterested(key, false)) }, "\u2715 Not interested");
  // eBay's sold listings for this title, in a new tab: price research by hand, nothing automated.
  const soldLink = (title) => SL.soldUrl(SL.titleToQuery(title), SL.SOLD_CONDITION.used);
  // What every card offers on hover. A saved listing keeps its star showing.
  const hoverChips = (key, f) => [
    saved[key]
      ? h("button", { class: "sl-chip k-good", title: "Saved in the panel (click to remove)", onclick: own(() => toggleSave(key)) }, "\u2605 Saved")
      : h("button", { class: "sl-chip k-plain sl-x", title: "Keep it under Saved in the panel", onclick: own(() => toggleSave(key)) }, "\u2606 Save"),
    f.title ? h("button", { class: "sl-chip k-plain sl-x", title: "What this sold for on eBay (new tab)", onclick: own(() => window.open(soldLink(f.title), "_blank", "noopener")) }, "Sold \u2197") : null,
    hideChip(key),
  ];

  // ---------- saved listings and searches (kept in this browser, across both sites) ----------
  // Several tabs may write at once, so each change is merged into what's stored.
  const writeStored = async (name, mutate) => {
    const stored = (await chrome.storage.local.get(name))[name] || {};
    mutate(stored);
    await chrome.storage.local.set({ [name]: stored });
    return stored;
  };
  const toggleSave = async (key) => {
    const f = facts.get(key) || scored.get(key) || (itemFacts?.key === key ? itemFacts : {});
    const was = !!saved[key];
    saved = await writeStored("saved", (s) => {
      if (was) delete s[key];
      else s[key] = { t: f.title || "", u: f.url || location.href.split("?")[0], img: f.imageUrl || "", p0: f.price ?? null, a0: Date.now(), p: f.price ?? null, a: Date.now() };
    });
    afterSavedChange();
    setStatus(was ? "Removed from Saved." : `Saved \u201c${(f.title || "listing").slice(0, 50)}\u201d. It's under Saved at the bottom of the panel.`, false, { label: "Undo", fn: () => toggleSave(key) });
  };
  const searchKey = (q) => `${SL.currentSite()}|${q.trim().toLowerCase()}`;
  const pageSearch = () => (SL.currentSite() === "ebay" ? SL.ebayQuery() : SL.facebookQuery()).trim();
  const toggleSearch = async (q) => {
    const k = searchKey(q);
    const was = !!savedSearches[k];
    savedSearches = await writeStored("savedSearches", (s) => {
      if (was) delete s[k];
      else s[k] = { site: SL.currentSite(), q, url: location.href, a0: Date.now(), v: Date.now(), n: facts.size, fresh: 0, deal: quick.deal || 0, deals: dealCount() };
    });
    afterSavedChange();
    setStatus(was ? "Search removed from Saved." : `Saved the search \u201c${q}\u201d. Open it again from Saved; new listings will say "New to you".`);
  };
  // ---------- views: This page | Saved ----------
  let view = "page";
  const setView = (v) => {
    view = v;
    root.querySelectorAll("[data-view]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.view === v)));
    $(".view-page").hidden = v !== "page";
    $(".view-saved").hidden = v !== "saved";
    $(".body").scrollTop = 0;
    if (v === "saved") renderSaved();
  };
  root.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));
  const siteName = (k) => (k.startsWith("fb") ? "Marketplace" : "eBay");
  const removeStored = async (name, k) => {
    const next = await writeStored(name, (s) => delete s[k]);
    if (name === "saved") saved = next;
    else savedSearches = next;
    afterSavedChange();
  };
  // The Saved view: listings with the price you saved them at and the latest you've seen, searches
  // with when you last looked, and what you've hidden (each one can come back). Built when shown.
  const itemUrl = (k) => (k.startsWith("fb:") ? `https://www.facebook.com/marketplace/item/${k.slice(3)}/` : `https://www.ebay.com/itm/${k.slice(5)}`);
  const renderSaved = () => {
    const items = Object.entries(saved).sort((a, b) => b[1].a0 - a[1].a0);
    const searches = Object.entries(savedSearches).sort((a, b) => b[1].v - a[1].v);
    const hidden = Object.entries(notInterested).sort((a, b) => b[1].a - a[1].a);
    $(".nav .cnt").textContent = items.length + searches.length ? String(items.length + searches.length) : "";
    if (view !== "saved") return;
    const sayHere = (text, err = false) => {
      const st = $(".saved-status");
      st.textContent = text;
      st.classList.toggle("err", err);
    };
    const priceLine = (k, r) => {
      const now = r.p != null ? dollars(r.p) : "no price";
      const moved = r.p0 != null && r.p != null && r.p !== r.p0;
      return [
        `${siteName(k)} \u00b7 ${now}`,
        moved ? h("span", { class: r.p < r.p0 ? "down" : "" }, ` (${r.p < r.p0 ? "\u2193" : "\u2191"} from ${dollars(r.p0)})`) : "",
        ` \u00b7 ${r.a - r.a0 > 60000 ? `seen ${shortDate(r.a)}` : `saved ${shortDate(r.a0)}`}`,
      ];
    };
    const copy = h("button", {
      onclick: async () => {
        const text = items.map(([k, r]) => `${r.t} \u2014 ${r.p != null ? dollars(r.p) : "no price"} (${siteName(k)})\n${r.u}`).join("\n\n");
        try {
          await navigator.clipboard.writeText(text);
          copy.textContent = "Copied";
        } catch {
          copy.textContent = "Couldn't copy";
        }
      },
    }, "Copy the list");
    $(".saved-body").replaceChildren(
      ...[
            !items.length && !searches.length
              ? h("div", { class: "hint" }, "Hover any card and press Save to keep it here, or save a search from the actions under the Scan button. Both sites, kept in this browser. Prices update whenever the listing is on your screen again.")
              : null,
            items.length ? h("b", { class: "sub" }, `Listings \u00b7 ${items.length}`) : null,
            ...items.map(([k, r]) =>
              h(
                "div",
                { class: "srow" },
                h("div", {}, h("a", { href: r.u, target: "_blank", rel: "noopener" }, r.t || r.u), h("div", { class: "meta" }, priceLine(k, r))),
                h("button", { class: "srow-act", title: "Remove from Saved", onclick: () => removeStored("saved", k) }, "Remove")
              )
            ),
            items.length ? h("div", { class: "actions sv-acts" }, copy) : null,
            searches.length ? h("b", { class: "sub" }, `Searches \u00b7 ${searches.length}`) : null,
            ...searches.map(([k, r]) =>
              h(
                "div",
                { class: "srow" },
                h(
                  "div",
                  {},
                  h("a", { href: r.url, title: "Run this search again" }, `\u201c${r.q}\u201d`),
                  h("div", { class: "meta" }, [
                    `${r.site === "ebay" ? "eBay" : "Marketplace"} \u00b7 looked ${shortDate(r.v)}${r.n ? ` \u00b7 ${r.n} listings` : ""}${r.fresh ? `, ${r.fresh} new then` : ""}`,
                    r.deal ? h("span", { class: r.deals ? "down" : "" }, ` \u00b7 ${r.deals || "none"} at your $${r.deal}`) : "",
                  ])
                ),
                h("button", { class: "srow-act", title: "Remove this search", onclick: () => removeStored("savedSearches", k) }, "Remove")
              )
            ),
            searches.length > 1
              ? h(
                  "div",
                  { class: "actions sv-acts" },
                  h("button", {
                    onclick: async () => {
                      const n = await send("openTabs", { urls: searches.map(([, r]) => r.url) }).catch(() => 0);
                      sayHere(n ? `Opened ${n} saved search${n === 1 ? "" : "es"} in background tabs. What's new in each says New to you.` : "Couldn't open the saved searches.", !n);
                    },
                    title: "Each saved search in its own background tab; what's new will say New to you",
                  }, `Open all ${searches.length} searches`)
                )
              : null,
            // Not interested: every one can come back, not just the last.
            hidden.length ? h("b", { class: "sub" }, `Hidden \u00b7 ${hidden.length}`) : null,
            ...hidden.slice(0, 40).map(([k, r]) =>
              h(
                "div",
                { class: "srow" },
                h("div", {}, h("a", { href: itemUrl(k), target: "_blank", rel: "noopener" }, r.t || itemUrl(k)), h("div", { class: "meta" }, `${siteName(k)} \u00b7 hidden ${shortDate(r.a)}`)),
                h("button", { class: "srow-act", title: "Show this listing again", onclick: () => setInterested(k, true) }, "Unhide")
              )
            ),
            hidden.length > 40 ? h("div", { class: "hint" }, `and ${hidden.length - 40} older`) : null,
            hidden.length > 1
              ? h(
                  "div",
                  { class: "actions sv-acts" },
                  h("button", {
                    onclick: async () => {
                      if (!confirm(`Show all ${hidden.length} hidden listings again?`)) return;
                      notInterested = {};
                      await chrome.storage.local.set({ notInterested: {} });
                      redecorateAll();
                      renderSaved();
                      sayHere("Everything you hid is back.");
                    },
                  }, "Unhide all")
                )
              : null,
          ].filter(Boolean)
    );
  };
  // After any change to Saved (here, or in another tab): the section, the cards' stars, the listing view.
  const afterSavedChange = () => {
    renderSaved();
    if (SL.pageType() === "results" && facts.size) redecorateAll();
    if (SL.pageType() === "item") renderItemInfo();
  };
  chrome.storage.onChanged.addListener((changes) => {
    if (!alive() || !(changes.saved || changes.savedSearches)) return;
    if (changes.saved) saved = changes.saved.newValue || {};
    if (changes.savedSearches) savedSearches = changes.savedSearches.newValue || {};
    afterSavedChange();
  });
  memoryReady.then(renderSaved);

  // The same words on the other site, in a new tab.
  const otherSiteUrl = (q) =>
    SL.currentSite() === "ebay" ? `https://www.facebook.com/marketplace/search?query=${encodeURIComponent(q)}` : `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(q)}`;


  const reapplyFacebook = () => {
    if ((!scored.size && !facts.size) || SL.currentSite() !== "facebook") return;
    document.querySelectorAll(ITEM_LINK).forEach((a) => {
      const key = keyOf(a.href);
      // Cheap check first (no layout reads): is this card still dressed for this listing?
      const tagged = a.closest("[data-second-look-key]");
      if (tagged?.dataset.secondLookKey === key && (tagged.querySelector(":scope > .second-look-sticker, :scope > .second-look-marks") || !scored.has(key))) return;
      if (scored.has(key) || facts.has(key)) decorate(key, a);
      else if (tagged && (tagged === a || tagged.querySelectorAll(ITEM_LINK).length === 1)) undecorate(tagged); // recycled for a listing we know nothing about
    });
  };

  const clearStickers = () => {
    scored = new Map();
    seen = new Set();
    document.querySelectorAll("[data-second-look-key]").forEach(undecorate);
    document.querySelectorAll("[data-sl-hide], [data-sl-v], [data-sl-cell]").forEach((n) => {
      for (const a of ["data-sl-hide", "data-sl-v", "data-sl-cell"]) n.removeAttribute(a);
    });
    document.querySelectorAll(".second-look-sticker, .second-look-marks").forEach((s) => s.remove());
  };

  // ---------- the page pass: runs when listings appear, no model involved ----------
  let passKeys = new Set();
  let pageHadKnown = null; // first visit to a search: nothing is "new to you" yet
  let passing = false;
  const pagePass = async (force = false) => {
    if (SL.pageType() !== "results" || passing) return;
    const keysNow = currentKeys();
    if (!force && keysNow.size === passKeys.size && [...keysNow].every((k) => passKeys.has(k))) return;
    passing = true;
    try {
      await Promise.all([memoryReady, prefsReady, quickReady]);
      const items = SL.extract();
      passKeys = keysNow;
      if (pageHadKnown === null && items.length) pageHadKnown = items.some((it) => memory[keyOf(it.url)]);
      // Same title (or same photo) on several listings: reposts, or one seller with several.
      const groups = new Map();
      for (const it of items) {
        const t = normTitle(it.title);
        if (t.split(" ").length >= 4) groups.set(`t:${t}`, [...(groups.get(`t:${t}`) || []), it]);
        if (it.imageUrl && !/^data:/.test(it.imageUrl)) groups.set(`i:${it.imageUrl}`, [...(groups.get(`i:${it.imageUrl}`) || []), it]);
      }
      const dup = new Map();
      for (const list of groups.values()) if (list.length > 1) list.forEach((it) => dup.set(it, Math.max(dup.get(it) || 0, list.length)));
      // Every coded title is noted first, so two copies on this page find each other.
      const stems = new Map(items.filter((it) => it.titleCode).map((it) => [it, noteCode(keyOf(it.url), it.title, it.titleCode)]));

      for (const it of items) {
        const key = keyOf(it.url);
        const prev = facts.get(key);
        const sighting = prev ? { fresh: prev.fresh, drop: prev.drop } : remember(key, it.price, !!pageHadKnown, !!it.auction);
        const f = { ...Object.fromEntries(CARD_FACTS.filter((k) => it[k] != null).map((k) => [k, it[k]])), fresh: sighting.fresh ?? sighting.isNew, drop: sighting.drop };
        const others = stems.get(it) ? otherCodes(key, stems.get(it), it.titleCode) : [];
        if (others.length) f.campaign = others.slice(0, 3);
        Object.assign(f, {
          title: it.title,
          price: it.price,
          priceText: it.priceText,
          shipping: it.shipping,
          total: it.total,
          url: it.url,
          imageUrl: it.imageUrl,
          sellerWarn: sellerWarning(it),
          dup: dup.get(it) || 0,
          text: (it.raw || "").replace(it.title, "").slice(0, 300),
          hidden: !!notInterested[key],
        });
        f.vsSold = vsSoldOf(f);
        f.known = prev ? prev.known : !!sighting.known;
        f.project = clueOf(PROJECT, `${it.title} ${f.text}`);
        f.motivated = clueOf(MOTIVATED, `${it.title} ${f.text}`);
        f.filtered = filterReason(f);
        f.deal = isDeal(f);
        facts.set(key, f);
      }
      await notePrices(items);
      if (!scansCache) await loadScans().catch(() => {});
      if (restoreScans(items)) {
        setCount(scored.size);
        scanInputs ??= inputsNow(); // changing wants or the comparison now offers a rescan, as after a scan
      }
      // "New to you" only helps on a search you come back to, and only when it picks out a few:
      // on a feed, or when most of the page is new anyway, every card would wear it.
      const all = [...facts.values()];
      const showNew = !!(SL.facebookQuery() || SL.ebayQuery()) && all.filter((f) => f.fresh).length <= all.length * 0.4;
      all.forEach((f) => (f.isNew = showNew && !!f.fresh));
      for (const it of items) decorate(keyOf(it.url), it.el);
      await noteSearchVisit(all);
      renderPageInfo();
      render();
      // Sold prices already looked up for this search (in the last few hours) apply for free.
      if (!lastMarket && !cacheTried) {
        cacheTried = true;
        const m = await cachedMarket(queryEl.value);
        if (m && !lastMarket) {
          renderMarket(m);
          applyMarket(m);
        }
      }
    } finally {
      passing = false;
    }
  };

  // ---------- prices without a model ----------
  // How a listing's total compares with the eBay sold median for this search. Lots and auctions
  // (where the price is only a bid) aren't compared with one item's selling price.
  let cacheTried = false;
  let marketFor = ""; // the search the cards' "% of sold" is for
  const vsSoldOf = (f) => (lastMarket?.median > 0 && f.total != null && !f.lot && !f.auction ? f.total / lastMarket.median : null);
  const applyMarket = (market) => {
    lastMarket = market;
    marketFor = queryEl.value.trim().toLowerCase();
    for (const f of facts.values()) f.vsSold = vsSoldOf(f);
    redecorateAll();
    refreshPending();
    showQuick(); // the "Deal at" box can now suggest a price
  };
  const cachedMarket = async (query) => {
    if (!query.trim()) return null;
    const { soldCache = {} } = await chrome.storage.local.get("soldCache");
    const hit = soldCache[`used:${query.trim().toLowerCase()}`];
    return hit?.market && Date.now() - hit.at < SOLD_TTL_MS ? { ...hit.market, condition: "used" } : null;
  };

  // Saved listings take the latest price whenever they're on screen (no checking in the background).
  const notePrices = async (items) => {
    const seenNow = items.filter((it) => saved[keyOf(it.url)] && it.price != null);
    const stale = seenNow.filter((it) => {
      const s = saved[keyOf(it.url)];
      return s.p !== it.price || Date.now() - s.a > 60 * 60 * 1000;
    });
    if (!stale.length) return;
    saved = await writeStored("saved", (s) => {
      for (const it of stale) if (s[keyOf(it.url)]) Object.assign(s[keyOf(it.url)], { p: it.price, a: Date.now() });
    });
  };
  // A saved search remembers when you last looked and how much was new then.
  const noteSearchVisit = async (all) => {
    const q = pageSearch();
    const rec = q && savedSearches[searchKey(q)];
    const deals = all.filter((f) => f.deal && !f.hidden && !f.filtered).length;
    if (!rec || (rec.n === all.length && rec.deals === deals && Date.now() - rec.v < 10 * 60 * 1000)) return;
    savedSearches = await writeStored("savedSearches", (s) => {
      const r = s[searchKey(q)];
      if (r) Object.assign(r, { v: Date.now(), n: all.length, fresh: all.filter((f) => f.fresh).length, deals, deal: quick.deal || 0, url: location.href });
    });
  };

  // Re-dress everything after a settings change (filters, marks, hidden toggle).
  const redecorateAll = () => {
    for (const [key, f] of facts) {
      f.filtered = filterReason(f);
      f.sellerWarn = sellerWarning(f);
      f.hidden = !!notInterested[key];
    }
    // Find each card directly: a hidden card can't always be read again by the adapter.
    for (const key of facts.keys()) {
      const el = elFor(key);
      if (el) decorate(key, el);
    }
    render();
    renderPageInfo();
  };

  // "Not interested": hidden on every page from now on (undo from the panel or settings).
  const setInterested = async (key, interested) => {
    const { notInterested: stored = {} } = await chrome.storage.local.get("notInterested");
    const f = facts.get(key) || scored.get(key) || {};
    if (interested) delete stored[key];
    else stored[key] = { t: f.title || "", a: Date.now() };
    const kept = Object.entries(stored).sort((a, b) => a[1].a - b[1].a).slice(-3000);
    notInterested = Object.fromEntries(kept);
    await chrome.storage.local.set({ notInterested });
    if (facts.has(key)) facts.get(key).hidden = !interested;
    const el = scored.get(key)?.el?.isConnected ? scored.get(key).el : elFor(key);
    if (el) decorate(key, el);
    render();
    renderPageInfo();
    renderSaved();
    if (!interested) setStatus(`Hidden “${(f.title || "listing").slice(0, 50)}”. Saved → Hidden lists everything you've hidden.`, false, { label: "Undo", fn: () => setInterested(key, true) });
    else setStatus("");
  };

  const stickerEl = (item, f, key) => {
    const v = VERDICT[item.verdict] || VERDICT.fair;
    const CAMERA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';
    const sub = lensLine(item);
    // The sticker's own line already says "Auction…" / "Lot of…" when it applies; don't repeat it below.
    const under = chipsFor(f)
      .filter(([, t]) => !(/^Auction/.test(t) && item.auction && item.related !== false) && !(/^Lot of/.test(t) && /^Lot of/.test(sub)) && !/% of sold$/.test(t))
      .map(([kind, text]) => h("span", { class: `sl-chip k-${kind}` }, text));
    if (item.photoAdjust) {
      const chip = h("span", { class: "sl-chip", title: "Photo check" }, signed(item.photoAdjust));
      chip.insertAdjacentHTML("afterbegin", CAMERA); // static markup, no page text involved
      under.unshift(chip);
    }
    const line = (text) => (text ? h("div", { class: "sl-flags" }, text) : null);
    return h(
      "div",
      { class: "second-look-sticker", "data-v": item.verdict, tabindex: "0", role: "group", "aria-label": `Second Look: score ${item.score}, ${v.label}. Tab to the reasons and actions.` },
      h("div", { class: "sl-score" }, h("b", {}, String(item.score)), h("i", {}, SHORT[item.verdict] || "")),
      h("div", { class: "sl-text" }, h("div", { class: "sl-verdict" }, v.label), sub ? h("div", { class: "sl-sub" }, sub) : null),
      // Below the tag, in one column: the chip row, then (on hover) the card with the reasons. However
      // many rows the chips wrap to, the card sits under them.
      h(
        "div",
        { class: "sl-below" },
        h("div", { class: "sl-under" }, under.slice(0, 3), hoverChips(key, { ...item, ...f })),
        h(
        "div",
        { class: "sl-pop" },
        h("b", {}, h("span", {}, String(item.score)), ` · ${v.label}`),
        item.related === false ? line("Not what you searched for, scored on the deal alone.") : null,
        f.campaign ? line(`Posted again with other codes (${f.campaign.join(", ")}): one fake listing copied many times. Don't message or pay.`) : null,
        !f.campaign && f.titleCode && !f.codeOk ? line(`The title ends in the code ${f.titleCode}: on Marketplace that's usually a bulk-posted fake, unless it's the real model number.`) : null,
        item.reason || "",
        item.scannedAt ? line(`Scored ${shortDate(item.scannedAt)}${item.scannedWith ? ` with ${nameOf(item.scannedWith)}` : ""}.`) : null,
        f.auction ? line(`Auction: ${f.bids || 0} bid${f.bids === 1 ? "" : "s"}${f.timeLeft ? `, ${f.timeLeft} left` : ""}. The price is only the current bid.${item.bidCap > 0 ? ` Worth bidding up to about ${dollars(item.bidCap)}${item.lens === "project" ? " to break even" : ""}.` : ""}`) : null,
        item.browse && item.sold ? line(`eBay sold \u201c${item.query}\u201d: median ${dollars(item.sold.median)}, middle half ${dollars(item.sold.p25)}\u2013${dollars(item.sold.p75)} (${item.sold.n} sales).`) : null,
        item.browse && !item.sold && item.est ? line(`Typical used price est. ${dollars(item.est.lo)}\u2013${dollars(item.est.hi)}: the model's estimate, not sales data.${item.query ? " Check sold prices in the panel for real numbers." : ""}`) : null,
        f.lot && item.total != null ? line(`Lot of ${f.lot}: about ${dollars(Math.round((item.total / f.lot) * 100) / 100)} each.`) : null,
        f.drop ? line(`Was ${dollars(f.drop.from)} when you saw it on ${shortDate(f.drop.since)}.`) : null,
        f.sellerWarn ? line(`${f.sellerWarn} (your rule: at least ${prefs.minSellerRatings} ratings, ${prefs.minSellerPct}% positive).`) : null,
        f.dup ? line(`${f.dup} listings on this page share this title or photo: a repost, or one seller with several.`) : null,
        item.fault && !/^none$/i.test(item.fault) ? line(`Likely fault: ${item.fault}${item.difficulty ? ` (difficulty ${item.difficulty}/5)` : ""}`) : null,
        item.photoAdjust ? line(`Photo check ${signed(item.photoAdjust)}: ${(item.photos || []).flatMap((p) => p.why).join("; ") || "see panel"}`) : null,
        item.flags?.length ? line(item.flags.join(" · ")) : null,
        item.imageUrl &&
        h(
          "div",
          { class: "sl-acts" },
          // Save, Sold and Not interested sit just above as chips; this adds what they don't.
          item.imageUrl ? h("a", { href: lensSearchUrl(item.imageUrl), target: "_blank", rel: "noopener", onclick: (e) => e.stopPropagation(), title: "Reverse image search: is this photo used elsewhere?" }, "Find this photo elsewhere \u2197") : null
        )
        )
      )
    );
  };

  // ---------- results list ----------

  const photoBox = (it) => {
    const box = h("div");
    (it.photos || []).forEach((p) => box.append(h("div", { class: p.adjust < 0 ? "photo drop" : "photo" }, photoText(p))));
    return box;
  };

  const isHidden = (it) => {
    const f = facts.get(keyOf(it.url));
    return !showHidden && (!!notInterested[keyOf(it.url)] || !!f?.filtered);
  };
  // Skipped and suspicious listings (and reposted scams, judged without a model) follow the Skipped setting.
  const isSkip = (it) => it.verdict === "pass" || it.verdict === "suspicious" || (it.score == null && likelyScam(facts.get(keyOf(it.url))));

  // Every listing on the page, scored or not: before a scan the list is the page in a form you
  // can sort, with the free facts; scoring fills in verdicts as they arrive.
  const pageItems = () => {
    const out = [];
    for (const [key, f] of facts) out.push(scored.get(key) || { ...f, key });
    for (const [key, it] of scored) if (!facts.has(key)) out.push(it);
    return out;
  };
  const sc = (it) => it.score ?? -1;
  const dealOf = (it) => (facts.get(keyOf(it.url))?.deal ? 1 : 0);
  const perItem = (it) => (it.total == null ? Infinity : it.lot ? it.total / it.lot : it.total);
  const vsSold = (it) => it.vsWorking ?? facts.get(keyOf(it.url))?.vsSold ?? Infinity;
  const endsIn = (it) => (it.auction ? (it.hoursLeft ?? 1e6) : Infinity);
  let sortMode = "score";
  // Ties keep the page's own order (sort is stable).
  const SORTS = {
    score: (a, b) => (a.score == null) - (b.score == null) || (a.related === false) - (b.related === false) || sc(b) - sc(a) || dealOf(b) - dealOf(a), // your search first
    price: (a, b) => perItem(a) - perItem(b) || sc(b) - sc(a),
    value: (a, b) => vsSold(a) - vsSold(b) || perItem(a) - perItem(b),
    margin: (a, b) => (b.margin ?? b.bidCap ?? -Infinity) - (a.margin ?? a.bidCap ?? -Infinity) || sc(b) - sc(a),
    ending: (a, b) => endsIn(a) - endsIn(b) || perItem(a) - perItem(b),
    new: (a, b) => {
      const rank = (it) => {
        const f = facts.get(keyOf(it.url)) || {};
        return f.drop ? 3 : f.isNew ? 2 : f.justListed ? 1 : 0;
      };
      return rank(b) - rank(a) || sc(b) - sc(a);
    },
  };
  const shownKeys = new Set(); // rows that already animated in; re-sorting shouldn't replay it
  const render = () => {
    listEl.replaceChildren();
    if (SL.pageType() !== "results") return;
    const by = SORTS[sortMode] || SORTS.score;
    pageItems()
      .filter((it) => !isHidden(it) && !(skipMode === "hide" && isSkip(it)))
      .sort((a, b) => isSkip(a) - isSkip(b) || by(a, b)) // skipped and likely scams go last, whatever the sort
      .forEach((it, i) => {
        const key = keyOf(it.url);
        const f = facts.get(key) || it;
        const still = shownKeys.has(key);
        shownKeys.add(key);
        const known = chipsFor(f)
          .filter(([, t]) => !/^Auction|^Lot of|% of sold$/.test(t))
          .map(([k, t]) => h("span", { class: `fchip k-${k}` }, t));
        const saveBtn = h("button", { class: saved[key] ? "on" : null, onclick: () => toggleSave(key) }, saved[key] ? "Saved" : "Save");
        const hideBtn = h("button", { onclick: () => setInterested(key, !!notInterested[key]) }, notInterested[key] ? "Undo hide" : "Not interested");
        // Not scored (yet): the price is the headline, with what's known for free.
        if (it.score == null) {
          const vs = f.vsSold != null ? ` \u00b7 ${Math.round(f.vsSold * 100)}% of sold median` : "";
          const each = it.lot && it.total != null ? ` \u00b7 lot of ${it.lot}, ${dollars(Math.round((it.total / it.lot) * 100) / 100)} each` : "";
          listEl.append(
            h(
              "div",
              { class: `row plain${still ? " still" : ""}${likelyScam(f) ? " skip" : ""}`, style: `--i:${Math.min(i, 8)}` },
              h(
                "div",
                {},
                h("button", { class: "title", onclick: () => focusCard(it) }, it.title),
                likelyScam(f) ? h("div", { class: "meta scamline" }, f.campaign ? "Likely scam: reposted under new codes" : f.offSite?.sure ? "Likely scam: asks to get in touch off the site" : `Likely scam: code ${f.titleCode} on the title (a scan can clear it if it's the model number)`) : null,
                (() => {
                  // The tag already shows the price; the line adds only what it doesn't say.
                  const bits = [it.shipping > 0 && `${dollars(it.total)} incl. ${dollars(it.shipping)} shipping`, it.auction && `current bid${it.timeLeft ? `, ${it.timeLeft} left` : ""}`, it.total == null && (it.priceText || "no price")]
                    .filter(Boolean)
                    .join(" \u00b7 ");
                  const line = `${bits}${vs}${each}`.replace(/^ \u00b7 /, "");
                  return line ? h("div", { class: "meta" }, line) : null;
                })(),
                known.length ? h("div", { class: "flags" }, known) : null
              ),
              h("div", { class: f.deal ? "pr deal" : "pr" }, it.total == null ? "\u2014" : `$${Math.round(it.total)}`),
              h(
                "div",
                { class: "actions row-acts" },
                h("a", { href: it.url, target: "_blank", rel: "noopener" }, "Open"),
                h("a", { href: soldLink(it.title), target: "_blank", rel: "noopener", title: "eBay sold listings for this title, in a new tab" }, "Sold \u2197"),
                saveBtn,
                hideBtn
              )
            )
          );
          return;
        }
        const v = VERDICT[it.verdict] || VERDICT.fair;
        const box = photoBox(it);
        const vsMarket =
          it.vsWorking != null && !it.auction && !it.lot
            ? it.refIsEstimate
              ? ` \u00b7 ~${Math.round(it.vsWorking * 100)}% of typical (est. ${dollars(it.est.lo)}\u2013${dollars(it.est.hi)})`
              : ` \u00b7 ${Math.round(it.vsWorking * 100)}% of sold median${it.sold ? ` (${it.sold.n} sales)` : ""}`
            : "";
        const line = lensLine(it);
        const flags = (it.flags || []).map((t) => h("span", { class: "flag" }, t));
        listEl.append(
          h(
            "div",
            { class: still ? "row still" : "row", style: `--i:${Math.min(i, 8)}` },
            tagEl(it.verdict, it.score),
            h(
              "div",
              {},
              h("button", { class: "title", onclick: () => focusCard(it) }, it.title),
              h("div", { class: "meta", "data-v": it.verdict }, h("span", { class: "verdict" }, v.label), `${it.related === false ? " (not your search)" : ""}${it.auction || it.shipping > 0 ? ` \u00b7 ${priceStr(it)}` : ""}${it.related === false ? "" : vsMarket}`),
              (it.lens !== "use" || it.auction || it.lot) && it.related !== false ? h("div", { class: it.margin < 0 ? "lensinfo neg" : "lensinfo" }, line + (it.fault && !/^none|unknown$/i.test(it.fault) ? ` \u00b7 ${it.fault}` : "")) : null,
              h("div", { class: "reason" }, it.reason || ""),
              // One row of chips: what's known for sure (filled) first, then the model's flags (outlined).
              known.length || flags.length ? h("div", { class: "flags" }, known, flags) : null
            ),
            h("div", { class: it.deal ? "pr deal" : "pr" }, it.total == null ? "\u2014" : `$${Math.round(it.total)}`),
            // Actions and photo notes run under the price too, so the four links fit on one line.
            h(
              "div",
              { class: "actions row-acts" },
              h("a", { href: it.url, target: "_blank", rel: "noopener" }, "Open"),
              it.browse && it.query && !it.sold ? h("button", { onclick: (e) => checkSold(it, e.currentTarget), title: `eBay sold listings for \u201c${it.query}\u201d` }, "Sold prices") : null,
              it.imageUrl ? h("button", { onclick: (e) => runPhotoCheck(it, box, e.currentTarget), title: "Ask the model to look at the photo (changes the score)" }, it.photos ? "Re-check photo" : "Check photo") : null,
              saveBtn,
              hideBtn
            ),
            box
          )
        );
      });
  };

  // Scroll to the card and outline it for a moment. If the open panel would cover it, tuck the
  // panel away (the tab stays, one click brings it back) so you can actually see the listing.
  // The card for a listing, found again from the page: the element kept from the scan can be gone
  // (sites re-render), and the first link to the item can sit outside the results (a carousel,
  // "recently viewed"), so prefer one inside a result card.
  const elFor = (key) => {
    const id = key.split(":")[1];
    if (key.startsWith("fb:")) {
      const links = [...document.querySelectorAll(`a[href*="/marketplace/item/${id}"]`)];
      return links.find((a) => a.closest("[data-second-look-key]")) || links.find((a) => a.getClientRects().length) || links[0] || null;
    }
    const links = [...document.querySelectorAll(`a[href*="/itm/"][href*="${id}"]`)].filter((a) => keyOf(a.href) === key);
    return links.map((a) => a.closest(SL.EBAY_CARDS)).find(Boolean) || null;
  };
  const focusCard = (it) => {
    const key = keyOf(it.url);
    const el = it.el?.isConnected ? it.el : elFor(key) || document.querySelector(`[data-second-look-key="${CSS.escape(key)}"]`);
    if (!el) {
      setStatus("That listing isn't on this page any more (scrolled away or the page changed).", false, { label: "Open it", fn: () => window.open(it.url, "_blank", "noopener") });
      return;
    }
    const card = stickerHost(el);
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    const c = card.getBoundingClientRect();
    if (wrap.classList.contains("open") && c.right > panel.getBoundingClientRect().left) showOpen(false);
    ensureStickerStyles();
    card.classList.remove("second-look-flash");
    void card.offsetWidth; // restart the animation if it's still running
    card.classList.add("second-look-flash");
    setTimeout(() => card.classList.remove("second-look-flash"), 2200);
  };

  // Browsing: one real eBay sold-price check for one listing, using the search the model wrote for it.
  // Goes through the same gentle, cached, rate-limited lookup as everything else.
  const checkSold = async (it, btn) => {
    btn.disabled = true;
    btn.textContent = "Checking\u2026";
    try {
      const settings = await send("getSettings");
      if (!settings.useSoldComps) throw new Error("Price comparisons with eBay sales are turned off in settings.");
      const m = await soldMarket(it.query, "used");
      if (!m) {
        setStatus(`Not enough eBay sales of \u201c${it.query}\u201d to compare. The estimate stays.`);
        btn.textContent = "No sold data";
        return;
      }
      it.sold = { median: m.median, n: m.n, p25: m.p25, p75: m.p75 };
      useReference(it, m.median, false);
      rememberScan(it);
      stick(it);
      render();
      setStatus(`eBay sold \u201c${it.query}\u201d: median $${m.median} from ${m.n} sales.`);
    } catch (e) {
      setStatus(e.message, true);
      btn.disabled = false;
      btn.textContent = "Check sold prices";
    }
  };

  const runPhotoCheck = async (it, box, btn) => {
    btn.disabled = true;
    box.replaceChildren(h("div", { class: "photo" }, "Looking at the photo…"));
    setBusy(true);
    try {
      applyPhotos(it, [await sendAI("checkPhoto", { imageUrl: SL.bigImage(it.imageUrl), title: it.title })]);
      rememberScan(it);
      stick(it);
      render(); // the score may have changed, so the order may too
    } catch (e) {
      box.replaceChildren(h("div", { class: "photo drop" }, isStop(e) ? "Stopped." : e.message));
      btn.disabled = false;
    } finally {
      setBusy(false);
    }
  };


  // ---------- "Check this page": what the page reader can see, for when a site changes its layout ----------
  // Counts only, plus a few public listing titles; nothing is sent anywhere, the report is copied on request.
  const checkPage = async () => {
    const type = SL.pageType();
    const items = type === "results" ? SL.extract() : [];
    const n = (fn) => items.filter(fn).length;
    const { soldCooldownUntil = 0, soldLog = [], soldCache = {} } = await chrome.storage.local.get(["soldCooldownUntil", "soldLog", "soldCache"]);
    const lines = [
      `Second Look ${chrome.runtime.getManifest().version} on ${SL.currentSite()} (${type}), ${location.origin}${location.pathname}`,
      type === "results" && `Cards on the page: ${SL.currentSite() === "facebook" ? document.querySelectorAll(ITEM_LINK).length : document.querySelectorAll(SL.EBAY_CARDS).length}; read as listings: ${items.length}`,
      type === "results" && items.length && `With a title ${n((i) => i.title)}, price ${n((i) => i.price != null)}, photo ${n((i) => i.imageUrl)}, shipping known ${n((i) => i.shipping != null)}, seller rating ${n((i) => i.sellerPct != null)}`,
      type === "results" && items.length && `First titles: ${items.slice(0, 3).map((i) => `\u201c${i.title.slice(0, 40)}\u201d`).join(", ")}`,
      type === "item" && (() => { const l = SL.extractItem(); return `Listing read: title ${l.title ? "yes" : "NO"}, price ${l.price != null ? "yes" : "NO"}, photos ${l.imageUrls?.length || 0}, seller ${l.seller ? "yes" : "no"}`; })(),
      `Sold prices: ${Date.now() < soldCooldownUntil ? `paused ${Math.ceil((soldCooldownUntil - Date.now()) / 60000)} more min (eBay asked for a browser check)` : "not paused"}; ${soldLog.filter((t) => Date.now() - t < 36e5).length} of ${PER_HOUR} lookups used this hour; ${Object.keys(soldCache).length} searches remembered`,
      `Scores kept: ${Object.keys(scansCache || {}).length} listings`,
    ].filter(Boolean);
    const text = lines.join("\n");
    let copied = "";
    try {
      await navigator.clipboard.writeText(text);
      copied = " Copied, so you can paste it into a bug report.";
    } catch {}
    setStatus(`${text}${copied}`);
  };

  // ---------- scan ----------

  let scanning = false;
  // What the last scan judged for. Change your wants, the comparison or the lens and the next
  // scan judges the whole page again (anything judged this way before still comes back free).
  let scanInputs = null;
  const inputsNow = () => [lens, wantEl.value.trim(), queryEl.value.trim()].join("|");
  const inputsChanged = () => scanInputs !== null && scored.size > 0 && scanInputs !== inputsNow();

  // On eBay the sold-listings search is made from the eBay page itself (same site, your cookies,
  // normal browser headers), like any request eBay's own pages make. From Facebook it has to go
  // through the background script. Either way the answer (just the summary, not the page) is
  // remembered for a few hours across pages, and lookups pause for 30 minutes if eBay pushes back.
  const SOLD_TTL_MS = 6 * 60 * 60 * 1000;
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
  const fetchSoldHtml = async (query, condition) => {
    const url = SL.soldUrl(query, SL.SOLD_CONDITION[condition]);
    if (location.hostname !== "www.ebay.com") return send("fetchSoldHtml", { url });
    const res = await fetch(url, { credentials: "include", signal: AbortSignal.timeout(30000) });
    return { status: res.status, html: res.ok ? await res.text() : "" };
  };

  const pausedMsg = (until) => `Price lookups paused ${Math.ceil((until - Date.now()) / 60000)} min (eBay asked for a browser check).`;

  // Resolves to a market summary, or null when there were too few sales to trust.
  const soldMarket = async (query, condition) => {
    const key = `${condition}:${query.trim().toLowerCase()}`;
    const { soldCache = {}, soldCooldownUntil = 0, soldLog = [] } = await chrome.storage.local.get(["soldCache", "soldCooldownUntil", "soldLog"]);
    const hit = soldCache[key];
    if (hit && Date.now() - hit.at < SOLD_TTL_MS) return hit.market;
    if (Date.now() < soldCooldownUntil) throw new Error(pausedMsg(soldCooldownUntil));
    const recent = soldLog.filter((t) => Date.now() - t < 60 * 60 * 1000);
    if (recent.length >= PER_HOUR) {
      throw new Error(`Price lookups resting: ${PER_HOUR} this hour is plenty for eBay.`);
    }
    const wait = (recent.at(-1) || 0) + GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    if (stopRequested) throw new Error("Stopped.");
    await chrome.storage.local.set({ soldLog: [...recent, Date.now()] });

    const pause = async () => {
      const until = Date.now() + COOLDOWN_MS;
      await chrome.storage.local.set({ soldCooldownUntil: until });
      throw new Error(pausedMsg(until));
    };
    const { status, html } = await fetchSoldHtml(query, condition);
    if (status === 403 || status === 429 || status === 503) return pause();
    if (!html) throw new Error(`eBay sold search failed (${status}).`);
    if (blockedPage(html)) return pause(); // never cache a check page as "no sales"
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
  // for Fix & flip also what broken ones sell for, the floor you can always resell at.
  let lastMarket = null;
  const getMarket = async (settings, query, forLens) => {
    if (!settings.useSoldComps || !query) return null;
    const epoch = pageEpoch;
    setStatus(`Checking recent eBay sales for "${query}"…`);
    let market = null;
    try {
      // One lookup for working (used) prices; a second for for-parts in Fix & flip, only when there's
      // something broken to compare (a listing page, or a results page with broken/untested listings).
      const used = await soldMarket(query, "used");
      const working = used && { ...used, condition: "used" };
      const needParts = forLens !== "use" && (SL.pageType() === "item" || [...facts.values()].some((f) => f.project));
      const parts = needParts ? await soldMarket(query, "parts") : null;
      market = working || parts ? { ...(working || { median: null }), parts } : null;
    } catch (e) {
      console.warn("[Second Look] sold comps failed:", e);
      if (epoch !== pageEpoch) return null;
      // You can still look yourself: eBay's own sold search, in a normal tab.
      marketEl.replaceChildren(
        h("div", { class: "mnote" }, `${e.message} `, h("a", { href: SL.soldUrl(query, SL.SOLD_CONDITION.used), target: "_blank", rel: "noopener" }, "See sold listings on eBay"))
      );
      return null;
    }
    if (epoch !== pageEpoch) return market; // the page changed meanwhile: the numbers still go to that scan, not on screen
    renderMarket(market);
    lastMarket = market;
    return market;
  };

  // How each listing's total compares with the sold prices; for Fix & flip, the margin before repairs.
  // Lots aren't compared with a single item's price, and an auction's price is only the current bid,
  // so neither gets a margin; auctions get a sensible maximum bid instead (set once the score is in).
  const priceNotes = (it, market, forLens, feePct) => {
    const w = market?.median;
    const pm = market?.parts?.median;
    it.refWorking = w > 0 ? w : null;
    it.refParts = pm > 0 ? pm : null;
    it.feePct = feePct;
    it.vsWorking = it.total != null && w > 0 && !it.lot ? it.total / w : null;
    it.vsParts = forLens !== "use" && it.total != null && pm > 0 && !it.lot ? it.total / pm : null;
    it.marginBeforeRepair = forLens === "project" && it.total != null && w > 0 && !it.lot && !it.auction ? Math.round(w * (1 - feePct / 100) - 0.4 - it.total) : null;
  };
  // The most an auction is worth bidding, shipping included: the market price (Use); break-even after
  // fees and parts, or what broken ones sell for when there's no working price (Fix & flip).
  const bidCapFor = (it) => {
    const ship = it.shipping || 0;
    const base =
      // Fix & flip: break even at the working price after fees and parts; without one, what broken ones fetch.
      it.lens === "project" ? (it.refWorking ? it.refWorking * (1 - (it.feePct || 0) / 100) - 0.4 - (it.partsCost || 0) : it.refParts)
      : it.refWorking;
    return base != null ? Math.max(0, Math.floor(base - ship)) : null;
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

  // ---------- scores kept with the listing ----------
  // Every score (a scan, an analysis, a photo check) is saved under the listing's key, per lens, so it
  // is still there after a reload, in another tab, and on the listing's own page. A saved score is
  // only brought back while the price is the one it was judged at.
  const SCAN_DAYS = 60;
  const SCAN_MAX = 3000;
  const SNAP = ["lens", "browse", "score", "verdict", "related", "flags", "reason", "fault", "difficulty", "partsCost", "query", "est", "sold", "margin", "bidCap", "vsWorking", "refWorking", "refIsEstimate", "baseScore", "baseVerdict", "photoAdjust", "photos"];
  const priceOf = (it) => it.total ?? it.price ?? null;
  const modelNow = () => (cfg.provider === "ollama" ? cfg.textModel : cfg.provider === "openai" ? cfg.oaiModel : cfg.anthropicModel) || "";
  let scansCache = null; // key -> { lens -> snapshot }, as last read from storage
  const pendingScans = new Map();
  let scanSaveTimer = 0;
  const rememberScan = (it, kind = "scan", summary) => {
    if (!alive() || it.score == null) return;
    const key = keyOf(it.url);
    const snap = { kind, at: Date.now(), m: modelNow(), p: priceOf(it), t: (it.title || "").slice(0, 120) };
    for (const f of SNAP) if (it[f] !== undefined) snap[f] = it[f];
    snap.lens ||= lens;
    if (summary) snap.reason = summary;
    it.scannedAt = snap.at;
    it.scannedWith = snap.m;
    pendingScans.set(`${key}|${snap.lens}`, [key, snap]);
    clearTimeout(scanSaveTimer);
    scanSaveTimer = setTimeout(flushScans, 400); // soon: opening the listing right after a scan must find it
  };
  const flushScans = async () => {
    if (!pendingScans.size || !alive()) return;
    const batch = [...pendingScans.values()];
    pendingScans.clear();
    // Several tabs may write at once, so merge into what's stored.
    const { scans = {} } = await chrome.storage.local.get("scans");
    for (const [key, snap] of batch) (scans[key] ||= {})[snap.lens] = snap;
    const cutoff = Date.now() - SCAN_DAYS * 864e5;
    const newest = (r) => Math.max(0, ...Object.values(r).map((s) => s.at || 0));
    const kept = Object.entries(scans).filter(([, r]) => newest(r) > cutoff).sort((a, b) => newest(a[1]) - newest(b[1])).slice(-SCAN_MAX);
    scansCache = Object.fromEntries(kept);
    await chrome.storage.local.set({ scans: scansCache }).catch(() => {});
  };
  window.addEventListener("pagehide", () => flushScans());
  const loadScans = async () => (scansCache = (await chrome.storage.local.get("scans")).scans || {});
  const storedScan = (key, forLens = lens) => scansCache?.[key]?.[forLens] || null;
  // Bring back what an earlier scan or analysis (here or in another tab) said about listings on this page.
  let restoreOff = false; // Start over, or a rescan with new wants, must not bring the old scores straight back
  const restoreScans = (items) => {
    if (!scansCache || restoreOff) return 0;
    let n = 0;
    for (const it of items) {
      const key = keyOf(it.url);
      if (scored.has(key) || seen.has(key)) continue;
      const s = storedScan(key);
      if (!s || s.p !== priceOf(it)) continue;
      Object.assign(it, Object.fromEntries(SNAP.filter((f) => s[f] !== undefined).map((f) => [f, s[f]])), { scannedAt: s.at, scannedWith: s.m, restored: true });
      scored.set(key, it);
      seen.add(key);
      const f = facts.get(key);
      if (f?.titleCode) f.codeOk = it.verdict !== "suspicious";
      n++;
    }
    return n;
  };
  chrome.storage.onChanged.addListener((changes) => {
    if (!alive() || !changes.scans) return;
    scansCache = changes.scans.newValue || {};
    if (SL.pageType() === "item") renderItemInfo();
  });
  loadScans().catch(() => {});

  // Point a listing's comparisons at a reference price: the model's estimate (browsing) or a real
  // sold median. Recomputes % of price, flip margin and the auction bid cap; no model call.
  const useReference = (it, ref, isEstimate) => {
    it.refWorking = ref > 0 ? ref : null;
    it.refIsEstimate = isEstimate;
    it.vsWorking = it.refWorking && it.total != null && !it.lot ? it.total / it.refWorking : null;
    it.margin =
      it.lens === "project" && it.refWorking && it.total != null && !it.lot && !it.auction && it.related
        ? Math.round(it.refWorking * (1 - (it.feePct || 0) / 100) - 0.4 - it.total - (it.partsCost || 0))
        : it.margin;
    it.bidCap = it.auction && it.related ? bidCapFor(it) : null;
  };

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
    it.bidCap = it.auction && it.related ? bidCapFor(it) : null;
    if (it.browse) {
      it.query = (r.query || "").trim().slice(0, 80);
      const hi = Math.max(0, r.estHigh | 0);
      const lo = Math.min(Math.max(0, r.estLow | 0) || hi, hi);
      it.est = hi > 0 ? { lo, hi } : null;
      if (it.sold) useReference(it, it.sold.median, false);
      else if (it.est) useReference(it, (lo + hi) / 2, true);
    }
    if (it.vsParts != null && it.vsParts <= 1 && it.related && !it.flags.includes("under parts value")) it.flags.unshift("under parts value");
    it.baseScore = it.score;
    it.baseVerdict = it.verdict;
    const f = facts.get(keyOf(it.url));
    if (f?.titleCode) f.codeOk = it.verdict !== "suspicious"; // the model judged the code a real model number
  };
  // A reposted scam (see noteCode) needs no model.
  const scamVerdict = (others) => ({
    score: 2,
    verdict: "suspicious",
    related: true,
    flags: ["reposted scam"],
    reason: `Same listing posted again under other codes (${others.join(", ")}): a bulk-posted fake.`,
  });

  // ---------- listings that loaded after the last scan ----------

  const currentKeys = () => {
    const sel = SL.currentSite() === "facebook" ? ITEM_LINK : SL.EBAY_CARDS.split(", ").map((c) => `${c} a[href*="/itm/"]`).join(", ");
    const keys = new Set();
    document.querySelectorAll(sel).forEach((a) => keys.add(keyOf(a.href)));
    return keys;
  };

  let lastDeals = 0;
  const refreshPending = () => {
    updateFold();
    freeRow.hidden = scanning || SL.pageType() !== "results" || !queryEl.value.trim() || (!!lastMarket && marketFor === queryEl.value.trim().toLowerCase());
    if (scanning || SL.pageType() !== "results") return;
    let n = 0;
    if (seen.size) currentKeys().forEach((k) => !seen.has(k) && n++);
    // What a press would cost (Claude only): the listings it would send, at what scoring has cost
    // you per listing with this model. Ones judged the same way before come back free, so it's a ceiling.
    const changed = inputsChanged();
    const toScore = [...facts.entries()].filter(([k, f]) => (changed || !seen.has(k)) && !f.hidden && !f.filtered && !f.campaign).length;
    const est = cfg.provider !== "ollama" && cfg.scanRate > 0 ? toScore * cfg.scanRate : 0;
    const label = changed ? "Rescan with your changes" : n ? `Scan ${n} new listing${n > 1 ? "s" : ""}` : seen.size ? "Scan again" : toScore ? `Scan ${toScore} listing${toScore > 1 ? "s" : ""}` : "Scan this page";
    scanBtn.replaceChildren(label, est && (changed || n || !seen.size) ? h("span", { class: "cost" }, ` \u00b7 ${est < 0.01 ? "under 1\u00a2" : `about $${est.toFixed(2)}`}`) : "");
    scanBtn.title = est ? "Estimated from what scoring has cost per listing with this model. Listings already judged this way come back free." : "";
    // The tab's badge, most useful first: listings at your price, then new ones to scan, then scored.
    const deals = dealCount();
    countEl.classList.toggle("deal", deals > 0);
    countEl.classList.toggle("new", !deals && n > 0);
    countEl.title = deals ? `${deals} at your price` : n ? `${n} not scanned yet` : "";
    if (deals) {
      // A new listing at your price: the badge pops once.
      if (deals > lastDeals) {
        countEl.classList.remove("pop");
        void countEl.offsetWidth;
        countEl.classList.add("pop");
      }
      countEl.textContent = `\u2605${deals}`;
      countEl.hidden = false;
    } else if (n) {
      countEl.textContent = `+${n}`;
      countEl.hidden = false;
    } else setCount(scored.size);
    lastDeals = deals;
    resetBtn.hidden = !seen.size;
  };

  // One line about the page: what's new, cheaper, flagged, hidden. Plus the skipped-listings control.
  const renderPageInfo = () => {
    if (SL.pageType() !== "results" || !facts.size) return (pageInfo.hidden = true);
    const all = [...facts.values()];
    const n = (fn) => all.filter(fn).length;
    const newN = n((f) => f.isNew);
    const dropN = n((f) => f.drop);
    const warnN = n((f) => f.sellerWarn || f.dup);
    const hidN = n((f) => f.hidden);
    const filN = n((f) => f.filtered && !f.hidden);
    // After a scan, say what it found in plain words.
    const scored = pageItems().filter((it) => it.score != null && !isHidden(it));
    const worthN = scored.filter((it) => (it.verdict === "great" || it.verdict === "good") && !likelyScam(facts.get(keyOf(it.url)))).length;
    piHead.hidden = !scored.length;
    piHead.textContent = !scored.length ? "" : worthN ? `${worthN} worth a look` : "Nothing here is a bargain";
    const scamN = n((f) => likelyScam(f) && !f.hidden);
    const bits = [`<b>${all.length}</b> listings`];
    if (scamN) bits.push(`<b>${scamN}</b> look like scams`);
    const dealN = dealCount();
    if (dealN) bits.push(`<b>${dealN}</b> at your price`);
    if (newN) bits.push(`<b>${newN}</b> new to you`);
    if (dropN) bits.push(`<b>${dropN}</b> cheaper than before`);
    if (warnN) bits.push(`<b>${warnN}</b> to be careful with`);
    piLine.innerHTML = bits.join(" \u00b7 "); // numbers and fixed words only
    if (hidN || filN) {
      piLine.append(
        ` \u00b7 ${[hidN && `${hidN} not interested`, filN && `${filN} filtered`].filter(Boolean).join(", ")} `,
        h("button", { onclick: () => setShowHidden(!showHidden) }, showHidden ? "hide them" : "show")
      );
    }
    listBar.hidden = !facts.size;
    // Search tools: keep this search, or run it on the other site.
    const q = pageSearch();
    // One row of page actions: keep this search, run it on the other site, start the scores over.
    piSearch.replaceChildren(
      ...(q
        ? [
            h("button", { class: savedSearches[searchKey(q)] ? "on" : null, onclick: () => toggleSearch(q), title: "Keep this search under Saved" }, savedSearches[searchKey(q)] ? "Saved search" : "Save search"),
            h("a", { href: otherSiteUrl(q), target: "_blank", rel: "noopener" }, SL.currentSite() === "ebay" ? "Try on Marketplace \u2197" : "Try on eBay \u2197"),
            h("button", { onclick: getIdeas, title: "Other ways to search for this: misspellings sellers make, other model names, tighter or looser words (uses the AI)" }, "Ideas"),
          ]
        : []),
      resetBtn
    );
    root.querySelectorAll("[data-skip]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.skip === skipMode)));
    pageInfo.hidden = false;
  };
  const setShowHidden = (on) => {
    showHidden = on;
    document.documentElement.toggleAttribute("data-sl-showhidden", on);
    redecorateAll();
  };
  // The filter bar: each search keeps its own, so a saved search comes back filtered the same way.
  const qf = $(".qf");
  const qfWords = $(".qf-words");
  const qfMin = $(".qf-min");
  const qfMax = $(".qf-max");
  const qfDeal = $(".qf-dealin");
  const quickKey = () => `${SL.currentSite()}|${(pageSearch() || location.pathname).toLowerCase()}`;
  // fill: also write the boxes (on load and Clear). Otherwise they're yours: never overwritten mid-edit.
  const showQuick = (fill = false) => {
    if (fill) {
      qfWords.value = quick.words;
      qfMin.value = quick.min || "";
      qfMax.value = quick.max || "";
      qfDeal.value = quick.deal || "";
    }
    // With sold prices known, suggest 70% of the median as a starting point.
    const hint = lastMarket?.median > 0 ? Math.round(lastMarket.median * 0.7) : 0;
    qfDeal.placeholder = hint ? `$${hint}?` : "$";
    qfDeal.title = hint ? `Your price for this search. 70% of the eBay sold median would be $${hint}.` : "Your price for this search: listings at or under it are marked, and counted on the tab.";
    root.querySelectorAll("[data-q]").forEach((b) => b.setAttribute("aria-pressed", String(!!quick[b.dataset.q])));
    // The broken-listing toggle follows the lens: Use hides them; Fix & flip can show only them.
    // A filter that's already on always shows, so it can be turned off.
    const mode = quick.broken || { use: "hide", project: "only" }[lens] || "";
    const bt = $(".qt-broken");
    bt.hidden = !mode;
    bt.textContent = mode === "only" ? "Broken only" : "Hide broken";
    bt.title = mode === "only" ? "Only listings that say broken, untested, for parts, no power… (fix-ups)" : "Drop listings that say broken, untested, for parts, no power…";
    bt.setAttribute("aria-pressed", String(!!quick.broken));
    bt.dataset.mode = mode;
    qf.classList.toggle("on", quickActive());
    $(".qf-clear").hidden = !quickActive();
    syncFilterToggle();
  };
  // The filter fields sit behind a "Filter" button so the sticky bar leaves room for the results; a
  // search that already has a filter or a deal price opens them, and the button counts what is set.
  let qfOpen = false;
  const qfToggle = $(".qf-toggle");
  const syncFilterToggle = () => {
    qf.hidden = !qfOpen;
    qfToggle.setAttribute("aria-expanded", String(qfOpen));
    const n = [quick.words.trim(), quick.min, quick.max, quick.fresh, quick.broken, quick.deal].filter(Boolean).length;
    qfToggle.textContent = n ? `Filter \u00b7 ${n}` : "Filter";
    qfToggle.classList.toggle("on", n > 0);
  };
  qfToggle.addEventListener("click", () => {
    qfOpen = !qfOpen;
    syncFilterToggle();
    if (qfOpen) qfWords.focus();
  });
  onLensShown = () => showQuick();
  const loadQuick = async () => {
    const { quickFilters = {} } = await chrome.storage.local.get("quickFilters");
    const stored = quickFilters[quickKey()] || {};
    quick = { ...NO_QUICK, ...stored, ...(stored.projects && !stored.broken && { broken: "only" }) }; // older "Projects only"
    delete quick.projects;
    qfOpen = quickActive() || !!quick.deal;
    showQuick(true);
  };
  let quickTimer = 0;
  const applyQuick = (save = true) => {
    for (const f of facts.values()) {
      f.filtered = filterReason(f);
      f.deal = isDeal(f);
    }
    redecorateAll();
    showQuick();
    refreshPending();
    if (!save || !alive()) return;
    noteSearchVisit([...facts.values()]).catch(() => {});
    clearTimeout(quickTimer);
    const key = quickKey();
    const value = { ...quick, a: Date.now() };
    quickTimer = setTimeout(async () => {
      const { quickFilters = {} } = await chrome.storage.local.get("quickFilters");
      if (quickActive() || value.deal) quickFilters[key] = value;
      else delete quickFilters[key];
      const kept = Object.entries(quickFilters).sort((a, b) => a[1].a - b[1].a).slice(-200);
      await chrome.storage.local.set({ quickFilters: Object.fromEntries(kept) });
    }, 400);
  };
  const money0 = (v) => Math.max(0, Math.round(Number(String(v).replace(/[$,\s]/g, "")) || 0));
  let typing = 0;
  const readBoxes = () => {
    clearTimeout(typing);
    Object.assign(quick, { words: qfWords.value, min: money0(qfMin.value), max: money0(qfMax.value), deal: money0(qfDeal.value) });
  };
  const onQuickInput = () => {
    clearTimeout(typing);
    typing = setTimeout(() => {
      readBoxes();
      applyQuick();
    }, 250);
  };
  [qfWords, qfMin, qfMax, qfDeal].forEach((el) => el.addEventListener("input", onQuickInput));
  root.querySelectorAll("[data-q]").forEach((b) =>
    b.addEventListener("click", () => {
      readBoxes(); // whatever you just typed counts too
      quick[b.dataset.q] = !quick[b.dataset.q];
      applyQuick();
    })
  );
  $(".qt-broken").addEventListener("click", (e) => {
    readBoxes();
    quick.broken = quick.broken ? "" : e.currentTarget.dataset.mode;
    applyQuick();
  });
  $(".qf-clear").addEventListener("click", () => {
    clearTimeout(typing);
    quick = { ...NO_QUICK, deal: quick.deal }; // your price isn't a filter; it stays
    showQuick(true);
    applyQuick();
  });

  sortSel.addEventListener("change", () => {
    sortMode = sortSel.value;
    if (alive()) chrome.storage.local.set({ sortMode }).catch(() => {});
    render();
  });
  chrome.storage.local.get({ sortMode: "score" }).then((v) => {
    sortMode = SORTS[v.sortMode] ? v.sortMode : "score";
    sortSel.value = sortMode;
  });
  root.querySelectorAll("[data-skip]").forEach((b) =>
    b.addEventListener("click", () => {
      skipMode = b.dataset.skip;
      document.documentElement.dataset.slSkip = wrap.dataset.skipmode = skipMode;
      if (alive()) chrome.storage.local.set({ skipMode }).catch(() => {});
      render();
      renderPageInfo();
    })
  );
  // Settings changed in another tab or the options page: filters and seller rules apply straight away.
  chrome.storage.onChanged.addListener((changes) => {
    if (!alive()) return;
    if (["hideWords", "needWords", "minSellerRatings", "minSellerPct", "autoMarks"].some((k) => changes[k])) loadPrefs().then(redecorateAll);
    if (changes.notInterested && !changes.notInterested.newValue) {
      notInterested = {};
      redecorateAll();
    }
  });

  // Run fn over the batches with at most `limit` in flight; one failed batch doesn't stop the rest.
  const runBatches = async (batches, limit, fn) => {
    const errors = [];
    let next = 0;
    const worker = async () => {
      while (next < batches.length && !stopRequested) {
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

  let scanEpoch = -1;
  const scan = async () => {
    if (scanning) {
      if (scanEpoch === pageEpoch) return;
      // A scan from a page you've left is still going: stop it, then start this page's.
      stopAll();
      while (scanning) await sleep(100);
    }
    scanning = true;
    const epoch = (scanEpoch = pageEpoch);
    // Messages from this scan only while you're still on its page.
    const setStatus = (...a) => epoch === pageEpoch && setStatusNow(...a);
    setBusy(true);
    scanBtn.disabled = true;

    try {
      const settings = await send("getSettings");
      editingInputs = false;
      if (inputsChanged()) {
        restoreOff = true;
        clearStickers();
        listEl.replaceChildren();
        redecorateAll(); // the non-AI marks stay
      }
      scanInputs = inputsNow();
      await pagePass(true);
      const session = scored; // if you navigate away mid-scan, late answers belong to the old page
      // Only listings we haven't scored yet: scrolling loads more, and a re-scan adds just those.
      // Cards the adapter skips (ads, "Shop on eBay") count as seen so they don't show as new.
      // Listings you've hidden or filtered out never go to the model.
      const skipped = currentKeys();
      const fresh0 = SL.extract().filter((it) => !seen.has(keyOf(it.url)));
      const left = fresh0.filter((it) => !notInterested[keyOf(it.url)] && !facts.get(keyOf(it.url))?.filtered);
      const leftOut = fresh0.length - left.length;
      const items = left.map((it) => Object.assign(it, facts.get(keyOf(it.url)) ? { isNew: facts.get(keyOf(it.url)).isNew, drop: facts.get(keyOf(it.url)).drop } : {}));
      left.forEach((it) => skipped.delete(keyOf(it.url)));
      skipped.forEach((k) => seen.add(k));
      if (!items.length) {
        setStatus(
          scored.size || leftOut
            ? `Nothing new to score${leftOut ? ` (${leftOut} hidden by you or your filters)` : ""}. Scroll down to load more listings.`
            : "No listings found on this page. Scroll so results load, or the site layout may have changed (README: When it breaks).",
          !scored.size,
          !scored.size && !leftOut ? { label: "Check this page", fn: checkPage } : null
        );
        return;
      }
      items.forEach((it) => seen.add(keyOf(it.url)));

      const query = queryEl.value.trim();
      const want = wantEl.value.trim();
      const forLens = lens;
      const browse = query ? "" : SL.browseContext(); // no search: interests guide, prices are estimates
      items.forEach((it) => (it.browse = !!browse));
      const market = await getMarket(settings, query, forLens);
      if (stopRequested) {
        items.forEach((it) => seen.delete(keyOf(it.url)));
        return setStatus("Stopped before anything went to the model.");
      }
      if (market?.median > 0 && epoch === pageEpoch) applyMarket(market); // every card, scored or not
      items.forEach((it) => priceNotes(it, market, forLens, settings.feePct));

      // Anything already judged in this exact setting comes back from memory, free.
      const model = settings.provider === "anthropic" ? settings.anthropicModel : settings.provider === "openai" ? settings.oaiModel : settings.textModel;
      const ctx = hash([forLens, want, query, browse, model, market?.median, market?.parts?.median].join("|"));
      const { scoreCache = {} } = await chrome.storage.local.get("scoreCache");
      const fresh = {};
      let fromMemory = 0;
      for (const it of items) {
        const hit = scoreCache[scoreKey(ctx, it)];
        if (hit && Date.now() - hit.at < SCORE_TTL_MS) {
          applyResult(it, hit.r, forLens);
          rememberScan(it);
          session.set(keyOf(it.url), it); // before stick(): decorate() looks the listing up here
          if (scored === session) stick(it);
          fromMemory++;
        }
      }
      // Reposted scams are certain already: marked here, never sent to the model.
      let scams = 0;
      for (const it of items) {
        const f = facts.get(keyOf(it.url));
        if (it.score != null || !f?.campaign) continue;
        applyResult(it, scamVerdict(f.campaign), forLens);
        session.set(keyOf(it.url), it);
        if (scored === session) stick(it);
        scams++;
      }
      if ((fromMemory || scams) && scored === session) render();
      const toRank = items.filter((it) => it.score == null);
      let cost = 0;

      const size = Math.max(1, settings.batchSize | 0);
      const batches = [];
      for (let i = 0; i < toRank.length; i += size) batches.push(toRank.slice(i, i + size));
      // Online services handle a few requests at once; a model on your own computer is fastest one at a time.
      const parallel = settings.provider === "ollama" || (settings.provider === "openai" && /localhost|127\.0\.0\.1/.test(settings.oaiUrl)) ? 1 : 3;
      let done = fromMemory + scams;
      showProgress(done, items.length);
      setStatus(`Ranking ${items.length} listing${items.length > 1 ? "s" : ""} with ${model}…`);
      const errors = await runBatches(batches, parallel, async (batch) => {
        const payload = batch.map(({ el, ...rest }) => rest); // DOM nodes can't be sent
        const res = await sendAI("rankBatch", { items: payload, query, market, lens: forLens, want, browse });
        cost += res.cost || 0;
        const byId = new Map(batch.map((it) => [it.id, it]));
        if (scored !== session) {
          // You've moved on (on Facebook, maybe just opened a listing): keep the answers with the page
          // they belong to, so they're there when you come back.
          for (const r of res.items) {
            const it = byId.get(r.id);
            if (!it) continue;
            applyResult(it, r, forLens);
            rememberScan(it);
            fresh[scoreKey(ctx, it)] = { at: Date.now(), r };
            session.set(keyOf(it.url), it);
          }
          return;
        }
        for (const r of res.items) {
          const it = byId.get(r.id);
          if (!it) continue;
          applyResult(it, r, forLens);
          rememberScan(it);
          fresh[scoreKey(ctx, it)] = { at: Date.now(), r };
          scored.set(keyOf(it.url), it);
          stick(it);
        }
        done += batch.length;
        showProgress(done, items.length);
        render();
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
      const costNote = toRank.length && cost > 0 ? ` Cost ${fmtCost(cost)}.` : "";
      if (stopRequested) {
        return setStatus(`Stopped. Ranked ${items.length - missed.length} of ${items.length}; the other ${missed.length} are offered again.${costNote}`);
      }
      if (errors.length && missed.length === items.length) throw errors[0];
      setStatus(
        `Ranked ${items.length - missed.length} of ${items.length} new listings${fromMemory ? ` (${fromMemory} from memory)` : ""}.${scams ? ` ${scams} reposted scam${scams > 1 ? "s" : ""} marked without the model.` : ""}${leftOut ? ` Skipped ${leftOut} you've hidden or filtered out.` : ""}${costNote}` +
          (errors.length ? ` Some requests failed (${errors[0].message}) Scan again to retry the rest.` : "") +
          (!errors.length && missed.length ? " The model skipped some; scan again, or try a smaller batch size in settings." : ""),
        errors.length > 0
      );
    } catch (e) {
      if (isStop(e)) setStatus("Stopped.");
      else setStatus(e.message, true);
    } finally {
      scanning = false;
      showProgress(null);
      setBusy(false);
      scanBtn.disabled = false;
      refreshPending();
      renderPageInfo(); // the skipped-listings control appears once something is scored
      requestAnimationFrame(showResults);
    }
  };

  // When a scan finishes, bring the results up under the status line: on a short window the controls
  // above would otherwise leave no result in view. Never scrolls back up if you were already further down.
  // After an error it does the opposite: the message and the button to try again both come into view.
  const showResults = () => {
    if (view !== "page") return;
    const body = $(".body");
    const at = (el) => body.scrollTop + el.getBoundingClientRect().top - body.getBoundingClientRect().top;
    const row = $(".statusrow");
    if (statusEl.classList.contains("err")) {
      const btn = scanBtn.hidden ? analyzeBtn : scanBtn;
      const end = at(row) + row.offsetHeight + 12;
      body.scrollTop = btn.hidden || end - (at(btn) - 12) > body.clientHeight ? end - body.clientHeight : at(btn) - 12;
      return;
    }
    if (listBar.hidden) return;
    const top = at(row) - 8;
    if (body.scrollTop < top) body.scrollTop = top;
  };
  scanBtn.addEventListener("click", scan);

  // The sold-price half of a scan on its own: one eBay lookup, every card gets "% of sold", no model.
  const pricesOnly = async () => {
    const query = queryEl.value.trim();
    if (!query || scanning) return;
    freeRow.hidden = true;
    setBusy(true);
    try {
      const settings = await send("getSettings");
      if (!settings.useSoldComps) return setStatus("Comparing with eBay sales is turned off in settings (On the page).", true);
      const market = await getMarket(settings, query, "use");
      if (!market?.median) return setStatus(market ? "Not enough working ones sold to compare with." : "");
      applyMarket(market);
      const n = [...facts.values()].filter((f) => f.vsSold != null).length;
      setStatus(`Compared ${n} listing${n === 1 ? "" : "s"} with ${market.n} eBay sales of \u201c${query}\u201d. No AI used. Sort by \u201cfurthest under sold price\u201d to see the cheapest for what they are.`);
    } catch (e) {
      setStatus(e.message, true);
    } finally {
      setBusy(false);
      refreshPending();
    }
  };
  $('[data-act="prices"]').addEventListener("click", pricesOnly);
  resetBtn.addEventListener("click", () => {
    // Keep what's being cleared for a moment: scores cost money, so Start over can be undone.
    const before = { scored, seen, scanInputs, market: [...marketEl.childNodes] };
    scanInputs = null;
    restoreOff = true;
    clearStickers();
    redecorateAll(); // the non-AI marks stay
    marketEl.textContent = "";
    setCount(0);
    refreshPending();
    setStatus("Cleared the scores on this page.", false, {
      label: "Undo",
      fn: () => {
        ({ scored, seen, scanInputs } = before);
        marketEl.replaceChildren(...before.market);
        redecorateAll();
        setCount(scored.size);
        refreshPending();
        renderPageInfo();
        setStatus("");
      },
    });
  });

  // ---------- one listing, in depth ----------

  let analyzing = false;

  // On a listing page: remember the visit, and say what's known before any model is asked.
  let itemFacts = null;
  const itemPass = async () => {
    if (SL.pageType() !== "item") return;
    await Promise.all([memoryReady, prefsReady]);
    const listing = SL.extractItem();
    if (!listing.title || SL.pageType() !== "item") return;
    const key = keyOf(location.href);
    const before = memory[key];
    const { drop } = remember(key, listing.price, false, !!listing.auction);
    memory[key].o = before?.o || Date.now();
    const old = (t) => (t && Date.now() - t > 10 * 60 * 1000 ? t : null);
    const stem = listing.titleCode && noteCode(key, listing.title, listing.titleCode);
    const others = stem ? otherCodes(key, stem, listing.titleCode) : [];
    itemFacts = {
      ...Object.fromEntries(CARD_FACTS.filter((k) => listing[k] != null).map((k) => [k, listing[k]])),
      key,
      drop,
      site: listing.site,
      title: listing.title,
      price: listing.price,
      total: listing.total,
      sellerWarn: sellerWarning(listing),
      hidden: !!notInterested[key],
      seenBefore: old(before?.f),
      openedBefore: old(before?.o),
      campaign: others.length ? others.slice(0, 3) : null,
      url: listing.url,
      imageUrl: listing.imageUrls?.[0] || "",
      history: memory[key].h || [],
      project: clueOf(PROJECT, `${listing.title} ${listing.condition || ""} ${listing.details || ""}`),
      motivated: clueOf(MOTIVATED, `${listing.title} ${listing.details || ""}`),
      since: memory[key].pa,
    };
    if (saved[key]) await notePrices([{ url: listing.url, price: listing.price }]);
    renderItemInfo();
  };
  // Certain scam signs on a listing page, in words; "" when there are none.
  const scamWarning = (f) =>
    f.campaign
      ? `This title has been posted under other codes too (${f.campaign.join(", ")}): one fake listing copied many times.`
      : f.offSite?.sure
        ? `It asks you to get in touch outside ${f.site === "ebay" ? "eBay" : "Facebook"} (${f.offSite.why.join("; ")}). That's how these scams take payment.`
        : "";
  const renderItemInfo = () => {
    const f = itemFacts;
    if (!f || SL.pageType() !== "item") return;
    const chips = chipsFor(f).map(([k, t]) => h("span", { class: `fchip k-${k}` }, t));
    const when = f.openedBefore ? `You opened this before, on ${shortDate(f.openedBefore)}` : f.seenBefore ? `It was in your results on ${shortDate(f.seenBefore)}` : "";
    const scam = scamWarning(f);
    // Every price you've seen it at: "$70 (Sep 30) → $60 (Oct 5) → $55 now".
    const history =
      f.history.length && f.price != null
        ? `Price history: ${f.history.map(([p, t]) => `${dollars(p)} (${shortDate(t)})`).join(" \u2192 ")} \u2192 ${dollars(f.price)} now.`
        : "";
    const sv = saved[f.key];
    // What an earlier scan or analysis (in a search, another tab, or here) made of this listing.
    const past = storedScan(f.key, lens);
    const pastLine = past && !itemEl.childElementCount
      ? h("div", {}, h("b", {}, `${past.score} \u00b7 ${VERDICT[past.verdict]?.label || past.verdict}`), ` on ${shortDate(past.at)}${past.m ? ` with ${nameOf(past.m)}` : ""}${past.p != null && f.price != null && past.p !== priceOf(f) ? ` (the price was ${dollars(past.p)} then)` : ""}${past.reason ? `: ${past.reason}` : "."}`)
      : "";
    const acts = h(
      "div",
      { class: "actions pi-acts" },
      f.hidden ? h("span", {}, "Marked not interested") : null,
      h("button", { class: sv ? "on" : null, onclick: () => toggleSave(f.key) }, sv ? "Saved" : "Save"),
      h("button", { onclick: () => setInterested(f.key, f.hidden).then(() => ((f.hidden = !f.hidden), renderItemInfo())) }, f.hidden ? "Undo" : "Not interested"),
      h("a", { href: soldLink(f.title), target: "_blank", rel: "noopener", title: "eBay sold listings for this title, in a new tab" }, "Sold \u2197")
    );
    const slot = itemEl.querySelector(".item-acts");
    slot?.replaceChildren(acts);
    piLine.replaceChildren(
      pastLine,
      scam ? h("div", { class: "scamnote" }, h("b", {}, "Likely scam. "), scam) : "",
      when || f.drop ? h("div", {}, `${when || "Seen before"}${f.drop ? `; it was ${dollars(f.drop.from)} then` : ""}.`) : "",
      history ? h("div", {}, history) : "",
      sv?.p0 != null && f.price != null && f.price !== sv.p0 ? h("div", {}, `Saved on ${shortDate(sv.a0)} at ${dollars(sv.p0)}.`) : "",
      chips.length ? h("div", { class: "chips" }, chips) : "",
      slot ? "" : acts
    );
    piSearch.replaceChildren();
    listBar.hidden = true;
    // With the actions under the result, there may be nothing left to say here: no empty gap.
    pageInfo.hidden = !piLine.textContent.trim() && !piLine.querySelector("button, a");
  };

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
        tagEl(r.verdict, score),
        h(
          "div",
          {},
          h("div", { class: "title", "data-v": r.verdict }, h("span", { class: "verdict" }, v.label), ` \u00b7 ${score} out of 100`),
          h("div", { class: "meta" }, `${priceStr(listing)}${vs}`),
          h("div", { class: "reason" }, r.summary || ""),
          r.photoAdjust ? h("div", { class: r.photoAdjust < 0 ? "adjust" : "adjust up" }, `Photo check ${signed(r.photoAdjust)} (was ${r.baseScore})`) : null,
          r.flags?.length ? h("div", { class: "flags" }, r.flags.slice(0, 5).map((f) => h("span", { class: "flag" }, f))) : null,
          h("div", { class: "item-acts" }) // Save / Not interested / Sold, filled by renderItemInfo
        )
      ),
    ];
    if (listing.auction) {
      parts.push(
        h(
          "div",
          { class: "offer" },
          `Auction: ${listing.bids || 0} bid${listing.bids === 1 ? "" : "s"}${listing.timeLeft ? `, ${listing.timeLeft} left` : ""}. `,
          r.offerHigh > 0 ? ["Suggested max bid: ", h("b", {}, `$${r.offerLow}\u2013$${r.offerHigh}`)] : listing.bidCap > 0 ? ["Worth bidding up to about ", h("b", {}, dollars(listing.bidCap))] : "The price will rise."
        )
      );
    } else if (r.offerHigh > 0) {
      // A first message you can paste to the seller, opening at the low end of the range.
      const message = `Hi! Is this still available? Would you take $${r.offerLow}?${listing.site === "facebook" ? " I can pick up whenever suits you." : ""}`;
      const copy = h("button", {
        onclick: async () => {
          try {
            await navigator.clipboard.writeText(message);
            copy.textContent = "Copied";
          } catch {
            copy.textContent = "Couldn't copy";
          }
        },
        title: message,
      }, "Copy message");
      parts.push(
        h(
          "div",
          { class: "offer" },
          `${listing.bestOffer ? "Accepts offers. " : ""}Suggested offer: `,
          h("b", {}, `$${r.offerLow}\u2013$${r.offerHigh}`),
          h("div", { class: "msg-preview" }, `\u201c${message}\u201d`),
          h("div", { class: "actions offer-acts" }, copy)
        )
      );
    }
    if (listing.lot && listing.total != null) parts.push(h("div", { class: "meta" }, `Lot of ${listing.lot}: about ${dollars(Math.round((listing.total / listing.lot) * 100) / 100)} each.`));
    if (margin != null) {
      parts.push(
        h("div", { class: "offer" }, "Resale margin: ", h("b", {}, `\u2248 ${money(margin)}`), ` after eBay fees${rep?.partsCost ? ` and ~$${rep.partsCost} parts` : ""}, at the sold median.`)
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
      const lensLink = h("a", { href: lensSearchUrl(listing.imageUrls[0]), target: "_blank", rel: "noopener", title: "Reverse image search: is the photo used elsewhere?" }, "Search the main photo");
      parts.push(h("div", { class: "sect" }, h("div", { class: "actions" }, btn, lensLink), photoBox));
    }
    itemEl.replaceChildren(...parts);
    renderItemInfo();
  };

  // An analysis is kept like a scan score, so the listing's card in any search shows it too.
  const saveAnalysis = (listing, r) =>
    rememberScan(
      {
        url: listing.url, title: listing.title, total: listing.total, price: listing.price, lens: listing.lens || lens, auction: listing.auction, lot: listing.lot,
        score: clamp100(r.score | 0), verdict: VERDICT[r.verdict] ? r.verdict : "fair", related: true, flags: (r.flags || []).slice(0, 4), reason: r.summary || "",
        fault: r.repair?.faults?.[0] || "", difficulty: r.repair?.difficulty || 0, partsCost: r.repair?.partsCost || 0,
        margin: listing.marginBeforeRepair != null ? listing.marginBeforeRepair - (r.repair?.partsCost || 0) : null, bidCap: listing.bidCap, vsWorking: listing.vsWorking,
        baseScore: r.baseScore ?? clamp100(r.score | 0), baseVerdict: r.baseVerdict ?? r.verdict, photoAdjust: r.photoAdjust, photos: r.photos,
      },
      "analysis"
    );

  const checkPhotos = async (listing, r, market, box, btn) => {
    btn.disabled = true;
    box.replaceChildren();
    const photos = [];
    setBusy(true);
    for (const [i, url] of listing.imageUrls.slice(0, 3).entries()) {
      if (stopRequested) break;
      const line = h("div", { class: "photo" }, `Photo ${i + 1}: looking…`);
      box.append(line);
      try {
        const p = await sendAI("checkPhoto", { imageUrl: url, title: listing.title });
        photos.push(p);
        line.textContent = photoText(p, `Photo ${i + 1}: `);
      } catch (e) {
        line.textContent = `Photo ${i + 1}: ${isStop(e) ? "stopped" : e.message}`;
        line.classList.add("drop");
      }
    }
    setBusy(false);
    if (photos.length) {
      applyPhotos(r, photos);
      saveAnalysis(listing, r);
      renderItem(listing, r, market); // redraw with the adjusted score
    } else btn.disabled = false;
  };

  const analyze = async () => {
    if (analyzing) return;
    analyzing = true;
    const epoch = pageEpoch;
    const setStatus = (...a) => epoch === pageEpoch && setStatusNow(...a);
    setBusy(true);
    analyzeBtn.disabled = true;
    itemEl.replaceChildren();
    marketEl.textContent = "";
    try {
      const settings = await send("getSettings");
      const listing = SL.extractItem();
      if (!listing.title) {
        setStatus("Couldn't read this listing. Let it finish loading and try again, or the layout may have changed (README: When it breaks).", true, { label: "Check this page", fn: checkPage });
        return;
      }
      if (!queryEl.value.trim()) queryEl.value = SL.titleToQuery(listing.title);
      const query = queryEl.value.trim();
      const forLens = lens;
      const market = await getMarket(settings, query, forLens);
      priceNotes(listing, market, forLens, settings.feePct);
      setStatus(`Analyzing this listing for ${LENS[forLens].name.toLowerCase()}…`);
      const r = await sendAI("analyzeListing", { listing, query, market, lens: forLens, want: wantEl.value.trim() });
      // Certain scam signs (see scamWarning) overrule whatever the model made of the listing.
      if (itemFacts?.key === keyOf(location.href)) {
        itemFacts.offSite = listing.offSite; // the description may have loaded since the first look
        renderItemInfo();
        if (scamWarning(itemFacts)) {
          const flag = itemFacts.campaign ? "reposted scam" : "contact off the site";
          Object.assign(r, { score: Math.min(r.score | 0, 8), verdict: "suspicious", offerLow: 0, offerHigh: 0, flags: [flag, ...(r.flags || []).filter((x) => x !== flag)] });
        }
      }
      Object.assign(listing, { lens: forLens, partsCost: r.repair?.partsCost || 0 });
      listing.bidCap = listing.auction ? bidCapFor(listing) : null;
      if (epoch !== pageEpoch) return; // you've moved on to another listing
      saveAnalysis(listing, r);
      renderItem(listing, r, market);
      setCount(1);
      analyzeBtn.className = "ghost";
      analyzeBtn.replaceChildren("Analyze again", settings.provider === "anthropic" && r.cost ? h("span", { class: "cost" }, ` \u00b7 last one ${fmtCost(r.cost)}`) : "");
      editingInputs = false;
      setStatus("");
    } catch (e) {
      if (isStop(e)) setStatus("Stopped. Nothing was analyzed.");
      else setStatus(e.message, true);
    } finally {
      analyzing = false;
      setBusy(false);
      analyzeBtn.disabled = false;
      updateFold();
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
        img { width:60px; height:60px; object-fit:cover; border-radius:var(--r-sm); background:var(--paper-2); }
        b { display:block; margin-bottom:3px; font:600 14px/1.2 var(--display); }
        .err { color:var(--v-suspicious); }
        button { width:26px; height:26px; display:grid; place-items:center; background:none; border:0; border-radius:var(--r-sm); color:var(--muted); cursor:pointer; align-self:start; font:16px/1 var(--ui); }
        button:hover { color:var(--ink); background:var(--paper-2); }
      </style><div class="wrap"${themePref ? ` data-theme="${themePref}"` : ""}><img alt=""><div><b>Photo check</b><span class="txt"></span></div><button aria-label="Close">\u00d7</button></div>`;
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
      const p = await sendAI("checkPhoto", { imageUrl: SL.bigImage(imageUrl), title });
      // If this photo belongs to a listing we've scored, the check counts toward its rating.
      const big = SL.bigImage(imageUrl);
      const hit = [...scored.values()].find((it) => it.imageUrl && SL.bigImage(it.imageUrl) === big);
      if (hit) {
        applyPhotos(hit, [p]);
        rememberScan(hit);
        stick(hit);
        render();
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

  // Other ways to search for this: misspellings sellers make, other model names, tighter or looser
  // words. Shown right under the search's actions; each one runs the search or saves it.
  const ideasBox = $(".ideas-inline");
  const saveIdea = async (idea, btn) => {
    const k = searchKey(idea.query);
    savedSearches = await writeStored("savedSearches", (st) => {
      st[k] ||= { site: SL.currentSite(), q: idea.query, url: SL.searchUrl(idea), a0: Date.now(), v: 0, n: 0, fresh: 0 };
    });
    btn.textContent = "Saved";
    btn.classList.add("on");
    btn.title = "Kept under Saved";
    renderSaved();
  };
  const getIdeas = async () => {
    ideasBtn.disabled = true;
    setBusy(true);
    ideasBox.hidden = false;
    ideasList.replaceChildren();
    ideasStatus.classList.remove("err");
    ideasStatus.textContent = "Thinking up searches…";
    try {
      // One source or the other: what you typed, or (if that's blank) the results on screen.
      const want = wantEl.value.trim();
      let titles = [];
      if (!want) {
        titles = [...scored.values()].filter((it) => !isHidden(it)).map((it) => it.title);
        if (!titles.length && SL.pageType() === "results") titles = SL.extract().map((it) => it.title);
        titles = titles.slice(0, 30);
      }
      const ideas = await sendAI("suggestSearches", {
        site: SL.currentSite(),
        query: queryEl.value.trim(),
        intent: want,
        lens,
        titles,
        market: want ? null : lastMarket,
      });
      if (!ideas.length) throw new Error("No ideas this time. Try describing what you want.");
      ideas.slice(0, 6).forEach((idea) => {
        const extra = [idea.maxPrice > 0 && `up to $${idea.maxPrice}`, idea.newest && "newest first"].filter(Boolean).join(", ");
        const star = h("button", { class: "srow-act", title: "Keep this search under Saved" }, "Save");
        star.addEventListener("click", () => saveIdea(idea, star));
        // A real link: click to search here, ctrl/middle-click for a new tab. Why it's suggested is on hover.
        ideasList.append(
          h(
            "div",
            { class: "idea-row" },
            h("span", { class: `kind k-${idea.kind}` }, KIND[idea.kind] || "Idea"),
            h("a", { href: SL.searchUrl(idea), title: `${idea.why}${extra ? ` (${extra})` : ""}` }, idea.query),
            star
          )
        );
      });
      ideasStatus.textContent = want
        ? `Searches for what you want (\u201c${want.length > 50 ? want.slice(0, 47) + "\u2026" : want}\u201d). Hover one for why; Save keeps it.`
        : `Other ways to search, from the ${titles.length || "current"} results here. Hover one for why; Save keeps it.`;
    } catch (e) {
      ideasStatus.classList.toggle("err", !isStop(e));
      ideasStatus.textContent = isStop(e) ? "Stopped." : e.message;
    } finally {
      ideasBtn.disabled = false;
      setBusy(false);
    }
  };
  ideasBtn.addEventListener("click", getIdeas);
  wantEl.addEventListener("keydown", (e) => e.key === "Enter" && SL.pageType() === "home" && getIdeas());

  // ---------- show only on results pages (FB is a single-page app) ----------

  // Facebook changes the address without reloading when you open a listing and come back.
  // Keep each results page's scan so Back brings it back instead of starting over.
  const stash = new Map(); // results href -> saved scan
  const saveScan = (href) => {
    if (!scored.size && !scanning) return; // a scan under way keeps filling this page's results
    stash.delete(href);
    stash.set(href, { scored, seen, facts, pageHadKnown, lastMarket, scanInputs, lens, query: queryEl.value, market: [...marketEl.childNodes] });
    if (stash.size > 5) stash.delete(stash.keys().next().value);
  };
  const restoreScan = (href) => {
    const saved = stash.get(href);
    if (!saved || saved.lens !== lens) return false;
    ({ scored, seen, facts, pageHadKnown, lastMarket, scanInputs } = saved);
    queryEl.value = saved.query;
    marketEl.replaceChildren(...saved.market);
    render();
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
    pageEpoch++; // work still running for the page you left finishes quietly (see scan)
    const type = (lastType = SL.pageType());
    const onResults = !!type;
    if (onResults && !host.isConnected) document.documentElement.append(host);
    if (!onResults && host.isConnected) host.remove();
    if (onResults) {
      scanBtn.hidden = type !== "results";
      analyzeBtn.hidden = type !== "item";
      qwrap.hidden = type === "home";
      ideasBtn.hidden = type !== "home"; // on eBay's front page there's no search yet: ideas start one
      ideasBox.hidden = true;
      wrap.dataset.page = type;
      setView(type === "other" ? "saved" : "page");
      applyIntro();
      ideasList.replaceChildren();
      ideasStatus.textContent = "";
      lastMarket = null;
      cacheTried = false;
      scanInputs = null;
      restoreOff = false;
      editingInputs = false;
      freeRow.hidden = true;
      analyzeBtn.textContent = "Analyze this listing";
      analyzeBtn.className = "scan";
      clearStickers();
      facts = new Map();
      passKeys = new Set();
      pageHadKnown = null;
      pageInfo.hidden = true;
      itemEl.replaceChildren();
      listEl.replaceChildren();
      marketEl.textContent = "";
      setCount(0);
      setStatus("");
      if (type !== "results" || !restoreScan(lastHref)) queryEl.value = SL.detectQuery();
      if (type === "results") quickReady = loadQuick();
      showBrowseNote();
      updateFold();
      if (type === "item") setTimeout(itemPass, 1200); // let the listing finish rendering
    }
  };

  // One timer for everything that has to notice page changes: navigation, newly loaded
  // listings, and Facebook dropping our stickers when it recycles cards.
  let ticks = 0;
  const tick = () => {
    if (!alive()) return teardown();
    sync();
    if (document.hidden) return;
    syncPageTheme();
    reapplyFacebook();
    if (!scanning) pagePass(); // cheap when nothing changed: compares the listing links only
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
