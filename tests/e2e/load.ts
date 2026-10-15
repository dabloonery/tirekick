import { connect } from "./cdp.ts";
// The extension folder: the repo, or EXT_DIR (an unpacked store zip, to test exactly what ships).
const dir = Deno.env.get("EXT_DIR") || new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const c = await connect();
let id = "";
try { id = (await c.send("Extensions.loadUnpacked", { path: dir })).id; } catch (e) { console.log("ERR", e.message); }
// Chromium builds without that DevTools method load it from --load-extension (run.sh) instead; find it by its service worker.
for (let i = 0; !id && i < 20; i++) {
  const list = await (await fetch("http://127.0.0.1:9222/json/list")).json();
  id = list.map((t: { url: string }) => /^chrome-extension:\/\/([a-p]{32})\//.exec(t.url)?.[1]).find(Boolean) || "";
  if (!id) await new Promise((r) => setTimeout(r, 250));
}
if (id) await Deno.writeTextFile(Deno.env.get("E2E_TMP") + "/ext_id.txt", id);
c.close();
