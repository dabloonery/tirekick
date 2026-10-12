// Loads the extension's plain scripts (no page needed) so their pure functions can be tested.
//   deno test --allow-read tests/unit/      (they use node:test, so `node --test tests/unit/` works too)
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let loaded;
export function loadScripts() {
  loaded ??= (async () => {
    globalThis.window = globalThis;
    globalThis.self = globalThis;
    // The adapters only look at the page when asked; these let them load outside one.
    globalThis.location ??= { hostname: "www.ebay.com", href: "https://www.ebay.com/", pathname: "/" };
    globalThis.document ??= { querySelector: () => null, querySelectorAll: () => [] };
    for (const f of ["lib/shared.js", "content/rules.js", "content/adapters.js"]) await import(pathToFileURL(path.join(ROOT, f)).href);
    return { S: globalThis.SLShared, R: globalThis.SLRules, SL: globalThis.SecondLook };
  })();
  return loaded;
}
