const FIELDS = ["ollamaUrl", "textModel", "visionModel", "batchSize", "useSoldComps"];
const msg = document.getElementById("msg");

async function load() {
  const s = await chrome.storage.local.get(FIELDS);
  for (const f of FIELDS) {
    const el = document.getElementById(f);
    if (el.type === "checkbox") el.checked = !!s[f];
    else el.value = s[f] ?? "";
  }
}

document.getElementById("save").addEventListener("click", async () => {
  const out = {};
  for (const f of FIELDS) {
    const el = document.getElementById(f);
    out[f] = el.type === "checkbox" ? el.checked : el.type === "number" ? Number(el.value) || 10 : el.value.trim();
  }
  out.ollamaUrl = out.ollamaUrl.replace(/\/+$/, "");
  await chrome.storage.local.set(out);
  msg.textContent = "Saved.";
});

// Lists installed models so you can see whether the names above match.
document.getElementById("test").addEventListener("click", async () => {
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
