import { connect } from "./cdp.ts";
export const EXT = Deno.readTextFileSync(new URL("ext_id.txt", import.meta.url)).trim();
export async function start() {
  const c = await connect();
  const tabs: Record<string,string> = {};
  const open = async (url: string) => {
    const { targetId } = await c.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await c.send("Target.attachToTarget", { targetId, flatten: true });
    await c.send("Page.enable", {}, sessionId); await c.send("Runtime.enable", {}, sessionId);
    await c.send("Emulation.setDeviceMetricsOverride", { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
    await c.send("Page.navigate", { url }, sessionId);
    await new Promise((r) => setTimeout(r, 2500));
    const ev = async (expression: string) => { const r = await c.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, sessionId); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails)); return r.result.value; };
    const shot = async (path: string, clip?: any) => { const r = await c.send("Page.captureScreenshot", { format: "png", ...(clip ? { clip: { ...clip, scale: 1 } } : {}) }, sessionId); await Deno.writeFile(path, Uint8Array.from(atob(r.data), (x) => x.charCodeAt(0))); };
    const key = (k: string, code = k) => c.send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, windowsVirtualKeyCode: k === "Tab" ? 9 : k === "Enter" ? 13 : k === "Escape" ? 27 : 0 }, sessionId).then(() => c.send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code }, sessionId));
    const click = async (x: number, y: number) => { for (const t of ["mouseMoved","mousePressed","mouseReleased"]) await c.send("Input.dispatchMouseEvent", { type: t, x, y, button: "left", clickCount: 1 }, sessionId); };
    return { ev, shot, key, click, targetId, sessionId, close: () => c.send("Target.closeTarget", { targetId }) };
  };
  return { c, open };
}
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
