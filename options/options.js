const FIELDS = ["provider", "anthropicKey", "anthropicModel", "anthropicScanModel", "oaiPreset", "oaiUrl", "oaiKey", "oaiModel", "oaiVisionModel", "oaiPriceIn", "oaiPriceOut", "ollamaUrl", "textModel", "visionModel", "batchSize", "useSoldComps", "interests", "feePct",
  "filterWords", "minSellerRatings", "minSellerPct", "markScams", "markPrices", "markOther", "markLimit", "useAI", "monthlyBudget", "showTab", "autoScan", "theme"];
// Fields that may be left empty on purpose (everything else goes back to its default when cleared).
const MAY_BE_EMPTY = ["anthropicScanModel", "anthropicKey", "oaiKey", "oaiModel", "oaiVisionModel", "interests", "filterWords"];

// Services that speak the OpenAI chat API. Picking one fills in its address.
const PRESETS = {
  openrouter: { url: "https://openrouter.ai/api/v1", keys: "https://openrouter.ai/keys", hint: "One key for models from many makers. Key at openrouter.ai/keys. Costs are reported exactly." },
  openai: { url: "https://api.openai.com/v1", keys: "https://platform.openai.com/api-keys", hint: "Key at platform.openai.com/api-keys." },
  gemini: { url: "https://generativelanguage.googleapis.com/v1beta/openai", keys: "https://aistudio.google.com/apikey", hint: "Key at aistudio.google.com/apikey. There's a free tier with rate limits." },
  deepseek: { url: "https://api.deepseek.com/v1", keys: "https://platform.deepseek.com/api_keys", hint: "Key at platform.deepseek.com/api_keys." },
  mistral: { url: "https://api.mistral.ai/v1", keys: "https://console.mistral.ai/api-keys", hint: "Key at console.mistral.ai/api-keys." },
  xai: { url: "https://api.x.ai/v1", keys: "https://console.x.ai", hint: "Key at console.x.ai." },
  lmstudio: { url: "http://localhost:1234/v1", hint: "Free and private. In LM Studio, load a model and start the server (Developer tab); no key needed." },
  custom: { url: "", hint: "Any service with an OpenAI-style /v1/chat/completions. Test connection asks your permission to reach it." },
};
// The other two kinds of service, for the same hint and key link.
const SERVICES = {
  anthropic: { keys: "https://console.anthropic.com/settings/keys", hint: "Key at console.anthropic.com." },
  ollama: { hint: "Free and private: runs on your own computer. Install Ollama, pull a model, and Tirekick talks to it directly." },
};
// The one "AI service" menu stands for two stored settings: provider, and for OpenAI-style services which one.
// Nothing is picked until you choose (a fresh install shows "Choose one…" rather than any one brand).
let chosen = false;
const serviceOf = () => {
  const p = document.getElementById("provider").value;
  return p === "openai" ? `openai:${document.getElementById("oaiPreset").value || "custom"}` : p;
};
const serviceInfo = (v) => (v.startsWith("openai:") ? PRESETS[v.slice(7)] : SERVICES[v]) || {};
const showPreset = () => {
  const sel = document.getElementById("service");
  sel.value = chosen ? serviceOf() : "";
  document.getElementById("serviceHint").textContent = chosen ? serviceInfo(sel.value).hint || "" : "";
};
// Tirekick may reach the listed services already; any other address needs your OK once.
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
  noteTimer = setTimeout(() => msg.classList.remove("show"), Math.max(2200, text.length * 45)); // longer notes stay longer
};

// Model fields: a menu to pick from, plus "Another model…" to type an ID. The text box next to it stays the one
// place the value lives (saving, the panel's own menu and Test connection all keep using it).
const OTHER = "\u0000other";
const CLAUDE_MODELS = [
  ["claude-opus-5-5", "Opus 5.5: best"],
  ["claude-sonnet-5-5", "Sonnet 5.5: half the price"],
  ["claude-haiku-5-5", "Haiku 5.5: about a fortieth of the price"],
];
const pickers = {};
function modelPicker(id, { blank = "" } = {}) {
  const input = document.getElementById(id);
  const label = document.querySelector(`label[for="${id}"]`);
  const select = Object.assign(document.createElement("select"), { id: `${id}Pick`, className: "modelpick" });
  input.before(select);
  if (label) {
    label.htmlFor = select.id;
    input.setAttribute("aria-label", `${label.textContent} (type an ID)`);
  }
  let items = []; // [value, text]
  const sync = () => {
    const v = input.value.trim();
    const known = items.some(([val]) => val === v);
    select.hidden = !items.length;
    select.value = known ? v : OTHER;
    input.hidden = !!items.length && known;
  };
  const setItems = (list) => {
    items = [...(blank ? [["", blank]] : []), ...list.map((x) => (Array.isArray(x) ? x : [x, x]))];
    select.replaceChildren(...items.map(([val, text]) => Object.assign(document.createElement("option"), { value: val, textContent: text })), Object.assign(document.createElement("option"), { value: OTHER, textContent: "Another model\u2026" }));
    sync();
  };
  select.addEventListener("change", () => {
    if (select.value === OTHER) {
      input.hidden = false;
      input.focus();
      return;
    }
    input.value = select.value;
    input.dispatchEvent(new Event("change", { bubbles: true })); // saves it like typing would
    sync();
  });
  input.addEventListener("change", sync);
  pickers[id] = { sync, setItems };
}
modelPicker("anthropicModel");
modelPicker("anthropicScanModel", { blank: "The same as the model above" });
modelPicker("oaiModel");
modelPicker("oaiVisionModel", { blank: "Same as the model above" });
modelPicker("textModel");
modelPicker("visionModel");
pickers.anthropicModel.setItems(CLAUDE_MODELS);
pickers.anthropicScanModel.setItems(CLAUDE_MODELS);
// Lists found by Test connection are remembered, so the menus are there next time without testing again.
const showLists = async () => {
  const { oaiModelList = [], ollamaModelList = [] } = await chrome.storage.local.get(["oaiModelList", "ollamaModelList"]);
  pickers.oaiModel.setItems(oaiModelList);
  pickers.oaiVisionModel.setItems(oaiModelList.length ? oaiModelList : []);
  pickers.textModel.setItems(ollamaModelList);
  pickers.visionModel.setItems(ollamaModelList);
};

// Match (the default) follows the browser and is dark if it doesn't say; Dark and Light force one.
const applyTheme = (v) => (v === "dark" || v === "light" ? (document.documentElement.dataset.theme = v) : delete document.documentElement.dataset.theme);
document.getElementById("theme").addEventListener("change", (e) => applyTheme(e.target.value));

async function load() {
  // Settings with defaults filled in come from the background script (it leaves out the key).
  const res = await chrome.runtime.sendMessage({ type: "getSettings" }).catch(() => null);
  const stored = await chrome.storage.local.get([...FIELDS, "serviceChosen"]);
  const s = { ...(res?.ok ? res.data : {}), ...stored };
  for (const f of FIELDS) {
    const el = document.getElementById(f);
    if (el.type === "checkbox") el.checked = !!s[f];
    else el.value = s[f] ?? "";
  }
  applyTheme(s.theme);
  showAIOff();
  showFocus();
  // Chosen once you picked a service, or already set one up before this menu existed.
  chosen = !!(s.serviceChosen || stored.provider || stored.anthropicKey || stored.oaiKey || stored.oaiModel);
  await showLists();
  for (const p of Object.values(pickers)) p.sync(); // the saved values are in the boxes now
  showProvider();
}

// What the Claude API has cost (estimated), from the record the background keeps per day and model.
const NAMES = { "claude-opus-5-5": "Opus 5.5", "claude-sonnet-5-5": "Sonnet 5.5", "claude-haiku-5-5": "Haiku 5.5", "claude-haiku-4-5": "Haiku 4.5" };
const usd = (n) => (n > 0 && n < 0.01 ? "<$0.01" : `$${n.toFixed(2)}`);
async function showSpend() {
  const { usage } = await chrome.storage.local.get("usage");
  const { today: t, month: m, last: l, models } = TKShared.usageSummary(usage);
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
  const each = (n) => (n < 0.01 ? "under $0.01 each" : `about $${n.toFixed(2)} each`);
  const parts = rows.map(([id, v]) => `${NAMES[id] || id} ${usd(v.usd)} (${v.calls} call${v.calls === 1 ? "" : "s"}, ${each(v.usd / v.calls)})`);
  const rest = m - rows.reduce((sum, [, v]) => sum + v.usd, 0); // recorded before the per-model split
  if (rest >= 0.005) parts.push(`not split by model ${usd(rest)}`);
  document.getElementById("spendModels").textContent = parts.length ? "This month: " + parts.join(" \u00b7 ") : "Nothing spent on paid AI this month.";
}
document.getElementById("resetSpend").addEventListener("click", async () => {
  if (!confirm("Reset the spending counter? This only clears Tirekick's own estimate, not anything at Anthropic.")) return;
  await chrome.storage.local.remove(["usage", "spend"]);
  showSpend();
  note("Spending counter reset.");
});
chrome.storage.onChanged.addListener((c) => {
  if (c.usage) showSpend();
  if (c.saved || c.savedSearches) showMemory();
  // The panel's model menu changes these too; keep this page in step (unless you're typing in one).
  for (const f of ["provider", "anthropicModel", "anthropicScanModel", "oaiModel", "textModel"]) {
    const el = document.getElementById(f);
    if (c[f] && document.activeElement !== el) el.value = c[f].newValue ?? el.value;
    pickers[f]?.sync();
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
    `${n} listing${n === 1 ? "" : "s"} hidden. ${m} listing${m === 1 ? "" : "s"} remembered for "New to you", price drops, price history, reposted scams and reused photos (kept 90 days, only in this browser).` +
    (sv ? ` ${sv} saved (listings and searches), kept until you remove them in the panel.` : "");
}
// Shared records change only through the background script, one edit at a time (storeEdit), so an open
// tab saving or hiding a listing at the same moment isn't undone.
async function storeEdit(name, edit) {
  const res = await chrome.runtime.sendMessage({ type: "storeEdit", payload: { name, edit } });
  if (!res?.ok) throw new Error(res?.error || "Couldn't save that.");
}
document.getElementById("clearHidden").addEventListener("click", async () => {
  await storeEdit("notInterested", { clear: true });
  showMemory();
  note("Everything you hid is visible again.");
});
document.getElementById("clearMemory").addEventListener("click", async () => {
  await chrome.storage.local.remove("listingMemory");
  await Promise.all(["codeStems", "photoSeen"].map((name) => storeEdit(name, { clear: true })));
  showMemory();
  note("Seen listings forgotten.");
});
showMemory();
document.getElementById("wipeAll").addEventListener("click", async () => {
  if (!confirm("Delete everything Tirekick keeps in this browser, API keys included? This can't be undone.")) return;
  await chrome.storage.local.clear();
  location.reload(); // the page comes back as on a fresh install
});

function showProvider() {
  const p = chosen ? document.getElementById("provider").value : "";
  document.getElementById("anthropicBox").hidden = p !== "anthropic";
  document.getElementById("oaiBox").hidden = p !== "openai";
  document.getElementById("ollamaBox").hidden = p !== "ollama";
  document.getElementById("test").closest(".field").hidden = !p;
  testMsg.textContent = "";
  showPreset();
}
document.getElementById("provider").addEventListener("change", showProvider);
document.getElementById("service").addEventListener("change", (e) => (saving = saving.then(() => servicePicked(e)).catch(() => {})));
async function servicePicked(e) {
  const [provider, preset] = e.target.value.split(":");
  chosen = true;
  document.getElementById("provider").value = provider;
  await chrome.storage.local.set({ serviceChosen: true });
  await saveField("provider");
  if (preset && preset !== document.getElementById("oaiPreset").value) {
    document.getElementById("oaiPreset").value = preset;
    await saveField("oaiPreset");
    await presetPicked();
  }
  showProvider();
  showStatus();
}
async function presetPicked() {
  const preset = PRESETS[document.getElementById("oaiPreset").value];
  showPreset();
  if (preset?.url) {
    const url = document.getElementById("oaiUrl");
    url.value = preset.url;
    await saveField("oaiUrl");
  }
  await chrome.storage.local.remove("oaiModelList");
  await showLists();
}

// Each field saves when you leave it (or tick it): no Save button to forget.
const valueOf = (f) => {
  const el = document.getElementById(f);
  if (el.type === "checkbox") return el.checked;
  // The same limits a restored backup goes through (lib/shared.js).
  if (TKShared.isNumberSetting(f)) return TKShared.clampSetting(f, Number(el.value));
  return f === "ollamaUrl" || f === "oaiUrl" ? el.value.trim().replace(/\/+$/, "") : el.value.trim();
};
// Saves run one after another, and Test connection waits for them, so it never sends a key to an address
// it wasn't entered for in the moment between the two.
let saving = Promise.resolve();
async function saveField(f) {
  const v = valueOf(f);
  // An emptied model or address field goes back to its default instead of breaking requests.
  if (v === "" && !MAY_BE_EMPTY.includes(f)) {
    await chrome.storage.local.remove(f);
    await load();
    return note(`Back to the default.${f === "oaiUrl" ? await keyFollowsAddress() : ""}`);
  }
  // A key belongs to the address it was entered for (TKShared.oaiKeyFits).
  await chrome.storage.local.set({ [f]: v, ...(f === "oaiKey" && { oaiKeyFor: TKShared.originOf(valueOf("oaiUrl")) }) });
  const moved = f === "oaiUrl" ? await keyFollowsAddress() : "";
  const el = document.getElementById(f);
  if (el.type === "number" && String(v) !== el.value) el.value = v; // show what was actually kept
  note(f === "showTab" ? "Saved. Reload open eBay and Facebook tabs to see the change." : `Saved.${moved}`);
}
// Each address keeps its own key: a new address puts the key you had away (it stays with its own service)
// and brings back the one you entered for the new address before, if there is one.
async function keyFollowsAddress() {
  const to = TKShared.originOf(document.getElementById("oaiUrl").value);
  const { oaiKey = "", oaiKeyFor = "", oaiKeys = {} } = await chrome.storage.local.get(["oaiKey", "oaiKeyFor", "oaiKeys"]);
  if (!to || to === oaiKeyFor) return "";
  const keys = { ...oaiKeys };
  if (oaiKey && oaiKeyFor) keys[oaiKeyFor] = oaiKey;
  const next = keys[to] || "";
  delete keys[to];
  await chrome.storage.local.set({ oaiKeys: keys, oaiKey: next, oaiKeyFor: to });
  document.getElementById("oaiKey").value = next;
  if (next) return " Using the key you entered for this address before.";
  return oaiKey ? " The key you had stays with its own service; paste the key for this one." : "";
}
for (const f of FIELDS) {
  document.getElementById(f).addEventListener("change", async () => {
    const done = saving.then(() => saveField(f));
    saving = done.catch(() => {});
    await done;
    showStatus();
    // A new key is checked straight away, so a typo shows up now rather than on the first scan.
    if ((f === "anthropicKey" && document.getElementById(f).value.trim()) || (f === "oaiKey" && document.getElementById(f).value.trim())) document.getElementById("test").click();
  });
}
// What should Tirekick do: the focus the switches add up to (TKRules.focusOf), or Custom. Picking one sets them.
const showFocus = async () => {
  const s = await chrome.storage.local.get(Object.keys(TKRules.FOCUS.everything));
  const now = TKRules.focusOf(s);
  for (const r of document.querySelectorAll('input[name="focus"]')) r.checked = r.value === now;
  document.getElementById("focusCustom").hidden = now !== "custom";
};
for (const r of document.querySelectorAll('input[name="focus"]')) {
  r.addEventListener("change", async () => {
    await chrome.storage.local.set(TKRules.FOCUS[r.value]);
    await load();
    note(r.value === "scams" ? "Saved. Cards show only scam warnings now." : r.value === "noai" ? "Saved. Your AI isn't used now." : "Saved. Everything is on, AI scores included.");
  });
}
// With the AI off, its section folds down to the switch.
const showAIOff = () => document.getElementById("sec-model").classList.toggle("off", !document.getElementById("useAI").checked);
document.getElementById("useAI").addEventListener("change", showAIOff);
// Scam marks on the cards are turned off only on purpose: the click asks first, and saying no leaves them on.
document.getElementById("markScams").addEventListener("click", (e) => {
  if (!e.target.checked && !confirm("Turn off scam marks on cards? Cards won't say when a listing looks like a scam. The panel's list and the listing page still will.")) e.preventDefault();
});
for (const b of document.querySelectorAll("[data-reveal]")) {
  b.addEventListener("click", () => {
    const input = document.getElementById(b.dataset.reveal);
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    b.textContent = show ? "Hide" : "Show";
  });
}

// The banner at the top: is the model ready to run, and if not, what's the one thing missing?
async function showStatus() {
  const s = await chrome.storage.local.get(["provider", "anthropicKey", "anthropicModel", "anthropicScanModel", "oaiKey", "oaiModel", "oaiUrl", "textModel", "useAI", "markScams", "markPrices", "markOther", "useSoldComps"]);
  const provider = s.provider || "anthropic";
  const card = document.getElementById("statusCard");
  const keyLink = document.getElementById("keyLink");
  let ready = false, title, text;
  if (TKRules.focusOf(s) === "scams") {
    ready = true;
    title = "Ready: scam check only";
    text = "Cards show only scam warnings, and your AI isn't used. Change it under What should Tirekick do.";
  } else if (s.useAI !== true) {
    // The AI is opt-in (dabloonery, 2026-10-23): until it's turned on, the free checks are the whole setup.
    ready = true;
    title = "Ready: price checks and scam marks";
    text = "Open an eBay or Marketplace search to see them. AI scores are optional and off: to add them, turn on Use an AI under AI scores below.";
  } else if (!chosen) {
    ready = true; // the price checks, scam marks and filters need no AI
    title = "Ready: price checks and scam marks";
    text = "Open an eBay or Marketplace search to see them. AI scores are optional: to add them, choose an AI service under AI scores below.";
  } else if (provider === "anthropic") {
    ready = !!s.anthropicKey;
    const m = s.anthropicModel || "claude-sonnet-5-5";
    const scanM = s.anthropicScanModel === undefined ? "claude-haiku-5-5" : s.anthropicScanModel || m;
    title = ready ? `Ready: ${NAMES[m] || m}${scanM !== m ? `, scans with ${NAMES[scanM] || scanM}` : ""}` : "One step left: add your Anthropic API key";
    text = ready ? "Open an eBay or Marketplace search and press Scan, or just look at the marks on the cards." : "Paste it below and it is checked right away. The marks and price checks work without it.";
  } else if (provider === "openai") {
    const keyless = /localhost|127\.0\.0\.1/.test(s.oaiUrl || "");
    ready = !!s.oaiModel && (!!s.oaiKey || keyless);
    title = ready ? `Ready: ${s.oaiModel}` : "Finish setting up your AI service";
    text = ready ? "Open an eBay or Marketplace search and press Scan." : `It needs ${!s.oaiKey && !keyless ? "an API key and " : ""}a model. Test connection lists the models you can pick.`;
  } else {
    ready = !!s.textModel;
    title = ready ? `Ready: ${s.textModel} on Ollama` : "Pick an Ollama model";
    text = ready ? "Open an eBay or Marketplace search and press Scan. Test connection checks that Ollama is running." : "Enter the name of a model you have pulled, then press Test connection.";
  }
  card.classList.toggle("ready", ready);
  document.getElementById("statusTitle").textContent = title;
  document.getElementById("statusText").textContent = text;
  // A button to the chosen service's key page, until it's set up.
  const keys = chosen && !ready && s.useAI === true ? serviceInfo(serviceOf()).keys : "";
  keyLink.hidden = !keys;
  if (keys) keyLink.href = keys;
}
chrome.storage.onChanged.addListener(() => (showStatus(), showFocus()));

// Claude: checks the key and that the model name exists, without spending anything.
async function testClaude() {
  const key = document.getElementById("anthropicKey").value.trim();
  const model = document.getElementById("anthropicModel").value.trim() || "claude-sonnet-5-5";
  if (!key) return (testMsg.textContent = "Paste an API key first.");
  testMsg.textContent = "Testing…";
  try {
    const res = await fetch(`https://api.anthropic.com/v1/models/${encodeURIComponent(model)}`, {
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
    });
    if (res.status === 401) throw new Error(`The API key was rejected.${/^sk-ant-/.test(key) ? " Copy it again from console.anthropic.com." : " Claude API keys start with sk-ant-; for another service's key, pick that service above."}`);
    if (res.status === 403) throw new Error(`The key works, but it isn't allowed to use "${model}".`);
    if (res.status === 404) throw new Error(`The key works, but there's no model called "${model}".`);
    // Busy or down: the key wasn't checked either way.
    if (res.status === 429 || res.status >= 500) throw new Error(`The Claude API is busy or having a problem (error ${res.status}), so the key wasn't checked. Try again in a minute.`);
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
  const { oaiKeyFor = "" } = await chrome.storage.local.get("oaiKeyFor");
  if (!TKShared.oaiKeyFits({ oaiKey: key, oaiKeyFor, oaiUrl: url })) return (testMsg.textContent = "That key was entered for another address. Paste the key for this one.");
  if (!(await allowOrigin(url))) return (testMsg.textContent = "Tirekick needs your permission to reach that address.");
  testMsg.textContent = "Testing…";
  try {
    const res = await fetch(`${url}/models`, { headers: key ? { Authorization: `Bearer ${key}` } : {} });
    if (res.status === 401 || res.status === 403) throw new Error("The key was rejected.");
    if (!res.ok) throw new Error(`The service answered ${res.status}.`);
    const body = await res.json();
    const ids = (body.data || body.models || []).map((m) => (m.id || m.name || "").replace(/^models\//, "")).filter(Boolean).sort();
    await chrome.storage.local.set({ oaiModelList: ids.slice(0, 500) });
    await showLists();
    const model = document.getElementById("oaiModel").value.trim();
    testMsg.textContent = !ids.length
      ? "Connected."
      : model && !ids.includes(model)
        ? `Connected, but there's no model called "${model}" here. ${ids.length} models are in the Model menu.`
        : `Connected. ${ids.length} model${ids.length === 1 ? "" : "s"} available${model ? `; ${model} is one of them` : "; pick one in the Model menu"}.`;
  } catch (e) {
    testMsg.textContent = /Failed to fetch/.test(e.message) ? `Can't reach ${url}.${/localhost|127\.0\.0\.1/.test(url) ? " Is the server running?" : ""}` : e.message;
  }
}

document.getElementById("test").addEventListener("click", async () => {
  await saving;
  if (document.getElementById("provider").value === "anthropic") return testClaude();
  if (document.getElementById("provider").value === "openai") return testOpenAI();
  const url = document.getElementById("ollamaUrl").value.trim().replace(/\/+$/, "");
  if (!(await allowOrigin(url))) return (testMsg.textContent = "Tirekick needs your permission to reach that address.");
  testMsg.textContent = "Testing…";
  try {
    const res = await fetch(`${url}/api/tags`);
    if (res.status === 403) throw new Error("Ollama refused this extension. Set OLLAMA_ORIGINS (README step 3).");
    if (!res.ok) throw new Error(`Ollama answered ${res.status}.`);
    const { models = [] } = await res.json();
    const names = models.map((m) => m.name);
    await chrome.storage.local.set({ ollamaModelList: names });
    await showLists();
    const want = [document.getElementById("textModel").value.trim(), document.getElementById("visionModel").value.trim()];
    const missing = want.filter((w) => w && !names.some((n) => n === w || n === `${w}:latest`));
    testMsg.textContent = missing.length
      ? `Connected. Not installed yet: ${missing.join(", ")}.`
      : `Connected. Installed: ${names.join(", ") || "none"}.`;
  } catch (e) {
    testMsg.textContent = e.message.includes("Failed to fetch") ? `Can't reach Ollama at ${url}. Is it running?` : e.message;
  }
});

load().then(showStatus);

// ---------- Backup ----------
// Collections are merged on restore (a backup never deletes anything here); settings come from the backup.
// What a backup file says it is. New backups write the first; "second-look" is from before the rename to Tirekick.
const BACKUP_APPS = ["tirekick", "second-look"];
const BACKUP_SETS = TKShared.BACKUP_SETS;
const SECRET = ["anthropicKey", "oaiKey"];
const isRecord = (v) => v && typeof v === "object" && !Array.isArray(v);
document.getElementById("backup").addEventListener("click", async () => {
  const all = await chrome.storage.local.get([...FIELDS, ...BACKUP_SETS]);
  const settings = Object.fromEntries(FIELDS.filter((f) => !SECRET.includes(f) && all[f] !== undefined).map((f) => [f, all[f]]));
  const data = { app: BACKUP_APPS[0], version: chrome.runtime.getManifest().version, at: new Date().toISOString(), settings };
  for (const k of BACKUP_SETS) if (all[k]) data[k] = all[k];
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: "application/json" }));
  a.download = `tirekick-backup-${TKShared.localDay()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  const n = Object.keys(data.saved || {}).length;
  const ns = Object.keys(data.savedSearches || {}).length;
  note(`Backup saved (${n} saved listing${n === 1 ? "" : "s"}, ${ns} search${ns === 1 ? "" : "es"}). Keys aren't included.`);
});
// Saved listings as a spreadsheet: prices you've seen, and the latest score for each (TKShared.savedRows).
document.getElementById("exportCsv").addEventListener("click", async () => {
  const { saved = {}, scans = {} } = await chrome.storage.local.get(["saved", "scans"]);
  const rows = TKShared.savedRows(saved, scans);
  if (!rows.length) return note("No saved listings yet. Save one from a card or the panel first.");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([TKShared.toCsv(rows, TKShared.SAVED_COLUMNS)], { type: "text/csv;charset=utf-8" }));
  a.download = `tirekick-saved-${TKShared.localDay()}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  note(`Downloaded ${rows.length} saved listing${rows.length === 1 ? "" : "s"} as a spreadsheet (CSV).`);
});
document.getElementById("restore").addEventListener("click", () => document.getElementById("restoreFile").click());
document.getElementById("restoreFile").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file) return;
  // A real backup is well under this; a file this big is something else, and reading it would stall the page.
  if (file.size > 50 * 1024 * 1024) return note("That file is too big to be a Tirekick backup.");
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    return note("That file isn't a Tirekick backup.");
  }
  if (!BACKUP_APPS.includes(data?.app)) return note("That file isn't a Tirekick backup.");
  const here = await chrome.storage.local.get(BACKUP_SETS);
  // Every record is cleaned first (TKShared.cleanBackup): a damaged or hand-edited file can't leave
  // something in storage that breaks the panel on every page.
  const { sets, dropped, links } = TKShared.cleanBackup(data);
  const out = {};
  for (const [k, v] of Object.entries(sets)) {
    if (k === "usage") {
      // Spending per day: keep whichever record of a day is larger, so nothing is counted twice.
      const days = { ...(here.usage?.days || {}) };
      for (const [d, dv] of Object.entries(v.days)) if (!days[d] || dv.usd > days[d].usd) days[d] = dv;
      out.usage = { days };
    } else if (k === "listingMemory") {
      const m = { ...(here.listingMemory || {}) };
      for (const [key, r] of Object.entries(v)) if (!m[key] || r.a > (m[key].a || 0)) m[key] = r;
      out.listingMemory = m;
    } else out[k] = { ...v, ...(here[k] || {}) }; // what's here wins where both have it
  }
  // Shared records are added as edits ("add": what's here wins), so a tab changing one meanwhile isn't undone.
  const shared = Object.keys(out).filter((k) => TKShared.SHARED.includes(k));
  for (const k of shared) {
    await storeEdit(k, { add: sets[k] });
    delete out[k];
  }
  // Settings go through the same limits as typing them here; one that doesn't make sense is left out.
  const settings = {};
  let skipped = 0;
  for (const [f, v] of Object.entries(isRecord(data.settings) ? data.settings : {})) {
    if (!FIELDS.includes(f) || SECRET.includes(f)) continue;
    const clean = TKShared.cleanSetting(f, v);
    if (clean === undefined) skipped++;
    else settings[f] = clean;
  }
  // A backup from before the two word lists became one.
  // A backup from before the switches per kind of mark has the one old switch (TKShared.marksFromOld).
  if (settings.markPrices === undefined && settings.markOther === undefined) Object.assign(settings, TKShared.marksFromOld(data.settings?.autoMarks));
  if (settings.filterWords === undefined && (data.settings?.hideWords !== undefined || data.settings?.needWords !== undefined)) {
    settings.filterWords = TKShared.filterFromLists(String(data.settings.hideWords ?? ""), String(data.settings.needWords ?? ""));
  }
  await chrome.storage.local.set({ ...out, ...settings });
  await load();
  await keyFollowsAddress(); // the backup may name another address; the key here stays with its own
  showMemory();
  showSpend();
  const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
  const reset = links ? ` ${plural(links, "link")} to somewhere other than eBay or Facebook ${links === 1 ? "was" : "were"} replaced.` : "";
  const bad = dropped ? ` ${plural(dropped, "entry", "entries")} that didn't make sense ${dropped === 1 ? "was" : "were"} left out.` : "";
  const left = skipped ? ` ${plural(skipped, "setting")} in the file didn't make sense and ${skipped === 1 ? "was" : "were"} left out.` : "";
  note(`Restored from ${file.name}: ${plural(Object.keys(sets.saved || {}).length, "saved listing")}, ${plural(Object.keys(sets.savedSearches || {}).length, "search", "searches")}, and settings.${reset}${bad}${left}`);
});

// Folded sections open when a jump link (or the address) points at them.
const openSection = (hash) => document.querySelector(`${hash} details`)?.setAttribute("open", "");
document.querySelectorAll("nav.jump a").forEach((a) => a.addEventListener("click", () => openSection(a.hash)));
if (/^#sec-[\w-]+$/.test(location.hash)) openSection(location.hash);

// How much Tirekick keeps in this browser, under Backup.
Promise.resolve().then(() => chrome.storage.local.getBytesInUse(null)).then((bytes) => {
  document.getElementById("bytesUsed").textContent = `It uses ${bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`} here now.`;
}).catch(() => {});

// The header mark: the same tire as the panel and the toolbar (lib/theme.js), drawn for its size.
document.querySelector("svg.mark")?.insertAdjacentHTML("beforeend", TKTheme.logoMark(18, 17.6, 36));
