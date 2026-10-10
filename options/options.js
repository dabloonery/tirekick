const FIELDS = ["provider", "anthropicKey", "anthropicModel", "oaiPreset", "oaiUrl", "oaiKey", "oaiModel", "oaiVisionModel", "oaiPriceIn", "oaiPriceOut", "ollamaUrl", "textModel", "visionModel", "batchSize", "useSoldComps", "interests", "feePct",
  "hideWords", "needWords", "minSellerRatings", "minSellerPct", "autoMarks", "monthlyBudget", "showTab"];
// Fields that may be left empty on purpose (everything else goes back to its default when cleared).
const MAY_BE_EMPTY = ["anthropicKey", "oaiKey", "oaiModel", "oaiVisionModel", "interests", "hideWords", "needWords"];

// Services that speak the OpenAI chat API. Picking one fills in its address.
const PRESETS = {
  openrouter: { url: "https://openrouter.ai/api/v1", hint: "One key for models from Google, Meta, Mistral, DeepSeek, Qwen and more. Key at openrouter.ai/keys. Costs are reported exactly." },
  openai: { url: "https://api.openai.com/v1", hint: "Key at platform.openai.com/api-keys." },
  gemini: { url: "https://generativelanguage.googleapis.com/v1beta/openai", hint: "Key at aistudio.google.com/apikey. There's a free tier with rate limits." },
  deepseek: { url: "https://api.deepseek.com/v1", hint: "Key at platform.deepseek.com/api_keys." },
  mistral: { url: "https://api.mistral.ai/v1", hint: "Key at console.mistral.ai/api-keys." },
  xai: { url: "https://api.x.ai/v1", hint: "Key at console.x.ai." },
  lmstudio: { url: "http://localhost:1234/v1", hint: "Free and private. In LM Studio, load a model and start the server (Developer tab); no key needed." },
  custom: { url: "", hint: "Any service with an OpenAI-style /v1/chat/completions. Test connection asks your permission to reach it." },
};
const showPreset = () => {
  document.getElementById("oaiPresetHint").textContent = PRESETS[document.getElementById("oaiPreset").value]?.hint || "";
};
// Second Look may reach the listed services already; any other address needs your OK once.
async function allowOrigin(url) {
  let origin;
  try {
    origin = new URL(url).origin;
  } catch {
    return false;
  }
  const origins = [`${origin}/*`];
  return (await chrome.permissions.contains({ origins })) || chrome.permissions.request({ origins }).catch(() => false);
}
const msg = document.getElementById("msg");
const testMsg = document.getElementById("testMsg");
// A short note at the bottom of the page ("Saved."), gone after a moment.
let noteTimer = 0;
const note = (text) => {
  msg.textContent = text;
  msg.classList.add("show");
  clearTimeout(noteTimer);
  noteTimer = setTimeout(() => msg.classList.remove("show"), 2200);
};

async function load() {
  // Settings with defaults filled in come from the background script (it leaves out the key).
  const res = await chrome.runtime.sendMessage({ type: "getSettings" }).catch(() => null);
  const s = { ...(res?.ok ? res.data : {}), ...(await chrome.storage.local.get(FIELDS)) };
  for (const f of FIELDS) {
    const el = document.getElementById(f);
    if (el.type === "checkbox") el.checked = !!s[f];
    else el.value = s[f] ?? "";
  }
  showProvider();
}

// What the Claude API has cost (estimated), from the record the background keeps per day and model.
const NAMES = { "claude-opus-5-5": "Opus 5.5", "claude-sonnet-5-5": "Sonnet 5.5", "claude-haiku-4-5": "Haiku 4.5" };
const usd = (n) => (n > 0 && n < 0.01 ? "<$0.01" : `$${n.toFixed(2)}`);
async function showSpend() {
  const { usage } = await chrome.storage.local.get("usage");
  const now = new Date();
  const day = now.toLocaleDateString("en-CA");
  const month = day.slice(0, 7);
  const last = new Date(now.getFullYear(), now.getMonth() - 1, 15).toLocaleDateString("en-CA").slice(0, 7);
  let t = 0, m = 0, l = 0;
  const models = {};
  for (const [d, v] of Object.entries(usage?.days || {})) {
    if (d === day) t += v.usd;
    if (d.startsWith(last)) l += v.usd;
    if (!d.startsWith(month)) continue;
    m += v.usd;
    for (const [id, mv] of Object.entries(v.models || {})) {
      models[id] ||= { usd: 0, calls: 0 };
      models[id].usd += mv.usd;
      models[id].calls += mv.calls;
    }
  }
  const grid = document.getElementById("spendGrid");
  grid.replaceChildren(
    ...[["Today", t], ["This month", m], ["Last month", l]].map(([label, v]) => {
      const div = document.createElement("div");
      const span = document.createElement("span");
      const b = document.createElement("b");
      span.textContent = label;
      b.textContent = usd(v);
      div.append(span, b);
      return div;
    })
  );
  const rows = Object.entries(models).sort((a, b) => b[1].usd - a[1].usd);
  const parts = rows.map(([id, v]) => `${NAMES[id] || id} ${usd(v.usd)} (${v.calls} calls, ~${usd(v.usd / v.calls)} each)`);
  const rest = m - rows.reduce((sum, [, v]) => sum + v.usd, 0); // recorded before the per-model split
  if (rest >= 0.005) parts.push(`not split by model ${usd(rest)}`);
  document.getElementById("spendModels").textContent = parts.length ? "This month: " + parts.join(" \u00b7 ") : "Nothing spent on Claude this month.";
}
document.getElementById("resetSpend").addEventListener("click", async () => {
  if (!confirm("Reset the spending counter? This only clears Second Look's own estimate, not anything at Anthropic.")) return;
  await chrome.storage.local.remove(["usage", "spend"]);
  showSpend();
  note("Spending counter reset.");
});
chrome.storage.onChanged.addListener((c) => {
  if (c.usage) showSpend();
  if (c.saved || c.savedSearches) showMemory();
  // The panel's model menu changes these too; keep this page in step (unless you're typing in one).
  for (const f of ["provider", "anthropicModel", "oaiModel", "textModel"]) {
    const el = document.getElementById(f);
    if (c[f] && document.activeElement !== el) el.value = c[f].newValue ?? el.value;
  }
  if (c.provider) showProvider();
});
showSpend();

// What's remembered in this browser, and a way to clear it.
async function showMemory() {
  const { notInterested = {}, listingMemory = {}, saved = {}, savedSearches = {} } = await chrome.storage.local.get(["notInterested", "listingMemory", "saved", "savedSearches"]);
  const n = Object.keys(notInterested).length;
  const m = Object.keys(listingMemory).length;
  const sv = Object.keys(saved).length + Object.keys(savedSearches).length;
  document.getElementById("memoryInfo").textContent =
    `${n} listing${n === 1 ? "" : "s"} marked not interested. ${m} listing${m === 1 ? "" : "s"} remembered for "New to you", price drops, price history and reposted scams (kept 90 days, only in this browser).` +
    (sv ? ` ${sv} saved (listings and searches), kept until you remove them in the panel.` : "");
}
document.getElementById("clearHidden").addEventListener("click", async () => {
  await chrome.storage.local.remove("notInterested");
  showMemory();
  note("Everything you hid is visible again.");
});
document.getElementById("clearMemory").addEventListener("click", async () => {
  await chrome.storage.local.remove(["listingMemory", "codeStems"]);
  showMemory();
  note("Seen listings forgotten.");
});
showMemory();

function showProvider() {
  const p = document.getElementById("provider").value;
  document.getElementById("anthropicBox").hidden = p !== "anthropic";
  document.getElementById("oaiBox").hidden = p !== "openai";
  document.getElementById("ollamaBox").hidden = p !== "ollama";
  testMsg.textContent = "";
  showPreset();
}
document.getElementById("provider").addEventListener("change", showProvider);
document.getElementById("oaiPreset").addEventListener("change", async (e) => {
  const preset = PRESETS[e.target.value];
  showPreset();
  if (preset?.url) {
    const url = document.getElementById("oaiUrl");
    url.value = preset.url;
    await saveField("oaiUrl");
  }
  document.getElementById("oaiModels").replaceChildren();
});

// Each field saves when you leave it (or tick it): no Save button to forget.
const valueOf = (f) => {
  const el = document.getElementById(f);
  if (el.type === "checkbox") return el.checked;
  const n = Number(el.value);
  if (f === "feePct") return Math.min(50, Math.max(0, n || 0));
  if (f === "monthlyBudget") return Math.min(100000, Math.max(0, n || 0));
  if (f === "minSellerPct") return Math.min(100, Math.max(0, n || 0));
  if (f === "minSellerRatings") return Math.min(100000, Math.max(0, Math.round(n) || 0));
  if (f === "oaiPriceIn" || f === "oaiPriceOut") return Math.min(1000, Math.max(0, n || 0));
  if (el.type === "number") return Math.min(30, Math.max(1, Math.round(n) || 10));
  return f === "ollamaUrl" || f === "oaiUrl" ? el.value.trim().replace(/\/+$/, "") : el.value.trim();
};
async function saveField(f) {
  const v = valueOf(f);
  // An emptied model or address field goes back to its default instead of breaking requests.
  if (v === "" && !MAY_BE_EMPTY.includes(f)) {
    await chrome.storage.local.remove(f);
    await load();
    return note("Back to the default.");
  }
  await chrome.storage.local.set({ [f]: v });
  const el = document.getElementById(f);
  if (el.type === "number" && String(v) !== el.value) el.value = v; // show what was actually kept
  note(f === "showTab" ? "Saved. Reload open eBay and Facebook tabs to see the change." : "Saved.");
}
for (const f of FIELDS) document.getElementById(f).addEventListener("change", () => saveField(f));

// Claude: checks the key and that the model name exists, without spending anything.
async function testClaude() {
  const key = document.getElementById("anthropicKey").value.trim();
  const model = document.getElementById("anthropicModel").value.trim() || "claude-opus-5-5";
  if (!key) return (testMsg.textContent = "Paste an API key first.");
  testMsg.textContent = "Testing…";
  try {
    const res = await fetch(`https://api.anthropic.com/v1/models/${encodeURIComponent(model)}`, {
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
    });
    if (res.status === 401) throw new Error("The API key was rejected.");
    if (res.status === 404) throw new Error(`The key works, but there's no model called "${model}".`);
    if (!res.ok) throw new Error(`The Claude API answered ${res.status}.`);
    const info = await res.json();
    testMsg.textContent = `Connected. ${info.display_name || model} is available.`;
  } catch (e) {
    testMsg.textContent = e.message.includes("Failed to fetch") ? "Can't reach the Claude API. Check your connection." : e.message;
  }
}

// Ollama: lists installed models so you can see whether the names above match.
// Other services: lists the models, so you can pick one instead of guessing its ID.
async function testOpenAI() {
  const url = document.getElementById("oaiUrl").value.trim().replace(/\/+$/, "");
  const key = document.getElementById("oaiKey").value.trim();
  if (!url) return (testMsg.textContent = "Pick a service, or enter its address.");
  if (!(await allowOrigin(url))) return (testMsg.textContent = "Second Look needs your permission to reach that address.");
  testMsg.textContent = "Testing…";
  try {
    const res = await fetch(`${url}/models`, { headers: key ? { Authorization: `Bearer ${key}` } : {} });
    if (res.status === 401 || res.status === 403) throw new Error("The key was rejected.");
    if (!res.ok) throw new Error(`The service answered ${res.status}.`);
    const body = await res.json();
    const ids = (body.data || body.models || []).map((m) => (m.id || m.name || "").replace(/^models\//, "")).filter(Boolean).sort();
    document.getElementById("oaiModels").replaceChildren(...ids.slice(0, 500).map((id) => Object.assign(document.createElement("option"), { value: id })));
    const model = document.getElementById("oaiModel").value.trim();
    testMsg.textContent = !ids.length
      ? "Connected."
      : model && !ids.includes(model)
        ? `Connected, but there's no model called "${model}" here. ${ids.length} models are listed in the Model box.`
        : `Connected. ${ids.length} model${ids.length === 1 ? "" : "s"} available${model ? `; ${model} is one of them` : ": click the Model box to pick one"}.`;
  } catch (e) {
    testMsg.textContent = /Failed to fetch/.test(e.message) ? `Can't reach ${url}.${/localhost|127\.0\.0\.1/.test(url) ? " Is the server running?" : ""}` : e.message;
  }
}

document.getElementById("test").addEventListener("click", async () => {
  if (document.getElementById("provider").value === "anthropic") return testClaude();
  if (document.getElementById("provider").value === "openai") return testOpenAI();
  const url = document.getElementById("ollamaUrl").value.trim().replace(/\/+$/, "");
  testMsg.textContent = "Testing…";
  try {
    const res = await fetch(`${url}/api/tags`);
    if (res.status === 403) throw new Error("Ollama refused this extension. Set OLLAMA_ORIGINS (README step 3).");
    if (!res.ok) throw new Error(`Ollama answered ${res.status}.`);
    const { models = [] } = await res.json();
    const names = models.map((m) => m.name);
    const want = [document.getElementById("textModel").value.trim(), document.getElementById("visionModel").value.trim()];
    const missing = want.filter((w) => w && !names.some((n) => n === w || n === `${w}:latest`));
    testMsg.textContent = missing.length
      ? `Connected. Not installed yet: ${missing.join(", ")}.`
      : `Connected. Installed: ${names.join(", ") || "none"}.`;
  } catch (e) {
    testMsg.textContent = e.message.includes("Failed to fetch") ? `Can't reach Ollama at ${url}. Is it running?` : e.message;
  }
});

load();
