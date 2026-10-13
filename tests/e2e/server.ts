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
// Facebook nests each card's link a dozen boxes inside its grid cell, and a card can link to its listing twice.
const deep = (inner: string) => "<div>".repeat(14) + inner + "</div>".repeat(14);
const fbPage = (title: string) => `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font:14px system-ui;margin:0}main{display:grid;grid-template-columns:repeat(4,200px);gap:16px;padding:20px}a{display:block;color:inherit;}a.dup{display:none}main a:not(.dup){text-decoration:none;border:1px solid #ddd;border-radius:8px;overflow:hidden}
.ph{height:140px;background:#ccc}a div{padding:2px 10px}</style></head><body><div role="main"><main>
${deep(`<a href="/marketplace/item/111/"><div class="ph"></div><div>$85</div><div>Pentax K1000 35mm film camera</div><div>Albuquerque, NM</div></a><a href="/marketplace/item/111/" class="dup" aria-hidden="true" tabindex="-1"></a>`)}
${deep(`<a href="/marketplace/item/222/"><div class="ph"></div><div>$120</div><div>Nintendo Game Boy Advance SP M2465</div><div>Albuquerque, NM</div></a>`)}
${deep(`<a href="/marketplace/item/333/"><div class="ph"></div><div>$30</div><div>Nintendo Game Boy Advance SP K7731</div><div>Rio Rancho, NM</div></a>`)}
${deep(`<a href="/marketplace/item/444/"><div class="ph"></div><div>Just listed</div><div>$140</div><div>Canon AE-1 with 50mm lens</div><div>Santa Fe, NM</div></a>`)}
${deep(`<a href="/marketplace/item/555/"><div class="ph"></div><div>$60</div><div>$75</div><div>Yashica FX-3, light seals new</div><div>Albuquerque, NM</div></a>`)}
</main></div></body></html>`;
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
  const good = [48, 52, 55, 57, 59, 61, 63, 66, 70, 74].map((p, i) => card(i, `${t} used, working ${i}`, p - 9, i < 7 ? ship : '<div class="s-card__attribute-row">Free delivery</div>'));
  return `<!doctype html><html><head><meta charset="utf-8"><title>sold | eBay</title></head><body><div class="srp-results"><ul>
${good.join("\n")}
${card(20, `${t} boxed, mint`, 140, '<div class="s-card__attribute-row">Best offer accepted</div>')}
${card(21, `Lot of 3 ${t}`, 150)}
${card(22, `${t} for parts, not working`, 18)}
${card(23, `${t} museum piece`, 900)}
${card(24, `${t.split(/\s+/)[0]} strap and cap`, 8)}
</ul></div></body></html>`;
};
const fixturePage = (name: string) => {
  const html = Deno.readTextFileSync(new URL(`tests/fixtures/${name.replace(/[^\w-]/g, "")}.html`, ROOT));
  const scripts = ["lib/shared.js", "content/rules.js", "content/adapters.js"].map((f) => `<script>${Deno.readTextFileSync(new URL(f, ROOT))}</script>`).join("");
  return new Response(html.replace(/<\/body>/i, `${scripts}</body>`), { headers: { "content-type": "text/html; charset=utf-8" } });
};
Deno.serve({ port: 8443, cert: Deno.readTextFileSync(Deno.env.get("E2E_TMP") + "/cert.pem"), key: Deno.readTextFileSync(Deno.env.get("E2E_TMP") + "/key.pem"), onListen(){} }, (req) => {
  const u = new URL(req.url);
  if (u.searchParams.has("fixture")) return fixturePage(u.searchParams.get("fixture")!);
  if (u.hostname === "www.facebook.com" && u.searchParams.has("bench")) return new Response(benchPage(+u.searchParams.get("bench")!, u.searchParams.get("churn") !== "0"), { headers: { "content-type": "text/html" } });
  if (/\.jpg$/.test(u.pathname)) return new Response(Uint8Array.from(atob("R0lGODlhAQABAAAAACw="), (x) => x.charCodeAt(0)), { headers: { "content-type": "image/gif" } });
  if (u.hostname === "www.facebook.com") return new Response(fbPage("Marketplace"), { headers: { "content-type": "text/html" } });
  // A sold search for "blockme" is refused, like eBay's browser check.
  if (u.pathname.startsWith("/sch/") && u.searchParams.get("LH_Sold") === "1" && /blockme/.test(u.searchParams.get("_nkw") || "")) return new Response("denied", { status: 403 });
  if (u.pathname.startsWith("/sch/") && u.searchParams.get("LH_Sold") === "1") return new Response(soldPage(u.searchParams.get("_nkw") || "item"), { headers: { "content-type": "text/html" } });
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
    const body = await req.json(); calls.push({ model: body.model, effort: body.output_config?.effort, fallbacks: body.fallbacks, hasSchema: !!body.output_config?.format, cached: JSON.stringify(body.system).includes("ephemeral"), sys: (body.system || "").slice(0, 60) });
    // Key "cutoff": billed, but the answer was cut off.
    if (req.headers.get("x-api-key") === "cutoff") return new Response(JSON.stringify({ model: body.model, stop_reason: "max_tokens", content: [{ type: "text", text: "{\"items\": [" }], usage: { input_tokens: 4000, output_tokens: 16000 } }), { headers: { ...cors, "content-type": "application/json" } });
    if (body.output_config?.format?.schema?.properties?.suggestions) return new Response(JSON.stringify({ model: body.model, stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ suggestions: [
      { query: "pentax k1000 body only", kind: "narrow", why: "Drops lens kits that raise the price", maxPrice: 0, newest: false },
      { query: "pentax k 1000", kind: "typo", why: "Sellers often split the model number", maxPrice: 0, newest: true },
      { query: "pentax km", kind: "alt", why: "Near-identical later model", maxPrice: 120, newest: false }] }) }], usage: { input_tokens: 300, output_tokens: 100 } }), { headers: { ...cors, "content-type": "application/json" } });
    if (body.output_config?.format?.schema?.properties?.summary) return new Response(JSON.stringify({ model: body.model, stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ score: 64, verdict: "good", summary: "Mock summary of the camera.", flags: ["clear photos"], questions: ["Does the meter work?", "Any fungus in the lens?", "Light seals new?"], offerLow: 230, offerHigh: 260, homebrew: "" }) }], usage: { input_tokens: 1500, output_tokens: 400 } }), { headers: { ...cors, "content-type": "application/json" } });
    const user = typeof body.messages[0].content === "string" ? body.messages[0].content : "";
    const ids = [...user.matchAll(/^id (\d+) \|/gm)].map((m) => +m[1]);
    const items = ids.map((id) => ({ id, related: true, score: [88, 60, 30, 5, 38, 76][id - 1] ?? 50, verdict: ["great","fair","pass","suspicious","pass","good"][id - 1] ?? "fair", flags: [], reason: "Mock reason for listing " + id }));
    return new Response(JSON.stringify({ model: body.model, stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ items }) }], usage: { input_tokens: 2000, output_tokens: 500 } }), { headers: { ...cors, "content-type": "application/json" } });
  }
  return new Response("nf", { status: 404, headers: cors });
});
await new Promise(() => {});
