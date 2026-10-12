import { connect } from "./cdp.ts";
const c = await connect();
try { const r = await c.send("Extensions.loadUnpacked", { path: new URL("../..", import.meta.url).pathname.replace(/\/$/, "") }); await Deno.writeTextFile(new URL("ext_id.txt", import.meta.url), r.id); } catch (e) { console.log("ERR", e.message); }
c.close();
