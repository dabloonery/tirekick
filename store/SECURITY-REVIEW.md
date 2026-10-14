# Tirekick: security and permissions review

*2026-10-14, against `main` at 0.35.0 (commit 381f758). Review only: no extension code was changed.*

*0.36.0 adds automatic scanning (off until turned on), Tirekick's own page (`hub/`) and a right-click "Look up" on selected text. It asks for no new permissions; the menu item is under `contextMenus` below, and the privacy policy covers both.*

**Verdict: nothing blocks submission.** No remote code, no `eval`, no web-accessible resources, no
`externally_connectable`, and every network destination is either declared or approved by the user one
address at a time. The package builds clean (`node scripts/pack.mjs`: 16 files, 269 KB, no tests or
source maps). Two items are worth knowing before review starts (M1, M2); the rest are small hardening
ideas for a later release.

## What was checked

| Area | Result | Where |
|---|---|---|
| Remote code | None. Every script ships in the package; no `eval`, `new Function`, CDN scripts or remote fonts. | whole package |
| Exposure to web pages | No `web_accessible_resources`, no `externally_connectable`. Fonts reach pages as bytes over messaging, so a page can't detect the extension through them. | `manifest.json`, `background.js:812` |
| API keys | Kept in `chrome.storage.local`. The settings the page script gets have both keys stripped. Keys go only to their own service, and only from the background worker or the settings page. | `background.js:824` |
| Rendering page and AI text | The panel builds elements with `textContent` (the `h()` helper). The three `innerHTML` uses are static CSS or fixed words and numbers. | `content/panel.js:85`, `:143`, `:3017`, `:3756` |
| Links to stored addresses | Saved listings and searches (which a restored backup can fill) only become links when they point at `https://www.ebay.com` or `https://www.facebook.com`; anything else falls back to a rebuilt address. | `lib/shared.js:10` |
| Photos sent to AI | Only eBay and Facebook image hosts or inline `data:` images, checked again after redirects, capped at 3.5 MB. A listing can't make the extension fetch a local or internal address. | `background.js:707` |
| Sold-price fetches | Only `https://www.ebay.com/sch/i.html?...LH_Sold=1` is fetched; anything else is refused. | `background.js:766` |
| Opening tabs | Only eBay search or browse pages and Marketplace pages, at most 12. | `background.js:833` |
| Custom AI addresses | Each one needs the user's OK through `chrome.permissions.request` before any request goes out; a restored backup can't skip that. | `options/options.js:21`, `background.js:74`, `:225` |
| Background activity | None. Page scripts load on eBay and Facebook (or only on click, with the slim tab off). Nothing runs on a timer. | `background.js:931` |

## Permissions as users will see them

At install Chrome will say Tirekick can **read and change your data on www.ebay.com, www.facebook.com**
and the listed AI services. Localhost addresses (Ollama, LM Studio) don't add a separate warning. The
optional `https://*/*` and `http://*/*` show nothing at install; they come up only when someone tests a
custom address.

Every permission is used, and none can be dropped without losing a feature:

| Permission | Used by |
|---|---|
| `storage` | settings, saved items, seen-listing memory, score cache |
| `scripting` | registering the page script on eBay and Facebook, injecting it on click, reading sold results through an open eBay tab |
| `contextMenus` | "Check this photo", "Open Tirekick home" and, on selected text, "Look up … on eBay and Marketplace" |
| eBay, Facebook, image CDNs | the two sites it works on, and photo checks |
| AI service hosts | the services a user can pick in settings |
| localhost `:11434`, `:1234` | Ollama and LM Studio |
| optional `https://*/*`, `http://*/*` | "another OpenAI-style address" only |

`tabs` is not requested and not needed: `chrome.tabs.query({ url })` works on eBay because the host
permission covers it.

## Findings

### M1. The optional "any address" permission will likely send the item to a slower, closer review

`optional_host_permissions: ["https://*/*", "http://*/*"]` is the right design (nothing granted until the
user approves one address), but the store's review flags broad host patterns even when optional. Expect
a longer first review and possibly a question about it.

**Recommendation:** keep it. The justification and reviewer note in `store/LISTING.md` already explain
it. If the first review stalls on it, a fallback is to ship 1.0 without the custom-address option and
add it back in an update.

### M2. The page script loads on all of www.facebook.com, not only Marketplace

Facebook is a single-page app, so the script has to be present before someone navigates into
Marketplace. It only reads anything when the address starts with `/marketplace` (`content/adapters.js:424`),
but the privacy page says Tirekick doesn't "read pages other than eBay and Facebook Marketplace". That is
accurate about reading, but a reviewer comparing it with the install warning may ask.

**Recommendation:** one sentence in the privacy policy and the reviewer note: "Tirekick's page script is
present on facebook.com so it can follow you into Marketplace, but it only reads Marketplace pages."
The draft site's privacy page already says this.

### L1. Three panel links use page-supplied addresses without the stored-address check

`content/panel.js:2473`, `:2512` (listing links built from the page's own anchors) and `:2725` (sold
listings parsed from eBay's results) put the address straight into `href`. A `javascript:` address
there would run in the web page's own context, not the extension's, so the worst case equals the page
attacking itself.

**Recommendation (later, low priority):** wrap them in `TKShared.safeUrl(...)` like the saved-item
links, for consistency. One-line change each. Not done yet as of 0.36.0; line numbers have drifted, so search
for `it.url` and `x.url` in `content/panel.js`.

### L2. A web page can open or close the panel

The panel listens for `tirekick-show` and `tirekick-toggle` events on `window` (`content/panel.js:1961`,
`:3908`), which the page's own scripts can also dispatch. That only opens, closes or switches the panel
to Home; it can't start a paid scan or read anything. **No change needed.**

### L3. Paid AI requests are limited by the budget, not by who asks

The background worker accepts requests from any of the extension's own contexts (no other extension or
site can reach it). A page can't trigger a scan, so the realistic risk is only the user's own
clicks. The monthly budget setting already caps spending. **No change needed.**

### L4. API keys are stored unencrypted in extension storage

This is normal for extensions that take a user's key: web pages can't read extension storage, and
encrypting it inside the extension wouldn't add protection because the key to decrypt would sit beside
it. The privacy page says keys stay in the browser profile. **No change needed.**

## Housekeeping before submission (not security)

- `homepage_url` points at `github.com/dabloonery/Second-Look`. Update it to `https://tirekick.app`
  once the domain is live (or to the renamed repo).
- The privacy policy and listing still have `<your contact email>` placeholders.
- The 128 px icon is a full-bleed navy tile. The store's guidelines suggest 96 px of artwork inside
  16 px of transparent padding for the store tile; the current one is acceptable but will look a little
  larger than neighbors in search results.

## Vivaldi and other Chromium browsers

Myer uses Vivaldi day to day. Tirekick should behave the same there, because it only uses the standard
Chromium extension APIs: `storage`, `scripting`, `contextMenus`, `action`, `permissions`, `tabs`,
`windows`, `runtime` and `commands`. It doesn't use the Chrome-only or Google-only APIs that other
browsers leave out: no `sidePanel` (the panel is drawn inside the page), `offscreen`, `identity`, Google
sign-in or Chrome Sync. `minimum_chrome_version` 116 is well below current Vivaldi.

Vivaldi installs straight from the Chrome Web Store, so one listing covers it. So do Edge, Brave and
Opera (Opera needs its "Install Chrome Extensions" add-on).

A few things that are Vivaldi's own UI rather than the extension, worth a look in the store build:

| What | Why it might differ | Check |
|---|---|---|
| Toolbar icon and badge | Vivaldi can tuck extension icons into its extensions menu, which hides the badge number | Is the icon showing, and does the badge appear after a saved listing gets cheaper? |
| Alt+Shift+L shortcut | Vivaldi has its own shortcut system, and a Vivaldi shortcut on the same keys would win | Does the shortcut open the panel? If not, set it at vivaldi://extensions/shortcuts |
| "Open Tirekick home" on the icon's right-click menu | That entry uses the `action` menu context, which depends on how Vivaldi draws extension icons | Right-click the icon and look for it. The same thing is reachable by clicking the icon on any non-eBay page |
| "Check this photo with Tirekick" | Standard page right-click menu | Right-click a listing photo on eBay |
| "Look up … on eBay and Marketplace" | Standard right-click menu on selected text | Select a product name on any site and right-click |

This part wasn't tested in Vivaldi here; the automated tests run in Chromium. Myer's daily use of the
unpacked build already covers most of it. The checklist has a step to repeat these checks on the store
build.

## Not covered

The full test suite (`deno task test`) wasn't run here because Deno isn't installed in this
environment, and nothing in the extension changed. Run it before packing the build you upload.
