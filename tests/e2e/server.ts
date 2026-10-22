const page = (title: string) => `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font:14px system-ui,sans-serif;margin:0;background:#fff;color:#222}
ul{list-style:none;margin:0;padding:20px 24px;display:grid;grid-template-columns:repeat(4,200px);gap:18px}
.s-card{position:relative;border:1px solid #e5e5e5;border-radius:8px;padding:10px}
.s-card img{width:100%;height:130px;object-fit:cover;background:#ddd;display:block}
.s-card__title{margin:8px 0 4px}.s-card__price{font-weight:700}</style></head><body>
<h1 style="padding:0 24px">${title}</h1>
<ul>
 <li class="s-card"><img alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACw="><div class="s-card__title">Pentax K1000 35mm SLR body, working</div><div class="s-card__price">$85.00</div><span>+$12.00 delivery</span><a href="https://www.ebay.com/itm/1111111111">item</a></li>
 <li class="s-card"><img alt=""><div class="s-card__title">Pentax K1000 with 50mm f/2 lens and case</div><div class="s-card__price">$140.00</div><span>Free delivery</span><a href="https://www.ebay.com/itm/2222222222">item</a></li>
 <li class="s-card"><img alt=""><div class="s-card__title">Pentax K1000 for parts, shutter stuck</div><div class="s-card__price">$35.00</div><a href="https://www.ebay.com/itm/3333333333">item</a></li>
 <li class="s-card"><img alt=""><div class="s-card__title">Pentax K1000 PRISTINE contact me www . cam . com</div><div class="s-card__price">$20.00</div><a href="https://www.ebay.com/itm/4444444444">item</a></li>
 <li class="s-card"><img alt=""><div class="s-card__title">Pentax K1000 body only, untested</div><div class="s-card__price">$60.00</div><span>3 bids · 2d 4h left</span><a href="https://www.ebay.com/itm/5555555555">item</a></li>
 <li class="s-card"><img alt=""><div class="s-card__title">Pentax K1000 + 28mm lens, tested, great</div><div class="s-card__price">$110.00</div><span>or Best Offer</span><span>99.5% positive (1.2K)</span><a href="https://www.ebay.com/itm/6666666666">item</a></li>
</ul></body></html>`;
// ?real: a search the way buyers meet it (real.ts): "nintendo switch oled", typical about $250, with what turns up
// beside the consoles: a game, a case, a bait price, a contact-me-off-site post, a for-parts one, an auction, a lot,
// a new seller and one over the typical price. REAL holds each card and what a model plausibly answers for it,
// including the answers the panel has to correct (a "great" on an overpriced one, a "great" on the bait).
export const REAL: [string, string, string, { score: number; verdict: string; related?: boolean; reason: string }][] = [
  ["Nintendo Switch OLED Model White Console HEG-001 Complete in Box", "$239.00", "<span>Free delivery</span><span>99.8% positive (4.1K)</span>", { score: 70, verdict: "good", reason: "Complete in box at about the typical price, from a well-rated seller." }],
  ["Nintendo Switch OLED Neon Joy-Con, barely used", "$199.00", "<span>+$12.00 delivery</span>", { score: 72, verdict: "good", reason: "A little under typical with shipping, lightly used." }],
  ["Nintendo Switch OLED 64GB White - NEW SEALED", "$329.00", "<span>Free delivery</span><span>100% positive (812)</span>", { score: 82, verdict: "great", reason: "New and sealed, a premium over used ones." }],
  ["Nintendo Switch OLED console - fast shipping", "$89.00", "<span>Free delivery</span>", { score: 91, verdict: "great", reason: "Very low price for an OLED console." }],
  ["Mario Kart 8 Deluxe - Nintendo Switch", "$38.00", "<span>+$4.99 delivery</span>", { score: 66, verdict: "good", related: false, reason: "A game, not a console; fair price for it." }],
  ["Nintendo Switch OLED carrying case", "$15.00", "<span>Free delivery</span>", { score: 50, verdict: "fair", related: false, reason: "A case, not the console." }],
  ["Nintendo Switch OLED white text me 505 555 0123 on WhatsApp", "$150.00", "", { score: 4, verdict: "suspicious", reason: "Asks to move to WhatsApp: a common scam." }],
  ["Nintendo Switch OLED for parts, no power", "$95.00", "<span>+$10.00 delivery</span>", { score: 35, verdict: "pass", reason: "Doesn't power on; for parts only." }],
  ["Nintendo Switch OLED Mario Red Edition", "$160.00", "<span>5 bids · 1d 3h left</span><span>+$15.00 delivery</span>", { score: 55, verdict: "fair", reason: "Auction; the bid will rise." }],
  ["Lot of 2 Nintendo Switch OLED consoles", "$420.00", "<span>Free delivery</span>", { score: 62, verdict: "good", reason: "Two consoles at about $210 each." }],
  ["Nintendo Switch OLED white + 3 games + case", "$265.00", "<span>Free delivery</span>", { score: 74, verdict: "good", reason: "Bundle with games for a little over typical." }],
  ["Nintendo Switch OLED Splatoon 3 Edition", "$185.00", "<span>+$15.00 delivery</span><span>100% positive (3)</span>", { score: 68, verdict: "good", reason: "Good price for a special edition; seller has few ratings." }],
  ["Switch OLED console only (no dock), tested", "$160.00", "<span>Free delivery</span>", { score: 64, verdict: "good", reason: "No dock, but well under typical." }],
  ["Nintendo Switch OLED", "$120.00", "<span>Free delivery</span>", { score: 50, verdict: "fair", reason: "Low price, few details." }],
];
const realPage = () => page("nintendo switch oled").replace(/<ul>[\s\S]*<\/ul>/, `<ul>
${REAL.map(([t, pr, extra], i) => ` <li class="s-card"><img alt=""><div class="s-card__title">${t}</div><div class="s-card__price">${pr}</div>${extra}<a href="https://www.ebay.com/itm/90000000${String(i).padStart(2, "0")}">item</a></li>`).join("\n")}
</ul>`);
// Facebook nests each card's link a dozen boxes inside its grid cell, and a card can link to its listing twice.
const deep = (inner: string) => "<div>".repeat(14) + inner + "</div>".repeat(14);
// ?dark: laid out like Marketplace in dark mode (a sidebar, a grid that clips at its edges, square photos), for look checks.
const FB_DARK = `body{background:#18191a;color:#e4e6eb}div[role=main]{margin-left:360px;overflow:hidden}main{grid-template-columns:repeat(4,240px);gap:8px 16px}
main a:not(.dup){border:0}.ph{height:240px;background:linear-gradient(135deg,#7a5c3c,#3d2f22)}`;
const fbPage = (title: string, dark = false) => `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font:14px system-ui;margin:0}main{display:grid;grid-template-columns:repeat(4,200px);gap:16px;padding:20px}a{display:block;color:inherit;}a.dup{display:none}main a:not(.dup){text-decoration:none;border:1px solid #ddd;border-radius:8px;overflow:hidden}
.ph{height:140px;background:#ccc}a div{padding:2px 10px}${dark ? FB_DARK : ""}</style></head><body><div role="main"><main>
${deep(`<a href="/marketplace/item/111/"><div class="ph"></div><div>$85</div><div>Pentax K1000 35mm film camera</div><div>Albuquerque, NM</div></a><a href="/marketplace/item/111/" class="dup" aria-hidden="true" tabindex="-1"></a>`)}
${deep(`<a href="/marketplace/item/222/"><div class="ph"></div><div>$120</div><div>Nintendo Game Boy Advance SP M2465</div><div>Albuquerque, NM</div></a>`)}
${deep(`<a href="/marketplace/item/333/"><div class="ph"></div><div>$30</div><div>Nintendo Game Boy Advance SP K7731</div><div>Rio Rancho, NM</div></a>`)}
${deep(`<a href="/marketplace/item/444/"><div class="ph"></div><div>Just listed</div><div>$140</div><div>Canon AE-1 with 50mm lens</div><div>Santa Fe, NM</div></a>`)}
${deep(`<a href="/marketplace/item/555/"><div class="ph"></div><div>$60</div><div>$75</div><div>Yashica FX-3, light seals new</div><div>Albuquerque, NM</div></a>`)}
</main></div></body></html>`;
// ?photos=1|2 on facebook.com: cards with real photos from a Facebook image host (scontent.test.fbcdn.net,
// mapped here), for the same-photo check. a1 and a2 are one picture uploaded twice (two files), a3 the same
// picture a little brighter, b1 another picture.
const photoCard = (id: number, photo: string, price: number, title: string) =>
  deep(`<a href="/marketplace/item/${id}/"><img alt="" style="width:100%;height:140px;object-fit:cover;display:block" src="https://scontent.test.fbcdn.net/v/t45/${photo}_n.bmp?stp=dst&_nc_cat=1"><div>$${price}</div><div>${title}</div><div>Albuquerque, NM</div></a>`);
// ?feed: the Marketplace home page, no search, with the clutter people see there among the real items.
const FEED = [["111", 85, "Pentax K1000 35mm film camera"], ["901", 1, "Looking for rental house edge of town"], ["902", 40, "\"Best Massage in Town – Feel the difference\""],
  ["444", 140, "Canon AE-1 with 50mm lens"], ["903", 700, "Room for rent near UNM"], ["904", 1, "Stolen and sold"], ["555", 60, "Yashica FX-3, light seals new"], ["905", 0, "Kittens free to good home"]];
const fbFeedPage = () => fbPage("Marketplace").replace(/<main>[\s\S]*<\/main>/, () => `<main>${FEED.map(([id, p, t]) => deep(`<a href="/marketplace/item/${id}/"><div class="ph"></div><div>${p ? `$${p}` : "Free"}</div><div>${t}</div><div>Albuquerque, NM</div></a>`)).join("\n")}</main>`);
const fbPhotosPage = (n: string) => `<!doctype html><html><head><meta charset="utf-8"><title>Marketplace</title>
<style>body{font:14px system-ui;margin:0}main{display:grid;grid-template-columns:repeat(4,200px);gap:16px;padding:20px}a{display:block;color:inherit;text-decoration:none;border:1px solid #ddd}a div{padding:2px 10px}</style></head><body><div role="main"><main>
${n === "2"
  ? photoCard(7005, "a3", 70, "Minolta X-700 with flash")
  : [photoCard(7001, "a1", 85, "Pentax K1000 35mm film camera"), photoCard(7002, "a2", 60, "Canon AE-1 Program body"), photoCard(7003, "a1", 95, "Pentax K1000 with 50mm lens"), photoCard(7004, "b1", 120, "Yashica FX-3 light seals new")].join("\n")}
</main></div></body></html>`;
// A 48×48 24-bit BMP: smooth shading from one pattern (a, a little brighter for a3) or another (b).
const bmp = (name: string) => {
  const w = 48, hgt = 48, row = w * 3, size = 54 + row * hgt;
  const buf = new Uint8Array(size), dv = new DataView(buf.buffer);
  buf[0] = 0x42; buf[1] = 0x4d; dv.setUint32(2, size, true); dv.setUint32(10, 54, true); dv.setUint32(14, 40, true);
  dv.setInt32(18, w, true); dv.setInt32(22, hgt, true); dv.setUint16(26, 1, true); dv.setUint16(28, 24, true); dv.setUint32(34, row * hgt, true);
  const lift = name === "a3" ? 12 : 0;
  for (let y = 0; y < hgt; y++) for (let x = 0; x < w; x++) {
    const v = name.startsWith("b") ? 128 + 100 * Math.cos(x / 9 - y / 4) : 120 + 100 * Math.sin(x / 6 + y / 10) + lift;
    const g = Math.max(0, Math.min(255, Math.round(v)));
    const o = 54 + (hgt - 1 - y) * row + x * 3;
    buf[o] = g; buf[o + 1] = Math.max(0, g - 30); buf[o + 2] = Math.min(255, g + 20);
  }
  return buf;
};
// ?bench=N on facebook.com: a Marketplace-sized page for performance checks (perf.ts). N cards, each nested
// fourteen boxes deep like Facebook's, more added as you scroll, and the page rewriting class names all the time.
const benchPage = (n: number, churn = true) => {
  const words = ["Nintendo", "Game Boy", "Pentax", "Canon", "camera", "console", "lens", "controller", "bundle", "working", "for parts", "untested", "M2465", "K7731"];
  const card = (i: number) => {
    const t = `${words[i % words.length]} ${words[(i * 7) % words.length]} ${words[(i * 3) % words.length]}${i % 9 === 0 ? " Q" + (1000 + i) : ""}`;
    return "<div class=\"x1 x2 x3\">".repeat(14) + `<a href="/marketplace/item/${100000 + i}/"><div class="ph"></div><div>$${20 + (i * 13) % 300}</div><div>${t}</div><div>Albuquerque, NM</div></a>` + "</div>".repeat(14);
  };
  return `<!doctype html><html><head><meta charset="utf-8"><title>Marketplace</title><style>body{font:14px system-ui;margin:0}main{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;padding:20px}a{display:block;color:inherit;text-decoration:none;border:1px solid #ddd;border-radius:8px;overflow:hidden}.ph{height:150px;background:#ccc}a div{padding:2px 10px}.x9{outline:0}</style></head>
<body><div role="main"><main id="g">${Array.from({ length: n }, (_, i) => card(i)).join("")}</main></div>
<script>
let next = ${n};
const words = ${JSON.stringify(words)};
const card = ${card.toString()};
const add = (k) => { let h = ""; for (let i = 0; i < k; i++) h += card(next++); document.getElementById("g").insertAdjacentHTML("beforeend", h); };
// infinite scroll, and Facebook-style churn: class names change all over the page several times a second
addEventListener("scroll", () => { if (innerHeight + scrollY > document.body.scrollHeight - 800) add(24); });
const all = () => document.querySelectorAll(".x1");
if (${churn}) setInterval(() => { const a = all(); for (let i = 0; i < 40; i++) a[(Math.random() * a.length) | 0].classList.toggle("x9"); }, 250);
</script></body></html>`;
};
// ?fixture=<name>: a saved page from tests/fixtures at the real address, with the plain scripts added (adapters.ts).
const ROOT = new URL("../../", import.meta.url);
// A sold search for any words, like eBay's: ten honest sales of the thing, then the ones that must not count
// (a "best offer accepted" sale showing its asking price, a lot, a for-parts one listed as used, a far-off price,
// an accessory without the model number). Ten kept: median $60, buyers paid $9 shipping on most.
const soldPage = (q: string) => {
  const t = q.replace(/[<>&"]/g, "");
  const card = (id: number, title: string, price: number, extra = "") => ` <li class="s-card"><a href="https://www.ebay.com/itm/5000000000${id}"><div class="s-card__title">${title}</div></a><div class="s-card__price">$${price}.00</div>${extra}</li>`;
  const ship = '<div class="s-card__attribute-row">+$9.00 delivery</div>';
  // A console search (real.ts) sells for about four times as much: median about $250, $12 shipping on most.
  const k = /switch/i.test(t) ? 4.2 : 1, sh = /switch/i.test(t) ? 12 : 9;
  const good = [48, 52, 55, 57, 59, 61, 63, 66, 70, 74].map((p, i) => card(i, `${t} used, working ${i}`, Math.round(p * k) - sh, i < 7 ? ship.replace("$9", "$" + sh) : '<div class="s-card__attribute-row">Free delivery</div>'));
  return `<!doctype html><html><head><meta charset="utf-8"><title>sold | eBay</title></head><body><div class="srp-results"><ul>
${good.join("\n")}
${card(20, `${t} boxed, mint`, 140, '<div class="s-card__attribute-row">Best offer accepted</div>')}
${card(21, `Lot of 3 ${t}`, 150)}
${card(22, `${t} for parts, not working`, 18)}
${card(23, `${t} museum piece`, 900)}
${card(24, `${t.split(/\s+/)[0]} strap and cap`, 8)}
</ul></div></body></html>`;
};
let photoHits = 0; // photo requests, to check they stay few
const fixturePage = (name: string) => {
  const html = Deno.readTextFileSync(new URL(`tests/fixtures/${name.replace(/[^\w-]/g, "")}.html`, ROOT));
  const scripts = ["lib/sites.js", "lib/shared.js", "content/rules.js", "content/adapters.js"].map((f) => `<script>${Deno.readTextFileSync(new URL(f, ROOT))}</script>`).join("");
  return new Response(html.replace(/<\/body>/i, () => `${scripts}</body>`), { headers: { "content-type": "text/html; charset=utf-8" } });
};
Deno.serve({ port: 8443, cert: Deno.readTextFileSync(Deno.env.get("E2E_TMP") + "/cert.pem"), key: Deno.readTextFileSync(Deno.env.get("E2E_TMP") + "/key.pem"), onListen(){} }, (req) => {
  const u = new URL(req.url);
  if (u.searchParams.has("fixture")) return fixturePage(u.searchParams.get("fixture")!);
  if (u.hostname === "www.facebook.com" && u.searchParams.has("bench")) return new Response(benchPage(+u.searchParams.get("bench")!, u.searchParams.get("churn") !== "0"), { headers: { "content-type": "text/html" } });
  if (u.hostname === "scontent.test.fbcdn.net") { photoHits++; return new Response(bmp(u.pathname.match(/\/(\w+)_n\.bmp$/)?.[1] || "a1"), { headers: { "content-type": "image/bmp" } }); }
  if (u.hostname === "www.facebook.com" && u.searchParams.has("photos")) return new Response(fbPhotosPage(u.searchParams.get("photos")!), { headers: { "content-type": "text/html" } });
  if (u.pathname === "/photo-hits") return new Response(String(photoHits));
  if (/\.jpg$/.test(u.pathname)) return new Response(Uint8Array.from(atob("R0lGODlhAQABAAAAACw="), (x) => x.charCodeAt(0)), { headers: { "content-type": "image/gif" } });
  if (u.hostname === "www.facebook.com" && u.searchParams.has("feed")) return new Response(fbFeedPage(), { headers: { "content-type": "text/html" } });
  // ?currency: the first card priced in Canadian dollars, as Marketplace shows prices to a buyer in Canada.
  if (u.hostname === "www.facebook.com" && u.searchParams.has("currency")) return new Response(fbPage("Marketplace").replace("<div>$85</div>", "<div>CA$85</div>"), { headers: { "content-type": "text/html" } });
  if (u.hostname === "www.facebook.com") return new Response(fbPage("Marketplace", u.searchParams.has("dark")), { headers: { "content-type": "text/html" } });
  // A sold search for "blockme" is refused, like eBay's browser check.
  if (u.pathname.startsWith("/sch/") && u.searchParams.get("LH_Sold") === "1" && /blockme/.test(u.searchParams.get("_nkw") || "")) return new Response("denied", { status: 403 });
  // A sold search for "nosales" finds nothing, the way eBay says so.
  if (u.pathname.startsWith("/sch/") && u.searchParams.get("LH_Sold") === "1" && /nosales/.test(u.searchParams.get("_nkw") || "")) return new Response(`<!doctype html><title>sold | eBay</title><div class="srp-results"><h3 class="srp-save-null-search__heading">No exact matches found</h3><ul></ul></div>${"<!-- page chrome -->".repeat(9000)}`, { headers: { "content-type": "text/html" } });
  if (u.pathname.startsWith("/sch/") && u.searchParams.get("LH_Sold") === "1") return new Response(soldPage(u.searchParams.get("_nkw") || "item"), { headers: { "content-type": "text/html" } });
  if (u.pathname.startsWith("/sch/") && u.searchParams.has("real")) return new Response(realPage(), { headers: { "content-type": "text/html" } });
  // ?changed: the same results after a redesign the adapter doesn't know (new card class names, links intact).
  if (u.pathname.startsWith("/sch/") && u.searchParams.has("changed")) return new Response(page("Pentax results").replaceAll("s-card", "x-tile"), { headers: { "content-type": "text/html" } });
  // ?none: a search with no results, as eBay shows it (a heading, no cards).
  if (u.pathname.startsWith("/sch/") && u.searchParams.has("none")) return new Response(page("Pentax results").replace(/<ul>[\s\S]*<\/ul>/, '<div class="srp-results"><h3 class="srp-save-null-search__heading">No exact matches found</h3><p>Try checking your spelling or use more general terms</p></div>'), { headers: { "content-type": "text/html" } });
  if (u.pathname.startsWith("/sch/")) return new Response(u.searchParams.has("empty") ? "<!doctype html><title>x</title><ul></ul>" : page("Pentax results"), { headers: { "content-type": "text/html" } });
  if (u.pathname.startsWith("/itm/")) return new Response(`<!doctype html><html><head><meta charset="utf-8"><title>Pentax K1000 | eBay</title></head><body><main>
<h1 class="x-item-title__mainTitle"><span class="ux-textspans">Pentax K1000 35mm SLR Film Camera w 50mm PK Mount</span></h1>
<div class="x-price-primary"><span class="ux-textspans">US $294.90</span></div>
<div class="x-item-condition-text"><span class="ux-textspans">Used</span></div>
<div class="ux-labels-values--shipping"><span class="ux-textspans">Shipping:</span><span class="ux-textspans">Free 2-4 day delivery</span></div>
<div class="x-sellercard-atf"><span>camerastore</span> <span>99.7% positive feedback</span></div></main></body></html>`, { headers: { "content-type": "text/html" } });
  if (u.pathname === "/") return new Response(page("eBay home"), { headers: { "content-type": "text/html" } });
  return new Response("nf", { status: 404 });
});
// Mock Claude API on a host-permitted port (LM Studio's); the extension's anthropicUrl is pointed here.
let calls: any[] = [];
Deno.serve({ port: 1234, onListen(){} }, async (req) => {
  const u = new URL(req.url);
  const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (u.pathname === "/calls" && req.method === "DELETE") { calls = []; return new Response("[]", { headers: cors }); }
  if (u.pathname === "/calls") return new Response(JSON.stringify(calls), { headers: { ...cors, "content-type": "application/json" } });
  if (u.pathname === "/v1/messages") {
    if (req.headers.get("x-api-key") === "bad") return new Response(JSON.stringify({ error: { message: "invalid x-api-key" } }), { status: 401, headers: { ...cors, "content-type": "application/json" } });
    // Key "ratelimit": 429. Key "slow": answers after 8 seconds (to see a scan under way, and Stop).
    if (req.headers.get("x-api-key") === "ratelimit") return new Response(JSON.stringify({ error: { message: "rate limited" } }), { status: 429, headers: { ...cors, "content-type": "application/json" } });
    if (req.headers.get("x-api-key") === "slow") await new Promise((r) => setTimeout(r, 8000));
    // The API's other refusals, with the bodies it really sends: out of credit (400), a key without access (403),
    // overloaded (529), a fault on its side (500), and an answer that isn't JSON at all.
    const apiErr = (status: number, type: string, message: string) => new Response(JSON.stringify({ type: "error", error: { type, message } }), { status, headers: { ...cors, "content-type": "application/json" } });
    const k = req.headers.get("x-api-key");
    if (k === "nocredit") return apiErr(400, "invalid_request_error", "Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.");
    if (k === "forbidden") return apiErr(403, "permission_error", "Your API key does not have permission to use the specified resource.");
    if (k === "overloaded") return apiErr(529, "overloaded_error", "Overloaded");
    if (k === "servererror") return apiErr(500, "api_error", "Internal server error");
    const body = await req.json(); calls.push({ model: body.model, effort: body.output_config?.effort, fallbacks: body.fallbacks, hasSchema: !!body.output_config?.format, cached: JSON.stringify(body.system).includes("ephemeral"), sys: (body.system || "").slice(0, 60), plan: /offer plan from sold prices: [^\\\n]*?\./.exec(JSON.stringify(body.messages))?.[0] || "", scam: [...JSON.stringify(body.messages).matchAll(/SCAM SIGNAL: ([^|\\]*)/g)].map((m) => m[1].trim()), bands: /60% or less is a great price/.test(JSON.stringify(body.system)),
      // Each listing line of a scan, with the scam signals it was sent (real.ts checks which ones get a bait share).
      listings: (typeof body.messages?.[0]?.content === "string" ? body.messages[0].content : "").split("\n").filter((l: string) => /^id \d+ \|/.test(l)).map((l: string) => ({ title: l.split(" | ")[2]?.trim() || "", scam: /SCAM SIGNAL: (.*)$/.exec(l)?.[1].trim() || "" })) });
    if (k === "garbage") return new Response(JSON.stringify({ model: body.model, stop_reason: "end_turn", content: [{ type: "text", text: "Sure! Here are the scores you asked for." }], usage: { input_tokens: 2000, output_tokens: 50 } }), { headers: { ...cors, "content-type": "application/json" } });
    // Key "cutoff": billed, but the answer was cut off.
    if (req.headers.get("x-api-key") === "cutoff") return new Response(JSON.stringify({ model: body.model, stop_reason: "max_tokens", content: [{ type: "text", text: "{\"items\": [" }], usage: { input_tokens: 4000, output_tokens: 16000 } }), { headers: { ...cors, "content-type": "application/json" } });
    if (body.output_config?.format?.schema?.properties?.suggestions) return new Response(JSON.stringify({ model: body.model, stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ suggestions: [
      { query: "pentax k1000 body only", kind: "narrow", why: "Drops lens kits that raise the price", maxPrice: 0, newest: false },
      { query: "pentax k 1000", kind: "typo", why: "Sellers often split the model number", maxPrice: 0, newest: true },
      { query: "pentax km", kind: "alt", why: "Near-identical later model", maxPrice: 120, newest: false }] }) }], usage: { input_tokens: 300, output_tokens: 100 } }), { headers: { ...cors, "content-type": "application/json" } });
    if (body.output_config?.format?.schema?.properties?.summary) return new Response(JSON.stringify({ model: body.model, stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ score: 64, verdict: "good", summary: "Mock summary of the camera.", flags: ["clear photos"], offerLow: 230, offerHigh: 260 }) }], usage: { input_tokens: 1500, output_tokens: 400 } }), { headers: { ...cors, "content-type": "application/json" } });
    const user = typeof body.messages[0].content === "string" ? body.messages[0].content : "";
    // The ?real search: each card's scripted answer, found by its title.
    if (/Nintendo Switch OLED/.test(user)) {
      const items = [...user.matchAll(/^id (\d+) \| [^|]*\| ([^|]*?) \|/gm)].map((m) => {
        const a = REAL.find(([t]) => t === m[2].trim())?.[3] || { score: 50, verdict: "fair", reason: "Mock." };
        return { id: +m[1], related: a.related ?? true, score: a.score, verdict: a.verdict, flags: [], reason: a.reason };
      });
      return new Response(JSON.stringify({ model: body.model, stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ items }) }], usage: { input_tokens: 2000, output_tokens: 500 } }), { headers: { ...cors, "content-type": "application/json" } });
    }
    const ids = [...user.matchAll(/^id (\d+) \|/gm)].map((m) => +m[1]);
    const items = ids.map((id) => ({ id, related: true, score: [88, 60, 30, 5, 38, 76][id - 1] ?? 50, verdict: ["great","fair","pass","suspicious","pass","good"][id - 1] ?? "fair", flags: [], reason: "Mock reason for listing " + id }));
    return new Response(JSON.stringify({ model: body.model, stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ items }) }], usage: { input_tokens: 2000, output_tokens: 500 } }), { headers: { ...cors, "content-type": "application/json" } });
  }
  return new Response("nf", { status: 404, headers: cors });
});
await new Promise(() => {});
