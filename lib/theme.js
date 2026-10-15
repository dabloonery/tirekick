// The look, in one place: colors for both themes, the type, the tread mark and the verdict glyphs.
// The on-page panel, the tags on listing cards and the settings page all read from here, so a color
// or shape changes once. No page access and no network.
//
// Token names are the ones the CSS already uses (--paper, --ink, --v-great ...); add new ones here
// first, then use them. Every text pair was measured: 4.5:1 or better, control borders 3:1 or better.

(() => {
  const T = (self.TKTheme ||= {});

  const NAVY = "#1A2B4C";
  const ORANGE = "#FF8F3A";
  T.NAVY = NAVY;
  T.ORANGE = ORANGE;

  // dot-*: the score dot's fill. v-*: the verdict as text on the panel. good-/warn-/new-: chip fill and text.
  // Dark is a quiet slate navy (dabloonery: "the navy can be more subtle", 0.40.0) with an orange main button and bright
  // verdict colors: color is a cue, so it stays. Light keeps the same hues, calmer, with navy buttons.
  T.palette = {
    dark: {
      "color-scheme": "dark",
      paper: "#1C2433", "paper-2": "#161D29", raise: "#232D3F", ink: "#EDF0F5", "on-ink": "#1C2433", muted: "#A8B1C2", rule: "#2D3749", line: "#7B869A",
      accent: ORANGE, "on-accent": NAVY, btn: ORANGE, "on-btn": NAVY, danger: "#FF8A80",
      "v-great": "#5FE39A", "v-good": "#C3EA6E", "v-fair": "#FFE16B", "v-pass": "#A9B5CB", "v-suspicious": "#FF8A80", "on-v": NAVY,
      "dot-great": "#3BDB7E", "dot-good": "#B6E35A", "dot-fair": "#FFE04A", "dot-pass": "#7D8BA6", "dot-suspicious": "#FF6A5E",
      "good-bg": "#3BDB7E", "good-fg": NAVY, "warn-bg": "#FF8A80", "warn-fg": NAVY, "new-bg": ORANGE, "new-fg": NAVY,
      shadow: "0 0 0 1px rgba(255,255,255,.04), 0 18px 44px -12px rgba(5,10,25,.75)",
    },
    light: {
      "color-scheme": "light",
      paper: "#FFFFFF", "paper-2": "#F4F6F9", raise: "#FFFFFF", ink: NAVY, "on-ink": "#FFFFFF", muted: "#5B6780", rule: "#E3E8F0", line: "#7A879E",
      accent: "#B04E0E", "on-accent": "#FFFFFF", btn: NAVY, "on-btn": "#FFFFFF", danger: "#B42318",
      "v-great": "#12703C", "v-good": "#4D6B05", "v-fair": "#7D5C00", "v-pass": "#5B6780", "v-suspicious": "#B42318", "on-v": "#FFFFFF",
      "dot-great": "#7CD3A2", "dot-good": "#C2DC86", "dot-fair": "#F2D472", "dot-pass": "#AEB8C9", "dot-suspicious": "#F28B81",
      "good-bg": "#E2F4E9", "good-fg": "#12703C", "warn-bg": "#FCE6E3", "warn-fg": "#B42318", "new-bg": "#FFEBDB", "new-fg": "#A8480B",
      shadow: "0 1px 2px rgba(26,43,76,.06), 0 18px 44px -14px rgba(26,43,76,.32)",
    },
  };

  // "--paper:#fff; --ink:...;" for one theme. prefix renames the custom properties (the card tags use --tk-*
  // for their own tokens, but keep the verdict and dot names), and pick limits which tokens are written.
  T.vars = (theme, { prefix = "--", keep = /^(v-|dot-|on-v$)/, pick } = {}) =>
    Object.entries(T.palette[theme])
      .filter(([k]) => !pick || pick.includes(k))
      .map(([k, v]) => (k === "color-scheme" ? `color-scheme:${v};` : `${keep.test(k) ? "--" : prefix}${k}:${v};`))
      .join(" ");

  // ---------- type ----------
  // One family, Bricolage Grotesque (bundled, OFL), registered twice from the same file: "TK Sans" for
  // everything you read and operate, "TK Display" for the wordmark, headings, scores and prices. The
  // display face is fixed at 85% width and at least weight 700, so the existing `font:600 ... var(--display)`
  // rules pick it up without each one setting width.
  T.FONT_FILE = "bricolage-grotesque.woff2";
  T.FONTS = [
    ["TK Sans", { weight: "200 800", stretch: "100%" }],
    ["TK Display", { weight: "700 800", stretch: "85%" }],
  ];
  T.UI = `"TK Sans", system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", Cantarell, sans-serif`;
  T.DISPLAY = `"TK Display", "Arial Narrow", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;

  // ---------- the tread ----------
  // 22 short marks around the dot, each leaning clockwise (37 degrees), like painted tread. Used as a CSS
  // mask over a conic gradient, so the marks the score earns are solid and the rest faint.
  const svg = (body, vb = 100) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vb} ${vb}">${body}</svg>`)}")`;
  T.TREAD_MARKS = 22;
  T.tread = (n = T.TREAD_MARKS, w = 3.5, len = 4.8, r = 42.3) =>
    svg(
      Array.from({ length: n }, (_, i) => {
        const y0 = 50 - r;
        return `<path d="M50 ${y0.toFixed(2)}L${(50 + len * 0.75).toFixed(2)} ${(y0 + len).toFixed(2)}" stroke="#000" stroke-width="${w}" stroke-linecap="round" transform="rotate(${((360 / n) * i).toFixed(2)} 50 50)"/>`;
      }).join("")
    );
  T.TREAD = T.tread();
  // Marks to light for a score: as many of the 22 as the score earns.
  T.lit = (score) => Math.round((Math.max(0, Math.min(100, Number(score) || 0)) / 100) * T.TREAD_MARKS);

  // ---------- verdict glyphs ----------
  // The second cue beside color: two arrows up, one up, level, down, a warning sign. Masks, so they take the text color.
  const G = {
    great: '<path d="M3 8.5l4-4 4 4M3 12.5l4-4 4 4"/>',
    good: '<path d="M3 9.5l4-4 4 4"/>',
    fair: '<path d="M3 5.5h8M3 9.5h8"/>',
    pass: '<path d="M3 5l4 4 4-4"/>',
    suspicious: '<path d="M7 2.5l5.5 9.5h-11z"/><path d="M7 6.5v2.4M7 10.6v.1"/>',
  };
  T.GLYPH = Object.fromEntries(
    Object.entries(G).map(([v, d]) => [v, svg(`<g fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</g>`, 14)])
  );

  // CSS for glyphs before a verdict word. `sel` is the word's selector; its verdict comes from the
  // nearest [data-v] (the element itself or an ancestor).
  T.glyphCss = (sel) =>
    `${sel}::before { content:""; display:inline-block; width:.85em; height:.85em; margin-right:.3em; vertical-align:-.06em; background:currentColor;
      -webkit-mask:var(--glyph) center/contain no-repeat; mask:var(--glyph) center/contain no-repeat; }
    ` +
    Object.keys(G)
      .map((v) => `[data-v="${v}"]${sel}::before, [data-v="${v}"] ${sel}::before { --glyph:${T.GLYPH[v]}; }`)
      .join("\n");

  // ---------- the score dot ----------
  // `sel` is the dot element (it holds the number in a child); it needs --lit set from T.lit(score) and a
  // [data-v] on itself or an ancestor. Fill, then tread (lit marks solid, the rest faint), then the number.
  // Skip is hollow so it recedes; Suspicious carries a navy "!" badge nothing else has.
  T.dotCss = (sel, { paper = "var(--paper)", muted = "var(--muted)" } = {}) => `
    ${sel} { --d:var(--dot-fair); --mk:color-mix(in srgb, var(--d) 60%, ${NAVY}); --lit:11; position:relative; border-radius:50%; background:var(--d); color:${NAVY}; }
    ${["great", "good", "fair", "pass", "suspicious"].map((v) => `[data-v="${v}"]${sel}, [data-v="${v}"] ${sel} { --d:var(--dot-${v}); }`).join(" ")}
    ${sel}::before { content:""; position:absolute; inset:0; border-radius:50%; pointer-events:none;
      background:conic-gradient(var(--mk) calc((var(--lit) - .5) * ${360 / 22}deg), color-mix(in srgb, var(--mk) 36%, transparent) 0);
      -webkit-mask:${T.TREAD} center/100% 100% no-repeat; mask:${T.TREAD} center/100% 100% no-repeat; }
    ${sel} > * { position:relative; }
    [data-v="pass"]${sel}, [data-v="pass"] ${sel} { --mk:var(--d); background:${paper}; box-shadow:inset 0 0 0 2px var(--d); color:${muted}; }
    [data-v="suspicious"]${sel}::after, [data-v="suspicious"] ${sel}::after { content:"!"; position:absolute; top:-3px; right:-3px; width:15px; height:15px; border-radius:50%;
      background:${NAVY}; color:#fff; box-shadow:0 0 0 2px ${paper}; font:800 11px/15px ${T.UI}; text-align:center; }
    @media (forced-colors: active) { ${sel} { background:none; border:2px solid CanvasText; } ${sel}::before { display:none; } }`;

  // ---------- the wordmark ----------
  // "tirekick" in lowercase display type, the i's dotted with brand-orange tread dots. Built from text
  // nodes (no HTML strings). `h` is the caller's element builder.
  T.wordmark = (h, cls = "wordmark") =>
    h("span", { class: cls, role: "img", "aria-label": "Tirekick" }, "t", h("span", { class: "wm-i", "aria-hidden": "true" }, "ı"), "rek", h("span", { class: "wm-i", "aria-hidden": "true" }, "ı"), "ck");
  T.wordmarkCss = (sel) => `${sel} .wm-i { position:relative; display:inline-block; }
    ${sel} .wm-i::after { content:""; position:absolute; left:50%; top:.075em; width:.19em; height:.19em; margin-left:-.095em; border-radius:50%; background:${ORANGE}; }`;

  // The settings page asks for its tokens and fonts with <script src="../lib/theme.js" data-root data-fonts="../fonts/">.
  const me = self.document?.currentScript;
  if (me && me.hasAttribute("data-root")) {
    const st = document.createElement("style");
    const fonts = me.dataset.fonts;
    st.textContent =
      (fonts ? T.FONTS.map(([fam, d]) => `@font-face { font-family:"${fam}"; src:url("${fonts}${T.FONT_FILE}") format("woff2"); font-weight:${d.weight}; font-stretch:${d.stretch}; font-display:swap; }`).join("\n") : "") +
      `
      :root { ${T.vars("dark")} --ui:${T.UI}; --display:${T.DISPLAY}; }
      @media (prefers-color-scheme: light) { :root { ${T.vars("light")} } }
      :root[data-theme="dark"] { ${T.vars("dark")} }
      :root[data-theme="light"] { ${T.vars("light")} }`;
    document.head.append(st);
  }
})();
