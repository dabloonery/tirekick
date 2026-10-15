# Tirekick: Chrome Web Store submission checklist

*2026-10-14. The order to do things in, who does each, and what's ready. Nothing here has been
submitted or published.* Store form answers are in `store/LISTING.md`; the security review is in
`store/SECURITY-REVIEW.md`; the draft website is in `site/`.

**Myer** = needs your accounts, money or hands. **Claude** = can be done in the project.

## 1. Accounts and domain (Myer)

- [ ] Register **tirekick.app**. `.app` domains only work over HTTPS, which any of the hosts below handle for free.
- [ ] Set up a contact address on it (support@tirekick.app, forwarded to your inbox). The store
      shows it publicly, and the privacy policy needs one.
- [x] (Paid, 2026-10-15.) Create a Chrome Web Store developer account at https://chrome.google.com/webstore/devconsole
      (one-time registration fee; needs a Google account with 2-Step Verification).
- [ ] In the developer account, declare **trader or non-trader** status (an EU requirement). A free hobby
      project with no income is usually non-trader. Traders must show a public address and phone number.
- [ ] Verify the contact email the dashboard asks for.

## 2. Website and privacy policy (Claude drafts, Myer deploys)

- [x] Landing, privacy and help pages: `site/index.html`, `site/privacy.html`, `site/support.html` (static,
      no scripts, no tracking, fonts self-hosted, links relative so any address works). The pages speak to
      both audiences Myer agreed on (`plans/tirekick-future.md`): everyday buyers (free scam marks, checking a big
      purchase) and resellers (sold prices on Marketplace, Reseller mode), with AI last and optional. The help page
      answers the "will this get my account banned" worry. Colors brighter than the extension's light theme on purpose.
- [ ] Set up support@tirekick.app (already filled in on the site, in `store/PRIVACY.md` and the listing):
      register tirekick.app and forward the mailbox.
- [ ] Publish it. GitHub Pages is free for **public** repositories only (private ones need a paid plan), and this
      one stays private until 1.0.0, so: make a small public repository just for the site (steps in
      `site/README.md`), giving `https://dabloonery.github.io/<name>/`. At launch, when this repository goes
      public, the **Website** workflow (`.github/workflows/pages.yml`, run by hand) can publish `site/` from here
      instead. A domain such as tirekick.app is optional; either host can use one later.
- [ ] Check `<site address>/privacy` loads in a private window. That is the **privacy policy URL** for the
      store; `<site address>/support` is the support page.

## 3. Code and repo

*Status 2026-10-14: the redesign fixes and the ux-spec port (0.36.0) are on `main`, plus the robustness
work (PRs #14 to #21). Nothing below is done yet.*

- [ ] **Myer:** rename the GitHub repo to `tirekick` (Settings, General). GitHub redirects the old address.
- [ ] **Claude:** set `homepage_url` to `https://tirekick.app`, update README and listing links, and
      replace the contact placeholders. Small PR.
- [ ] **Claude (optional):** the L1 hardening from the security review (three links through `safeUrl`).
- [ ] **Claude:** bump the version for the store build (suggest **1.0.0** for the first public release).
- [ ] Run `deno task test`, then `deno task pack`. Unzip `dist/tirekick-<version>.zip` into a fresh folder,
      load it with **Load unpacked**, and click through: an eBay search, the panel, a scan with your key,
      a Marketplace search, settings, a backup and restore.

## 4. Store images

| Asset | Size | Status |
|---|---|---|
| Store icon | 128 × 128 | ✅ `icons/icon128.png` |
| Screenshots (1 to 5) | 1280 × 800 | ⚠️ 3, 4 and 5 are ready. **1 and 2 are test pages: replace with real eBay captures** |
| Small promo tile | 440 × 280 | ✅ `store/promo-small.png` (draft) |
| Marquee promo tile | 1400 × 560 | Optional; only used if the store features the extension. Skip for now |

Taking screenshots 1 and 2 (**Myer**, since it needs your eBay session and API key):

1. Set the browser window so the page area is 1280 × 800 (Chrome DevTools device toolbar, "Responsive",
   1280 × 800, zoom 100%), or capture larger and crop to 16:10.
2. **1-scan:** run a real eBay search with 30+ results (something photogenic: film cameras, guitars,
   handheld consoles), open the panel, press Scan, wait for the dots. Capture with the panel open.
3. **2-listing:** open one of the better-scored listings, press Analyze this listing, capture once the
   verdict, offer and price history show.
4. Check nothing personal shows (your eBay username, saved addresses, browser bookmarks bar, other tabs).
5. Drop them into `store/screenshots/` with the same names. Claude can crop, resize and check them.

## 5. Fill in the store forms (Myer, with `store/LISTING.md` open)

- [ ] **Package:** upload `dist/tirekick-<version>.zip`.
- [ ] **Store listing:** description, category (Shopping), language, the images above.
- [ ] **Privacy:** single purpose, each permission's justification, "No, I am not using remote code",
      the data-use boxes and the three certifications, privacy policy URL `https://tirekick.app/privacy`.
- [ ] **Distribution:** Public, all regions. (Or **Unlisted** first if you'd like a soft launch: only
      people with the link can install it, and you can switch to Public later.)
- [ ] **Test instructions** (shown to the reviewer): paste "Notes for the reviewer" from `store/LISTING.md`.
- [ ] Submit for review. First reviews usually take a few days and can run longer with broad host
      permissions (see M1 in the security review).

## 6. After approval

- [ ] Put the store link on the website's "Add to Chrome" button (Claude).
- [ ] Install from the store on a clean Chrome profile and check the first-run settings page opens.
- [ ] Install the store build in **Vivaldi** too and run the five checks in the security review's
      Vivaldi section (icon and badge, shortcut, the three right-click entries).
- [ ] Keep the unpacked copy you use day to day separate from the store install: they have different
      extension IDs, so saved data doesn't move between them. Use **Save a backup** and **Restore**
      in settings to carry it across.

## If the review comes back with questions

- **"Broad host permissions":** point to the optional-permission justification; offer to remove the
  custom-address option for 1.0 if needed (security review M1).
- **"Runs on all of facebook.com":** Facebook is a single-page app; the script only reads `/marketplace`
  pages (security review M2).
- **"Purpose unclear" or "keyword stuffing":** the AI service names in the description can be trimmed
  to "Claude, OpenAI, Gemini and more".
