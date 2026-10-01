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
  const { anthropicKey, anthropicModel, anthropicUrl } = await getSettings();
  if (!anthropicKey) throw new Error("No Claude API key yet. Open the extension options and paste one in.");
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
  return (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
}

const RANK_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "integer" },
          related: { type: "boolean" },
          score: { type: "integer" },
          verdict: { type: "string", enum: ["great", "good", "fair", "pass", "suspicious"] },
          flags: { type: "array", items: { type: "string" } },
          reason: { type: "string" },
        },
        required: ["id", "related", "score", "verdict", "flags", "reason"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
};

// This prompt is the part most worth tuning yourself. Small local models
// follow short, concrete rules better than long abstract ones.
const RANK_SYSTEM = `You help a careful buyer skim second-hand listings.
For each listing, give a 0-100 score for how worth it is to open and look closer, and one verdict:
great = strong price for what it appears to be; good = fair-to-good deal, worth a look;
fair = market price, nothing special; pass = overpriced, or for parts when not wanted;
suspicious = likely scam, counterfeit, or misleading.
Also set related: true if the listing is what the search is for, false if it is a different kind of item.
A listing that does not match the search is NOT automatically a pass: if it is still a genuinely good deal on what it is
(a bargain on something else), score and label it on its own merits and set related to false. Only mark an unrelated listing
"pass" when it is also a poor deal. Price-versus-market numbers only apply to related listings; ignore them for unrelated ones.
If there is no search term, set related to true.
Red flags to check: price far below the market reference (bait or scam), "replica"/"inspired"/"style" wording,
"for parts", "not working", "as is", vague or keyword-stuffed titles, shipping that makes the total expensive,
seller with very low or no feedback, item that doesn't match the search.
Use only the text you are given. Never invent specs or seller details. If information is missing, say so.
Keep each reason under 20 words. Flags are 1-4 word phrases. Return every id you were given.`;

// One call that works for either provider and returns the model's text.
async function llmText({ system, userText, schema }) {
  const { provider, textModel } = await getSettings();
  if (provider === "anthropic") return anthropicMessage({ system, content: userText, schema });
  return ollamaChat({
    model: textModel,
    format: schema,
    messages: [
      { role: "system", content: system },
      { role: "user", content: userText },
    ],
  });
}

function parseModelJson(content) {
  try {
    return JSON.parse(content);
  } catch {
    throw new Error("The model returned something unreadable. Try again, or lower \"Listings per request\" in settings.");
  }
}

async function rankBatch({ items, query, market }) {
  const marketLine = market
    ? `Market reference for "${query}": median recent eBay sold price ${market.currency}${market.median} (middle half ${market.currency}${market.p25}-${market.currency}${market.p75}, from ${market.n} sales).`
    : `No market reference available for "${query || "this search"}". Judge price only from obvious cues.`;
  const listingText = items
    .map((it) => {
      const ratio = it.priceVsMarket != null ? ` | price is ${Math.round(it.priceVsMarket * 100)}% of market median` : "";
      const extra = (it.raw || "").replace(it.title, "").trim(); // the title is already on the line
      return `id ${it.id} | ${it.site} | ${it.title} | price: ${it.priceText || "unknown"}${ratio}\n  card text: ${extra}`;
    })
    .join("\n");

  const content = await llmText({
    system: RANK_SYSTEM,
    userText: `${marketLine}\n\nListings:\n${listingText}`,
    schema: RANK_SCHEMA,
  });
  const parsed = parseModelJson(content);
  return parsed.items || [];
}

// ---------- One listing, in depth ----------

const ITEM_SCHEMA = {
  type: "object",
  properties: {
    score: { type: "integer" },
    verdict: { type: "string", enum: ["great", "good", "fair", "pass", "suspicious"] },
    summary: { type: "string" },
    flags: { type: "array", items: { type: "string" } },
    questions: { type: "array", items: { type: "string" } },
    offerLow: { type: "integer" },
    offerHigh: { type: "integer" },
  },
  required: ["score", "verdict", "summary", "flags", "questions", "offerLow", "offerHigh"],
  additionalProperties: false,
};

const ITEM_SYSTEM = `You help a careful buyer decide whether to buy one second-hand listing.
Give a 0-100 score for how good a buy it looks, and one verdict:
great = strong price for what it appears to be; good = fair-to-good deal; fair = market price, nothing special;
pass = overpriced, wrong item, or not worth the risk; suspicious = likely scam, counterfeit, or misleading.
summary: 2-3 plain sentences on what it is, whether the price is right, and the main risk.
flags: up to 5 short red or green flags (1-4 words each), e.g. "price far below market", "no return policy", "clear photos".
questions: 3-5 specific questions to ask the seller before buying, based on what is missing or unclear in the listing.
offerLow / offerHigh: a sensible whole-dollar offer range if negotiation is possible; use 0 for both if the price is already fair or you cannot tell.
Use only the information given. Never invent specs, history, or seller details. If something is missing, say so.`;

async function analyzeListing({ listing, query, market }) {
  const marketLine = market
    ? `Market reference for "${query}": median recent eBay sold price $${market.median} (middle half $${market.p25}-$${market.p75}, from ${market.n} sales).`
    : "No market reference available. Judge price only from obvious cues.";
  const lines = [
    `site: ${listing.site}`,
    `title: ${listing.title}`,
    `price: ${listing.priceText || "unknown"}`,
    listing.condition && `condition: ${listing.condition}`,
    listing.seller && `seller: ${listing.seller}`,
    listing.shipping && `shipping: ${listing.shipping}`,
    listing.details && `details: ${listing.details}`,
  ].filter(Boolean);
  const content = await llmText({
    system: ITEM_SYSTEM,
    userText: `${marketLine}\n\nListing:\n${lines.join("\n")}`,
    schema: ITEM_SCHEMA,
  });
  return parseModelJson(content);
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

async function suggestSearches({ site, query, intent, titles, market }) {
  const lines = [
    `site: ${site}`,
    query && `current search: ${query}`,
    intent && `what the buyer wants: ${intent}`,
    market && `sold-price reference: median $${market.median}, middle half $${market.p25}-$${market.p75}`,
    titles?.length ? `result titles so far:\n${titles.map((t) => `- ${t}`).join("\n")}` : "no results seen yet",
  ].filter(Boolean);
  const content = await llmText({ system: IDEAS_SYSTEM, userText: lines.join("\n"), schema: IDEAS_SCHEMA });
  return parseModelJson(content).suggestions || [];
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
    text = await anthropicMessage({
      maxTokens: 4096,
      schema: PHOTO_SCHEMA,
      content: [
        { type: "image", source: { type: "base64", media_type, data: b64 } },
        { type: "text", text: prompt },
      ],
    });
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

async function fetchSoldHtml({ query }) {
  const url = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Sold=1&LH_Complete=1&_ipg=60`;
  // Sent with your eBay cookies so it looks like the one ordinary search it is.
  const res = await fetchWithTimeout(url, { credentials: "include" }, 30 * 1000, "eBay took too long to answer.");
  return { status: res.status, html: res.ok ? await res.text() : "" };
}

// ---------- Message router ----------

// Page scripts get the settings without the API key: they never need it.
async function getPageSettings() {
  const { anthropicKey, ...rest } = await getSettings();
  return { ...rest, hasKey: !!anthropicKey };
}

const HANDLERS = { rankBatch, analyzeListing, suggestSearches, checkPhoto, fetchSoldHtml, getSettings: getPageSettings };

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

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(null);
  await chrome.storage.local.set({ ...DEFAULTS, ...current });
  await chrome.storage.local.remove("soldCooldownUntil"); // a fresh install/update starts with no pause
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
