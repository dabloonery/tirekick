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
Deno.serve({ port: 8443, cert: Deno.readTextFileSync(Deno.env.get("E2E_TMP") + "/cert.pem"), key: Deno.readTextFileSync(Deno.env.get("E2E_TMP") + "/key.pem"), onListen(){} }, (req) => {
  const u = new URL(req.url);
  if (u.hostname === "www.facebook.com") return new Response(fbPage("Marketplace"), { headers: { "content-type": "text/html" } });
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
  if (u.pathname === "/calls") return new Response(JSON.stringify(calls), { headers: { ...cors, "content-type": "application/json" } });
  if (u.pathname === "/v1/messages") {
    if (req.headers.get("x-api-key") === "bad") return new Response(JSON.stringify({ error: { message: "invalid x-api-key" } }), { status: 401, headers: { ...cors, "content-type": "application/json" } });
    const body = await req.json(); calls.push({ model: body.model, effort: body.output_config?.effort, hasSchema: !!body.output_config?.format, cached: JSON.stringify(body.system).includes("ephemeral"), sys: (body.system || "").slice(0, 60) });
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
