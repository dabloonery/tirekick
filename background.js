// Second Look — background service worker.
// Everything that talks to the outside world lives here:
//   1. your local Ollama server (text ranking + optional photo check)
//   2. listing photos (fetched and base64-encoded for the vision model)
//   3. eBay sold listings (used as a market-price reference)
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
};

async function getSettings() {
  const stored = await chrome.storage.local.get(DEFAULTS);
  return { ...DEFAULTS, ...stored };
}

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
    res = await fetch(`${ollamaUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
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
// thinking is always on and effort defaults to medium, so we set effort low for this
// simple ranking task; temperature and forced tool_choice are not accepted.

async function anthropicMessage({ system, content, schema, maxTokens = 4096 }) {
  const { anthropicKey, anthropicModel, anthropicUrl } = await getSettings();
  if (!anthropicKey) throw new Error("No Claude API key yet. Open the extension options and paste one in.");
  const body = {
    model: anthropicModel,
    max_tokens: maxTokens,
    messages: [{ role: "user", content }],
    output_config: { effort: "low" },
    fallbacks: "default", // server-side fallback if a safety classifier declines the request
  };
  if (system) body.system = system;
  if (schema) body.output_config.format = { type: "json_schema", schema };

  let res;
  try {
    res = await fetch(`${anthropicUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "server-side-fallback-2026-07-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Error("Can't reach the Claude API. Check your internet connection.");
  }
  if (res.status === 401) throw new Error("The Claude API key was rejected. Check it in the extension options.");
  if (res.status === 429) throw new Error("Claude API rate limit hit. Wait a moment and scan again.");
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Claude API error ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  if (data.stop_reason === "refusal") throw new Error("Claude declined this request.");
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
          score: { type: "integer" },
          verdict: { type: "string", enum: ["great", "good", "fair", "pass", "suspicious"] },
          flags: { type: "array", items: { type: "string" } },
          reason: { type: "string" },
        },
        required: ["id", "score", "verdict", "flags", "reason"],
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
fair = market price, nothing special; pass = overpriced, wrong item, or for parts when not wanted;
suspicious = likely scam, counterfeit, or misleading.
Red flags to check: price far below the market reference (bait or scam), "replica"/"inspired"/"style" wording,
"for parts", "not working", "as is", vague or keyword-stuffed titles, shipping that makes the total expensive,
seller with very low or no feedback, item that doesn't match the search.
Use only the text you are given. Never invent specs or seller details. If information is missing, say so.
Keep each reason under 20 words. Flags are 1-4 word phrases. Return every id you were given.`;

async function rankBatch({ items, query, market }) {
  const { textModel, provider } = await getSettings();
  const marketLine = market
    ? `Market reference for "${query}": median recent eBay sold price ${market.currency}${market.median} (middle half ${market.currency}${market.p25}-${market.currency}${market.p75}, from ${market.n} sales).`
    : `No market reference available for "${query || "this search"}". Judge price only from obvious cues.`;
  const listingText = items
    .map((it) => {
      const ratio = it.priceVsMarket != null ? ` | price is ${Math.round(it.priceVsMarket * 100)}% of market median` : "";
      return `id ${it.id} | ${it.site} | ${it.title} | price: ${it.priceText || "unknown"}${ratio}\n  card text: ${it.raw}`;
    })
    .join("\n");

  const userText = `${marketLine}\n\nListings:\n${listingText}`;
  const content =
    provider === "anthropic"
      ? await anthropicMessage({ system: RANK_SYSTEM, content: userText, schema: RANK_SCHEMA })
      : await ollamaChat({
          model: textModel,
          format: RANK_SCHEMA,
          messages: [
            { role: "system", content: RANK_SYSTEM },
            { role: "user", content: userText },
          ],
        });
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("The model returned something unreadable. Try again, or lower \"Listings per request\" in settings.");
  }
  return parsed.items || [];
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

async function checkPhoto({ imageUrl, title }) {
  const { visionModel, provider } = await getSettings();
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Couldn't load the photo (${imgRes.status}).`);
  const b64 = bufferToBase64(await imgRes.arrayBuffer());
  const prompt = `The listing title is: "${title}". In 2-3 short sentences: what is in this photo, does it look like a real photo of a used item or a stock/catalog image, is any damage visible, and does it match the title?`;
  if (provider === "anthropic") {
    const type = (imgRes.headers.get("content-type") || "").split(";")[0];
    const media_type = ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(type) ? type : "image/jpeg";
    return anthropicMessage({
      maxTokens: 1024,
      content: [
        { type: "image", source: { type: "base64", media_type, data: b64 } },
        { type: "text", text: prompt },
      ],
    });
  }
  return ollamaChat({
    model: visionModel,
    numCtx: 4096,
    messages: [
      {
        role: "user",
        content: prompt,
        images: [b64],
      },
    ],
  });
}

// ---------- eBay sold comps ----------
// Returns raw HTML; the content script parses it (service workers have no DOMParser).

async function fetchSoldHtml({ query }) {
  const url = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Sold=1&LH_Complete=1&_ipg=60`;
  // Sent with your eBay cookies so it looks like the one ordinary search it is.
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`eBay sold search failed (${res.status}).`);
  return res.text();
}

// ---------- Message router ----------

const HANDLERS = { rankBatch, checkPhoto, fetchSoldHtml, getSettings };

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const handler = HANDLERS[msg?.type];
  if (!handler) return false;
  handler(msg.payload || {})
    .then((data) => sendResponse({ ok: true, data }))
    .catch((err) => sendResponse({ ok: false, error: err.message || String(err) }));
  return true; // keep the channel open for the async reply
});

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(null);
  await chrome.storage.local.set({ ...DEFAULTS, ...current });
});
