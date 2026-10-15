# Tirekick roadmap

What's next for Tirekick: getting into the Chrome Web Store, making the no-AI features sturdier,
and briefs for new features. Voice, the rename plan and the security review are in
[REFERENCE.md](REFERENCE.md). Store listing text and images live in `store/`.

## Contents

- [Next steps](#next-steps) (2026-10-14: the order of work, and what waits on Myer)
- [Built for one person, reassessed for everyone](#built-for-one-person-reassessed-for-everyone) (2026-10-15)
- [Tirekick: Chrome Web Store submission checklist](#tirekick-chrome-web-store-submission-checklist)
- [Tirekick: making the no-AI features sturdier](#tirekick-making-the-no-ai-features-sturdier)
- [Tirekick feature briefs](#tirekick-feature-briefs)
  - [Brief 1: Alerts on saved searches](#brief-1-alerts-on-saved-searches) (Myer chose options 1 and 2; not built yet)
  - [Brief 2: Price history on saved items](#brief-2-price-history-on-saved-items)
  - [Brief 3: Offer helper](#brief-3-offer-helper)
  - [Brief 4: Stronger scam checks](#brief-4-stronger-scam-checks)
  - [Brief 5: More stores](#brief-5-more-stores)
  - [Brief 6: Sync and export](#brief-6-sync-and-export)
  - [Brief 7: Built-in browser AI](#brief-7-built-in-browser-ai) (first after the 1.0.0 launch)
  - [Brief 8: Price data beyond eBay sold listings](#brief-8-price-data-beyond-ebay-sold-listings) (plan; check first that it helps)
  - [Brief 9: More browsers](#brief-9-more-browsers) (Edge store, then Firefox, then Safari)
  - [Brief 10: More AI options](#brief-10-more-ai-options) (quality menu for every service)

---

## Next steps

*2026-10-14, against `main` at 0.36.0 plus this PR. The order of work across the plans below. Myer added one
direction on 2026-10-14: "sturdier non-AI features should also mean they're more useful, accurate and
plentiful; fill gaps". So the free parts of the feature briefs come before anything else that needs a model.*

### Where each plan stands

| Plan | State |
|---|---|
| Store checklist | The writing is done. Accounts, a public privacy-policy page and screenshots 1 and 2 wait on Myer. Not submitted, and won't be without Myer's OK |
| Sturdier no-AI features | All 8 items shipped (#14 to #21). Still open: real saved eBay and Marketplace pages in place of the hand-made fixtures |
| Security review | No blockers. L1 done in 0.37.0 |
| US English fixes (REFERENCE §5) | Done |
| Feature briefs | See "Order" below |
| Live checks | Never done: the extension on real eBay and Marketplace pages, **eBay sold-price lookups on real sold pages**, the Vivaldi checks, a screen reader |

### Version numbers

PRs #13 to #22 all shipped as 0.36.0, and an older pre-rename build (`second-look-0.36.1.zip`) carries a higher
number. From 0.37.0 on, CI fails a pull request that doesn't raise the version (`deno task version-check`).

### Order

1. **0.37.0 housekeeping**: the version check, L1, test docs, this section.
2. **More free features, and better ones.** Done in 0.37.0 and 0.38.0, from the briefs' parts that need no model:
   - Brief 4: "Likely scam?" and "Too cheap?" marks ("Typical is $300" since 0.40.0) from a trusted sold median; Marketplace's
     "Joined Facebook in …" warns on an account made this year. 0.38.0: **Same photo as 2 other listings** on
     Marketplace, from fingerprints (dHash) of thumbnails on screen, kept 90 days; the same file or the same title
     doesn't count, and scans are told. *Still open:* eBay, which needs the seller on each card first (sellers there
     reuse their own photos).
   - Brief 3: an opening offer and walk-away price from sold prices, with the reason shown, and three message
     templates to pick, edit and copy, before any analysis. 0.38.0: **They said $…** answers take it, meet in the
     middle or a last offer, and rewrites the message; Analyze gets the plan and its range is kept near it.
   - Brief 2: how long a listing has been up, how a saved one moved since you saved it, "the seller may take less",
     and saved listings' history kept past the 90-day prune. *Still open:* relists.
   - Brief 6, part 1: saved listings as a spreadsheet (CSV), from Saved and from settings. *Still open:* sync.
   - 0.39.0, from Myer's first live look: a **free read** on every listing before a scan ("Good price · $53 below typical"; since 0.40.0 the price is said in dollars against the "typical" price everywhere, not "% of sold",
     "Check first", "Off-topic"), which also orders the list; **Work one out from sold prices** on a listing page
     gives the offer without an analysis; the Marketplace home feed hides **off-topic** posts (rentals, services,
     jobs, pets, "looking for", $1 placeholders: `TKRules.offTopic`), on by default there, one click to show; search
     ideas on the feed; color back (navy dark theme, tags tinted by verdict); the toolbar icon opens Tirekick's page as
     a popup off the stores, and its right-click menu has one entry of ours ("Open Tirekick in a tab"). *Still open:* learning what you skip
     on the feed (titles you mark Not interested) to hide more like them.
   - 0.40.0: the price chip says "typical" instead of "sold" ("$53 below typical", the source on hover); no browser
     box of past entries over Tirekick's text boxes; a quieter slate navy in dark; "1 possible scam" in the page summary. The AI choice is neutral: one "AI service" menu lists every supported service side by side, a fresh install picks none, and the panel's menu offers only the services you set up.
   - 0.40.2, the review pass's clear-cut fixes: no stray "null" in the toolbar popup with one saved search; each
     card's Save / Sold / Not interested are one toolbar with one Tab stop (arrow keys inside); long tags wrap inside
     the card; "$55" instead of "$55–$55"; "$39 above typical" said once; the footer's AI menu on one line; a tighter
     header and footer in short windows; 24px targets on the small text links; settings fields stay clear of the
     sticky section links; the website's skip link, footer targets and the navy band's link line contrast. The
     choices that are Myer's (which verdict wins when price and score disagree, a bigger text floor, "sold" wording,
     the offer warning, the search-ideas name, the light theme's main button) wait on Myer.
   - 0.41.0, Myer's six choices from the review pass: when the score and the price disagree the **price check
     wins** (`TKRules.priceVerdict`: far under the typical price reads "Great price, if it's real" in the scam color
     and counts as a skip; over 125% of it is no better than Fair price); a **13px floor** for chips and labels and
     **14px** for reasons, price lines and the welcome; **"typical price (recent eBay sales)"** instead of "sold" in
     the panel (the cards' "Sold ↗" stays: it opens eBay's sold listings); a one-line **warning** when an offer is
     under half the ask; one name, **Search ideas**; the **orange main button** in light mode too.
   - 0.42.0, a light shift toward everyday buyers (Myer, 2026-10-15): the store summary and description lead with
     "Good price or scam?"; reseller tools stay, with neutral words ("price gap after fees", not "margin";
     "to sell on", not "fix up and flip"); resale gets one quiet line in the listing.
   - 0.43.0, the logo's tread made visible (Myer, 2026-10-15, a one-off exception to "don't change the logo"):
     same tire, shape and colors, with fewer, chunkier marks set just in from the rim in a muted orange-navy
     (`TKTheme.logoTread`, used by the icons, the site and the panel mark). The 16 and 32 px icons drop the navy tile, so the toolbar shows just the tire.
3. **Live check in Vivaldi (Myer)**: an eBay search with Sold prices, one scan, a Marketplace search, Analyze on a
   listing, the Vivaldi checks in REFERENCE's security review; save the real pages the fixtures need.
4. **Brief 1, options 1 and 2**: alerts on saved searches, also from the free signals above (at your price, far
   under sold), not only from a model's "Great".
5. **Store, when Myer is ready.** A public privacy-policy page is required; a free GitHub Pages site works, and a
   domain such as tirekick.app is optional (Myer to decide). Then the contact address, `homepage_url` and 1.0.0.
6. **Brief 7, built-in browser AI**, the first feature after the 1.0.0 launch (Myer: "let's make that a
   priority"). A free model with no key, where the browser has one.
7. **Brief 5, more stores** (Craigslist first).

### For Myer, in order (2026-10-14)

1. **Review and merge the 0.40.0 PR** on GitHub: open it and press **Merge pull request** (or ask Claude to).
2. **Install 0.40.0 in Vivaldi.** Unzip `tirekick-0.40.0.zip` into the folder Vivaldi already loads Tirekick from,
   replacing its files (same folder name and place, so your saved data stays), then press the reload arrow on
   Tirekick in `vivaldi://extensions`. The card there should say 0.40.0. (Or ask Claude to update the folder.)
3. **The live check, about 20 minutes.** Each one is something the tests can't reach:
   - An eBay search (say "pentax k1000"): open the panel, press **Sold prices**. Do numbers appear, and "$… below typical"
     on the cards? Any "Too cheap?" chips look right?
   - Press **Scan** once with your key. Tags on the cards, and the ranked list?
   - Open a listing from that search: is there an **Offer** box with a message you can copy? Type a price under
     **They said $**: does the advice make sense?
   - A Marketplace search, then one listing: does it say how long ago it was listed, and warn if the seller joined
     Facebook this year? Scroll a while: any **Same photo as … other listings** marks, and do they look right?
   - Saved: **Download (CSV)** opens in a spreadsheet.
   - eBay: open a new listing or search tab without refreshing: does the panel's tab appear by itself? Click a card
     in the panel's list: is the outline on top of its neighbors, and do the reasons pop-ups sit above other tags?
   - The Marketplace home page: are rentals, massages and "looking for" posts gone, and **Hide off-topic** off
     brings them back? Anything real hidden by mistake?
   - Vivaldi: the toolbar icon opens a popup on other sites and the panel on eBay and Marketplace; its number, Alt+Shift+L (change it at `vivaldi://extensions/shortcuts`), right-click a photo ("Check this photo"), right-click
     selected text ("Look up").
   - Tell Claude what broke, with a screenshot if you can.
4. **Save real pages for the tests** while you're there (right-click the page, **Save as**, "Webpage, HTML only"):
   an eBay search, an eBay sold search, an eBay listing, a Marketplace search and a Marketplace listing. Put them in
   your Second-Look folder under `tests/fixtures/real/` and say so.
5. **Decide on a domain** (Myer: "I might"). Not required: a free GitHub Pages address works for the privacy policy. If you want
   tirekick.app, register it; either way, set up a contact email address for the store listing.
6. **Store accounts:** ~~a Chrome Web Store developer account~~ (done: Myer paid the fee, 2026-10-15). Still to
   set: trader or non-trader status in the developer dashboard.
7. **Screenshots 1 and 2** from real eBay pages (steps in the store checklist below).
8. **Before going public:** decide whether to rewrite history to remove your email from old commits, and turn on
   GitHub's "Keep my email address private".

### Open source at 1.0.0 (decided 2026-10-14)

Myer agreed: license Tirekick under **Apache-2.0** and make the repository public at the 1.0.0 store launch.
Before it goes public:

- [x] Scrub personal paths from the docs (the home-folder path in REFERENCE's rename notes, removed in 0.37.0).
- [ ] Replace `LICENSE` with Apache-2.0 and update README's "License and disclaimer" (the font stays under the OFL).
- [ ] Remove Myer's personal email from the commit history: see [Brand over personal name](#brand-over-personal-name).
- [ ] Check again that no keys, tokens or private details are in the files or the history.

The name, alongside it:

- [ ] Use "Tirekick™" where the name first appears in the README, the store listing and the website (™ needs no
      registration).
- [ ] Before launch, run a clearance search for "Tirekick" and "Tire Kick" in software: USPTO (classes 9 and 42),
      the Chrome Web Store, and app stores.
- [ ] Around the open-source launch, file a USPTO registration in class 9 (Myer).

### Brand over personal name

*Added 2026-10-15 (Myer: "remove my name and info where possible and replace with tirekick.app or Tirekick").
Myer isn't hiding that they made Tirekick; the brand should simply be what people see.*

Audit of both repos and the accounts around them:

| Where | What shows now | Status |
| --- | --- | --- |
| `LICENSE`, README "License and disclaimer" | was "dabloonery" | Done in 0.42.2: "The Tirekick authors" |
| `store/LISTING.md` homepage | was the GitHub repo | Done in 0.42.2: `https://tirekick.app` |
| `manifest.json` `homepage_url` | was the GitHub repo | Done in PR #30: `https://tirekick.app` |
| Code comments (`rules.js`, `theme.js`, `panel.js`) | Myer's name | Done in 0.42.2 |
| Website repo `tirekick-site` | "© 2026 Tirekick™", support@tirekick.app, no personal details, one commit by Claude | Clean |
| Store listing, privacy policy, site contact | support@tirekick.app | Clean, once the mailbox forwards |
| Main repo commit history | personal email on 25 commits (24 by Myer, 1 by Claude) | Myer, step 1 |
| GitHub owner `dabloonery` | in both repo addresses and as the author of every merge | Myer, step 2 |
| Chrome Web Store publisher name and contact email | not set yet | Myer, step 3 |
| Internal notes (`AGENTS.md`, this file, `REFERENCE.md`, `store/SUBMISSION-CHECKLIST.md`, `store/SECURITY-REVIEW.md`) | "Myer" as the decision maker | Claude, step 5 |

Steps for Myer, in order. None of these can be done from the project, and steps 1 and 2 can't be undone:

1. **Commit history (recommended: publish a clean copy, don't rewrite this repo).** At 1.0.0, rather than
   making this repository public, push a copy whose history has the personal email swapped for GitHub's
   private address (`118295889+dabloonery@users.noreply.github.com`) to a new public repo, and keep this one
   private. Rewriting this repo in place also works, but GitHub keeps old pull requests' commits, so the email
   would still be reachable through them. Either way, first turn on GitHub's Settings, Emails, "Keep my email
   address private" and "Block command line pushes that expose my email", and set that private address as
   `git config --global user.email` on your computer. Claude can prepare the clean copy when you say so.
2. **GitHub owner (recommended: a free "tirekick" organization, not a second account).** An organization
   you own keeps one login (no second password or two-factor setup), GitHub redirects the old addresses,
   and your personal account only shows if someone opens the members list (set your membership to
   private) or your own commits. A second personal account would mean juggling two logins and SSH keys,
   and its name would still show on every commit made from it. Steps, best done after the open PRs merge:
   1. On github.com, your picture, "Your organizations", "New organization", the Free plan, name `tirekick`
      (if taken, `tirekick-app`). In the organization's People page, set your membership to Private.
   2. In each repo (`tirekick`, then `tirekick-site`): Settings, General, Danger Zone, "Transfer", choose
      the organization. Issues, PRs, stars and history move with it.
   3. Site: in `tirekick-site`, Settings, Pages, check the custom domain still reads tirekick.app (re-enter
      it if blank) and that "Enforce HTTPS" is on. The Cloudflare DNS records don't change for a custom
      domain, but if a record points at `dabloonery.github.io`, change it to `tirekick.github.io`.
   4. Claude: install the Claude GitHub App on the new organization
      (github.com/apps/claude/installations/select_target, pick `tirekick`, allow both repos). Then in
      this project's settings, under repositories, remove the old `dabloonery/...` entries and add
      `tirekick/tirekick` and `tirekick/tirekick-site`, and reconnect GitHub at
      claude.ai/connect-github if asked. Tell Claude when it's done so it can check access.
   5. Your computer: in `/home/myerl/Second-Look` run
      `git remote set-url origin https://github.com/tirekick/tirekick.git` (the old address keeps working
      through the redirect, but this is cleaner).
   6. Claude, in the next PR: update the `dabloonery` links left in the docs and `site/README.md`.
3. **Chrome Web Store account (recommended: publisher name "Tirekick").** In the developer dashboard's
   Account page, set the publisher display name to "Tirekick" and the contact email to support@tirekick.app
   (it must be verified, so set up forwarding first). Stay a non-trader, which keeps a home address off the
   listing; a trader account would show an address and phone number.
4. **Email and domain.** Finish support@tirekick.app forwarding in Cloudflare Email Routing. Replies sent
   from your own mailbox show your personal address; to reply as support@tirekick.app, add it as a "send as"
   address in your mail app or use a mailbox on the domain. Cloudflare hides the domain owner's details in
   WHOIS by default; check that it does for tirekick.app.
5. **Internal notes (Claude, in the 1.0.0 PR).** Before the code goes public, change "Myer" to "the owner"
   in the files listed in the table, so the public repo carries no names.

---

<!-- merged from store-prep/SUBMISSION-CHECKLIST.md -->

## Built for one person, reassessed for everyone

*2026-10-15, from Myer: several features were made for Myer's own testing and taste. Each was looked at again for
everyday buyers (the main audience) and resellers. Myer's calls are marked; Claude went ahead on its recommendation
for each, one PR per change.*

| What | Was | Call | Where |
|---|---|---|---|
| "What you use" counters on Home | Made to see which features Myer used | **Removed.** Only the scan and typical-price counts stay (they drive the first-run checklist and the mode hint) | 0.44.0 |
| Copyable questions for the seller | Part of every analysis | **Removed** (Myer: redundant). The AI no longer writes them, so an analysis costs a little less | 0.44.0 |
| AI spending | A Home tile, a 30-day chart, the footer, a settings section near the top | **Kept, quieter** (Myer). No Home tile; the chart only once something was spent; the footer amount only with a paid service; settings moved it down and folded it | 0.44.0 |
| Default "What you're into" | Retro tech, consoles and homebrew (Myer's taste) for everyone | **Blank by default.** An install already using the old default keeps it (storage upgrade 2) | 0.44.0 |
| Homebrew line in an analysis | One sentence on a modding scene | **Removed**: it only fits a few consoles | 0.44.0 |
| Footer model menu | Shown with "No AI yet" before any AI | **Hidden until an AI is set up** | 0.44.0 |
| Listings per request, storage used | In the main settings and on Home | **Advanced fold** in settings; the storage line moved under Backup | 0.44.0 |
| Getting started | "Connect a model" first | **AI last and optional**: look at a search, check the typical price, save, then add an AI if you like | 0.44.0 |
| "Check this page" | Copies a report when a page can't be read | **Kept**: it's how strangers can report a broken store page | |
| Reseller mode, repair notes | Already quieter since 0.42.0 | **Kept** as is | |

### Still to do in this round

1. ~~**Before a scan**~~ (0.45.0): a free "Typical price" on a card's hover, from that listing's own title; with no
   AI set up, the free price check is the panel's main button and the AI note is a quiet card after it. Not automatic
   when a page opens (Ground rules: nothing fetched you didn't ask for).
2. **Scores, in two parts** (next, after Myer's live check, since it changes what the AI is asked and needs real
   listings to tune): the price verdict (free, from sales) and the AI's **Fit** (condition, what you want,
   risk). Tags lead with the words; the number moves into the reasons.
3. ~~**Broad words and category pages**~~ (0.45.0, `TKRules.broadQuery`): no page-wide comparison against a category ("Electronics"): Tirekick says the
   words are too broad, and each listing gets its own typical price from its title. When no lookup can be made
   (eBay blocks it, too few sales, turned off) the card says so and why, with a link to eBay's sold listings.
4. ~~**Audit and clean-up**~~ (0.46.0): "·" separators dropped where color or weight already parts the words
   (Myer, 2026-10-15): a verdict in color is followed by a space ("Fair price ~$45 below the typical price ($116)"),
   a chip's lead word is bold ("**Good price** $53 below typical"), lists of numbers use commas, "Filter (2)". Kept
   where nothing else separates the parts (model menu entries, saved-row details). The panel's own copy of the
   spending summary now uses `TKShared.usageSummary`.
5. ~~**Holistic review**~~ (0.47.0, before the beta):
   - Settings open on what works without an AI: On the page, Filters, then **AI scores** (optional), Judging,
     Spending, Backup. With no AI chosen the banner says "Ready: price checks and scam marks", not "One step left".
   - The panel's AI buttons open Settings at AI scores; the budget link at Spending; a storage error at Backup.
   - On a results page the "Scores are optional" card comes after the typical price, not before it.
   - Home's getting-started steps that are done shrink to their title.
   - Fixes: "Unhide all" cleared a shared record with a direct write (now `storeEdit`); "Open it" on a listing
     that scrolled away now goes through `safeUrl`; a storage error pointed at Home for storage use (now in Settings).
   - Checked and fine: no dead functions or unused message handlers, no stray `console.log`, the 1-second
     page tick is cheap when nothing changed.
   - Left as is: `content/panel.js` is 4,400 lines; splitting it is worth doing after launch, not before.

## Tirekick: Chrome Web Store submission checklist

*2026-10-14. The order to do things in, who does each, and what's ready. Nothing here has been
submitted or published.* Store form answers are in `store/LISTING.md`; the security review is in
`store/SECURITY-REVIEW.md`; the draft website is in `site/`.

**Myer** = needs your accounts, money or hands. **Claude** = can be done in the project.

### 1. Accounts and domain (Myer)

- [x] Register **tirekick.app** (Myer, 2026-10-15). `.app` domains only work over HTTPS, which any of the hosts below handle for free.
- [ ] Set up a contact address on it (support@tirekick.app, forwarded to your inbox). The store
      shows it publicly, and the privacy policy needs one.
- [x] Create a Chrome Web Store developer account (done, 2026-10-15) at https://chrome.google.com/webstore/devconsole
      (one-time registration fee; needs a Google account with 2-Step Verification).
- [ ] In the developer account, declare **trader or non-trader** status (an EU requirement). A free hobby
      project with no income is usually non-trader. Traders must show a public address and phone number.
- [ ] Verify the contact email the dashboard asks for.

### 2. Website and privacy policy (Claude drafts, Myer deploys)

- [x] Landing, privacy and help pages: `site/index.html`, `site/privacy.html`, `site/support.html` (static,
      no scripts, no tracking, fonts self-hosted, links relative so any address works). The pages speak to
      both audiences Myer agreed on (`plans/tirekick-future.md`): everyday buyers (free scam marks, checking a big
      purchase) and resellers (sold prices on Marketplace, Reseller mode), with AI last and optional. The help page
      answers the "will this get my account banned" worry. Colors brighter than the extension's light theme on purpose.
- [ ] Set up support@tirekick.app (already filled in on the site, in `store/PRIVACY.md` and the listing):
      register tirekick.app and forward the mailbox.
- [ ] Launch the site with the extension: once the store listing is approved, replace `STORE_LISTING_URL` in
      `site/index.html` with its address, then publish the site (steps in `site/README.md`).
- [ ] Publish it. GitHub Pages is free for **public** repositories only (private ones need a paid plan), and this
      one stays private until 1.0.0, so: make a small public repository just for the site (steps in
      `site/README.md`), giving `https://dabloonery.github.io/<name>/`. At launch, when this repository goes
      public, the **Website** workflow (`.github/workflows/pages.yml`, run by hand) can publish `site/` from here
      instead. A domain such as tirekick.app is optional; either host can use one later.
- [ ] Check `<site address>/privacy` loads in a private window. That is the **privacy policy URL** for the
      store; `<site address>/support` is the support page.

### 3. Code and repo

*Status 2026-10-14: the redesign fixes and the ux-spec port (0.36.0) are on `main`, plus the robustness PRs #14 to #21. Nothing below is done yet.*

- [ ] **Myer:** rename the GitHub repo to `tirekick` (Settings, General). GitHub redirects the old address.
- [ ] **Claude, at 1.0.0:** Apache-2.0 `LICENSE` and README license section; then the repo goes public (see
      [Open source at 1.0.0](#open-source-at-100-decided-2026-10-14) for what to do first).
- [x] **Claude:** set `homepage_url` to `https://tirekick.app`, update the listing link, and replace the contact
      placeholders (0.40.2). The site has a `CNAME` for tirekick.app; publishing steps are in `site/README.md`.
- [x] **Claude (optional):** the L1 hardening from the security review (links through `safeUrl`). Done in 0.37.0.
- [ ] **Claude:** bump the version for the store build (suggest **1.0.0** for the first public release).
- [ ] Run `deno task test`, then `deno task pack`. Unzip `dist/tirekick-<version>.zip` into a fresh folder,
      load it with **Load unpacked**, and click through: an eBay search, the panel, a scan with your key,
      a Marketplace search, settings, a backup and restore.

### 4. Store images

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

### 5. Fill in the store forms (Myer, with `store/LISTING.md` open)

- [ ] **Package:** upload `dist/tirekick-<version>.zip`.
- [ ] **Store listing:** description, category (Shopping), language, the images above.
- [ ] **Privacy:** single purpose, each permission's justification, "No, I am not using remote code",
      the data-use boxes and the three certifications, privacy policy URL `https://tirekick.app/privacy`.
- [ ] **Distribution:** Public, all regions. (Or **Unlisted** first if you'd like a soft launch: only
      people with the link can install it, and you can switch to Public later.)
- [ ] **Test instructions** (shown to the reviewer): paste "Notes for the reviewer" from `store/LISTING.md`.
- [ ] Submit for review. First reviews usually take a few days and can run longer with broad host
      permissions (see M1 in the security review).

### 6. After approval

- [ ] Put the store link on the website's "Add to Chrome" button (Claude).
- [ ] Install from the store on a clean Chrome profile and check the first-run settings page opens.
- [ ] Install the store build in **Vivaldi** too and run the four checks in the security review's
      Vivaldi section (icon and badge, shortcut, the two right-click entries).
- [ ] Keep the unpacked copy you use day to day separate from the store install: they have different
      extension IDs, so saved data doesn't move between them. Use **Save a backup** and **Restore**
      in settings to carry it across.

### If the review comes back with questions

- **"Broad host permissions":** point to the optional-permission justification; offer to remove the
  custom-address option for 1.0 if needed (security review M1).
- **"Runs on all of facebook.com":** Facebook is a single-page app; the script only reads `/marketplace`
  pages (security review M2).
- **"Purpose unclear" or "keyword stuffing":** the AI service names in the description can be trimmed
  to "Claude, OpenAI, Gemini and more".

---

<!-- merged from robustness-plan.md -->

## Tirekick: making the no-AI features sturdier

Audit dated 2026-10-14, of `main` (0.35.0) plus the unpushed `claude/ux-spec` branch (0.36.x, since ported to `main` as 0.36.0).
AI scoring stays the core feature; this covers everything that works without a model or an outside service.
No code changes until the ux-spec port is merged. Then each section below is its own PR, with tests, in this order.

**Status (2026-10-14):** all 8 shipped to `main` as PRs #14 to #21. Still open from item 1: swap the hand-made fixtures for real saved eBay and Marketplace pages (needs Myer to save a few from Vivaldi).

### What's in scope

| Feature | Where it lives | Tested today |
|---|---|---|
| Reading listings off eBay and Marketplace (cards, listing pages, prices, shipping, auctions, lots, seller ratings) | `content/adapters.js` | Unit tests for the parsers; e2e against hand-made fixture pages |
| Scam signs (reposted codes, off-site contact, disguised phone numbers) | `adapters.js`, `rules.js`, `panel.js` | Good unit coverage of the patterns |
| Filter bar and filter words, deals, "fix-up project" and "motivated seller" words | `rules.js`, `panel.js` | Unit tests for word matching |
| "Seen before", "New to you", price drops, duplicates | inside `panel.js` | Only through e2e, no unit tests |
| Sold-price lookups (median, pacing, eBay's browser check) | `panel.js` on main, `lib/sold.js` on ux-spec | e2e only; the summary math has no unit tests |
| Saved listings and searches, alerts and the toolbar number | `panel.js`, `lib/shared.js`, `home.js` | Unit tests for alerts; saving through e2e |
| Settings, backup and restore, migrations | `options.js`, `shared.js`, `background.js` | Settings limits unit-tested; restore through e2e |

### How each can break

**Site layout changes (the biggest risk).** Both sites change markup without notice. The adapters layer selectors
and fall back, but when they all miss, the panel just shows fewer listings or none. Nobody is told unless they press
"Check this page". The Marketplace fixture is synthetic, and the eBay fixtures are hand-made reductions, so the tests
can stay green while real pages have already moved on.

**Odd listings.** Prices like "C $20" or "AU $35" are read as US dollars. A price range ("$45 to $60") takes the low end.
Titles with accents or non-English text lose letters in word matching ("Pokémon" becomes "pok mon", so a filter word of
"pokémon" can miss). "Best offer accepted" is read from card text that's cut at 300 characters, so it can be missed.

**Missing data.** A card with no price, no photo or no shipping line mostly degrades cleanly. What isn't handled: a
listing page that loads in pieces (the read happens before the price arrives), and sold searches with too few sales,
which are cached as "none" for six hours.

**Storage filling up.** The extension doesn't have the `unlimitedStorage` permission, so it gets 10 MB. Kept scores
(3,000 listings with photo notes), the score cache, listing memory (6,000) and the rest add up over months. Every write
swallows its error, so once storage is full, saving a listing quietly does nothing.

**Two tabs at once.** Saved listings, searches, hidden listings, filters, scam codes and the sold-price pacing are each
read, changed and written back. Two tabs doing that at the same moment can lose one change. For sold prices it also
means two tabs can both pass the "8 an hour, 5 seconds apart" check and push eBay toward its browser check.

**Restoring a backup.** Saved listings and searches are cleaned, but listing memory, hidden listings, filters, scam codes
and mode settings go in as they are. A hand-edited or damaged file (a filter whose words aren't text, a record that
isn't an object) can make the panel throw on every page until storage is cleared. There's no file size limit.

**Offline or eBay unreachable.** Lookups fail with the browser's own "Failed to fetch". The panel keeps working, but
the message doesn't say what happened.

### The plan, in priority order

#### 1. Say when a site has changed (layout watch)
- On every results page, compare cards found with listings read, and how many have a title and price. When most
  are missing, show one plain notice in the panel ("eBay's page changed and Tirekick can only read 3 of 48 listings")
  with "Check this page" and a link to report it.
- Keep a small per-site health note (last good read, last bad read) and show it on Home.
- Replace the fixtures with real saved pages (eBay results, sold, category, listing; Marketplace feed, search,
  listing) and pin the expected values per field. **This needs you:** save a few real pages from Vivaldi when we get
  here. I'll give you the list.

#### 2. Storage that can't silently fill up
- Add `unlimitedStorage` (Chrome shows no install warning for it), and keep the caps as housekeeping.
- One write helper for every collection: it catches a failed write, tells you once in the panel, and logs which
  collection it was. Show storage use in "Check this page" and Settings.
- Test: fill storage in a test profile and check that saving still works or says why not.

#### 3. One writer for shared data
- Move the read-change-write of saved listings, searches, hidden listings, filters, scam codes and sold-price pacing
  into the background worker, one queue, so tabs can't overwrite each other or both pass the lookup limit.
- Test: two tabs saving and hiding at the same time lose nothing; two tabs looking up prices stay under the limit.

#### 4. Restore that can't break the panel
- Check the shape of every collection in a backup, not just saved items: types, lengths, dates, and a size limit on
  the file. Leave out what doesn't fit and say how much.
- Saved-listing photos only from the sites' own image hosts.
- Unit tests with damaged and hostile backups, and a round trip (back up, wipe, restore, compare).

#### 5. Sold prices you can trust more
- Builds on the ux-spec work (best offers, lots, for-parts, outliers and a confidence are already handled there).
- Leave out non-US prices and price ranges. Read "best offer accepted" from the whole card.
- Cache "too few sales" for one hour instead of six, and say "you're offline" or "eBay didn't answer" plainly.
- Unit-test the summary on saved sold pages: medians, what's left out, confidence.

#### 6. Pull the plain logic out of the panel so it can be tested
- "Seen before", price drops and history, duplicates, the scam-code memory and the deal check live inside the
  4,000-line panel script, where only browser tests reach them. Move them to `rules.js` and `shared.js` as plain
  functions with unit tests. No behavior change.

#### 7. Parsing edge cases and words
- A table of tricky prices, titles, auctions and seller ratings, plus a test that the adapters never throw on a
  broken or empty page.
- Word matching that handles accents and other alphabets; unbalanced quotes and a lone "-" in filters.

#### 8. Upgrades from older versions
- A test that starts from each older storage shape (Second Look keys, the two word lists, old themes, old caches) and
  checks the current version reads it without losing anything.

### What I'd do first

Items 1 to 4 are where people actually lose data or get wrong answers silently. 5 to 8 are accuracy and test depth.
Each is a separate PR so you can stop after any of them.

---

<!-- merged from briefs/README.md -->

## Tirekick feature briefs

The briefs (1 to 7 written 2026-10-14, 8 to 10 on 2026-10-15) are written so another agent can pick one up cold. Each is a plan only: nothing here has been built or tested.

| # | Brief | Size | Depends on |
|---|---|---|---|
| 1 | [Alerts on saved searches](#brief-1-alerts-on-saved-searches) | Medium | 0.36.0 port (auto-scan, per-search wants). Myer chose options 1 and 2 (2026-10-14) |
| 2 | [Price history on saved items](#brief-2-price-history-on-saved-items) | Small to medium | Nothing new; feeds brief 3 |
| 3 | [Offer helper](#brief-3-offer-helper) | Small to medium | Better with brief 2 |
| 4 | [Stronger scam checks](#brief-4-stronger-scam-checks) | Medium | Nothing new |
| 5 | [More stores](#brief-5-more-stores) | Large (one PR per store) | 0.36.0 port (site table) |
| 6 | [Sync and export](#brief-6-sync-and-export) | Small (export) to medium (sync) | Nothing new |
| 7 | [Built-in browser AI](#brief-7-built-in-browser-ai) | Medium | Nothing new. First after the 1.0.0 launch (Myer, 2026-10-14) |
| 8 | [Price data beyond eBay sold listings](#brief-8-price-data-beyond-ebay-sold-listings) | Small to medium | A check on 30 real listings first |
| 9 | [More browsers](#brief-9-more-browsers) | Small (Edge) to large (Safari) | Nothing new |
| 10 | [More AI options](#brief-10-more-ai-options) | Small | 0.40.0 service menu |

Suggested order: 2 → 3 → 4 → 6 (export) → 5 (Craigslist first) → 1.

### Read this before any brief

**Where the code is.** `github.com/dabloonery/Second-Look`, `main` is Tirekick 0.36.0 (as of 2026-10-14): the UX-spec work (auto-scan, per-search "What I want", the hub page, the site table, sold-price pacing) is ported and merged (PR #13), and so are the robustness PRs #14 to #21. Start from the latest `main`; the site table is `TKSites` in `lib/sites.js`.

**What already exists (don't rebuild it).** Several of these ideas are partly built. Each brief has a "What's there today" section with file and line references to main at `381f758`. Line numbers will drift; search for the names.

**The ground rules** (README, "Ground rules", from the ux-spec branch). They exist because eBay's and Meta's terms prohibit unattended collection, and breaking them gets Myer's accounts flagged:
- Only pages you're looking at. Never open, crawl or refresh a store's page by itself. Auto-scan reads only a search tab that's on screen.
- Requests to the stores are few, spaced and started by you: eBay sold lookups are at most 8 an hour, 5 seconds apart, cached 6 hours (`lib/sold.js` after the port).
- Never get past a bot check. Stop and say so.
- Nothing leaves the browser except to the AI service the user chose and eBay's own search. No server, no analytics, no account.
- Estimates are labeled as estimates.

**Permissions.** A new *required* permission with a warning makes Chrome (and Vivaldi) disable the extension on update until the user accepts. New capabilities go under `optional_permissions` / `optional_host_permissions` and are requested when the user turns the feature on.

**Myer's browser is Vivaldi** (Chromium). Anything that touches browser APIs beyond what's already used (notifications, `storage.sync`, side panel, alarms) must be checked in Vivaldi, not just Chrome. The automated tests run headless Chrome; the brief's "done" list says what Myer should check by hand.

**Copy.** US English only. Follow the Voice and copy part of [`docs/REFERENCE.md`](REFERENCE.md): verdict first then why, "Likely scam" never "Scam", estimates say so, sentence case, no exclamation marks except in the seller message. Copy about what Tirekick *is* stays store-neutral ("the stores where you shop"); name a store only where the feature really is store-specific. More stores are coming.

**Look.** Tread Dot, flat (no gloss, no 3D, no rims), round dots, never tilted. Tokens live in `lib/theme.js` (`TKTheme`, local `THEME` in `content/panel.js`). Reuse existing components (status line, Home alerts, chips, hover card, the sparkline in `lib/shared.js` `S.spark`) before adding new ones.

**Tests.** `deno task test:unit` (unit), `tests/all.sh` (everything, real extension in headless Chrome against a mock AI). Add a unit test for any new pure rule and an e2e check for any new surface. A known flaky one: "Filter button opens the fields" fails on main too (headless timing).

**Shipping.** Draft PR per brief against `main`, bump the minor version, update `docs/ux-spec.md` (states table and components), `README.md`, and `store/PRIVACY.md` / `store/LISTING.md` whenever what's read, stored or requested changes. No Chrome Web Store submission until Myer says.

---

<!-- merged from briefs/1-saved-search-alerts.md -->

### Brief 1: Alerts on saved searches

Read [the briefs intro](#read-this-before-any-brief) first (ground rules, Vivaldi, copy, tests).

#### Goal

Tell the user, without them watching the panel, when one of their saved searches turns up a listing scored **Great** (or at their price), so Tirekick is useful between shopping sessions.

#### User story

As a buyer with a saved search for "pentax k1000", I want a notification when a new Great listing appears, so I can get to it before someone else does, without re-running the search myself.

#### Myer's decision (2026-10-14): build options 1 and 2

The idea as first pitched ("check saved searches in the background") **breaks the ground rules**: Tirekick never opens, crawls or refreshes a store's page by itself, and auto-scan only reads a search tab that's on screen. eBay's and Meta's terms are why. So the agent must not build background polling. Three ways to do this instead, recommended first:

1. **Alert from what you're already looking at (recommended, fully within the rules).** When auto-scan (0.36.0) scores a listing Great on a page that matches a saved search, record it on the saved search and raise an alert: the toolbar badge, Home's "Worth another look", and, if the user turns it on, a browser notification. Useful when a saved search sits open in a tab you glance at, or when you browse a matching search and miss the tag.
2. **"Check my saved searches" button (within the rules, user-started).** One press on Home opens each saved search in a new tab in the foreground window, one after another and spaced like sold lookups, and auto-scan scores each while it's on screen. The user started it and sees every page. Notifications then come from option 1.
3. **Scheduled background checks (outside the rules).** `chrome.alarms` opening hidden tabs or fetching search pages. Not recommended; only with Myer's explicit decision to change the ground rules and an understanding of the account risk.

**Decided by Myer on 2026-10-14:** build 1 and 2 (the "Check my saved searches" button). Don't build 3; the ground rules stay as they are.

#### What's there today

- Saved searches: `savedSearches` in `chrome.storage.local`, `"site|query" -> { site, q, url, a0, v, n, fresh, deals, deal }` (`content/panel.js`, `let savedSearches`, and `noteSearchVisit`, which records how many listings were at your price, `deals`, on each visit).
- Alerts: `TKShared.alerts()` in `lib/shared.js` turns saved listings that got cheaper and saved searches with `deals > 0` into alerts, with `alertsAck` marking what's been seen. `alertSummary()` writes the toolbar tooltip.
- Badge: `updateBadge()` in `background.js` (navy badge, count of new alerts), refreshed on storage changes. `openPanel()` opens on Home when something's new.
- Home tab: `content/home.js` (`TKHome.mount`), "Worth another look" first. The hub page (`hub/hub.js`, from the port) shows the same Home off-store.
- Auto-scan (from the port): `autoTick()` / `scan({ auto: true })` in `content/panel.js`, setting `autoScan` (off by default), stops at the monthly budget, never in a background tab (`document.hidden`).
- Per-search wants (from the port): each saved search keeps its own "What I want", so a Great on one search is judged by that search's wants.
- No `notifications` or `alarms` permission in `manifest.json` today.

#### How it would fit

- **Record Great finds on the saved search.** In `noteSearchVisit` (or right after a scan settles), count listings with verdict `great` that aren't hidden, filtered or likely scams, and store `greats` plus the keys of the newest few (`gk: [...]`, capped) on the saved search record. Only listings first seen since the last visit count as new.
- **New alert kind.** Extend `TKShared.alerts()` with `kind: "great"` (id `g:<searchKey>`, value = newest great key, so a new one re-raises it). Update `alertSummary()` ("1 saved search found a great deal"). Home and the hub render it with the existing alert row; clicking opens the saved search (or the listing, if one).
- **Notifications (opt in).** A settings switch, "Notify me about great finds on saved searches", off by default. Turning it on requests `notifications` through `chrome.permissions.request` (add `"notifications"` under `optional_permissions`). `background.js` listens for the storage change, and posts one `chrome.notifications.create` per new alert (icon `icons/icon128.png`, title "Tirekick", message in voice: "Great deal on your “pentax k1000” search: $85, sold ones go for $140"). Click opens the listing in a tab. Never more than one per saved search per hour.
- **Option 2, "Check my saved searches" (approved):** a "Check my saved searches" button on Home and the hub, opening tabs with `chrome.tabs.create({ active: true })` one at a time, each waiting until auto-scan has finished on it (a message back from the panel) and a gap of at least 5 seconds. Needs auto-scan on and a budget set; say so before starting, with the estimated cost.

#### Files likely touched

`lib/shared.js` (alerts, summary), `content/panel.js` (record greats on the saved search), `content/home.js` and `hub/hub.js` (render the new kind), `background.js` (notifications, click handler, badge), `options/options.html` + `options/options.js` (the switch and permission request; add the flag to `FLAGS`/`cleanSetting` in `lib/shared.js` so backups carry it), `manifest.json` (`optional_permissions`), `store/PRIVACY.md`, `store/LISTING.md`, `docs/ux-spec.md`, tests (`tests/unit/shared.test.mjs`, an e2e check in `tests/e2e/features.ts`).

#### Open questions

- Is "Great" the only trigger, or also "at your price" (that already raises a Home alert, without a notification)?
- Does a notification ever include the price and title, or just "a great deal"? (Default: title and price; they stay on this computer.)
- Vivaldi: check that `chrome.notifications` shows in Vivaldi's own notification style and that clicking it focuses the tab. Vivaldi has its own notification settings that may block it by default.

#### How to know it's done

- With auto-scan on and a saved search open, a new Great listing raises the badge, a Home alert, and (switch on) one notification; clicking it opens the listing. A second scan of the same page doesn't raise it again.
- With the switch off, no `notifications` permission is requested or held; turning it off releases nothing extra and stops notifications.
- Nothing opens, fetches or refreshes a store page without the user's action (for option 2, only after the button press, with visible tabs). Checked by reading the diff and by an e2e test that counts page requests.
- Unit tests for the new alert kind; e2e test for the record-and-alert path against the mock AI; `tests/all.sh` green.
- Myer has checked a notification in Vivaldi.
- Privacy page and listing mention the notification permission and that alerts come only from pages you open.
- "Check my saved searches" opens each saved search in a visible tab, one at a time and at least 5 seconds apart, lets auto-scan finish on each, and says the estimated cost before starting; it refuses to start with auto-scan off or no budget set.

---

<!-- merged from briefs/2-price-history.md -->

### Brief 2: Price history on saved items

Read [the briefs intro](#read-this-before-any-brief) first (ground rules, Vivaldi, copy, tests).

#### Goal

Show how a saved listing's price has moved and how long it has been for sale, and say plainly when the seller is likely to take a lower offer.

#### User story

As a buyer watching a saved camera, I want to see that it's dropped twice in three weeks and has been listed for 40 days, so I know to offer low instead of paying the asking price.

#### What's there today (most of the data already exists)

- **Price memory:** `memory` in `content/panel.js` (`listingMemory` in storage), per listing key: `{ p: last price, pa: since when, f: first seen, a: last seen, o: first opened, h: [[earlier price, since], ...] }`. Kept 90 days, capped at 6000 listings (`MEMORY_DAYS`, `MEMORY_MAX`). Item price without shipping; auctions aren't tracked for drops.
- **Saved listings:** `saved` record `{ t, u, img, p0: price when saved, a0, p: last price seen, a: last seen }`. `TKShared.dropped()` flags a drop of 3% or $1; Home and the badge alert on it.
- **Sparkline:** `priceHistory()` in `content/panel.js` draws `TKShared.spark()` (from `lib/shared.js`) beside each saved listing, from `memory[k].h`.
- **Motivated seller words:** `TKRules.MOTIVATED` in `content/rules.js` ("moving sale", "must go", ...).
- **Best offer:** eBay cards and item pages report `bestOffer` (adapters).
- **The limit:** prices only update when the user has that listing (or a search showing it) on screen. That's the ground rules, and it stays. History is "prices you've seen", and the copy should say so.

#### What's missing

1. **Time on market.** `f` is when *you* first saw it, not when it was listed. The listing date is on the page: eBay item pages show "Listed on…" in some layouts and the item specifics; Marketplace shows "Listed 3 weeks ago in …". Read it in the item readers (`content/adapters.js`, the per-site `ITEM_READERS` after the port) into a `listedAt` (approximate for "3 weeks ago") and store it on `memory` and `saved`.
2. **A "likely to take less" signal.** A small pure function in `content/rules.js`, e.g. `TKRules.softSeller({ drops, daysListed, bestOffer, motivated, relist })`, returning a level (`none | some | likely`) and the reasons. Rough start: two or more drops, or listed 30+ days, or best offer on with a drop, or motivated words. Weights belong in one table so they can be tuned.
3. **Saved item detail.** Expand a saved row (or its hover) to show: the sparkline at a readable size, "Down $30 (−18%) since you saved it", "Listed about 6 weeks ago", and the signal line ("Seller may take less: 2 price drops, listed 40 days"). Reuse the hover card and chip styles; no new colors (use the `fair`/`good` verdict tokens from `lib/theme.js` only for the signal dot if needed).
4. **Relists.** A listing ended and posted again (new id, same seller and title) resets its age. eBay has "similar sponsored"/relist links; Marketplace's code-stem matching (`codeStems`) already links reposts. Optional: link a relist to the old key's history when the title and seller match. Treat as a stretch.
5. **Keep history for saved listings past the 90-day cap.** Pruning in `saveMemoryNow()` should never drop a key that is in `saved`.

#### Files likely touched

`content/adapters.js` (listed date on item pages and Marketplace cards where shown), `content/rules.js` (`softSeller`), `content/panel.js` (store `listedAt`, saved row detail, pruning exception), `content/home.js` (drop alerts can carry the signal), `lib/shared.js` (maybe a `daysListed` helper), fixtures under `tests/fixtures/` (item pages with listing dates), `tests/unit/rules.test.mjs`, `tests/e2e/features.ts`, `docs/ux-spec.md`.

#### Open questions

- Should the signal show on every listing (from memory) or only saved ones? Default: saved ones and the listing page, since those are where an offer happens.
- How confident is "about 6 weeks ago" from Marketplace's relative text? Show "about" always.
- Does Myer want the "likely to take less" signal to feed the offer helper (brief 3)? Default: yes, as an input.

#### How to know it's done

- A saved listing seen at three prices shows the line, the total drop, the listed age and the signal with its reasons; copy says these are prices you've seen.
- Listing dates are read from the eBay and Marketplace fixtures (unit or adapter tests), and absent dates leave the line out rather than guessing.
- `softSeller` has unit tests for each reason and for "none".
- Saved listings' memory survives the 90-day prune (test).
- No new requests to any store: everything comes from pages the user opened.
- `tests/all.sh` green; screenshots in dark and light checked at desktop and 400px.

---

<!-- merged from briefs/3-offer-helper.md -->

### Brief 3: Offer helper

Read [the briefs intro](#read-this-before-any-brief) first (ground rules, Vivaldi, copy, tests).

#### Goal

Turn the existing "Suggested offer" on a listing into a helper the user trusts: an opening offer anchored on sold prices with the reasoning shown, a walk-away price, and a short message ready to send that fits the store.

#### User story

As a buyer on a $120 Marketplace listing where sold ones go for $95, I want Tirekick to suggest opening at $80, tell me why, and give me a polite message I can paste, so I can negotiate without doing the math or feeling awkward.

#### What's there today

- The listing analysis prompt (`ITEM_BASE` in `background.js`) asks the model for `offerLow` / `offerHigh` ("a sensible whole-dollar offer range if negotiation is possible").
- The listing view (`content/panel.js`, the `.offer` block near "Suggested offer:") shows the range, "Accepts offers." for eBay best offer, and one message with **Copy message**: "Hi! Is this still available? Would you take $X?" plus "I can pick up whenever suits you." on Marketplace. Auctions get a suggested max bid instead.
- Sold-price reference: `market` (`{ median, p25, p75, n, parts }`) from eBay sold listings, passed into the prompt and shown as the sold line.
- Reseller mode shows a resale margin after fees and parts.

#### What's missing

1. **A deterministic anchor.** The range today is whatever the model says. Compute an anchor in a pure function (`TKRules.offerPlan` in `content/rules.js`): from the sold reference (`p25`, `median`), the asking price, shipping, condition (working vs parts), and, once brief 2 lands, the "likely to take less" signal. Output: `open` (first offer), `walkAway` (most worth paying), `reasons` (short phrases), `confidence` (from `market.n`). Round to friendly numbers ($80, not $79). Let the model's range adjust within bounds, never replace the math when there's a solid reference. With no sold reference (fewer than N sales), fall back to the model's range and say it's a rough guess.
2. **Show the why.** One line under the offer: "Open at $80, walk away above $100: sold ones go for $85 to $105 (24 sales)." Estimates say so.
3. **Messages that fit the store and the moment.** Two or three short variants the user picks from (friendly, direct, bundle or pickup), templated in code, not generated, so they're free and predictable. Store-specific bits come from the site table (`local` sites say "I can pick up"; eBay with best offer says to use the Make offer button, with the amount, rather than a message). Keep the voice doc's one exception: "Hi!" may have an exclamation mark.
4. **Editable before copying.** The message is a small text field, prefilled; Copy copies what's there.
5. **Never sends anything.** Tirekick doesn't type into the store's message box or press Make offer. Copy only. That keeps it inside the ground rules and the stores' terms.
6. **Counteroffer (stretch).** A "They said $100" field that answers with accept, counter at X, or walk away, from the same plan.

#### Files likely touched

`content/rules.js` (`offerPlan`, message templates), `content/panel.js` (the `.offer` block, message picker, edit field), `background.js` (pass the plan into the prompt so the summary agrees with it; keep `offerLow`/`offerHigh` in the schema), `lib/sites.js` after the port (store wording per site, if not already in `local`), `tests/unit/rules.test.mjs`, `tests/e2e/features.ts` (listing page shows the plan and copies the edited message), `docs/ux-spec.md`, and copy reviewed against the Voice and copy part of `REFERENCE.md`.

#### Open questions

- How aggressive should the opening offer be by default? Suggested default: midway between `p25` and the median, never above asking, never under 60% of asking (it reads as a lowball and gets ignored).
- Show the walk-away price to the user, or keep it implicit? Default: show it.
- Reseller mode: anchor on the price that leaves the user's target margin instead of the sold median? Default: yes, with the margin shown.
- Should the helper appear on cards (hover card), or only the listing view? Default: listing view only.

#### How to know it's done

- On the eBay and Marketplace listing fixtures with a mocked sold reference, the panel shows open and walk-away prices and the reason line, and the numbers match `offerPlan` (unit tests with several sold distributions, no reference, parts-only, auction).
- Messages change with the store (pickup line on local stores, Make offer note on eBay best offer) and copy exactly what's in the field.
- Nothing is typed into or submitted on the store's page (checked in the diff).
- All copy is US English, sentence case, verdict-first, and labeled as an estimate.
- `tests/all.sh` green; screenshots of the listing view in dark and light at desktop and 400px.

---

<!-- merged from briefs/4-scam-checks.md -->

### Brief 4: Stronger scam checks

Read [the briefs intro](#read-this-before-any-brief) first (ground rules, Vivaldi, copy, tests).

#### Goal

Catch more likely scams without asking a model: photos reused across listings, brand-new seller accounts, and prices too far under what sold ones go for. Each mark says why, in the "Likely scam" voice, never "Scam".

#### User story

As a buyer, I want Tirekick to warn me that this $60 iPhone uses the same photo as three other listings from different sellers, so I don't message a scammer.

#### What's there today (free marks, no model)

- **Reposts with title codes** (Marketplace): `codeStems` and `f.campaign` in `content/panel.js`; a title ending in a random code (`f.titleCode`) unless a scan says it's a model number. `TKRules.likelyScam()` in `content/rules.js`.
- **Off-site contact**: `f.offSite` (`tests/offsite.test.mjs` covers the patterns: spaced-out websites, odd phone numbers, WhatsApp, gift cards).
- **Seller ratings**: `TKRules.sellerWarning()` warns on few ratings ("New seller" at 0) or low positive %, from eBay's feedback (`sellerCount`, `sellerPct`), thresholds in settings (`minSellerRatings`, `minSellerPct`).
- **Photo checks** (paid, on request): `checkPhoto` in `background.js` asks the model if a photo matches the title; a mismatch makes the verdict suspicious (`TKRules.adjustedVerdict`). Photos are fetched only from store image hosts (`TKShared.isListingImage`).
- **The model prompts** (`SCAM_RULE`, `ITEM_BASE` in `background.js`) already say a too-good price makes a code-title scam more certain.

#### What's missing

1. **Reused photos.** Hash the thumbnail of each card the user has on screen with a small perceptual hash (a 64-bit dHash of a 9×8 grayscale thumbnail) and keep `photoHash -> [listing keys, sellers, first seen]` in a new storage map, capped and pruned like `listingMemory`. Same hash (Hamming distance ≤ 4 or so) on listings from **different sellers**, or under different titles, marks both "Likely scam: same photo as 2 other listings". Same seller relisting is not a scam sign. Images: thumbnails are on the store's CDN; drawing them on a canvas in the page taints it, so hash in the background worker (`fetch` + `OffscreenCanvas` / `createImageBitmap`, already allowed hosts `i.ebayimg.com`, `*.fbcdn.net`) or an offscreen document. Throttle: only cards that are visible, a few per second, cached by image URL. Fetching a thumbnail the page already shows is a CDN image request, not a store page, but keep the count low and say in the privacy page that thumbnails are compared on this computer.
2. **Brand-new seller accounts on Marketplace.** Marketplace listing pages show "Joined Facebook in 2026" and sometimes seller ratings. Read them in the Marketplace item reader (`content/adapters.js`) into `sellerJoined` and `sellerCount`, so `sellerWarning` applies there too, plus a new reason: joined within the last N months. Cards don't show this; it's a listing-page mark and a hover-card line once the listing has been opened.
3. **Price far under sold.** A deterministic rule in `content/rules.js`: total under ~40% of the working sold median (with at least ~8 sales, not a for-parts listing, not an auction, not a lot) gives the chip "Likely scam: far under sold price", or a softer "Too cheap? Check it" between 40% and 55%. Thresholds in one table. Shown only when the sold reference exists.
4. **One place for the reasons.** The hover card and the listing view already list scam reasons (`f.campaign`, title code, off-site). Add the new ones in the same shape so the order and wording stay consistent, and so a scan can confirm or clear them (as it does for title codes).
5. **Per-store rules.** Off-site contact and phone numbers are normal on Craigslist (see brief 5 and `docs/plan-more-sites.md`). Key the new rules by `site` so a later store can opt out.

#### Files likely touched

`content/rules.js` (price rule, new-account rule, hash distance), `content/panel.js` (hash map in memory, chips, hover card and listing reasons), `content/adapters.js` (Marketplace seller join date and ratings), `background.js` (thumbnail hashing message, if done in the worker), `lib/shared.js` (`isListingImage` already covers the hosts), maybe `offscreen.html` + `"offscreen"` permission if the worker can't decode images (check first; `createImageBitmap` works in MV3 service workers in current Chrome), `tests/unit/rules.test.mjs`, a new `tests/unit/photohash.test.mjs`, fixtures with duplicate thumbnails, `tests/e2e/marketplace.ts`, `store/PRIVACY.md`, `docs/ux-spec.md`.

#### Open questions

- How strict should "far under sold" be? Defaults above; Myer may want it softer for fix-up hunting (Reseller mode should probably skip it for "for parts" listings, which it does by excluding them).
- Is a new permission acceptable (`offscreen`)? Prefer no: try the worker first.
- How many photo hashes to keep? Default: 20,000, pruned after 90 days like listing memory.
- Should a reused-photo mark make the verdict suspicious before a scan (like reposts), or only add a chip? Default: chip plus the scan prompt is told, so the model decides the verdict.

#### How to know it's done

- Fixtures with the same thumbnail under two sellers mark both cards; the same seller twice doesn't. Unit tests for dHash and distance on sample images.
- A Marketplace listing fixture with "Joined Facebook in 2026" shows the new-account warning; one from 2015 doesn't.
- With a mocked sold median of $200, a $60 working listing gets "Likely scam: far under sold price", a $100 one gets the softer chip, a $60 for-parts one gets neither.
- Hashing doesn't slow long feeds: `tests/e2e/perf.ts` stays within its current budget.
- No store page is fetched; only thumbnails already on screen, from the allowed image hosts.
- Copy follows the voice doc ("Likely scam: …", reasons after the colon). Privacy page updated.
- `tests/all.sh` green.

---

<!-- merged from briefs/5-more-stores.md -->

### Brief 5: More stores

Read [the briefs intro](#read-this-before-any-brief) first (ground rules, Vivaldi, copy, tests). This one depends on the 0.36.0 port (the site table).

#### Goal

Make Tirekick work on more secondhand stores, one at a time, through the site table: **OfferUp and Craigslist first, then Mercari, then Poshmark.** One draft PR per store.

#### User story

As a buyer who also shops OfferUp and Craigslist, I want the same scores, sold-price checks and scam warnings there, so I don't have to compare by hand across tabs.

#### What's there (after the 0.36.0 port)

- **The site table:** `lib/sites.js` (`SITES`, documented `Site` typedef: id, key prefix, hosts, matches, page types, item and search URLs, image hosts, `local`, card behavior, `titleCodes`, `soldReference`). Background, page scripts, the hub and settings read it instead of naming a store.
- **Per-site readers:** the maps in `content/adapters.js` (`READERS`, `ITEM_READERS`, `LISTING_LINKS`, `CARD_FINDERS`, `SEARCH_BUILDERS`, `BROWSE_CONTEXT`).
- **The how-to:** `docs/adding-a-site.md` (step by step, including permissions and tests) and **the plan:** `docs/plan-more-sites.md` (what OfferUp and Craigslist are like, how scams differ, the order, risks). Read both in full before starting; this brief doesn't repeat them.
- **The guard test:** `tests/unit/sites.test.mjs` fails until a new site has every field and every per-site map.
- **Sold prices:** eBay's sold listings stay the price reference for every store (`soldReference: false` for the others), paced by `lib/sold.js`.

Note: some places still hard-code the two stores on main (`TKShared.safeUrl`, `itemUrl`, `searchUrl` and `isListingImage` in `lib/shared.js`, `cleanSaved`'s key pattern `^(ebay|fb):` in `options/options.js`). Check whether the port moved them onto the table; if not, do that first, in its own small commit.

#### Order and per-store notes

1. **Craigslist.** Stable server-rendered markup (gallery, list, and the old "result-row" layouts), per-city hosts (`*.craigslist.org`). Local only, no seller ratings, placeholder prices ($0, $1) mean no price. Phone numbers and "text me" are normal, so the off-site rule must not fire; "I'm away, I'll ship it", pay-first and fake escrow are the Craigslist scam signs. Needs the user's area for the hub's lookup (remember the last one visited).
2. **OfferUp.** A React app like Marketplace: recycled cards, late-loading prices; read by `/item/detail/` links and visible text, not class names. Seller stars, rating count, "TruYou" verified and join date feed `sellerWarning`. Some "Ships" listings. Needs a long-feed run of `tests/e2e/perf.ts`.
3. **Mercari.** Ships nationally, so compare on total with shipping. Mercari shows its own sold listings: consider it as a second sold reference (`soldReference`), or keep eBay only (open question). Cards have seller ratings.
4. **Poshmark.** Mostly clothing and shoes, a different shopper. Prices are often negotiated via offers; sold listings are visible. Brand-and-size matters more than model numbers, so the prompt's "what I want" and the sold comparison need checking for apparel. Lowest priority; Myer to confirm it's wanted.

#### How each store fits (same for all)

- **Opt in per store in settings** ("Also work on: OfferUp, Craigslist …"), requesting its hosts through `optional_host_permissions` when ticked, and registering page scripts only then. New *required* hosts would make Chrome and Vivaldi disable Tirekick on update until the user accepts.
- **Scam rules keyed by `site`** (see brief 4 for the shared rules).
- **Everywhere else:** Saved, Home, alerts, the hub's lookup, and "Try on Marketplace" becoming "Also on: eBay · Marketplace · OfferUp · …" read the table.
- **Copy:** store-neutral product copy, the supported-stores line updated in one place (voice doc, "Stores"). The privacy page lists exactly which sites are read and contacted, per store.
- **Ground rules:** read only pages the user has open; never fetch these stores in the background. Their terms limit automated collection too.

#### Files likely touched (per store)

`lib/sites.js`, `content/adapters.js`, `content/rules.js` (site-keyed scam rules), `background.js` (`SCAM_RULE` per site, image hosts), `lib/shared.js` (any remaining hard-coded hosts), `options/options.html` + `options/options.js` (opt-in switches, permission request, backup key patterns), `manifest.json` (`optional_host_permissions`), `hub/hub.js`, fixtures under `tests/fixtures/` (results, listing, layouts; trimmed real markup, no real names or photos), `tests/e2e/server.ts` and `tests/e2e/run.sh` (host mapping), an adapter test and a page test like `tests/e2e/marketplace.ts`, `README.md`, `store/PRIVACY.md`, `store/LISTING.md`, `docs/ux-spec.md`.

#### Open questions

- Which first, OfferUp or Craigslist? The plan suggests Craigslist (simpler markup). Default: Craigslist.
- Which Craigslist areas does Myer use? (For fixtures and the hub's default.)
- Mercari as a second sold reference, or eBay only? Default: eBay only at first.
- Is Poshmark wanted at all, given it's mostly apparel?
- Distance filter ("within N miles"), since OfferUp and Craigslist both show distance: worth adding?
- Vivaldi: check that optional host permission prompts appear and work in Vivaldi.

#### How to know it's done (per store)

- `tests/unit/sites.test.mjs` passes with the new entry; adapter tests read every fixture layout (title, price, total, URL, image, seller where shown).
- With the store switched off, Tirekick doesn't run there and holds no permission for it; switching on asks once and starts working on the next page load.
- On a fixture results page, tags appear on cards, a scan ranks them against eBay sold prices, saved listings and searches show the store's name, and the hub's lookup includes it.
- Store-specific scam rules behave as the plan says (Craigslist doesn't flag phone numbers; OfferUp flags pay-by-gift-card).
- Long-feed performance within budget for app-style stores.
- README, privacy page and store listing name the store and its permission. `tests/all.sh` green.
- Myer has tried it on the live store in Vivaldi (markup changes without notice; fixtures can't prove the live site).

---

<!-- merged from briefs/6-sync-and-export.md -->

### Brief 6: Sync and export

Read [the briefs intro](#read-this-before-any-brief) first (ground rules, Vivaldi, copy, tests).

#### Goal

Two things, shippable separately:
1. **Export** saved listings (and optionally saved searches) to a spreadsheet file, for resellers tracking buys and margins.
2. **Sync** saved listings, saved searches and settings across the user's own browsers, with no Tirekick server.

#### User stories

- As a reseller, I want to export my saved listings with price, sold median, score and margin to a CSV, so I can track buys in my own spreadsheet.
- As someone who shops on a laptop and a desktop, I want my saved listings and settings on both, without making an account.

#### What's there today

- **Backup and restore:** Settings › Backup and your data (`options/options.js`, "Backup" section). Writes `tirekick-backup-YYYY-MM-DD.json` with settings and `BACKUP_SETS` (`saved`, `savedSearches`, `quickFilters`, `notInterested`, `listingMemory`, `codeStems`, `usage`, `stats`, `modePrefs`). API keys are left out (`SECRET`). Restore merges collections (never deletes), cleans every setting through `TKShared.cleanSetting`, and rebuilds unsafe addresses (`cleanSaved`, `cleanSearches`, `TKShared.safeUrl`). Accepts `app: "tirekick"` and `"second-look"`.
- **Delete everything** (asks first). Uninstalling deletes everything.
- Everything lives in `chrome.storage.local`. No `storage.sync` use today, no server, no account (ground rule).
- Saved listing record: `{ t, u, img, p0, a0, p, a }`; scores for a listing are cached in the scans cache, not on the saved record.

#### Part 1: Export (small, do first)

- A **Download a spreadsheet (CSV)** button in Settings › Backup and your data, and a smaller one on the Saved tab.
- Columns (dates as `YYYY-MM-DD` so every spreadsheet parses them): store, title, link, price when saved, price now, change, saved on, last seen, score, verdict, sold median, margin (Reseller mode), notes, listing key. Score and sold median come from the latest scan cached for that key if any; empty otherwise.
- Proper CSV: quote every field, double inner quotes, UTF-8 with BOM so Excel opens it right, and **guard against formula injection** (a title starting with `=`, `+`, `-`, `@`, tab or CR gets a leading `'`): titles come from web pages.
- Optional second file or sheet for saved searches (query, store, link, saved on, last visit, listings at your price).
- Pure function `TKShared.toCsv(rows, columns)` in `lib/shared.js`, unit tested.

#### Part 2: Sync (medium, needs a decision)

**Recommended: the browser's own sync, `chrome.storage.sync`, opt in.** No server, so it keeps the ground rules. The user's browser account carries it.
- Limits are tight: about 100 KB total, 8 KB per item, 512 items, and write rate limits (about 120 a minute, 1,800 an hour). So sync only small things: settings (minus API keys, unless the user ticks "also sync my keys", default off), `savedSearches`, `quickFilters`, `modePrefs`, and saved listings in a compact form (key, title cut to ~80 characters, price when saved, saved on), chunked across items. Not `listingMemory`, `codeStems`, `usage` or scans (too big, and local by nature).
- Merge like restore does: union of saved items and searches, newest setting wins, deletes carried as tombstones for 30 days so a removal on one computer doesn't come back from the other.
- Writes batched and debounced (a few seconds) to stay under the rate limits.
- A switch "Sync saved listings and settings through your browser account", off by default, with a line on what is and isn't synced, and the current size used.

**Vivaldi is the risk.** Vivaldi has its own sync (Vivaldi account), and it isn't clear that it carries `chrome.storage.sync` data for extensions. If it doesn't, `storage.sync` silently stays local in Vivaldi. **The agent must check this first** (on Myer's Vivaldi, two profiles or two computers signed into the same Vivaldi account) and report before building. If it doesn't work in Vivaldi, the fallback is a **sync file**: export a backup to a folder the user already syncs (Dropbox, Syncthing, a cloud drive) and restore from it, with a one-click "Restore the newest backup from my sync folder" via the File System Access API (`showDirectoryPicker`, permission kept per folder). No server either way.

#### Files likely touched

`lib/shared.js` (`toCsv`, sync merge helpers, settings the sync carries), `options/options.html` + `options/options.js` (buttons, switch, status, size), `content/panel.js` (Saved tab export button; listen to sync changes), `background.js` (sync writer, debounce, `chrome.storage.onChanged` for `sync`), `manifest.json` (none for `storage.sync`, it's covered by `storage`), `tests/unit/shared.test.mjs` (CSV quoting and injection, merge and tombstones), `tests/e2e/features.ts` or `tests/opts.test.js` (export downloads a file with the right rows), `store/PRIVACY.md` (sync goes through the user's browser account; Tirekick runs no server), `docs/ux-spec.md`.

#### Open questions

- Does Vivaldi sync `chrome.storage.sync`? (Must be checked first; decides the design.)
- Sync API keys at all? Default: no, with an opt in.
- Which columns matter most to Myer as a reseller? Default list above.
- Export to `.xlsx` too? Default: CSV only; every spreadsheet opens it.

#### How to know it's done

- **Export:** the CSV opens cleanly in a spreadsheet (LibreOffice and Google Sheets), titles with commas, quotes, emoji and a leading `=` come through as text, and every saved listing is a row. Unit tests for `toCsv`.
- **Sync:** with the switch on in two profiles, saving a listing or search on one appears on the other; removing it stays removed; settings follow; keys don't unless opted in; the size shown stays under the limit with 200 saved listings. Off by default, and turning it off stops writes.
- Vivaldi result reported to Myer before Part 2 is built, and the chosen route works in Vivaldi.
- Privacy page updated. `tests/all.sh` green.

---

### Brief 7: Built-in browser AI

Read [the briefs intro](#read-this-before-any-brief) first (ground rules, Vivaldi, copy, tests). Decided with Myer
on 2026-10-14: a priority, first in line after the 1.0.0 launch, and it should cover any browser that ships a model.

#### Goal

A free AI model with no key and no setup, wherever the browser has one built in, so scoring works the moment
Tirekick is installed. The API key and Ollama stay, as the choice for deeper analysis and for browsers without a
model.

#### What browsers have (check again before building)

| Browser | What it has | Notes |
|---|---|---|
| Chrome | The Prompt API (`LanguageModel`) with Gemini Nano, for extensions since Chrome 138 | Needs about 22 GB of free disk and a decent graphics card or 16 GB of RAM; downloads the model on first use; can take images |
| Edge | The same API, with Microsoft's own model | One piece of code covers both |
| Firefox | A different, experimental API | Later, if Tirekick goes to Firefox |
| Vivaldi | None | Myer's browser: Claude or Ollama as now |

Sources: [Chrome's Prompt API](https://developer.chrome.com/docs/ai/prompt-api),
[Edge's Prompt API](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/prompt-api).

#### How it would fit

- **A model choice, "Built into this browser (free)"**, offered only when a feature check finds one
  (`LanguageModel.availability()` is "available" or "downloadable"). Any browser that adds the same API gets it with
  no change. Where there's none, settings says so in one line and offers the other choices.
- **New installs start on it** when it's there, so the welcome card asks for nothing; the key becomes optional.
  Existing installs keep their model and see it offered.
- **Quick scoring with it; deep analysis with a bigger model when one is set up.** Scans send short batches and ask
  for the scan's JSON shape through `responseConstraint`. Analyze and photo checks use it only when nothing else is
  set up, and say it's a small model.
- **The download**: when availability is "downloadable", one button starts it, with its size, and progress in the
  status line. Nothing downloads without a click.
- **Where it runs**: check which extension contexts can call it (the background worker, or an offscreen page) and
  keep one queue, like the paid services. It costs nothing, so spend stays at $0 and the footer says "free, on this
  computer".
- **Privacy**: nothing leaves the computer, the same as Ollama; the privacy page and listing say so.

#### How to know it's done

- With the API present (a stub in the tests, the real thing in Chrome by hand), the choice appears, scans run
  through it, and spend stays at $0. Without it, the choice doesn't appear and nothing changes.
- A batch of the mock scans scored by Gemini Nano in Chrome is compared with Haiku's on the same listings, and the
  README says honestly how they differ.
- Myer has tried it in Chrome; in Vivaldi the choice doesn't appear and nothing breaks.

### Brief 8: Price data beyond eBay sold listings

Added 2026-10-15. Myer: worth it "if it also makes the product better". Plan only; nothing built.

#### Why
The "typical price" today comes only from recent eBay sold listings (`lib/sold.js`). That fails in three common cases:
local pickup items that rarely sell on eBay (furniture, appliances, bikes), very new or niche items with
few sales, and regional prices (Marketplace in a big city vs. eBay's national market). In those cases the
chip is missing or misleading, and the free read says nothing.

#### Options, best first
1. **Asking prices you've already seen (recommended first).** `listingMemory` already keeps the price of
   every listing on the pages you looked at, for 90 days. A "typical asking price" from those (median of at
   least 8 similar titles, same store, same area when the page says it) fills the gap when eBay has too few
   sales. It costs nothing, fetches nothing, and keeps to the ground rules. Asking prices run higher than
   selling prices, so the chip must say so: "about typical asking price", never "typical", and the tooltip
   names the source. Matching "similar" reuses the sold-price query words.
2. **Sold prices from the next stores as they're added (Brief 5).** Mercari and others show sold listings on
   their own search pages. When a store is added, its sold results are read from pages you open, the same
   way the eBay ones are, and pooled with eBay's into one typical price with the sources listed.
3. **Not recommended: paid price APIs** (for example, collectibles or electronics price guides). They need
   keys, cost money, cover narrow categories, and would send your searches to another company.

#### How to know it helps
Before building, take 30 real Marketplace listings Myer looked at and compare three things: the eBay sold
typical price, the asking-price typical from `listingMemory`, and what Myer judges each item is worth. Build
option 1 only if it gives a sensible number for clearly more of them without making the eBay cases worse.

#### Size and files
Small to medium: `content/rules.js` (a pure `askingTypical`, unit tested), `content/panel.js` (chip and
tooltip wording), `lib/shared.js` (nothing new in storage). One PR, version bump, light and dark screenshots.

### Brief 9: More browsers

Added 2026-10-15 (Myer: platform-agnostic plans belong here). Plan only; nothing built.

- **Already covered:** Chrome, Vivaldi, Brave, Opera and Edge are all Chromium and load the same zip. Edge has its
  own free store (Microsoft Partner Center): the same zip, a listing copied from `store/LISTING.md`. Cheapest next step.
- **Firefox (medium).** Firefox runs Manifest V3 but starts `background.js` as an event page, not a service worker:
  add `"background": { "scripts": [...] }` beside `service_worker` (Firefox reads one, Chrome the other), and a
  `browser_specific_settings.gecko.id`. Check `chrome.action.openPopup`, `setPopup` per tab, context menus,
  `optional_host_permissions` (asked at runtime in Firefox) and the shadow-DOM panel. Run the e2e suite in Firefox
  through its WebDriver BiDi support, or by hand from a checklist at first. Publish on addons.mozilla.org (free;
  source review is easy since there's no build step).
- **Safari (large).** Needs Apple's Safari Web Extension converter, an Xcode wrapper app, a Mac to build on and
  the $99 a year Apple developer program, and ships through the App Store. Host permissions are granted per site by
  the user. Worth it only after Firefox, if people ask.
- **How to know it's done:** per browser, the free marks, Scan, Saved, the popup and a restore from backup work on
  the eBay and Marketplace fixtures; the README says which browsers are supported.

### Brief 10: More AI options

Added 2026-10-15. Plan only. 0.40.0 already made the choice even: one "AI service" menu lists every service side by
side, and a fresh install picks none. What's left:

- **Quality presets for every service.** The panel's Thrifty, Balanced and Thorough menu only exists for Claude
  today. Give each preset service (OpenAI, Gemini, OpenRouter and the rest) its own cheap and strong model pair, kept
  in one table, so every service gets the same menu. Small.
- **Built-in browser AI:** Brief 7 (Gemini Nano in Chrome, Edge's own model). First after 1.0.0.
- **Local models:** Ollama and LM Studio work today. Add a short "which model to pull" note in settings, measured
  on the mock scans, and a clear message when the local server isn't running. Small.
- **Native Gemini API** only if the OpenAI-style address falls short (photos, structured answers); otherwise keep
  one code path.
- **How to know it's done:** with each service set up against the mock server, the panel menu offers the same three
  choices, and scans, Analyze and photo checks work.
