// Tirekick — on-page panel and scan flow.
// Flow: extract listings -> (optional) get eBay sold prices -> rank in batches
// with the chosen model -> show ranked list + stickers on the cards themselves.

(() => {
  const TK = window.Tirekick;
  const TKShared = window.TKShared;
  const TKRules = window.TKRules;
  const TKHome = window.TKHome;
  const THEME = window.TKTheme; // colors, type, the tread dot and glyphs (lib/theme.js)
  if (!TK || !TKShared || !TKRules || !TKHome || !THEME || window.__tirekickPanel) return;
  window.__tirekickPanel = true;
  // Ends every listener this copy puts on the page itself (document and window), at teardown.
  const life = new AbortController();
  const until = { signal: life.signal };

  // A tab left open across the update from Second Look (the old name) still holds that version's panel
  // and card tags. Its script is cut off from the extension (it removes its own panel, not the tags),
  // so clear what it drew before drawing ours.
  if (document.querySelector("#second-look-host, #second-look-styles, .second-look-sticker, .second-look-marks, [data-second-look-key]")) {
    document.querySelectorAll("#second-look-host, #second-look-styles, #second-look-toast, .second-look-sticker, .second-look-marks").forEach((n) => n.remove());
    document.querySelectorAll("[data-second-look-pos]").forEach((n) => (n.style.position = ""));
    const OLD = ["data-second-look", "data-second-look-key", "data-second-look-pos", "data-sl-hide", "data-sl-v", "data-sl-cell", "data-sl-sig", "data-sl-has", "data-sl-faded", "data-sl-lift", "data-sl-skip", "data-sl-showhidden"];
    document.querySelectorAll(OLD.map((a) => `[${a}]`).join(",")).forEach((n) => OLD.forEach((a) => n.removeAttribute(a)));
    document.documentElement.removeAttribute("data-sl-theme");
  }

  // Verdict colors come from the theme (--v-great etc.), keyed by data-v.
  // A word always sits beside the score: the verdict colors are too close in lightness to tell apart on their own.
  const SHORT = { great: "Great", good: "Good", fair: "Fair", pass: "Skip", suspicious: "Scam?" };
  const VERDICT = {
    great: { label: "Great deal" },
    good: { label: "Worth a look" },
    fair: { label: "Fair price" },
    pass: { label: "Skip" },
    suspicious: { label: "Likely scam" },
  };

  // ---------- photo checks change the rating ----------
  // The plain rules (photo verdicts, words, filters, scam signs, small formatters) live in content/rules.js.
  const { clamp100, fitScore, signed, adjustedVerdict, dollars, shortDate, normTitle, hash, likelyScam, PROJECT, MOTIVATED, clueOf } = TKRules;

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
  const STALE = "Tirekick was updated. Reload this page to keep using it.";
  // After the extension is updated or reloaded, this copy stays on the open page but can't reach the
  // extension: any chrome.* call still under way then fails with "Extension context invalidated". Those
  // failures are expected, not errors: swallow them and stop this copy (teardown, below) so it goes quiet.
  let retired = false;
  const orphaned = (err) => !alive() && /Extension context invalidated|context invalidated|Receiving end does not exist/i.test(String(err?.message ?? err ?? "")) || err?.message === STALE;
  const retire = () => {
    if (retired) return;
    retired = true;
    try {
      teardown();
    } catch {} // the panel may not be built yet
  };
  window.addEventListener("unhandledrejection", (e) => orphaned(e.reason) && (e.preventDefault(), retire()));
  window.addEventListener("error", (e) => orphaned(e.error ?? e.message) && (e.preventDefault(), retire()));

  const send = (type, payload) =>
    new Promise((resolve, reject) => {
      if (!alive()) return reject(new Error(STALE));
      chrome.runtime.sendMessage({ type, payload }, (res) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        res?.ok ? resolve(res.data) : reject(new Error(res?.error || "Unknown error"));
      });
    });

  // On this tab the toolbar icon opens the panel, not the popup it opens everywhere else.
  if (window === window.top) send("panelTab").catch(() => {});

  // The typeface ships inside the extension and is added with the FontFace API from bytes the background
  // provides, once the page is idle: one file, registered as the UI and the display face (THEME.FONTS).
  // Until then (or if it fails) the stacks fall back to system fonts, so nothing waits on it.
  const loadFonts = async () => {
    try {
      const b64 = await send("getFont", { file: THEME.FONT_FILE });
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      for (const [family, desc] of THEME.FONTS) document.fonts.add(await new FontFace(family, bytes.buffer, desc).load());
    } catch (e) {
      if (alive()) console.warn("[Tirekick] font", THEME.FONT_FILE, e.message);
    }
  };
  (window.requestIdleCallback || setTimeout)(loadFonts, { timeout: 1500 });

  // Small DOM builder: always uses textContent, so listing text can't inject HTML.
  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    if (tag === "input" || tag === "textarea") el.autocomplete = "off"; // no browser box of past entries over ours
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") el.className = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (v != null) el.setAttribute(k, v);
    }
    kids.flat().forEach((k) => k != null && el.append(k instanceof Node ? k : document.createTextNode(String(k))));
    return el;
  };

  const tagEl = (verdict, score) => {
    const el = h("div", { class: "tag", "data-v": verdict, role: "img", "aria-label": `Score ${score}, ${SHORT[verdict] || verdict}` }, h("span", {}, String(score)), h("i", {}, SHORT[verdict] || ""));
    el.style.setProperty("--p", String(Math.max(0, Math.min(100, Number(score) || 0))));
    el.style.setProperty("--lit", String(THEME.lit(score)));
    return el;
  };

  // Every row's way to the listing itself, under its price (the title shows the card on the page instead).
  // The address comes from the page, so it goes through the same check as stored ones.
  const openLink = (it) => h("a", { class: "open", href: TKShared.safeUrl(it.url, "#"), target: "_blank", rel: "noopener", title: "Open the listing in a new tab" }, "Open \u2197");

  // The card tag's score: a tread dot like the panel's, set through CSSOM so a page's style rules can't block it
  const scoreDial = (item) => {
    const el = h("div", { class: "tk-score" }, h("b", {}, String(item.score)), h("i", {}, SHORT[item.verdict] || ""));
    el.style.setProperty("--p", String(Math.max(0, Math.min(100, Number(item.score) || 0))));
    el.style.setProperty("--lit", String(THEME.lit(item.score)));
    return el;
  };

  // ---------- panel shell (shadow DOM keeps site CSS out) ----------

  const host = h("div", { id: "tirekick-host" });
  // The host's box covers the whole drawer area even when the panel is tucked away, so it must not
  // take clicks itself: only the tab and the open panel do (see .tab / .open .panel below).
  host.style.cssText = "position:fixed;right:0;bottom:20px;z-index:2147483646;pointer-events:none;";
  const root = host.attachShadow({ mode: "open" });
  // The mark: the orange tire, as in the toolbar icon.
  const MARK = `<svg class="m-vec" viewBox="0 0 24 24" aria-hidden="true">${THEME.logoMark(12, 11.5, 22)}</svg>`;

  // The two palettes come from lib/theme.js (contrast measured there). --on-v and --on-accent are the text
  // colors that sit on a verdict or accent fill; --btn/--on-btn the main button.
  const THEME_DARK = THEME.vars("dark");
  const THEME_LIGHT = THEME.vars("light");
  // Color, type and shape. Shared by the panel and the photo-check card.
  const THEME_CSS = `
    /* ---------- tokens: dark first; the light set is used when the browser asks for it or Setup says so ---------- */
    .wrap {
      --w: min(380px, calc(100vw - 32px)); --gap: 16px; /* applyBox() sets --w from the chosen width */
      --r:12px; --r-sm:7px; --bw:1px; --press:none;
      --ui:${THEME.UI};
      /* the display face (bundled, see loadFonts) is for the wordmark, headlines, scores and prices; everything you operate stays in --ui */
      --display:${THEME.DISPLAY};
      --mono:ui-monospace, "SF Mono", Menlo, Consolas, monospace;
      font:14px/1.5 var(--ui); color:var(--ink); -webkit-font-smoothing:antialiased;
      ${THEME_DARK}
    }
    @media (prefers-color-scheme: light) { .wrap { ${THEME_LIGHT} } }
    /* Match (the default) follows the page you're on, not the browser: a light eBay page gets a light panel
       even when the browser is dark. The browser setting only decides before the page's colors are known. */
    .wrap[data-page-theme="light"]:not([data-theme]) { ${THEME_LIGHT} }
    .wrap[data-page-theme="dark"]:not([data-theme]) { ${THEME_DARK} }
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
    .tab .tab-label { writing-mode:vertical-rl; font:600 15px/1 var(--display); letter-spacing:.01em; }
    .count { position:absolute; top:-9px; left:-9px; min-width:20px; height:20px; padding:0 6px; border-radius:10px; background:var(--ink); color:var(--on-ink);
      font:600 11px/20px var(--ui); font-style:normal; text-align:center; font-variant-numeric:tabular-nums; }
    .count.new { background:var(--accent); color:var(--on-accent); }
    .open .count { display:none; }

    /* ---------- panel ---------- */
    /* one height for every view, so switching This page / Saved / a listing doesn't move the panel; only the body scrolls */
    .panel { width:var(--w); height:min(760px, calc(100vh - 48px)); display:flex; flex-direction:column; overflow:hidden; margin-right:var(--gap);
      background:var(--paper); border:var(--bw) solid var(--rule); border-radius:var(--r); box-shadow:var(--shadow); }
    .head { display:flex; align-items:center; gap:10px; padding:12px 10px 4px 16px; cursor:grab; touch-action:none; }
    .head button { cursor:pointer; }
    .head:focus-visible { outline:2px solid var(--ink); outline-offset:-2px; border-radius:var(--r); }

    /* ---------- where it sits: docked right (default) or left, in one of three widths ---------- */
    .panel { position:relative; }
    .noanim .drawer, .noanim .tab, .noanim .panel { transition:none !important; }
    .dragging, .dragging * { cursor:grabbing !important; user-select:none; }
    .dragging .panel { transition:none; }
    /* the inner edge pulls to change the width; a hairline shows where to grab */
    .rz { position:absolute; z-index:3; top:14px; bottom:14px; width:8px; cursor:ew-resize; touch-action:none; }
    .rz-w { left:0; } .rz-e { right:0; }
    .wrap:not([data-side="left"]) .rz-e, .wrap[data-side="left"] .rz-w { display:none; }
    .rz::after { content:""; position:absolute; top:50%; left:3px; width:2px; height:32px; margin-top:-16px; border-radius:1px; background:var(--line); opacity:0; transition:opacity .15s; }
    .rz:hover::after, .resizing .rz::after { opacity:1; }
    .zones { position:fixed; inset:0; pointer-events:none; display:none; }
    .moving .zones { display:block; }
    .zone { position:fixed; top:8px; bottom:20px; width:calc(var(--w) + var(--gap)); max-width:calc(50vw - 8px); border:2px dashed var(--line); border-radius:var(--r); opacity:.7; transition:background .12s, border-color .12s, opacity .12s; }
    .zone[data-side="right"] { right:calc(var(--gap) / 2); } .zone[data-side="left"] { left:calc(var(--gap) / 2); }
    .zone.on { border-color:var(--ink); background:color-mix(in srgb, var(--paper) 40%, transparent); opacity:1; }
    .wrap[data-side="left"] .drawer { flex-direction:row-reverse; transform:translateX(calc(-1 * (var(--w) + var(--gap)))); }
    .wrap[data-side="left"].open .drawer { transform:none; }
    .wrap[data-side="left"] .tab { border-right:var(--bw) solid var(--line); border-left:0; border-radius:0 var(--r) var(--r) 0; }
    .wrap[data-side="left"] .panel { margin-right:0; margin-left:var(--gap); }
    .wrap[data-side="left"] .count { left:auto; right:-9px; }
    .wrap[data-side="left"] [data-act="toggle"] svg { transform:scaleX(-1); }
    .nav { display:flex; min-width:0; }
    .nav button[hidden] { display:none; }
    .nav button { border:0; background:none; margin:0 16px -1px 0; padding:12px 0 10px; white-space:nowrap; border-bottom:2px solid transparent; color:var(--muted); font:600 13px/1 var(--ui); cursor:pointer; }
    .nav button:hover { color:var(--ink); }
    .nav button[aria-selected="true"] { color:var(--ink); border-bottom-color:var(--accent); }
    /* Windows high contrast paints every border; keep only the chosen tab's line, and mark chosen buttons with Highlight */
    @media (forced-colors: active) {
      .nav button { border-bottom-color:Canvas; }
      .nav button[aria-selected="true"] { border-bottom-color:Highlight; }
      .modebar button[aria-checked="true"], .seg button[aria-checked="true"] { forced-color-adjust:none; background:Highlight; color:HighlightText; }
    }
    .nav .cnt { margin-left:5px; font-weight:400; color:var(--muted); }
    .nav .cnt:empty { display:none; }
    .nav .cnt.alert { color:var(--accent); font-weight:700; }

    /* ---------- Home: alerts on saved things, numbers, paid AI spending ---------- */
    .view-home { padding:4px 16px 16px; }
    ${TKHome.CSS}
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
    .wordmark { display:block; font:800 23px/1 var(--display); letter-spacing:-.035em; white-space:nowrap; }
    ${THEME.wordmarkCss(".wordmark")}
    .head small { display:block; color:var(--muted); font-size:13px; margin-top:2px; }
    .icon-btn { flex:none; width:30px; height:30px; display:grid; place-items:center; border:0; border-radius:var(--r-sm); background:none; color:var(--muted); cursor:pointer; }
    .icon-btn svg { width:16px; height:16px; }
    .icon-btn:hover { background:var(--paper-2); color:var(--ink); }

    .body { flex:1; min-height:0; overflow-y:auto; scrollbar-width:thin; scrollbar-color:var(--rule) transparent; }
    /* once the list scrolls under the tabs, a soft edge shows there's more above (no script: a scroll-driven animation) */
    @supports (animation-timeline: scroll()) {
      .body { animation:scrolled linear both; animation-timeline:scroll(self); animation-range:0 32px; }
      @keyframes scrolled { from { box-shadow:inset 0 0 0 transparent; } to { box-shadow:inset 0 10px 10px -10px rgba(0,0,0,.28); } }
    }
    .controls { padding:14px 16px 12px; display:grid; grid-template-columns:minmax(0, 1fr); gap:12px; }
    label { display:block; margin-bottom:6px; color:var(--muted); font:600 13px/1.2 var(--ui); }
    input { width:100%; padding:9px 11px; border:var(--bw) solid var(--line); border-radius:var(--r-sm); background:var(--paper); color:var(--ink); font:inherit; transition:border-color .15s; }
    input::placeholder { color:var(--muted); opacity:.7; }
    input:focus { outline:2px solid var(--ink); outline-offset:-1px; }

    /* Buyer or Reseller: a small switch at the end of the tab row, because Saved and Home follow it too.
       What each one means is the first line of This page (.mode-hint). */
    .bar { flex:none; display:flex; align-items:center; gap:10px; padding:0 12px 0 16px; border-bottom:var(--bw) solid var(--rule); }
    .modebar { flex:none; margin-left:auto; display:flex; gap:2px; padding:2px; background:var(--paper-2); border-radius:999px; }
    .modebar button { min-height:26px; padding:4px 11px; border:0; border-radius:999px; background:none; color:var(--muted); font:600 13px/1 var(--ui); cursor:pointer; transition:background .18s, color .18s, box-shadow .18s; }
    .modebar button:hover { color:var(--ink); }
    .modebar button[aria-checked="true"] { background:var(--raise); color:var(--ink); box-shadow:0 0 0 1px var(--rule), 0 1px 2px rgba(0,0,0,.12); }
    .panel { container-type:inline-size; }
    @container (max-width: 350px) { .nav button { margin-right:12px; } .modebar button { padding:4px 8px; } }
    .head, .nav { flex:none; }
    @media (max-height: 620px) { .head { padding-top:8px; padding-bottom:0; } .nav button { padding:9px 0 8px; } }
    /* a short window or 200% zoom: the header and footer give their room to the list */
    @media (max-height: 480px) { .panel { height:calc(100vh - 16px); } .head { padding:4px 10px 0 16px; } .nav button { padding:5px 0 4px; } .foot-row { padding:4px 12px 4px 14px; } }
    .hint { color:var(--muted); font-size:14px; }
    .inputs { display:grid; gap:12px; }
    .knows-modes .mode-hint, .folded .inputs, .folded .mode-hint, .no-model .mode-hint, .controls:has(> .welcome:not([hidden])) .mode-hint { display:none; }
    .wrap:not([data-workspace="reseller"]) .feewrap { display:none; }
    .feewrap { display:grid; grid-template-columns:1fr 84px; align-items:center; column-gap:12px; }
    .feewrap label { margin:0; }
    .feewrap .hint { grid-column:1 / -1; margin-top:6px; }
    .inputs-sum { display:flex; gap:10px; align-items:baseline; justify-content:space-between; padding:8px 11px; border:var(--bw) solid var(--rule); border-radius:var(--r-sm); font-size:13px; color:var(--muted); }
    .inputs-sum b { color:var(--ink); font-weight:600; }
    .inputs-sum .sum-text { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .inputs-sum button { all:unset; flex:none; padding:3px 4px; margin:-3px -4px; cursor:pointer; color:var(--ink); font-weight:600; text-decoration:underline; text-decoration-color:var(--rule); text-underline-offset:3px; }
    .inputs-sum button:hover { text-decoration-color:currentColor; }
    .inputs-sum button:focus-visible { outline:2px solid var(--ink); outline-offset:2px; }
    .browse-note { margin-top:6px; }
    /* The compare words come from the page's search: until you want them changed they're one line, not a box */
    .q-sum { display:flex; flex-wrap:wrap; align-items:baseline; gap:2px 8px; margin-top:-4px; color:var(--muted); font-size:13px; }
    .q-sum b { color:var(--ink); font-weight:600; }
    .q-sum button { all:unset; padding:3px 0; cursor:pointer; color:var(--ink); font-weight:600; text-decoration:underline; text-decoration-color:var(--rule); text-underline-offset:3px; }
    .q-sum button:hover { text-decoration-color:currentColor; }
    .q-sum button:focus-visible { outline:2px solid var(--ink); outline-offset:2px; }
    .wrap:not(.q-folded) .q-sum, .q-folded .qwrap { display:none; }
    .inputs-done { justify-self:start; align-self:flex-start; }
    .inputs-done[hidden] { display:none; }
    .browse-note b { color:var(--ink); font-weight:600; }

    .scan { min-height:42px; background:var(--btn); color:var(--on-btn); border:var(--bw) solid var(--btn); border-radius:var(--r-sm); padding:11px; font:600 14px/1 var(--ui);
      box-shadow:var(--press); cursor:pointer; transition:opacity .15s, transform .08s, box-shadow .08s; }
    .scan:hover:not(:disabled) { opacity:.88; }
    .scan .cost, .ghost .cost { font-weight:400; opacity:.75; }
    .scan:disabled { opacity:.55; cursor:progress; }
    /* Auto: a switch under Scan. On, new listings are scored as they load and Scan is only for a redo */
    .autoscan { display:flex; align-items:center; gap:8px; margin:-4px 0 0; color:var(--muted); font:400 13px/1.3 var(--ui); letter-spacing:normal; text-transform:none; cursor:pointer; }
    .autoscan[hidden] { display:none; }
    .autoscan input { appearance:none; -webkit-appearance:none; flex:none; position:relative; width:30px; height:18px; margin:0; border-radius:999px; background:var(--rule); cursor:pointer; transition:background .15s; }
    .autoscan input::after { content:""; position:absolute; top:2px; left:2px; width:14px; height:14px; border-radius:50%; background:var(--raise); box-shadow:0 1px 2px rgba(0,0,0,.25); transition:transform .15s; }
    .autoscan input:checked { background:var(--btn); }
    .autoscan input:checked::after { transform:translateX(12px); background:var(--on-btn); }
    .autoscan input:focus-visible { outline:2px solid var(--ink); outline-offset:2px; }
    .autoscan:has(input:checked) { color:var(--ink); }
    @media (forced-colors: active) { .autoscan input { appearance:auto; } .autoscan input::after { display:none; } }
    /* the other two ways to use a search, side by side under Scan */
    .alts { display:flex; gap:8px; margin-top:-4px; }
    .alts > * { flex:1 1 0; min-width:0; }
    .alts:not(:has(> :not([hidden]))) { display:none; }
    .status { color:var(--muted); font-size:14px; white-space:pre-line; }
    .statusrow { display:flex; align-items:flex-start; gap:10px; }
    .statusrow .status { flex:1; min-width:0; }
    .statusrow:not(:has(.status:not(:empty), .stopbtn:not([hidden]))) { display:none; }
    .stopbtn { flex:none; margin-left:auto; border:var(--bw) solid var(--v-suspicious); background:none; color:var(--v-suspicious); border-radius:999px; padding:4px 12px;
      font:600 13px/1.3 var(--ui); cursor:pointer; }
    .stopbtn:hover:not(:disabled) { background:var(--v-suspicious); color:var(--on-v); }
    .stopbtn:disabled { opacity:.6; cursor:progress; }
    .status:empty { display:none; }
    .status.err { color:var(--v-suspicious); border-left:2px solid currentColor; padding-left:10px; }
    .readwarn { margin-top:10px; }
    .status.readwarn button { display:block; margin-left:0; text-decoration:none; margin-top:8px; border:var(--bw) solid currentColor; background:none; color:inherit; border-radius:999px; padding:4px 12px; font:600 13px/1.3 var(--ui); cursor:pointer; }
    .status.readwarn button:hover { background:var(--v-suspicious); color:var(--on-v); }
    .busy .status:not(.err):not(:empty)::before { content:""; display:inline-block; width:10px; height:10px; margin-right:8px; vertical-align:-1px;
      border:1.5px solid var(--rule); border-top-color:var(--ink); border-radius:50%; animation:spin .8s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
    .actions { display:flex; flex-wrap:wrap; gap:6px 16px; font-size:13px; font-weight:600; }
    .actions > * { white-space:nowrap; }
    .controls > .actions:not(:has(:not([hidden]))) { display:none; }
    .actions a, .actions button { color:var(--ink); background:none; border:0; padding:3px 0; margin:-3px 0; font:inherit; line-height:18px; cursor:pointer;
      text-decoration:underline; text-decoration-color:var(--rule); text-underline-offset:3px; text-decoration-thickness:1px; }
    .actions a:hover, .actions button:hover:not(:disabled) { text-decoration-color:currentColor; }
    /* small text links keep their look but get a 24px-high target (WCAG 2.5.8) */
    .actions a, .actions button, a.open, .pi-line button { position:relative; }
    .actions a::after, .actions button::after, a.open::after, .pi-line button::after { content:""; position:absolute; inset:-4px -3px; }

    /* footer: model switch and what it's costing */
    .foot { position:relative; flex:none; border-top:var(--bw) solid var(--rule); background:var(--paper); }
    .foot-row { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:8px 12px 8px 14px; }
    .sr { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); }
    .model-pick { margin:0; display:block; min-width:0; text-transform:none; letter-spacing:normal; }
    .model { max-width:210px; appearance:none; -webkit-appearance:none; border:var(--bw) solid var(--line); border-radius:var(--r-sm); background:var(--paper);
      color:var(--ink); font:600 13px/1 var(--ui); padding:6px 24px 6px 9px; min-height:28px; cursor:pointer; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; /* one line; the full name is on hover */
      background-image:linear-gradient(45deg, transparent 50%, var(--muted) 50%), linear-gradient(135deg, var(--muted) 50%, transparent 50%);
      background-position:calc(100% - 13px) 50%, calc(100% - 9px) 50%; background-size:4px 4px; background-repeat:no-repeat; }
    .model:focus { outline:none; border-color:var(--ink); }
    .model:focus-visible { outline:2px solid var(--ink); outline-offset:2px; }
    .spend { all:unset; padding:4px 0; cursor:pointer; color:var(--muted); font-size:13px; white-space:nowrap; font-variant-numeric:tabular-nums; }
    .spend b { color:var(--muted); font:500 13px/1 var(--ui); font-variant-numeric:lining-nums tabular-nums; }
    .spend:hover b, .spend[aria-expanded="true"] b { text-decoration:underline; text-underline-offset:3px; text-decoration-thickness:1px; }
    .spend[hidden], .model-pick[hidden] { display:none; }
    .spend.warn b { color:var(--v-fair); } .spend.over b { color:var(--v-suspicious); }
    .budget { height:3px; background:var(--rule); }
    .budget i { display:block; height:100%; width:0; background:var(--ink); transition:width .3s; }
    .budget.warn i { background:var(--v-fair); } .budget.over i { background:var(--v-suspicious); }
    .spend-detail { position:absolute; left:8px; right:8px; bottom:calc(100% + 6px); padding:12px 14px 10px; font-size:13px; display:grid; gap:8px; max-height:40vh; overflow:auto;
      background:var(--paper); border:var(--bw) solid var(--rule); border-radius:var(--r); box-shadow:var(--shadow); }
    .sd-grid { display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; }
    .sd-grid span { display:block; color:var(--muted); font-size:13px; }
    .sd-grid b { font:600 20px/1.2 var(--display); font-variant-numeric:lining-nums; }
    .sd-models { display:grid; gap:3px; }
    .sd-models div { display:flex; justify-content:space-between; gap:8px; }
    .sd-models div span:last-child { color:var(--muted); font-variant-numeric:tabular-nums; }
    .sd-note button { all:unset; padding:3px 0; cursor:pointer; color:var(--ink); text-decoration:underline; text-decoration-color:var(--line); text-underline-offset:3px; }
    .sd-note button:hover { text-decoration-color:currentColor; }
    .sd-note button:focus-visible { outline:2px solid var(--ink); outline-offset:2px; }

    /* first-run walkthrough */
    .welcome { display:grid; gap:8px; padding:14px 16px; border:var(--bw) solid var(--line); border-radius:var(--r); background:var(--raise); font-size:14px; }
    .welcome > b:first-child { font:600 19px/1.2 var(--display); letter-spacing:-.01em; }
    .welcome b { font:600 15px/1.2 var(--ui); }
    .welcome .w-points { margin:0; padding-left:18px; display:grid; gap:5px; line-height:1.45; }
    .welcome .w-points li::marker { color:var(--accent); }
    .welcome .w-points b { font:600 14px/1.45 var(--ui); }
    .welcome .w-note { font-size:13px; }
    .welcome .go { justify-self:start; }
    /* No model yet: a quiet note after the points; the free features come first */
    .welcome .step-key { display:grid; gap:4px; padding:10px 12px; border-radius:var(--r-sm); background:var(--paper-2); }
    .welcome .step-key b { font:600 14px/1.4 var(--ui); }
    .welcome .step-key .setup-text { color:var(--muted); }
    .welcome .step-key .setup-go { justify-self:start; margin-top:6px; min-height:36px; padding:9px 14px; font:600 13px/1 var(--ui); }
    /* Model-only controls wait until there is a model: Compare prices against and free sold prices still work */
    .no-model .want-field, .no-model .feewrap, .no-model [data-act="scan"], .no-model [data-act="analyze"], .no-model [data-act="ideas"] { display:none !important; }

    /* first run, list bar */
    .setup { display:grid; gap:10px; padding:12px; border:var(--bw) solid var(--rule); border-radius:var(--r-sm); font-size:14px; }
    .listbar { position:sticky; top:0; z-index:2; display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:6px 10px; margin:0 16px; padding:10px 0 8px;
      border-top:var(--bw) solid var(--rule); border-bottom:var(--bw) solid var(--rule); background:var(--paper); font-size:13px; color:var(--muted); }
    .listbar + .list > .row:first-child { border-top:0; }
    .sortpick { display:flex; align-items:center; gap:6px; margin:0; font:inherit; letter-spacing:normal; text-transform:none; color:var(--muted); }
    .sort { field-sizing:content; max-width:190px; appearance:none; -webkit-appearance:none; border:0; background:none; color:var(--ink); font:600 13px/1 var(--ui); padding:6px 14px 6px 0; cursor:pointer;
      background-image:linear-gradient(45deg, transparent 50%, var(--muted) 50%), linear-gradient(135deg, var(--muted) 50%, transparent 50%);
      background-position:calc(100% - 6px) 55%, calc(100% - 2px) 55%; background-size:4px 4px; background-repeat:no-repeat; }
    .sort:focus-visible { outline:2px solid var(--ink); outline-offset:2px; }
    /* The Sort and model menus open in the panel's own colors. Where the menu itself can't be styled,
       the options at least get the panel's paper and ink, so they never come out light-on-white. */
    .sort option, .model option { background:var(--paper); color:var(--ink); }
    @supports (appearance: base-select) {
      .sort, .model, .sort::picker(select), .model::picker(select) { appearance:base-select; }
      .sort::picker-icon, .model::picker-icon { display:none; } /* the panel draws its own chevron */
      .sort:open, .model:open { outline:none; }
      .sort::picker(select), .model::picker(select) { margin:4px 0; padding:4px; min-width:200px; border:var(--bw) solid var(--rule); border-radius:var(--r);
        background:var(--paper); color:var(--ink); box-shadow:var(--shadow); }
      .sort option, .model option { display:flex; align-items:center; gap:8px; min-height:30px; padding:6px 10px; border-radius:var(--r-sm);
        font:400 13px/1.3 var(--ui); color:var(--ink); cursor:pointer; }
      .sort option:hover, .model option:hover, .sort option:focus-visible, .model option:focus-visible { background:var(--paper-2); outline:none; }
      .sort option:checked, .model option:checked { font-weight:600; }
      .sort option::checkmark, .model option::checkmark { order:1; margin-left:auto; color:var(--muted); }
      /* Sort sits at the right edge: its menu drops down, right-aligned to it, over the list it sorts */
      .sort::picker(select) { position-area:block-end span-inline-start; position-try-order:normal; position-try-fallbacks:flip-block; }
    }
    .skipwrap { display:flex; align-items:center; gap:8px; flex:1 1 100%; order:4; }
    .lb-quick { display:flex; flex-wrap:wrap; gap:6px; margin-right:auto; }
    .qf { flex:1 1 100%; order:5; display:grid; gap:6px; margin-bottom:4px; }
    .qf[hidden] { display:none; }
    .qf-row { display:flex; gap:6px; align-items:center; flex-wrap:wrap; }
    .qf input { padding:6px 9px; font-size:13px; }
    .qf-wordwrap { position:relative; flex:1 1 140px; display:flex; }
    .qf-words { flex:1; width:auto; padding-right:26px !important; }
    .qf-price { display:flex; align-items:center; gap:3px; color:var(--muted); }
    .qf-price input { width:58px; }
    .qt { border:var(--bw) solid var(--line); background:none; color:var(--muted); font:600 13px/1 var(--ui); padding:5px 10px; border-radius:999px; cursor:pointer; }
    .qt:hover { color:var(--ink); border-color:var(--muted); }
    .qf-toggle.on { color:var(--ink); border-color:var(--ink); }
    .qt { min-height:26px; }
    .qt[aria-pressed="true"] { background:var(--ink); border-color:var(--ink); color:var(--on-ink); }
    .qf-deal { display:flex; align-items:center; gap:5px; margin:0 0 0 auto; color:var(--muted); font:600 13px/1 var(--ui); letter-spacing:normal; text-transform:none; }
    .qf-deal input { width:62px; }
    .qf-deal:has(input:not(:placeholder-shown)) input { border-color:var(--accent); }
    .qf-clear { position:absolute; right:2px; top:50%; transform:translateY(-50%); width:24px; height:24px; display:grid; place-items:center; border:0; border-radius:var(--r-sm);
      background:none; color:var(--muted); font:16px/1 var(--ui); cursor:pointer; }
    .qf-clear:hover { background:var(--paper-2); color:var(--ink); }
    .qf.on .qf-words, .qf.on .qf-price input:not(:placeholder-shown) { border-color:var(--ink); }
    .skipwrap .seg button { padding:6px 8px; }

    /* what's on this page */
    .pageinfo { font-size:14px; color:var(--muted); }
    .pi-reset { all:unset; padding:3px 0; cursor:pointer; color:var(--muted); font-weight:400; text-decoration:underline; text-decoration-color:var(--rule); text-underline-offset:3px; }
    .actions .pi-reset { color:var(--muted); font-weight:400; }
    .pi-reset:hover, .actions .pi-reset:hover { color:var(--ink); text-decoration-color:currentColor; }
    .pageinfo .chips { margin-top:8px; }
    .pageinfo .pi-acts { margin-top:8px; color:var(--muted); font-weight:400; }
    .pi-acts a, .pi-acts button { color:var(--ink) !important; font-weight:600 !important; }
    .pi-search { margin-top:8px; }
    .pi-search:not(:has(> :not([hidden]))) { display:none; }
    .scamnote { margin-bottom:8px; padding:8px 10px; border-left:3px solid var(--v-suspicious); background:var(--paper-2); color:var(--ink); font-size:14px; line-height:1.45; }
    .scamnote b { color:var(--v-suspicious); }
    .pi-bar { display:flex; gap:2px; height:6px; margin:8px 0 10px; }
    .pi-bar i { min-width:6px; border-radius:3px; background:var(--c); }
    .pi-bar i[data-v="great"] { background:var(--dot-great); } .pi-bar i[data-v="good"] { background:var(--dot-good); } .pi-bar i[data-v="fair"] { background:var(--dot-fair); } .pi-bar i[data-v="pass"] { background:var(--dot-pass); } .pi-bar i[data-v="suspicious"] { background:var(--dot-suspicious); }
    @media (forced-colors: active) { .pi-bar i { forced-color-adjust:none; } }
    .pi-head { margin-bottom:3px; color:var(--ink); font:600 23px/1.2 var(--display); letter-spacing:-.015em; }
    .pi-head .mono { font-family:var(--mono); }
    .pi-line b { color:var(--ink); font-weight:600; }
    .pi-line .past .past-why { margin:4px 0 0; }
    .pi-line button { all:unset; position:relative; cursor:pointer; color:var(--ink); font-weight:600; text-decoration:underline; text-decoration-color:var(--rule); text-underline-offset:3px; }
    .pi-line button:hover { text-decoration-color:currentColor; }
    .seg { display:inline-grid; grid-auto-flow:column; gap:2px; padding:2px; background:var(--paper-2); border-radius:999px; }
    .seg button { min-height:24px; border:0; background:none; color:var(--muted); font:600 13px/1 var(--ui); padding:5px 11px; border-radius:999px; cursor:pointer; }
    .seg button:hover { color:var(--ink); }
    .seg button[aria-checked="true"] { background:var(--raise); color:var(--ink); box-shadow:0 0 0 1px var(--rule), 0 1px 2px rgba(0,0,0,.12); }
    .status button { all:unset; cursor:pointer; margin-left:6px; color:var(--ink); font-weight:600; text-decoration:underline; text-underline-offset:3px; }
    .chips { display:flex; flex-wrap:wrap; gap:4px; margin-top:6px; }
    .fchip { font-size:13px; padding:1px 8px; border-radius:999px; background:var(--ink); color:var(--on-ink); font-weight:600; }
    .fchip b { font-weight:700; } .fchip .tk-rest { font-weight:500; }
    .fchip.k-new { background:var(--new-bg); color:var(--new-fg); } .fchip.k-good { background:var(--good-bg); color:var(--good-fg); } .fchip.k-warn { background:var(--warn-bg); color:var(--warn-fg); }
    .fchip.k-plain { background:none; color:var(--ink); box-shadow:inset 0 0 0 1px var(--line); }
    .fchip.k-deal { background:var(--new-bg); color:var(--new-fg); }
    .count.deal { background:var(--accent); color:var(--on-accent); }
    .count.pop { animation:pop .5s cubic-bezier(.3,1.6,.5,1); }
    @keyframes pop { 0% { transform:scale(.6); } 60% { transform:scale(1.25); } 100% { transform:none; } }

    /* sold prices */
    .market { font-size:13px; }
    .market:empty { display:none; }
    .market:not(:empty) { background:var(--paper-2); padding:11px 12px; border-radius:var(--r-sm); }
    .market:has(> .mnote:only-child) { padding:7px 10px; color:var(--muted); font-size:13px; }
    .mnote a { color:var(--ink); font-weight:600; text-underline-offset:3px; }
    .mgrid { display:grid; grid-template-columns:repeat(auto-fit, minmax(0,1fr)); gap:12px; }
    .mlabel { color:var(--muted); font-size:13px; }
    .mval { display:block; font:600 24px/1.15 var(--display); font-variant-numeric:lining-nums; letter-spacing:-.01em; margin:2px 0 1px; }
    .msub { color:var(--muted); font-size:13px; }
    .comps { margin-top:8px; }
    .comps summary { cursor:pointer; color:var(--ink); font-weight:600; font-size:13px; list-style:none; }
    .comps summary::-webkit-details-marker { display:none; }
    .comps summary::before { content:"+ "; color:var(--muted); }
    .comps[open] summary::before { content:"\\2212  "; }
    .comps b { display:block; margin:8px 0 2px; color:var(--muted); font-size:13px; font-weight:600; }
    .comps ul { list-style:none; margin:0; padding:0; }
    .comps li a { display:flex; gap:10px; padding:3px 0; color:var(--ink); text-decoration:none; }
    .comps li a:hover .ct { text-decoration:underline; }
    .comps .cp { flex:none; width:44px; font:600 13px/1.5 var(--display); font-variant-numeric:lining-nums tabular-nums; }
    .comps .ct { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--muted); }

    /* results */
    .list, .itemout { padding:0 16px 12px; }
    .list:empty, .itemout:empty { display:none; }
    .row { display:grid; grid-template-columns:44px minmax(0,1fr) auto; gap:12px; padding:14px 0; border-top:var(--bw) solid var(--rule); animation:fade .25s ease both; }
    .row.still { animation:none; }
    .list > .row, .list > .row.plain { margin:0 -16px; padding-left:16px; padding-right:16px; transition:background .12s; }
    .list > .row:hover, .list > .row:focus-within { background:color-mix(in srgb, var(--paper-2) 70%, transparent); }
    /* Long lists (a Marketplace feed can give hundreds of rows): rows out of view aren't laid out or painted
       until they scroll in, and only the first few fade in. */
    .list > .row { content-visibility:auto; contain-intrinsic-size:auto 110px; }
    .list > .row:nth-child(n+13) { animation:none; }
    .itemout > .row:first-child { border-top:0; }
    @keyframes fade { from { opacity:0; } to { opacity:1; } }
    .view:not([hidden]) { animation:fade .16s ease both; }
    /* the score as a tread dot: filled in the verdict's color, the tread lit as far as the score (lib/theme.js) */
    ${THEME.dotCss(".tag")}
    .tag { width:44px; height:44px; display:grid; place-items:center; }
    .tag span { font:800 18px/1 var(--display); letter-spacing:-.02em; font-variant-numeric:lining-nums tabular-nums; }
    .tag i { display:none; }
    .row.plain { padding:12px 0; grid-template-columns:minmax(0,1fr) auto; }
    .itemout .title { font:600 19px/1.3 var(--display); letter-spacing:-.01em; cursor:default; }
    .itemout > .row:first-child { grid-template-columns:60px minmax(0,1fr) auto; align-items:start; }
    .itemout > .row:first-child .tag { width:60px; height:60px; }
    .itemout > .row:first-child .tag span { font-size:25px; }
    .itemout .title .verdict { font-weight:600; }
    .pr { text-align:right; font:600 17px/1.3 var(--display); font-variant-numeric:lining-nums tabular-nums; letter-spacing:-.01em; }
    .pr.deal { color:var(--accent); }
    .scamline { color:var(--v-suspicious); font-weight:600; }
    /* Dim, as on the page: the row's text fades, its tag and any "Likely scam" line stay at full strength */
    .wrap[data-skipmode="dim"] :is(.row.skip, .row:has(> .tag[data-v="pass"]), .row:has(> .tag[data-v="suspicious"])):not(:hover, :focus-within) > :not(.tag, :has(.scamline)),
    .wrap[data-skipmode="dim"] :is(.row.skip, .row:has(> .tag[data-v="pass"]), .row:has(> .tag[data-v="suspicious"])):not(:hover, :focus-within) > :has(.scamline) > :not(.scamline) { opacity:.5; transition:opacity .15s; }
    .row.plain .actions { margin-top:6px; gap:6px 14px; }
    [data-v="great"] { --c:var(--v-great); } [data-v="good"] { --c:var(--v-good); } [data-v="fair"] { --c:var(--v-fair); }
    [data-v="pass"] { --c:var(--v-pass); } [data-v="suspicious"] { --c:var(--v-suspicious); }
    .title { display:block; background:none; border:0; padding:2px 0; margin:-2px 0; color:var(--ink); font:600 15px/1.35 var(--ui); text-align:left; cursor:pointer; }
    button.title:hover { text-decoration:underline; text-decoration-thickness:1px; text-underline-offset:3px; }
    .verdict { color:var(--c); font-weight:600; white-space:nowrap; }
    ${THEME.glyphCss(".verdict")}
    .meta { color:var(--muted); font-size:14px; margin-top:3px; }
    .meta.lowball { color:var(--v-suspicious); font-weight:600; }
    .meta.pricewhy { color:var(--ink); } /* why the price check moved the verdict: read before the model's reason */
    .lensinfo { margin-top:4px; font-size:13px; font-weight:600; }
    .lensinfo.neg { color:var(--v-suspicious); }
    .reason { margin-top:6px; font-size:14px; }
    .flags { display:flex; flex-wrap:wrap; gap:4px; margin-top:8px; }
    .flag { font-size:13px; padding:1px 8px; border:1px solid var(--rule); border-radius:999px; color:var(--muted); }
    .row .actions { margin-top:8px; }
    .row { row-gap:0; }
    .row > .row-acts, .row > .row-acts ~ div { grid-column:2 / -1; }
    /* the links' line doubles as the row's bottom padding, so their reserved space reads as rhythm, not a gap */
    .list .row:has(> .row-acts) { padding-bottom:6px; }
    .list .row > .row-acts { margin-top:4px; }
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
    /* Open, under the price, on every row: the title shows the card on the page, Open goes to the listing */
    .pr .open { display:block; margin-top:4px; font:600 13px/18px var(--ui); letter-spacing:normal; color:var(--ink); text-decoration:underline; text-decoration-color:var(--line); text-underline-offset:3px; white-space:nowrap; }
    .pr .open:hover { text-decoration-color:currentColor; }
    .pr .open:focus-visible { outline:2px solid var(--ink); outline-offset:2px; }
    .photo { margin-top:8px; font-size:13px; padding:8px 10px; background:var(--paper-2); border-left:2px solid var(--ink); border-radius:0 var(--r-sm) var(--r-sm) 0; }
    .photo.drop { border-left-color:var(--v-suspicious); }
    [hidden] { display:none !important; }

    /* search ideas */
    .ghost { min-height:38px; background:none; color:var(--ink); border:var(--bw) solid var(--line); border-radius:var(--r-sm); padding:9px 10px; font:600 13px/1.1 var(--ui); cursor:pointer; transition:background .15s, border-color .15s; }
    .ghost:hover:not(:disabled) { background:var(--paper-2); border-color:var(--ink); }
    .ghost:disabled { opacity:.55; cursor:progress; }
    .ideas-list:empty { display:none; }
    .saved-body .sub { display:block; margin:6px 0 4px; color:var(--ink); font:600 17px/1.3 var(--display); letter-spacing:-.01em; }
    .saved-body .sub ~ .sub { margin-top:18px; }
    .srow { display:flex; gap:12px; align-items:flex-start; padding:12px 0; border-top:1px solid var(--rule); }
    .srow .pr { flex:none; }
    .srow .meta .srow-act { margin-left:10px; }
    @media (hover:hover) { .srow:not(:hover):not(:focus-within) .meta .srow-act { visibility:hidden; } }
    .sub + .srow { border-top:0; }
    .srow > div { flex:1; min-width:0; }
    .srow a { padding:3px 0; color:var(--ink); font-weight:600; text-decoration:none; overflow-wrap:anywhere; }
    .srow a:hover { text-decoration:underline; text-underline-offset:3px; }
    .srow .meta { margin-top:1px; }
    .srow .down { color:var(--v-great); font-weight:600; }
    .sv-acts { margin:4px 0 10px; }
    .hidden-box { margin-top:12px; border-top:var(--bw) solid var(--rule); padding-top:4px; }
    .hidden-box summary { display:flex; gap:8px; align-items:baseline; min-height:24px; padding:6px 0; cursor:pointer; list-style:none; color:var(--muted); font-size:13px; }
    .hidden-box summary::-webkit-details-marker { display:none; }
    .hidden-box summary::before { content:"+"; width:10px; color:var(--muted); }
    .hidden-box[open] summary::before { content:"\\2212"; }
    .hidden-box summary b { color:var(--muted); font-size:13px; font-weight:600; }
    .hidden-box summary:hover, .hidden-box summary:hover b { color:var(--ink); }
    .hidden-box summary:focus-visible { outline:2px solid var(--ink); outline-offset:2px; }
    .srow.hid a { font-weight:400; color:var(--muted); }
    .srow > .spark { flex:none; width:76px; height:24px; margin-top:2px; }
    .pi-line .spark { margin:8px 0 4px; }
    .view-saved .sub { margin-top:10px; }
    .view-saved .sub:first-of-type { margin-top:0; }
    .sx { flex:none; width:24px; height:24px; display:grid; place-items:center; border:0; border-radius:var(--r-sm); background:none; color:var(--muted); font:16px/1 var(--ui); cursor:pointer; }
    .sx:hover { background:var(--paper-2); color:var(--ink); }
    /* one quiet text action at the end of every Saved row: Remove, or Unhide */
    .srow-act { flex:none; padding:3px 0; border:0; background:none; color:var(--muted); font:400 13px/18px var(--ui); cursor:pointer;
      text-decoration:underline; text-decoration-color:var(--line); text-underline-offset:3px; }
    .srow-act:hover { color:var(--ink); text-decoration-color:currentColor; }
    .actions button.on, .srow-act.on { color:var(--ink) !important; font-weight:600 !important; text-decoration:none; }
    .idea { display:block; padding:10px 0; border-top:1px solid var(--rule); color:var(--ink); text-decoration:none; animation:fade .25s ease both; }
    .idea:hover .q { text-decoration:underline; text-decoration-thickness:1px; text-underline-offset:3px; }
    .kind { color:var(--muted); font-size:13px; font-weight:600; }
    .idea .q { font:600 15px/1.3 var(--ui); margin-top:2px; word-break:break-word; }
    .idea .why { color:var(--muted); font-size:13px; margin-top:2px; }
    .idea .chips { display:flex; flex-wrap:wrap; gap:4px; margin-top:6px; }
    .chip { font-size:13px; padding:1px 7px; border:1px solid var(--rule); border-radius:999px; color:var(--muted); }

    /* one listing */
    .sect { margin-top:12px; padding-top:12px; border-top:var(--bw) solid var(--rule); font-size:14px; }
    .sect > strong:first-child { display:block; margin-bottom:4px; }
    .sect ol { margin:4px 0 6px; padding-left:18px; }
    .sect li { margin:2px 0; }
    .sect .actions { margin-top:8px; }
    .offer { margin-top:12px; padding:11px 12px; background:var(--paper-2); border-radius:var(--r-sm); font-size:14px; }
    .offer-acts { margin-top:8px; }
    .msg-preview { margin-top:8px; color:var(--muted); font-style:italic; }
    .msg-edit { display:block; width:100%; box-sizing:border-box; margin-top:8px; font:inherit; color:var(--ink); background:var(--paper); border:1px solid var(--line); border-radius:var(--r-sm); padding:7px 9px; resize:vertical; }
    .msg-kind { display:flex; width:max-content; margin-top:10px; }
    .said-row { display:flex; align-items:center; gap:6px; margin-top:8px; font-size:13px; color:var(--muted); }
    .said { width:7em; font:inherit; color:var(--ink); background:var(--paper); border:1px solid var(--line); border-radius:var(--r-sm); padding:4px 7px; }
    .said-answer { margin-top:6px; }
    .offer .said-answer b { font:600 13px/1.4 var(--ui); margin:0; color:var(--ink); }
    .said-answer:empty { display:none; }
    .offer b { font:600 20px/1 var(--display); font-variant-numeric:lining-nums; margin:0 2px; }
    .adjust { margin-top:6px; font-size:13px; font-weight:600; color:var(--v-suspicious); }
    .adjust.up { color:var(--v-great); }

    .panel:focus { outline:none; } /* focus lands on the panel itself when it opens; the controls inside show their own ring */
    button:focus-visible, input:focus-visible, a:focus-visible, summary:focus-visible { outline:2px solid var(--ink); outline-offset:2px; }
    input:focus-visible { outline-offset:-1px; }


    @media (prefers-reduced-motion: reduce) { .drawer, .tab, .row, .view, .idea, .count, .progress i, .busy .status::before { transition:none !important; animation:none !important; } }
  </style>
  <div class="wrap">
   <div class="zones" aria-hidden="true"><div class="zone" data-side="left"></div><div class="zone" data-side="right"></div></div>
   <div class="drawer">
    <button class="tab" data-act="tab" aria-label="Open Tirekick" title="Tirekick">
      <span class="mark">${MARK}</span>
      <span class="tab-label">Tirekick</span><i class="count" hidden></i>
    </button>
    <div class="panel" role="complementary" aria-label="Tirekick" tabindex="-1">
      <div class="rz rz-w" data-edge="w" aria-hidden="true" title="Drag to change the width"></div><div class="rz rz-e" data-edge="e" aria-hidden="true" title="Drag to change the width"></div>
      <div class="head" tabindex="0" role="group" aria-label="Panel position: left and right arrow keys pick the side, up and down the width" title="Drag to the left or right edge to dock it there; double-click to put it back">
        <span class="mark">${MARK}</span>
        <div class="grow"><div class="wordmark-slot"></div></div>
        <button class="icon-btn" data-act="help" aria-label="How it works" title="How it works"><svg aria-hidden="true" focusable="false" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M6.3 6.2a1.8 1.8 0 1 1 2.6 1.6c-.6.3-.9.7-.9 1.3M8 11.4v.1"/></svg></button>
        <button class="icon-btn" data-act="settings" aria-label="Settings" title="Settings"><svg aria-hidden="true" focusable="false" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2.5 4.5h7M12.5 4.5h1M2.5 11.5h1M6.5 11.5h7"/><circle cx="11" cy="4.5" r="1.6"/><circle cx="5" cy="11.5" r="1.6"/></svg></button>
        <button class="icon-btn" data-act="toggle" aria-label="Tuck panel away" title="Tuck away (Esc)"><svg aria-hidden="true" focusable="false" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5 10.5 8 6 12.5"/></svg></button>
      </div>
      <div class="bar">
        <div class="nav" role="tablist" aria-label="Views">
          <button role="tab" data-view="home" aria-selected="false">Home<span class="cnt alert" hidden></span></button>
          <button role="tab" data-view="page" aria-selected="true">This page</button>
          <button role="tab" data-view="saved" aria-selected="false">Saved<span class="cnt"></span></button>
        </div>
        <div class="modebar" role="radiogroup" aria-label="Shopping as">
          <button role="radio" data-mode="buyer" title="Buyer: something to keep and use">Buyer<span class="sr">, to keep and use</span></button><button role="radio" data-mode="reseller" title="Reseller: something to sell on">Reseller<span class="sr">, to sell on</span></button>
        </div>
      </div>
      <div class="progress" hidden aria-hidden="true"><i></i></div>
      <div class="body">
      <div class="view view-page">
      <div class="controls">
        <div class="hint other-note">Nothing to look over here. Open a search, a category or a listing. Your saved listings and searches are under Saved.</div>
        <div class="welcome" hidden>
          <b>Welcome to Tirekick</b>
          <ul class="w-points">
            <li>Cards are marked for likely scams and odd prices as they load.</li>
            <li><b>Typical price</b> compares every listing with recent eBay sales, free. Point at a card for its own, and for <i>Save</i> and <i>Not interested</i>.</li>
            <li>With an AI (optional), <b>Scan</b> scores each listing and says why. <b>Buyer or Reseller</b>, top right, changes what scores high.</li>
          </ul>
          <div class="step-key" hidden><b class="setup-title"></b> <span class="setup-text"></span>
            <button class="ghost setup-go" data-act="open-settings">Open settings</button></div>
          <div class="hint w-note">Scores, prices and warnings are estimates to help you decide, not a guarantee: check the listing and the seller yourself.</div>
          <button class="ghost go" data-act="intro-done">Got it</button>
        </div>
        <div class="hint mode-hint"></div>
        <div class="inputs">
        <div class="want-field"><label for="want">What I want</label><input autocomplete="off" id="want" placeholder="e.g. working, with charger, under $150"></div>
        <div class="feewrap"><label for="fee">Selling fees (%)</label><input autocomplete="off" id="fee" inputmode="decimal" aria-describedby="fee-hint"><div class="hint" id="fee-hint">Taken off the typical price for the price gap; eBay's are about 13%.</div></div>
        <div class="q-sum"><span class="q-sum-text"></span> <button data-act="edit-q" title="Compare prices against other words">Change</button></div>
        <div class="qwrap"><label for="q">Compare prices against</label><input autocomplete="off" id="q" placeholder="e.g. Pentax K1000">
          <div class="hint browse-note" hidden>No search here (or only a category), so there's no one typical price for the page. Point at a listing and press <b>Typical price</b> for its own, from recent eBay sales. A scan goes by what you're into and what you want, and its prices are estimates (<i>est.</i>).</div></div>
        <button class="ghost inputs-done" data-act="inputs-done" hidden title="Fold these boxes away again (Esc)">Done</button>
        </div>
        <div class="inputs-sum" hidden><span class="sum-text"></span><button data-act="edit-inputs" title="Change what you want or what prices are compared against">Edit</button></div>
        <button class="scan" data-act="scan">Scan this page</button>
        <button class="scan" data-act="analyze" hidden>Analyze this listing</button>
        <label class="autoscan" hidden><input type="checkbox" class="auto-in" role="switch"><span>Scan new listings automatically</span></label>
        <div class="alts">
          <button class="ghost" data-act="ideas" hidden>Search ideas</button>
          <button class="ghost freeprices" data-act="prices" hidden title="The typical price from recent eBay sales, on its own: free, and your AI isn't used">Typical price <span class="cost">free</span></button>
        </div>
        <div class="market"></div>
        <div class="setup" hidden><b class="setup-title">Scores are optional.</b> <span class="setup-text">Prices, scam marks and filters work without an AI.</span>
          <button class="ghost" data-act="open-settings">Open settings</button></div>
        <div class="statusrow"><div class="status" role="status"></div><button class="stopbtn" hidden title="Stop the model: nothing new is sent, and requests under way are canceled">Stop</button></div>
        <div class="pageinfo" hidden><div class="pi-head" hidden></div><div class="pi-bar" role="img" hidden></div><span class="pi-line"></span><button class="pi-reset" data-act="reset" hidden title="Clear the scores on this page (the free marks stay)">Start over</button><div class="actions pi-search"></div></div>
        <div class="status err readwarn" role="status" hidden></div>
        <div class="ideas-inline" hidden><div class="status ideas-status" role="status"></div><div class="ideas-list"></div></div>
      </div>
      <div class="listbar" hidden>
        <button class="qt qf-toggle" aria-expanded="false" aria-controls="qf-box" title="Filter by words and price, hide listings you've seen, set your deal price">Filter</button>
        <div class="qf" id="qf-box" role="search" aria-label="Filter this search" hidden>
          <div class="qf-row">
            <span class="qf-wordwrap"><input autocomplete="off" class="qf-words" placeholder="Words: working -parts" aria-label="Words to keep or drop (-word drops)" title="Words a listing must have; -word drops listings with it; a/b = either; &quot;quotes&quot; for a phrase"><button class="qf-clear" hidden title="Clear the filter (your deal price stays)" aria-label="Clear the filter">\u00d7</button></span>
            <span class="qf-price"><input autocomplete="off" class="qf-min" inputmode="numeric" placeholder="$ min" aria-label="Lowest price, shipping included"><span aria-hidden="true">\u2013</span><input autocomplete="off" class="qf-max" inputmode="numeric" placeholder="max" aria-label="Highest price, shipping included"></span>
          </div>
          <div class="qf-row qf-toggles">
            <label class="qf-deal" title="Listings at or under it get a star, and a saved search tells you on Home">Your price \u2264 <input autocomplete="off" class="qf-dealin" inputmode="numeric" placeholder="$" aria-label="Your price for this search"></label>
          </div>
        </div>
        <div class="lb-quick" role="group" aria-label="Quick filters">
          <button class="qt" data-q="fresh" aria-pressed="false" title="Hide every listing you've seen before">New only</button>
          <button class="qt qt-broken" aria-pressed="false"></button>
          <button class="qt" data-q="junk" aria-pressed="false" title="Hide rentals, services, jobs, pets, “looking for” posts and $1 placeholder prices: things that aren't an item for sale">Hide off-topic</button>
        </div>
        <label class="sortpick">Sort <select class="sort">
          <option value="score">best first</option><option value="price">cheapest first</option><option value="value">furthest below typical price</option><option value="ending">auctions ending soonest</option><option value="margin">biggest price gap</option><option value="new">new or cheaper first</option>
        </select></label>
        <div class="skipwrap" title="Listings judged Skip or Likely scam, and other likely scams"><span id="skip-label">Skips and scams</span><div class="seg" role="radiogroup" aria-labelledby="skip-label"><button role="radio" data-skip="show">Show</button><button role="radio" data-skip="dim">Dim</button><button role="radio" data-skip="hide">Hide</button></div></div>
      </div>
      <div class="list"></div>
      <div class="itemout"></div>
      </div>
      <div class="view view-saved" hidden><div class="status saved-status" role="status"></div><div class="saved-body"></div></div>
      <div class="view view-home" hidden></div>
      </div>
      <div class="foot">
        <div class="spend-detail" hidden></div>
        <div class="foot-row">
          <label class="model-pick" title="Which model judges listings. Changes straight away."><span class="sr">Model</span><select class="model"></select></label>
          <button class="spend" aria-expanded="false" title="What Tirekick has spent on paid AI services"></button>
        </div>
        <div class="budget" hidden><i></i></div>
      </div>
    </div>
   </div>
  </div>`;

  const $ = (sel) => root.querySelector(sel);
  $(".wordmark-slot").replaceWith(THEME.wordmark(h));
  const wrap = $(".wrap");
  // Theme: Setup's Match (the default) follows the page's own colors (syncPageTheme); Dark and Light force one.
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
  const modeHint = $(".mode-hint");
  const qwrap = $(".qwrap");
  const browseNote = $(".browse-note");
  // Browse mode: a results page with nothing to compare against (e.g. the Marketplace home feed).
  const showBrowseNote = () => (browseNote.hidden = TK.pageType() !== "results" || (!!queryEl.value.trim() && !TKRules.broadQuery(queryEl.value)));
  queryEl.addEventListener("input", showBrowseNote);
  const itemEl = $(".itemout");
  const pageInfo = $(".pageinfo");
  const piLine = $(".pi-line");
  const piHead = $(".pi-head");
  const piBar = $(".pi-bar");
  const piSearch = $(".pi-search");
  const listBar = $(".listbar");
  const sortSel = $(".sort");
  const setupCard = $(".setup");
  const freeRow = $(".freeprices");

  // action: an optional { label, fn } shown after the text, e.g. Undo.
  // An error that says where the fix is gets a button that goes there.
  const fixFor = (text) =>
    text === STALE
      ? { label: "Reload the page", fn: () => location.reload() }
      : /\b(settings|extension options)\b/.test(text)
        ? { label: "Open settings", fn: () => send("openOptions", { section: "model" }).catch(() => {}) }
        : null;
  const setStatusNow = (text, isErr = false, action = null) => {
    if (isErr && !action) action = fixFor(text);
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
  let editingQ = false; // "Change" pressed: the compare box stays open on this page
  const inputsSum = $(".inputs-sum");
  const updateFold = () => {
    const type = TK.pageType();
    const done = type === "results" ? scored.size > 0 || !!lastMarket : type === "item" ? itemEl.childElementCount > 0 : false;
    const typingHere = root.activeElement && $(".inputs").contains(root.activeElement);
    const qNow = queryEl.value.trim();
    const qFold = (type === "results" || type === "item") && !!qNow && !editingQ && !(root.activeElement && qwrap.contains(root.activeElement));
    wrap.classList.toggle("q-folded", qFold);
    if (qFold && $(".q-sum").dataset.shown !== qNow) {
      $(".q-sum").dataset.shown = qNow;
      // A category's name gets no one typical price: the line says so, and how to price a listing instead.
      $(".q-sum-text").replaceChildren(...(TKRules.broadQuery(qNow)
        ? [h("b", {}, `\u201c${qNow}\u201d`), " is a whole category, too broad for one typical price. Point at a listing and press Typical price for its own."]
        : ["Typical price from recent eBay sales of ", h("b", {}, `\u201c${qNow}\u201d`)]));
    }
    // Opened with Change or Edit: a Done button folds the boxes away again.
    $(".inputs-done").hidden = !((editingQ && qNow) || (editingInputs && done));
    const fold = done && !editingInputs && !typingHere;
    wrap.classList.toggle("folded", fold);
    inputsSum.hidden = !fold;
    if (!fold) return;
    const q = queryEl.value.trim();
    const want = wantEl.value.trim();
    if (inputsSum.dataset.shown === `${q}\n${want}`) return; // runs every two seconds: only redraw a change
    inputsSum.dataset.shown = `${q}\n${want}`;
    $(".sum-text").replaceChildren(
      ...[q ? ["Comparing ", h("b", {}, `\u201c${q}\u201d`)] : "No price comparison", want ? [", wants ", h("b", {}, want)] : []].flat()
    );
    // Nothing in What I want: the button says what it's for, instead of the line saying what's missing
    $('[data-act="edit-inputs"]').textContent = want ? "Edit" : "Add what you want";
    $(".sum-text").title = `${q ? `Comparing prices with eBay sales of \u201c${q}\u201d` : "No price comparison"}; ${want ? `what you want: ${want}` : "nothing in What I want"}`;
  };
  $('[data-act="edit-q"]').addEventListener("click", () => {
    editingQ = true;
    updateFold();
    queryEl.focus();
    queryEl.select();
  });
  $('[data-act="edit-inputs"]').addEventListener("click", () => {
    editingInputs = true;
    updateFold();
    wantEl.focus();
  });
  const foldInputs = () => {
    editingQ = false;
    editingInputs = false;
    root.activeElement?.blur?.();
    updateFold();
  };
  $('[data-act="inputs-done"]').addEventListener("click", foldInputs);
  // Esc in the boxes folds them too (and doesn't close the panel), once there's something to fold to.
  $(".inputs").addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || $(".inputs-done").hidden) return;
    e.preventDefault();
    e.stopPropagation();
    foldInputs();
  });

  const setStatus = (...a) => setStatusNow(...a);
  // A write to this browser's storage that failed (it's full, or the browser refused). Every save used to
  // swallow this, so saving a listing could quietly do nothing. Say it once in a while, not on every write.
  let storeFailedAt = 0;
  const storeFailed = (e) => {
    if (!alive() || Date.now() - storeFailedAt < 10 * 60 * 1000) return;
    storeFailedAt = Date.now();
    console.warn("[Tirekick] storage write failed:", e?.message || e);
    setStatusNow(`Tirekick couldn't save to this browser's storage (${String(e?.message || e).slice(0, 120)}). What you just did may not be kept. Settings shows how much is in use and can clear old data.`, true, { label: "Open settings", fn: () => send("openOptions", { section: "backup" }).catch(() => {}) });
  };
  const storeFailedThrow = (e) => {
    storeFailed(e);
    throw e;
  };
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
    if (open && listStale) render();
    if (open && view === "home") setTimeout(() => home.wake().catch(() => {}), 0); // drawn if it changed out of sight; counts as seen once on screen
    $('[data-act="tab"]').setAttribute("aria-label", open ? "Tuck Tirekick away" : "Open Tirekick");
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
  // A click on the page itself (a listing, a menu, a filter) tucks the panel away, as a menu would. Clicks on
  // Tirekick's own tags and chips on the cards don't: they're part of it.
  document.addEventListener(
    "pointerdown",
    (e) => {
      if (!wrap.classList.contains("open") || e.button > 0) return;
      const path = e.composedPath();
      if (path.includes(host) || path.some((n) => n instanceof Element && n.matches?.(".tirekick-sticker, .tirekick-marks")) || (toastRoot && path.includes(toastRoot.host))) return;
      showOpen(false);
    },
    { capture: true, signal: life.signal }
  );

  // Tabs and Buyer/Reseller/Skipped-style radios: arrow keys (and Home/End) move and choose; only the
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

  // ---------- where the panel sits ----------
  // A few set places, so it looks the same everywhere: docked to the right or the left edge, in one of three
  // widths. Drag the header toward a side and let go (both sides show as you go) to dock there; drag the
  // panel's inner edge and it settles on the nearest width. With the header focused, left and right pick
  // the side and up and down the width. Double-click the header (or press Home) for the default. Each
  // site remembers its own.
  const SIZES = { s: 340, m: 380, l: 480 };
  const SIZE_ORDER = ["s", "m", "l"];
  const DEFAULT_BOX = { side: "right", size: "m" };
  const EDGE = 16; // a narrow window gets the panel at whatever width fits
  const vwNow = () => document.documentElement.clientWidth || innerWidth;
  const between = (n, lo, hi) => Math.min(Math.max(n, lo), Math.max(lo, hi));
  const nearestSize = (w) => SIZE_ORDER.reduce((best, k) => (Math.abs(SIZES[k] - w) < Math.abs(SIZES[best] - w) ? k : best), "m");
  let box = { ...DEFAULT_BOX };
  let liveWidth = 0; // while the edge is being dragged
  let noAnimTimer = 0;
  const applyBox = () => {
    // The drawer slides on width and side changes: not here (the tab would fly in from the edge on every load).
    wrap.classList.add("noanim");
    clearTimeout(noAnimTimer);
    noAnimTimer = setTimeout(() => wrap.classList.remove("noanim"), 60); // a timer, not frames: a background tab gets none
    wrap.dataset.side = box.side;
    host.style.right = box.side === "right" ? "0" : "auto";
    host.style.left = box.side === "left" ? "0" : "auto";
    wrap.style.setProperty("--w", `${Math.min(liveWidth || SIZES[box.size], vwNow() - 2 * EDGE)}px`);
  };
  // Slide the panel from where it was shown to where it now sits.
  const slideFrom = (from) => {
    const dx = from.left - panel.getBoundingClientRect().left;
    if (!dx || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    panel.style.transition = "none";
    panel.style.translate = `${dx}px 0`;
    void panel.offsetWidth;
    panel.style.transition = "translate .24s cubic-bezier(.2,.7,.2,1)";
    panel.style.translate = "";
    setTimeout(() => (panel.style.transition = ""), 300);
  };
  const boxSite = TK.currentSite();
  let boxTimer = 0;
  const saveBox = () => {
    clearTimeout(boxTimer);
    boxTimer = setTimeout(
      () => alive() && writeStored("panelBox", { set: { [boxSite]: box.side !== DEFAULT_BOX.side || box.size !== DEFAULT_BOX.size ? { ...box } : null } }).catch(() => {}),
      300
    );
  };
  const setBox = (next) => {
    const from = panel.getBoundingClientRect();
    box = { ...box, ...next };
    applyBox();
    if (wrap.classList.contains("open")) slideFrom(from);
    saveBox();
  };
  chrome.storage.local.get("panelBox").then((v) => {
    const b = v.panelBox?.[boxSite] || {};
    // A free width saved by 0.22 becomes the nearest of the three.
    box = { side: b.side === "left" ? "left" : "right", size: SIZES[b.size] ? b.size : b.w > 0 ? nearestSize(b.w) : "m" };
    applyBox();
  }).catch(() => {});
  applyBox();
  addEventListener("resize", applyBox);
  // One gesture at a time, followed even when the pointer leaves the window.
  const track = (e, kind, { move, done }) => {
    e.preventDefault();
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    wrap.classList.add("dragging", kind);
    const onMove = (m) => (m.buttons ? move(m) : end()); // no button held: the release happened where we couldn't see it
    const end = () => {
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", end);
      target.removeEventListener("pointercancel", end);
      target.removeEventListener("lostpointercapture", end);
      wrap.classList.remove("dragging", kind);
      done();
    };
    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", end);
    target.addEventListener("pointercancel", end);
    target.addEventListener("lostpointercapture", end);
  };
  const sideAt = (x) => (x < vwNow() / 2 ? "left" : "right");
  const zones = [...root.querySelectorAll(".zone")];
  const head = $(".head");
  head.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || e.target.closest("button")) return;
    const startX = e.clientX;
    let target = box.side;
    let moved = false;
    track(e, "moving", {
      move: (m) => {
        moved ||= Math.abs(m.clientX - startX) > 3;
        panel.style.transition = "none";
        panel.style.translate = `${m.clientX - startX}px 0`;
        target = sideAt(m.clientX);
        zones.forEach((z) => z.classList.toggle("on", z.dataset.side === target));
      },
      done: () => {
        zones.forEach((z) => z.classList.remove("on"));
        const from = panel.getBoundingClientRect(); // where it was let go
        panel.style.translate = "";
        panel.style.transition = "";
        if (!moved) return;
        box = { ...box, side: target };
        applyBox();
        slideFrom(from);
        saveBox();
      },
    });
  });
  head.addEventListener("dblclick", (e) => !e.target.closest("button") && setBox(DEFAULT_BOX));
  head.addEventListener("keydown", (e) => {
    if (e.target !== head) return; // the header's own buttons keep their keys
    const i = SIZE_ORDER.indexOf(box.size);
    const next = { ArrowLeft: { side: "left" }, ArrowRight: { side: "right" }, ArrowUp: { size: SIZE_ORDER[Math.min(i + 1, 2)] }, ArrowDown: { size: SIZE_ORDER[Math.max(i - 1, 0)] }, Home: DEFAULT_BOX }[e.key];
    if (!next) return;
    e.preventDefault();
    setBox(next);
  });
  root.querySelectorAll(".rz").forEach((el) =>
    el.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      const startX = e.clientX;
      const startW = panel.offsetWidth;
      const sign = box.side === "right" ? -1 : 1; // the inner edge: pulling it toward the page's middle widens the panel
      track(e, "resizing", {
        move: (m) => {
          liveWidth = between(startW + sign * (m.clientX - startX), 300, Math.min(560, vwNow() - 2 * EDGE));
          applyBox();
        },
        done: () => {
          const w = liveWidth || startW;
          liveWidth = 0;
          box = { ...box, size: nearestSize(w) };
          applyBox();
          saveBox();
        },
      });
    })
  );

  // ---------- footer: model switch and spending ----------
  // Spending is estimated from token counts at list prices (a regular API key can't read the real
  // balance). The background records it per day and model; the footer reads that record.
  const MODELS = [
    ["anthropic", "claude-opus-5-5", "Opus 5.5 \u00b7 best"],
    ["anthropic", "claude-sonnet-5-5", "Sonnet 5.5 \u00b7 \u00bd price"],
    ["anthropic", "claude-haiku-5-5", "Haiku 5.5 \u00b7 cheapest"],
  ];
  // Still works if you picked it earlier (or typed it in settings), just not offered any more.
  const OLDER = { "claude-haiku-4-5": "Haiku 4.5" };
  const modelSel = $(".model");
  const spendBtn = $(".spend");
  const spendDetail = $(".spend-detail");
  const budgetBar = $(".budget");
  let cfg = {};
  const nameOf = (id) => (MODELS.find(([, m]) => m === id)?.[2].split(" \u00b7")[0]) || OLDER[id] || id;

  // With Claude the footer offers how careful to be, not a model: each choice sets both the scan model (many
  // listings at once) and the one for a single listing, photos and search ideas. Settings has the two
  // separately; a pair that isn't one of these shows as "Custom".
  const QUALITY = [
    ["thrifty", "Thrifty", "claude-haiku-5-5", "claude-haiku-5-5"],
    ["balanced", "Balanced", "claude-haiku-5-5", "claude-sonnet-5-5"],
    ["thorough", "Thorough", "claude-sonnet-5-5", "claude-opus-5-5"],
  ];
  const short = (id) => nameOf(id).replace(/ 5\.5$/, "");
  const qualityNow = () => QUALITY.find(([, , sm, m]) => sm === cfg.scanModel && m === cfg.anthropicModel);
  const renderModels = () => {
    // Only the services you've set up are offered, side by side: no one service is pushed before you pick.
    const opts = [];
    if (cfg.hasKey) {
      opts.push(...QUALITY.map(([id, label, sm, m]) => ["anthropic", `q:${id}`, `Claude, ${label}`, `Scans with ${short(sm)}, single listings with ${short(m)}`]));
      if (cfg.anthropicModel && !qualityNow()) opts.push(["anthropic", "custom", "Claude, Custom", `Scans with ${short(cfg.scanModel || cfg.anthropicModel)}, single listings with ${short(cfg.anthropicModel)}`]);
    }
    if (cfg.oaiModel) opts.push(["openai", cfg.oaiModel, `${cfg.oaiName}, ${cfg.oaiModel.replace(/^[^/]+\//, "")}`]);
    opts.push(["ollama", cfg.textModel || "qwen3:4b", `Ollama, ${cfg.textModel || "qwen3:4b"} (free)`]);
    if (cfg.provider === "anthropic" && !cfg.hasKey) opts.unshift(["", "", "No AI service yet: add one in settings"]);
    modelSel.replaceChildren(...opts.map(([prov, m, label, more]) => h("option", { value: `${prov}|${m}`, title: more || label }, label)));
    $(".model-pick").title =
      cfg.provider === "anthropic"
        ? `How carefully listings are judged. Scans use ${nameOf(cfg.scanModel || cfg.anthropicModel)}; a single listing, photos and search ideas use ${nameOf(cfg.anthropicModel)}. Changes straight away; settings has each one.`
        : "Which model judges listings. Changes straight away.";
    const q = qualityNow();
    modelSel.value = cfg.provider === "ollama" ? `ollama|${cfg.textModel}` : cfg.provider === "openai" ? `openai|${cfg.oaiModel}` : cfg.hasKey ? `anthropic|${q ? `q:${q[0]}` : "custom"}` : "|";
  };
  const openSettings = (section) => send("openOptions", typeof section === "string" ? { section } : {}).catch(() => {});
  const openAISettings = () => openSettings("model");
  $('[data-act="settings"]').addEventListener("click", () => openSettings());
  root.querySelectorAll('[data-act="open-settings"]').forEach((b) => b.addEventListener("click", openAISettings));
  // What's missing before the model can run ([title, text]), or null. With the welcome open it is the
  // welcome's first step, so first run is one card; otherwise it is a card of its own.
  let modelMissing = null;
  const placeSetup = () => {
    const inWelcome = !!modelMissing && !$(".welcome").hidden;
    wrap.classList.toggle("no-model", !!modelMissing);
    setupCard.hidden = !modelMissing || inWelcome;
    $(".step-key").hidden = !inWelcome;
    // With no AI, the free typical price is the page's main button; Scan waits until there's an AI.
    freeRow.classList.toggle("scan", !!modelMissing);
    freeRow.classList.toggle("ghost", !modelMissing);
    if (!modelMissing) return;
    root.querySelectorAll(".setup-title").forEach((el) => (el.textContent = modelMissing[0]));
    root.querySelectorAll(".setup-text").forEach((el) => (el.textContent = modelMissing[1]));
  };
  const isOpenMenu = (n) => {
    try {
      return n instanceof HTMLSelectElement && n.matches(":open");
    } catch {
      return false; // a browser without :open has a native menu, which keeps its Esc to itself
    }
  };
  // Esc first closes a card's hover box (reasons, actions) that's open under the pointer or focus, and only
  // then tucks the panel away: a box that pops up on hover can be put away without moving the mouse.
  const shutBy = new WeakSet(); // Esc presses spent closing a hover box, which the panel then ignores
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || e.defaultPrevented) return;
    const open = [...document.querySelectorAll(".tirekick-sticker:is(:hover, :focus-within), [data-tirekick-key]:hover .tirekick-marks, .tirekick-marks:focus-within")].filter((n) => !n.classList.contains("tk-shut") && n.querySelector(".tk-pop, .tk-why"));
    if (!open.length) return;
    for (const n of open) {
      n.classList.add("tk-shut"); // back on the next visit: when the pointer leaves the card, or focus leaves the tag
      const back = new AbortController();
      const shown = () => (n.classList.remove("tk-shut"), back.abort());
      (n.closest("[data-tirekick-key]") || n).addEventListener("pointerleave", shown, { signal: back.signal });
      n.addEventListener("focusout", (ev) => n.contains(ev.relatedTarget) || shown(), { signal: back.signal });
    }
    shutBy.add(e);
    e.preventDefault();
  }, { ...until, capture: true });
  // From the page too: Esc anywhere tucks it away, except while typing in the site's own boxes.
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || e.defaultPrevented || !wrap.classList.contains("open")) return;
    if (e.composedPath().includes(host)) return; // inside the panel: the handler below decides
    if (e.target.closest?.("input, textarea, select, [contenteditable]:not([contenteditable='false'])")) return;
    setOpen(false);
  }, until);
  root.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !wrap.classList.contains("open") || shutBy.has(e)) return;
    if (e.composedPath().some(isOpenMenu)) return; // Esc closes the Sort or model menu, not the panel
    if (!spendDetail.hidden) {
      showSpend(false);
      spendBtn.focus();
    } else setOpen(false);
  });

  modelSel.addEventListener("change", async () => {
    const [provider, model] = modelSel.value.split("|");
    if (!provider) return openAISettings();
    const q = QUALITY.find(([id]) => model === `q:${id}`);
    await chrome.storage.local.set(provider === "anthropic" ? (q ? { provider, anthropicScanModel: q[2], anthropicModel: q[3] } : { provider }) : { provider });
    setStatus(
      provider === "ollama"
        ? `Using ${model} on Ollama (free, on your computer).`
        : provider === "openai"
          ? `Using ${model} on ${cfg.oaiName} from now on.`
          : cfg.hasKey
            ? q
              ? `${q[1]}: scans with ${nameOf(q[2])}, single listings with ${nameOf(q[3])}. Scores already made stay until you scan again.`
              : "Using the models picked in settings."
            : "Add a Claude API key in the extension's settings to use Claude.",
      provider === "anthropic" && !cfg.hasKey
    );
  });

  const usd = (n) => (n > 0 && n < 0.01 ? "<$0.01" : `$${n.toFixed(2)}`);
  const perCall = (n) => (n < 0.01 ? "under $0.01 each" : `about $${n.toFixed(2)} each`);
  let lastUsage = null;
  let paidAI = false;
  // Always pass the record explicitly: after a reset it's undefined, and that must show $0.00.
  const renderSpend = (usage) => {
    lastUsage = usage;
    const s = TKShared.usageSummary(usage);
    const budget = +cfg.monthlyBudget || 0;
    const share = budget ? s.month / budget : 0;
    const level = share >= 1 ? "over" : share >= 0.8 ? "warn" : "";
    // Spending is a footnote: shown once a paid service is set up (or something was spent), never pushed.
    spendBtn.hidden = !(paidAI || s.month > 0);
    $(".foot").hidden = spendBtn.hidden && $(".model-pick").hidden;
    spendBtn.className = `spend ${level}`;
    // Kept to a few quiet characters (Myer: the tracker is mostly for the owner); the details are in the tooltip and popover.
    spendBtn.replaceChildren("AI: ", usd(s.month));
    spendBtn.title = budget ? `Spent on AI this month: ${usd(s.month)} of your $${budget} budget` : `Spent on AI this month: ${usd(s.month)}`;
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
            models.map(([m, v]) => h("div", {}, h("span", {}, nameOf(m)), h("span", {}, `${usd(v.usd)} \u00b7 ${v.calls} call${v.calls === 1 ? "" : "s"} \u00b7 ${perCall(v.usd / v.calls)}`))),
            rest >= 0.005 ? h("div", {}, h("span", {}, "Not split by model"), h("span", {}, usd(rest))) : null
          )
        : h("div", { class: "hint" }, "Nothing spent on paid AI this month."),
      // One line here; how it is counted, the budget and the reset are in settings.
      h(
        "div",
        { class: "hint sd-note" },
        budget ? `${Math.round(share * 100)}% of your $${budget} budget. ` : "Estimates, no budget set. ",
        h("button", { onclick: () => openSettings("spending") }, "Budget and how it's counted")
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
  // Clicks on the page itself count too: they never reach the panel's root.
  const offSpend = (e) => {
    if (!spendDetail.hidden && !e.composedPath().some((n) => n === spendDetail || n === spendBtn)) showSpend(false);
  };
  root.addEventListener("click", offSpend);
  document.addEventListener("pointerdown", offSpend, { capture: true, signal: life.signal });
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
        ? ["Scores are optional.", "Prices, scam marks and filters work without one. To score listings too, add any AI service you have a key for, or a free model on your own computer, in settings."]
        : cfg.provider === "openai" && (!cfg.oaiModel || (!cfg.hasOaiKey && !keyless))
          ? [`Finish setting up ${cfg.oaiName || "your AI service"}.`, `It needs ${!cfg.hasOaiKey && !keyless ? "an API key and " : ""}a model. Test connection in settings lists the models.`]
          : null;
    modelMissing = missing;
    paidAI = !missing && cfg.provider !== "ollama" && !keyless;
    $(".model-pick").hidden = !!missing; // nothing to pick until an AI is set up: the setup card says how
    placeSetup();
    renderSpend((await chrome.storage.local.get("usage")).usage);
  };
  loadFooter();
  chrome.storage.onChanged.addListener((changes) => {
    if (!alive()) return;
    if (changes.usage) renderSpend(changes.usage.newValue);
    if (["provider", "anthropicModel", "anthropicScanModel", "textModel", "anthropicKey", "oaiModel", "oaiKey", "oaiUrl", "oaiPriceIn", "oaiPriceOut", "monthlyBudget", "rankRate", "batchSize", "autoScan"].some((k) => changes[k])) loadFooter().then(refreshPending);
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
    if (alive()) chrome.storage.local.set({ introDone: true }).catch(storeFailed);
  });
  $('[data-act="help"]').addEventListener("click", () => {
    if (TK.pageType() === "other") return setStatus("Open an eBay or Marketplace search to try it. Your saved listings and searches are under Saved, and what changed is on Home.");
    showIntro(welcome.hidden);
    if (!welcome.hidden) welcome.scrollIntoView({ block: "nearest" });
  });
  let introPending = false;
  let introOpened = false;
  // Called on every page change: the card only appears where there is something to try it on.
  const applyIntro = () => {
    if (!introPending || TK.pageType() === "other") return;
    showIntro(true);
    if (!touched && !introOpened) showOpen(true);
    introOpened = true;
  };
  chrome.storage.local.get("introDone").then(({ introDone }) => {
    introPending = !introDone && alive();
    applyIntro();
  }).catch(() => {});

  // ---------- mode: Buyer or Reseller ----------
  // Two ways of shopping, each with its own tools and its own remembered sort, skipped-listings setting
  // and "What I want". Under the hood they are the two judgments the model has always made: "use" (a
  // working item for yourself) and "project" (fix up and flip), which the rest of this file calls the lens.
  const MODES = {
    use: {
      id: "buyer",
      name: "Buyer mode",
      as: "a buyer",
      hint: "Find a good one to keep: fair prices, honest sellers, no scams. Broken and untested ones score low.",
      want: "e.g. working, with charger, under $150",
      sort: "score",
    },
    project: {
      id: "reseller",
      name: "Reseller mode",
      as: "a reseller",
      hint: "Find ones worth fixing and selling: an easy fix, or a price gap after fees and parts. Broken and untested ones are welcome.",
      want: "e.g. common fault, parts easy to find, sells fast",
      sort: "margin",
    },
  };
  const LENS_OF = { buyer: "use", reseller: "project" };
  let lens = "use";
  let onLensShown = () => {}; // the filter bar's broken-listing toggle follows the mode (set up further down)
  let onModeChanged = () => {}; // Home redraws for the mode (set up further down)
  let modePrefs = { use: {}, project: {} }; // per mode: { sort, skip }
  // "What I want" belongs to a search: what you want from a camera isn't what you want from a console.
  // Each search keeps its own, per mode; a listing opened from a search in the same tab gets that search's.
  // (Your general taste is "What you're into" in settings.)
  let searchWants = {};
  const WANTS_MAX = 300;
  const wantKey = () => {
    const q = TK.pageType() === "results" ? pageSearch().toLowerCase() : "";
    return q ? `${lens}|${TK.currentSite()}|${q}` : null;
  };
  const tabWant = (v) => {
    try {
      if (v === undefined) return sessionStorage.getItem(`tirekick-want-${lens}`) || "";
      sessionStorage.setItem(`tirekick-want-${lens}`, v);
    } catch {
      return "";
    }
  };
  const applyWant = () => {
    const k = wantKey();
    const w = k ? searchWants[k] || "" : TK.pageType() === "item" ? tabWant() : "";
    if (k) tabWant(w);
    if (root.activeElement !== wantEl) wantEl.value = w;
  };
  const setWant = (v) => {
    const k = wantKey();
    tabWant(v);
    if (!k) return;
    if (v) searchWants[k] = v;
    else delete searchWants[k];
    const keys = Object.keys(searchWants);
    const old = keys.length > WANTS_MAX ? keys.slice(0, keys.length - WANTS_MAX) : [];
    old.forEach((x) => delete searchWants[x]);
    if (alive()) writeStored("searchWants", { set: { ...Object.fromEntries(old.map((x) => [x, null])), [k]: v || null } }).catch(() => {});
  };
  const feeEl = $("#fee");
  const showMode = () => {
    const m = MODES[lens];
    root.querySelectorAll("button[data-mode]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.mode === m.id)));
    wrap.dataset.workspace = m.id;
    modeHint.textContent = m.hint;
    wantEl.placeholder = m.want;
    for (const o of sortSel.options) o.hidden = o.disabled = o.value === "margin" && lens === "use"; // margins are the Reseller's
    onLensShown();
  };
  // This mode's own sort, skipped-listings setting and wants (the page's cards follow through render()).
  const applyPrefs = () => {
    const p = modePrefs[lens] || {};
    sortMode = SORTS[p.sort] && !(p.sort === "margin" && lens === "use") ? p.sort : MODES[lens].sort;
    sortSel.value = sortMode;
    skipMode = ["show", "dim", "hide"].includes(p.skip) ? p.skip : "dim"; // grayed out unless you choose otherwise
    document.documentElement.dataset.tkSkip = wrap.dataset.skipmode = skipMode;
    root.querySelectorAll("[data-skip]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.skip === skipMode)));
    applyWant();
  };
  const setPref = (key, value) => {
    (modePrefs[lens] ||= {})[key] = value;
    if (alive()) writeStored("modePrefs", { upsert: { [lens]: { [key]: value } } }).catch(() => {});
  };
  // What each mode is for: the first line of This page while you're new to it (your first few scans), and
  // again right after you switch, until the next scan. After that it's known, and the space goes to results.
  let scansSoFar = 0;
  let justSwitched = false;
  const showModeHint = () => wrap.classList.toggle("knows-modes", scansSoFar >= 3 && !justSwitched);
  chrome.storage.local.get("stats").then(({ stats }) => ((scansSoFar = stats?.scans || 0), showModeHint())).catch(() => {});
  const setMode = (id) => {
    const next = LENS_OF[id];
    if (!next || next === lens) return;
    lens = next;
    justSwitched = true;
    showModeHint();
    if (alive()) chrome.storage.local.set({ lens }).catch(storeFailed);
    applyPrefs();
    showMode();
    onModeChanged();
    // Scores mean something different in the other mode, so start the page over.
    const had = scored.size || itemEl.childElementCount;
    clearStickers();
    listEl.replaceChildren();
    itemEl.replaceChildren();
    redecorateAll(); // the non-AI marks (and listings you hid) stay
    setCount(0);
    render();
    if (had)
      setStatus(
        TK.pageType() === "item"
          ? `${MODES[lens].name}. Press Analyze to judge this listing as ${MODES[lens].as}.`
          : `${MODES[lens].name}. Scan again to judge these listings as ${MODES[lens].as} (anything already judged this way comes back free).`
      );
    else setStatus(""); // switching back before scanning: the other mode's line no longer applies
    refreshPending();
  };
  root.querySelectorAll("button[data-mode]").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));
  wantEl.addEventListener("change", () => setWant(wantEl.value.trim()));
  // The scan button says when your edits mean a rescan (refreshPending is defined further down).
  for (const el of [wantEl, queryEl, feeEl]) el.addEventListener("input", () => refreshPending());
  // Selling fees: one number for the margins; it's the same setting as on the settings page.
  const showFee = () => send("getSettings").then((s) => root.activeElement !== feeEl && (feeEl.value = String(s.feePct))).catch(() => {});
  feeEl.addEventListener("change", () => {
    const n = TKShared.clampSetting("feePct", Number(feeEl.value));
    feeEl.value = String(n);
    if (alive()) chrome.storage.local.set({ feePct: n }).catch(storeFailed);
    refreshPending();
  });
  showFee();
  const modeReady = chrome.storage.local.get({ lens: "use", modePrefs: null, sortMode: "score", skipMode: "dim", searchWants: {} }).then((v) => {
    lens = v.lens === "fix" || v.lens === "flip" ? "project" : MODES[v.lens] ? v.lens : "use"; // older Fix and Flip are one mode now
    modePrefs = v.modePrefs || { use: {}, project: {} };
    searchWants = v.searchWants || {};
    // From before there were modes: the one sort and skipped setting go to the mode that was in use.
    // (Wants from then, and from when they were per mode, aren't carried over: they applied to every search.)
    if (!v.modePrefs) modePrefs[lens] = { sort: v.sortMode, skip: v.skipMode };
    applyPrefs();
    showMode();
  });

  const money = (n) => `${n < 0 ? "\u2212" : ""}$${Math.abs(Math.round(n))}`;
  const fmtCost = (usd) => (usd < 0.01 ? "under $0.01" : `~$${usd.toFixed(2)}`);
  const DIFFICULTY = ["Repair: difficulty unclear", "Easy fix", "Fairly easy fix", "Moderate fix", "Hard fix", "Very hard fix"];

  // The one-line lens summary for a scored listing: what the sticker and list show under the verdict.
  const lensLine = (it) => {
    if (it.related === false) return it.browse ? "Not your thing" : "Not your search";
    // The number that matters first, so a narrow sticker doesn't cut it off.
    if (it.auction) return [it.bidCap > 0 ? `Bid \u2264 ${dollars(it.bidCap)}` : "Auction", it.timeLeft && `${it.timeLeft} left`].filter(Boolean).join(", ");
    if (it.lot && it.total != null) return `Lot of ${it.lot}, ${dollars(Math.round((it.total / it.lot) * 100) / 100)} each`;
    // Fix & flip: how hard the fix is (when there is one) and what it should make; whichever is known.
    if (it.lens === "project") {
      const margin = it.margin != null ? `\u2248 ${money(it.margin)} gap after fees${it.refIsEstimate || it.refRough ? " (est.)" : ""}` : "";
      const broken = it.fault && !/^none$/i.test(it.fault);
      if (broken && it.difficulty > 0) return [DIFFICULTY[it.difficulty], margin || (it.partsCost > 0 && `~$${it.partsCost} parts`)].filter(Boolean).join(", ");
      if (margin) return margin;
      if (broken && it.partsCost > 0) return `~$${it.partsCost} parts`;
    }
    if (it.vsWorking == null) return "";
    return TKRules.vsText(it.total, it.refPrice ?? it.refWorking, { rough: it.refRough, est: it.refIsEstimate, working: !!facts.get(keyOf(it.url))?.project });
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
  // whatever the site's own colors are.
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
    if (document.documentElement.dataset.tkTheme !== t) document.documentElement.dataset.tkTheme = t;
    if (wrap.dataset.pageTheme !== t) wrap.dataset.pageTheme = t; // the closed tab takes the page's colors, like the marks on the cards
  };
  syncPageTheme();
  let stylesIn = false;
  const ensureStickerStyles = () => {
    // Checked once per batch of cards: cheap after the first time (the theme is kept current by the tick).
    if (stylesIn && document.getElementById("tirekick-styles")) return;
    stylesIn = true;
    syncPageTheme();
    if (document.getElementById("tirekick-styles")) return;
    const st = document.createElement("style");
    st.id = "tirekick-styles";
    // The marks wear the page's own brightness (see syncPageTheme): dark tokens on a dark page, light on a light one.
    // Same palette as the panel (lib/theme.js), as --tk-* so a page's own variables can't collide.
    const TAG_TOKENS = ["paper", "ink", "muted", "rule", "line", "accent", "on-accent", "good-bg", "good-fg", "warn-bg", "warn-fg", "new-bg", "new-fg",
      "v-great", "v-good", "v-fair", "v-pass", "v-suspicious", "on-v", "dot-great", "dot-good", "dot-fair", "dot-pass", "dot-suspicious"];
    const TAG_KEEP = /^(v-|on-v$)/; // the verdict text colors keep their names; the dot fills become --tk-dot-*
    const DK = `${THEME.vars("dark", { prefix: "--tk-", keep: TAG_KEEP, pick: TAG_TOKENS })} --tk-shadow:0 1px 2px rgba(0,0,0,.3), 0 6px 16px -6px rgba(0,0,0,.6);`;
    const LT = `${THEME.vars("light", { prefix: "--tk-", keep: TAG_KEEP, pick: TAG_TOKENS })} --tk-shadow:0 1px 2px rgba(10,20,40,.16), 0 6px 16px -6px rgba(10,20,40,.42);`;
    const UI = THEME.UI.replace(/\s*,\s*/g, ",");
    const DISPLAY = THEME.DISPLAY.replace(/\s*,\s*/g, ",");
    st.textContent = `
      html[data-tk-theme="dark"] :is(.tirekick-sticker, .tirekick-marks) { ${DK} }
      html:not([data-tk-theme="dark"]) :is(.tirekick-sticker, .tirekick-marks) { ${LT} }
      .tirekick-sticker { --c:var(--v-fair);
        position:absolute; top:10px; left:10px; z-index:50; display:flex; align-items:center; gap:9px; padding:4px 12px 4px 4px; max-width:var(--tk-fit, calc(100% - 20px));
        background:var(--tk-paper); color:var(--tk-ink); border-radius:999px; box-shadow:var(--tk-shadow);
        font:400 13px/1.2 ${UI}; text-align:left; letter-spacing:normal; cursor:help;
        } /* no fade-in: tags appear as cards load, and animating hundreds of them on a long feed cost frames */
      /* the page's own rules for its boxes (a card's "a div { padding }") stay off ours */
      .tirekick-sticker div { padding:0; margin:0; }
      .tirekick-sticker[data-v="great"] { --c:var(--v-great); } .tirekick-sticker[data-v="good"] { --c:var(--v-good); }
      .tirekick-sticker[data-v="pass"] { --c:var(--v-pass); } .tirekick-sticker[data-v="suspicious"] { --c:var(--v-suspicious); }
      /* color is a cue: the pill takes a tint and an edge of its verdict's color, so a page of tags reads at a glance */
      .tirekick-sticker:not(.tk-compact) { background:color-mix(in srgb, var(--c) 15%, var(--tk-paper)); box-shadow:inset 0 0 0 1.5px color-mix(in srgb, var(--c) 60%, transparent), var(--tk-shadow); }
      /* the score: a tread dot, filled in the verdict's color, its tread lit as far as the score (as in the panel) */
      ${THEME.dotCss(".tk-score", { paper: "var(--tk-paper)", muted: "var(--tk-muted)" }).replace(/var\(--dot-/g, "var(--tk-dot-")}
      .tirekick-sticker .tk-score { flex:none; width:38px; height:38px; box-sizing:border-box; display:grid; place-content:center; text-align:center; line-height:1; }
      .tirekick-sticker .tk-score b { display:block; font:800 16px/1 ${DISPLAY}; letter-spacing:-.02em; font-variant-numeric:lining-nums tabular-nums; }
      .tirekick-sticker .tk-score i { display:none; }
      .tirekick-sticker .tk-text { display:flex; flex-direction:column; gap:2px; min-width:0; }
      .tirekick-sticker .tk-verdict { color:var(--c); font:700 14px/1.15 ${UI}; } /* a long one ("Great price, if it's real") wraps */
      ${THEME.glyphCss(".tk-verdict")}
      .tirekick-sticker.tk-compact .tk-verdict { display:none; }
      /* The verdict is written beside the score, so the box needn't say it again and can cover less of the photo.
         On a narrow card the dot stands alone on the photo (the verdict is in its label and on hover). */
      .tirekick-sticker.tk-compact { padding:0; background:none; box-shadow:none; }
      .tirekick-sticker.tk-compact .tk-score { width:44px; height:44px; filter:drop-shadow(0 1px 1px rgba(0,0,0,.3)) drop-shadow(0 4px 8px rgba(0,0,0,.3)); }
      .tirekick-sticker.tk-compact .tk-score b { font-size:17px; }
      /* ...and its one line about the listing ("$53 below typical") becomes the first chip under it, in full */
      .tirekick-sticker.tk-compact .tk-text { display:none; }
      .tirekick-sticker:not(.tk-compact) .tk-subchip { display:none; }
      .tirekick-sticker .tk-sub { font-size:13px; color:var(--tk-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      /* small chips: under a sticker, or on their own on a card that hasn't been scored */
      .tirekick-sticker .tk-below { position:absolute; left:4px; top:100%; padding-top:5px; display:flex; flex-direction:column; align-items:flex-start; gap:6px; }
      /* Marketplace: top-right, and never into the top-left corner where Facebook puts "Just listed" */
      .tirekick-sticker.tk-right, .tirekick-marks.tk-right { left:auto; right:10px; max-width:max(120px, calc(100% - 110px)); }
      .tirekick-marks.tk-right { justify-content:flex-end; }
      .tirekick-sticker.tk-right .tk-below { left:auto; right:4px; align-items:flex-end; }
      .tirekick-sticker.tk-right .tk-under { justify-content:flex-end; }
      .tirekick-sticker .tk-under { display:flex; flex-wrap:wrap; gap:4px; width:max-content; max-width:var(--tk-fit, 320px); }
      .tk-chip { display:inline-flex; align-items:center; gap:3px; padding:2px 9px; border-radius:999px; background:var(--tk-paper); color:var(--tk-ink);
        font:600 13px/1.35 ${UI}; white-space:nowrap; letter-spacing:normal; text-transform:none; box-shadow:0 2px 6px -2px rgba(0,0,0,.35); }
      .tk-chip svg { width:11px; height:11px; }
      .tk-chip b { font-weight:700; } .tk-chip .tk-rest { font-weight:500; }
      .tirekick-marks .tk-chip, .tk-under .tk-chip { max-width:100%; white-space:normal; } /* a long tag wraps inside the card */
      .tirekick-marks .tk-chip:has(> b), .tk-under .tk-chip:has(> b) { display:inline-block; } /* "Good price" stays together; the rest wraps after it */
      .tk-chip > b { white-space:nowrap; }
      .tk-chip.k-new, .tk-chip.k-deal { background:var(--tk-new-bg); color:var(--tk-new-fg); } .tk-chip.k-good { background:var(--tk-good-bg); color:var(--tk-good-fg); }
      .tk-chip.k-warn { background:var(--tk-warn-bg); color:var(--tk-warn-fg); }
      .tk-chip.k-plain { box-shadow:inset 0 0 0 1px var(--tk-line), 0 2px 6px -2px rgba(0,0,0,.3); }
      .tirekick-marks { position:absolute; top:10px; left:10px; z-index:50; display:flex; flex-wrap:wrap; gap:4px; max-width:var(--tk-fit, calc(100% - 20px));
        filter:drop-shadow(0 2px 6px rgba(0,0,0,.35)); pointer-events:auto; }
      .tirekick-marks button, .tirekick-sticker .tk-under button { cursor:pointer; border:0; }
      .tk-acts { display:contents; }
      .tirekick-marks .tk-why { display:none; flex:0 0 auto; width:min(248px, calc(var(--tk-popw, 260px) - 12px)); max-width:none; /* wider than the chips above it, never wider than the card */ box-sizing:border-box; padding:10px 12px; border-radius:12px; background:var(--tk-paper); color:var(--tk-ink);
        box-shadow:0 0 0 1px var(--tk-line); font:400 13px/1.5 ${UI}; white-space:normal; text-transform:none; }
      .tirekick-marks .tk-why p { margin:0; } .tirekick-marks .tk-why p + p { margin-top:6px; }
      [data-tirekick-key]:hover .tirekick-marks .tk-why, .tirekick-marks:focus-within .tk-why { display:block; }
      /* Hover-only actions stay in the DOM (clipped, not display:none) so the keyboard can reach them; they show on hover or focus. */
      .tk-x { position:absolute !important; width:1px !important; height:1px !important; margin:-1px !important; padding:0 !important; overflow:hidden !important; clip-path:inset(50%) !important; }
      [data-tirekick-key]:hover .tk-x, .tirekick-marks:focus-within .tk-x, .tirekick-sticker:focus-within .tk-x, .tk-x:focus-visible
        { position:static !important; width:auto !important; height:auto !important; margin:0 !important; padding:2px 7px !important; overflow:visible !important; clip-path:none !important; }
      /* listings you've hidden, filtered out, or (by choice) skipped */
      html:not([data-tk-showhidden]) [data-tk-hide] { display:none !important; }
      html[data-tk-showhidden] [data-tk-hide] { opacity:.45; }
      /* Dim fades the card but not its tag or chips: a scam warning stays the most legible thing on it.
         The parts to fade are marked once per card (fadeParts): no :has() here, which on a page that changes
         as constantly as Facebook's made the browser re-check every card on every change and froze it. */
      html[data-tk-skip="dim"] [data-tk-faded] { opacity:.38; filter:grayscale(1); transition:opacity .2s, filter .2s; }
      html[data-tk-skip="dim"] [data-tk-v]:hover [data-tk-faded] { opacity:1; filter:none; }
      html[data-tk-skip="hide"] :is([data-tk-v="pass"], [data-tk-v="suspicious"]) { display:none !important; }
      /* Facebook's later grid cells paint over earlier ones: lift the card whose tag you're hovering (set by fit()) */
      [data-tk-lift] { position:relative; z-index:2147483000 !important; }
      /* Each card's marks stay inside its own layer, so the page's floating boxes (Facebook's Messenger
         pop-ups, menus) are drawn over them instead of under them. The lift above still raises a card you point at. */
      [data-tk-cell] { isolation:isolate; }
      /* the links at the foot of the hover card; the chips toolbar (also .tk-acts) under the tag keeps its chip look */
      .tirekick-sticker .tk-pop .tk-acts { display:flex; flex-wrap:wrap; gap:6px 12px; margin-top:8px; padding-top:8px; border-top:1px solid var(--tk-rule); }
      .tirekick-sticker .tk-pop .tk-acts :is(button, a) { all:unset; cursor:pointer; color:var(--tk-ink); font-weight:600; font-size:13px;
        text-decoration:underline; text-decoration-color:var(--tk-rule); text-underline-offset:3px; }
      .tirekick-sticker .tk-pop .tk-acts :is(button, a):hover { text-decoration-color:currentColor; }
      .tirekick-sticker .tk-pop .tk-acts :is(button, a):focus-visible { outline:2px solid currentColor; outline-offset:2px; border-radius:2px; }
      /* The card with the reasons is no wider than the listing's own card, and keepInView nudges it back when the
         page would clip it (Marketplace cuts off anything past the edge of its grid). */
      .tirekick-sticker .tk-pop { display:none; width:264px; max-width:min(var(--tk-popw, 264px), 80vw); box-sizing:border-box; padding:12px 14px; transform:translateX(var(--tk-nudge, 0px));
        background:var(--tk-paper); color:var(--tk-ink); border-radius:12px; box-shadow:0 0 0 1px var(--tk-line), var(--tk-shadow);
        font:400 13px/1.5 ${UI}; white-space:normal; text-transform:none; cursor:auto; }
      .tirekick-sticker:hover .tk-pop, .tirekick-sticker:focus-within .tk-pop { display:block; }
      .tirekick-sticker.tk-shut .tk-pop, .tirekick-marks.tk-shut .tk-why { display:none !important; }
      .tirekick-sticker:focus-visible { outline:2px solid var(--tk-ink); outline-offset:3px; }
      .tirekick-sticker .tk-pop b { display:block; margin-bottom:4px; font:800 17px/1.25 ${DISPLAY}; letter-spacing:-.01em; }
      .tirekick-sticker .tk-pop b .tk-pw { color:var(--c); font:700 15px/1.25 ${UI}; letter-spacing:normal; }
      ${THEME.glyphCss(".tk-pw")}
      .tirekick-sticker .tk-flags { margin-top:6px; color:var(--tk-muted); }
      /* The card you picked in the panel: a ring drawn inside its edge (so neighbors and clipped grids can't hide it),
         held for a few seconds, then fading. Its cell is lifted above the rest while it shows. */
      .tirekick-flash { outline:3px solid ${THEME.ORANGE} !important; outline-offset:-3px !important; border-radius:12px;
        box-shadow:0 0 0 4px color-mix(in srgb, ${THEME.ORANGE} 30%, transparent), 0 10px 30px -10px rgba(0,0,0,.5) !important; animation:tk-flash 3.5s ease-out both; }
      @keyframes tk-flash { 0%, 70% { outline-color:${THEME.ORANGE}; } 100% { outline-color:transparent; box-shadow:none; } }`;
    document.head.append(st);
  };

  // Facebook recycles card elements as you scroll, which drops our stickers. Remember each
  // listing by its URL and put the decoration back when its card reappears.
  let scored = new Map(); // key -> scored item
  let seen = new Set(); // keys already sent for scoring (or being scored), so a re-scan only does what's new
  const keyOf = TK.keyOf;
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
  let prefs = { filterWords: "", minSellerRatings: 10, minSellerPct: 97, autoMarks: true };
  let skipMode = "dim";
  let showHidden = false;
  let facts = new Map(); // key -> facts for this page view
  let codeStems = {}; // Facebook title without its trailing code -> { c: { code: listing key }, a: last seen }
  let photoSeen = {}; // listing key -> { h: photo hash, f: photo file name, t: title, a: last seen } (photoTwins sites)
  let saved = {}; // key -> { t: title, u: url, img, p0: price when saved, a0: when, p: last price seen, a: last seen }
  let savedSearches = {}; // "site|query" -> { site, q, url, a0: when saved, v: last visit, n: listings then, fresh: new to you then }
  const dirtyMemory = new Set();
  const dirtyStems = new Set();
  const memoryReady = chrome.storage.local.get(["listingMemory", "notInterested", "codeStems", "saved", "savedSearches", "photoSeen"]).then((v) => {
    memory = v.listingMemory || {};
    codeStems = v.codeStems || {};
    photoSeen = v.photoSeen || {};
    saved = v.saved || {};
    savedSearches = v.savedSearches || {};
    notInterested = v.notInterested || {};
  });
  const loadPrefs = () =>
    send("getSettings")
      .then((s) => {
        prefs = { filterWords: s.filterWords, minSellerRatings: +s.minSellerRatings || 0, minSellerPct: +s.minSellerPct || 0, autoMarks: s.autoMarks !== false };
      })
      .catch(() => {});
  const prefsReady = loadPrefs();

  // Several tabs may write at once. Each tab keeps the memory in RAM and folds in what other tabs wrote
  // from the change events (they carry the whole record anyway), so a save is one write: no read first,
  // and pruning old entries only when it has grown past its cap. Saves wait for a quiet moment, and go
  // straight out when you leave the page (clicking through to a listing would otherwise lose them).
  // Reading, sorting and writing the whole memory on every pass made long feeds stutter.
  let memoryTimer = 0;
  const saveMemoryNow = () => {
    clearTimeout(memoryTimer);
    if (!dirtyMemory.size || !alive()) return;
    dirtyMemory.clear();
    if (Object.keys(memory).length > MEMORY_MAX * 1.1) {
      const cutoff = Date.now() - MEMORY_DAYS * 864e5;
      // A saved listing's price history is kept whatever its age: it's what the Saved view and the offer use.
      const keep = Object.entries(memory).filter(([k, r]) => r && saved[k]);
      const rest = Object.entries(memory).filter(([k, r]) => r && !saved[k] && r.a > cutoff).sort((a, b) => a[1].a - b[1].a).slice(-Math.max(0, MEMORY_MAX - keep.length));
      memory = Object.fromEntries([...rest, ...keep]);
    }
    chrome.storage.local.set({ listingMemory: memory }).catch(storeFailed);
  };
  const saveMemorySoon = () => {
    clearTimeout(memoryTimer);
    memoryTimer = setTimeout(() => (window.requestIdleCallback ? requestIdleCallback(saveMemoryNow, { timeout: 2000 }) : saveMemoryNow()), 1500);
  };
  window.addEventListener("pagehide", saveMemoryNow, until);
  document.addEventListener("visibilitychange", () => document.hidden && saveMemoryNow(), until);
  chrome.storage.onChanged.addListener((changes) => {
    if (!changes.listingMemory || !alive()) return;
    const next = changes.listingMemory.newValue;
    if (!next) return void ((memory = {}), dirtyMemory.clear()); // "Forget seen listings" in settings: don't write it back
    // Another tab's sightings: keep whichever record of a listing was seen last.
    for (const [k, r] of Object.entries(next)) if (r && (!memory[k] || (r.a || 0) > (memory[k].a || 0)) && !dirtyMemory.has(k)) memory[k] = r;
  });

  // Scam campaigns: one fake listing posted over and over, each copy with its own code on the end of
  // the title ("... Advance SP M2465", "... Advance SP K7731"). Two codes on one title, here or on any
  // page in the last month, and every copy is certainly fake; no model needed.
  const STEM_DAYS = 30;
  let stemTimer = 0;
  const noteCode = (key, title, code) => {
    const stem = TK.titleStem(title, code);
    if (stem.split(" ").length < 4) return ""; // short titles ("Nikon camera") collide by chance
    const rec = (codeStems[stem] ||= { c: {}, a: 0 });
    if (rec.c[code] === key) return stem; // nothing new: no write
    rec.c[code] = key;
    rec.a = Date.now();
    dirtyStems.add(stem);
    clearTimeout(stemTimer);
    stemTimer = setTimeout(async () => {
      if (!dirtyStems.size || !alive()) return;
      const upsert = Object.fromEntries([...dirtyStems].map((k) => [k, codeStems[k]]));
      dirtyStems.clear();
      // Merged with what other tabs noted under the same title (codes from both are kept).
      codeStems = await writeStored("codeStems", { upsert, cap: { max: 3000, by: "a", maxAge: STEM_DAYS * 864e5 } }).catch(() => codeStems);
    }, 300); // soon: a reload right after would lose it, and this is rare
    return stem;
  };
  // The other codes this title has been posted under (by other listings), if any.
  const otherCodes = (key, stem, code) => TKRules.otherCodes(codeStems[stem], key, code);

  // The same photo on other listings, on sites where that means something (TKSites photoTwins: Marketplace).
  // Each photo you scroll past gets a fingerprint (photoHashes in background.js, a few at a time, only cards
  // on screen); the same picture under another title, here or on any page in the last 90 days, is marked on
  // both: a stolen photo, or a stock one. No model, and nothing leaves this computer.
  const PHOTO_DAYS = 90;
  const photoWanted = new Map(); // key -> photo address, waiting for its fingerprint
  const photoAsked = new Set(); // keys fingerprinted, or on their way, on this page
  const photoOf = new WeakMap(); // card element -> [key, photo address], for the observer
  const photoEls = new Map(); // key -> the card element watched for it, until its photo is fingerprinted
  let photoTimer = 0;
  const photoSite = () => !!TK.site()?.photoTwins;
  // Each listing is checked against the few photos that could be near it (TKShared.photoIndex), not all of them:
  // comparing every listing on a long feed with every photo kept took most of a second for each batch.
  const markPhotoTwins = () => {
    const index = TKShared.photoIndex(photoSeen, TKRules.PHOTO_NEAR);
    const twinsOf = (key) => TKRules.photoTwins(key, Object.fromEntries([...index.near(photoSeen[key].h), key].map((k) => [k, photoSeen[k]])));
    const changed = [];
    for (const [key, f] of facts) {
      const n = photoSeen[key]?.h ? twinsOf(key).length : 0;
      if ((f.photoTwins || 0) !== n) {
        f.photoTwins = n;
        const el = passEls.get(key);
        changed.push([key, el?.isConnected ? el : elFor(key)]); // the card from the last page pass, if it's still there: a page lookup per card showed on long feeds
      }
    }
    if (changed.length) {
      decorateAll(changed);
      render();
    }
  };
  // Fingerprints for a few photos, kept with the listing; resolves to the keys that got one.
  const hashPhotos = async (pairs) => {
    let hashes = {};
    try {
      ({ hashes } = await send("photoHashes", { urls: pairs.map(([, u]) => u) }));
    } catch {
      return [];
    }
    const now = Date.now();
    const got = [];
    for (const [k, u, title] of pairs) if (hashes?.[u]) got.push(k), (photoUnsaved[k] = photoSeen[k] = { h: hashes[u], f: TKRules.photoFile(u), t: normTitle(title || ""), a: now });
    if (got.length) savePhotosSoon();
    return got;
  };
  // New fingerprints count on this page at once and are saved within ten seconds, several batches in one write:
  // the record holds up to 20,000 photos, and writing all of it (and every open tab being sent the change) for
  // each batch of six was most of what scrolling a long feed wrote to storage.
  let photoUnsaved = {};
  let photoSaveTimer = 0;
  const savePhotosNow = async () => {
    clearTimeout(photoSaveTimer);
    photoSaveTimer = 0;
    const upsert = photoUnsaved;
    if (!Object.keys(upsert).length || !alive()) return;
    photoUnsaved = {};
    // What other tabs saved comes back merged in; fingerprints made while this was being written are kept too.
    const next = await writeStored("photoSeen", { upsert, cap: { max: 20000, by: "a", maxAge: PHOTO_DAYS * 864e5 } }).catch(() => null);
    if (next) photoSeen = Object.assign(next, photoUnsaved);
  };
  const savePhotosSoon = () => (photoSaveTimer ||= setTimeout(savePhotosNow, 10000));
  window.addEventListener("pagehide", savePhotosNow, until);
  document.addEventListener("visibilitychange", () => document.hidden && savePhotosNow(), until);
  const pumpPhotos = () => {
    if (photoTimer || !photoWanted.size || !alive()) return;
    photoTimer = setTimeout(async () => {
      const batch = [...photoWanted].slice(0, 6).map(([k, u]) => [k, u, facts.get(k)?.title]);
      for (const [k] of batch) {
        photoWanted.delete(k);
        if (photoEls.has(k)) photoObserver.unobserve(photoEls.get(k));
        photoEls.delete(k);
      }
      if (await hashPhotos(batch).then((ks) => ks.length)) markPhotoTwins();
      photoTimer = 0;
      pumpPhotos();
    }, 600);
  };
  // Only photos still on screen are fingerprinted: scrolling fast past a long feed would otherwise queue every
  // card passed, and the tab kept fetching photos for a minute after you stopped. One that scrolled away
  // before its turn waits until it's back.
  const photoObserver = "IntersectionObserver" in window
    ? new IntersectionObserver((entries) => {
        for (const e of entries) {
          const [key, url] = photoOf.get(e.target) || [];
          if (!key) continue;
          if (!e.isIntersecting) photoWanted.delete(key);
          else if (facts.get(key)?.imageUrl === url) photoWanted.set(key, url);
        }
        pumpPhotos();
      }, { rootMargin: "200px" })
    : null;
  // Called on each page pass: photos already fingerprinted (the same file) count at once, the rest wait to be seen.
  const watchPhotos = (items) => {
    if (!photoObserver || !photoSite()) return;
    let known = false;
    for (const it of items) {
      const key = keyOf(it.url);
      if (photoAsked.has(key) || !it.imageUrl || !it.el || TK.isPlaceholder(it.imageUrl) || !TKShared.isListingImage(it.imageUrl)) continue;
      photoAsked.add(key);
      const rec = photoSeen[key];
      if (rec?.h && rec.f === TKRules.photoFile(it.imageUrl)) {
        known = true;
        continue;
      }
      photoOf.set(it.el, [key, it.imageUrl]);
      photoEls.set(key, it.el);
      photoObserver.observe(it.el);
    }
    if (known) markPhotoTwins();
  };

  // Records a sighting; returns { isNew, drop } relative to what was remembered before.
  const remember = (key, price, pageHadKnown, auction = false) => {
    const { out, rec } = TKRules.sighting(memory[key], price, { pageHadKnown, auction });
    memory[key] = rec;
    dirtyMemory.add(key);
    saveMemorySoon();
    return out;
  };


  // Why a listing is filtered out ("" if it isn't): the words in your settings (matched against the title),
  // then this search's filter bar.
  const filterReason = (f) => TKRules.termsReason(f.title || "", prefs.filterWords) || quickReason(f);

  // ---------- the filter bar: per search, remembered, no AI ----------
  // Words work like an eBay search: "dmg -case -game" needs dmg and drops anything with case or game;
  // "a/b" is either; quotes keep a phrase together. They match the title and the card's text, so
  // "-china" catches "from China" on eBay. Prices include shipping when the card shows it.
  // deal: your own price for this search. Not a filter: cards at or under it are marked, and the tab
  // on the page edge counts them even with the panel closed.
  // broken: "hide" drops listings that say broken/untested/for parts (Use), "only" keeps just those (Fix).
  const NO_QUICK = { words: "", min: 0, max: 0, fresh: false, broken: "", junk: false, deal: 0 };
  let quick = { ...NO_QUICK };
  let quickReady = Promise.resolve(); // this search's saved filter, loaded on each page change
  const quickReason = (f) => TKRules.quickReason(f, quick);
  const quickActive = () => !!(quick.words.trim() || quick.min || quick.max || quick.fresh || quick.broken || quick.junk);
  const isDeal = (f) => TKRules.isDeal(f, quick.deal);
  const dealCount = () => [...facts.values()].filter((f) => f.deal && !f.hidden && !f.filtered).length;

  const sellerWarning = (f) => TKRules.sellerWarning(f, prefs);
  const CARD_FACTS = ["auction", "bids", "timeLeft", "hoursLeft", "bestOffer", "lot", "sellerPct", "sellerCount", "sellerJoined", "titleCode", "offSite", "justListed", "wasPrice", "foreign", "priceRange", "condition"];
  const lensSearchUrl = (img) => `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(TK.bigImage(img))}`;


  // The typical price has moved 10% or more since the listing was scored.
  const movedSince = (it) => {
    const now = it.refPrice ?? it.refWorking;
    return it.scoredRef > 0 && now > 0 && !it.refIsEstimate && Math.abs(now - it.scoredRef) >= it.scoredRef * 0.1;
  };
  const foreignText = (cur) => `Priced in ${cur}, and the typical price is from eBay.com sales in US dollars, so the two aren't compared (no "too cheap" check or price word either).`;
  // The chips a card wears: most useful first, three at most.
  const chipsFor = (f = {}) => {
    const c = [];
    if (showHidden && f.hidden) c.push(["warn", "Not interested"]);
    else if (showHidden && f.filtered) c.push(["warn", `Filtered: ${f.filtered}`]);
    if (f.deal) c.push(["deal", `At your $${quick.deal}`]);
    if (f.campaign) c.push(["warn", "Scam: reposted", `Posted again with other codes (${f.campaign.join(", ")}): one fake listing copied many times. Don't message or pay.`]);
    else if (f.offSite?.sure) c.push(["warn", "Scam: off-site contact", `Asks to talk off the site (${f.offSite.why.join("; ")}). That's how most scams start, and off the site you lose its buyer protection.`]);
    else if (f.titleCode && !f.codeOk) c.push(["warn", `Code in title: ${f.titleCode}`, `Bulk-posted fakes on Marketplace end the title with a code like ${f.titleCode}, and so do real model numbers: check it's this item's model number.${TKRules.codeBacked(f) ? ` With ${TKRules.codeBacked(f)} as well, it's likely a scam.` : ""}`]);
    if (f.offSite && !f.offSite.sure && !f.offSiteOk) c.push(["warn", "Contact outside the site?", `Contact details in the listing (${f.offSite.why.join("; ")}). Keep the talk and the payment on the site.`]);
    if (f.photoTwins) c.push(["warn", `Same photo as ${f.photoTwins} other listing${f.photoTwins > 1 ? "s" : ""}`, photoTwinsText(f.photoTwins)]);
    // Far under what the same thing sold for: the usual bait. Said in place of the plain "$53 under sold".
    const mk = marketOf(f);
    const from = (m) => `the middle of ${m.n} recent eBay sales${m.query ? ` of \u201c${m.query}\u201d` : ""}${m.pickupShip ? `, less ${dollars(Math.round(m.pickupShip))} typical shipping (this one is pickup)` : ""}`;
    const unrelated = f.url && scored.get(keyOf(f.url))?.related === false; // a scan said it's something else
    const cheap = f.vsSold != null && !unrelated && TKRules.tooCheap(f, mk);
    // What to do about it differs by site: on eBay its guarantee covers you if you pay through eBay; a pickup
    // sale has none, so see it working before any money changes hands.
    const safely = mk?.local ? " Meet in a public place, see it working, and pay only then: never ahead, and never by gift card or a payment app's friends option." : " Pay only through eBay, which covers a listing that isn't as described; never by a link or contact sent outside it.";
    // What the scan or Analyze read about why it's cheap (priceVerdict uses it), and what would lift the mark.
    const read = f.url && scored.get(keyOf(f.url))?.cheapWhy;
    const lifts = cheap?.seller || (f.titleCode && !f.codeOk) ? "" : cheap?.level === "far" ? " Analyze can lift this to Fair price if the listing says something is missing or it's a cheaper version." : " A scan that reads a reason in the listing (a flaw, missing parts, a cheaper version) lifts this, no higher than Good price.";
    if (cheap) c.push(["warn", `${cheap.level === "far" ? "Likely scam?" : "Too cheap?"} Typical is ${dollars(Math.round(mk.median))}`, `This is ${cheap.pct}% of the typical price (${from(mk)}): far below what the same thing sells for is the usual bait.${cheap.why ? ` The listing says “${cheap.why}”, which may be why: check the photos show it.` : ""}${cheap.seller ? ` It's from ${cheap.seller} too: the two together are how most scams look.` : ""}${read && read !== "none" ? ` The scan's reading: ${read}.` : ""}${lifts}${safely}`]);
    // Cheap, and the listing says why (or an established eBay seller): no warning, and no "Great price" either.
    const said = f.vsSold != null && !cheap && !unrelated && TKRules.cheapForReason(f, mk);
    if (said) c.push(["plain", `Under typical: ${said.why || "established seller"}`, `This is ${said.pct}% of the typical price (${from(mk)}), ${said.why ? `and the listing says why: “${said.why}”. Check the photos show it, and ask about anything else.` : `from a seller with ${f.sellerCount} ratings, ${f.sellerPct}% positive. Read the description for anything missing or wrong.`}${safely}`]);
    if (f.drop && f.price != null) c.push(["good", `↓ ${dollars(Math.round((f.drop.from - f.price) * 100) / 100)} since ${shortDate(f.drop.since)}`]);
    else if (f.wasPrice && f.price != null) c.push(["good", `\u2193 was ${dollars(f.wasPrice)}`]);
    if (f.vsSold != null && !cheap && !said) {
      // Broken ones, likely scams and what a scan called something else: just the number, no "Great price".
      const pw = f.project || unrelated || likelyScam(f) ? null : TKRules.priceWord(f.vsSold);
      c.push([pw?.rank >= 3 ? "good" : "plain", `${pw && pw.v !== "pass" ? `${pw.word} \u00b7 ` : ""}${TKRules.vsText(f.total, mk.median, { rough: mk.confidence === "rough", working: !!f.project })}`, `Typical price${f.project ? " of a working one" : ""}: about ${dollars(Math.round(mk.median))}, ${from(mk)}.`]);
    } else if (TKRules.placeholderPrice(f.price ?? f.total)) c.push(["plain", "Placeholder price?", `${dollars(f.price ?? f.total)} looks like a stand-in, not the real price, so it isn't compared with the typical price. Ask the seller.`]);
    else if (mk?.median > 0 && TKRules.tooFarToCompare(f.price ?? f.total, mk.median)) c.push(["plain", "No price check", `Too far from the typical price (about ${dollars(Math.round(mk.median))}) to compare: it's likely a different item from the rest of this search.`]);
    else if (f.accessory && mk?.median > 0) c.push(["plain", "No price check", `Looks like a game, accessory or part for it (\u201c${f.accessory}\u201d), not the ${marketFor ? `\u201c${marketFor}\u201d` : "thing"} itself, so it isn't compared with that typical price. Typical price prices it from its own title.`]);
    else if (f.foreign && mk?.median > 0) c.push(["plain", "No price check", foreignText(f.foreign)]);
    else if (f.priceNote) c.push(["plain", "No price check", f.priceNote]);
    if (f.isNew) c.push(["new", "New to you"]);
    // Fixers want "untested" and "no power"; for anyone else it's a warning.
    if (f.project) c.push([lens === "use" ? "plain" : "good", f.project]);
    if (f.motivated) c.push(["plain", f.motivated]);
    if (f.sellerWarn) c.push(["warn", f.sellerWarn, `${f.sellerWarn} (your rule: at least ${prefs.minSellerRatings} ratings, ${prefs.minSellerPct}% positive). New and little-rated accounts are where most scams come from.`]);
    if (f.dup) c.push(["warn", `Same title ×${f.dup}`, `${f.dup} listings on this page share this title or photo: a repost, or one seller with several.`]);
    // An auction in its last few hours, especially with no bids, is when bargains happen.
    if (f.auction && f.hoursLeft != null && f.hoursLeft <= 3) c.push(["new", `Ends in ${f.timeLeft}${f.bids === 0 ? ", no bids" : ""}`]);
    else if (f.auction) c.push(["plain", `Auction${f.timeLeft ? `, ${f.timeLeft} left` : ""}`]);
    if (f.lot) c.push(["plain", `Lot of ${f.lot}`]);
    if (f.bestOffer) c.push(["plain", "Offers"]);
    return c.slice(0, 3);
  };
  // A chip's lead word ("Good price") is set in bold, so it needs no "·" to part it from the number.
  const chipText = (t) => (t.includes(" \u00b7 ") ? [h("b", {}, t.slice(0, t.indexOf(" \u00b7 "))), h("span", { class: "tk-rest" }, ` ${t.slice(t.indexOf(" \u00b7 ") + 3)}`)] : t);
  const chipEls = (f) => chipsFor(f).map(([kind, text, why]) => h("span", { class: `tk-chip k-${kind}`, title: why || null }, chipText(text)));

  // Our own buttons sit inside the site's card (on Facebook, inside the link): keep the click ours.
  const own = (fn) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    fn(e);
  };

  // Where the sticker goes. eBay cards are fine as they are. A Facebook card is a link that may be
  // inline or zero-height, so climb to the nearest real box that still holds only this one listing.
  const cardsHere = () => TK.site()?.cards || {}; // how this site's cards behave (lib/sites.js)
  const stickerHost = (el) => {
    if (!cardsHere().nested) return el;
    let node = el;
    for (let i = 0; i < 6 && node; i++) {
      const r = node.getBoundingClientRect();
      if (getComputedStyle(node).display !== "inline" && r.width >= 100 && r.height >= 100) return node;
      const up = node.parentElement;
      if (!up || hasOtherListing(up, itemIdOf(el))) break;
      node = up;
    }
    return el;
  };
  // What gets hidden or dimmed: the whole grid cell, so Facebook doesn't leave blank holes.
  // Facebook nests a card's link a dozen or more boxes deep, and a card can link to its listing more than
  // once, so climb until the parent holds a different listing (stopping short of that left empty grid slots).
  const itemIdOf = (a) => a.href.match(/\/marketplace\/item\/(\d+)/)?.[1] || a.href;
  // Does this box hold a link to some other listing? One query that stops at the first one (listing every
  // link at every level, for every card, grew with the square of the page and showed on long feeds).
  const hasOtherListing = (box, id) =>
    /^\d+$/.test(id)
      ? !!box.querySelector(`${ITEM_LINK}:not([href*="/item/${id}/"]):not([href$="/item/${id}"]):not([href*="/item/${id}?"])`)
      : [...box.querySelectorAll(ITEM_LINK)].some((a) => itemIdOf(a) !== id);
  const cellOf = (el) => {
    if (!cardsHere().nested) return el;
    const id = itemIdOf(el.closest(ITEM_LINK) || el.querySelector(ITEM_LINK) || el);
    let node = el;
    for (let i = 0; i < 40; i++) {
      const up = node.parentElement;
      if (!up || up === document.body || hasOtherListing(up, id)) break;
      node = up;
    }
    return node;
  };

  const undecorate = (host) => {
    if (host.dataset.tirekickPos) host.style.position = "";
    for (const a of ["data-tirekick", "data-tirekick-key", "data-tirekick-pos", "data-tk-hide", "data-tk-v", "data-tk-cell", "data-tk-sig", "data-tk-has"]) host.removeAttribute(a);
    host.querySelectorAll(":scope > .tirekick-sticker, :scope > .tirekick-marks").forEach((n) => n.remove());
    const cell = host.closest("[data-tk-hide], [data-tk-v], [data-tk-cell]");
    for (const a of ["data-tk-hide", "data-tk-v", "data-tk-cell", "data-tk-lift"]) cell?.removeAttribute(a);
    cell?.querySelectorAll("[data-tk-faded]").forEach((n) => n.removeAttribute("data-tk-faded"));
  };

  // Dress one card: a sticker if it's been scored, otherwise just its chips; hidden if you said so.
  // Redrawing a card's marks replaces their elements; if the keyboard was on one of them (pressing Save
  // turns it into "Saved"), put focus back on the same place in the new marks instead of losing it.
  const decorate = (key, linkEl, m) => {
    if (!linkEl?.isConnected) return;
    m ||= measure(linkEl);
    const marks = m.cell.querySelector(".tirekick-sticker, .tirekick-marks");
    const at = marks && marks.contains(document.activeElement) ? [...marks.querySelectorAll("button")].indexOf(document.activeElement) : null;
    redecorate(key, linkEl, m);
    if (at == null) return;
    const now = m.cell.querySelector(".tirekick-sticker, .tirekick-marks");
    (now?.querySelectorAll("button")[at] || now)?.focus({ preventScroll: true });
  };
  // Everything a card's dressing needs to read from the page, read in one go. Reading a size right after
  // writing the last card's tag makes the browser lay out the whole page again, so a batch of cards is
  // measured first and dressed after (decorateAll).
  const measure = (linkEl) => {
    const host = stickerHost(linkEl);
    const img = cardsHere().fitToPhoto ? host.querySelector("img") : null;
    return { host, cell: cellOf(linkEl), isStatic: getComputedStyle(host).position === "static", imgW: img ? img.getBoundingClientRect().width : 0, hostW: host.getBoundingClientRect().width };
  };
  // What a card's dressing depends on, as a string: when it hasn't changed, the card is left as it is.
  const sigOf = (key) => JSON.stringify([facts.get(key) || {}, scored.get(key), !!saved[key], showHidden, prefs.autoMarks, lens], (k, v) => (k === "el" ? undefined : v));
  const isDressed = (key, el, base) => {
    const tagged = el.closest("[data-tirekick-key]");
    return !!tagged && tagged.dataset.tirekickKey === key && !!tagged.dataset.tkSig?.startsWith(base) && (tagged.dataset.tkHas !== "1" || !!tagged.querySelector(":scope > .tirekick-sticker, :scope > .tirekick-marks"));
  };
  const decorateAll = (pairs) => {
    ensureStickerStyles();
    // Cards already dressed for what they show are skipped before anything is measured: the page pass
    // runs whenever more listings load, and measuring hundreds of unchanged cards each time showed.
    const live = [];
    for (const [key, el] of pairs) {
      if (!el?.isConnected) continue;
      const base = sigOf(key);
      if (!isDressed(key, el, base)) live.push([key, el, base]);
    }
    const ms = live.map(([, el]) => measure(el));
    live.forEach(([key, el, base], i) => decorate(key, el, { ...ms[i], base }));
  };
  const redecorate = (key, linkEl, m = measure(linkEl)) => {
    if (!linkEl?.isConnected) return;
    ensureStickerStyles();
    const { host, cell } = m;
    const f = facts.get(key) || {};
    const it = scored.get(key);
    // Nothing it shows has changed (the page pass runs whenever more listings load): leave the card alone.
    // Rebuilding every tag on every pass made long feeds lag.
    const sig = `${m.base ?? sigOf(key)}|${m.hostW < 250}|${Math.round(m.imgW)}`;
    if (host.dataset.tkSig === sig && host.dataset.tirekickKey === key && cell.hasAttribute("data-tk-cell") && (host.dataset.tkHas !== "1" || host.querySelector(":scope > .tirekick-sticker, :scope > .tirekick-marks"))) return;
    host.dataset.tkSig = sig;
    host.dataset.tkHas = ""; // set when a tag or chips go on below
    host.setAttribute("data-tirekick-key", key);
    cell.setAttribute("data-tk-cell", "");
    if (m.isStatic && !host.dataset.tirekickPos) {
      host.style.position = "relative";
      host.setAttribute("data-tirekick-pos", "1");
    }
    if (f.hidden || f.filtered) cell.setAttribute("data-tk-hide", f.hidden ? "not-interested" : "filter");
    else cell.removeAttribute("data-tk-hide");
    // A price warning ("Great price, if it's real") is its own value: Skipped's Hide leaves it on the page,
    // as the list does (skipV), so the page and the panel never disagree about what's hidden.
    const sv = it && shownV(it, f);
    if (it || likelyScam(f)) cell.setAttribute("data-tk-v", it ? (sv.priceWarn ? "pricewarn" : sv.v) : "suspicious");
    else cell.removeAttribute("data-tk-v");
    // Clear the whole cell, not just this host: on Facebook the host can be a different box than
    // last time (layout settles after load), and old marks left on the other one made two layers.
    cell.querySelectorAll(".tirekick-sticker, .tirekick-marks").forEach((n) => n.remove());
    cell.querySelectorAll("[data-tirekick-key]").forEach((n) => n !== host && n.removeAttribute("data-tirekick-key"));
    // On eBay the card holds photo and text side by side (list view) or stacked (grid); either way the
    // tag and chips stay on the photo instead of running over the title.
    // On Marketplace, Facebook puts its own labels ("Just listed") at the photo's top-left, so ours
    // go top-right.
    const fit = (node) => {
      const w = m.imgW;
      const cards = cardsHere();
      if (w > 80 && w < m.hostW - 40) {
        node.style.setProperty("--tk-fit", `${Math.round(w - 20)}px`);
        if (w - 20 < 150) node.classList.add("tk-compact"); // a small photo: the score alone fits, the rest is on hover
      }
      // Photos that fill the card (Marketplace, and most eBay grids): the chips wrap at the card's width instead of running past its edge.
      else if ((!cards.fitToPhoto || w > 80) && m.hostW > 80) node.style.setProperty("--tk-fit", `${Math.round((w > 80 ? Math.min(w, m.hostW) : m.hostW) - 20)}px`);
      if (cards.corner === "right") node.classList.add("tk-right");
      // On a narrow card the long verdict ("Great deal") would be cut off; the tag's own word says it already.
      if (cards.compactUnder && m.hostW < cards.compactUnder) node.classList.add("tk-compact");
      if (m.hostW > 0) node.style.setProperty("--tk-popw", `${Math.max(220, Math.round(m.hostW - 8))}px`);
      node.addEventListener("pointerenter", () => keepInView(node));
      node.addEventListener("focusin", () => keepInView(node));
      // Lift the card whose tag you're pointing at (or tabbing through) above its neighbors, so its card of
      // reasons isn't drawn under the next card's tag or photo, on every site.
      node.addEventListener("pointerenter", () => cell.setAttribute("data-tk-lift", ""));
      node.addEventListener("pointerleave", () => cell.removeAttribute("data-tk-lift"));
      node.addEventListener("focusin", () => cell.setAttribute("data-tk-lift", ""));
      node.addEventListener("focusout", () => cell.removeAttribute("data-tk-lift"));
      return node;
    };
    fadeParts(cell, host, it ? skipV(shownV(it, f)) : likelyScam(f));
    if (it) {
      it.el = linkEl;
      host.setAttribute("data-tirekick", shownV(it, f).v);
      host.append(fit(stickerEl(it, f, key)));
      host.dataset.tkHas = "1";
      return;
    }
    host.removeAttribute("data-tirekick");
    if (!prefs.autoMarks && !(showHidden && (f.hidden || f.filtered))) return;
    const chips = chipEls(f);
    if (showHidden && f.hidden) chips.push(h("button", { class: "tk-chip k-plain", onclick: own(() => setInterested(key, true)) }, "Undo"));
    else if (!f.hidden) chips.push(...hoverChips(key, f)); // Save / Sold / Not interested appear when you hover the card
    // The warnings' reasons, on hover or focus: a "Likely scam?" says why without a scan.
    const whys = chipsFor(f).filter(([kind, , why]) => kind === "warn" && why).map(([, , why]) => why);
    host.append(fit(h("div", { class: `tirekick-marks` }, chips, whys.length ? h("div", { class: "tk-why" }, whys.map((w) => h("p", {}, w))) : null)));
    host.dataset.tkHas = "1";
  };
  const stick = (item) => decorate(keyOf(item.url), item.el);
  // Slide the hover card sideways when a box around the card (or the window) would cut part of it off.
  const keepInView = (node) => {
    const pop = node.querySelector(".tk-pop");
    if (!pop) return;
    node.style.removeProperty("--tk-nudge");
    pop.style.removeProperty("max-width");
    requestAnimationFrame(() => {
      if (!pop.getBoundingClientRect().width) return;
      let lo = 0, hi = document.documentElement.clientWidth;
      for (let n = node.parentElement; n && n !== document.body; n = n.parentElement) {
        if (getComputedStyle(n).overflowX === "visible") continue;
        const b = n.getBoundingClientRect();
        lo = Math.max(lo, b.left);
        hi = Math.min(hi, b.right);
      }
      // A box that clips narrower than the card (a narrow Marketplace cell): the card narrows to fit inside it
      if (pop.getBoundingClientRect().width > hi - lo - 12) pop.style.setProperty("max-width", `${Math.max(140, Math.floor(hi - lo - 12))}px`);
      const r = pop.getBoundingClientRect();
      const nudge = r.left < lo + 6 ? lo + 6 - r.left : r.right > hi - 6 ? hi - 6 - r.right : 0;
      if (nudge) node.style.setProperty("--tk-nudge", `${Math.round(nudge)}px`);
    });
  };
  // What fades when a card is dimmed: everything in it except our tag and chips. From the box that holds
  // the tag up to the grid cell, each level's other children fade, and so does everything in that box
  // but the tag, so nothing fades twice.
  const fadeParts = (cell, host, dim) => {
    cell.querySelectorAll("[data-tk-faded]").forEach((n) => n.removeAttribute("data-tk-faded"));
    if (!dim) return;
    for (const kid of host.children) if (!kid.matches(".tirekick-sticker, .tirekick-marks")) kid.setAttribute("data-tk-faded", "");
    for (let n = host; n !== cell && n.parentElement; n = n.parentElement) for (const sib of n.parentElement.children) if (sib !== n) sib.setAttribute("data-tk-faded", "");
  };
  // "✕ Not interested", shown on any card while you hover it.
  const hideChip = (key) => h("button", { class: "tk-chip k-plain tk-x", title: "Hide this listing everywhere (undo it under Saved)", onclick: own(() => setInterested(key, false)) }, "Not interested");
  // eBay's sold listings for this title, in a new tab: price research by hand, nothing automated.
  const soldLink = (title) => TK.soldUrl(TK.titleToQuery(title), TK.SOLD_CONDITION.used);
  // A listing can be priced on its own when it has none yet, and it's one thing (not a lot, not a bid).
  const canPrice = (f) => cfg.useSoldComps !== false && f.vsSold == null && !f.priceNote && !f.foreign && !f.priceRange && !f.lot && !f.auction && !f.project && f.total != null && !!TK.titleToQuery(f.title || "");
  // One listing's typical price, from its own title: the answer when the page has no search, or its words
  // are a whole category. One eBay lookup, paced and cached like the page's.
  const priceOne = async (key, btn) => {
    const f = facts.get(key);
    if (!f) return;
    let query = TK.titleToQuery(f.title);
    if (btn) (btn.disabled = true), (btn.textContent = "Checking\u2026");
    try {
      let m = await soldMarket(query, "used");
      // A whole title often matches too few sales word for word ("… with 3 games and case"): one more try
      // with its first four words, which is where the make and model are. Only on too few sales, never
      // after a refusal, so it's at most one extra lookup, paced like the rest.
      const words = query.split(" ");
      if (!(m?.median > 0) && words.length > 4) {
        query = words.slice(0, 4).join(" ");
        m = await soldMarket(query, "used");
      }
      if (m?.median > 0) f.ownMarket = { median: m.median, p25: m.p25, p75: m.p75, n: m.n, confidence: m.confidence, query };
      else f.priceNote = `Not enough recent eBay sales of \u201c${query}\u201d to compare.`;
    } catch (e) {
      f.priceNote = e.message;
    }
    f.vsSold = vsSoldOf(f);
    setStatus(f.ownMarket ? `\u201c${(f.title || "").slice(0, 50)}\u201d: typical price $${f.ownMarket.median}, from ${f.ownMarket.n} eBay sales of \u201c${query}\u201d. Free: your AI wasn't used.` : f.priceNote, !f.ownMarket);
    redecorateAll();
  };
  // "$55", not "$55–$55", when the two ends meet.
  const offerRange = (r) => (r.offerLow >= r.offerHigh ? `$${r.offerHigh}` : `$${r.offerLow}\u2013$${r.offerHigh}`);
  // What every card offers on hover. A saved listing keeps its star showing. They make one toolbar with a
  // single Tab stop per card (arrow keys move between them), so a page of 60 cards isn't 180 Tab presses.
  const hoverChips = (key, f) => [toolbar([
    saved[key]
      ? h("button", { class: "tk-chip k-good", title: "Saved in the panel (click to remove)", onclick: own(() => toggleSave(key)) }, "Saved")
      : h("button", { class: "tk-chip k-plain tk-x", title: "Save it to look at later", onclick: own(() => toggleSave(key)) }, "Save"),
    // No price for it yet: one free lookup of its own title. Otherwise eBay's sold listings, to look yourself.
    f.title && canPrice(f)
      ? h("button", { class: "tk-chip k-plain tk-x", title: `The typical price from recent eBay sales of \u201c${TK.titleToQuery(f.title)}\u201d: free, and your AI isn't used`, onclick: own((e) => priceOne(key, e.currentTarget)) }, "Typical price")
      : f.title ? h("button", { class: "tk-chip k-plain tk-x", title: "What this sold for on eBay (new tab)", onclick: own(() => window.open(soldLink(f.title), "_blank", "noopener")) }, "Sold \u2197") : null,
    hideChip(key),
  ])];
  const toolbar = (btns) => {
    const list = btns.filter(Boolean);
    list.forEach((b, i) => {
      b.tabIndex = i ? -1 : 0;
      b.addEventListener("keydown", (e) => {
        const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (!d) return;
        e.preventDefault();
        e.stopPropagation();
        const next = list[(i + d + list.length) % list.length];
        list.forEach((x) => (x.tabIndex = x === next ? 0 : -1));
        next.focus();
      });
    });
    return h("span", { class: "tk-acts", role: "toolbar", "aria-label": "Tirekick: save or hide this listing" }, list);
  };

  // ---------- saved listings and searches (kept in this browser, across both sites) ----------
  // Several tabs may write at once, so a change is sent as an edit (TKShared.applyEdit) and the background
  // script applies them one at a time. Resolves to the record as stored after it.
  const writeStored = (name, edit) => send("storeEdit", { name, edit }).catch(storeFailedThrow); // the caller stops here: nothing says "Saved" when it wasn't
  // Two plain counters, kept only in this browser: scans and typical-price checks, for Home's first-run
  // checklist and the mode hint. One at a time, so two close together don't overwrite each other.
  let bumpQueue = Promise.resolve();
  const bump = (name) => {
    if (!alive()) return;
    bumpQueue = bumpQueue.then(() => writeStored("stats", { inc: { [name]: 1 }, add: { since: Date.now() } })).catch(() => {});
  };
  const toggleSave = async (key) => {
    const f = facts.get(key) || scored.get(key) || (itemFacts?.key === key ? itemFacts : {});
    const was = !!saved[key];
    saved = await writeStored("saved", { set: { [key]: was ? null : { t: f.title || "", u: f.url || location.href.split("?")[0], img: f.imageUrl || "", p0: f.price ?? null, a0: Date.now(), p: f.price ?? null, a: Date.now() } } });
    afterSavedChange();
    setStatus(was ? "Removed from Saved." : `Saved \u201c${(f.title || "listing").slice(0, 50)}\u201d. It's under Saved at the bottom of the panel.`, false, { label: "Undo", fn: () => toggleSave(key) });
  };
  const searchKey = (q) => `${TK.currentSite()}|${q.trim().toLowerCase()}`;
  const pageSearch = () => (TK.site()?.queryOf(location) || "").trim();
  const toggleSearch = async (q) => {
    const k = searchKey(q);
    const was = !!savedSearches[k];
    savedSearches = await writeStored("savedSearches", { set: { [k]: was ? null : { site: TK.currentSite(), q, url: location.href, a0: Date.now(), v: Date.now(), n: facts.size, fresh: 0, deal: quick.deal || 0, deals: dealCount() } } });
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
    $(".view-home").hidden = v !== "home";
    if (v === "page" && listStale) render();
    if (v === "home") home.refresh().then(() => home.seen()).catch(() => {});
    $(".body").scrollTop = 0;
    if (v === "saved") renderSaved();
  };
  root.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));
  // Home: alerts on saved things, a few numbers, paid AI spending. Looking at it marks the alerts seen.
  const homeCount = $('.nav [data-view="home"] .cnt');
  const home = TKHome.mount($(".view-home"), {
    send,
    go: (v) => setView(v),
    isShown: () => view === "home" && wrap.classList.contains("open") && !document.hidden,
    onAlerts: (n) => {
      homeCount.textContent = n ? String(n) : "";
      homeCount.hidden = !n;
    },
  });
  home.count().catch(() => {}); // just the tab's number; Home itself is drawn when it's shown
  onModeChanged = () => {
    home.markStale();
    if (view === "home") home.wake().catch(() => {});
  };
  document.addEventListener("visibilitychange", () => home.seen(), until);
  // The toolbar icon (and its right-click menu) can bring up a particular tab.
  // From the toolbar icon (detail.toggle): with Home already on screen, the click tucks the panel away as usual.
  window.addEventListener("tirekick-show", (e) => {
    if (e.detail?.toggle && view === "home" && wrap.classList.contains("open")) return setOpen(false);
    setView(e.detail?.view === "home" ? "home" : view);
    setOpen(true);
  }, until);
  const siteName = (k) => TKSites.nameOf(k);
  const removeStored = async (name, k) => {
    const next = await writeStored(name, { set: { [k]: null } });
    if (name === "saved") saved = next;
    else savedSearches = next;
    afterSavedChange();
  };
  // The Saved view: listings with the price you saved them at and the latest you've seen, searches
  // with when you last looked, and what you've hidden (each one can come back). Built when shown.
  const itemUrl = (k) => TKSites.itemUrl(k);
  // Where a saved listing or search leads. Stored addresses are checked first (a restored backup can hold
  // anything): only the sites this works on, over https; anything else is rebuilt from the key or the search words.
  const safeUrl = (u, fallback) => {
    try {
      const x = new URL(u);
      return x.protocol === "https:" && (TKSites.isSiteHost(x.hostname) || TKSites.isSiteHost(`www.${x.hostname}`)) ? x.href : fallback;
    } catch {
      return fallback;
    }
  };
  const savedSearchUrl = (r) => safeUrl(r.url, (TKSites.get(r.site) || TKSites.get("ebay")).searchUrl(r.q || ""));
  // A small line of the prices seen for a saved listing, when there's more than one.
  const priceHistory = (k, r) => {
    const mem = memory[k];
    let pts = mem ? [...(mem.h || []).map(([p, t]) => ({ v: p, t })), { v: mem.p ?? r.p, t: mem.a ?? r.a }] : [];
    if (pts.length < 2 && r.p0 != null && r.p != null && r.p0 !== r.p) pts = [{ v: r.p0, t: r.a0 }, { v: r.p, t: r.a }];
    const line = TKShared.spark(pts, { w: 76, h: 24, label: `Price history: ${pts.map((p) => dollars(p.v)).join(" \u2192 ")}` });
    return line ? h("div", { class: "spark" }, line) : null;
  };
  let hiddenOpen = false; // the folded "Hidden" section stays as you left it while the list redraws
  const renderSaved = () => {
    const items = Object.entries(saved).sort((a, b) => b[1].a0 - a[1].a0);
    const searches = Object.entries(savedSearches).sort((a, b) => b[1].v - a[1].v);
    const hidden = Object.entries(notInterested).sort((a, b) => b[1].a - a[1].a);
    $('.nav [data-view="saved"] .cnt').textContent = items.length + searches.length ? String(items.length + searches.length) : "";
    if (view !== "saved") return;
    const sayHere = (text, err = false) => {
      const st = $(".saved-status");
      st.textContent = text;
      st.classList.toggle("err", err);
    };
    const priceLine = (k, r) => {
      const now = r.p != null ? dollars(r.p) : "no price";
      const moved = r.p0 != null && r.p != null && r.p !== r.p0;
      // the price itself has its own column (.pr); this line says where, when, and how it moved
      return [
        siteName(k),
        moved ? h("span", { class: r.p < r.p0 ? "down" : "" }, ` \u00b7 ${r.p < r.p0 ? "\u2193" : "\u2191"} from ${dollars(r.p0)}`) : "",
        ` \u00b7 ${r.a - r.a0 > 60000 ? `seen ${shortDate(r.a)}` : `saved ${shortDate(r.a0)}`}`,
        r.p == null ? ` \u00b7 ${now}` : "",
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
    // The same list as a spreadsheet, with prices seen and the latest score (TKShared.savedRows).
    const csv = h("button", {
      onclick: () => {
        const rows = TKShared.savedRows(saved, scansCache || {});
        const a = h("a", { href: URL.createObjectURL(new Blob([TKShared.toCsv(rows, TKShared.SAVED_COLUMNS)], { type: "text/csv;charset=utf-8" })), download: `tirekick-saved-${TKShared.localDay()}.csv` });
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        csv.textContent = "Downloaded";
      },
      title: "Saved listings with prices and scores, for a spreadsheet",
    }, "Download (CSV)");
    $(".saved-body").replaceChildren(
      ...[
            !items.length && !searches.length
              ? h("div", { class: "hint" }, "Nothing saved yet. Hover any card and press Save, or save a search from under the Scan button. Prices update whenever a saved listing is on your screen again.")
              : null,
            items.length ? h("b", { class: "sub" }, `Saved listings \u00b7 ${items.length}`) : null,
            ...items.map(([k, r]) =>
              h(
                "div",
                { class: "srow" },
                h(
                  "div",
                  {},
                  h("a", { href: safeUrl(r.u, itemUrl(k)), target: "_blank", rel: "noopener" }, r.t || safeUrl(r.u, itemUrl(k))),
                  h("div", { class: "meta" }, priceLine(k, r), h("button", { class: "srow-act", title: "Remove from Saved", onclick: () => removeStored("saved", k) }, "Remove"))
                ),
                priceHistory(k, r),
                r.p != null ? h("div", { class: "pr" }, dollars(r.p)) : null
              )
            ),
            items.length ? h("div", { class: "actions sv-acts" }, copy, csv) : null,
            searches.length ? h("b", { class: "sub" }, `Saved searches \u00b7 ${searches.length}`) : null,
            ...searches.map(([k, r]) =>
              h(
                "div",
                { class: "srow" },
                h(
                  "div",
                  {},
                  h("a", { href: savedSearchUrl(r), title: "Run this search again" }, `\u201c${r.q}\u201d`),
                  h("div", { class: "meta" }, [
                    `${(TKSites.get(r.site) || TKSites.get("facebook")).name} \u00b7 looked ${shortDate(r.v)}${r.n ? ` \u00b7 ${r.n} listings` : ""}${r.fresh ? `, ${r.fresh} new then` : ""}`,
                    r.deal ? h("span", { class: r.deals ? "down" : "" }, ` \u00b7 ${r.deals || "none"} at your $${r.deal}`) : "",
                    h("button", { class: "srow-act", title: "Remove this search", onclick: () => removeStored("savedSearches", k) }, "Remove"),
                  ])
                )
              )
            ),
            searches.length > 1
              ? h(
                  "div",
                  { class: "actions sv-acts" },
                  h("button", {
                    onclick: async () => {
                      const n = await send("openTabs", { urls: searches.map(([, r]) => savedSearchUrl(r)) }).catch(() => 0);
                      sayHere(n ? `Opened ${n} saved search${n === 1 ? "" : "es"} in background tabs. What's new in each says New to you.` : "Couldn't open the saved searches.", !n);
                    },
                    title: "Each saved search in its own background tab; what's new will say New to you",
                  }, `Open all ${searches.length} searches`)
                )
              : null,
            // Not interested: folded away (they are not things you kept), and every one can come back.
            hidden.length
              ? h(
                  "details",
                  { class: "hidden-box", open: hiddenOpen ? "" : null, ontoggle: (e) => (hiddenOpen = e.currentTarget.open) },
                  h("summary", {}, h("b", {}, `Hidden \u00b7 ${hidden.length}`), h("span", {}, "listings you marked Not interested")),
                  ...hidden.slice(0, 40).map(([k, r]) =>
                    h(
                      "div",
                      { class: "srow hid" },
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
                            await writeStored("notInterested", { set: Object.fromEntries(Object.keys(notInterested).map((k) => [k, null])) });
                            notInterested = {};
                            redecorateAll();
                            renderSaved();
                            sayHere("Everything you hid is back.");
                          },
                        }, "Unhide all")
                      )
                    : null
                )
              : null,
          ].filter(Boolean)
    );
  };
  // After any change to Saved (here, or in another tab): the section, the cards' stars, the listing view.
  const afterSavedChange = () => {
    renderSaved();
    if (TK.pageType() === "results" && facts.size) redecorateAll();
    if (TK.pageType() === "item") renderItemInfo();
  };
  chrome.storage.onChanged.addListener((changes) => {
    if (!alive() || !(changes.saved || changes.savedSearches)) return;
    if (changes.saved) saved = changes.saved.newValue || {};
    if (changes.savedSearches) savedSearches = changes.savedSearches.newValue || {};
    afterSavedChange();
  });
  memoryReady.then(renderSaved);

  // The same words on the other site, in a new tab (with more sites, the first of the others).
  const otherSite = () => TKSites.others(TK.currentSite())[0];
  const otherSiteUrl = (q) => otherSite().searchUrl(q);


  const reapplyFacebook = () => {
    if ((!scored.size && !facts.size) || !cardsHere().recycles) return;
    const todo = [];
    document.querySelectorAll(ITEM_LINK).forEach((a) => {
      const key = keyOf(a.href);
      // Cheap check first (no layout reads): is this card still dressed for this listing?
      const tagged = a.closest("[data-tirekick-key]");
      if (tagged?.dataset.tirekickKey === key && (tagged.querySelector(":scope > .tirekick-sticker, :scope > .tirekick-marks") || !scored.has(key))) return;
      if (scored.has(key) || facts.has(key)) todo.push([key, a]);
      else if (tagged && (tagged === a || tagged.querySelectorAll(ITEM_LINK).length === 1)) undecorate(tagged); // recycled for a listing we know nothing about
    });
    decorateAll(todo);
  };

  const clearStickers = () => {
    scored = new Map();
    seen = new Set();
    document.querySelectorAll("[data-tirekick-key]").forEach(undecorate);
    document.querySelectorAll("[data-tk-hide], [data-tk-v], [data-tk-cell], [data-tk-faded], [data-tk-lift]").forEach((n) => {
      for (const a of ["data-tk-hide", "data-tk-v", "data-tk-cell", "data-tk-faded", "data-tk-lift"]) n.removeAttribute(a);
    });
    document.querySelectorAll(".tirekick-sticker, .tirekick-marks").forEach((s) => s.remove());
  };

  // ---------- the page pass: runs when listings appear, no model involved ----------
  let passKeys = new Set();
  let passEls = new Map(); // key -> its card, as the last page pass found it
  let pageHadKnown = null; // first visit to a search: nothing is "new to you" yet
  let passing = false;
  const pagePass = async (force = false) => {
    if (retired) return;
    if (TK.pageType() !== "results" || passing) return;
    const keysNow = currentKeys();
    if (!force && keysNow.size === passKeys.size && [...keysNow].every((k) => passKeys.has(k))) return;
    passing = true;
    try {
      await Promise.all([memoryReady, prefsReady, quickReady, modeReady]);
      const items = TK.extract();
      passKeys = keysNow;
      if (pageHadKnown === null && items.length) pageHadKnown = items.some((it) => memory[keyOf(it.url)]);
      // Same title (or same photo) on several listings: reposts, or one seller with several.
      const dup = TKRules.duplicates(items, TK.isPlaceholder);
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
        if (prev?.offSiteOk != null) f.offSiteOk = prev.offSiteOk;
        if (prev?.codeOk != null) f.codeOk = prev.codeOk; // a scan judged this code a real model number: keep that
        if (f.titleCode && TKRules.codeInSearch(f.titleCode, pageSearch())) f.codeOk = true; // the model number searched for
        if (prev?.photoTwins) f.photoTwins = prev.photoTwins;
        f.known = prev ? prev.known : !!sighting.known;
        f.project = clueOf(PROJECT, `${it.title} ${it.condition || ""} ${f.text}`);
        f.vsSold = vsSoldOf(f); // after project: a broken one is never "too cheap"
        f.motivated = clueOf(MOTIVATED, `${it.title} ${f.text}`);
        f.filtered = filterReason(f);
        f.deal = isDeal(f);
        facts.set(key, f);
      }
      await notePrices(items);
      watchPhotos(items);
      if (!scansCache) await loadScans().catch(() => {});
      if (restoreScans(items)) {
        setCount(scored.size);
        scanInputs ??= inputsNow(); // changing wants or the comparison now offers a rescan, as after a scan
      }
      // "New to you" only helps on a search you come back to, and only when it picks out a few:
      // on a feed, or when most of the page is new anyway, every card would wear it.
      const all = [...facts.values()];
      const showNew = !!(TK.facebookQuery() || TK.ebayQuery()) && all.filter((f) => f.fresh).length <= all.length * 0.4;
      all.forEach((f) => (f.isNew = showNew && !!f.fresh));
      passEls = new Map(items.map((it) => [keyOf(it.url), it.el]));
      decorateAll(items.map((it) => [keyOf(it.url), it.el]));
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
  let marketFor = ""; // the search the cards' "below/above typical" is for
  // A listing's own typical price (looked up from its title, from its hover) wins over the page's.
  // Pickup listings on a local site are compared without the shipping in eBay's totals (TKRules.forPickup).
  const pickupOf = (m, f) => TKRules.forPickup(m, f, !!(f?.site ? TKSites.get(f.site) : TK.site())?.local); // facts don't keep the site: this page's
  const marketOf = (f) => pickupOf(f?.ownMarket || lastMarket, f);
  // An accessory or part for the search ("Case for Nintendo Switch") isn't compared with the thing's typical price.
  // A scan's "not your search" counts too, and a title that leaves out a word of the search is never "Likely
  // scam" on price alone (TKRules.tooCheap).
  const vsSoldOf = (f) => {
    if (f.url && scored.get(keyOf(f.url))?.related === false) f.related = false;
    return TKRules.compareFacts(f, marketOf(f), marketFor);
  };
  const applyMarket = (market) => {
    lastMarket = market;
    marketFor = queryEl.value.trim().toLowerCase();
    for (const f of facts.values()) f.vsSold = vsSoldOf(f);
    for (const it of scored.values()) followMarket(it, market);
    if (itemFacts) itemFacts.vsSold = vsSoldOf(itemFacts);
    redecorateAll();
    if (TK.pageType() === "item") renderItemInfo(); // the offer helper works from these prices
    refreshPending();
    showQuick(); // the "Your price" box can now suggest a price
  };
  const cachedMarket = async (query) => {
    if (!query.trim()) return null;
    const { soldCache = {} } = await chrome.storage.local.get("soldCache");
    const hit = soldCache[`v2:used:${query.trim().toLowerCase()}`];
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
    saved = await writeStored("saved", { patch: Object.fromEntries(stale.map((it) => [keyOf(it.url), { p: it.price, a: Date.now() }])) }); // a listing unsaved meanwhile stays unsaved
  };
  // A saved search remembers when you last looked and how much was new then.
  const noteSearchVisit = async (all) => {
    const q = pageSearch();
    const rec = q && savedSearches[searchKey(q)];
    const deals = all.filter((f) => f.deal && !f.hidden && !f.filtered).length;
    if (!rec || (rec.n === all.length && rec.deals === deals && Date.now() - rec.v < 10 * 60 * 1000)) return;
    savedSearches = await writeStored("savedSearches", { patch: { [searchKey(q)]: { v: Date.now(), n: all.length, fresh: all.filter((f) => f.fresh).length, deals, deal: quick.deal || 0, url: location.href } } });
  };

  // Re-dress everything after a settings change (filters, marks, hidden toggle).
  const redecorateAll = () => {
    for (const [key, f] of facts) {
      f.filtered = filterReason(f);
      f.sellerWarn = sellerWarning(f);
      f.hidden = !!notInterested[key];
    }
    // Find each card directly: a hidden card can't always be read again by the adapter.
    decorateAll([...facts.keys()].map((key) => [key, elFor(key)]));
    render();
    renderPageInfo();
  };

  // "Not interested": hidden on every page from now on (undo from the panel or settings).
  const setInterested = async (key, interested) => {
    const f = facts.get(key) || scored.get(key) || (itemFacts?.key === key ? itemFacts : {});
    notInterested = await writeStored("notInterested", { set: { [key]: interested ? null : { t: f.title || "", a: Date.now() } }, cap: { max: 3000, by: "a" } });
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
    const v = shownV(item, f);
    const CAMERA = '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';
    const sub = lensLine(item);
    // The sticker's own line already says "Auction…" / "Lot of…" when it applies; don't repeat it below.
    const under = chipsFor(f)
      .filter(([, t]) => !(/^Auction/.test(t) && item.auction && item.related !== false) && !(/^Lot of/.test(t) && /^Lot of/.test(sub)) && !TKRules.SOLD_CHIP.test(t) && !(v.priceWarn && /^(Likely scam|Too cheap)\?/.test(t)))
      .map(([kind, text, why]) => h("span", { class: `tk-chip k-${kind}`, title: why || null }, chipText(text)));
    if (item.photoAdjust) {
      const chip = h("span", { class: "tk-chip", title: "Photo check" }, signed(item.photoAdjust));
      chip.insertAdjacentHTML("afterbegin", CAMERA); // static markup, no page text involved
      under.unshift(chip);
    }
    const line = (text) => (text ? h("div", { class: "tk-flags" }, text) : null);
    // A reposted scam judged without a model: the campaign line says it all, so its stock reason and flag don't repeat it.
    const reposted = !!f.campaign && !!item.flags?.includes("reposted scam");
    return h(
      "div",
      { class: "tirekick-sticker", "data-v": v.v, tabindex: "0", role: "group", "aria-label": `Tirekick: score ${v.score}, ${v.label}. Tab to the reasons and actions.` },
      scoreDial({ ...item, score: v.score, verdict: v.v }),
      h("div", { class: "tk-text" }, h("div", { class: "tk-verdict" }, v.label), sub ? h("div", { class: "tk-sub" }, sub) : null),
      // Below the tag, in one column: the chip row, then (on hover) the card with the reasons. However
      // many rows the chips wrap to, the card sits under them.
      h(
        "div",
        { class: "tk-below" },
        h("div", { class: "tk-under" }, sub ? h("span", { class: "tk-chip k-plain tk-subchip" }, sub) : null, under.slice(0, 3), hoverChips(key, { ...item, ...f })),
        h(
        "div",
        { class: "tk-pop" },
        h("b", {}, String(v.score), " ", h("span", { class: "tk-pw" }, v.label)),
        v.why ? line(`${v.why} The scan said ${VERDICT[item.verdict].label}${v.score !== item.score ? ` (${item.score})` : ""}.`) : null,
        item.related === false ? line("Not what you searched for, scored on the deal alone.") : null,
        f.campaign ? line(`Posted again with other codes (${f.campaign.join(", ")}): one fake listing copied many times. Don't message or pay.`) : null,
        !f.campaign && f.titleCode && !f.codeOk ? line(`The title ends in the code ${f.titleCode}. Bulk-posted fakes on Marketplace end that way, and so do real model numbers: check it's this item's model number.`) : null,
        f.photoTwins ? line(photoTwinsText(f.photoTwins)) : null,
        reposted ? "" : item.reason || "",
        movedSince(item) ? line(`Scored when the typical price was ${dollars(Math.round(item.scoredRef))}; it's ${dollars(Math.round(item.refPrice ?? item.refWorking))} now. The price word and checks use today's; scan again for a new score.`) : null,
        item.scannedAt ? line(`Scored ${shortDate(item.scannedAt)}${item.scannedWith ? ` with ${nameOf(item.scannedWith)}` : ""}${item.scannedKind === "scan" || !item.scannedKind ? ", from the card's title, price and text (not the photos or the description)" : ", from the listing's page"}.`) : null,
        // How the numbers were made, and how far to trust them
        item.margin != null && item.lens === "project"
          ? line(`Price gap: sold at ${item.refIsEstimate ? "the estimated" : "the typical"} price of ${dollars(item.refWorking)}, less ${item.feePct}% + $0.40 fees${item.shipOut ? `, ~${dollars(item.shipOut)} shipping` : " (shipping not known: take it off)"}${item.partsCost ? `, ~${dollars(item.partsCost)} parts` : ""} and the ${dollars(item.total)} price. Before sales tax and your time.`)
          : null,
        item.refRough && !item.refIsEstimate ? line("The sold price comes from few sales or a wide spread: a rough guide.") : null,
        f.auction ? line(`Auction: ${f.bids || 0} bid${f.bids === 1 ? "" : "s"}${f.timeLeft ? `, ${f.timeLeft} left` : ""}. The price is only the current bid.${item.bidCap > 0 ? ` Worth bidding up to about ${dollars(item.bidCap)}${item.lens === "project" ? " to break even" : ""}.` : ""}`) : null,
        item.browse && item.sold ? line(`eBay sold \u201c${item.query}\u201d: median ${dollars(item.sold.median)}, middle half ${dollars(item.sold.p25)}\u2013${dollars(item.sold.p75)} (${item.sold.n} sales).`) : null,
        item.browse && !item.sold && item.est ? line(`Typical used price est. ${dollars(item.est.lo)}\u2013${dollars(item.est.hi)}: the model's estimate, not sales data.${item.query ? " Check sold prices in the panel for real numbers." : ""}`) : null,
        f.lot && item.total != null ? line(`Lot of ${f.lot}: about ${dollars(Math.round((item.total / f.lot) * 100) / 100)} each.`) : null,
        f.drop ? line(`Was ${dollars(f.drop.from)} when you saw it on ${shortDate(f.drop.since)}.`) : null,
        f.sellerWarn ? line(`${f.sellerWarn} (your rule: at least ${prefs.minSellerRatings} ratings, ${prefs.minSellerPct}% positive).`) : null,
        f.dup ? line(`${f.dup} listings on this page share this title or photo: a repost, or one seller with several.`) : null,
        item.fault && !/^none$/i.test(item.fault) ? line(`Likely fault: ${item.fault}${item.difficulty ? ` (difficulty ${item.difficulty}/5)` : ""}`) : null,
        item.photoAdjust ? line(`Photo check ${signed(item.photoAdjust)}: ${(item.photos || []).flatMap((p) => p.why).join("; ") || "see panel"}`) : null,
        item.flags?.length ? line(item.flags.filter((x) => !(reposted && x === "reposted scam")).join(", ") || null) : null,
        item.imageUrl &&
        h(
          "div",
          { class: "tk-acts" },
          // Save, Sold and Not interested sit just above as chips; this adds what they don't.
          item.imageUrl ? h("a", { href: lensSearchUrl(item.imageUrl), target: "_blank", rel: "noopener", onclick: (e) => e.stopPropagation(), title: "Reverse image search: is this photo used elsewhere?" }, "Find photo elsewhere \u2197") : null
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
  const isSkip = (it) => it.score != null ? skipV(shownV(it)) : likelyScam(facts.get(keyOf(it.url)));
  // A price warning recolors the verdict but doesn't gray the listing out: it may still be the real thing.
  function skipV(sv) { return sv.v === "pass" || (sv.v === "suspicious" && !sv.priceWarn); }
  // The verdict to show for a scored listing: the price check wins over the score (TKRules.priceVerdict).
  // The model's own verdict stays stored; this is worked out each time, with the latest typical price.
  // opts.deep: an Analyze answer, which read the whole listing (priceVerdict lets it clear more).
  function shownV(it, f = facts.get(keyOf(it.url)), opts) {
    const market = it.refWorking > 0 && !it.refIsEstimate ? { median: it.refPrice ?? it.refWorking, confidence: it.refRough ? "rough" : "good" } : marketOf({ ...f, ...it });
    const pv = TKRules.priceVerdict(it.verdict, { ...f, ...it }, market, opts);
    return { v: pv.v, score: pv.score ?? it.score, why: pv.why || "", label: pv.label || (VERDICT[pv.v] || VERDICT.fair).label, priceWarn: pv.v === "suspicious" && it.verdict !== "suspicious", level: pv.level || "" };
  }

  // Every listing on the page, scored or not: before a scan the list is the page in a form you
  // can sort, with the free facts; scoring fills in verdicts as they arrive.
  const pageItems = () => {
    const out = [];
    for (const [key, f] of facts) out.push(scored.get(key) || { ...f, key });
    for (const [key, it] of scored) if (!facts.has(key)) out.push(it);
    return out;
  };
  // The score as shown: moved into the price check's verdict when that wins, so a "Great price, if it's real" at
  // 91 doesn't head the list. Worked out once per item per render (shownMemo), not in every comparison.
  let shownMemo = null;
  // A "Too cheap?" warning (not Likely scam) the model liked sorts just under Fair price, above the passes: it's a
  // listing to check, not one to skip. Its own score still shows.
  const sc = (it) => {
    if (it.score == null) return -1;
    const sv = shownMemo?.get(it) ?? shownV(it);
    return sv.priceWarn && sv.level === "low" ? TKRules.BANDS.fair[0] - 0.5 : sv.score;
  };
  // Before a scan, "best first" goes by the free read: good prices up, warnings and off-topic down.
  const freeRank = (it) => (it.score != null ? 0 : TKRules.freeRead(facts.get(keyOf(it.url)) || it, marketOf(facts.get(keyOf(it.url)) || it))?.rank ?? 0.5);
  const dealOf = (it) => (facts.get(keyOf(it.url))?.deal ? 1 : 0);
  const perItem = (it) => (it.total == null ? Infinity : it.lot ? it.total / it.lot : it.total);
  const vsSold = (it) => it.vsWorking ?? facts.get(keyOf(it.url))?.vsSold ?? Infinity;
  const endsIn = (it) => (it.auction ? (it.hoursLeft ?? 1e6) : Infinity);
  let sortMode = "score";
  // Ties keep the page's own order (sort is stable).
  const SORTS = {
    score: (a, b) => (a.score == null) - (b.score == null) || (a.related === false) - (b.related === false) || sc(b) - sc(a) || freeRank(b) - freeRank(a) || dealOf(b) - dealOf(a), // your search first
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
  // The list is only drawn while you can see it: tucked away (or on Saved or Home) a redraw just marks it
  // stale, and opening the panel draws it once. Drawing hundreds of rows into a hidden panel after every
  // page pass made long Marketplace feeds lag.
  let listStale = false;
  const render = () => {
    if (!wrap.classList.contains("open") || view !== "page") return void (listStale = true);
    listStale = false;
    listEl.replaceChildren();
    if (TK.pageType() !== "results") return;
    const by = SORTS[sortMode] || SORTS.score;
    const shown = pageItems().filter((it) => !isHidden(it) && !(skipMode === "hide" && isSkip(it)));
    shownMemo = new Map(shown.filter((it) => it.score != null).map((it) => [it, shownV(it)]));
    shown.sort((a, b) => isSkip(a) - isSkip(b) || by(a, b)); // skipped and likely scams go last, whatever the sort
    shownMemo = null;
    shown.forEach((it, i) => {
      const key = keyOf(it.url);
      const f = facts.get(key) || it;
      const still = shownKeys.has(key);
      shownKeys.add(key);
      const known = chipsFor(f)
        .filter(([, t]) => !/^Auction|^Lot of/.test(t) && !TKRules.SOLD_CHIP.test(t))
        .map(([k, t]) => h("span", { class: `fchip k-${k}` }, chipText(t)));
      const saveBtn = h("button", { class: saved[key] ? "on" : null, onclick: () => toggleSave(key) }, saved[key] ? "Saved" : "Save");
      const hideBtn = h("button", { onclick: () => setInterested(key, !!notInterested[key]) }, notInterested[key] ? "Undo hide" : "Not interested");
      // Not scored (yet): the price is the headline, with what's known for free.
      if (it.score == null) {
        const mk = marketOf(f);
        const vs = f.vsSold != null ? `, ${TKRules.vsText(f.total, mk.median, { rough: mk.confidence === "rough", long: true, working: !!f.project })} (${dollars(Math.round(mk.median))})` : "";
        const each = it.lot && it.total != null ? `, lot of ${it.lot}, ${dollars(Math.round((it.total / it.lot) * 100) / 100)} each` : "";
        listEl.append(
          h(
            "div",
            { class: `row plain${still ? " still" : ""}${likelyScam(f) ? " skip" : ""}`, style: `--i:${Math.min(i, 8)}` },
            h(
              "div",
              {},
              h("button", { class: "title", onclick: () => focusCard(it), title: "Show it on the page" }, it.title),
              (() => {
                const read = !likelyScam(f) && TKRules.freeRead(f, marketOf(f));
                return read ? h("div", { class: "meta free-read", "data-v": read.v, title: "From the typical price (recent eBay sales) and the free checks; your AI isn't used. A scan with your AI gives a real score." }, h("span", { class: "verdict" }, read.word), " free read") : null;
              })(),
              likelyScam(f) ? h("div", { class: "meta scamline" }, f.campaign ? "Likely scam: reposted under new codes" : f.offSite?.sure ? "Likely scam: asks to get in touch off the site" : `Likely scam: code ${f.titleCode} tacked on the title, and ${TKRules.codeBacked(f)}. A scan clears it if that's the model number.`) : null,
              (() => {
                // The tag already shows the price; the line adds only what it doesn't say.
                const bits = [it.shipping > 0 && `${dollars(it.total)} incl. ${dollars(it.shipping)} shipping`, it.auction && `current bid${it.timeLeft ? `, ${it.timeLeft} left` : ""}`, it.total == null && (it.priceText || "no price")]
                  .filter(Boolean)
                  .join(", ");
                const line = `${bits}${vs}${each}`.replace(/^, /, "");
                return line ? h("div", { class: "meta" }, line) : null;
              })(),
              known.length ? h("div", { class: "flags" }, known) : null
            ),
            h("div", { class: f.deal ? "pr deal" : "pr" }, it.total == null ? "\u2014" : `$${Math.round(it.total)}`, openLink(it)),
            h(
              "div",
              { class: "actions row-acts" },
              h("a", { href: soldLink(it.title), target: "_blank", rel: "noopener", title: "eBay sold listings for this title, in a new tab" }, "Sold \u2197"),
              saveBtn,
              hideBtn
            )
          )
        );
        return;
      }
      const pv = shownV(it);
      const box = photoBox(it);
      const vsMarket =
        it.vsWorking != null && !it.auction && !it.lot
          ? it.refIsEstimate
            ? `${TKRules.vsText(it.total, it.refWorking, { est: true }).replace(" (est.)", "")} (est. ${dollars(it.est.lo)}\u2013${dollars(it.est.hi)})`
            : `${TKRules.vsText(it.total, it.refPrice ?? it.refWorking, { rough: it.refRough, long: true, working: !!f.project })} (${dollars(Math.round(it.refPrice ?? it.refWorking))}${it.sold ? `, ${it.sold.n} sales` : ""})`
          : "";
      const line = lensLine(it);
      const flags = (it.flags || []).map((t) => h("span", { class: "flag" }, t));
      listEl.append(
        h(
          "div",
          { class: still ? "row still" : "row", style: `--i:${Math.min(i, 8)}` },
          tagEl(pv.v, pv.score),
          h(
            "div",
            {},
            h("button", { class: "title", onclick: () => focusCard(it), title: "Show it on the page" }, it.title),
            h("div", { class: "meta", "data-v": pv.v }, h("span", { class: "verdict" }, pv.label), ` ${[it.related === false && "(not your search)", (it.auction || it.shipping > 0) && priceStr(it), it.related !== false && vsMarket].filter(Boolean).join(", ")}`),
            (it.lens !== "use" || it.auction || it.lot) && it.related !== false ? h("div", { class: it.margin < 0 ? "lensinfo neg" : "lensinfo" }, line + (it.fault && !/^none|unknown$/i.test(it.fault) ? `, ${it.fault}` : "")) : null,
            pv.why ? h("div", { class: "meta pricewhy" }, `${pv.why} The scan said ${VERDICT[it.verdict].label}.`) : null,
            h("div", { class: "reason" }, it.reason || ""),
            // One row of chips: what's known for sure (filled) first, then the model's flags (outlined).
            known.length || flags.length ? h("div", { class: "flags" }, known, flags) : null
          ),
          h("div", { class: it.deal ? "pr deal" : "pr" }, it.total == null ? "\u2014" : `$${Math.round(it.total)}`, openLink(it)),
          // Actions and photo notes run under the price too, so the four links fit on one line.
          h(
            "div",
            { class: "actions row-acts" },
            it.browse && it.query && !it.sold ? h("button", { onclick: (e) => checkSold(it, e.currentTarget), title: `The typical price from recent eBay sales of \u201c${it.query}\u201d` }, "Typical price") : null,
            it.imageUrl ? h("button", { onclick: (e) => runPhotoCheck(it, box, e.currentTarget), title: "Have the AI look at the photo (can change the score)" }, it.photos ? "Re-check photo" : "Check photo") : null,
            it.imageUrl ? h("a", { href: lensSearchUrl(it.imageUrl), target: "_blank", rel: "noopener", title: "Reverse image search: is this photo used elsewhere?" }, "Find photo elsewhere \u2197") : null,
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
  const elFor = (key) => TK.cardFor(key);
  const focusCard = (it) => {
    const key = keyOf(it.url);
    const el = it.el?.isConnected ? it.el : elFor(key) || document.querySelector(`[data-tirekick-key="${CSS.escape(key)}"]`);
    if (!el) {
      setStatus("That listing isn't on the page anymore. It scrolled away or the page changed.", false, { label: "Open it", fn: () => window.open(TKShared.safeUrl(it.url, "about:blank"), "_blank", "noopener") });
      return;
    }
    const card = stickerHost(el);
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    const c = card.getBoundingClientRect();
    if (wrap.classList.contains("open") && c.right > panel.getBoundingClientRect().left) showOpen(false);
    ensureStickerStyles();
    const cell = card.closest("[data-tk-cell]") || card;
    card.classList.remove("tirekick-flash");
    void card.offsetWidth; // restart the animation if it's still running
    card.classList.add("tirekick-flash");
    cell.setAttribute("data-tk-lift", "");
    clearTimeout(card._tkFlash);
    card._tkFlash = setTimeout(() => (card.classList.remove("tirekick-flash"), cell.removeAttribute("data-tk-lift")), 3600);
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
        btn.textContent = "No eBay sales found";
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
      btn.textContent = "Check the typical price";
    }
  };

  const runPhotoCheck = async (it, box, btn) => {
    btn.disabled = true;
    box.replaceChildren(h("div", { class: "photo" }, "Looking at the photo…"));
    setBusy(true);
    try {
      applyPhotos(it, [await sendAI("checkPhoto", { imageUrl: TK.bigImage(it.imageUrl), title: it.title })]);
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


  // ---------- does the page reader still keep up with the site? ----------
  // Both sites change their markup without notice. When the cards on a results page stop being read (or
  // come without prices), say so here instead of quietly showing fewer listings, and note it for Home.
  // Counted again only when the number of listing links changes, and only every few seconds.
  const readWarn = $(".readwarn");
  let healthLinks = -1;
  let healthLevel = "";
  const checkHealth = async () => {
    if (TK.pageType() !== "results") return void ((readWarn.hidden = true), (healthLinks = -1));
    const links = TK.linkedListings();
    if (links === healthLinks) return;
    healthLinks = links;
    const items = TK.extract();
    // With no search words (a category page, the Marketplace feed), links outside the results are common.
    const hl = TKRules.readHealth({ links, items: items.length, priced: items.filter((it) => it.price != null).length }, { partialOk: !pageSearch() });
    const note = TKRules.healthNote(hl, TK.site().name);
    readWarn.replaceChildren(...(note ? [note, h("button", { onclick: checkPage }, "Check this page")] : []));
    readWarn.hidden = !note;
    if (hl.level === "few" || hl.level === healthLevel || !alive()) return;
    healthLevel = hl.level;
    await writeStored("siteHealth", { upsert: { [TK.currentSite()]: note ? { bad: Date.now(), note, level: hl.level } : { ok: Date.now() } } });
  };

  // ---------- "Check this page": what the page reader can see, for when a site changes its layout ----------
  // Counts only, plus a few public listing titles; nothing is sent anywhere, the report is copied on request.
  const checkPage = async () => {
    const type = TK.pageType();
    const items = type === "results" ? TK.extract() : [];
    const n = (fn) => items.filter(fn).length;
    const { soldCooldownUntil = 0, soldCooldownWhy, soldLog = [], soldCache = {} } = await chrome.storage.local.get(["soldCooldownUntil", "soldCooldownWhy", "soldLog", "soldCache"]);
    const lines = [
      `Tirekick ${chrome.runtime.getManifest().version} on ${TK.currentSite()} (${type}), ${location.origin}${location.pathname}`,
      type === "results" && `Cards on the page: ${document.querySelectorAll(TK.currentSite() === "ebay" ? TK.EBAY_CARDS : TK.listingLinks()).length}; read as listings: ${items.length}`,
      type === "results" && items.length && `With a title ${n((i) => i.title)}, price ${n((i) => i.price != null)}, photo ${n((i) => i.imageUrl)}, shipping known ${n((i) => i.shipping != null)}, seller rating ${n((i) => i.sellerPct != null)}`,
      type === "results" && items.length && `First titles: ${items.slice(0, 3).map((i) => `\u201c${i.title.slice(0, 40)}\u201d`).join(", ")}`,
      type === "item" && (() => { const l = TK.extractItem(); return `Listing read: title ${l.title ? "yes" : "NO"}, price ${l.price != null ? "yes" : "NO"}, photos ${l.imageUrls?.length || 0}, seller ${l.seller ? "yes" : "no"}`; })(),
      `Sold prices: ${Date.now() < soldCooldownUntil ? `paused ${Math.ceil((soldCooldownUntil - Date.now()) / 60000)} more min (${soldCooldownWhy === "odd" ? "eBay's answer didn't look like a results page" : "eBay asked for a browser check"})` : "not paused"}; ${soldLog.filter((t) => Date.now() - t < 36e5).length} of ${TKSold.PER_HOUR} lookups used this hour; ${Object.keys(soldCache).length} searches remembered`,
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
  const inputsNow = () => [lens, wantEl.value.trim(), queryEl.value.trim(), lens === "project" ? feeEl.value : ""].join("|");
  const inputsChanged = () => scanInputs !== null && scored.size > 0 && scanInputs !== inputsNow();

  // Sold-price lookups (lib/sold.js) keep their pace, cache and back-off in one place for every page.
  // On eBay the request is made from the eBay page itself (same site, your cookies, normal browser
  // headers); from Facebook it goes through the background script, which prefers an open eBay tab.
  const SOLD_TTL_MS = TKSold.TTL_MS;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const fetchSoldHtml = async (query, condition) => {
    const url = TK.soldUrl(query, TK.SOLD_CONDITION[condition]);
    if (!TKSites.soldSite().hosts.includes(location.hostname)) return send("fetchSoldHtml", { url }); // from eBay's own page when on it
    const res = await fetch(url, { credentials: "include", signal: AbortSignal.timeout(30000) });
    return { status: res.status, html: res.ok ? await res.text() : "" };
  };
  const soldMarket = TKSold.create({ fetchHtml: fetchSoldHtml, send, isStopped: () => stopRequested });

  // What the number rests on: how many sales, and when it's a rough guide (few sales, or a wide spread).
  const leftOut = TK.leftOutSold;
  const priceCell = (label, m) =>
    h(
      "div",
      { title: [`The middle of ${m.n} recent eBay sales, shipping included where shown.`, leftOut(m.dropped).length && `Left out: ${leftOut(m.dropped).join(", ")}.`].filter(Boolean).join(" ") },
      h("span", { class: "mlabel" }, label),
      h("span", { class: "mval" }, `${m.confidence === "rough" ? "~" : ""}$${m.median}`),
      h("span", { class: "msub" }, `$${m.p25}\u2013$${m.p75}, ${m.n} sales${m.confidence === "rough" ? ", a rough guide" : ""}`)
    );
  const renderMarket = (market) => {
    if (!market) return marketEl.replaceChildren("Not enough eBay sales found to set a market price.");
    const groups = [
      market.median != null && ["Working / used", market.samples],
      market.parts && ["For parts", market.parts.samples],
    ].filter((g) => g && g[1]?.length);
    const cells = [
      market.median != null && priceCell(`Typical price${market.condition === "used" ? ", used" : ""}`, market),
      market.parts && priceCell("Typical for parts", market.parts),
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
              h("ul", {}, list.map((x) => h("li", {}, h("a", { href: TKShared.safeUrl(x.url, "#"), target: "_blank", rel: "noopener" }, h("span", { class: "cp" }, dollars(x.total)), h("span", { class: "ct" }, x.title))))),
            ])
          ),
      ].filter(Boolean)
    );
  };

  // Working price from used sales (falling back to any condition when there are too few);
  // for Fix & flip also what broken ones sell for, the floor you can always resell at.
  let lastMarket = null;
  // A whole category has no one typical price: say so, and what works instead.
  const broadNote = (query) => `\u201c${query}\u201d is a whole category, too broad for one typical price. Point at a listing and press Typical price for its own, or type a model under \u201cCompare prices against\u201d.`;
  const getMarket = async (settings, query, forLens) => {
    if (!settings.useSoldComps || !query) return null;
    if (TKRules.broadQuery(query)) {
      marketEl.replaceChildren(h("div", { class: "mnote" }, broadNote(query)));
      return null;
    }
    const epoch = pageEpoch;
    setStatus(`Checking recent eBay sales for "${query}"…`);
    let market = null;
    let partsNote = "";
    try {
      // One lookup for working (used) prices; a second for for-parts in Fix & flip, only when there's
      // something broken to compare (a listing page, or a results page with broken/untested listings).
      const used = await soldMarket(query, "used");
      const working = used && { ...used, condition: "used" };
      const needParts = forLens !== "use" && (TK.pageType() === "item" || [...facts.values()].some((f) => f.project));
      let parts = null;
      if (needParts) {
        try {
          parts = await soldMarket(query, "parts");
        } catch (e) {
          // The working price is already in hand: keep it, and say what went wrong with the other.
          if (!working || isStop(e)) throw e;
          partsNote = e.message;
        }
      }
      market = working || parts ? { ...(working || { median: null }), parts } : null;
    } catch (e) {
      console.debug("[Tirekick] sold comps failed:", e.message); // shown in the panel; not an extension error
      if (epoch !== pageEpoch) return null;
      // You can still look yourself: eBay's own sold search, in a normal tab.
      marketEl.replaceChildren(
        h("div", { class: "mnote" }, `${e.message} `, h("a", { href: TK.soldUrl(query, TK.SOLD_CONDITION.used), target: "_blank", rel: "noopener" }, "See sold listings on eBay"))
      );
      return null;
    }
    if (epoch !== pageEpoch) return market; // the page changed meanwhile: the numbers still go to that scan, not on screen
    renderMarket(market);
    if (partsNote) marketEl.append(h("div", { class: "mnote" }, `Sold-for-parts prices not checked: ${partsNote}`));
    lastMarket = market;
    return market;
  };

  // How each listing's total compares with the sold prices; for Fix & flip, the margin before repairs.
  // Lots aren't compared with a single item's price, and an auction's price is only the current bid,
  // so neither gets a margin; auctions get a sensible maximum bid instead (set once the score is in).
  // The resale side of a margin: buyers' totals include shipping, which you then pay to send it on, so
  // that comes off too (the shipping buyers paid on these sales, when enough of them paid it).
  // Before sales tax and before your own time.
  const resaleNet = (it) => it.refWorking * (1 - (it.feePct || 0) / 100) - 0.4 - (it.shipOut || 0);
  const priceNotes = (it, market, forLens, feePct) => {
    if (it.foreign) market = null; // another currency: nothing to compare with US sales (foreignText)
    const w = market?.median;
    it.shipOut = market?.ship ?? null;
    it.refRough = market?.confidence === "rough";
    const pm = market?.parts?.median;
    it.refWorking = w > 0 ? w : null; // what it resells for (margins)
    const cmp = pickupOf(market, it); // what it's compared with: less shipping for a pickup listing
    it.pickupShip = cmp?.pickupShip || 0;
    it.refPrice = cmp?.median > 0 ? cmp.median : null;
    it.refParts = pm > 0 ? pm : null;
    it.feePct = feePct;
    it.accessory = TKRules.accessoryOf(it.title, marketFor);
    it.vsWorking = it.total != null && it.refPrice > 0 && !it.lot && !it.accessory && !TKRules.tooFarToCompare(it.total, it.refPrice) ? it.total / it.refPrice : null;
    it.vsParts = forLens !== "use" && it.total != null && pm > 0 && !it.lot ? it.total / pm : null;
    it.marginBeforeRepair = forLens === "project" && it.total != null && w > 0 && !it.lot && !it.auction ? Math.round(resaleNet(it) - it.total) : null;
  };
  // The most an auction is worth bidding, shipping included: the market price (Use); break-even after
  // fees and parts, or what broken ones sell for when there's no working price (Fix & flip).
  const bidCapFor = (it) => {
    const ship = it.shipping || 0;
    const base =
      // Fix & flip: break even at the working price after fees and parts; without one, what broken ones fetch.
      it.lens === "project" ? (it.refWorking ? resaleNet(it) - (it.partsCost || 0) : it.refParts)
      : it.refWorking;
    return base != null ? Math.max(0, Math.floor(base - ship)) : null;
  };

  // ---------- remembered scores ----------
  // A listing judged under the same lens, wants, search and prices isn't sent to the model again for a day.
  const SCORE_TTL_MS = 24 * 60 * 60 * 1000;
  const scoreKey = (ctx, it) => `${ctx}|${keyOf(it.url)}|${it.total ?? it.priceText}`;

  // ---------- scores kept with the listing ----------
  // Every score (a scan, an analysis, a photo check) is saved under the listing's key, per lens, so it
  // is still there after a reload, in another tab, and on the listing's own page. A saved score is
  // only brought back while the price is the one it was judged at.
  const SCAN_DAYS = 60;
  const SCAN_MAX = 3000;
  const SNAP = ["lens", "browse", "score", "verdict", "related", "flags", "reason", "fault", "difficulty", "partsCost", "query", "est", "sold", "margin", "bidCap", "vsWorking", "refWorking", "refIsEstimate", "refRough", "shipOut", "cheapWhy", "baseScore", "baseVerdict", "photoAdjust", "photos", "scoredRef"];
  const priceOf = (it) => it.total ?? it.price ?? null;
  // Which model made a score: a scan's is the scan model, an analysis's the main one.
  const modelNow = (kind = "scan") => (kind === "scan" ? cfg.scanModel : cfg.provider === "ollama" ? cfg.textModel : cfg.provider === "openai" ? cfg.oaiModel : cfg.anthropicModel) || "";
  let scansCache = null; // key -> { lens -> snapshot }, as last read from storage
  const pendingScans = new Map();
  let scanSaveTimer = 0;
  const rememberScan = (it, kind = "scan", summary) => {
    if (!alive() || it.score == null) return;
    const key = keyOf(it.url);
    const snap = { kind, at: Date.now(), m: modelNow(kind), p: priceOf(it), pp: it.price ?? null, t: (it.title || "").slice(0, 120) };
    for (const f of SNAP) if (it[f] !== undefined) snap[f] = it[f];
    snap.lens ||= lens;
    if (summary) snap.reason = summary;
    it.scannedAt = snap.at;
    it.scannedWith = snap.m;
    it.scannedKind = kind;
    pendingScans.set(`${key}|${snap.lens}`, [key, snap]);
    clearTimeout(scanSaveTimer);
    scanSaveTimer = setTimeout(flushScans, 1000); // soon: opening the listing right after a scan must find it (leaving or hiding the tab saves at once)
  };
  const flushScans = async () => {
    if (!pendingScans.size || !alive()) return;
    const batch = [...pendingScans.values()];
    pendingScans.clear();
    // Several tabs may write at once: scansCache follows the other tabs' writes through the change events
    // (below), so this merges into it without reading the whole store again, and prunes only past the cap.
    const scans = (scansCache ||= (await chrome.storage.local.get("scans")).scans || {});
    for (const [key, snap] of batch) (scans[key] = { ...(scans[key] || {}) })[snap.lens] = snap;
    if (Object.keys(scans).length > SCAN_MAX * 1.1) {
      const cutoff = Date.now() - SCAN_DAYS * 864e5;
      const newest = (r) => Math.max(0, ...Object.values(r).map((s) => s.at || 0));
      scansCache = Object.fromEntries(Object.entries(scans).filter(([, r]) => newest(r) > cutoff).sort((a, b) => newest(a[1]) - newest(b[1])).slice(-SCAN_MAX));
    }
    await chrome.storage.local.set({ scans: scansCache }).catch(storeFailed);
  };
  window.addEventListener("pagehide", () => flushScans(), until);
  // Switching to a tab you just opened (a listing from the results, say) hides this one: save first.
  document.addEventListener("visibilitychange", () => document.hidden && flushScans(), until);
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
      // The same price, or the same asking price: a listing analyzed on its own page often has its shipping
      // there and not on the card, and a full analysis mustn't be redone (and charged) by a page scan.
      if (!s || (s.p !== priceOf(it) && !(s.pp != null && s.pp === it.price))) continue;
      Object.assign(it, Object.fromEntries(SNAP.filter((f) => s[f] !== undefined).map((f) => [f, s[f]])), { scannedAt: s.at, scannedWith: s.m, scannedKind: s.kind, restored: true });
      if (lastMarket) followMarket(it, lastMarket); // compared with today's typical price, not the one it was scored at
      scored.set(key, it);
      seen.add(key);
      const f = facts.get(key);
      if (f?.titleCode) f.codeOk = it.verdict !== "suspicious";
      if (f?.offSite) f.offSiteOk = it.verdict !== "suspicious";
      n++;
    }
    return n;
  };
  chrome.storage.onChanged.addListener((changes) => {
    if (!alive() || !changes.scans) return;
    scansCache = changes.scans.newValue || {};
    for (const [key, snap] of pendingScans.values()) (scansCache[key] = { ...(scansCache[key] || {}) })[snap.lens] = snap; // not saved yet here
    if (TK.pageType() === "item") renderItemInfo();
  });
  loadScans().catch(() => {});

  // Point a listing's comparisons at a reference price: the model's estimate (browsing) or a real
  // sold median. Recomputes % of price, flip margin and the auction bid cap; no model call.
  // A score kept from earlier (remembered for 60 days, or from before this search's sold prices were looked up
  // again) is compared with the typical price as it is now: the price word, "too cheap" and the price gap move
  // with the market, and the hover card says when the price the score was given at has moved (scoredRef).
  // Not for a listing priced from its own search (browsing: it.sold, it.est), which keeps its own reference.
  const followMarket = (it, market) => {
    if (it.browse || it.sold || it.est || !(market?.median > 0)) return;
    priceNotes(it, market, it.lens || lens, it.feePct ?? cfg.feePct);
    it.refIsEstimate = false;
    it.margin = it.marginBeforeRepair != null && it.related ? it.marginBeforeRepair - (it.partsCost || 0) : null;
    it.bidCap = it.auction && it.related ? bidCapFor(it) : null;
  };

  const useReference = (it, ref, isEstimate) => {
    it.refWorking = ref > 0 ? ref : null;
    it.refPrice = null; // compared with the reference as it is
    it.refIsEstimate = isEstimate;
    it.vsWorking = it.refWorking && it.total != null && !it.lot && !TKRules.tooFarToCompare(it.total, it.refWorking) ? it.total / it.refWorking : null;
    it.margin =
      it.lens === "project" && it.refWorking && it.total != null && !it.lot && !it.auction && it.related
        ? Math.round(resaleNet(it) - it.total - (it.partsCost || 0))
        : it.margin;
    it.bidCap = it.auction && it.related ? bidCapFor(it) : null;
  };

  const CHEAP_WHY = ["flaw", "missing parts", "different model", "quick sale"];
  const applyResult = (it, r, forLens) => {
    Object.assign(it, {
      lens: forLens,
      score: fitScore(VERDICT[r.verdict] ? r.verdict : "fair", r.score),
      verdict: VERDICT[r.verdict] ? r.verdict : "fair",
      related: r.related !== false,
      flags: (r.flags || []).slice(0, 4),
      reason: r.reason,
      fault: r.fault || "",
      difficulty: Math.max(0, Math.min(5, r.difficulty | 0)),
      partsCost: Math.max(0, r.partsCost | 0),
      cheapWhy: CHEAP_WHY.includes(r.cheapWhy) ? r.cheapWhy : "", // why the model says a low price is low (priceVerdict)
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
    it.scoredRef = !it.refIsEstimate ? (it.refPrice ?? it.refWorking ?? null) : null; // the typical price it was scored against
    const f = facts.get(keyOf(it.url));
    if (f?.titleCode) f.codeOk = it.verdict !== "suspicious"; // the model judged the code a real model number
    if (f?.offSite) f.offSiteOk = it.verdict !== "suspicious"; // and read the web address or number in context
    if (f && !it.related) (f.related = false), (f.vsSold = vsSoldOf(f)); // something else: not "too cheap" for the search
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

  // The listing links only change when the page adds, removes or re-points elements. A watcher counts those
  // changes, so the checks on the timer below (and the links read here) skip a long feed that hasn't changed:
  // reading every link each second was most of what an idle tab with 2,000 cards cost. Our own tags going on
  // don't count; one coming off does (Facebook dropping it when it recycles a card).
  let pageVersion = 0;
  let keysMemo = null;
  const ours = (n) => n.nodeType === 1 && (n.classList.contains("tirekick-sticker") || n.classList.contains("tirekick-marks") || n.id === "tirekick-styles");
  new MutationObserver((recs) => {
    if (recs.some((r) => r.type === "attributes" || r.removedNodes.length || [...r.addedNodes].some((n) => !ours(n)))) (pageVersion++, (keysMemo = null));
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["href"] });
  const currentKeys = () => {
    if (keysMemo) return new Set(keysMemo);
    const sel = TK.listingLinks();
    const keys = new Set();
    document.querySelectorAll(sel).forEach((a) => keys.add(keyOf(a.href)));
    keysMemo = keys;
    return new Set(keys);
  };

  let lastDeals = 0;
  const setIf = (el, prop, value) => el[prop] !== value && (el[prop] = value);
  const refreshPending = () => {
    updateFold();
    showIdeasBtn();
    freeRow.hidden = scanning || TK.pageType() !== "results" || !queryEl.value.trim() || TKRules.broadQuery(queryEl.value) || (!!lastMarket && marketFor === queryEl.value.trim().toLowerCase());
    if (scanning || TK.pageType() !== "results") return;
    let n = 0;
    if (seen.size) currentKeys().forEach((k) => !seen.has(k) && n++);
    // What a press would cost (Claude only): the listings it would send, at what scoring has cost
    // you per listing with this model. Ones judged the same way before come back free, so it's a ceiling.
    const changed = inputsChanged();
    const toScore = [...facts.entries()].filter(([k, f]) => (changed || !seen.has(k)) && !f.hidden && !f.filtered && !f.campaign).length;
    const est = cfg.provider !== "ollama" && cfg.scanRate > 0 ? toScore * cfg.scanRate : 0;
    const label = changed ? "Rescan with your changes" : n ? `Scan ${n} new listing${n > 1 ? "s" : ""}` : seen.size ? "Scan again" : toScore ? `Scan ${toScore} listing${toScore > 1 ? "s" : ""}` : "Scan this page";
    // This runs every two seconds: only touch what changed (each change makes the browser restyle the panel).
    const costText = est && (changed || n || !seen.size) ? ` ${est < 0.01 ? "under 1\u00a2" : `about $${est.toFixed(2)}`}` : "";
    if (scanBtn.dataset.shown !== label + costText) {
      scanBtn.dataset.shown = label + costText;
      scanBtn.replaceChildren(label, costText ? h("span", { class: "cost" }, costText) : "");
    }
    // Nothing new to score: the button stays, but steps back so the results lead.
    setIf(scanBtn, "className", label === "Scan again" ? "ghost" : "scan");
    setIf(scanBtn, "title", est ? "Estimated from what scoring has cost per listing with this model. Listings already judged this way come back free." : "");
    autoTick(n, toScore, changed);
    if (autoOn() && autoHold && autoHold !== "stopped") {
      // Automatic scanning hit a problem (a key, the budget, the connection): say so on the closed tab too.
      setIf(countEl, "textContent", "!");
      setIf(countEl, "title", `Automatic scanning stopped: ${autoHold}`);
      countEl.classList.add("new");
      countEl.hidden = false;
      resetBtn.hidden = !seen.size;
      return;
    }
    // The tab's badge, most useful first: listings at your price, then new ones to scan, then scored.
    const deals = dealCount();
    countEl.classList.toggle("deal", deals > 0);
    countEl.classList.toggle("new", !deals && n > 0);
    setIf(countEl, "title", deals ? `${deals} at your price` : n ? `${n} not scanned yet` : "");
    if (deals) {
      // A new listing at your price: the badge pops once.
      if (deals > lastDeals) {
        countEl.classList.remove("pop");
        void countEl.offsetWidth;
        countEl.classList.add("pop");
      }
      setIf(countEl, "textContent", `\u2605${deals}`);
      countEl.hidden = false;
    } else if (n) {
      setIf(countEl, "textContent", `+${n}`);
      countEl.hidden = false;
    } else setCount(scored.size);
    lastDeals = deals;
    resetBtn.hidden = !seen.size;
  };

  // One line about the page: what's new, cheaper, flagged, hidden. Plus the skipped-listings control.
  const renderPageInfo = () => {
    if (TK.pageType() !== "results" || !facts.size) return (pageInfo.hidden = true);
    const all = [...facts.values()];
    const n = (fn) => all.filter(fn).length;
    const newN = n((f) => f.isNew);
    const dropN = n((f) => f.drop);
    // Scams and warnings counted the way the tags show them: a scored listing by its shown verdict (a price
    // the check calls bait counts), an unscored one by its free read ("Likely scam", "Check first").
    const warnOf = (f) => {
      if (f.hidden) return "";
      const it = f.url && scored.get(keyOf(f.url));
      if (it?.score != null) return shownV(it, f).v === "suspicious" || likelyScam(f) ? "scam" : f.sellerWarn || f.dup ? "careful" : "";
      const word = TKRules.freeRead(f, marketOf(f))?.word;
      return word === "Likely scam" ? "scam" : word === "Check first" ? "careful" : "";
    };
    const warns = all.map(warnOf);
    const warnN = warns.filter((w) => w === "careful").length;
    const hidN = n((f) => f.hidden);
    const filN = n((f) => f.filtered && !f.hidden);
    // After a scan, say what it found in plain words.
    const done = pageItems().filter((it) => it.score != null && !isHidden(it));
    const worthN = done.filter((it) => (shownV(it).v === "great" || shownV(it).v === "good") && it.related !== false && !likelyScam(facts.get(keyOf(it.url)))).length;
    piHead.hidden = !done.length;
    piHead.textContent = !done.length ? "" : worthN ? `${worthN} worth a look` : "Nothing here is a bargain";
    // How the done listings split, best to worst: one segment per verdict, as wide as its count.
    const split = ["great", "good", "fair", "pass", "suspicious"].map((v) => [v, done.filter((it) => shownV(it).v === v).length]).filter(([, c]) => c);
    const splitSig = split.join();
    if (piBar.dataset.sig !== splitSig) {
      piBar.dataset.sig = splitSig;
      piBar.replaceChildren(...split.map(([v, c]) => {
        const seg = h("i", { "data-v": v, title: `${c} ${VERDICT[v].label.toLowerCase()}` });
        seg.style.flexGrow = String(c);
        return seg;
      }));
      piBar.setAttribute("aria-label", split.map(([v, c]) => `${c} ${VERDICT[v].label.toLowerCase()}`).join(", "));
    }
    piBar.hidden = !done.length;
    const scamN = warns.filter((w) => w === "scam").length;
    const bits = [`<b>${all.length}</b> listings`];
    if (scamN) bits.push(`<b>${scamN}</b> possible scam${scamN === 1 ? "" : "s"}`);
    const dealN = dealCount();
    if (dealN) bits.push(`<b>${dealN}</b> at your price`);
    if (newN) bits.push(`<b>${newN}</b> new to you`);
    if (dropN) bits.push(`<b>${dropN}</b> cheaper than before`);
    if (warnN) bits.push(`<b>${warnN}</b> to be careful with`);
    piLine.innerHTML = bits.join(", "); // numbers and fixed words only
    if (hidN || filN) {
      piLine.append(
        `, ${[hidN && `${hidN} not interested`, filN && `${filN} filtered`].filter(Boolean).join(", ")} `,
        h("button", { onclick: () => setShowHidden(!showHidden) }, showHidden ? "Hide them again" : `Show ${hidN + filN === 1 ? "it" : "them"}`)
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
            h("a", { href: otherSiteUrl(q), target: "_blank", rel: "noopener" }, `Try on ${otherSite().name} \u2197`),
          ]
        : []),
      resetBtn
    );
    root.querySelectorAll("[data-skip]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.skip === skipMode)));
    pageInfo.hidden = false;
  };
  const setShowHidden = (on) => {
    showHidden = on;
    document.documentElement.toggleAttribute("data-tk-showhidden", on);
    redecorateAll();
  };
  // The filter bar: each search keeps its own, so a saved search comes back filtered the same way.
  const qf = $(".qf");
  const qfWords = $(".qf-words");
  const qfMin = $(".qf-min");
  const qfMax = $(".qf-max");
  const qfDeal = $(".qf-dealin");
  const quickKey = () => `${TK.currentSite()}|${(pageSearch() || location.pathname).toLowerCase()}`;
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
    qfDeal.placeholder = hint ? `~$${hint}` : "$";
    qfDeal.title = hint ? `Your price for this search. 70% of the typical price (from eBay sales) would be $${hint}.` : "Your price for this search: listings at or under it are marked, and counted on the tab.";
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
    const n = [quick.words.trim(), quick.min, quick.max, quick.deal].filter(Boolean).length;
    qfToggle.textContent = n ? `Filter (${n})` : "Filter";
    qfToggle.classList.toggle("on", n > 0);
  };
  qfToggle.addEventListener("click", () => {
    qfOpen = !qfOpen;
    syncFilterToggle();
    if (qfOpen) qfWords.focus();
  });
  // Done filtering: Enter in a field, or Esc, folds the box away (the button keeps the count); Esc doesn't close the panel.
  qf.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" && !(e.key === "Enter" && e.target.matches("input"))) return;
    e.preventDefault();
    e.stopPropagation();
    qfOpen = false;
    syncFilterToggle();
    qfToggle.focus();
  });
  onLensShown = () => showQuick();
  const loadQuick = async () => {
    const { quickFilters = {} } = await chrome.storage.local.get("quickFilters");
    // A feed with no search (the Marketplace home page) starts with off-topic posts hidden; turning it
    // off is remembered like any other filter (saved as junk:false).
    const stored = quickFilters[quickKey()] || (!pageSearch() && TK.pageType() === "results" ? { junk: true } : {});
    quick = { ...NO_QUICK, ...stored, ...(stored.projects && !stored.broken && { broken: "only" }) }; // older "Projects only"
    delete quick.projects;
    qfOpen = false;
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
      const keep = quickActive() || value.deal || (!pageSearch() && !value.junk); // a feed's "off-topic shown" choice is kept too
      await writeStored("quickFilters", { set: { [key]: keep ? value : null }, cap: { max: 200, by: "a" } }).catch(() => {});
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
    setPref("sort", sortMode); // each mode keeps its own
    render();
  });
  root.querySelectorAll("[data-skip]").forEach((b) =>
    b.addEventListener("click", () => {
      skipMode = b.dataset.skip;
      document.documentElement.dataset.tkSkip = wrap.dataset.skipmode = skipMode;
      setPref("skip", skipMode);
      render();
      renderPageInfo();
    })
  );
  // Settings changed in another tab or the options page: filters and seller rules apply straight away.
  chrome.storage.onChanged.addListener((changes) => {
    if (!alive()) return;
    if (["filterWords", "minSellerRatings", "minSellerPct", "autoMarks"].some((k) => changes[k])) loadPrefs().then(redecorateAll);
    if (changes.feePct) showFee();
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
  // ---------- automatic scanning ----------
  // With the switch on, a search page you're looking at is scored as its listings load: once when it
  // opens, then each time scrolling brings more. It waits until the page has stopped loading listings
  // (two checks two seconds apart agree), never while you're typing in the panel, never in a background
  // tab, and not after a problem or a Stop on this page until you press Scan yourself.
  const autoRow = $(".autoscan");
  const autoIn = $(".auto-in");
  let autoHold = ""; // why it stopped on this page; a Scan you press, or a new page, clears it
  let autoSig = null;
  const autoSkip = new Set(); // listings the model passed over: offered again by Scan, not retried automatically
  const autoOn = () => !!cfg.autoScan;
  autoIn.addEventListener("change", async () => {
    const on = autoIn.checked;
    cfg.autoScan = on;
    autoHold = "";
    if (alive()) await chrome.storage.local.set({ autoScan: on }).catch(storeFailed);
    if (!on) setStatus("Automatic scanning is off: press Scan when you want scores.");
    else if (cfg.monthlyBudget > 0 || cfg.provider === "ollama")
      setStatus(`Scanning automatically: new listings are scored as they load${cfg.provider === "ollama" ? " (free with Ollama)" : `, up to your $${cfg.monthlyBudget} monthly budget`}.`);
    else
      setStatus("Scanning automatically: new listings are scored as they load. There's no monthly budget to stop it.", false, {
        label: "Set a $5 monthly budget",
        fn: () => chrome.storage.local.set({ monthlyBudget: 5 }).then(() => setStatus("Monthly budget: $5. Change it in settings.")).catch(storeFailed),
      });
    refreshPending();
  });
  const autoTick = (n, toScore, changed) => {
    setIf(autoIn, "checked", autoOn());
    autoRow.hidden = scanBtn.hidden || !!modelMissing;
    const typing = root.activeElement && $(".inputs").contains(root.activeElement);
    if (autoSkip.size && seen.size) n = [...currentKeys()].filter((k) => !seen.has(k) && !autoSkip.has(k)).length;
    const due = autoOn() && !autoHold && !modelMissing && !changed && !typing && !document.hidden && (seen.size ? n : toScore) > 0;
    if (!due) return void (autoSig = null);
    const sig = `${seen.size}|${n}|${toScore}`;
    if (autoSig !== sig) return void (autoSig = sig); // listings may still be loading: look again next time
    autoSig = null;
    scan({ auto: true });
  };

  const scan = async (opts) => {
    const auto = opts?.auto === true; // a click passes its event: that's you
    if (!auto) autoHold = "";
    if (scanning) {
      if (scanEpoch === pageEpoch) return;
      // A scan from a page you've left is still going: stop it, then start this page's.
      stopAll();
      while (scanning) await sleep(100);
    }
    bump("scans");
    scansSoFar++;
    justSwitched = false;
    showModeHint();
    scanning = true;
    const epoch = (scanEpoch = pageEpoch);
    // Messages from this scan only while you're still on its page.
    const setStatus = (...a) => epoch === pageEpoch && setStatusNow(...a);
    setBusy(true);
    scanBtn.disabled = true;

    try {
      const settings = await send("getSettings");
      editingInputs = false;
      editingQ = false;
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
      const fresh0 = TK.extract().filter((it) => !seen.has(keyOf(it.url)));
      const left = fresh0.filter((it) => !notInterested[keyOf(it.url)] && !facts.get(keyOf(it.url))?.filtered);
      const leftOut = fresh0.length - left.length;
      const items = left.map((it) => Object.assign(it, facts.get(keyOf(it.url)) ? { isNew: facts.get(keyOf(it.url)).isNew, drop: facts.get(keyOf(it.url)).drop } : {}));
      left.forEach((it) => skipped.delete(keyOf(it.url)));
      skipped.forEach((k) => seen.add(k));
      if (!items.length && !scored.size && !leftOut && TK.saysNoResults()) {
        setStatus(`${TK.site().name} found no listings for this search, so there's nothing to score. Try fewer or broader words.`);
        return;
      }
      if (!items.length) {
        setStatus(
          scored.size || leftOut
            ? `Nothing new to score${leftOut ? ` (${leftOut} hidden by you or your filters)` : ""}. Scroll down to load more listings.`
            : "No listings found on this page. Scroll so results load. If they're there, the site's layout may have changed (README: When it breaks).",
          !scored.size,
          !scored.size && !leftOut ? { label: "Check this page", fn: checkPage } : null
        );
        return;
      }
      items.forEach((it) => seen.add(keyOf(it.url)));

      const query = queryEl.value.trim();
      const want = wantEl.value.trim();
      const forLens = lens;
      // No search, or only a category's name: interests guide, and prices are the model's estimates.
      const browse = query && !TKRules.broadQuery(query) ? "" : TK.browseContext();
      items.forEach((it) => (it.browse = !!browse));
      const market = await getMarket(settings, query, forLens);
      if (stopRequested) {
        items.forEach((it) => seen.delete(keyOf(it.url)));
        return setStatus("Stopped before anything went to the model.");
      }
      if (market?.median > 0 && epoch === pageEpoch) applyMarket(market); // every card, scored or not
      items.forEach((it) => priceNotes(it, market, forLens, settings.feePct));
      // The free scam signs the model is told (background.js scamNotes): a reused photo, a bait price, the seller.
      // The bait share comes from the card's own facts, as its chip does: not for a broken one, a game or a case,
      // and against the pickup price on a local site.
      items.forEach((it) => {
        const f = facts.get(keyOf(it.url));
        it.photoTwins = f?.photoTwins || 0;
        it.sellerWarn = f?.sellerWarn || "";
        it.cheapPct = (f?.vsSold != null && TKRules.tooCheap(f, marketOf(f))?.pct) || 0;
      });

      // Anything already judged in this exact setting comes back from memory, free.
      const model = settings.scanModel; // scans can use their own, cheaper model
      const ctx = hash([forLens, want, query, browse, model, market?.median, market?.parts?.median].join("|"));
      const { scoreCache = {} } = await chrome.storage.local.get("scoreCache");
      const fresh = {};
      let fromMemory = 0;
      for (const it of items) {
        const hit = scoreCache[scoreKey(ctx, it)];
        if (hit && Date.now() - hit.at < SCORE_TTL_MS) {
          applyResult(it, hit.r, forLens);
          rememberScan(it);
          session.set(keyOf(it.url), it); // before decorating: decorate() looks the listing up here
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
        scams++;
      }
      if ((fromMemory || scams) && scored === session) {
        decorateAll(items.filter((it) => it.score != null).map((it) => [keyOf(it.url), it.el]));
        render();
      }
      const toRank = items.filter((it) => it.score == null);
      let cost = 0;

      const size = Math.max(1, settings.batchSize | 0);
      const batches = [];
      for (let i = 0; i < toRank.length; i += size) batches.push(toRank.slice(i, i + size));
      // Online services handle a few requests at once; a model on your own computer is fastest one at a time.
      const parallel = settings.provider === "ollama" || (settings.provider === "openai" && /localhost|127\.0\.0\.1/.test(settings.oaiUrl)) ? 1 : 3;
      let done = fromMemory + scams;
      showProgress(done, items.length);
      setStatus(`Ranking ${items.length} listing${items.length > 1 ? "s" : ""} with ${nameOf(model)}…`);
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
        }
        decorateAll(res.items.map((r) => byId.get(r.id)).filter(Boolean).map((it) => [keyOf(it.url), it.el])); // measured together, then tagged
        done += batch.length;
        showProgress(done, items.length);
        render();
        if (done < items.length) setStatus(`Ranked ${done} of ${items.length} listings with ${nameOf(model)}…`);
      });

      if (Object.keys(fresh).length) {
        // Keep the memory bounded: drop expired entries, keep the newest 1500.
        const kept = Object.entries(scoreCache).filter(([, v]) => Date.now() - v.at < SCORE_TTL_MS).slice(-(1500 - Object.keys(fresh).length));
        await chrome.storage.local.set({ scoreCache: Object.fromEntries([...kept, ...Object.entries(fresh)]) }).catch(storeFailed); // the scores still show; they just aren't kept
      }
      if (scored !== session) return; // you've moved on to another page
      // Anything not scored (failed batch, or the model skipped it) is offered again next scan.
      const missed = items.filter((it) => it.score == null);
      missed.forEach((it) => (seen.delete(keyOf(it.url)), autoSkip.add(keyOf(it.url))));
      if (errors.length) autoHold = errors[0].message; // some requests failed: don't keep trying on its own
      setCount(scored.size);
      const costNote = toRank.length && cost > 0 ? ` Cost ${fmtCost(cost)}.` : "";
      if (stopRequested) {
        autoHold = "stopped";
        return setStatus(`Stopped. Ranked ${items.length - missed.length} of ${items.length}; the other ${missed.length} are offered again.${costNote}`);
      }
      if (errors.length && missed.length === items.length) throw errors[0];
      setStatus(
        `${missed.length ? `Ranked ${items.length - missed.length} of ${items.length} new listings` : `Scored ${items.length} new listing${items.length === 1 ? "" : "s"}`}${fromMemory ? ` (${fromMemory} from memory)` : ""}.${scams ? ` ${scams} reposted scam${scams > 1 ? "s" : ""} marked without the model.` : ""}${leftOut ? ` Skipped ${leftOut} you've hidden or filtered out.` : ""}${costNote}` +
          (errors.length ? ` Some requests failed (${errors[0].message}) Scan again to retry the rest.` : "") +
          (!errors.length && missed.length ? " The model skipped some; scan again, or try a smaller batch size in settings." : ""),
        errors.length > 0
      );
    } catch (e) {
      if (isStop(e)) setStatus("Stopped.");
      else setStatus(e.message, true);
      autoHold = isStop(e) ? "stopped" : e.message || "an error";
    } finally {
      scanning = false;
      showProgress(null);
      setBusy(false);
      scanBtn.disabled = false;
      refreshPending();
      renderPageInfo(); // the skipped-listings control appears once something is scored
      if (!auto) requestAnimationFrame(showResults); // an automatic scan never moves what you're reading
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

  // The sold-price half of a scan on its own: one eBay lookup, every card gets "$53 under sold", without the model.
  const pricesOnly = async () => {
    if (TK.pageType() === "item" && !queryEl.value.trim() && itemFacts?.title) queryEl.value = TK.titleToQuery(itemFacts.title);
    const query = queryEl.value.trim();
    if (!query || scanning) return;
    bump("soldLookups");
    freeRow.hidden = true;
    setBusy(true);
    try {
      const settings = await send("getSettings");
      if (!settings.useSoldComps) return setStatus("Comparing with eBay sales is turned off in settings (On the page).", true);
      const market = await getMarket(settings, query, "use");
      if (!market?.median) return setStatus(market ? "Not enough working ones sold to compare with." : "");
      applyMarket(market);
      if (TK.pageType() === "item") return setStatus(`From ${market.n} eBay sales of \u201c${query}\u201d. Free: your AI wasn't used.`);
      const n = [...facts.values()].filter((f) => f.vsSold != null).length;
      setStatus(`Compared ${n} listing${n === 1 ? "" : "s"} with ${market.n} eBay sales of \u201c${query}\u201d. Free: your AI wasn't used. Sort by \u201cfurthest below typical price\u201d to see the cheapest for what they are.`);
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
  let itemTries = 0;
  const itemPass = async () => {
    if (retired) return;
    if (TK.pageType() !== "item") return;
    await Promise.all([memoryReady, prefsReady]);
    const listing = TK.extractItem();
    if (TK.pageType() !== "item") return;
    if (!listing.title) {
      // Not rendered yet (Facebook can take a while): look again shortly, for up to about 15 seconds of the
      // page being on screen. A page loaded ahead of time (eBay prerenders listings) or in a background tab
      // keeps waiting until you're looking at it.
      const waiting = document.prerendering || document.hidden;
      if (waiting || itemTries++ < 30) setTimeout(itemPass, waiting ? 2000 : 500);
      return;
    }
    itemTries = 0;
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
      listedDays: listing.listedDays ?? null,
      firstSeen: before?.f || null,
    };
    itemFacts.vsSold = vsSoldOf(itemFacts);
    if (saved[key]) await notePrices([{ url: listing.url, price: listing.price }]);
    renderItemInfo();
    // Its main photo, against the photos of other listings you've seen (sites with photoTwins).
    if (photoSite() && itemFacts.imageUrl && TKShared.isListingImage(itemFacts.imageUrl) && !photoAsked.has(key)) {
      photoAsked.add(key);
      const rec = photoSeen[key];
      const ok = rec?.h && rec.f === TKRules.photoFile(itemFacts.imageUrl) ? true : (await hashPhotos([[key, itemFacts.imageUrl, listing.title]])).length > 0;
      const n = ok ? TKRules.photoTwins(key, photoSeen).length : 0;
      if (n && itemFacts?.key === key) {
        itemFacts.photoTwins = n;
        renderItemInfo();
      }
    }
    // Sold prices already looked up for these words (in the last few hours) apply here for free too.
    if (!lastMarket && !cacheTried) {
      cacheTried = true;
      const m = await cachedMarket(queryEl.value);
      if (m && !lastMarket && itemFacts?.key === key) {
        renderMarket(m);
        applyMarket(m);
      }
    }
  };
  // The same photo on other listings, in words, with what to do about it.
  const photoTwinsText = (n) => `The same photo is on ${n} other listing${n > 1 ? "s" : ""} you've seen, under other titles: a stolen or stock photo. Ask the seller for a photo with today's date.`;
  // Certain scam signs on a listing page, in words; "" when there are none.
  const scamWarning = (f) =>
    f.campaign
      ? `This title has been posted under other codes too (${f.campaign.join(", ")}): one fake listing copied many times.`
      : f.offSite?.sure
        ? `It asks you to get in touch outside ${(TKSites.get(f.site) || TKSites.get("facebook")).owner} (${f.offSite.why.join("; ")}). That's how these scams take payment.`
        : "";
  // "3 weeks ago", from a number of days (approximate, like the sites' own).
  const agoText = (d) => (d < 1 ? "today" : d < 2 ? "yesterday" : d < 14 ? `${Math.round(d)} days ago` : d < 60 ? `about ${Math.round(d / 7)} weeks ago` : d < 365 ? `about ${Math.round(d / 30)} months ago` : "over a year ago");
  // "Down $30 (−18%) since you saved it on Oct 3" or up, said plainly.
  const savedChange = (p0, p, at) => {
    const d = Math.round((p - p0) * 100) / 100;
    const pct = Math.round((Math.abs(d) / p0) * 100);
    return `${d < 0 ? "Down" : "Up"} ${dollars(Math.abs(d))}${pct ? ` (${d < 0 ? "−" : "+"}${pct}%)` : ""} since you saved it on ${shortDate(at)} at ${dollars(p0)}.`;
  };
  // How ready the seller looks to take less (TKRules.softSeller), from what's known about a listing page.
  const softFor = (f) => {
    const days = f.listedDays ?? (f.firstSeen ? (Date.now() - f.firstSeen) / 864e5 : null);
    const prices = [...(f.history || []).map(([p]) => p), f.price].filter((p) => p != null);
    const drops = prices.filter((p, i) => i && TKRules.isDrop(prices[i - 1], p)).length;
    return TKRules.softSeller({ drops, days: days != null && days >= 1 ? Math.round(days) : null, motivated: f.motivated, bestOffer: !!f.bestOffer });
  };
  // The offer plan from sold prices (TKRules.offerPlan) for a listing, or null.
  const planFor = (f, market, soft = "none") =>
    (market = pickupOf(market, f)) ? TKRules.offerPlan({ price: f.price, shipping: f.total != null && f.price != null ? f.total - f.price : 0, auction: f.auction, lot: f.lot, project: f.project, foreign: f.foreign, priceRange: f.priceRange, soft }, market) : null;
  // A message to the seller you can edit, a pick of kinds, Copy, and "They said $…" for the seller's answer,
  // which says whether to take it, meet in the middle or make a last offer (TKRules.counterOffer) and
  // rewrites the message to match. Nothing is typed into the site or sent.
  const messageArea = (messages, plan, f) => {
    const ctx = { local: !!TKSites.get(f.site)?.local, bestOffer: !!f.bestOffer, site: f.site };
    const button = !!messages[0]?.button;
    const box = button ? h("div", { class: "msg-preview" }, messages[0].text) : h("textarea", { class: "msg-edit", rows: "3", "aria-label": "Message to the seller" });
    if (!button) box.value = messages[0]?.text || "";
    const setText = (t) => (button ? (box.textContent = t) : ((box.value = t), (copy.textContent = "Copy message")));
    const copy = h("button", {
      onclick: async () => {
        try {
          await navigator.clipboard.writeText(box.value);
          copy.textContent = "Copied";
        } catch {
          copy.textContent = "Couldn't copy";
        }
      },
    }, "Copy message");
    // The kinds of message as one row of choices (Friendly, Direct, With a reason), like Buyer and Reseller.
    const pick = messages.length > 1
      ? h(
          "div",
          { class: "seg msg-kind", role: "radiogroup", "aria-label": "Kind of message" },
          messages.map((m, i) =>
            h("button", {
              role: "radio", "aria-checked": String(i === 0), "data-kind": m.id,
              onclick: (e) => {
                pick.querySelectorAll("button").forEach((b) => b.setAttribute("aria-checked", String(b === e.currentTarget)));
                setText(m.text);
              },
            }, m.label)
          )
        )
      : null;
    const answer = h("div", { class: "meta said-answer", "aria-live": "polite" });
    const said = h("input", {
      type: "number", min: "1", step: "1", inputmode: "numeric", class: "said", "aria-label": "The seller's price, in dollars",
      oninput: () => {
        const c = TKRules.counterOffer(plan, said.value);
        if (!c) return answer.replaceChildren();
        const head = c.action === "accept" ? `Take it at ${dollars(c.amount)}` : c.action === "counter" ? `Counter at ${dollars(c.amount)}` : `Offer ${dollars(c.amount)} once, then walk away`;
        answer.replaceChildren(h("b", {}, head), `: ${c.why}.`);
        setText(TKRules.counterMessage(c, ctx));
      },
    });
    return [pick, box, button ? null : h("div", { class: "actions offer-acts" }, copy), h("label", { class: "said-row" }, "They said $", said), answer];
  };
  // An opening offer under half the asking price still shows, with a word on what to expect (2026-10-15).
  const lowballNote = (open, ask) => (open > 0 && ask > 0 && open < ask * 0.5 ? h("div", { class: "meta lowball" }, "Much lower than asking; the seller may not reply.") : null);
  // The offer helper: an opening offer and a walk-away price from the sold prices (TKRules.offerPlan),
  // with the messages above.
  const offerBox = (f, soft) => {
    const plan = planFor(f, lastMarket, soft);
    if (!plan) return "";
    const rough = plan.confidence === "rough" ? " A rough guide: few sales, or a wide spread." : "";
    if (plan.cheap) return h("div", { class: "offer" }, `Priced well: ${plan.reasons[0]}. Offering much less may lose it.${rough}`);
    const messages = TKRules.offerMessages(plan.open, { local: !!TKSites.get(f.site)?.local, bestOffer: !!f.bestOffer, site: f.site });
    return h(
      "div",
      { class: "offer" },
      "Offer ",
      h("b", {}, dollars(plan.open)),
      plan.walkAway > plan.open ? [", walk away above ", h("b", {}, dollars(plan.walkAway))] : null,
      h("div", { class: "meta" }, `From recent eBay sales; your AI isn't used: ${plan.reasons.join("; ")}.${rough}`),
      lowballNote(plan.open, f.total ?? f.price),
      messageArea(messages, plan, f)
    );
  };
  const renderItemInfo = () => {
    const f = itemFacts;
    if (!f || TK.pageType() !== "item") return;
    // An earlier scan read the description too: its verdict answers "Contact outside the site?".
    if (f.offSite && !f.offSite.sure && f.offSiteOk == null) {
      const seen = storedScan(f.key, lens);
      if (seen) f.offSiteOk = seen.verdict !== "suspicious";
    }
    // After an analysis its own line says how far under or over sold it is; the chip would say it twice.
    const chips = chipsFor(f).filter(([, t]) => !(itemEl.childElementCount && TKRules.SOLD_CHIP.test(t)) && !(t === f.motivated && softFor(f).level !== "none")).map(([k, t]) => h("span", { class: `fchip k-${k}` }, chipText(t)));
    const when = f.openedBefore ? `You opened this before, on ${shortDate(f.openedBefore)}` : f.seenBefore ? `It was in your results on ${shortDate(f.seenBefore)}` : "";
    const scam = scamWarning(f);
    // Every price you've seen it at: "$70 (Sep 30) → $60 (Oct 5) → $55 now".
    const history =
      f.history.length && f.price != null
        ? `Price history: ${f.history.map(([p, t]) => `${dollars(p)} (${shortDate(t)})`).join(" \u2192 ")} \u2192 ${dollars(f.price)} now.`
        : "";
    const sv = saved[f.key];
    // How long it's been up (the page's own date, or since you first saw it), and whether the seller may haggle.
    const soft = softFor(f);
    const age = f.listedDays != null ? `Listed ${agoText(f.listedDays)}.` : "";
    const softLine = soft.level !== "none" ? `${soft.level === "likely" ? "The seller looks ready to take less" : "The seller may take less"}: ${soft.why.join(", ")}.` : "";
    // An offer worked out from sold prices, before (and without) any analysis.
    // No sold prices yet: one free lookup (eBay sold listings, no AI) gets you the offer, without an analysis.
    const offer = itemEl.childElementCount
      ? ""
      : offerBox(f, soft.level) ||
        (!lastMarket && f.price > 0
          ? h("div", { class: "offer offer-ask" }, "Want an offer to send? ", h("button", { class: "ghost", "data-act": "offer-prices", onclick: () => pricesOnly() }, "Work one out from the typical price ", h("span", { class: "cost" }, "free")))
          : "");
    // What an earlier scan or analysis (in a search, another tab, or here) made of this listing.
    const past = storedScan(f.key, lens);
    const pastLine = past && !itemEl.childElementCount
      ? h("div", { class: "past", title: past.m ? `Judged with ${nameOf(past.m)}` : null },
          h("div", { "data-v": past.verdict }, h("span", { class: "verdict" }, VERDICT[past.verdict]?.label || past.verdict), ` ${past.score} out of 100, ${shortDate(past.at)}${past.p != null && f.price != null && past.p !== priceOf(f) ? ` (the price was ${dollars(past.p)} then)` : ""}`),
          past.reason ? h("p", { class: "past-why" }, past.reason) : null)
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
      f.photoTwins ? h("div", {}, photoTwinsText(f.photoTwins)) : "",
      when || f.drop ? h("div", {}, `${when || "Seen before"}${f.drop ? `; it was ${dollars(f.drop.from)} then` : ""}.`) : "",
      history ? h("div", {}, history) : "",
      history ? h("div", { class: "spark" }, TKShared.spark([...f.history.map(([p, t]) => ({ v: p, t })), { v: f.price, t: Date.now() }], { label: history })) : "",
      sv?.p0 != null && f.price != null && f.price !== sv.p0 ? h("div", {}, savedChange(sv.p0, f.price, sv.a0)) : "",
      age || softLine ? h("div", {}, [age, softLine].filter(Boolean).join(" ")) : "",
      chips.length ? h("div", { class: "chips" }, chips) : "",
      offer,
      slot ? "" : acts
    );
    piSearch.replaceChildren();
    listBar.hidden = true;
    // With the actions under the result, there may be nothing left to say here: no empty gap.
    pageInfo.hidden = !piLine.textContent.trim() && !piLine.querySelector("button, a");
  };

  const renderItem = (listing, r, market) => {
    const v = shownV({ ...listing, verdict: r.verdict, score: clamp100(r.score | 0), cheapWhy: CHEAP_WHY.includes(r.cheapWhy) ? r.cheapWhy : "" }, {}, { deep: true });
    const score = v.score;
    const vs =
      (listing.vsWorking != null ? `, ${TKRules.vsText(listing.total, listing.refWorking, { rough: listing.refRough, long: true })} (${dollars(Math.round(listing.refWorking))})` : "") +
      (listing.vsParts != null ? `, ${TKRules.vsText(listing.total, listing.refParts, { long: true }).replace("the typical price", "typical for parts")}` : "");
    const rep = r.repair;
    const margin = listing.marginBeforeRepair != null ? listing.marginBeforeRepair - (rep?.partsCost || 0) : null;
    const photoBox = h("div");
    (r.photos || []).forEach((p, i) => photoBox.append(h("div", { class: p.adjust < 0 ? "photo drop" : "photo" }, photoText(p, `Photo ${i + 1}: `))));
    const parts = [
      h(
        "div",
        { class: "row" },
        tagEl(v.v, score),
        h(
          "div",
          {},
          h("div", { class: "title", "data-v": v.v }, h("span", { class: "verdict" }, v.label), ` ${score} out of 100`),
          h("div", { class: "meta" }, `${priceStr(listing)}${vs}`),
          v.why ? h("div", { class: "meta pricewhy" }, `${v.why} The analysis said ${VERDICT[r.verdict]?.label || r.verdict}.`) : null,
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
          r.offerHigh > 0 ? ["Suggested max bid: ", h("b", {}, offerRange(r))] : listing.bidCap > 0 ? ["Worth bidding up to about ", h("b", {}, dollars(listing.bidCap))] : "The price will rise."
        )
      );
    } else if (r.offerHigh > 0) {
      // Messages opening at the low end of the range; "They said" answers from the range too.
      const messages = TKRules.offerMessages(r.offerLow, { local: !!TKSites.get(listing.site)?.local, bestOffer: !!listing.bestOffer, site: listing.site });
      parts.push(
        h(
          "div",
          { class: "offer" },
          `${listing.bestOffer ? "Accepts offers. " : ""}Suggested offer: `,
          h("b", {}, offerRange(r)),
          listing.offerPlan ? h("div", { class: "meta" }, `Kept near the plan from the typical price (open at ${dollars(listing.offerPlan.open)}, walk away above ${dollars(listing.offerPlan.walkAway)}).`) : null,
          lowballNote(r.offerLow, listing.total ?? listing.price),
          messageArea(messages, { open: r.offerLow, walkAway: r.offerHigh }, listing)
        )
      );
    }
    if (listing.lot && listing.total != null) parts.push(h("div", { class: "meta" }, `Lot of ${listing.lot}: about ${dollars(Math.round((listing.total / listing.lot) * 100) / 100)} each.`));
    if (margin != null) {
      parts.push(
        h("div", { class: "offer" }, "Price gap after fees: ", h("b", {}, `\u2248 ${money(margin)}`), ` after eBay fees${rep?.partsCost ? ` and ~$${rep.partsCost} parts` : ""}, at the typical price.`)
      );
    }
    if (rep && (rep.faults?.length || rep.notes)) {
      const kv = (label, list) => (list?.length ? h("div", {}, h("strong", {}, `${label}: `), list.join(", ")) : null);
      parts.push(
        h(
          "div",
          { class: "sect" },
          h("strong", {}, `${DIFFICULTY[rep.difficulty] || DIFFICULTY[0]}${rep.difficulty ? ` (${rep.difficulty}/5)` : ""}${rep.partsCost ? `, ~$${rep.partsCost} parts` : ""}`),
          rep.faults?.length ? h("ol", {}, rep.faults.slice(0, 4).map((f) => h("li", {}, f))) : null,
          kv("Parts", rep.parts),
          kv("Tools", rep.tools),
          rep.notes ? h("div", { class: "meta" }, rep.notes) : null
        )
      );
    }
    if (listing.imageUrls?.length) {
      const n = Math.min(3, listing.imageUrls.length);
      const btn = h("button", { onclick: () => checkPhotos(listing, r, market, photoBox, btn), title: `Have the AI look at ${n > 1 ? `the first ${n} photos` : "the photo"} (can change the score)` }, `${r.photos ? "Re-check" : "Check"} photo${n > 1 ? "s" : ""}`);
      const lensLink = h("a", { href: lensSearchUrl(listing.imageUrls[0]), target: "_blank", rel: "noopener", title: "Reverse image search: is the main photo used elsewhere?" }, "Find photo elsewhere \u2197");
      // The photo pair sits right under the verdict, the same two, in the same order, as on the panel's rows.
      parts.splice(1, 0, h("div", { class: "sect photo-acts" }, h("div", { class: "actions" }, btn, lensLink), photoBox));
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
      const listing = TK.extractItem();
      if (!listing.title) {
        setStatus("Couldn't read this listing. Let it finish loading and try again, or the layout may have changed (README: When it breaks).", true, { label: "Check this page", fn: checkPage });
        return;
      }
      if (!queryEl.value.trim()) queryEl.value = TK.titleToQuery(listing.title);
      const query = queryEl.value.trim();
      const forLens = lens;
      const market = await getMarket(settings, query, forLens);
      priceNotes(listing, market, forLens, settings.feePct);
      if (itemFacts?.photoTwins) listing.photoTwins = itemFacts.photoTwins;
      listing.sellerWarn = itemFacts?.sellerWarn || sellerWarning(listing);
      // What the card's checks know about it (broken, a word of the search missing), so the bait share sent to the
      // model and the price check after it judge the listing as its card does.
      listing.project = itemFacts?.project ?? clueOf(PROJECT, `${listing.title} ${listing.condition || ""} ${listing.details || ""}`);
      listing.offWords = TKRules.missingWord(listing.title, query);
      listing.cheapPct = (listing.vsWorking != null && TKRules.tooCheap(listing, pickupOf(market, listing))?.pct) || 0;
      // The free offer plan goes to the model, and its range is kept near it (TKRules.fitOffer).
      const plan = !listing.auction ? planFor(listing, market, itemFacts ? softFor(itemFacts).level : "none") : null;
      listing.offerPlan = plan && !plan.cheap ? { open: plan.open, walkAway: plan.walkAway, confidence: plan.confidence } : null;
      setStatus(`Analyzing this listing as ${MODES[forLens].as}…`);
      const r = await sendAI("analyzeListing", { listing, query, market, lens: forLens, want: wantEl.value.trim() });
      if (!VERDICT[r.verdict]) r.verdict = "fair";
      r.score = fitScore(r.verdict, r.score); // the number agrees with the word
      if (!listing.auction) [r.offerLow, r.offerHigh] = TKRules.fitOffer(r.offerLow, r.offerHigh, listing.offerPlan);
      // Certain scam signs (see scamWarning) overrule whatever the model made of the listing.
      if (itemFacts?.key === keyOf(location.href)) {
        itemFacts.offSite = listing.offSite; // the description may have loaded since the first look
        // A web address or number read in context (a charity link, a store's own site) isn't a question any more.
        if (itemFacts.offSite && !itemFacts.offSite.sure) itemFacts.offSiteOk = r.verdict !== "suspicious";
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
      analyzeBtn.replaceChildren("Analyze again", settings.provider === "anthropic" && r.cost ? h("span", { class: "cost" }, ` last one ${fmtCost(r.cost)}`) : "");
      editingInputs = false;
      editingQ = false;
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
      const host = h("div", { id: "tirekick-toast" });
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
      </style><div class="wrap" data-page-theme="${wrap.dataset.pageTheme || ""}"${themePref ? ` data-theme="${themePref}"` : ""}><img alt=""><div><b>Photo check</b><span class="txt"></span></div><button aria-label="Close">\u00d7</button></div>`;
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
      const title = TK.pageType() === "item" ? TK.extractItem().title : "";
      const p = await sendAI("checkPhoto", { imageUrl: TK.bigImage(imageUrl), title });
      // If this photo belongs to a listing we've scored, the check counts toward its rating.
      const big = TK.bigImage(imageUrl);
      const hit = [...scored.values()].find((it) => it.imageUrl && TK.bigImage(it.imageUrl) === big);
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
    if (msg?.type === "tirekick-check-photo" && msg.imageUrl) checkPhotoFromMenu(msg.imageUrl);
  });

  // ---------- search ideas ----------

  const KIND = { idea: "Idea", narrow: "Narrow", broaden: "Broaden", typo: "Misspelling", alt: "Alt name", price: "Price cap" };

  // Other ways to search for this: misspellings sellers make, other model names, tighter or looser
  // words. Shown right under the search's actions; each one runs the search or saves it.
  const ideasBox = $(".ideas-inline");
  const saveIdea = async (idea, btn) => {
    const k = searchKey(idea.query);
    savedSearches = await writeStored("savedSearches", { add: { [k]: { site: TK.currentSite(), q: idea.query, url: TK.searchUrl(idea), a0: Date.now(), v: 0, n: 0, fresh: 0 } } });
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
        if (!titles.length && TK.pageType() === "results") titles = TK.extract().filter((it) => !TKRules.offTopic(it)).map((it) => it.title);
        titles = titles.slice(0, 30);
      }
      const ideas = await sendAI("suggestSearches", {
        site: TK.currentSite(),
        query: queryEl.value.trim(),
        intent: want,
        lens,
        titles,
        market: want ? null : lastMarket,
      });
      if (!ideas.length) throw new Error("No new searches this time. Try saying more about what you want.");
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
            h("a", { href: TK.searchUrl(idea), title: `${idea.why}${extra ? ` (${extra})` : ""}` }, idea.query),
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
  // With no search yet (eBay's front page, the Marketplace feed) ideas start one, from what you want or what's
  // in the feed; on a search they're other ways to search it.
  const noSearch = () => TK.pageType() === "home" || (TK.pageType() === "results" && !queryEl.value.trim());
  const showIdeasBtn = () => {
    const type = TK.pageType();
    ideasBtn.hidden = !(type === "home" || type === "results");
    setIf(ideasBtn, "textContent", "Search ideas"); // one name everywhere (2026-10-15)
    setIf(ideasBtn, "title", noSearch() ? "Searches from what you want, or from what's in this feed (uses the AI)" : "Other ways to search for this: misspellings sellers make, other model names, tighter or looser words (uses the AI)");
  };
  queryEl.addEventListener("input", showIdeasBtn);
  wantEl.addEventListener("keydown", (e) => e.key === "Enter" && noSearch() && getIdeas());

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
  window.addEventListener("tirekick-toggle", toggleOpen, until); // toolbar icon, if you use it
  const sync = () => {
    if (location.href === lastHref) return;
    if (lastType === "results") saveScan(lastHref);
    lastHref = location.href;
    pageEpoch++; // work still running for the page you left finishes quietly (see scan)
    applyWant();
    autoHold = "";
    autoSig = null;
    autoSkip.clear();
    const type = (lastType = TK.pageType());
    const onResults = !!type;
    if (onResults && !host.isConnected) document.documentElement.append(host);
    if (!onResults && host.isConnected) host.remove();
    if (onResults) {
      scanBtn.hidden = type !== "results";
      analyzeBtn.hidden = type !== "item";
      qwrap.hidden = type === "home";
      showIdeasBtn();
      ideasBox.hidden = true;
      wrap.dataset.page = type;
      // Nothing to scan here (eBay's home page, other pages): the overview, with no "This page" tab.
      const nothingHere = type === "other" || type === "home";
      $('[role="tab"][data-view="page"]').hidden = nothingHere;
      setView(nothingHere ? "home" : "page");
      applyIntro();
      ideasList.replaceChildren();
      ideasStatus.textContent = "";
      lastMarket = null;
      cacheTried = false;
      scanInputs = null;
      restoreOff = false;
      editingInputs = false;
      editingQ = false;
      freeRow.hidden = true;
      analyzeBtn.textContent = "Analyze this listing";
      analyzeBtn.className = "scan";
      clearStickers();
      facts = new Map();
      passKeys = new Set();
      passEls = new Map();
      pageHadKnown = null;
      pageInfo.hidden = true;
      itemEl.replaceChildren();
      listEl.replaceChildren();
      marketEl.textContent = "";
      setCount(0);
      setStatus("");
      if (type !== "results" || !restoreScan(lastHref)) queryEl.value = TK.detectQuery();
      if (type === "results") quickReady = loadQuick();
      showBrowseNote();
      updateFold();
      itemTries = 0;
      if (type === "item") setTimeout(itemPass, 1200); // let the listing finish rendering
    }
  };

  // One timer for everything that has to notice page changes: navigation, newly loaded
  // listings, and Facebook dropping our stickers when it recycles cards.
  let ticks = 0;
  const ranAt = { fb: -1, pass: -1, health: -1, href: "" }; // the pageVersion each check last ran at
  const tick = () => {
    if (!alive()) return retire();
    sync();
    if (document.hidden) return;
    if (ranAt.href !== location.href) (ranAt.href = location.href), pageVersion++; // a new page: everything runs again
    syncPageTheme(); // the page's own light or dark (cheap: it only writes when that changes)
    if (ranAt.fb !== pageVersion) (ranAt.fb = pageVersion), reapplyFacebook();
    if (!scanning && !passing && ranAt.pass !== pageVersion) (ranAt.pass = pageVersion), pagePass(); // cheap when nothing changed: compares the listing links only
    if (ticks % 3 === 0 && ranAt.health !== pageVersion) (ranAt.health = pageVersion), checkHealth().catch(() => {});
    if (++ticks % 2 === 0) refreshPending();
  };
  const timer = setInterval(tick, 1000);
  // A page loaded ahead of time (eBay prerenders the listings you're likely to open) or brought back from the
  // back-forward cache: read it again as soon as it's the page you're looking at, instead of waiting for a reload.
  const wake = (fresh) => {
    if (!alive()) return retire();
    if (fresh) (lastHref = ""), (lastType = null);
    sync();
    pagePass(true);
    if (TK.pageType() === "item" && itemFacts?.key !== keyOf(location.href)) itemPass();
  };
  document.addEventListener("prerenderingchange", () => wake(true), until);
  window.addEventListener("pageshow", (e) => e.persisted && wake(false), until);
  document.addEventListener("visibilitychange", () => !document.hidden && wake(false), until);
  // After an update this copy can't reach the extension any more: get out of the way so the new one can load.
  const teardown = () => {
    retired = true;
    clearInterval(timer);
    clearTimeout(photoTimer);
    clearTimeout(photoSaveTimer);
    photoObserver?.disconnect();
    life.abort();
    try {
      clearStickers(); // the card tags too, so a page left open after an update isn't left with stale ones
    } catch {}
    host.remove();
    toastRoot?.host.remove();
    window.removeEventListener("tirekick-toggle", toggleOpen);
    window.__tirekickPanel = false;
  };
  sync();
})();
