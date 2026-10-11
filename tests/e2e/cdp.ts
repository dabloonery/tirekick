// tiny CDP helper
export async function connect(port = 9222) {
  const v = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  const ws = new WebSocket(v.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
  let id = 0; const pending = new Map(); const listeners: ((m: any) => void)[] = [];
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } else listeners.forEach((l) => l(m)); };
  const send = (method: string, params: any = {}, sessionId?: string) => new Promise<any>((res, rej) => { const i = ++id; pending.set(i, (m: any) => (m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result))); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
  return { send, on: (l: (m: any) => void) => listeners.push(l), close: () => ws.close() };
}
