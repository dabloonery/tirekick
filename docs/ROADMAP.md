# Tirekick roadmap

What's next for Tirekick: getting into the Chrome Web Store, making the no-AI features sturdier,
and briefs for new features. Voice, the rename plan and the security review are in
[REFERENCE.md](REFERENCE.md). Store listing text and images live in `store/`.

## Contents

- [Where things stand](#where-things-stand) (2026-10-22: each plan's state, and what waits on dabloonery)
- [Built for one person, reassessed for everyone](#built-for-one-person-reassessed-for-everyone) (2026-10-15)
- [Public beta launch](#public-beta-launch) (decided 2026-10-15: launch as a public beta before 1.0.0)
- [Honest low prices](#honest-low-prices) (2026-10-21: honest cheap listings marked as scams; the order of PRs)
- [Prices by version](#prices-by-version) (2026-10-27: a listing against sales of its own tier, generation and size)
- [After real use (2026-10-16)](#after-real-use-2026-10-16) (0.50.2 fixes, and design changes for dabloonery to pick)
- [Chrome Web Store: each upload](#chrome-web-store-each-upload)
- [Tirekick: making the no-AI features sturdier](#tirekick-making-the-no-ai-features-sturdier)
- [Tirekick feature briefs](#tirekick-feature-briefs)
  - [Brief 1: Alerts on saved searches](#brief-1-alerts-on-saved-searches) (dabloonery chose options 1 and 2; not built yet)
  - [Brief 2: Price history on saved items](#brief-2-price-history-on-saved-items)
  - [Brief 3: Offer helper](#brief-3-offer-helper)
  - [Brief 4: Stronger scam checks](#brief-4-stronger-scam-checks)
  - [Brief 5: More stores](#brief-5-more-stores)
  - [Brief 6: Sync and export](#brief-6-sync-and-export)
  - [Brief 7: Built-in browser AI](#brief-7-built-in-browser-ai) (first after the 1.0.0 launch)
  - [Brief 8: Price data beyond eBay sold listings](#brief-8-price-data-beyond-ebay-sold-listings) (plan; check first that it helps)
  - [Brief 9: More browsers](#brief-9-more-browsers) (Edge store, then Firefox, then Safari)
  - [Brief 10: More AI options](#brief-10-more-ai-options) (quality menu for every service)
  - [Brief 11: Side panel mode](#brief-11-side-panel-mode) (idea from the 2026-10-15 UI audit)
  - [Brief 12: Choose what Tirekick shows](#brief-12-choose-what-tirekick-shows) (2026-10-23: Without the AI, Scam check only, Everything; built 2026-10-23)
  - [Brief 13: Filters that set the store's own](#brief-13-filters-that-set-the-stores-own) (2026-10-23: price, condition and more set the store's filters; built, dabloonery to check on the real stores)

---

## Where things stand

*2026-10-22. Replaces the 2026-10-14 "Next steps" (the order of work then, and dabloonery's steps for the 0.40.0 live
check); those are in git history.*

| Plan | State |
|---|---|
| Chrome Web Store | Public beta live; the store has 0.50.0. `main` is 0.58.0, set for the next upload (2026-10-23). Uploading it is dabloonery's call ([checklist](#chrome-web-store-each-upload)) |
| Scam checks and prices | [Honest low prices](#honest-low-prices) done (#57 to #82); layout guards, long-feed speed and an eval with the real prompts merged 2026-10-21 and 22; [prices by version](#prices-by-version) 2026-10-27 |
| Real-use fixes | The 2026-10-16 fixes reached `main` on 2026-10-22 (#84, [After real use](#after-real-use-2026-10-16)); recheck them on the real sites |
| Sturdier no-AI features | All 8 shipped ([summary](#tirekick-making-the-no-ai-features-sturdier)). Real saved eBay and Marketplace searches are fixtures since #90; listing, sold and category pages are still hand-made |
| Free parts of briefs 2, 3, 4 and 6 | Built in 0.37.0 to 0.40.0 (age and price moves, the offer helper, "Too cheap?" and same-photo marks, CSV export) |
| Open source | Apache-2.0 since 2026-10-22; the repository is public |
| Waiting on dabloonery | The four design picks in [After real use](#after-real-use-2026-10-16); tags that lead with words ([still to do](#still-to-do-in-this-round)) |
| Next to build | Brief 12 (choose what Tirekick shows) is built and Brief 13 (store filters) is being built; next is Brief 1 (alerts, options 1 and 2), then Brief 5 (Craigslist first). Brief 7 (built-in browser AI) is the first feature after 1.0.0 |
| Never done | A screen reader; sold-price lookups watched on real sold pages over time |

### Version numbers

PRs #13 to #22 all shipped as 0.36.0, and an older pre-rename build (`second-look-0.36.1.zip`) carries a higher
number. From 0.37.0 to 0.57.0, CI failed a pull request that didn't raise the version. Since 2026-10-21 (dabloonery) the
version stays put between Chrome Web Store uploads, and CI only fails one that lowers it (`deno task version-check`).

### Open source (decided 2026-10-14, done early on 2026-10-22)

dabloonery agreed: license Tirekick under **Apache-2.0** and make the repository public at the 1.0.0 store launch. The
repository went public with the beta, and on 2026-10-22 dabloonery chose to switch the license then too, rather than
wait for 1.0.0.

- [x] Scrub personal paths from the docs (the home-folder path in REFERENCE's rename notes, removed in 0.37.0).
- [x] Replace `LICENSE` with Apache-2.0 and update README's "License and disclaimer" (the font stays under the OFL;
      the disclaimer and trademark note moved to `NOTICE`, which ships in the store zip). 2026-10-22.
- [x] Personal email and name in the commit history: rewritten 2026-10-23 (dabloonery's call). Every commit is now
      by dabloonery (GitHub noreply address) or Claude, and messages and old files say dabloonery. A backup bundle of the
      old history is on dabloonery's computer. GitHub's closed-PR refs still point at the old commits until GitHub
      Support purges them.
- [x] Check again that no keys, tokens or private details are in the files or the history (2026-10-22: a pattern
      search of every commit found no API keys, tokens or private keys).

The name, alongside it:

- [ ] Use "Tirekick™" where the name first appears in the README, the store listing and the website (™ needs no
      registration).
- [ ] Before launch, run a clearance search for "Tirekick" and "Tire Kick" in software: USPTO (classes 9 and 42),
      the Chrome Web Store, and app stores.
- [ ] Around the open-source launch, file a USPTO registration in class 9 (dabloonery).

### Brand over personal name

*Added 2026-10-15 (dabloonery: "remove my name and info where possible and replace with tirekick.app or Tirekick").
dabloonery isn't hiding that they made Tirekick; the brand should simply be what people see.*

Audit of both repos and the accounts around them:

| Where | What shows now | Status |
| --- | --- | --- |
| `NOTICE`, README "License and disclaimer" | was "dabloonery", then "The Tirekick authors" (0.42.2) | 2026-10-23: "dabloonery and the Tirekick authors"; credits use the dev name dabloonery (dabloonery's choice) |
| `store/LISTING.md` homepage | was the GitHub repo | Done in 0.42.2: `https://tirekick.app` |
| `manifest.json` `homepage_url` | was the GitHub repo | Done in PR #30: `https://tirekick.app` |
| Code comments (`rules.js`, `theme.js`, `panel.js`) | a personal name | Done in 0.42.2 |
| Website repo `tirekick-site` | "© 2026 Tirekick™", support@tirekick.app, no personal details, commits by Claude and GitHub noreply addresses only | Clean (rechecked 2026-10-23) |
| Store listing, privacy policy, site contact | support@tirekick.app | Clean, once the mailbox forwards |
| Main repo commit history | was a personal email on 25 early commits and a first name in messages and files | Rewritten 2026-10-23; old PR refs remain until GitHub Support purges them |
| GitHub owner `dabloonery` | in both repo addresses and as the author of every merge | dabloonery, step 2 |
| Chrome Web Store publisher name and contact email | not set yet | dabloonery, step 3 |
| Internal notes (`AGENTS.md`, this file, `REFERENCE.md`, `store/SECURITY-REVIEW.md`, code comments) | a first name as the decision maker | Done 2026-10-23: "dabloonery" |

Steps for dabloonery, in order. None of these can be done from the project, and steps 1 and 2 can't be undone:

1. ~~**Commit history**~~ Rewritten 2026-10-23 with git filter-repo and force-pushed (backup bundle kept). Left to do,
   optional: ask GitHub Support to remove cached views and dangling commits for this repo, which clears the old
   commits still reachable from closed PRs. For new commits, keep GitHub's "Keep my email address private" and
   "Block command line pushes that expose my email" on, and use the noreply address as `git config --global user.email`.
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
   5. Your computer: in your local clone run
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
5. ~~**Internal notes**~~ Done 2026-10-23: the files say "dabloonery" instead of a name, so the repo carries no names.

---

## Built for one person, reassessed for everyone

*2026-10-15, from dabloonery: several features were made for dabloonery's own testing and taste. Each was looked at again for
everyday buyers (the main audience) and resellers. dabloonery's calls are marked; Claude went ahead on its recommendation
for each, one PR per change.*

| What | Was | Call | Where |
|---|---|---|---|
| "What you use" counters on Home | Made to see which features dabloonery used | **Removed.** Only the scan and typical-price counts stay (they drive the first-run checklist and the mode hint) | 0.44.0 |
| Copyable questions for the seller | Part of every analysis | **Removed** (dabloonery: redundant). The AI no longer writes them, so an analysis costs a little less | 0.44.0 |
| AI spending | A Home tile, a 30-day chart, the footer, a settings section near the top | **Kept, quieter** (dabloonery). No Home tile; the chart only once something was spent; the footer amount only with a paid service; settings moved it down and folded it | 0.44.0 |
| Default "What you're into" | Retro tech, consoles and homebrew (dabloonery's taste) for everyone | **Blank by default.** An install already using the old default keeps it (storage upgrade 2) | 0.44.0 |
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
2. **Scores, in two parts**: mostly done another way (revised 2026-10-21). The aim was a price verdict and a fit
   verdict that can't contradict each other. The price side already wins where they disagree (`TKRules.priceVerdict`,
   0.41.0), and since 0.53.0 the scan and Analyze prompts start from the cards' own price lines (`PRICE_BANDS` in
   `background.js`, the same as `TKRules.priceWord` and `TOO_CHEAP`, checked by a unit test) and are told the free scam
   signs, so the AI's word moves away from the card's price word only for what it read. A separate "Fit" field
   would cost a second judgment per listing in every scan and needs real listings to tune, so it isn't planned.
   *Still open, after dabloonery's live check:* tags that lead with the words and move the number into the reasons.
3. ~~**Broad words and category pages**~~ (0.45.0, `TKRules.broadQuery`): no page-wide comparison against a category ("Electronics"): Tirekick says the
   words are too broad, and each listing gets its own typical price from its title. When no lookup can be made
   (eBay blocks it, too few sales, turned off) the card says so and why, with a link to eBay's sold listings.
4. ~~**Audit and clean-up**~~ (0.46.0): "·" separators dropped where color or weight already parts the words
   (dabloonery, 2026-10-15): a verdict in color is followed by a space ("Fair price ~$45 below the typical price ($116)"),
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

## Public beta launch

*2026-10-15. dabloonery decided to launch on the Chrome Web Store as a **public beta** instead of waiting for 1.0.0.
Nothing is submitted until dabloonery says so.*

**What "beta" means here.** The store has no beta switch, so the label is in the words: the summary (the
manifest's description) starts with "Beta.", and the description opens with a short beta note asking for
feedback at support@tirekick.app. The name stays **Tirekick**, so nothing needs renaming when the beta ends.
The version stays 0.x during the beta; **1.0.0** marks the end of it, and the open-source step
([Open source](#open-source-decided-2026-10-14-done-early-on-2026-10-22)) was done during the beta (2026-10-22).
Distribution is **Public**, all regions.

**Gates, in order.** Each must be done before submitting:

1. [x] The open PRs merged: #32 (logo, 0.43.0), #33 to #35 (built-for-one-person cleanup, typical price per
   listing, panel tidy; 0.44.0 to 0.46.0).
2. [x] Security item L1 (links through `safeUrl`, 0.37.0) and the review pass's L1 copy fix (0.40.2).
3. [x] The listing marked Beta (`store/LISTING.md`, manifest description), 0.48.0.
4. [x] **The holistic review** (dabloonery, 2026-10-15: "don't forget the holistic review"): done in 0.47.0 (PR #37).
   Its findings are under [Built for one person, reassessed for everyone](#built-for-one-person-reassessed-for-everyone).
5. [x] **dabloonery's real-site check** on eBay and Marketplace in Vivaldi ("For dabloonery, in order", step 3), and
   real captures for screenshots 1 to 3 (eBay search, eBay listing, Marketplace), cropped and with personal
   details removed in 0.49.1. The check turned up three fixes, also in 0.49.1: no dollar gap for placeholder or
   far-off prices, the off-site chip cleared when the AI calls the contact harmless, and a shorter, honest pause
   when eBay's sold-price answer just looks odd. Recheck those on the real sites.
6. [x] **dabloonery's accounts:** non-trader status in the developer dashboard (recommended: it keeps a home
   address off the listing), support@tirekick.app forwarding, and the contact email verified.
7. [x] **Site:** tirekick.app on HTTPS (done 2026-10-15) with `/privacy` loading, ready to publish the same day with the store
   link in place of `STORE_LISTING_URL` and a matching "Beta" mention.
8. [x] The store build is exactly **0.50.0** (dabloonery, 2026-10-15); pre-launch changes stay 0.49.x. `deno task test` green, `deno task pack`, the packed zip loaded unpacked and clicked through.
9. [x] **dabloonery's OK to submit.** Done: 0.50.0 is live on the store as a public beta (by 2026-10-21).

**During the beta.** Feedback comes from strangers only (dabloonery doesn't want to involve people they know): the
support address and, if dabloonery wants, one forum post (r/Flipping or r/eBay). Fixes ship as 0.x updates through
the store. The beta ends at 1.0.0, when the label comes off.

### Launch outreach (draft, 2026-10-16: dabloonery picks; nothing is posted without dabloonery)

Decided so far: no promotion plan, strangers only (never people dabloonery knows), no ads. This is a menu, smallest first.
Each post goes up from dabloonery's own account, after dabloonery reads that community's current rules on self-promotion
(many subreddits allow it only in a weekly thread, or only from accounts that take part otherwise).

1. **One beta post, one community** (recommended first). r/Flipping or r/eBay: whichever allows it under its
   rules that week. Ask for feedback, not installs. Draft:
   > **I built a free browser extension that tags eBay and Marketplace listings as fair price, overpriced or
   > likely scam: looking for beta feedback**
   > It reads the search page you already have open and marks each listing against what the item actually sold
   > for, plus common scam signs (codes in titles, "contact me outside the site", prices far below sold). It
   > never logs in, clicks or messages anyone. The core features work without any AI; an AI is optional if you
   > want a closer read of one listing (you bring your own key, or run a local model). Chrome and Vivaldi, desktop
   > only. It's a beta, so I'd like to hear what it gets wrong: support@tirekick.app or here.
   > [store link] · [tirekick.app]
2. **A second community a week later**, only if the first went well: r/Frugal (buyer side, strict on
   promotion) or a deal-hunting forum that allows tool posts. Same draft,
   buyer-first.
3. **Answer, don't advertise.** When someone asks "is this a scam?" or "what's a fair price?" in those
   communities, a plain answer with a link where it truly helps. Slow, but it's how small tools get trusted.
4. **Product directories**, low effort, no audience pressure: AlternativeTo, and later Product Hunt at 1.0.0 (a
   beta launch there spends the one launch day early).

**Paid ads: not at beta.** A beta wants a few dozen people who write back, not hundreds of quiet installs, and
ads bring the quiet kind. Reddit and Google ads would cost money per install before the listing has any ratings,
which is when installs convert worst. Revisit at 1.0.0 with ratings in place, a small test budget (say $50) and
one clear audience (eBay buyers).

### Promotion plan, first month (2026-10-21: the beta is live and the repo is public)

One step a week, from dabloonery's own accounts, strangers only, no ads, nothing automated. Read each community's
self-promotion rules first. Lead with buyers ("good price or scam?"); keep reseller wording neutral; never list
AI brands. Claude drafts each post on request; dabloonery edits and posts.

| Week | Where | Angle |
|---|---|---|
| 1 | r/Flipping (or its weekly self-promo thread) | The beta post above: ask for what it gets wrong |
| 2 | r/Frugal or a deal forum that allows tool posts (Slickdeals' tech forum) | Buyer first: spot scams and overpriced listings before you buy |
| 3 | Open-source side: r/chrome_extensions, r/SideProject, and a "Show HN" | Free, open source (Apache-2.0), works on the page you're on, keeps data in your browser |
| 4 | r/eBay (if rules allow) + AlternativeTo listing | Same beta post; directory entry is a one-time form |

Every week: answer "is this a scam?" / "fair price?" questions where a link truly helps (step 3 above), read new
reviews and support mail, and note installs from the store dashboard. If a week's post goes badly, skip the next
one and fix what people said first. Product Hunt waits for 1.0.0.

**Watching how it goes:** the store dashboard's installs and uninstalls (weekly), the reviews on the listing, and
the support mail. One post per community; never reply to criticism defensively; fixes ship as 0.50.x.

---

## Honest low prices

*2026-10-21, after an audit of the whole scam pipeline (dabloonery: "go").* Honest listings priced far under typical were
marked as scams with no way out: before a scan, under 55% of the typical price is a warning whatever the title says, and
after a scan the price check (`TKRules.priceVerdict`) overruled the model every time, Analyze included. In the eval's
new group of 28 honest cheap listings (`CHEAP` in `tests/eval/cases.mjs`), 19 of the 20 that say why they're cheap (a
flaw, missing parts, a lock, a cheaper version) were still a warning after a scan.

**Decided (dabloonery, 2026-10-21):** the model's reason for a low price can beat the price check, for scans and Analyze.
This refines the 0.41.0 rule ("when the score and the price disagree, the price check wins"): it still wins against
praise, but a flaw, missing parts or a different model, named by the model, counts. "Moving sale" never does: scammers
write it too.

The order, one PR each, every one measured by `deno task eval` with the scam numbers beside the honest ones:

1. [x] The eval: 28 honest cheap listings and 10 scams that give the same excuses.
2. [x] One set of facts for the card, the scan and Analyze. The bait share sent to the model was worked out from the raw
   card, without the for-parts, missing-word and pickup facts, so a for-parts listing at 34% went to the model as "the
   usual bait"; Analyze judged its verdict with no card facts at all.
3. [x] Stated reasons read for free (`cheapReason`): flaws, missing parts, locks, cheaper versions. Never Likely scam on
   price alone when the card says why.
4. [x] The too-cheap line from where real sales end (the cheapest tenth), and no Likely scam on price alone from a
   reference with a wide spread.
5. [x] A fixed seller sign for "cheap plus a seller warning is Likely scam" (0.54.x), not the user's own rating setting.
6. [x] The model says why a low price is low (`cheapWhy`), and the price check accepts a flaw, missing parts or a
   different model.
7. [x] Platforms: established eBay sellers (eBay's guarantee), and Marketplace sellers who don't pay eBay's fee.
8. [x] Display: the reason on the card, what would clear a mark, and where a price warning sorts.
9. [x] Optional: the eval with the real prompts, when an API key is set (never in CI). First run (2026-10-22, Haiku):
   every scam stayed a warning, but 4-5 of the 31 honest cheap listings were flagged because the prompt's 55% rule
   ignored what the price check had cleared (a pickup seller, an established eBay seller, sales that go that low). The
   rule now applies only beside the price check's own "the total is N% of the typical price" note: 29-31 of 31 over
   five runs, scams 11 of 11.

## Prices by version

*2026-10-27, from an outside architecture review dabloonery brought in (its "Blueprint 1").* A search that names no
version ("nintendo switch", "iphone 13") gets every version in its sales: Lites at $95 beside OLEDs at $250. One median
for all of them made an OLED at $235 "Above typical", a plain Switch at $199 "Fair price" and an honest Lite "Check
first" (saved by `cheapReason`'s "cheaper version" only after the warning).

Built (#132, widened the same day at dabloonery's ask "more than just a switch"): `TK.summarizeSold` groups the sales
on three axes (`TKRules.versionOf`): a tier word (`TKRules.TIER_MODIFIERS`: lite, oled, mini, pro max, tool only,
digital edition…), a generation ("2nd gen", "gen 2", "v2"), and a storage size (16GB or more; a title naming several
sizes or generations, "5th 6th 7th Generation", counts as none). Each group with 8+ sales and a spread worth trusting
keeps its numbers (`market.variants`, keyed "tier/generation/size" with "*" for any). `TKRules.forVariant` (run by
`forPickup`, so everywhere a card is priced) tries the listing's whole kind, then any size, then any generation, then
falls back to the whole market as before; a listing that doesn't say its generation or size is compared with any.
A tier the search names, or one over 60% of sales have ("20V Max" on DeWalt drills), is the thing itself; a search that
names a size turns sizes off. The chip's hover says which sales it used, and the version stops counting as the reason a
listing is cheap once it's compared with its own kind.

Eval: 14 labeled listings on "nintendo switch", "iphone 13" and "airpods pro" searches, all as labeled; against the one
median 13 of them came out wrong (an OLED at $235 "Above typical", a Pro Max at 38% unmarked). On the real saved "ipod
classic" page (asking prices, not sales), 5th generation 30GB ones sit at $100 against $140 for the whole page.

Read better (2026-10-27 review): tier words that name something else don't count ("Pro Seller", "Pro Controller
Bundle", "Max Battery", "Plus Carrying Case"; "plus" is a version only after a model number, and "S21+" is a Plus). A bare
number right after the search's name, a tier word or "series" is the generation ("Nintendo Switch 2", "Meta Quest 3",
"AirPods Pro 2", "iPad mini 6"; up to 20, not a count of games or a screen size before the chip), so Switch 2 sales no
longer lift the plain Switch's typical price; the name word is kept in `_same` as "@switch", and a typical price saved
before reads as it did. A V number is a revision, kept apart ("v 2": a Switch V2 isn't a Switch 2). A search ending in
a number ("iphone 13") has that generation as the thing itself, so iPhone 14 sales that eBay mixes in stand apart.
Eval: 4 new listings, 3 of them wrong before.

The AI sees the same numbers: a scan's line for a listing compared with its own version says "for its version (lite:
$95, 14 sales)", the reference says the sales mix versions, and Analyze gets the version's numbers.

Left: sold pages are still hand-made fixtures, so how often real lookups have 8+ of a kind is unmeasured. Not axes yet:
model years and chips ("2020", "M1" vs "M2"), colors and carrier locks.

## After real use (2026-10-16)

dabloonery's notes from using the beta on eBay and Marketplace.

**Fixed in 0.50.2** (PR #42; it reached main only on 2026-10-22, without its version bump. Still to check on the real sites, marked *real site*):

- Messenger pop-ups on Facebook got tags and were read as a listing. Small fixed boxes (chat windows) are skipped
  (`TK.inChatBox`), and a listing dialog must be at least 560px wide. *Real site.*
- Marked-down prices were read backward when Facebook put the struck-through old price first or on the same line.
  The struck-through price is found by its style (`TK.isStruck`) on cards and on the listing page. *Real site.*
- A listing analyzed on its own page was scored again by a page scan when its shipping showed only on the listing
  page. A saved analysis now also matches on the asking price.
- The panel's theme follows the page (light eBay, light panel) when the setting is Match (now "Match the page").
- eBay's home page opens on Home with no "This page" tab.
- The compare and "What I want" boxes fold away again with Done or Esc after Change or Edit.
- Skipped's Hide leaves "Great price, if it's real" listings on the page, as the list does. (Where they sort is set
  by [Honest low prices](#honest-low-prices), item 8; #42's own sort order was left out.)
- A listing's own Typical price tries a four-word search once when its whole title finds too few sales.
- Settings and the hub page use the same tire mark as the panel, and have a tab icon.

**0.50.3**, from the first real-site check (Claude in Chrome, logged in): chips still drew over a Messenger
window, and the listing page read the struck-through price. Each card's marks now stay in their own layer
(`isolation:isolate` on the card), chat links count as chat whatever the width of the chat dock, a strike set
up to six boxes above the price counts, and the listing page never takes a struck price. Switching back to Buyer
before a scan clears the Reseller line.

**Why eBay sold search fails so often** (from the code; can't be checked from here): one browser check pauses every
lookup for an hour; on Facebook with no eBay tab open, lookups come from the background, which eBay trusts less;
eight lookups an hour at most; and a long title often matches fewer than five clean sales. Opening any eBay tab
helps the second. Since the pacing round (after 0.58.0): an answer is kept a day, not six hours; two tabs asking
for the same search make one lookup and share it; and after a check, the next one the same day pauses for 2 h,
then 4 h, then 6 h, with half the lookups at three times the spacing for a day, so lookups stop knocking on a
door eBay has just shut.

**For dabloonery to pick** (not built):

1. *Typical price.* Rename it ("eBay sold price", "Sells for"), show it as one line at the top of the panel and in
   each card's tag, and when eBay won't answer, offer: the AI's estimate (when set up), the price of similar
   listings on the page (the asking-price middle, labeled as asking), or the "See sold listings" link.
2. *AI features without an AI.* With no AI set up, hide Scan, Analyze and the Buyer/Reseller switch behind one
   "Add an AI for scores" line, so the free tools lead.
3. ~~*Filters.* Match the sites' own~~ Replaced by [Brief 13](#brief-13-filters-that-set-the-stores-own)
   (dabloonery, 2026-10-23): Tirekick's filters set the store's own where it has one, instead of copying them.
4. *Scam check.* One "Check for scams" button that runs the photo check, the reverse image search, the seller and
   wording checks together and gives one answer, in place of the separate photo buttons.

---

## Chrome Web Store: each upload

*The first submission (0.50.0, the public beta) is done; its full checklist (accounts, domain, images, store
forms) is in git history before 2026-10-22. Store form answers are in `store/LISTING.md`; the security review
is in `store/SECURITY-REVIEW.md`.* Nothing is uploaded without dabloonery's OK.

- [ ] dabloonery says which build goes up; the version is set then (it stays put between uploads).
- [ ] `deno task test`, then `deno task pack`. Unzip `dist/tirekick-<version>.zip` into a fresh folder, load it
      with **Load unpacked**, and click through: an eBay search, the panel, a scan with a key, a Marketplace
      search, settings, a backup and restore.
- [ ] If what's read, stored or requested changed: `store/PRIVACY.md`, `site/privacy.html` (and tirekick-site)
      and `store/LISTING.md` say so before the upload.
- [ ] After approval: install from the store in Chrome and in **Vivaldi**, and run the checks in the security
      review's Vivaldi section (icon and badge, shortcut, the right-click entries).
- Keep the unpacked copy used day to day separate from the store install: they have different extension IDs, so
  saved data doesn't move between them (**Save a backup** and **Restore** carry it across).

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

*Planned 2026-10-14; all eight items shipped in 0.36.0 (#14 to #21). The full plan, with how each part could
break, is in git history before 2026-10-22.*

1. **Layout watch**: on results pages the panel counts how many listings it could read (`TKRules.readHealth`),
   keeps it per store in `siteHealth`, and Home says when a store looks broken.
2. **Storage that can't silently fill up**: caps per record, and a storage error that says so and points at Backup.
3. **One writer for shared data**: `send("storeEdit", …)` through the background (`applyEdit` in `lib/shared.js`).
4. **Restore that can't break the panel**: backups are checked, and older shapes upgraded.
5. **Sold prices you can trust more**: a confidence on every median, paced and cached lookups (`lib/sold.js`).
6. **Plain logic out of the panel**: `content/rules.js`, unit tested without a page.
7. **Parsing edge cases and words**: prices, ranges, shipping, lots and auctions, in the adapter unit tests.
8. **Upgrades from older versions**: `TKShared.upgradeStorage` with `STORAGE_VERSION`.

*Still open:* real saved listing, sold and category pages (real eBay and Marketplace searches are fixtures since #90).

---

<!-- merged from briefs/README.md -->

## Tirekick feature briefs

The briefs (1 to 7 written 2026-10-14, 8 to 10 on 2026-10-15) are written so another agent can pick one up cold. Each started as a plan; where a part has been built since, the brief or [Where things stand](#where-things-stand) says so.

| # | Brief | Size | Depends on |
|---|---|---|---|
| 1 | [Alerts on saved searches](#brief-1-alerts-on-saved-searches) | Medium | 0.36.0 port (auto-scan, per-search wants). dabloonery chose options 1 and 2 (2026-10-14) |
| 2 | [Price history on saved items](#brief-2-price-history-on-saved-items) | Small to medium | Nothing new; feeds brief 3 |
| 3 | [Offer helper](#brief-3-offer-helper) | Small to medium | Better with brief 2 |
| 4 | [Stronger scam checks](#brief-4-stronger-scam-checks) | Medium | Nothing new |
| 5 | [More stores](#brief-5-more-stores) | Large (one PR per store) | 0.36.0 port (site table) |
| 6 | [Sync and export](#brief-6-sync-and-export) | Small (export) to medium (sync) | Nothing new |
| 7 | [Built-in browser AI](#brief-7-built-in-browser-ai) | Medium | Nothing new. First after the 1.0.0 launch (dabloonery, 2026-10-14) |
| 8 | [Price data beyond eBay sold listings](#brief-8-price-data-beyond-ebay-sold-listings) | Small to medium | A check on 30 real listings first |
| 9 | [More browsers](#brief-9-more-browsers) | Small (Edge) to large (Safari) | Nothing new |
| 10 | [More AI options](#brief-10-more-ai-options) | Small | 0.40.0 service menu |
| 11 | [Side panel mode](#brief-11-side-panel-mode) | Medium | Nothing new; must keep the drawer for Vivaldi |
| 12 | [Choose what Tirekick shows](#brief-12-choose-what-tirekick-shows) | Small to medium (3 PRs) | Nothing new; waits on dabloonery's answers |
| 13 | [Filters that set the store's own](#brief-13-filters-that-set-the-stores-own) | Small to medium (3 PRs) | Nothing new |

Suggested order: 2 → 3 → 4 → 6 (export) → 5 (Craigslist first) → 1.

### Read this before any brief

**Where the code is.** `github.com/dabloonery/tirekick`; start from the latest `main` (0.57.0 on 2026-10-22). The site table is `TKSites` in `lib/sites.js`.

**What already exists (don't rebuild it).** Several of these ideas are partly built. Each brief has a "What's there today" section with file and line references to main at `381f758`. Line numbers will drift; search for the names.

**The ground rules** (README, "Ground rules", from the ux-spec branch). They exist because eBay's and Meta's terms prohibit unattended collection, and breaking them gets dabloonery's accounts flagged:
- Only pages you're looking at. Never open, crawl or refresh a store's page by itself. Auto-scan reads only a search tab that's on screen.
- Requests to the stores are few, spaced and started by you: eBay sold lookups are at most 8 an hour, 5 seconds apart, cached a day (`lib/sold.js` after the port).
- Never get past a bot check. Stop and say so.
- Nothing leaves the browser except to the AI service the user chose and eBay's own search. No server, no analytics, no account.
- Estimates are labeled as estimates.

**Permissions.** A new *required* permission with a warning makes Chrome (and Vivaldi) disable the extension on update until the user accepts. New capabilities go under `optional_permissions` / `optional_host_permissions` and are requested when the user turns the feature on.

**dabloonery's browser is Vivaldi** (Chromium). Anything that touches browser APIs beyond what's already used (notifications, `storage.sync`, side panel, alarms) must be checked in Vivaldi, not just Chrome. The automated tests run headless Chrome; the brief's "done" list says what dabloonery should check by hand.

**Copy.** US English only. Follow the Voice and copy part of [`docs/REFERENCE.md`](REFERENCE.md): verdict first then why, "Likely scam" never "Scam", estimates say so, sentence case, no exclamation marks except in the seller message. Copy about what Tirekick *is* stays store-neutral ("the stores where you shop"); name a store only where the feature really is store-specific. More stores are coming.

**Look.** Tread Dot, flat (no gloss, no 3D, no rims), round dots, never tilted. Tokens live in `lib/theme.js` (`TKTheme`, local `THEME` in `content/panel.js`). Reuse existing components (status line, Home alerts, chips, hover card, the sparkline in `lib/shared.js` `S.spark`) before adding new ones.

**Tests.** `deno task test:unit` (unit), `tests/all.sh` (everything, real extension in headless Chrome against a mock AI). Add a unit test for any new pure rule and an e2e check for any new surface. A known flaky one: "Filter button opens the fields" fails on main too (headless timing).

**Shipping.** Draft PR per brief against `main`, keep the version as it is (it changes only at a store upload), update `docs/ux-spec.md` (states table and components), `README.md`, and `store/PRIVACY.md` / `store/LISTING.md` whenever what's read, stored or requested changes. No Chrome Web Store submission until dabloonery says.

---

<!-- merged from briefs/1-saved-search-alerts.md -->

### Brief 1: Alerts on saved searches

Read [the briefs intro](#read-this-before-any-brief) first (ground rules, Vivaldi, copy, tests).

#### Goal

Tell the user, without them watching the panel, when one of their saved searches turns up a listing scored **Great** (or at their price), so Tirekick is useful between shopping sessions.

#### User story

As a buyer with a saved search for "pentax k1000", I want a notification when a new Great listing appears, so I can get to it before someone else does, without re-running the search myself.

#### dabloonery's decision (2026-10-14): build options 1 and 2

The idea as first pitched ("check saved searches in the background") **breaks the ground rules**: Tirekick never opens, crawls or refreshes a store's page by itself, and auto-scan only reads a search tab that's on screen. eBay's and Meta's terms are why. So the agent must not build background polling. Three ways to do this instead, recommended first:

1. **Alert from what you're already looking at (recommended, fully within the rules).** When auto-scan (0.36.0) scores a listing Great on a page that matches a saved search, record it on the saved search and raise an alert: the toolbar badge, Home's "Worth another look", and, if the user turns it on, a browser notification. Useful when a saved search sits open in a tab you glance at, or when you browse a matching search and miss the tag.
2. **"Check my saved searches" button (within the rules, user-started).** One press on Home opens each saved search in a new tab in the foreground window, one after another and spaced like sold lookups, and auto-scan scores each while it's on screen. The user started it and sees every page. Notifications then come from option 1.
3. **Scheduled background checks (outside the rules).** `chrome.alarms` opening hidden tabs or fetching search pages. Not recommended; only with dabloonery's explicit decision to change the ground rules and an understanding of the account risk.

**Decided by dabloonery on 2026-10-14:** build 1 and 2 (the "Check my saved searches" button). Don't build 3; the ground rules stay as they are.

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
- dabloonery has checked a notification in Vivaldi.
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
- Does dabloonery want the "likely to take less" signal to feed the offer helper (brief 3)? Default: yes, as an input.

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
5. **Per-store rules.** Off-site contact and phone numbers are normal on Craigslist (see brief 5). Key the new rules by `site` so a later store can opt out.

#### Files likely touched

`content/rules.js` (price rule, new-account rule, hash distance), `content/panel.js` (hash map in memory, chips, hover card and listing reasons), `content/adapters.js` (Marketplace seller join date and ratings), `background.js` (thumbnail hashing message, if done in the worker), `lib/shared.js` (`isListingImage` already covers the hosts), maybe `offscreen.html` + `"offscreen"` permission if the worker can't decode images (check first; `createImageBitmap` works in MV3 service workers in current Chrome), `tests/unit/rules.test.mjs`, a new `tests/unit/photohash.test.mjs`, fixtures with duplicate thumbnails, `tests/e2e/marketplace.ts`, `store/PRIVACY.md`, `docs/ux-spec.md`.

#### Open questions

- How strict should "far under sold" be? Defaults above; dabloonery may want it softer for fix-up hunting (Reseller mode should probably skip it for "for parts" listings, which it does by excluding them).
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
- **The how-to:** `docs/adding-a-site.md` (step by step, including permissions and tests). Read it in full before starting.
- **The guard test:** `tests/unit/sites.test.mjs` fails until a new site has every field and every per-site map.
- **Sold prices:** eBay's sold listings stay the price reference for every store (`soldReference: false` for the others), paced by `lib/sold.js`.

Note: some places still hard-code the two stores on main (`TKShared.safeUrl`, `itemUrl`, `searchUrl` and `isListingImage` in `lib/shared.js`, `cleanSaved`'s key pattern `^(ebay|fb):` in `options/options.js`). Check whether the port moved them onto the table; if not, do that first, in its own small commit.

#### What OfferUp and Craigslist are like (2026-10-13)

| | OfferUp | Craigslist |
|---|---|---|
| Pages | A React app (offerup.com/search?q=…, /item/detail/<id>); cards load as you scroll and are recycled, like Marketplace | Server-rendered per city (sfbay.craigslist.org/search/sss?query=…, /…/d/<slug>/<id>.html); the newer gallery and list layouts are built with script, the old "result-row" one still appears |
| Reading cards | By the link to /item/detail/ and the text inside it (the Marketplace approach: no class names) | `.cl-search-result` / gallery cards: title link, `.priceinfo`, location; the listing page has `#postingbody` and an attributes block (condition, make, model) |
| Price and shipping | Local pickup mostly; some "Ships" with a shipping price on the listing | Local only; prices are often round, sometimes $0 or $1 as a placeholder |
| Seller | Star rating, number of ratings, "TruYou" verified, join date, response time | None |
| What a scam looks like | Moving to text/email to pay by Zelle, Cash App or gift cards; "shipping only" for a local-looking item; brand-new account with no ratings | "I'm away, I'll ship it", payment before seeing it, fake escrow or overpayment, email relays. Phone numbers and "text me" are normal here, not a sign |

Risks: Both sites' terms limit automated collection. Tirekick would read only pages you are looking at, never fetch from these sites in the background: the same line it holds on eBay and Facebook. OfferUp may show less without signing in, and changes its app often; Craigslist's script-built layouts vary by city and device. Photo checks need their image hosts (images.craigslist.org, OfferUp's CDN) added to the allowed photo hosts.

#### Order and per-store notes

1. **Craigslist.** Stable server-rendered markup (gallery, list, and the old "result-row" layouts), per-city hosts (`*.craigslist.org`). Local only, no seller ratings, placeholder prices ($0, $1) mean no price. Phone numbers and "text me" are normal, so the off-site rule must not fire; "I'm away, I'll ship it", pay-first and fake escrow are the Craigslist scam signs. Needs the user's area for the hub's lookup (remember the last one visited).
2. **OfferUp.** A React app like Marketplace: recycled cards, late-loading prices; read by `/item/detail/` links and visible text, not class names. Seller stars, rating count, "TruYou" verified and join date feed `sellerWarning`. Some "Ships" listings. Needs a long-feed run of `tests/e2e/perf.ts`.
3. **Mercari.** Ships nationally, so compare on total with shipping. Mercari shows its own sold listings: consider it as a second sold reference (`soldReference`), or keep eBay only (open question). Cards have seller ratings.
4. **Poshmark.** Mostly clothing and shoes, a different shopper. Prices are often negotiated via offers; sold listings are visible. Brand-and-size matters more than model numbers, so the prompt's "what I want" and the sold comparison need checking for apparel. Lowest priority; dabloonery to confirm it's wanted.

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
- Which Craigslist areas does dabloonery use? (For fixtures and the hub's default.)
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
- dabloonery has tried it on the live store in Vivaldi (markup changes without notice; fixtures can't prove the live site).

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

**Vivaldi is the risk.** Vivaldi has its own sync (Vivaldi account), and it isn't clear that it carries `chrome.storage.sync` data for extensions. If it doesn't, `storage.sync` silently stays local in Vivaldi. **The agent must check this first** (on dabloonery's Vivaldi, two profiles or two computers signed into the same Vivaldi account) and report before building. If it doesn't work in Vivaldi, the fallback is a **sync file**: export a backup to a folder the user already syncs (Dropbox, Syncthing, a cloud drive) and restore from it, with a one-click "Restore the newest backup from my sync folder" via the File System Access API (`showDirectoryPicker`, permission kept per folder). No server either way.

#### Files likely touched

`lib/shared.js` (`toCsv`, sync merge helpers, settings the sync carries), `options/options.html` + `options/options.js` (buttons, switch, status, size), `content/panel.js` (Saved tab export button; listen to sync changes), `background.js` (sync writer, debounce, `chrome.storage.onChanged` for `sync`), `manifest.json` (none for `storage.sync`, it's covered by `storage`), `tests/unit/shared.test.mjs` (CSV quoting and injection, merge and tombstones), `tests/e2e/features.ts` or `tests/opts.test.js` (export downloads a file with the right rows), `store/PRIVACY.md` (sync goes through the user's browser account; Tirekick runs no server), `docs/ux-spec.md`.

#### Open questions

- Does Vivaldi sync `chrome.storage.sync`? (Must be checked first; decides the design.)
- Sync API keys at all? Default: no, with an opt in.
- Which columns matter most to dabloonery as a reseller? Default list above.
- Export to `.xlsx` too? Default: CSV only; every spreadsheet opens it.

#### How to know it's done

- **Export:** the CSV opens cleanly in a spreadsheet (LibreOffice and Google Sheets), titles with commas, quotes, emoji and a leading `=` come through as text, and every saved listing is a row. Unit tests for `toCsv`.
- **Sync:** with the switch on in two profiles, saving a listing or search on one appears on the other; removing it stays removed; settings follow; keys don't unless opted in; the size shown stays under the limit with 200 saved listings. Off by default, and turning it off stops writes.
- Vivaldi result reported to dabloonery before Part 2 is built, and the chosen route works in Vivaldi.
- Privacy page updated. `tests/all.sh` green.

---

### Brief 7: Built-in browser AI

Read [the briefs intro](#read-this-before-any-brief) first (ground rules, Vivaldi, copy, tests). Decided with dabloonery
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
| Vivaldi | None | dabloonery's browser: Claude or Ollama as now |

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
- dabloonery has tried it in Chrome; in Vivaldi the choice doesn't appear and nothing breaks.

### Brief 8: Price data beyond eBay sold listings

Added 2026-10-15. dabloonery: worth it "if it also makes the product better". Plan only; nothing built.

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
Before building, take 30 real Marketplace listings dabloonery looked at and compare three things: the eBay sold
typical price, the asking-price typical from `listingMemory`, and what dabloonery judges each item is worth. Build
option 1 only if it gives a sensible number for clearly more of them without making the eBay cases worse.

#### Size and files
Small to medium: `content/rules.js` (a pure `askingTypical`, unit tested), `content/panel.js` (chip and
tooltip wording), `lib/shared.js` (nothing new in storage). One PR, light and dark screenshots.

### Brief 9: More browsers

Added 2026-10-15 (dabloonery: platform-agnostic plans belong here). Plan only; nothing built.

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

### Brief 11: Side panel mode

Added 2026-10-15 from an outside UI audit. Idea only, not planned yet. On 1366×768 and 1280×800 laptops the
380px drawer covers one or two columns of listings; Chrome's side panel would sit beside the page instead of over it.

- **What:** an optional "Open in the side panel" setting that shows the same three tabs (Home, This page, Saved) in
  `chrome.sidePanel`, talking to the page script by message for the page's listings and flashing a card.
- **Costs:** a new `sidePanel` permission (needs its reason in `store/LISTING.md` and the security review), and the
  panel's views must run outside the page, which is most of the work.
- **Vivaldi:** it doesn't offer Chrome's side panel API the same way, so the on-page drawer stays the default and
  the fallback everywhere. Check there before building.
- **How to know it's done:** with the setting on, a 1280px-wide eBay search shows every column, the panel's rows
  still flash their cards, and with it off nothing changes.

### Brief 12: Choose what Tirekick shows

Added 2026-10-23. Plan only, nothing built yet; the decisions for dabloonery are at the end. dabloonery's idea
(2026-10-23): some people may want Tirekick for the scam check only, "or something like that". Read
[the briefs intro](#read-this-before-any-brief) first.

#### Goal

Let someone pick how much Tirekick does on a store page, from "just warn me about scams" to everything, in one
choice at the top of settings, without making the scam check easier to lose by accident.

#### What people can turn on and off today

| Setting (`background.js` `DEFAULTS`) | Where | What it does |
|---|---|---|
| `useSoldComps` (on) | Settings, On the page | eBay sold lookups, so every price word and the "Too cheap?" and "Likely scam: typical is…" price marks |
| `autoMarks` (on) | Settings, Filters and marks | All chips on cards before a scan: scam marks, price words, New to you, drops, auctions, lots, seller warnings |
| `showTab` (on) | Settings, On the page | The slim tab on store pages; off, Tirekick loads only from the toolbar icon |
| `autoScan` (off) | Settings and the panel | AI scores new listings as they load |
| AI service (none) | Settings, AI scores | With none chosen the AI parts stay as quiet invitations; nothing turns them off |
| `filterWords`, `minSellerRatings`, `minSellerPct` | Settings, Filters and marks | What gets filtered out, when a seller gets a warning |
| `theme`, `interests`, `feePct`, `monthlyBudget`, `batchSize` | Settings | Look, judging, Reseller fees, spending |
| Buyer / Reseller, Skipped Show / Dim / Hide, sort, filter bar | The panel, per mode | Kept per mode in `modePrefs` |

**A gap found while reading the code.** Turning off `autoMarks` takes every chip off the cards, scam marks
included (`decorate` in `content/panel.js` returns before `chipEls`), but a likely scam is still grayed out
(`fadeParts` with `likelyScam`). So the card goes gray with no reason on it. The panel's rows and the listing page
still show the warning (both call `chipsFor` without checking `autoMarks`). Part 1 below fixes this either way.

#### The proposal: three focuses, plus switches

One choice, **What should Tirekick do?**, as the first section of settings (before On the page), three cards side
by side with the current one outlined:

| Focus | What you see | What stays off |
|---|---|---|
| **Everything** (default, today's behavior) | Scam marks, price words, every other mark, AI parts once an AI is set up | Nothing |
| **Scam check only** | Scam marks on cards (reposted, code in title, off-site contact, same photo, "Too cheap?" and "Likely scam: typical is…", seller warnings, same title), the panel's list, Save and Hide on hover | Price words ("Good price", "Above typical"), New to you, drops, auctions, lots, offers, the offer helper, AI parts |
| **No AI** | Everything that works without the AI | Scan, auto-scan, Analyze's AI verdict, Search ideas, the photo check menu, the quality menu and spending in the footer |

Under the cards, a fold **Choose each part** holds the switches the focuses are made of. Changing one makes the
focus read **Custom**; picking a focus sets the switches again. The switches:

| New setting | Default | Covers |
|---|---|---|
| `markScams` | on | The scam group of chips and the graying of likely scams |
| `markPrices` | on | Price words, "Under typical: reason", "No price check" |
| `markOther` | on | New to you, drops, auctions, lots, offers, "At your $" |
| `useAI` | off (opt-in, dabloonery, 2026-10-23) | Every AI surface listed under No AI. Keys and models stay stored, so turning it back on needs nothing else |
| `markLimit` | 3 | Chips per card: **3** (today) or **1**, the most important one (a scam mark always comes first) |
| `useSoldComps` | on | Unchanged, moved into the fold |

`autoMarks` goes away (see "Storage" below).

#### What stays on for safety

- **No focus turns the scam check off.** Scam check only is the scam check; Everything and No AI keep it too.
- **Turning `markScams` off is its own choice**, with a plain confirm: "Cards won't say when a listing looks like a
  scam. The panel and the listing page still will." Even then the panel's rows and the listing page keep their
  warnings, and the panel's page line counts them ("2 likely scams on this page"). Nothing hides them everywhere.
- **The judging doesn't change.** `content/rules.js` and the prompts run the same in every focus: `likelyScam`,
  `tooCheap`, `priceVerdict` and the eval (`tests/eval/`) give the same answers. A focus only changes what's drawn,
  so the eval numbers stay as they are.
- **Scam check only keeps the eBay sold lookups.** "Too cheap?" and "Likely scam: typical is…" from price are among the
  strongest signs, and they need a typical price. The price itself just isn't shown as a word unless it's a
  warning. Someone who turns `useSoldComps` off in the fold gets a one-line note that price-based scam marks stop too.
- `markLimit` 1 keeps the order `chipsFor` already uses: scam marks first, so the one chip left is the warning.

#### How it maps to the code

- **`content/panel.js` `chipsFor`**: give each chip a group (`scam`, `price`, `other`) as a fourth field, filter by
  the switches, then `slice(0, markLimit)` instead of `slice(0, 3)`. `decorate` drops its `autoMarks` early return;
  `sigOf` and the `storage.onChanged` list (`loadPrefs`) take the new keys so open tabs redraw at once. `fadeParts`
  and `isSkip` follow `markScams` for the graying only.
- **AI off** (`useAI` false): the panel hides the Scan block, the auto-scan switch, Search ideas, Analyze's AI
  button and the footer model menu and spend; Home drops the "add an AI" step. `background.js` skips the "Check this
  photo" menu entry, and its AI handlers in `HANDLERS` (`rankBatch`, `analyzeListing`, `suggestSearches`, `checkPhoto`) refuse with "AI is turned off
  in settings", so nothing reaches a service even from an old tab. `autoScan` is ignored while it's off.
- **Scam check only** also hides the panel's price-only parts: the Typical price button and hover chip stay (they
  feed the scam marks), the offer helper and the margin sort go.
- **`options/`**: the focus cards and the fold in `options.html`; `options.js` works out Everything / Scam check
  only / No AI / Custom from the switches, and the status card says the focus ("Ready: scam check only").
- **`content/rules.js`**: unchanged, apart from a small pure `TKRules.focusOf(settings)` and its opposite
  `TKRules.focusSettings(name)`, so the options page and the panel agree and the mapping has unit tests.
- **Storage**: new keys in `DEFAULTS`, and `TKShared.upgradeStorage` (with `STORAGE_VERSION` 4) turns
  `autoMarks: false` into `markPrices: false, markOther: false, markScams: true` and removes `autoMarks`. Restore
  accepts a backup that still has `autoMarks` and maps it the same way.

#### Order of PRs

1. **Mark groups and the safety fix** (merged 2026-10-23, #113, with the recommended answers below; dabloonery hasn't
   answered the questions one by one, so any of them can still change): the chip groups, the three `mark*` switches, `markLimit`, the storage
   upgrade, the fold in settings (no focus cards yet). Fixture tests that each switch removes only its group, and
   that a likely scam keeps its chip with `markPrices` and `markOther` off.
2. **AI off** (built 2026-10-23; the switch sits at the top of AI scores in settings until PR 3 moves it into the fold): `useAI` and every surface above, with the background refusing AI calls. An e2e check that with it
   off a store page and a listing page make no call to the fake AI server.
3. **Focus cards** (built 2026-10-23): the three cards, Custom, `TKRules.FOCUS` and `focusOf` with unit tests, README
   "Everyday use", `docs/ux-spec.md`. Changed from the plan while building: the third focus is called **Without the
   AI** (a focus named "No AI" reads like a claim about Tirekick, which the wording rule rules out); the switches
   stay in Filters and marks and AI scores, next to what they change, instead of moving into a fold; and with
   price words off the panel's rows drop their free price read and the listing page drops the offer helper, which
   is worked out from the same prices. Store listing copy can name the focuses if dabloonery wants.
4. **AI opt-in** (dabloonery, 2026-10-23: "the ai features should be opt in not opt out"): `useAI` starts off, so a
   new install is on **Without the AI** and nothing reaches an AI service until **Use an AI** is turned on (or
   **Everything, with AI scores** is picked). The storage upgrade to version 5 turns it on for installs that already
   had an AI set up (a key, a chosen service or model), so nobody who opted in loses their scores. The focus cards now
   list Without the AI first; the settings banner, Home's Getting started, the panel welcome, README and site say the
   AI is off until you turn it on.

Small to medium in all. No new permission, nothing new read or sent, so `store/PRIVACY.md` doesn't change.

#### Open questions (for dabloonery)

1. Are the three focuses right: **Everything**, **Scam check only**, **No AI**? (Recommended. A "Prices only"
   focus was left out: hiding scam marks shouldn't be a one-click preset.)
2. People who turned off "Mark cards before you scan": after the upgrade their cards show scam marks again, and
   nothing else. (Recommended, with a one-time note on Home; the other way keeps gray cards with no reason.)
3. Scam check only keeps the eBay sold lookups for the price-based scam marks. (Recommended.)
4. Can scam marks on cards be turned off at all, behind the confirm? (Recommended yes; the panel and listing page
   still warn.)
5. Ask on first run which focus someone wants, or leave it in settings? (Recommended: settings only for now; the
   getting-started steps can link to it.)

#### How to know it's done

- Each focus on the eBay and Marketplace fixtures shows exactly its groups, and switching focus redraws open tabs
  without a reload.
- With No AI, no request reaches the fake AI server from any page or menu.
- A likely scam is never gray without its reason on the card unless `markScams` is off, and then the panel says it.
- `deno task test` green, the eval's numbers unchanged, and dabloonery checks Scam check only in Vivaldi.

### Brief 13: Filters that set the store's own

Added 2026-10-23. dabloonery's direction (2026-10-23): keep Tirekick's filters, and where the store has the same
filter, have Tirekick's set the store's own; also rethink which filters are useful and which are missing. This
replaces item 3 ("Filters. Match the sites' own") in [After real use](#after-real-use-2026-10-16). Read
[the briefs intro](#read-this-before-any-brief) first.

#### Why not copy the stores' filters into Tirekick

A store's filter works on all of its results; Tirekick's can only work on the cards already on the page. A copy of
"Buy It Now only" in Tirekick would hide auctions from 60 cards and leave the next page full of them, and each copy
is one more thing the card readers must get right when a store changes its markup. A store's page address is far
steadier than its markup, and when a store stops honoring a setting, nothing breaks: the results just aren't
narrowed.

#### What's there today, and what each part becomes

| Tirekick filter | The store has it? | Becomes |
|---|---|---|
| Words (`dmg -case`, `a/b`, `"phrase"`) | eBay's search takes `-word`; Marketplace doesn't | Stays Tirekick's own. It also matches the card's text, and putting it into the store's search words would change which saved search the page is |
| $ min to max, shipping included | Both (`_udlo`/`_udhi`; `minPrice`/`maxPrice`), on the item price | **Sets the store's**, and Tirekick still trims by price with shipping, which the stores don't |
| New only (not seen before) | No | Stays Tirekick's own |
| Hide broken / Broken only | eBay's "For parts or not working" condition is close, but sellers file broken things as Used | Stays Tirekick's own (it reads the words) |
| Hide off-topic | No | Stays Tirekick's own |
| Your price ≤ $ | No (it marks, it doesn't filter) | Stays |
| Skips and scams: Show / Dim / Hide | No | Stays; this is what only Tirekick can do |
| Sort (the panel's list) | Both have a sort, which decides which listings load | Stays the list's sort; see open question 2 |
| Words in settings (always filter) | No | Stays |

#### Missing filters, to add as store settings

A row **On eBay** or **On Marketplace** in the Filter box, below the price, with the settings that store has. Each
one changes the page address (the same as using the store's own menu), and the store does the filtering:

| Filter | eBay | Marketplace | Why it helps |
|---|---|---|---|
| Condition: New, Used, For parts | `LH_ItemCondition=1000`, `3000`, `7000` (joined with `\|`) | `itemCondition=new`, `used_like_new,used_good,used_fair` | Asked for most; the stores do it across all results |
| Buy It Now or Auction | `LH_BIN=1` / `LH_Auction=1` | none | An auction's bid isn't a price, so these get no price check and no "Too cheap?" mark |
| Free shipping | `LH_FS=1` | none | Prices compare better when shipping is known |
| Shipping or Pickup | none | `deliveryMethod=shipping` / `local_pick_up` | Pickup means you see it working before you pay |
| Listed in the last day, week, month | none | `daysSinceListed=1`, `7`, `30` | Old listings on Marketplace are often already sold |
| US only | `LH_PrefLoc=1` | none | Listings from abroad, priced in another currency, get no price check today ("No price check") |

And one Tirekick-only filter that's missing: **Hide parts and accessories** for listings Tirekick reads as a game,
case or part for what you searched (`f.accessory` from `TKRules.accessoryOf`, the "No price check" chip). A minimum
price does this crudely now.

Left out on purpose: distance (Marketplace keeps it with the location you set, not in the address in a way we can
confirm), returns accepted, seller ratings as a filter (Tirekick warns instead), and anything a store offers only
after sign-in.

#### How it works

- **Store settings live in the page address.** The Filter box reads them from the address when the page loads, so a
  filter set with the store's own menu shows in Tirekick too, and the other way round. A saved search keeps the
  address (`savedSearches[].url`), so both come back when it's reopened.
- **A change applies when you press Enter or fold the box**, not on each key: Tirekick moves the tab to the same
  search with the new address (`location.assign`), like a click on the store's menu. Never on page load and never by
  itself, so a store that drops a setting can't cause a loop. That keeps to the ground rules: one page you asked for,
  nothing fetched in the background.
- **The price** goes to the store as whole dollars (a minimum rounded down, a maximum rounded up), and Tirekick's own
  shipping-included check runs on the cards as now. A saved filter whose price isn't in the address (an older one,
  or a search typed fresh) applies Tirekick-side only, as today, with a small **Apply on eBay** link.
- **Where the code goes.** Each site in `lib/sites.js` gets a `filters` table: the fields it supports and, for each,
  how to read it from a `URL` and write it to one. Two pure functions, `TKSites.readFilters(url)` and
  `TKSites.withFilters(url, filters)`, are unit tested for every field, round trip and unknown values. The panel
  builds the row from the table, so a new store (Brief 5) only adds its entries.

#### The order of PRs

1. This brief (#120).
2. **Price to the store** (merged, #122): the `filters` table with min and max, the two functions and their tests, reading the
   price from the address, Enter applies, the Apply link. An e2e check on the fake eBay and Marketplace pages that
   the address changes and the fields show it after the reload.
3. **The store row** (merged, #124): condition, Buy It Now or Auction, free shipping, delivery, listed within, US only.
4. **Hide parts and accessories**, a Tirekick-only quick filter (built as **Hide accessories**, this PR).

Small to medium. No new permission, nothing new read or sent, so `store/PRIVACY.md` doesn't change.

#### Open questions (for dabloonery)

1. Are the new store filters the right set (condition, Buy It Now or Auction, free shipping, delivery, listed
   within, US only)? (Recommended; going ahead with these.)
2. Should the panel's "cheapest first" also set the store's sort (eBay `_sop=15`, Marketplace
   `sortBy=price_ascend`), so the cheapest listings are the ones that load? (Recommended: not yet. The store's sort
   menu sits on the page and the saved search keeps it; changing the store's sort from the panel's list sort would
   reload every search you sort.)
3. Distance on Marketplace: worth a look on a real page to see whether the radius shows in the address?
   (Only dabloonery can check; tests never touch the real stores.)

#### How to know it's done

- On the fake eBay and Marketplace pages: each store setting changes the address and nothing else, the Filter box
  shows settings already in an address, and a saved search reopens with them.
- Tirekick's own filters behave as before, and filtered listings are still never sent to a model.
- `deno task test` green, and dabloonery checks on the real stores in Vivaldi that each setting narrows the results.
