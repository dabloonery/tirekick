// Second Look — background service worker.
// Everything that talks to the outside world lives here:
//   1. the model: the Claude API, or your local Ollama server (ranking, analysis, ideas, photo checks)
//   2. listing photos (fetched and base64-encoded for the vision model)
//   3. eBay sold listings when you're on Facebook (on eBay the page fetches them itself)
// Content scripts send messages; this file answers them.

const DEFAULTS = {
  provider: "anthropic", // "anthropic" (Claude API) or "ollama" (local)
  anthropicKey: "",
  anthropicModel: "claude-opus-5-5",
  anthropicUrl: "https://api.anthropic.com", // only changed for testing
  ollamaUrl: "http://localhost:11434",
  textModel: "qwen3:4b",
  visionModel: "moondream",
  batchSize: 10,
  useSoldComps: true,
  lens: "use", // "use" (buy to use), "fix" (fix-up project) or "flip" (resell)
  feePct: 13.6, // eBay fees as % of the sale, for flip margins
  interests: "Electronics, older and retro tech, video games and consoles, anything with an active homebrew scene.",
  theme: "classic", // "classic" (paper and ink) or "retro" (pocket LCD)
  // Filters and seller rules: plain checks, no AI. Hidden listings are never sent to the model.
  hideWords: "replica, reproduction, repro, box only, empty box, manual only, case only, photo only, picture only",
  needWords: "",
  minSellerRatings: 10,
  minSellerPct: 97,
  autoMarks: true, // chips on cards before any scan: new to you, price drops, warnings
  monthlyBudget: 0, // dollars; 0 = no budget. Claude calls stop once this month's estimated spend reaches it
  showTab: true, // keep a slim tab on eBay/Facebook pages (needs the page script to load automatically)
};

async function getSettings() {
  const stored = await chrome.storage.local.get(DEFAULTS);
  return { ...DEFAULTS, ...stored };
}

// fetch with a deadline, so a hung server shows an error instead of spinning forever.
async function fetchWithTimeout(url, opts, ms, slowMsg) {
  try {
    return await fetch(url, { ...opts, signal: AbortSignal.timeout(ms) });
  } catch (e) {
    if (e.name === "TimeoutError") throw new Error(slowMsg);
    throw e;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Ollama ----------

async function ollamaChat({ model, messages, format, numCtx = 8192 }) {
  const { ollamaUrl } = await getSettings();
  const body = {
    model,
    messages,
    stream: false,
    keep_alive: "10m",
    options: { temperature: 0.2, num_ctx: numCtx },
  };
  if (format) body.format = format;
  // qwen3 models "think" before answering by default; that is slow and
  // wastes context on a 4 GB card, so turn it off for them only.
  if (/^qwen3/i.test(model)) body.think = false;

  let res;
  try {
    res = await fetchWithTimeout(
      `${ollamaUrl}/api/chat`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
      5 * 60 * 1000,
      `Ollama took over 5 minutes on "${model}". Lower "Listings per request" or try a smaller model.`
    );
  } catch (e) {
    if (/Ollama took/.test(e.message)) throw e;
    throw new Error(`Can't reach Ollama at ${ollamaUrl}. Is it running? (systemctl status ollama)`);
  }
  if (res.status === 403) {
    throw new Error("Ollama blocked this extension (403). Add its ID to OLLAMA_ORIGINS — see README step 3.");
  }
  if (!res.ok) {
    const text = await res.text();
    if (/not found/i.test(text)) throw new Error(`Model "${model}" isn't installed. Run: ollama pull ${model}`);
    throw new Error(`Ollama error ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.message?.content ?? "";
}

// ---------- Claude API ----------
// Plain fetch (the extension has no build step, so no SDK import). Notes for Opus 5.5:
// thinking is always on and effort defaults to medium, so we set effort low for these
// simple tasks; temperature and forced tool_choice are not accepted. Thinking tokens count
// toward max_tokens, so leave generous room (it's a ceiling, not a charge).

async function anthropicMessage({ system, content, schema, maxTokens = 16000 }) {
  const { anthropicKey, anthropicModel, anthropicUrl, monthlyBudget } = await getSettings();
  if (!anthropicKey) throw new Error("No Claude API key yet. Open the extension options and paste one in.");
  if (monthlyBudget > 0) {
    const spent = monthSpent((await chrome.storage.local.get("usage")).usage);
    if (spent >= monthlyBudget) {
      throw new Error(`This month's budget of $${monthlyBudget} is used up (about $${spent.toFixed(2)} spent). Raise it in settings, or switch to Ollama in the panel's model menu.`);
    }
  }
  const body = {
    model: anthropicModel,
    max_tokens: maxTokens,
    messages: [{ role: "user", content }],
    output_config: {},
  };
  // Effort works on Opus 4.5+, Sonnet 4.6+ and every 5-series model; Haiku 4.5, Sonnet 4.5 and older reject it.
  if (!/haiku|sonnet-4-5|claude-3/.test(anthropicModel)) body.output_config.effort = "low";
  // Server-side fallback (re-run on another model if a safety classifier declines) is for the 5-series.
  const isFiveSeries = /^claude-(opus-5|sonnet-5-5|fable-5|mythos-5)/.test(anthropicModel);
  if (isFiveSeries) body.fallbacks = "default";
  if (system) body.system = system;
  if (schema) body.output_config.format = { type: "json_schema", schema };

  const headers = {
    "Content-Type": "application/json",
    "x-api-key": anthropicKey,
    "anthropic-version": "2023-06-01",
    "anthropic-dangerous-direct-browser-access": "true",
  };
  if (isFiveSeries) headers["anthropic-beta"] = "server-side-fallback-2026-07-01";

  // Rate limits (429), overload (529) and server errors are worth two quiet retries.
  let res;
  for (let attempt = 0; ; attempt++) {
    try {
      res = await fetchWithTimeout(
        `${anthropicUrl}/v1/messages`,
        { method: "POST", headers, body: JSON.stringify(body) },
        3 * 60 * 1000,
        "The Claude API took over 3 minutes. Try again, or lower \"Listings per request\"."
      );
    } catch (e) {
      if (/took over/.test(e.message)) throw e;
      throw new Error("Can't reach the Claude API. Check your internet connection.");
    }
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= 2) break;
    const after = Number(res.headers.get("retry-after"));
    await sleep(Math.min(20, after > 0 ? after : 2 * 2 ** attempt) * 1000);
  }
  if (res.status === 401) throw new Error("The Claude API key was rejected. Check it in the extension options.");
  if (res.status === 429) throw new Error("Claude API rate limit hit. Wait a moment and scan again.");
  if (res.status === 529) throw new Error("The Claude API is overloaded right now. Try again in a minute.");
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 404 && /model/i.test(text)) throw new Error(`Claude doesn't recognise the model "${anthropicModel}". Check it in the extension options.`);
    throw new Error(`Claude API error ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  if (data.stop_reason === "refusal") throw new Error("Claude declined this request.");
  if (data.stop_reason === "max_tokens") throw new Error("Claude's answer was cut off. Lower \"Listings per request\" in settings and try again.");
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  return { text, cost: await addSpend(data.model || anthropicModel, data.usage) };
}

// ---------- What it costs ----------
// List prices per million tokens (input, output). Thinking is billed as output and is
// included in output_tokens. Approximate: a server-side fallback may bill a different model.
const PRICES = [
  [/opus-5-5/, 4, 20],
  [/fable|mythos/, 10, 50],
  [/opus-(5|4)/, 5, 25],
  [/sonnet-5/, 2, 10],
  [/sonnet-4/, 3, 15],
  [/haiku-4/, 1, 5],
];

// Usage per local day and model: { days: { "2026-10-08": { usd, calls, models: { id: { usd, calls } } } } }.
// Estimates from token counts at list price: a regular API key can't read the real balance.
const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in your time zone
function monthSpent(usage, month = today().slice(0, 7)) {
  return Object.entries(usage?.days || {}).reduce((sum, [d, v]) => (d.startsWith(month) ? sum + v.usd : sum), 0);
}

let spendQueue = Promise.resolve(); // parallel batches finish together; add their costs one at a time
function addSpend(model, usage) {
  const price = PRICES.find(([re]) => re.test(model));
  if (!price || !usage) return Promise.resolve(0);
  const cost = ((usage.input_tokens || 0) * price[1] + (usage.output_tokens || 0) * price[2]) / 1e6;
  spendQueue = spendQueue
    .then(async () => {
      const day = today();
      const { usage: u = { days: {} }, spend } = await chrome.storage.local.get(["usage", "spend"]);
      // Carry over the older month-only total the first time.
      if (spend && !Object.keys(u.days).length && spend.month === day.slice(0, 7)) u.days[day] = { usd: spend.usd, calls: 0, models: {} };
      const d = (u.days[day] ||= { usd: 0, calls: 0, models: {} });
      const m = (d.models[model] ||= { usd: 0, calls: 0 });
      d.usd += cost;
      d.calls += 1;
      m.usd += cost;
      m.calls += 1;
      const keep = Object.keys(u.days).sort().slice(-400);
      u.days = Object.fromEntries(keep.map((k) => [k, u.days[k]]));
      await chrome.storage.local.set({ usage: u });
      if (spend) await chrome.storage.local.remove("spend");
    })
    .catch(() => {});
  return spendQueue.then(() => cost); // resolves once saved, so the totals the page reads are current
}

// ---------- Lenses ----------
// The same listing is judged differently depending on what you want it for.

const LENS_RULES = {
  use: `Lens: buy to use. The buyer wants a working item for themselves.
great = strong price for a working item; good = fair-to-good deal, worth a look; fair = market price, nothing special;
pass = overpriced, or for parts / not working / untested "as is" (unless the buyer says they want that).`,
  fix: `Lens: fix-up project. The buyer repairs things and LIKES broken, untested, "as is" and for-parts listings when the likely fault is common and fixable.
Score by: cheap compared with the for-parts and working prices, likely fault is well known and easy, parts are cheap and available.
great = cheap with a likely easy fix; good = reasonable project; fair = fair price, nothing special; pass = expensive for a broken item, or a fault that is hard to fix.
fault: the most likely problem in a few words ("none" if it works, "unknown" if you can't tell).
difficulty: 1 = easy (cleaning, cable, battery, shell, drop-in part) to 5 = very hard (board rework, unobtainable parts); 0 = can't tell.
partsCost: rough whole-dollar cost of the parts, 0 if none or unknown.`,
  flip: `Lens: flip for profit. The buyer resells, often after a fix or clean-up.
Score by expected profit and risk. "margin before repairs" is resale at the working median, minus fees, minus the buy price.
great = big margin with low risk; good = solid margin; fair = thin margin; pass = little or no margin, or high risk.
Items that sell slowly, are fragile or heavy to ship, or have uncertain faults are higher risk.
fault, difficulty and partsCost as for a fix-up: "none" and 0 for an item that works.`,
};

// Rules of thumb for the buyer's hobby categories. Only applied where they fit the listing.
const FIX_KNOWLEDGE = `Repair and homebrew knowledge (use only where it fits the listing; never stretch it):
- Usually easy: dirty cartridge slots and contacts (e.g. NES 72-pin connector), dead save or clock batteries, leaking electrolytic capacitors in older handhelds, computers and power supplies (recap; check for corrosion), worn optical-drive lasers (replace, or fit an optical drive emulator), analog-stick drift, broken shells, hinges and screens on handhelds (replacement parts are common), missing power supplies or cables ("untested, no charger" is often fine), blown fuses.
- Hard or risky: board-level faults on modern consoles (HDMI ports and charge chips need microsoldering), Xbox 360 red ring, PS3 yellow light, liquid damage, battery-leak corrosion spread across traces, activation- or account-locked devices. A console banned from online play still runs offline homebrew.
- Homebrew: an active scene adds value and usefulness (e.g. Wii, PS2, PSP, PS Vita, 3DS/DS, original Xbox, GameCube, Dreamcast, some Switch units). Whether a unit can run it can depend on firmware version, model or serial number; say "depends on firmware/serial" unless the listing states it.`;

const lensSystem = (base, lens, interests) =>
  [base, LENS_RULES[lens] || LENS_RULES.use, interests && `Buyer's interests: ${interests}`, lens !== "use" && FIX_KNOWLEDGE]
    .filter(Boolean)
    .join("\n\n");

const money = (n) => `$${Math.round(n)}`;

function marketText(query, market) {
  if (!market) return `No sold-price reference for "${query || "this search"}". Judge price only from obvious cues.`;
  let t = `Sold-price reference for "${query}" (what buyers paid, incl. shipping): working/used median ${money(market.median)} (middle half ${money(market.p25)}-${money(market.p75)}, ${market.n} sales).`;
  if (market.parts) t += ` For parts / not working: median ${money(market.parts.median)} (${market.parts.n} sales).`;
  return t;
}

// ---------- Ranking ----------

// Browsing with no search: no sold-price reference, so the model estimates a typical used price
// from general knowledge (always shown as an estimate) and writes an eBay search for the exact
// item, which the panel can use for a real sold-price check on request.
const BROWSE_RULES = (context) => `No search term: the buyer is browsing ${context}. There is no sold-price reference.
related: true only if the item fits the buyer's interests or wants (above); false otherwise. Without interests or wants, true for everything.
A listing that is not related gets verdict pass unless it is an exceptional deal on what it is (then great, and say so).
estLow / estHigh: the typical used selling price range in whole dollars for this kind of item in this condition, from your general knowledge.
Use 0 and 0 when you can't tell (vague or generic title, unknown model). This is an estimate, not market data; judge the price against it and write "est." when you do.
query: 2-6 words that would find sold listings of this exact item on eBay (brand, model, key variant), "" if the title is too vague.`;

function rankSchema(lens, browse = false) {
  const props = {
    id: { type: "integer" },
    related: { type: "boolean" },
    score: { type: "integer" },
    verdict: { type: "string", enum: ["great", "good", "fair", "pass", "suspicious"] },
    flags: { type: "array", items: { type: "string" } },
    reason: { type: "string" },
  };
  if (lens !== "use") Object.assign(props, { fault: { type: "string" }, difficulty: { type: "integer" }, partsCost: { type: "integer" } });
  if (browse) Object.assign(props, { estLow: { type: "integer" }, estHigh: { type: "integer" }, query: { type: "string" } });
  return {
    type: "object",
    properties: {
      items: { type: "array", items: { type: "object", properties: props, required: Object.keys(props), additionalProperties: false } },
    },
    required: ["items"],
    additionalProperties: false,
  };
}

// This prompt is the part most worth tuning yourself. Small local models
// follow short, concrete rules better than long abstract ones.
const RANK_BASE = `You help a buyer skim second-hand listings. For each listing give a 0-100 score and one verdict: great, good, fair, pass or suspicious.
suspicious = likely scam, counterfeit, or misleading, whatever the lens.
related: true if the listing is what the search (or the buyer's wants) is for, false if it is a different kind of item.
An unrelated listing is not automatically a pass: if it is a genuinely good find on its own terms, score it on its merits and set related to false.
Sold-price numbers only apply to related listings.
If the buyer listed wants or must-haves, a listing that misses one scores lower and the reason says which.
Red flags: price far below market with no explanation (bait), "replica"/"inspired"/"style" wording, box-only or photo-only listings,
vague or keyword-stuffed titles, shipping that makes the total expensive, seller with very low or no feedback.
Auctions: the price shown is only the current bid and will rise. Unless it ends within a few hours, don't rate it great or good on
price alone; judge what it is and what it is likely to sell for, and say it's an auction in the reason. Lots: judge the price per item.
Use only the text you are given. Never invent specs or seller details. If information is missing, say so.
Keep each reason under 20 words. Flags are 1-4 word phrases. Return every id you were given.`;

// One call that works for either provider; returns { text, cost }.
async function llmText({ system, userText, schema }) {
  const { provider, textModel } = await getSettings();
  if (provider === "anthropic") return anthropicMessage({ system, content: userText, schema });
  const text = await ollamaChat({
    model: textModel,
    format: schema,
    messages: [
      { role: "system", content: system },
      { role: "user", content: userText },
    ],
  });
  return { text, cost: 0 };
}

function parseModelJson(content) {
  try {
    return JSON.parse(content);
  } catch {
    throw new Error("The model returned something unreadable. Try again, or lower \"Listings per request\" in settings.");
  }
}

const priceLine = (it) => {
  const ship = it.shipping == null ? " (shipping not shown)" : it.shipping > 0 ? ` (incl. $${it.shipping} shipping)` : " (free shipping)";
  const parts = [it.total == null ? `price: ${it.priceText || "unknown"}` : `total: $${it.total}${ship}`];
  if (it.auction) parts.push(`AUCTION: that is the current bid, ${it.bids || 0} bid${it.bids === 1 ? "" : "s"}${it.timeLeft ? `, ${it.timeLeft} left` : ""}`);
  if (it.lot) parts.push(`lot of ${it.lot}${it.total != null ? ` (about $${Math.round(it.total / it.lot)} each)` : ""}`);
  if (it.bestOffer) parts.push("accepts offers");
  return parts.join(" | ");
};

async function rankBatch({ items, query, market, lens = "use", want = "", browse = "" }) {
  const { interests } = await getSettings();
  const listingText = items
    .map((it) => {
      const notes = [];
      if (it.vsWorking != null) notes.push(`${Math.round(it.vsWorking * 100)}% of working median`);
      if (it.vsParts != null) notes.push(`${Math.round(it.vsParts * 100)}% of for-parts median`);
      if (it.marginBeforeRepair != null) notes.push(`margin before repairs ${it.marginBeforeRepair < 0 ? "-" : ""}$${Math.abs(it.marginBeforeRepair)}`);
      const extra = (it.raw || "").replace(it.title, "").trim(); // the title is already on the line
      return `id ${it.id} | ${it.site} | ${it.title} | ${priceLine(it)}${notes.length ? ` | ${notes.join(", ")}` : ""}\n  card text: ${extra}`;
    })
    .join("\n");

  const { text, cost } = await llmText({
    system: [lensSystem(RANK_BASE, lens, interests), browse && BROWSE_RULES(browse)].filter(Boolean).join("\n\n"),
    userText: [!browse && marketText(query, market), want && `What the buyer wants: ${want}`, `Listings:\n${listingText}`].filter(Boolean).join("\n\n"),
    schema: rankSchema(lens, !!browse),
  });
  return { items: parseModelJson(text).items || [], cost };
}

// ---------- One listing, in depth ----------

function itemSchema(lens) {
  const props = {
    score: { type: "integer" },
    verdict: { type: "string", enum: ["great", "good", "fair", "pass", "suspicious"] },
    summary: { type: "string" },
    flags: { type: "array", items: { type: "string" } },
    questions: { type: "array", items: { type: "string" } },
    offerLow: { type: "integer" },
    offerHigh: { type: "integer" },
    homebrew: { type: "string" },
  };
  if (lens !== "use") {
    const list = { type: "array", items: { type: "string" } };
    props.repair = {
      type: "object",
      properties: { faults: list, parts: list, tools: list, difficulty: { type: "integer" }, partsCost: { type: "integer" }, notes: { type: "string" } },
      required: ["faults", "parts", "tools", "difficulty", "partsCost", "notes"],
      additionalProperties: false,
    };
  }
  return { type: "object", properties: props, required: Object.keys(props), additionalProperties: false };
}

const ITEM_BASE = `You help a buyer decide whether to buy one second-hand listing.
Give a 0-100 score for how good a buy it is for this buyer's purpose, and one verdict: great, good, fair, pass or suspicious (likely scam, counterfeit, or misleading).
summary: 2-3 plain sentences on what it is, whether the price is right, and the main risk.
flags: up to 5 short red or green flags (1-4 words each), e.g. "price far below market", "no return policy", "clear photos".
questions: 3-5 specific questions to ask the seller before buying, based on what is missing or unclear. For a broken or untested item, ask what exactly happens when it is powered on and what has been tried.
offerLow / offerHigh: a sensible whole-dollar offer range if negotiation is possible; 0 for both if the price is already fair or you cannot tell.
For an auction, offerLow / offerHigh are a sensible maximum-bid range instead, and the summary says the current bid will rise.
homebrew: one sentence on its homebrew or modding scene and any firmware/model caveat, or "" if it has none or it doesn't apply.
repair (fix-up and flip lenses): likely faults (most likely first), parts and tools needed, difficulty 1-5 (0 = can't tell), rough partsCost in whole dollars, and notes on teardown risks.
If the buyer listed wants or must-haves, say which ones the listing meets or misses.
Use only the information given. Never invent specs, history, or seller details. If something is missing, say so.`;

async function analyzeListing({ listing, query, market, lens = "use", want = "" }) {
  const { interests } = await getSettings();
  const lines = [
    `site: ${listing.site}`,
    `title: ${listing.title}`,
    priceLine(listing),
    listing.condition && `condition: ${listing.condition}`,
    listing.seller && `seller: ${listing.seller}`,
    listing.shippingText && `shipping: ${listing.shippingText}`,
    listing.marginBeforeRepair != null && `margin before repairs: $${listing.marginBeforeRepair}`,
    listing.details && `details: ${listing.details}`,
  ].filter(Boolean);
  const { text, cost } = await llmText({
    system: lensSystem(ITEM_BASE, lens, interests),
    userText: [marketText(query, market), want && `What the buyer wants: ${want}`, `Listing:\n${lines.join("\n")}`].filter(Boolean).join("\n\n"),
    schema: itemSchema(lens),
  });
  return { ...parseModelJson(text), cost };
}

// ---------- Search ideas ----------

const IDEAS_SCHEMA = {
  type: "object",
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          query: { type: "string" },
          kind: { type: "string", enum: ["idea", "narrow", "broaden", "typo", "alt", "price"] },
          why: { type: "string" },
          maxPrice: { type: "integer" },
          newest: { type: "boolean" },
        },
        required: ["query", "kind", "why", "maxPrice", "newest"],
        additionalProperties: false,
      },
    },
  },
  required: ["suggestions"],
  additionalProperties: false,
};

const IDEAS_SYSTEM = `You help a buyer find second-hand items on eBay or Facebook Marketplace by suggesting better searches.
Return 4 to 6 suggestions. Each has: query (the exact words to type, 2-7 words), kind, why (under 15 words), maxPrice (whole dollars, 0 for no cap), newest (true to sort newest first).
kind: idea = a different way to phrase what the buyer wants (model names, numbers, what sellers actually call it); narrow = tighter, to cut junk;
broaden = looser, to include good matches the current words exclude; typo = a realistic misspelling or spacing variant sellers use (fewer buyers find those listings);
alt = a related model or alternative name worth checking; price = the same search with a price cap near 80% of the sold median (only when a market reference is given).
Rules: if the buyer described what they want, most suggestions are kind idea. If result titles are given, base narrow, broaden, typo and alt on patterns you can see in them
(for example many "for parts" or "broken" listings means a narrow search that excludes them). On eBay you may use minus terms like -parts -repair and quoted phrases; on Facebook use plain words only, no operators.
Never invent products, specs or prices. Do not repeat the current search. Keep queries short.`;

const IDEAS_LENS = {
  use: "",
  fix: "The buyer is looking for fix-up projects: include searches that surface broken, untested, \"as is\" and for-parts listings (on eBay, words like \"for parts\", \"untested\", \"not working\").",
  flip: "The buyer resells for profit: favour searches that surface underpriced listings (misspellings, vague titles, bundles and lots, untested items) rather than tighter matches.",
};

// Two sources, never mixed: what the buyer typed, or (when that's blank) the results on screen.
async function suggestSearches({ site, query, intent, titles, market, lens = "use" }) {
  const lines = intent
    ? [
        `site: ${site}`,
        IDEAS_LENS[lens],
        `what the buyer wants: ${intent}`,
        "Base every suggestion on what the buyer wants. Most should be kind idea, typo or alt.",
        query && `(background only: the page they're on searched "${query}". Use it only if their wants don't name an item; don't refine it otherwise.)`,
      ]
    : [
        `site: ${site}`,
        IDEAS_LENS[lens],
        query && `current search: ${query}`,
        market && market.median != null && `sold-price reference: median $${market.median}, middle half $${market.p25}-$${market.p75}${market.parts ? `; for parts: median $${market.parts.median}` : ""}`,
        titles?.length ? `result titles so far:\n${titles.map((t) => `- ${t}`).join("\n")}` : "no results seen yet",
      ];
  lines.splice(0, lines.length, ...lines.filter(Boolean));
  const { text } = await llmText({ system: IDEAS_SYSTEM, userText: lines.join("\n"), schema: IDEAS_SCHEMA });
  return parseModelJson(text).suggestions || [];
}

// ---------- Photos ----------

function bufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

const PHOTO_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    photoType: { type: "string", enum: ["real", "stock", "unclear"] },
    condition: { type: "string", enum: ["good", "fair", "poor", "unknown"] },
    matchesTitle: { type: "string", enum: ["yes", "partly", "no", "unknown"] },
    concerns: { type: "array", items: { type: "string" } },
  },
  required: ["summary", "photoType", "condition", "matchesTitle", "concerns"],
  additionalProperties: false,
};

const photoPrompt = (title) => `${title ? `The listing title is: "${title}". ` : ""}Look at this listing photo and report only what is visible; do not guess.
summary: two short sentences on what the photo shows and anything notable.
photoType: real = a genuine photo of the actual item for sale; stock = a catalog, marketing or internet image rather than the actual item; unclear = cannot tell.
condition: good = clean, no visible damage; fair = normal wear; poor = visible damage, heavy wear or missing parts; unknown = cannot tell.
matchesTitle: yes / partly / no / unknown, comparing the photo with the title.
concerns: up to 4 short phrases (e.g. "cracked screen", "watermark", "different model"), empty if none.`;

// How much a photo check moves the rating. Fixed rules, not model-chosen numbers, so it is consistent.
function photoAdjust(p) {
  let adjust = 0;
  const why = [];
  if (p.matchesTitle === "no") (adjust -= 25), why.push("doesn't match the title");
  else if (p.matchesTitle === "partly") (adjust -= 8), why.push("only partly matches the title");
  if (p.photoType === "stock") (adjust -= 10), why.push("stock photo, not the actual item");
  if (p.condition === "poor") (adjust -= 20), why.push("visible damage or heavy wear");
  else if (p.condition === "fair") (adjust -= 5), why.push("normal wear");
  else if (p.condition === "good" && p.photoType === "real") (adjust += 5), why.push("real photo, looks clean");
  return { adjust: Math.max(-40, Math.min(10, adjust)), why };
}

async function checkPhoto({ imageUrl, title }) {
  const { visionModel, provider } = await getSettings();
  const imgRes = await fetchWithTimeout(imageUrl, {}, 30 * 1000, "The photo took too long to load.");
  if (!imgRes.ok) throw new Error(`Couldn't load the photo (${imgRes.status}).`);
  const buf = await imgRes.arrayBuffer();
  if (buf.byteLength > 3.5 * 1024 * 1024) throw new Error("That photo is too large to check (over 3.5 MB).");
  const b64 = bufferToBase64(buf);
  const prompt = photoPrompt(title);
  let text;
  if (provider === "anthropic") {
    const type = (imgRes.headers.get("content-type") || "").split(";")[0];
    const media_type = ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(type) ? type : "image/jpeg";
    ({ text } = await anthropicMessage({
      maxTokens: 4096,
      schema: PHOTO_SCHEMA,
      content: [
        { type: "image", source: { type: "base64", media_type, data: b64 } },
        { type: "text", text: prompt },
      ],
    }));
  } else {
    text = await ollamaChat({
      model: visionModel,
      numCtx: 4096,
      format: PHOTO_SCHEMA,
      messages: [{ role: "user", content: prompt, images: [b64] }],
    });
  }
  let p;
  try {
    p = JSON.parse(text);
  } catch {
    // Small local vision models sometimes ignore the format; keep their words, change no rating.
    return { summary: text.trim(), photoType: "unclear", condition: "unknown", matchesTitle: "unknown", concerns: [], adjust: 0, why: [] };
  }
  return { ...p, concerns: p.concerns || [], ...photoAdjust(p) };
}

// ---------- eBay sold comps ----------
// Only used from Facebook pages (on eBay the page makes this request itself). Returns the raw
// status and HTML: the content script parses it (service workers have no DOMParser) and owns
// the caching and the back-off, so both paths behave the same.

async function fetchSoldHtml({ url }) {
  const u = new URL(url);
  if (u.origin !== "https://www.ebay.com" || u.pathname !== "/sch/i.html" || u.searchParams.get("LH_Sold") !== "1") {
    throw new Error("Only eBay sold searches are fetched here.");
  }
  // Sent with your eBay cookies so it looks like the one ordinary search it is.
  const res = await fetchWithTimeout(url, { credentials: "include" }, 30 * 1000, "eBay took too long to answer.");
  return { status: res.status, html: res.ok ? await res.text() : "" };
}

// ---------- Message router ----------

// ---------- Fonts ----------
// Page scripts get the bundled fonts as bytes and add them with the FontFace API. Nothing is
// exposed as a web-accessible resource, so pages can't detect the extension through its fonts,
// and a site's font rules can't block them.
const FONT_FILES = /^(fraunces-400|fraunces-400-italic|fraunces-600|pixelify-400|pixelify-600|plex-mono-400|plex-mono-600)\.woff2$/;
const fontCache = new Map();
async function getFont({ file }) {
  if (!FONT_FILES.test(file || "")) throw new Error("Unknown font.");
  if (!fontCache.has(file)) {
    const res = await fetch(chrome.runtime.getURL(`fonts/${file}`));
    fontCache.set(file, bufferToBase64(await res.arrayBuffer()));
  }
  return fontCache.get(file);
}

// Page scripts get the settings without the API key: they never need it.
async function getPageSettings() {
  const { anthropicKey, ...rest } = await getSettings();
  return { ...rest, hasKey: !!anthropicKey };
}

const openOptions = async () => chrome.runtime.openOptionsPage();
const HANDLERS = { rankBatch, analyzeListing, suggestSearches, checkPhoto, fetchSoldHtml, getFont, openOptions, getSettings: getPageSettings };

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const handler = HANDLERS[msg?.type];
  if (!handler) return false;
  handler(msg.payload || {})
    .then((data) => sendResponse({ ok: true, data }))
    .catch((err) => sendResponse({ ok: false, error: err.message || String(err) }));
  return true; // keep the channel open for the async reply
});

// ---------- Right-click on a photo ----------
// The content script on the page does the work and shows the answer; we just point it at the image.

const MENU_ID = "second-look-photo";

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details?.reason === "install") chrome.runtime.openOptionsPage(); // first run: pick a model, paste a key
  const current = await chrome.storage.local.get(null);
  await chrome.storage.local.set({ ...DEFAULTS, ...current });
  await syncAutoScripts().catch((e) => console.warn("[Second Look]", e.message));
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: "Check this photo with Second Look",
      contexts: ["image"],
      documentUrlPatterns: ["https://www.ebay.com/*", "https://www.facebook.com/*"],
    });
  });
});

// ---------- The side tab ----------
// With "showTab" on, the page scripts are registered to load on eBay and Facebook pages.
// With it off, nothing runs there until you click the toolbar icon (the gentlest option).

const AUTO_ID = "second-look-auto";

// Install and a settings change can both ask at once; run one at a time so they don't race.
let syncing = Promise.resolve();
function syncAutoScripts() {
  syncing = syncing.catch(() => {}).then(doSyncAutoScripts);
  return syncing;
}

async function doSyncAutoScripts() {
  const { showTab } = await getSettings();
  const def = {
    id: AUTO_ID,
    matches: ["https://www.ebay.com/", "https://www.ebay.com/sch/*", "https://www.ebay.com/itm/*", "https://www.facebook.com/*"],
    js: ["content/adapters.js", "content/panel.js"],
    runAt: "document_idle",
    persistAcrossSessions: true,
  };
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [AUTO_ID] });
  if (showTab && !existing.length) await chrome.scripting.registerContentScripts([def]);
  else if (showTab) await chrome.scripting.updateContentScripts([def]); // pick up changes after an update
  else if (existing.length) await chrome.scripting.unregisterContentScripts({ ids: [AUTO_ID] });
}
chrome.storage.onChanged.addListener((changes) => {
  if (changes.showTab) syncAutoScripts().catch((e) => console.warn("[Second Look]", e.message));
});
chrome.runtime.onStartup.addListener(() => syncAutoScripts().catch(() => {}));

// ---------- Nothing runs on eBay/Facebook until you ask (when the tab is off) ----------
// No content scripts are declared in the manifest, so page loads are untouched.
// Clicking the toolbar icon (or the right-click item) injects the scripts on demand.

async function ensureInjected(tabId) {
  const [{ result: present } = {}] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => !!window.__secondLookPanel,
  });
  if (!present) {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content/adapters.js", "content/panel.js"] });
  }
  return !!present;
}

async function openPanel(tabId) {
  try {
    await ensureInjected(tabId);
    await chrome.scripting.executeScript({ target: { tabId }, func: () => window.dispatchEvent(new CustomEvent("second-look-toggle")) });
  } catch (e) {
    console.warn("[Second Look] can't open on this page:", e.message); // not an eBay/Facebook page
  }
}

chrome.action.onClicked.addListener((tab) => {
  if (tab?.id) openPanel(tab.id);
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab?.id) return;
  try {
    await ensureInjected(tab.id);
    await chrome.tabs.sendMessage(tab.id, { type: "second-look-check-photo", imageUrl: info.srcUrl });
  } catch (e) {
    console.warn("[Second Look] photo check failed to start:", e.message);
  }
});
