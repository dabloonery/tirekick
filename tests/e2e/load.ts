import { connect } from "./cdp.ts";
const c = await connect();
try { const r = await c.send("Extensions.loadUnpacked", { path: new URL("../..", import.meta.url).pathname.replace(/\/$/, "") }); await Deno.writeTextFile(Deno.env.get("E2E_TMP") + "/ext_id.txt", r.id); } catch (e) { console.log("ERR", e.message); }
c.close();
