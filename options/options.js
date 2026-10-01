const FIELDS = ["provider", "anthropicKey", "anthropicModel", "ollamaUrl", "textModel", "visionModel", "batchSize", "useSoldComps", "interests", "feePct", "showTab"];
const msg = document.getElementById("msg");

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

function showProvider() {
  const anth = document.getElementById("provider").value === "anthropic";
  document.getElementById("anthropicBox").hidden = !anth;
  document.getElementById("ollamaBox").hidden = anth;
}
document.getElementById("provider").addEventListener("change", showProvider);

document.getElementById("save").addEventListener("click", async () => {
  const out = {};
  const cleared = [];
  for (const f of FIELDS) {
    const el = document.getElementById(f);
    if (el.type === "checkbox") out[f] = el.checked;
    else if (f === "feePct") out[f] = Math.min(50, Math.max(0, Number(el.value) || 0));
    else if (el.type === "number") out[f] = Math.min(30, Math.max(1, Math.round(Number(el.value)) || 10));
    else out[f] = el.value.trim();
    // An emptied model or address field goes back to its default instead of breaking requests.
    if (out[f] === "" && f !== "anthropicKey" && f !== "interests") {
      delete out[f];
      cleared.push(f);
    }
  }
  if (out.ollamaUrl) out.ollamaUrl = out.ollamaUrl.replace(/\/+$/, "");
  await chrome.storage.local.remove(cleared);
  await chrome.storage.local.set(out);
  if (cleared.length) await load();
  msg.textContent = "Saved.";
});

// Claude: checks the key and that the model name exists, without spending anything.
async function testClaude() {
  const key = document.getElementById("anthropicKey").value.trim();
  const model = document.getElementById("anthropicModel").value.trim() || "claude-opus-5-5";
  if (!key) return (msg.textContent = "Paste an API key first.");
  msg.textContent = "Testing…";
  try {
    const res = await fetch(`https://api.anthropic.com/v1/models/${encodeURIComponent(model)}`, {
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
    });
    if (res.status === 401) throw new Error("The API key was rejected.");
    if (res.status === 404) throw new Error(`The key works, but there's no model called "${model}".`);
    if (!res.ok) throw new Error(`The Claude API answered ${res.status}.`);
    const info = await res.json();
    msg.textContent = `Connected. ${info.display_name || model} is available.`;
  } catch (e) {
    msg.textContent = e.message.includes("Failed to fetch") ? "Can't reach the Claude API. Check your connection." : e.message;
  }
}

// Ollama: lists installed models so you can see whether the names above match.
document.getElementById("test").addEventListener("click", async () => {
  if (document.getElementById("provider").value === "anthropic") return testClaude();
  const url = document.getElementById("ollamaUrl").value.trim().replace(/\/+$/, "");
  msg.textContent = "Testing…";
  try {
    const res = await fetch(`${url}/api/tags`);
    if (res.status === 403) throw new Error("Ollama refused this extension. Set OLLAMA_ORIGINS (README step 3).");
    if (!res.ok) throw new Error(`Ollama answered ${res.status}.`);
    const { models = [] } = await res.json();
    const names = models.map((m) => m.name);
    const want = [document.getElementById("textModel").value.trim(), document.getElementById("visionModel").value.trim()];
    const missing = want.filter((w) => w && !names.some((n) => n === w || n === `${w}:latest`));
    msg.textContent = missing.length
      ? `Connected. Not installed yet: ${missing.join(", ")}.`
      : `Connected. Installed: ${names.join(", ") || "none"}.`;
  } catch (e) {
    msg.textContent = e.message.includes("Failed to fetch") ? `Can't reach Ollama at ${url}. Is it running?` : e.message;
  }
});

load();
