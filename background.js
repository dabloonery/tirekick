// Tirekick — background service worker.
// Everything that talks to the outside world lives here:
//   1. the model: the Claude API, or your local Ollama server (ranking, analysis, ideas, photo checks)
//   2. listing photos (fetched and base64-encoded for the vision model)
//   3. eBay sold listings when you're on Facebook (through an open eBay tab when there is one;
//      on eBay the page fetches them itself)
// Content scripts send messages; this file answers them.

importScripts("lib/sites.js", "lib/shared.js"); // TKSites: the sites it works on. TKShared: link and photo checks, settings limits, alert rules

const DEFAULTS = {
  theme: "match", // match the browser (dark if it does not say), or "dark" / "light"
  provider: "anthropic", // "anthropic" (Claude API), "openai" (any OpenAI-compatible service) or "ollama" (local)
  anthropicKey: "",
  anthropicModel: "claude-sonnet-5-5", // analysis, photo checks, search ideas; Opus stays a menu choice for when you want it
  anthropicScanModel: "claude-haiku-5-5", // scans, which send many listings at once: a cheaper model keeps them affordable ("" = the one above)
  anthropicUrl: "https://api.anthropic.com", // only changed for testing
  // Any service that speaks the OpenAI chat API: OpenAI, Gemini, OpenRouter, DeepSeek, Mistral, xAI, LM Studio...
  oaiPreset: "openrouter",
  oaiUrl: "https://openrouter.ai/api/v1",
  oaiKey: "",
  oaiModel: "",
  oaiVisionModel: "", // blank = the same model
  oaiPriceIn: 0, // $ per million tokens, for spend tracking where the service doesn't report cost (0 = not tracked)
  oaiPriceOut: 0,
  ollamaUrl: "http://localhost:11434",
  textModel: "qwen3:4b",
  visionModel: "moondream",
  batchSize: 10,
  useSoldComps: true,
  lens: "use", // "use" (buy to use it yourself) or "project" (fix & flip)
  feePct: 13.6, // eBay fees as % of the sale, for flip margins
  interests: "", // what the buyer is into, in their words; guides scores where a page has no search
  // Filters and seller rules: plain checks, no AI. Hidden listings are never sent to the model.
  // Same words as the filter bar: -word drops a listing, other words are required, a/b is either, quotes keep a phrase.
  filterWords: '-replica -reproduction -repro -"box only" -"empty box" -"manual only" -"case only" -"photo only" -"picture only"',
  minSellerRatings: 10,
  minSellerPct: 97,
  autoMarks: true, // chips on cards before any scan: new to you, price drops, warnings
  monthlyBudget: 0, // dollars; 0 = no budget. Claude calls stop once this month's estimated spend reaches it
  showTab: true, // keep a slim tab on eBay/Facebook pages (needs the page script to load automatically)
  autoScan: false, // score new listings as they load, on eBay and Marketplace search pages you're looking at (you turn it on)
};

async function getSettings() {
  const stored = await chrome.storage.local.get(DEFAULTS);
  return { ...DEFAULTS, ...stored };
}

// fetch with a deadline, so a hung server shows an error instead of spinning forever. opts.signal
// is the Stop button (see "Stopping" below).
const STOPPED = "Stopped.";
async function fetchWithTimeout(url, opts, ms, slowMsg) {
  const stop = opts.signal;
  try {
    return await fetch(url, { ...opts, signal: stop ? AbortSignal.any([AbortSignal.timeout(ms), stop]) : AbortSignal.timeout(ms) });
  } catch (e) {
    if (stop?.aborted) throw new Error(STOPPED);
    if (e.name === "TimeoutError") throw new Error(slowMsg);
    throw e;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Ollama ----------

async function ollamaChat({ model, messages, format, numCtx = 8192, signal }) {
  const { ollamaUrl } = await getSettings();
  // Only addresses you've allowed: this computer's Ollama is, any other (a restored backup could name one) needs your OK first.
  let origin = "";
  try {
    origin = new URL(ollamaUrl).origin;
  } catch {}
  if (!origin || !(await chrome.permissions.contains({ origins: [`${origin}/*`] }))) {
    throw new Error(`Tirekick isn't allowed to reach ${origin || ollamaUrl} yet. In settings, press Test connection to allow it.`);
  }
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
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal },
      5 * 60 * 1000,
      `Ollama took over 5 minutes on "${model}". Lower "Listings per request" or try a smaller model.`
    );
  } catch (e) {
    if (/Ollama took/.test(e.message) || e.message === STOPPED) throw e;
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

const anthropicMessage = (opts) => withBudget(() => anthropicMessageOnce(opts));
async function anthropicMessageOnce({ system, content, schema, maxTokens = 16000, signal, model }) {
  const { anthropicKey, anthropicModel, anthropicUrl } = await getSettings();
  model ||= anthropicModel;
  if (!anthropicKey) throw new Error("No Claude API key yet. Paste one in Tirekick's settings.");
  const body = {
    model,
    max_tokens: maxTokens,
    messages: [{ role: "user", content }],
    output_config: {},
  };
  // Effort works on Opus 4.5+, Sonnet 4.6+ and every 5-series model (Haiku 5.5 too); Haiku 4.5, Sonnet 4.5 and older reject it.
  if (!/haiku-[1-4]|sonnet-4-5|claude-3/.test(model)) body.output_config.effort = "low";
  // Server-side fallback (re-run on another model if a safety classifier declines) is for the 5-series.
  const isFiveSeries = /^claude-(opus-5|sonnet-5-5|fable-5|mythos-5)/.test(model);
  if (isFiveSeries) body.fallbacks = "default";
  // The instructions repeat in every batch of a scan: let the API reuse them (cheaper reads, where the model caches).
  if (system) body.system = [{ type: "text", text: system, cache_control: { type: "ephemeral" } }];
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
        { method: "POST", headers, body: JSON.stringify(body), signal },
        3 * 60 * 1000,
        "The Claude API took over 3 minutes. Try again, or lower \"Listings per request\"."
      );
    } catch (e) {
      if (/took over/.test(e.message) || e.message === STOPPED) throw e;
      throw new Error("Can't reach the Claude API. Check your internet connection.");
    }
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= 2 || signal?.aborted) break;
    const after = Number(res.headers.get("retry-after"));
    await sleep(Math.min(20, after > 0 ? after : 2 * 2 ** attempt) * 1000);
  }
  if (res.status === 401) throw new Error("The Claude API didn't accept that key. Check it in settings.");
  if (res.status === 429) throw new Error("The Claude API needs a short break. Wait a moment and scan again.");
  if (res.status === 529) throw new Error("The Claude API is overloaded right now. Try again in a minute.");
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 404 && /model/i.test(text)) throw new Error(`Claude doesn't recognize the model "${model}". Check it in the extension options.`);
    throw new Error(`Claude API error ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  // Billed whatever the answer turns out to be (cut off, declined), so count it first.
  const cost = await addSpend(data.model || model, data.usage);
  if (data.stop_reason === "refusal") throw new Error("Claude declined this request. Try again, or switch models in the panel.");
  if (data.stop_reason === "max_tokens") throw new Error("Claude's answer was cut off. Lower \"Listings per request\" in settings and try again.");
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  return { text, cost };
}

// Batches run a few at a time, so what's already out counts too (at what the last call cost); otherwise
// each would pass the budget check before any of them had been paid for.
let paidInFlight = 0;
let lastPaidUsd = 0;
async function withBudget(fn) {
  await checkBudget((await getSettings()).monthlyBudget);
  paidInFlight++;
  try {
    const r = await fn();
    if (r?.cost > 0) lastPaidUsd = r.cost;
    return r;
  } finally {
    paidInFlight--;
  }
}

// Paid services stop once this month's estimated spend reaches the budget.
async function checkBudget(monthlyBudget) {
  if (!(monthlyBudget > 0)) return;
  const spent = monthSpent((await chrome.storage.local.get("usage")).usage);
  if (spent + paidInFlight * lastPaidUsd >= monthlyBudget) {
    throw new Error(`This month's budget of $${monthlyBudget} is used up (about $${spent.toFixed(2)} spent). Raise it in settings, or switch to Ollama in the panel's model menu.`);
  }
}

// ---------- Other AI services (the OpenAI chat API) ----------
// One code path for every service that speaks it. Structured output first (a JSON schema); if a
// service or model doesn't take that, plain JSON mode with the schema in the instructions; then
// no format at all (the reply is still read as JSON).
const OAI_NAMES = [
  [/openai\.com/, "OpenAI"], [/googleapis\.com/, "Gemini"], [/openrouter\.ai/, "OpenRouter"],
  [/deepseek\.com/, "DeepSeek"], [/mistral\.ai/, "Mistral"], [/x\.ai/, "xAI"], [/localhost:1234|127\.0\.0\.1:1234/, "LM Studio"],
];
const oaiName = (url) => OAI_NAMES.find(([re]) => re.test(url))?.[1] || new URL(url).host;

const openaiChat = (opts) => withBudget(() => openaiChatOnce(opts));
async function openaiChatOnce({ messages, schema, model, signal }) {
  const { oaiUrl, oaiKey, oaiModel, oaiPriceIn, oaiPriceOut } = await getSettings();
  model ||= oaiModel;
  const name = oaiName(oaiUrl);
  if (!model) throw new Error(`Pick a model for ${name} in settings (Test connection lists them).`);
  const origin = new URL(oaiUrl).origin;
  if (!(await chrome.permissions.contains({ origins: [`${origin}/*`] }))) {
    throw new Error(`Tirekick isn't allowed to reach ${origin} yet. In settings, press Test connection to allow it.`);
  }
  const headers = { "Content-Type": "application/json" };
  if (oaiKey) headers.Authorization = `Bearer ${oaiKey}`;
  const openrouter = /openrouter\.ai/.test(oaiUrl);
  if (openrouter) headers["X-Title"] = "Tirekick";
  const formats = schema
    ? [{ type: "json_schema", json_schema: { name: "answer", strict: true, schema } }, { type: "json_object" }, null]
    : [null];
  let res, text;
  for (const [i, format] of formats.entries()) {
    const sys = format?.type === "json_schema" || !schema ? messages : withSchemaNote(messages, schema);
    const body = { model, messages: sys };
    if (format) body.response_format = format;
    if (openrouter) body.usage = { include: true }; // OpenRouter then reports the exact cost
    for (let attempt = 0; ; attempt++) {
      try {
        res = await fetchWithTimeout(`${oaiUrl.replace(/\/+$/, "")}/chat/completions`, { method: "POST", headers, body: JSON.stringify(body), signal }, 3 * 60 * 1000, `${name} took over 3 minutes. Try again, or lower "Listings per request".`);
      } catch (e) {
        if (/took over/.test(e.message) || e.message === STOPPED) throw e;
        throw new Error(name === "LM Studio" ? "Can't reach LM Studio. Is its server running (Developer tab)?" : `Can't reach ${name}. Check your internet connection.`);
      }
      if (!(res.status === 429 || res.status >= 500) || attempt >= 2 || signal?.aborted) break;
      await sleep(Math.min(20, Number(res.headers.get("retry-after")) || 2 * 2 ** attempt) * 1000);
    }
    if (res.ok) break;
    text = await res.text();
    // This service or model doesn't take that output format: try the next, plainer one.
    if (res.status === 400 && i < formats.length - 1 && /response_format|json_schema|json_object|structured|schema|not supported/i.test(text)) continue;
    break;
  }
  if (res.status === 401 || res.status === 403) throw new Error(`${name} rejected the key. Check it in settings.`);
  if (res.status === 429) throw new Error(`${name} needs a short break. Wait a moment and try again.`);
  if (res.status === 402) throw new Error(`${name} says the account is out of credit.`);
  if (!res.ok) {
    text ??= await res.text();
    if (res.status === 404 && /model/i.test(text)) throw new Error(`${name} doesn't recognize the model "${model}". Pick one in settings (Test connection lists them).`);
    throw new Error(`${name} error ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  // Cost: OpenRouter says exactly; otherwise your prices per million tokens, if you entered them.
  // Counted before the answer is judged: a cut-off or declined one is billed all the same.
  const u = data.usage || {};
  const usd = typeof u.cost === "number" ? u.cost : oaiPriceIn > 0 || oaiPriceOut > 0 ? ((u.prompt_tokens || 0) * oaiPriceIn + (u.completion_tokens || 0) * oaiPriceOut) / 1e6 : 0;
  const cost = usd > 0 ? await addSpend(data.model || model, null, usd) : 0;
  const choice = data.choices?.[0];
  if (choice?.message?.refusal) throw new Error(`${name} declined this request.`);
  if (choice?.finish_reason === "length") throw new Error(`${name}'s answer was cut off. Lower "Listings per request" in settings and try again.`);
  const content = choice?.message?.content;
  const out = Array.isArray(content) ? content.map((c) => c.text || "").join("") : content || "";
  return { text: out, cost };
}
// Plain JSON mode doesn't carry the schema, so it goes into the instructions.
function withSchemaNote(messages, schema) {
  const note = `Reply with only a JSON object matching this JSON schema, nothing else:\n${JSON.stringify(schema)}`;
  const [first, ...rest] = messages;
  return first.role === "system" ? [{ ...first, content: `${first.content}\n\n${note}` }, ...rest] : [{ role: "system", content: note }, ...messages];
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
  [/haiku-5/, 0.1, 0.5], // for prompts up to 100K tokens; a scan batch is far smaller
  [/haiku-4/, 1, 5],
];

// Usage per local day and model: { days: { "2026-10-08": { usd, calls, models: { id: { usd, calls } } } } }.
// Estimates from token counts at list price: a regular API key can't read the real balance.
const today = () => TKShared.localDay(); // YYYY-MM-DD in your time zone
function monthSpent(usage, month = today().slice(0, 7)) {
  return Object.entries(usage?.days || {}).reduce((sum, [d, v]) => (d.startsWith(month) ? sum + v.usd : sum), 0);
}

let spendQueue = Promise.resolve(); // parallel batches finish together; add their costs one at a time
// usd: the cost when the service reported it (or it was worked out elsewhere); otherwise from Claude's list prices.
function addSpend(model, usage, usd) {
  const price = PRICES.find(([re]) => re.test(model));
  if (usd == null && (!price || !usage)) return Promise.resolve(0);
  // Cache writes cost 1.25x the input price, cache reads 0.1x.
  const cost = usd ?? ((usage.input_tokens || 0) * price[1] + (usage.cache_creation_input_tokens || 0) * price[1] * 1.25 + (usage.cache_read_input_tokens || 0) * price[1] * 0.1 + (usage.output_tokens || 0) * price[2]) / 1e6;
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
// The same listing is judged differently depending on what you want it for: to use yourself, or
// as a fix & flip project. (Older versions had separate "fix" and "flip"; both mean "project" now.)
const lensOf = (lens) => (lens === "fix" || lens === "flip" ? "project" : LENS_RULES[lens] ? lens : "use");

const LENS_RULES = {
  use: `Lens: buy to use. The buyer wants a working item for themselves.
great = strong price for a working item; good = fair-to-good deal, worth a look; fair = market price, nothing special;
pass = overpriced, or for parts / not working / untested "as is" (unless the buyer says they want that).`,
  project: `Lens: fix & flip. The buyer repairs things and resells them. They LIKE broken, untested, "as is" and for-parts listings
when the likely fault is common and fixable, and working items priced well under what they resell for.
Score by the better of two angles:
- a fix-up: cheap compared with the for-parts and working prices, a well-known easy fault, cheap parts that are easy to get;
- a resale margin: "margin before repairs" (resale at the working median, minus fees, minus the buy price) minus likely parts, with low risk.
great = cheap with an easy fix, or a big margin with low risk; good = a reasonable project or a solid margin; fair = thin margin, nothing special;
pass = expensive for what it is, a hard fault, or no margin. Items that sell slowly, are fragile or heavy to ship, or have uncertain faults are riskier.
In the reason, say which angle makes it worth it (the fix, the margin, or both).
fault: the most likely problem in a few words ("none" if it works, "unknown" if you can't tell).
difficulty: 1 = easy (cleaning, cable, battery, shell, drop-in part) to 5 = very hard (board rework, unobtainable parts); 0 = can't tell or it works.
partsCost: rough whole-dollar cost of the parts, 0 if none or unknown.`,
};

// Rules of thumb for the buyer's hobby categories. Only applied where they fit the listing.
const FIX_KNOWLEDGE = `Repair and homebrew knowledge (use only where it fits the listing; never stretch it):
- Usually easy: dirty cartridge slots and contacts (e.g. NES 72-pin connector), dead save or clock batteries, leaking electrolytic capacitors in older handhelds, computers and power supplies (recap; check for corrosion), worn optical-drive lasers (replace, or fit an optical drive emulator), analog-stick drift, broken shells, hinges and screens on handhelds (replacement parts are common), missing power supplies or cables ("untested, no charger" is often fine), blown fuses.
- Hard or risky: board-level faults on modern consoles (HDMI ports and charge chips need microsoldering), Xbox 360 red ring, PS3 yellow light, liquid damage, battery-leak corrosion spread across traces, activation- or account-locked devices. A console banned from online play still runs offline homebrew.
- Homebrew: an active scene adds value and usefulness (e.g. Wii, PS2, PSP, PS Vita, 3DS/DS, original Xbox, GameCube, Dreamcast, some Switch units). Whether a unit can run it can depend on firmware version, model or serial number; say "depends on firmware/serial" unless the listing states it.`;

const lensSystem = (base, lens, interests) =>
  [base, LENS_RULES[lensOf(lens)], interests && `Buyer's interests: ${interests}`, lensOf(lens) === "project" && FIX_KNOWLEDGE]
    .filter(Boolean)
    .join("\n\n");

const money = (n) => `$${Math.round(n)}`;

function marketText(query, market) {
  if (!market) return `No sold-price reference for "${query || "this search"}". Judge price only from obvious cues.`;
  let t = `Sold-price reference for "${query}" (what buyers paid, incl. shipping): working/used median ${money(market.median)} (middle half ${money(market.p25)}-${money(market.p75)}, ${market.n} sales${market.confidence === "rough" ? "; few sales or a wide spread, so treat it as rough and don't lean on small differences" : ""}).`;
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

// Bulk-posted fake Marketplace listings: the most common scam the buyer sees, so it gets spelled out.
const SCAM_RULE = `Facebook scam pattern: bulk-posted fake listings end the title with a short random code of capital letters and digits
("Nintendo Game Boy Advance SP M2465", "Halo Special Edition Xbox S1337", "... U2X503"); there are many of them. When the listing
says "title ends with the code", mark it suspicious with a score under 15 and the flag "scam code in title", unless the code is
plausibly that exact item's real model or part number (Nikon D3100, Pentax K1000, PS Vita PCH1001). A price that looks too good
makes it more certain, not less.`;

// This prompt is the part most worth tuning yourself. Small local models
// follow short, concrete rules better than long abstract ones.
const VERDICT_BANDS = "Pick the verdict first, then a score inside its range: great 75-100, good 60-74, fair 45-59, pass 0-44, suspicious 0-30.";
const RANK_BASE = `You help a buyer skim secondhand listings. For each listing give a 0-100 score and one verdict: great, good, fair, pass or suspicious.
${VERDICT_BANDS}
suspicious = likely scam, counterfeit, or misleading, whatever the lens.
related: true if the listing is what the search (or the buyer's wants) is for, false if it is a different kind of item.
An unrelated listing is not automatically a pass: if it is a genuinely good find on its own terms, score it on its merits and set related to false.
Sold-price numbers only apply to related listings.
If the buyer listed wants or must-haves, a listing that misses one scores lower and the reason says which.
Red flags: price far below market with no explanation (bait), "replica"/"inspired"/"style" wording, box-only or photo-only listings,
vague or keyword-stuffed titles, shipping that makes the total expensive, seller with very low or no feedback.
Auctions: the price shown is only the current bid and will rise. Unless it ends within a few hours, don't rate it great or good on
price alone; judge what it is and what it is likely to sell for, and say it's an auction in the reason. Lots: judge the price per item.
SCAM_RULE
Use only the text you are given. Never invent specs or seller details. If information is missing, say so.
Keep each reason under 20 words. Flags are 1-4 word phrases. Return every id you were given.`.replace("SCAM_RULE", SCAM_RULE);

// One call that works for either provider; returns { text, cost }.
async function llmText({ system, userText, schema, signal, scan = false }) {
  const settings = await getSettings();
  const { provider, textModel } = settings;
  if (provider === "anthropic") return anthropicMessage({ system, content: userText, schema, signal, model: scan ? scanModelOf(settings) : undefined });
  if (provider === "openai") return openaiChat({ messages: [{ role: "system", content: system }, { role: "user", content: userText }], schema, signal });
  const text = await ollamaChat({
    model: textModel,
    format: schema,
    signal,
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
    // Some models wrap the JSON in ```json fences or a sentence; take the outermost object.
    const a = content.indexOf("{");
    const b = content.lastIndexOf("}");
    if (a >= 0 && b > a) {
      try {
        return JSON.parse(content.slice(a, b + 1));
      } catch {}
    }
    throw new Error("The AI's answer didn't make sense. Try again, or lower \"Listings per request\" in settings.");
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

// Scam signals read off the page, spelled out so the model can't miss them.
const scamNotes = (it) =>
  [
    it.titleCode && `title ends with the code "${it.titleCode}"`,
    it.offSite?.why?.length && `off-site contact: ${it.offSite.why.join("; ")}`,
    it.photoTwins > 0 && `the same photo is on ${it.photoTwins} other listing${it.photoTwins > 1 ? "s" : ""} under other titles (a stolen or stock photo)`,
  ].filter(Boolean);

async function rankBatch({ items, query, market, lens = "use", want = "", browse = "", signal }) {
  const { interests } = await getSettings();
  const listingText = items
    .map((it) => {
      const notes = [];
      if (it.vsWorking != null) notes.push(`${Math.round(it.vsWorking * 100)}% of working median`);
      if (it.vsParts != null) notes.push(`${Math.round(it.vsParts * 100)}% of for-parts median`);
      if (it.marginBeforeRepair != null) notes.push(`margin before repairs ${it.marginBeforeRepair < 0 ? "-" : ""}$${Math.abs(it.marginBeforeRepair)}`);
      const extra = (it.raw || "").replace(it.title, "").trim(); // the title is already on the line
      const scam = scamNotes(it);
      return `id ${it.id} | ${it.site} | ${it.title} | ${priceLine(it)}${notes.length ? ` | ${notes.join(", ")}` : ""}${scam.length ? ` | SCAM SIGNAL: ${scam.join("; ")}` : ""}\n  card text: ${extra}`;
    })
    .join("\n");

  const { text, cost } = await llmText({
    system: [lensSystem(RANK_BASE, lens, interests), browse && BROWSE_RULES(browse)].filter(Boolean).join("\n\n"),
    userText: [!browse && marketText(query, market), want && `What the buyer wants: ${want}`, `Listings:\n${listingText}`].filter(Boolean).join("\n\n"),
    schema: rankSchema(lens, !!browse),
    signal,
    scan: true,
  });
  if (cost > 0) await noteRankRate(items.length, cost);
  return { items: parseModelJson(text).items || [], cost };
}

// ---------- What a scan will cost, before you press Scan ----------
// What scoring has actually cost per listing with each model (recent scans weigh most); before
// there's any history, a rough figure from list prices and typical token counts.
// The model that scores listings in a scan (what the cost estimate and the score memory go by).
const scanModelOf = (s) => (s.provider === "anthropic" ? s.anthropicScanModel || s.anthropicModel : s.provider === "openai" ? s.oaiModel : s.textModel);
let rateQueue = Promise.resolve(); // batches finish together: one read-modify-write at a time
function noteRankRate(n, cost) {
  rateQueue = rateQueue
    .then(async () => {
      const model = scanModelOf(await getSettings());
      const { rankRate = {} } = await chrome.storage.local.get("rankRate");
      const r = (rankRate[model] ||= { usd: 0, items: 0 });
      r.usd += cost;
      r.items += n;
      if (r.items > 300) (r.usd /= 2), (r.items /= 2);
      await chrome.storage.local.set({ rankRate });
    })
    .catch(() => {});
  return rateQueue;
}
async function perListingCost() {
  const settings = await getSettings();
  const { provider, batchSize, oaiPriceIn, oaiPriceOut } = settings;
  if (provider === "ollama") return 0;
  const { rankRate = {} } = await chrome.storage.local.get("rankRate");
  const r = rankRate[scanModelOf(settings)];
  if (r?.items >= 10) return r.usd / r.items;
  // No history yet: Claude's list prices, or the prices you entered for another service.
  const price = provider === "anthropic" ? PRICES.find(([re]) => re.test(scanModelOf(settings))) : oaiPriceIn > 0 || oaiPriceOut > 0 ? [null, oaiPriceIn, oaiPriceOut] : null;
  if (!price) return 0;
  const b = Math.max(1, batchSize | 0);
  // About 200 input tokens a listing plus ~1,600 of instructions per request; about 160 output a listing plus ~300 a request.
  return ((200 + 1600 / b) * price[1] + (160 + 300 / b) * price[2]) / 1e6;
}

// ---------- One listing, in depth ----------

function itemSchema(lens) {
  const props = {
    score: { type: "integer" },
    verdict: { type: "string", enum: ["great", "good", "fair", "pass", "suspicious"] },
    summary: { type: "string" },
    flags: { type: "array", items: { type: "string" } },
    offerLow: { type: "integer" },
    offerHigh: { type: "integer" },
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

const ITEM_BASE = `You help a buyer decide whether to buy one secondhand listing.
Give a 0-100 score for how good a buy it is for this buyer's purpose, and one verdict: great, good, fair, pass or suspicious (likely scam, counterfeit, or misleading).
${VERDICT_BANDS}
summary: 2-3 plain sentences on what it is, whether the price is right, and the main risk.
flags: up to 5 short red or green flags (1-4 words each), e.g. "price far below market", "no return policy", "clear photos".
offerLow / offerHigh: a sensible whole-dollar offer range if negotiation is possible; 0 for both if the price is already fair or you cannot tell.
For an auction, offerLow / offerHigh are a sensible maximum-bid range instead, and the summary says the current bid will rise.
repair (fix-up and flip lenses): likely faults (most likely first), parts and tools needed, difficulty 1-5 (0 = can't tell), rough partsCost in whole dollars, and notes on teardown risks.
If the buyer listed wants or must-haves, say which ones the listing meets or misses.
SCAM_RULE
Moving the sale off the site is the other sure sign: a website (often written with spaces, "www . abc . com", "remove the spaces"),
a phone number written oddly ("505_507__6507"), WhatsApp, Telegram, email, "text me a screenshot", gift cards, or payment before seeing
the item. Any of those: suspicious, a score under 10, and the summary says plainly that it's the classic Marketplace scam.
Use only the information given. Never invent specs, history, or seller details. If something is missing, say so.`.replace("SCAM_RULE", SCAM_RULE);

async function analyzeListing({ listing, query, market, lens = "use", want = "", signal }) {
  const { interests } = await getSettings();
  const lines = [
    `site: ${listing.site}`,
    `title: ${listing.title}`,
    priceLine(listing),
    listing.condition && `condition: ${listing.condition}`,
    listing.seller && `seller: ${listing.seller}`,
    listing.shippingText && `shipping: ${listing.shippingText}`,
    listing.marginBeforeRepair != null && `margin before repairs: $${listing.marginBeforeRepair}`,
    listing.offerPlan?.open > 0 && `offer plan from sold prices: open at $${listing.offerPlan.open}, walk away above $${listing.offerPlan.walkAway}. Keep offerLow / offerHigh near it; move them only for something you read in this listing (condition, missing parts, a fair price already)`,
    ...scamNotes(listing).map((n) => `SCAM SIGNAL: ${n}`),
    listing.details && `details: ${listing.details}`,
  ].filter(Boolean);
  const { text, cost } = await llmText({
    system: lensSystem(ITEM_BASE, lens, interests),
    userText: [marketText(query, market), want && `What the buyer wants: ${want}`, `Listing:\n${lines.join("\n")}`].filter(Boolean).join("\n\n"),
    schema: itemSchema(lens),
    signal,
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

const IDEAS_SYSTEM = `You help a buyer find secondhand items on eBay or Facebook Marketplace by suggesting better searches.
Return 4 to 6 suggestions. Each has: query (the exact words to type, 2-7 words), kind, why (under 15 words), maxPrice (whole dollars, 0 for no cap), newest (true to sort newest first).
kind: idea = a different way to phrase what the buyer wants (model names, numbers, what sellers actually call it); narrow = tighter, to cut junk;
broaden = looser, to include good matches the current words exclude; typo = a realistic misspelling or spacing variant sellers use (fewer buyers find those listings);
alt = a related model or alternative name worth checking; price = the same search with a price cap near 80% of the sold median (only when a market reference is given).
Rules: if the buyer described what they want, most suggestions are kind idea. If result titles are given, base narrow, broaden, typo and alt on patterns you can see in them
(for example many "for parts" or "broken" listings means a narrow search that excludes them). On eBay you may use minus terms like -parts -repair and quoted phrases; on Facebook use plain words only, no operators.
Never invent products, specs or prices. Do not repeat the current search. Keep queries short.`;

const IDEAS_LENS = {
  use: "",
  project: "The buyer fixes things up and resells them: include searches that surface broken, untested, \"as is\" and for-parts listings (on eBay, words like \"for parts\", \"untested\", \"not working\"), and underpriced ones (misspellings, vague titles, bundles and lots).",
};

// Two sources, never mixed: what the buyer typed, or (when that's blank) the results on screen.
async function suggestSearches({ site, query, intent, titles, market, lens = "use", signal }) {
  const lines = intent
    ? [
        `site: ${site}`,
        IDEAS_LENS[lensOf(lens)],
        `what the buyer wants: ${intent}`,
        "Base every suggestion on what the buyer wants. Most should be kind idea, typo or alt.",
        query && `(background only: the page they're on searched "${query}". Use it only if their wants don't name an item; don't refine it otherwise.)`,
      ]
    : [
        `site: ${site}`,
        IDEAS_LENS[lensOf(lens)],
        query ? `current search: ${query}` : "this is a browse feed, not a search: suggest searches for the kinds of item that come up more than once in it",
        market && market.median != null && `sold-price reference: median $${market.median}, middle half $${market.p25}-$${market.p75}${market.parts ? `; for parts: median $${market.parts.median}` : ""}`,
        titles?.length ? `result titles so far:\n${titles.map((t) => `- ${t}`).join("\n")}` : "no results seen yet",
      ];
  lines.splice(0, lines.length, ...lines.filter(Boolean));
  const { text } = await llmText({ system: IDEAS_SYSTEM, userText: lines.join("\n"), schema: IDEAS_SCHEMA, signal });
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

// ---------- Photo fingerprints (no model) ----------
// The thumbnails of listings on screen, shrunk to 9×8 gray pixels and hashed (TKShared.dHash), so the panel can
// spot the same picture on other listings. Only the sites' own image hosts, without cookies, a few at a time;
// nothing leaves this computer but the image request the page already made.
const photoHashCache = new Map(); // image address -> hash ("" when it couldn't be read), while the worker is awake
async function photoHashes({ urls = [] }) {
  const hashes = {};
  for (const u of urls.slice(0, 8)) {
    if (photoHashCache.has(u)) {
      hashes[u] = photoHashCache.get(u);
      continue;
    }
    let h = "";
    if (TKShared.isListingImage(u)) {
      try {
        const res = await fetchWithTimeout(u, { credentials: "omit" }, 10 * 1000, "slow");
        const blob = res.ok && TKShared.isListingImage(res.url) ? await res.blob() : null;
        if (blob && blob.size < 3 * 1024 * 1024) {
          const bmp = await createImageBitmap(blob, { resizeWidth: 9, resizeHeight: 8, resizeQuality: "high" });
          const ctx = new OffscreenCanvas(9, 8).getContext("2d", { willReadFrequently: true });
          ctx.drawImage(bmp, 0, 0);
          bmp.close();
          const d = ctx.getImageData(0, 0, 9, 8).data;
          h = TKShared.dHash(Array.from({ length: 72 }, (_, i) => d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114));
        }
      } catch {}
    }
    if (photoHashCache.size > 3000) photoHashCache.clear();
    photoHashCache.set(u, h);
    hashes[u] = h;
  }
  return { hashes };
}

async function checkPhoto({ imageUrl, title, signal }) {
  const { visionModel, provider, oaiVisionModel } = await getSettings();
  // Photos come from listing pages, which can point an image anywhere (even at a service on this computer):
  // only eBay's and Facebook's own image hosts are fetched, or a photo already inline in the page.
  const inline = /^data:image\//.test(imageUrl);
  if (!inline && !TKShared.isListingImage(imageUrl)) throw new Error("Only photos from eBay and Facebook can be checked.");
  const imgRes = await fetchWithTimeout(imageUrl, { signal }, 30 * 1000, "The photo took too long to load.");
  if (!imgRes.ok) throw new Error(`Couldn't load the photo (${imgRes.status}).`);
  if (!inline && !TKShared.isListingImage(imgRes.url)) throw new Error("That photo was passed on to another site, so it wasn't checked.");
  const buf = await imgRes.arrayBuffer();
  if (buf.byteLength > 3.5 * 1024 * 1024) throw new Error("That photo is too large to check (over 3.5 MB).");
  const b64 = bufferToBase64(buf);
  const prompt = photoPrompt(title);
  let text;
  if (provider === "anthropic") {
    const type = (imgRes.headers.get("content-type") || "").split(";")[0];
    const media_type = ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(type) ? type : "image/jpeg";
    ({ text } = await anthropicMessage({
      signal,
      maxTokens: 4096,
      schema: PHOTO_SCHEMA,
      content: [
        { type: "image", source: { type: "base64", media_type, data: b64 } },
        { type: "text", text: prompt },
      ],
    }));
  } else if (provider === "openai") {
    const type = (imgRes.headers.get("content-type") || "").split(";")[0];
    const mime = /^image\//.test(type) ? type : "image/jpeg";
    ({ text } = await openaiChat({
      signal,
      model: oaiVisionModel || undefined, // blank: the main model, which must then handle images
      schema: PHOTO_SCHEMA,
      messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } }] }],
    }));
  } else {
    text = await ollamaChat({
      signal,
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
  // Best: from an eBay tab you have open, exactly like eBay's own pages make requests (same site,
  // same cookies, same browser headers). eBay is much less likely to ask for a browser check then.
  const tabs = await chrome.tabs.query({ url: "https://www.ebay.com/*" }).catch(() => []);
  for (const tab of tabs.filter((t) => !t.discarded && t.status === "complete")) {
    try {
      const [{ result } = {}] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        args: [url],
        func: async (u) => {
          const res = await fetch(u, { credentials: "include", signal: AbortSignal.timeout(30000) });
          return { status: res.status, html: res.ok ? await res.text() : "" };
        },
      });
      if (result) return { ...result, via: "tab" };
    } catch {
      // that tab couldn't do it (closed, navigating, a check page); try the next, then the fallback
    }
  }
  // Otherwise from here. eBay trusts this far less than a request from its own page (other site,
  // other headers), so a refusal here is remembered on its own and doesn't stop lookups made from
  // an eBay tab. Until it lapses, say so without asking eBay again.
  const { soldWorkerPausedUntil = 0 } = await chrome.storage.local.get("soldWorkerPausedUntil");
  if (Date.now() < soldWorkerPausedUntil) return { status: 0, html: "", via: "worker", pausedUntil: soldWorkerPausedUntil };
  const res = await fetchWithTimeout(url, { credentials: "include" }, 30 * 1000, "eBay took too long to answer.");
  return { status: res.status, html: res.ok ? await res.text() : "", via: "worker" };
}
// The page saw eBay's browser check in an answer fetched from here.
async function soldWorkerBlocked() {
  await chrome.storage.local.set({ soldWorkerPausedUntil: Date.now() + 30 * 60 * 1000 });
  return true;
}

// ---------- Fonts ----------
// Page scripts get the bundled typeface as bytes and add it with the FontFace API. Nothing is
// exposed as a web-accessible resource, so pages can't detect the extension through its fonts,
// and a site's font rules can't block them.
const FONT_FILES = /^bricolage-grotesque\.woff2$/;
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
  const { anthropicKey, oaiKey, ...rest } = await getSettings();
  return { ...rest, scanModel: scanModelOf(rest), hasKey: !!anthropicKey, hasOaiKey: !!oaiKey, oaiName: rest.oaiUrl ? oaiName(rest.oaiUrl) : "", scanRate: await perListingCost() };
}

// Settings, or one section of it ("model" for the AI setup the panel's setup card points at).
const openOptions = async ({ section } = {}) =>
  ["model", "spending", "backup"].includes(section) ? chrome.tabs.create({ url: chrome.runtime.getURL(`options/options.html#sec-${section}`) }) : chrome.runtime.openOptionsPage();

// Saved searches, opened in background tabs in one go (a page can only open one tab per click).
// Only search addresses on the sites this works on (lib/sites.js), and at most 12.
async function openTabs({ urls }) {
  const ok = (u) => {
    try {
      const { protocol, hostname, pathname } = new URL(u);
      return protocol === "https:" && TKSites.isSearchUrl({ hostname, pathname });
    } catch {
      return false;
    }
  };
  const list = (urls || []).filter(ok).slice(0, 12);
  for (const url of list) await chrome.tabs.create({ url, active: false });
  return list.length;
}
// ---------- Message router ----------

// ---------- Stopping ----------
// A request the page tags with a reqId can be canceled: Stop sends those ids here and each one's
// fetch is aborted. (A model may still bill for what it had already read.)
const inflight = new Map(); // reqId -> AbortController
async function abort({ ids }) {
  for (const id of ids || []) inflight.get(id)?.abort();
  return true;
}

// ---------- One writer for what tabs share ----------
// Tabs send changes to shared records here (see TKShared.applyEdit) and they're applied one at a time,
// so two tabs saving, hiding or filtering at the same moment can't undo each other.
const SHARED = new Set(TKShared.SHARED);
let editQueue = Promise.resolve();
const oneAtATime = (fn) => {
  const run = editQueue.then(fn);
  editQueue = run.catch(() => {});
  return run;
};
function storeEdit({ name, edit }) {
  if (!SHARED.has(name)) return Promise.reject(new Error("Not a shared record."));
  return oneAtATime(async () => {
    const next = TKShared.applyEdit((await chrome.storage.local.get(name))[name], edit);
    if (edit.clear && !Object.keys(next).length) await chrome.storage.local.remove(name);
    else await chrome.storage.local.set({ [name]: next });
    return next;
  });
}
// A turn at an eBay sold-price lookup (TKShared.soldSlot), booked here so tabs can't both take the last one.
function soldSlot({ perHour, gap }) {
  return oneAtATime(async () => {
    const { soldLog, soldCooldownUntil } = await chrome.storage.local.get(["soldLog", "soldCooldownUntil"]);
    const slot = TKShared.soldSlot({ log: soldLog, cooldownUntil: soldCooldownUntil }, Date.now(), { perHour, gap });
    if (slot.log) await chrome.storage.local.set({ soldLog: slot.log });
    return slot;
  });
}

// A store page with the panel on it: there the icon opens or tucks away the panel instead of the popup.
async function panelTab(_payload, sender) {
  if (sender?.tab?.id >= 0 && sender.frameId === 0) await chrome.action.setPopup({ tabId: sender.tab.id, popup: "" });
}

const HANDLERS = { storeEdit, soldSlot, rankBatch, analyzeListing, suggestSearches, checkPhoto, photoHashes, fetchSoldHtml, soldWorkerBlocked, getFont, openOptions, openHome, openTabs, abort, panelTab, getSettings: getPageSettings };

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const handler = HANDLERS[msg?.type];
  if (!handler) return false;
  const payload = msg.payload || {};
  const id = typeof payload.reqId === "string" ? payload.reqId : "";
  if (id) {
    const ac = new AbortController();
    inflight.set(id, ac);
    payload.signal = ac.signal;
  }
  (async () => {
    try {
      sendResponse({ ok: true, data: await handler(payload, sender) });
    } catch (err) {
      sendResponse({ ok: false, error: err.message || String(err) });
    } finally {
      if (id) inflight.delete(id);
    }
  })();
  return true; // keep the channel open for the async reply
});

// ---------- Right-click on a photo ----------
// The content script on the page does the work and shows the answer; we just point it at the image.

const MENU_ID = "tirekick-photo";
const HOME_MENU_ID = "tirekick-home";
const LOOKUP_MENU_ID = "tirekick-lookup";

// Older storage, brought up to date once per storage version (TKShared.upgradeStorage): the old word lists,
// themes and modes, sold prices from an older formula, and any record an older version left in a shape
// the panel can't read.
async function upgradeStorage() {
  const all = await chrome.storage.local.get(null);
  if (all.storageVersion >= TKShared.STORAGE_VERSION) return;
  const { set, remove, changed } = TKShared.upgradeStorage(all);
  if (remove.length) await chrome.storage.local.remove(remove);
  await chrome.storage.local.set({ ...set, storageVersion: TKShared.STORAGE_VERSION });
  if (changed.length) console.info("[Tirekick] storage brought up to date:", changed.join(", "));
}

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details?.reason === "install") chrome.runtime.openOptionsPage(); // first run: pick a model, paste a key
  // Defaults are not copied into storage: getSettings() fills in whatever you haven't set, so a better
  // default (a new model, say) reaches every install that never chose otherwise.
  await upgradeStorage().catch((e) => console.warn("[Tirekick] storage upgrade:", e.message));
  await syncAutoScripts().catch((e) => console.warn("[Tirekick]", e.message));
  refreshOpenTabs().catch(() => {});
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: "Check this photo with Tirekick",
      contexts: ["image"],
      documentUrlPatterns: TKSites.matches(),
    });
    // The icon's own right-click menu: the browser fills most of it; Tirekick adds only this.
    chrome.contextMenus.create({ id: HOME_MENU_ID, title: "Open Tirekick in a tab", contexts: ["action"] });
    // Anywhere: select a thing's name and see what it sells for, or search for it on both sites.
    chrome.contextMenus.create({ id: LOOKUP_MENU_ID, title: "Look up \u201c%s\u201d on eBay and Marketplace", contexts: ["selection"] });
  });
  updateBadge().catch(() => {});
});

// ---------- The side tab ----------
// With "showTab" on, the page scripts are registered to load on eBay and Facebook pages.
// With it off, nothing runs there until you click the toolbar icon (the gentlest option).

const AUTO_ID = "tirekick-auto";
const OLD_AUTO_IDS = ["second-look-auto"]; // registered before the rename; left alone, it would load the page scripts twice
// What a page gets, in load order: shared pieces, the plain rules, the site adapters, then the panel.
const CONTENT_FILES = ["lib/sites.js", "lib/shared.js", "lib/theme.js", "content/rules.js", "content/adapters.js", "lib/sold.js", "content/home.js", "content/panel.js"];

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
    matches: TKSites.matches(), // every site in lib/sites.js (each also needs its host permission in manifest.json)
    js: CONTENT_FILES,
    runAt: "document_end", // the tab shows as soon as the page is parsed, not after every image loads
    persistAcrossSessions: true,
  };
  const old = await chrome.scripting.getRegisteredContentScripts({ ids: OLD_AUTO_IDS });
  if (old.length) await chrome.scripting.unregisterContentScripts({ ids: old.map((s) => s.id) });
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [AUTO_ID] });
  if (showTab && !existing.length) await chrome.scripting.registerContentScripts([def]);
  else if (showTab) await chrome.scripting.updateContentScripts([def]); // pick up changes after an update
  else if (existing.length) await chrome.scripting.unregisterContentScripts({ ids: [AUTO_ID] });
}
chrome.storage.onChanged.addListener((changes) => {
  if (changes.showTab) syncAutoScripts().catch((e) => console.warn("[Tirekick]", e.message));
});
chrome.runtime.onStartup.addListener(() => {
  upgradeStorage().catch(() => {}); // a restored profile, or an update applied while the browser was closed
  syncAutoScripts().catch(() => {});
  updateBadge().catch(() => {});
});

// After an install or an update, eBay and Marketplace tabs that are already open get the new page scripts, so
// you don't have to reload them. The old copy steps aside within a second (teardown in content/panel.js).
async function refreshOpenTabs() {
  const { showTab } = await getSettings();
  if (!showTab) return;
  const tabs = await chrome.tabs.query({ url: TKSites.matches() });
  await sleep(1500);
  for (const t of tabs) if (t.id >= 0 && !t.discarded) await ensureInjected(t.id).catch(() => {});
}

// ---------- Nothing runs on eBay/Facebook until you ask (when the tab is off) ----------
// No content scripts are declared in the manifest, so page loads are untouched.
// Clicking the toolbar icon (or the right-click item) injects the scripts on demand.

async function ensureInjected(tabId) {
  const [{ result: present } = {}] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => !!window.__tirekickPanel,
  });
  if (!present) {
    await chrome.scripting.executeScript({ target: { tabId }, files: CONTENT_FILES });
  }
  return !!present;
}

// On a page Tirekick doesn't work on, the icon says so for a few seconds instead of doing nothing.
// ---------- The toolbar badge ----------
// A number on the icon when something saved is worth another look: a saved listing got cheaper, or a
// saved search had listings at your price. Nothing is checked in the background: this only reads what
// the panel recorded the last time those listings were on your screen. Looking at Home marks them seen.
async function updateBadge() {
  const { saved, savedSearches, alertsAck } = await chrome.storage.local.get(["saved", "savedSearches", "alertsAck"]);
  const fresh = TKShared.alerts(saved, savedSearches, alertsAck).filter((a) => a.isNew);
  const base = chrome.runtime.getManifest().action.default_title;
  await chrome.action.setBadgeBackgroundColor({ color: "#1A2B4C" }); // navy, as the icon tile (lib/theme.js)
  await chrome.action.setBadgeText({ text: fresh.length > 99 ? "99+" : fresh.length ? String(fresh.length) : "" });
  await chrome.action.setTitle({ title: fresh.length ? `${base}\n${TKShared.alertSummary(fresh)}. Click the icon to see them.` : base });
}
chrome.storage.onChanged.addListener((changes) => {
  if (changes.saved || changes.savedSearches || changes.alertsAck) updateBadge().catch(() => {});
});

// Tirekick's own page (hub/hub.html): look something up, saved listings and searches, Home. One tab:
// an open one comes to the front (with new words, if there are any).
async function openHome({ q = "" } = {}) {
  const base = chrome.runtime.getURL("hub/hub.html");
  const url = q ? `${base}?q=${encodeURIComponent(q.trim().slice(0, 200))}` : base;
  // Our own pages are found through getContexts (tabs.query can't see extension URLs without the "tabs" permission).
  const [open] = await chrome.runtime.getContexts({ contextTypes: ["TAB"] }).then((cs) => cs.filter((x) => x.documentUrl?.startsWith(base) && x.tabId >= 0)).catch(() => []);
  if (open) {
    await chrome.tabs.update(open.tabId, { active: true, ...(q ? { url } : {}) });
    await chrome.windows.update(open.windowId, { focused: true });
    return;
  }
  await chrome.tabs.create({ url });
}

// Everywhere else the icon opens Tirekick's own page as a popup (manifest default_popup). On a store page
// the panel clears that for its tab (panelTab), so the icon opens the panel, or tucks it away; with something
// new to look at it opens on Home instead. If the tab has since left the store, the popup comes back.
const POPUP = "hub/hub.html?popup";
async function showPopup(tabId) {
  await chrome.action.setPopup({ tabId, popup: POPUP }).catch(() => {});
  try {
    await chrome.action.openPopup();
  } catch {
    await openHome(); // a browser without openPopup: the same page in a tab
  }
}
async function openPanel(tabId) {
  try {
    const { saved, savedSearches, alertsAck } = await chrome.storage.local.get(["saved", "savedSearches", "alertsAck"]);
    const news = TKShared.alerts(saved, savedSearches, alertsAck).some((a) => a.isNew);
    await ensureInjected(tabId);
    const [{ result: ours } = {}] = await chrome.scripting.executeScript({
      target: { tabId },
      args: [news],
      func: (news) => {
        if (!window.Tirekick?.pageType()) return false;
        window.dispatchEvent(news ? new CustomEvent("tirekick-show", { detail: { view: "home", toggle: true } }) : new CustomEvent("tirekick-toggle"));
        return true;
      },
    });
    if (!ours) await showPopup(tabId);
  } catch {
    await showPopup(tabId).catch(() => {}); // a page the extension can't touch
  }
}

chrome.action.onClicked.addListener((tab) => {
  if (tab?.id) openPanel(tab.id);
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === HOME_MENU_ID) return openHome();
  if (info.menuItemId === LOOKUP_MENU_ID) return openHome({ q: info.selectionText || "" });
  if (info.menuItemId !== MENU_ID || !tab?.id) return;
  try {
    await ensureInjected(tab.id);
    await chrome.tabs.sendMessage(tab.id, { type: "tirekick-check-photo", imageUrl: info.srcUrl });
  } catch (e) {
    console.warn("[Tirekick] photo check failed to start:", e.message);
  }
});
