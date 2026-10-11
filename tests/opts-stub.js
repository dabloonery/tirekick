// Stand-in for the extension APIs so the real settings page can run in a plain page.
(() => {
  const store = {
    provider: "anthropic", anthropicModel: "claude-sonnet-5-5", theme: "match",
    oaiModelList: ["gpt-4o-mini", "gpt-4o", "o3-mini"], oaiModel: "gpt-4o-mini", oaiVisionModel: "",
    ollamaModelList: ["qwen3:4b", "moondream:latest"], textModel: "qwen3:4b", visionModel: "moondream:latest",
  };
  const pick = (k) => (k == null ? { ...store } : typeof k === "string" ? { [k]: store[k] } :
    Array.isArray(k) ? Object.fromEntries(k.map((x) => [x, store[x]])) : Object.fromEntries(Object.entries(k).map(([x, d]) => [x, store[x] ?? d])));
  window.__store = store;
  window.chrome = {
    runtime: { id: "test", lastError: null, getManifest: () => ({ version: "test" }), sendMessage: async () => ({ ok: true, data: { ...store } }) },
    storage: { local: { get: async (k) => pick(k), set: async (o) => Object.assign(store, o), remove: async (k) => [].concat(k).forEach((x) => delete store[x]) }, onChanged: { addListener() {} } },
    permissions: { contains: async () => true, request: async () => true },
  };
})();
