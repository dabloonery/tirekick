const FIELDS = ["provider", "anthropicKey", "anthropicModel", "ollamaUrl", "textModel", "visionModel", "batchSize", "useSoldComps", "interests", "feePct",
  "hideWords", "needWords", "minSellerRatings", "minSellerPct", "autoMarks", "monthlyBudget", "showTab"];
// Fields that may be left empty on purpose (everything else goes back to its default when cleared).
const MAY_BE_EMPTY = ["anthropicKey", "interests", "hideWords", "needWords"];
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
  const look = (await chrome.storage.local.get({ theme: "classic" })).theme;
  document.querySelector(`input[name="theme"][value="${look === "retro" ? "retro" : "classic"}"]`).checked = true;
  document.documentElement.dataset.theme = look;
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
  // The panel's model menu changes these too; keep this page in step (unless you're typing in one).
  for (const f of ["provider", "anthropicModel", "textModel"]) {
    const el = document.getElementById(f);
    if (c[f] && document.activeElement !== el) el.value = c[f].newValue ?? el.value;
  }
  if (c.provider) showProvider();
});
showSpend();

// What's remembered in this browser, and a way to clear it.
async function showMemory() {
  const { notInterested = {}, listingMemory = {} } = await chrome.storage.local.get(["notInterested", "listingMemory"]);
  const n = Object.keys(notInterested).length;
  const m = Object.keys(listingMemory).length;
  document.getElementById("memoryInfo").textContent =
    `${n} listing${n === 1 ? "" : "s"} marked not interested. ${m} listing${m === 1 ? "" : "s"} remembered for "New to you", price drops and reposted scams (kept 90 days, only in this browser).`;
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

// The look applies straight away (open eBay/Facebook tabs follow it too); no Save needed.
document.querySelectorAll('input[name="theme"]').forEach((r) =>
  r.addEventListener("change", () => {
    document.documentElement.dataset.theme = r.value;
    chrome.storage.local.set({ theme: r.value });
  })
);

function showProvider() {
  const anth = document.getElementById("provider").value === "anthropic";
  document.getElementById("anthropicBox").hidden = !anth;
  document.getElementById("ollamaBox").hidden = anth;
}
document.getElementById("provider").addEventListener("change", showProvider);

// Each field saves when you leave it (or tick it): no Save button to forget.
const valueOf = (f) => {
  const el = document.getElementById(f);
  if (el.type === "checkbox") return el.checked;
  const n = Number(el.value);
  if (f === "feePct") return Math.min(50, Math.max(0, n || 0));
  if (f === "monthlyBudget") return Math.min(100000, Math.max(0, n || 0));
  if (f === "minSellerPct") return Math.min(100, Math.max(0, n || 0));
  if (f === "minSellerRatings") return Math.min(100000, Math.max(0, Math.round(n) || 0));
  if (el.type === "number") return Math.min(30, Math.max(1, Math.round(n) || 10));
  return f === "ollamaUrl" ? el.value.trim().replace(/\/+$/, "") : el.value.trim();
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
document.getElementById("test").addEventListener("click", async () => {
  if (document.getElementById("provider").value === "anthropic") return testClaude();
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
