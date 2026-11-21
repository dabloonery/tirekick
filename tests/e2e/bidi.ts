// The Firefox side of the e2e tests (firefox.ts, started by firefox.sh): what lib.ts does for Chrome over DevTools,
// done over WebDriver BiDi, which Firefox has built in (no geckodriver). The add-on goes in as a temporary add-on
// through Firefox's remote debugging protocol, the way `web-ext run` and about:debugging do it.
export const UUID = "7e5e7e5e-1111-4222-8333-944444444444"; // pinned in firefox.sh's profile, so moz-extension:// is known
export const EXT_URL = `moz-extension://${UUID}`;
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Firefox's remote debugging protocol: "<length>:<json>" frames. Only what installing needs.
export async function installTemporary(port: number, path: string): Promise<string> {
  const conn = await Deno.connect({ hostname: "127.0.0.1", port });
  const enc = new TextEncoder();
  let buf = new Uint8Array(0);
  const next = async (): Promise<any> => {
    for (;;) {
      const colon = buf.indexOf(58); // ":"
      if (colon > 0) {
        const len = Number(new TextDecoder().decode(buf.subarray(0, colon)));
        if (buf.length >= colon + 1 + len) {
          const msg = JSON.parse(new TextDecoder().decode(buf.subarray(colon + 1, colon + 1 + len)));
          buf = buf.slice(colon + 1 + len);
          return msg;
        }
      }
      const chunk = new Uint8Array(65536);
      const n = await conn.read(chunk);
      if (n === null) throw new Error("Firefox closed the debugging connection");
      const grown = new Uint8Array(buf.length + n);
      grown.set(buf);
      grown.set(chunk.subarray(0, n), buf.length);
      buf = grown;
    }
  };
  const send = (m: unknown) => {
    const body = enc.encode(JSON.stringify(m));
    return conn.write(new Uint8Array([...enc.encode(`${body.length}:`), ...body]));
  };
  try {
    await next(); // the greeting
    await send({ to: "root", type: "getRoot" });
    let r;
    do r = await next(); while (!r.addonsActor && !r.error);
    if (r.error) throw new Error(`${r.error}: ${r.message}`);
    await send({ to: r.addonsActor, type: "installTemporaryAddon", addonPath: path });
    do r = await next(); while (!r.addon && !r.error);
    if (r.error) throw new Error(`${r.error}: ${r.message}`);
    return r.addon.id;
  } finally {
    conn.close();
  }
}

export async function start(port = 9223) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/session`);
  await new Promise((ok, no) => ((ws.onopen = ok), (ws.onerror = no)));
  let id = 0;
  const waiting = new Map<number, [(v: any) => void, (e: Error) => void]>();
  const listeners: ((m: any) => void)[] = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    const w = m.id && waiting.get(m.id);
    if (!w) return listeners.forEach((f) => f(m));
    waiting.delete(m.id);
    m.type === "error" ? w[1](new Error(`${m.error}: ${m.message}`)) : w[0](m.result);
  };
  const send = (method: string, params: Record<string, unknown> = {}) =>
    new Promise<any>((ok, no) => {
      waiting.set(++id, [ok, no]);
      ws.send(JSON.stringify({ id, method, params }));
    });
  await send("session.new", { capabilities: { alwaysMatch: { acceptInsecureCerts: true } } });
  // Errors on any page (store pages and our own), as lib.ts's callers collect Runtime.exceptionThrown.
  const errors: string[] = [];
  await send("session.subscribe", { events: ["log.entryAdded"] });
  listeners.push((m) => {
    if (m.method === "log.entryAdded" && (m.params.type === "javascript" || m.params.level === "error")) errors.push(`${m.params.text} (${m.params.source?.context ? "page" : "?"})`);
  });
  const value = (r: any): any => {
    if (r.type === "exception") throw new Error(r.exceptionDetails?.text || "exception");
    return deserialize(r.result);
  };
  // A page wrapper for a browsing context, like lib.ts's open() gives.
  const wrap = (context: string, wait: number) => {
    // An expression, promises awaited, the value back as plain data.
    const ev = async (expression: string) =>
      value(await send("script.evaluate", { expression, target: { context }, awaitPromise: true, serializationOptions: { maxObjectDepth: 20 } }));
    // A real mouse click on the element `selector` finds, as a person makes it: Firefox only asks for a permission
    // inside one (a script's click() or WebDriver's userActivation isn't enough for an add-on).
    const click = async (selector: string) => {
      const [x, y] = await ev(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.scrollIntoView({ block: "center" }); const r = el.getBoundingClientRect(); return [Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)]; })()`);
      await send("input.performActions", { context, actions: [{ type: "pointer", id: "mouse", parameters: { pointerType: "mouse" }, actions: [{ type: "pointerMove", x, y }, { type: "pointerDown", button: 0 }, { type: "pointerUp", button: 0 }] }] });
    };
    const shot = async (path: string) => {
      const { data } = await send("browsingContext.captureScreenshot", { context, origin: "document" });
      await Deno.writeFile(path, Uint8Array.from(atob(data), (x) => x.charCodeAt(0)));
    };
    const reload = async (ms = wait) => {
      await send("browsingContext.reload", { context, wait: "complete" });
      await sleep(ms);
    };
    return { ev, click, shot, reload, context, close: () => send("browsingContext.close", { context }) };
  };
  const tabs = async () => (await send("browsingContext.getTree", { maxDepth: 0 })).contexts as { context: string; url: string }[];
  // A tab that's already open (Firefox opens settings on install), once its address starts with `prefix`.
  const adopt = async (prefix: string, wait = 1500, skip: string[] = []) => {
    for (let t = 0; t < 10000; t += 250) {
      const hit = (await tabs()).find((x) => x.url.startsWith(prefix) && !skip.includes(x.context));
      if (hit) return (await sleep(wait), wrap(hit.context, wait));
      await sleep(250);
    }
    throw new Error(`no tab at ${prefix}`);
  };
  const open = async (url: string, wait = 2500) => {
    // Newer Firefox won't let WebDriver navigate a tab to a moz-extension:// page, so the add-on opens its own pages:
    // one of them asks for a new tab (tabs.create needs no permission), and the test picks that tab up.
    if (url.startsWith("moz-extension:")) {
      const before = (await tabs()).map((x) => x.context);
      const ours = (await tabs()).find((x) => x.url.startsWith(EXT_URL));
      if (!ours) throw new Error("no moz-extension tab to open another from");
      await wrap(ours.context, 0).ev(`browser.tabs.create({ url: ${JSON.stringify(url)} }).then(() => true)`);
      return adopt(url, wait, before);
    }
    const { context } = await send("browsingContext.create", { type: "tab" });
    await send("browsingContext.setViewport", { context, viewport: { width: 1400, height: 900 } }).catch(() => {});
    await send("browsingContext.navigate", { context, url, wait: "complete" });
    await sleep(wait);
    return wrap(context, wait);
  };
  return { send, open, adopt, errors, close: () => ws.close() };
}

// BiDi's remote values back into plain data (objects, arrays, strings, numbers, booleans, null).
function deserialize(v: any): any {
  if (!v) return v;
  switch (v.type) {
    case "undefined":
    case "null":
      return v.type === "null" ? null : undefined;
    case "string":
    case "boolean":
      return v.value;
    case "number":
      return typeof v.value === "number" ? v.value : Number(v.value);
    case "array":
      return (v.value || []).map(deserialize);
    case "object":
      return Object.fromEntries((v.value || []).map(([k, x]: [any, any]) => [typeof k === "string" ? k : deserialize(k), deserialize(x)]));
    default:
      return v.value === undefined ? `[${v.type}]` : v.value;
  }
}
