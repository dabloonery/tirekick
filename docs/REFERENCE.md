# Tirekick reference

How Tirekick sounds, how the rename was done, and the security review for the store.
Plans and next steps are in [ROADMAP.md](ROADMAP.md).

## Contents

- [Tirekick: voice, tone and copy drafts](#tirekick-voice-tone-and-copy-drafts)
- [Tirekick rename plan](#tirekick-rename-plan)
- [Tirekick: security and permissions review](#tirekick-security-and-permissions-review)

---

<!-- merged from voice-and-copy.md -->

## Tirekick: voice, tone and copy drafts

*Draft, 2026-10-13. Written against `main` at 0.34.0 (commit 48c7e76).* **Status 2026-10-14: shipped.** The copy pass merged as PR #9 in 0.35.0; this section stays as the voice guide for new copy.

Contents:
1. [Voice and tone guide](#1-voice-and-tone-guide)
2. [Store listing](#2-store-listing)
3. [Privacy page](#3-privacy-page)
4. [In-app copy](#4-in-app-copy)
5. [US English fixes found on main](#5-us-english-fixes-found-on-main)

---

### 1. Voice and tone guide

#### Who Tirekick sounds like

A friend who has bought a lot of used stuff and been burned a few times. They walk around the thing
with you, point at what matters, tell you the price is fine or that it smells like a scam, and then
let you decide. They don't hype, don't lecture, and don't pretend to be sure when they aren't.

The current copy is already most of the way there: plain, honest, specific. The rename is a chance to
keep that and add a little warmth and a recognizable name, not to bolt on a personality.

#### Four rules

1. **Say what it found, then why.** "Skip: sold ones go for $40 less." The verdict comes first, the
   reason right after, in the same breath.
2. **Be straight about money and data.** Every cost, every thing sent anywhere, said plainly and before
   it happens. "Costs about 1¢." "Nothing leaves your browser until you press Scan."
   Be straight about the AI too: Tirekick has AI features, so never call it "no AI" or AI-free. Say the
   core features work without the AI and the AI is optional; for one action, "your AI isn't used".
3. **Confident, not certain.** Tirekick judges; it doesn't rule. Scam marks say "Likely scam" or
   "Scam?", never "Scam". Estimates say *est.*
4. **Short and kind under pressure.** Errors say what happened and the one thing to do next. No blame,
   no exclamation marks, no "Oops".

#### The tire metaphor: a budget

The name carries the metaphor, so the copy mostly shouldn't. Use it in **brand moments only**:

| Use it | Don't |
|---|---|
| Tagline, store summary, welcome title, empty states, the about line | Buttons, labels, errors, settings, hover-card reasons |
| "Kick the tires before you buy." | "Tire-rific deal!", "Let's roll!", "Pump the brakes", "Hit a pothole" |
| At most one tire/garage line per screen | Car puns on listings that aren't cars |

Verbs from the metaphor that read fine in plain copy: *check*, *look over*, *kick the tires*. Use
"kick" as a verb for the action only in the tagline and welcome; buttons stay "Scan" and "Analyze".

#### Words we use

| Use | Instead of | Why |
|---|---|---|
| Tirekick (one word, capital T, lowercase k) | TireKick, Tire Kick, tirekick | One name, one spelling. All lowercase only in the domain and ids. |
| listing | item, post, ad | It's what eBay and Marketplace call them. |
| score, verdict | rating, grade | "Score" is the number, "verdict" the word beside it. |
| sold prices | comps, market value | Buyers don't all know "comps". |
| AI, the model | Claude (generic), the bot | Name the service only when it matters (a key, an error from that service). |
| your browser, this browser | locally, client-side | Plain words for where data lives. |
| Scan, Analyze | Run, Process, Evaluate | Existing button verbs; keep them. |
| likely scam, Scam? | fraud, fake (as a verdict) | We're often right but never sure. |

#### Verdicts (unchanged, confirmed)

The five verdicts and their short dot labels stay as they are; they already read in this voice and
match the Tread Dot design:

| Verdict | Dot label | Long label |
|---|---|---|
| great | Great | Great deal |
| good | Good | Worth a look |
| fair | Fair | Fair price |
| pass | Skip | Skip |
| suspicious | Scam? | Likely scam *(was "Suspicious")* |

The one change: the long label for `suspicious` becomes **Likely scam**, so it matches the scam marks
("Likely scam: reposted under new codes") and the dot ("Scam?"). Today the same idea has three names.

#### Stores

More stores are planned, so copy about what Tirekick *is* never depends on eBay and Marketplace:

- Describe the product with store-neutral words: "secondhand marketplaces", "secondhand listings", "the page you're on" (dabloonery, 2026-10-15). Write "secondhand", one word, the US spelling.
- Name the supported stores once, near the end, as the current list: "Works on eBay and Facebook Marketplace." Adding a store then means editing that one line.
- Store names stay where a feature really is store-specific (eBay sold prices, eBay fees, Marketplace scam patterns) and in the privacy page, which must list exactly which sites it reads and contacts, and gets updated with each new store.

#### Mechanics

- **US English** everywhere: tire, color, gray, canceled, judgment, recognize, behavior.
- **Sentence case** for everything: buttons, headings, menu items. "Save a backup", not "Save A Backup".
- **Numbers:** dollars as `$40` (no `.00`), percentages `13%`, scores as bare numbers `82`. "1 listing",
  "2 listings".
- **Punctuation:** colons to join a label and its reason. No exclamation marks except in the
  ready-to-send seller message ("Hi!"). Curly quotes in UI. Ellipsis character (…) for progress.
- **Contractions** are fine and friendly: "isn't", "can't", "you've".
- **Second person** for the user ("your price"), no first person for the product ("we", "I"), except
  "What I want", which is the user talking.

#### Tone by moment

| Moment | Tone | Example |
|---|---|---|
| First run | Warm, quick | "Welcome to Tirekick. Three steps and you're kicking tires." |
| Working | Calm, specific | "Ranking 24 listings with Haiku 5.5…" |
| Good news | Plain, no cheering | "Great deal: $35 under what these sold for." |
| Bad news about a listing | Direct, not alarmed | "Likely scam: the same title is up under three codes." |
| Error | Short, one next step | "Can't reach the Claude API. Check your connection and try again." |
| Money | Exact and early | "Scan 24 listings · about 1¢" |
| Privacy | Matter-of-fact | "Stored only in this browser." |

---

### 2. Store listing

Replaces the copy sections of `store/LISTING.md`. Permission justifications and reviewer notes keep
their substance; only the name changes there (see the table at the end of this section).

**Name:** Tirekick

**Summary** (manifest `description`, 132 characters max; this one is 119):

> Deal scores, price checks and scam warnings for secondhand marketplaces, starting with eBay and Facebook Marketplace.

*Alternative, 129 characters:* "Kick the tires on secondhand listings: deal scores, sold-price checks and scam warnings. Works on eBay and Facebook Marketplace."

Both lead with what Tirekick does and name the stores last, so adding a store only changes the end of the line.

**Description:**

> **Kick the tires before you buy.**
>
> Tirekick looks over secondhand listings with you, on the stores where you shop. It works on eBay and
> Facebook Marketplace today, with more stores to come. Every listing gets a
> small score dot, prices are checked against what the same thing actually sold for, likely scams are
> marked, and it remembers what you've already seen.
>
> **Free, no account, no AI needed**
> • Scam marks: the same listing reposted under new codes, a code tacked onto the title, and "message me off the site" tricks
> • How far below or above the typical price each card is ("$53 below typical", from recent eBay sales) once sold prices are in, plus price drops, "new to you" and auctions ending soon
> • Filter a search the way eBay does (dmg -case -game), by price, or to just the broken ones
> • Save listings and searches; the Home tab shows what got cheaper and what you've spent
> • Dock the panel left or right in three widths; Buyer and Reseller modes, each with its own tools
>
> **Add an AI you choose** (the Claude API, OpenRouter, OpenAI, Gemini, DeepSeek, Mistral, xAI, any OpenAI-style service, or Ollama / LM Studio on your own computer)
> • A score and verdict for every listing, one line on the price, and the reasons on hover
> • Analyze one listing: red flags, questions for the seller, a fair offer and a ready-to-send message, plus a photo check
> • Reseller mode for people who fix and flip: the likely fault, how hard it is, parts, and your margin after eBay fees
> • Better searches: the misspellings sellers make, other model names, tighter or looser words
>
> **It only looks when you do.** Tirekick works on the page in front of you, when you ask. Nothing browses
> or checks prices in the background. Everything it keeps stays in your browser, and the only things
> sent anywhere go to the AI service you picked, because you pressed a button. Bring your own API key:
> a scan of 50 listings with the default model costs less than a cent.
>
> Not affiliated with or endorsed by eBay or Meta.

**Single purpose:** Help people buying secondhand online judge the listings they are viewing on
supported marketplaces (currently eBay and Facebook Marketplace): scoring them, comparing prices with
recent sales, and warning about likely scams.

**Name-only changes elsewhere in LISTING.md:**

| Where | Now | Tirekick |
|---|---|---|
| Intro line | `dist/second-look-<version>.zip` | `dist/tirekick-<version>.zip` |
| `contextMenus` row | "Check this photo with Second Look", "Open Second Look home" | "Check this photo with Tirekick", "Open Tirekick home" |
| Reviewer notes | the "Second Look" tab at the right edge | the "Tirekick" tab at the right edge |
| Homepage URL | github.com/dabloonery/Second-Look | tirekick.app once registered (or the renamed repo) |
| Support contact | support@tirekick.app | works once the domain and mailbox are set up |

---

### 3. Privacy page

Full replacement for `store/PRIVACY.md`. Same facts as today; the opening is tighter and the name changes.

```markdown
# Tirekick: privacy policy

*Last updated: <month> 2026*

Tirekick is a browser extension for people buying secondhand online. It currently works on eBay and
Facebook Marketplace. This page says what it keeps, what it sends, and to whom.

**The short version:** Tirekick has no server and no analytics. The developer receives nothing.
Anything that leaves your computer goes to a service you chose, because you asked it to.

## What stays in your browser

All of this is kept in your browser's extension storage and never sent to the developer:

- **Your settings**, including any API key you paste in. Keys stay in this browser profile; the pages Tirekick works on never see them.
- **Listings and searches you saved, and listings you hid**, with the prices you saw.
- **Listings you've seen** (title, price, when), so it can say "new to you" and show price drops and history. Kept for 90 days.
- **Scores** for listings you scanned or analyzed, kept for 60 days so they come back in other searches and tabs, and **sold-price results**, kept for six hours.
- **Small preferences**: each mode's sort and "what I want", each search's filter, and where the panel sits on each site.
- **A spending estimate** for paid AI, worked out from token counts at list price.
- **Simple counters** of which features you use, shown on the Home tab.

You can clear what you've seen and hidden, and the spending and usage counters, in settings and on the
Home tab. You can remove saved things from the panel, and save or restore a backup file (which never
includes your API keys). Uninstalling Tirekick deletes all of it.

## What leaves your computer, and only when you ask

Tirekick does nothing on a page until you open its panel, press a button, or (for the free marks on
cards) load an eBay or Marketplace page you're already looking at. It never browses, checks prices or
contacts anyone in the background.

| When you… | What is sent | To whom |
|---|---|---|
| Press **Scan**, **Analyze this listing** or **Find better searches** | Listing titles and the text on their cards (price, shipping, seller rating, condition, description), your search words, and the "what I want" and "what you're into" text you wrote | The AI service you picked in settings: the Claude API (api.anthropic.com), OpenRouter, OpenAI, Google Gemini, DeepSeek, Mistral, xAI, an address you entered, or Ollama / LM Studio on your own computer (which keeps it on your computer) |
| Press **Check photo** or right-click a photo | The photo and the listing's title | The same AI service |
| Compare **sold prices** (a button, or as part of a scan) | Your search words, in a request to ebay.com from your browser with your own eBay session, a few an hour at most | eBay |
| Press **Find photo elsewhere** | The photo's web address, opened in a new tab | Google Lens (lens.google.com) |
| Press **Test connection** in settings | Your API key, to check it works | The service you picked |

Your API key goes only to the service it belongs to, the way that service's documentation says to send
it. Photos and listing text sent to an AI service fall under *that service's* privacy policy and terms,
so read the one for the service you pick. Ollama and LM Studio keep everything on your computer
(sold-price lookups still go to eBay, and you can turn those off).

## What Tirekick doesn't do

- Send anything to the developer. There's no account, server, advertising or analytics.
- Sell or share your data, or use it for anything not described here.
- Read pages other than eBay and Facebook Marketplace (and, only when you press **Test connection** for an address you entered, that address).
- Collect payment details or messages.

## Permissions

Each permission and what it's for is listed in `store/LISTING.md`.

## Changes and contact

If this policy changes, the new version will be posted here with a new date.
Questions: **support@tirekick.app**
```

---

### 4. In-app copy

Only strings that change are listed. Anything not here keeps its current wording, which already fits
the voice. `file:line` refers to `main` at 48c7e76.

#### 4.1 Name everywhere (mechanical)

Every visible "Second Look" becomes "Tirekick". The ones a user sees:

| Where | Now | Tirekick |
|---|---|---|
| `manifest.json` name, action title | Second Look | Tirekick |
| Slim tab label, `content/panel.js:668-670` | Second Look | Tirekick |
| Panel wordmark, `content/panel.js:676` | Second *Look* | Tirekick *(styling per the chosen design)* |
| Options title + h1, `options/options.html` | Second Look settings | Tirekick settings |
| Context menu, `background.js:906` | Check this photo with Second Look | Check this photo with Tirekick |
| Context menu, `background.js:910` | Open Second Look home | Open Tirekick home |
| Spend button title, `content/panel.js:757` | What Second Look has spent on paid AI services | What Tirekick has spent on paid AI |
| Card tag a11y label, `content/panel.js:2339` | Second Look: score 82, Great deal. … | Tirekick: score 82, Great deal. … |
| Diagnostics, `content/panel.js:2610` | Second Look 0.34.0 on … | Tirekick 0.34.0 on … |

#### 4.2 Panel

| Where | Now | Tirekick |
|---|---|---|
| Welcome title, `panel.js:697` | Welcome to Second Look | Welcome to Tirekick |
| Welcome step 3, `panel.js:703` | Press Scan and every listing gets a score and a reason. | Press Scan and every listing gets a score and a reason. *(keep)* |
| Welcome tip, `panel.js:705` | No key yet? The free marks still work: hover a card for scam checks, *Save* and *Sold* prices. | No key yet? The free marks already work: hover a card for scam checks, *Save* and *Sold* prices. |
| Setup title, `panel.js:708` | Add a Claude API key to start. | Add an AI to start scoring. |
| Setup text, `panel.js:708` | It takes a minute at console.anthropic.com. Or pick another AI service, or Ollama on your computer, in settings. | A Claude API key takes a minute at console.anthropic.com. Or pick another service, or Ollama on your own computer, in settings. |
| Not-a-listing page, `panel.js:695` | Nothing to scan on this page. Open a search, a category or a listing; your saved listings and searches are under Saved. | Nothing to look over here. Open a search, a category or a listing. Your saved listings and searches are under Saved. |
| Browse note, `panel.js:715` | No search on this page: Second Look goes by what you're into… | No search on this page, so Tirekick goes by what you're into… |
| Buyer hint, `panel.js:1303` | Find a good one to keep: fair prices, honest sellers, no scams. Broken and untested ones score low. | *(keep)* |
| Reseller hint, `panel.js:1311` | Find ones worth fixing and selling: … Broken and untested ones are welcome. | *(keep)* |
| Stop button title, `panel.js:725` | …requests under way are cancelled | …requests under way are canceled |
| Saved empty, `panel.js:2034` | Hover any card and press Save to keep it here, or save a search from the actions under the Scan button. Both sites, kept in this browser. Prices update whenever the listing is on your screen again. | Nothing saved yet. Hover any card and press Save, or save a search from under the Scan button. Prices update whenever a saved listing is on your screen again. |
| Ideas empty, `panel.js:3847` | No ideas this time. Try describing what you want. | No new searches this time. Try saying more about what you want. |
| Nothing spent, `panel.js:1204` | Nothing spent on paid AI this month. | *(keep)* |
| Model status, `panel.js:1149` | Using Opus 5.5 from now on. Scores already made by another model stay until you scan again. | *(keep)* |

#### 4.3 Score dots and hover cards ("stickers")

| Where | Now | Tirekick |
|---|---|---|
| Long verdict, `panel.js:21` | Suspicious | Likely scam |
| Scam line, `panel.js:2459` | Likely scam: code M2465 on the title (a scan can clear it if it's the model number) | Likely scam: code M2465 tacked on the title. A scan clears it if that's the model number. |
| Hover reason, `panel.js:2354` | The title ends in the code M2465: on Marketplace that's usually a bulk-posted fake, unless it's the real model number. | *(keep)* |
| Hover reason, `panel.js:2352` | Not what you searched for, scored on the deal alone. | *(keep)* |
| Estimate line, `panel.js:2359` | Typical used price est. $40–$60: the model's estimate, not sales data. | *(keep)* |
| Save button title, `panel.js:1886` | Keep it under Saved in the panel | Save it to look at later |
| Hide button title, `panel.js:1879` | Hide this listing everywhere (undo from the panel) | Hide this listing everywhere (undo it under Saved) |
| Photo check title, `panel.js:2515` | Ask the model to look at the photo (changes the score) | Have the AI look at the photo (can change the score) |
| Not on page, `panel.js:2543` | That listing isn't on this page any more (scrolled away or the page changed). | That listing isn't on the page anymore. It scrolled away or the page changed. |

#### 4.4 Settings page

| Where | Now | Tirekick |
|---|---|---|
| Top line | Changes save as you make them and apply to open eBay and Facebook tabs straight away. | *(keep)* |
| Judging intro | Where the judging runs: … (private, free). Listing titles and card text go to whichever you choose. | *(keep)* |
| What you're into help | Every judgement takes it into account. … | Every judgment takes it into account. … |
| Slim tab help | …turn this off: Second Look then loads only when you click its toolbar icon. … | …turn this off and Tirekick loads only when you click its toolbar icon. … |
| Backup help | Everything Second Look keeps lives only in this browser. … | Everything Tirekick keeps lives only in this browser. … |
| Match theme help | Match follows your browser, and is dark if it does not say. | Match follows your browser, or dark if it doesn't say. |

#### 4.5 Errors (`background.js`, `panel.js`)

Today's errors are already good: one cause, one next step. Changes are the name, US spelling, and
evening out a few that don't give a next step.

| Where | Now | Tirekick |
|---|---|---|
| Stale page, `panel.js:47` | Second Look was updated. Reload this page to keep using it. | Tirekick was updated. Reload this page to keep using it. |
| Origin not allowed, `background.js:75`, `:226` | Second Look isn't allowed to reach … yet. In settings, press Test connection to allow it. | Tirekick isn't allowed to reach … yet. In settings, press Test connection to allow it. |
| No key, `background.js:123` | No Claude API key yet. Open the extension options and paste one in. | No Claude API key yet. Paste one in Tirekick's settings. |
| Bad key, `background.js:166` | The Claude API key was rejected. Check it in the extension options. | The Claude API didn't accept that key. Check it in settings. |
| Rate limit, `background.js:167` | Claude API rate limit hit. Wait a moment and scan again. | The Claude API needs a short break. Wait a moment and scan again. |
| Unknown model, `background.js:171` | Claude doesn't recognise the model "…" | Claude doesn't recognize the model "…" |
| Declined, `background.js:177` | Claude declined this request. | Claude declined this request. Try again, or switch models in the panel. |
| Unreadable answer, `background.js:461` | The model returned something unreadable. Try again, or lower "…" | The AI's answer didn't make sense. Try again, or lower "…" |
| No listings, `panel.js:3253` | No listings found on this page. Scroll so results load, or the site layout may have changed (README: When it breaks). | No listings found on this page. Scroll so results load. If they're there, the site's layout may have changed (README: When it breaks). |
| Can't read listing, `panel.js:3707` | Couldn't read this listing. Let it finish loading and try again, or the layout may have changed (README: When it breaks). | *(keep)* |
| Photo too large, `background.js:717` | That photo is too large to check (over 3.5 MB). | *(keep)* |
| eBay check pause, `panel.js:2660` | Price lookups paused 12 min (eBay asked for a browser check). | *(keep)* |

---

### 5. US English fixes found on main

User-visible, fix with the rename:

- `options/options.html:233` "judgement" → "judgment"
- `background.js:171` "recognise" → "recognize"
- `content/panel.js:725` "cancelled" → "canceled"
- `README.md`: "greyed/greying" (lines 76, 78, 81, 87, 102, 154) → "grayed/graying"; "recognised" (146) → "recognized"; "cancelled" (233) → "canceled"; "colour/colours" (260, 264) → "color/colors"; "behaviour" (350) → "behavior"

Code comments only (not user-visible, nice to fix in the same pass): "colours" in `content/panel.js`
(13, 14, 116, 123, 436, 546, 1426, 1447), `lib/shared.js:135`, `tests/README.md:25`; "greyed" in
`content/panel.js:1336`.

---

<!-- merged from rename-plan.md -->

## Tirekick rename plan

**Status 2026-10-14: done.** Shipped as PR #7 in 0.35.0. Still open: renaming the GitHub repo (dabloonery), then pointing `homepage_url` and links at the new address.

Name-only plan for turning "Second Look" into **Tirekick**. Nothing here changes the look: colors, fonts, the icon and the wordmark styling wait for the approved design. No code has been changed or pushed.

Source: `github.com/dabloonery/Second-Look`, `main` at `48c7e76` (version 0.34.0), checked 2026-10-13. The old `/mnt/project-files/SecondLook` copy is a 0.21 snapshot and was not used.

### Decisions to confirm

These are my defaults. Each is easy to change before the rename PR is written.

| Question | Default | Why |
| --- | --- | --- |
| Spelling in prose | **Tirekick** (one word, capital T only) | Matches the trademark search and the domain. |
| Kebab id prefix | `second-look-` → `tirekick-` | Readable, unique on eBay and Facebook pages. |
| Short prefix | `sl-` / `--sl-` / `data-sl-` → `tk-` / `--tk-` / `data-tk-` | Same length, so no layout or line-length churn. |
| JS globals | `SecondLook` → `Tirekick`; `SLShared`/`SLRules`/`SLHome` → `TKShared`/`TKRules`/`TKHome` | Keeps the existing pattern. |
| Version bump | 0.34.0 → **0.35.0** | A visible product change; minor bump like earlier releases. |
| Tagline | "Kick the tires before you buy." | Already agreed in the naming work. |
| GitHub repo | Rename `Second-Look` → `Tirekick` **after** the PR merges | GitHub redirects the old URL, so nothing breaks in the meantime. |

### 1. What users see (copy)

| File | Where | Now | Proposed |
| --- | --- | --- | --- |
| `manifest.json:3` | `name` | Second Look | Tirekick |
| `manifest.json:7` | `homepage_url` | `https://github.com/dabloonery/Second-Look` | `https://github.com/dabloonery/Tirekick` (after repo rename) or `https://tirekick.app` once it exists |
| `manifest.json:48` | toolbar tooltip | Second Look: open or hide the panel | Tirekick: open or hide the panel |
| `manifest.json:61` | keyboard command | Open or tuck away the Second Look panel | Open or tuck away the Tirekick panel |
| `manifest.json` | `description` | (no name in it) | Optionally fold in the tagline |
| `content/panel.js:47` | stale-page message | Second Look was updated… | Tirekick was updated… |
| `content/panel.js:668-672` | side tab label, tooltip, panel `aria-label` | Second Look / Open Second Look | Tirekick / Open Tirekick |
| `content/panel.js:676` | wordmark | `Second <em>Look</em>` | `Tirekick` (styling waits for the design; the two-part italic trick no longer applies) |
| `content/panel.js:697` | welcome | Welcome to Second Look | Welcome to Tirekick |
| `content/panel.js:715` | browse note | Second Look goes by… | Tirekick goes by… |
| `content/panel.js:757` | spend button tooltip | What Second Look has spent… | What Tirekick has spent… |
| `content/panel.js:891` | tab `aria-label` | Tuck Second Look away / Open Second Look | Tuck Tirekick away / Open Tirekick |
| `content/panel.js:2339` | sticker `aria-label` | Second Look: score… | Tirekick: score… |
| `content/panel.js:2610` | diagnostics line | Second Look 0.34.0 on… | Tirekick 0.35.0 on… |
| `options/options.html:6` | page title | Second Look settings | Tirekick settings |
| `options/options.html:109` | h1 wordmark | `Second <em>Look</em><small>settings</small>` | `Tirekick<small>settings</small>` |
| `options/options.html:281, 288` | hints | …Second Look… | …Tirekick… |
| `options/options.js:148, 302, 327` | confirm and error text | …Second Look… | …Tirekick… |
| `options/options.js:401, 403` | restore error | That file isn't a Second Look backup. | That file isn't a Tirekick backup. (see migration A) |
| `background.js:75, 226` | permission errors | Second Look isn't allowed to reach… | Tirekick isn't allowed to reach… |
| `background.js:906` | image context menu | Check this photo with Second Look | Check this photo with Tirekick |
| `background.js:910` | toolbar context menu | Open Second Look home | Open Tirekick home |
| `background.js:231` | OpenRouter `X-Title` header | Second Look | Tirekick (shows on the user's OpenRouter activity page) |
| `background.js:967` comment and the "doesn't work here" badge flow | — | Check the badge text has no name; it does not today. |

Wording that leaned on "look" and may read oddly now (my call is to keep all three, flag only):
- Verdict label "Worth a look" (`content/panel.js`, `VERDICT.good`). Still natural; keep.
- "Secondhand" in the store copy is unrelated to the name; keep.
- Console prefixes `[Second Look]` (`background.js:902, 945, 1061`, `content/panel.js:73, 2760`) become `[Tirekick]`.

### 2. Internal ids (no user sees these, but they must change together)

| Kind | Now | Proposed | Files |
| --- | --- | --- | --- |
| Panel host element | `#second-look-host` | `#tirekick-host` | `content/panel.js:107`, ~15 test files |
| Page stylesheet | `#second-look-styles` | `#tirekick-styles` | `content/panel.js:1453-1458` |
| Photo toast | `#second-look-toast` | `#tirekick-toast` | `content/panel.js:3754` |
| Card sticker / chips | `.second-look-sticker`, `.second-look-marks` | `.tirekick-sticker`, `.tirekick-marks` | `content/panel.js` (~60), `content/adapters.js:284`, tests |
| Flash highlight | `.second-look-flash` | `.tirekick-flash` | `content/panel.js:1543, 2551-2554` |
| Card attributes | `data-second-look`, `data-second-look-key`, `data-second-look-pos` (+ `dataset.secondLookKey/Pos`) | `data-tirekick`, `data-tirekick-key`, `data-tirekick-pos` (`dataset.tirekickKey/Pos`) | `content/panel.js` |
| Short attributes | `data-sl-cell/faded/has/hide/lift/showhidden/sig/skip/theme/v` (+ `dataset.sl*`) | `data-tk-*` | `content/panel.js`, `content/adapters.js` |
| Short classes | `sl-score/chip/compact/x/pop/acts/under/right/…` (about 35 names) | `tk-*` | `content/panel.js` |
| Page CSS variables | `--sl-paper/ink/rule/muted/line/accent/on-accent/on-v/shadow/fit` | `--tk-*` (or semantic names, if the design work moves to one token file) | `content/panel.js` |
| Keyframes | `sl-flash` | `tk-flash` | `content/panel.js` |
| Window events | `second-look-show`, `second-look-toggle` | `tirekick-show`, `tirekick-toggle` | `content/panel.js:1962, 3909, 3975`, `background.js:1006, 1040`, `tests/e2e/features.ts` |
| Runtime message | `second-look-check-photo` | `tirekick-check-photo` | `content/panel.js:3802`, `background.js:1059` |
| Injection guard | `window.__secondLookPanel` | `window.__tirekickPanel` | `content/panel.js:10-11, 3976`, `background.js:959` |
| Adapters global | `window.SecondLook` (local alias `SL`) | `window.Tirekick` (alias `TK`) | `content/adapters.js:10`, `content/panel.js:6`, `background.js:1005, 1039`, `tests/helpers/load.mjs`, `tests/offsite.test.mjs`, `tests/e2e/adapters.ts`, HTML fixtures under `tests/` |
| Other globals | `SLShared`, `SLRules`, `SLHome` | `TKShared`, `TKRules`, `TKHome` | `lib/shared.js`, `content/rules.js`, `content/home.js`, `content/panel.js`, `options/options.js`, `background.js`, `tests/helpers/load.mjs` |
| Context menu ids | `second-look-photo`, `second-look-home` | `tirekick-photo`, `tirekick-home` | `background.js:884-885` |
| Registered content script | `second-look-auto` | `tirekick-auto` | `background.js:919` (see migration B) |
| Font alias | `"SL Fraunces"` | `"TK Fraunces"`, or drop it if the design replaces Fraunces (Tread Dot uses Bricolage Grotesque) | `content/panel.js:62-64, 131, 1477, 1480, 1540`, `options/options.html:10-17` |
| Backup marker | `app: "second-look"` | `app: "tirekick"` | `options/options.js:381, 403` (see migration A) |
| Backup file name | `second-look-backup-YYYY-MM-DD.json` | `tirekick-backup-YYYY-MM-DD.json` | `options/options.js:385` |
| Release zip | `dist/second-look-<version>.zip` | `dist/tirekick-<version>.zip` | `scripts/pack.mjs:1, 110`, `store/LISTING.md:3` |

Not affected: `chrome.storage` keys (`usage`, `spend`, `rankRate`, settings, saved items) carry no name, so no stored data needs renaming.

### 3. Docs, store and tests

- `README.md`: title and about 8 mentions (lines 1, 19, 54, 73, 114, 251, 318). Add the tagline under the title.
- `store/LISTING.md`: name, homepage URL, description, the `contextMenus` justification (line 47, must quote the new menu titles exactly), reviewer notes (line 74), zip name.
- `store/PRIVACY.md`: title and two mentions. Its URL changes if the repo is renamed; the listing's privacy link must follow.
- `fonts/LICENSE.md:1`: "bundled with Second Look" → "bundled with Tirekick".
- File-header comments: `background.js:1`, `lib/shared.js:1`, `content/rules.js:1`, `content/adapters.js:1`, `content/home.js:1`, `content/panel.js:1`.
- Tests: every `second-look-host`, `.second-look-sticker/marks`, `SecondLook.*` and event name in `tests/` (about 60 hits across `tests/e2e/*.ts`, `tests/a11y.test.js`, `tests/offsite.test.mjs`, `tests/helpers/load.mjs`, fixtures under `tests/sch`, `tests/itm`, `tests/marketplace`). Fixture page titles "Second Look browser fixture" → "Tirekick…".
- `docs/candidates.md`, `docs/ui-audit.md`: historical notes; leave as they are.
- Store screenshots: retake after the design lands, not for the rename alone.

### 4. Migration concerns

**A. Old backups must still restore.** Every backup saved so far says `app: "second-look"`, and restore rejects anything else (`options/options.js:403`). New backups write `app: "tirekick"`; restore accepts both:

```js
const BACKUP_APPS = ["tirekick", "second-look"]; // second-look: backups made before the rename
if (!BACKUP_APPS.includes(data?.app)) return note("That file isn't a Tirekick backup.");
```

Keep the existing test in `tests/e2e/features.ts:229` (it restores an `app: "second-look"`, version 0.20.0 file) as the legacy case and add one for a `tirekick` file.

**B. The old registered content script.** With "Show a slim tab" on, Chrome keeps a registered script with id `second-look-auto` across updates (`persistAcrossSessions: true`). After the update, the new code would register `tirekick-auto` too, and both would inject the same files on every eBay and Facebook page. `doSyncAutoScripts` should unregister `second-look-auto` if it is there, on install/update and on startup:

```js
const OLD_AUTO_IDS = ["second-look-auto"];
const old = await chrome.scripting.getRegisteredContentScripts({ ids: OLD_AUTO_IDS });
if (old.length) await chrome.scripting.unregisterContentScripts({ ids: old.map((s) => s.id) });
```

**C. Pages left open across the update.** A tab opened before the update still holds the old panel (`#second-look-host`, `#second-look-styles`, stickers with `.second-look-*` classes, `data-second-look*` and `data-sl-*` attributes, `html[data-sl-theme]`). Today a re-injection is blocked by `__secondLookPanel`, which the renamed code no longer checks, so the user would see two tabs and two sets of stickers. On start, the new panel should remove the leftovers once:
- `#second-look-host`, `#second-look-styles`, `#second-look-toast`
- `.second-look-sticker`, `.second-look-marks`
- `data-second-look`, `data-second-look-key`, `data-second-look-pos`, and the `data-sl-*` attributes (restoring `position` where `data-second-look-pos` was set, as `undecorate` does at `content/panel.js:1759-1761`)
- `data-sl-theme` on `<html>`

The old script's own guard (`alive()`) already stops it doing anything once the extension is updated, so only its DOM needs cleaning.

**D. Context menus.** No work needed: `onInstalled` already calls `chrome.contextMenus.removeAll()` before creating the menus (`background.js:903`), so the old `second-look-*` menu ids are cleared on update.

**E. Local unpacked install (dabloonery's machine).** An unpacked extension's id comes from its folder path. Renaming the local folder (`Second-Look` in your home folder) or re-cloning under a new name gives Chrome a new id, and the saved listings, searches, settings and API keys stay behind with the old id. Before renaming the folder: make a backup in Settings, then restore it into the new install (which migration A makes possible). Renaming the GitHub repo alone does not move the local folder.

**F. Chrome Web Store.** Not submitted yet (placeholders in `store/LISTING.md`), so the rename is free there. Once published, the name can still change, but the id cannot.

**G. Things that are out of scope here.** The icon (magnifier on a dark square), the wordmark styling, colors, fonts and the `--sl-*` token values are design work. The rename should not touch them beyond the prefix change, so the design PR stays reviewable on its own.

### 5. Suggested order

1. Confirm the defaults above.
2. Rename PR (copy + ids + migrations A to C + tests), version 0.35.0. Run `deno task test`, including the old-backup restore and a page left open across a reload.
3. Rename the GitHub repo to `Tirekick`; update `homepage_url`, `README` and store links.
4. Design PR on top (Tread Dot direction, once approved): wordmark, icon, tokens, fonts, screenshots.

Steps 2 and 4 can be combined into one PR if you would rather ship one release, but separate PRs keep the rename easy to check.

---

<!-- merged from store-prep/SECURITY-REVIEW.md -->

## Tirekick: security and permissions review

*2026-10-14, against `main` at 0.35.0 (commit 381f758). Review only: no extension code was changed.* Status as of 0.37.0: no blockers; L1 is done.

**Verdict: nothing blocks submission.** No remote code, no `eval`, no web-accessible resources, no
`externally_connectable`, and every network destination is either declared or approved by the user one
address at a time. The package builds clean (`node scripts/pack.mjs`: 16 files, 269 KB, no tests or
source maps). Two items are worth knowing before review starts (M1, M2); the rest are small hardening
ideas for a later release.

### What was checked

| Area | Result | Where |
|---|---|---|
| Remote code | None. Every script ships in the package; no `eval`, `new Function`, CDN scripts or remote fonts. | whole package |
| Exposure to web pages | No `web_accessible_resources`, no `externally_connectable`. Fonts reach pages as bytes over messaging, so a page can't detect the extension through them. | `manifest.json`, `background.js:812` |
| API keys | Kept in `chrome.storage.local`. The settings the page script gets have both keys stripped. Keys go only to their own service, and only from the background worker or the settings page. | `background.js:824` |
| Rendering page and AI text | The panel builds elements with `textContent` (the `h()` helper). The three `innerHTML` uses are static CSS or fixed words and numbers. | `content/panel.js:85`, `:143`, `:3017`, `:3756` |
| Links to stored addresses | Saved listings and searches (which a restored backup can fill) only become links when they point at `https://www.ebay.com` or `https://www.facebook.com`; anything else falls back to a rebuilt address. | `lib/shared.js:10` |
| Photos sent to AI | Only eBay and Facebook image hosts or inline `data:` images, checked again after redirects, capped at 3.5 MB. A listing can't make the extension fetch a local or internal address. | `background.js:707` |
| Photo fingerprints (0.38.0) | `photoHashes` fetches only eBay and Facebook image hosts (`TKShared.isListingImage`, checked again after redirects), without cookies, at most 8 per message and 6 every 0.6 s from the panel, only cards scrolled into view, under 3 MB. The picture is shrunk to 9×8 gray pixels and only a 16-hex-digit hash is kept. | `background.js`, `photoHashes` |
| Sold-price fetches | Only `https://www.ebay.com/sch/i.html?...LH_Sold=1` is fetched; anything else is refused. | `background.js:766` |
| Opening tabs | Only eBay search or browse pages and Marketplace pages, at most 12. | `background.js:833` |
| Custom AI addresses | Each one needs the user's OK through `chrome.permissions.request` before any request goes out; a restored backup can't skip that. | `options/options.js:21`, `background.js:74`, `:225` |
| Background activity | None. Page scripts load on eBay and Facebook (or only on click, with the slim tab off). Nothing runs on a timer. | `background.js:931` |

### Permissions as users will see them

At install Chrome will say Tirekick can **read and change your data on www.ebay.com, www.facebook.com**
and the listed AI services. Localhost addresses (Ollama, LM Studio) don't add a separate warning. The
optional `https://*/*` and `http://*/*` show nothing at install; they come up only when someone tests a
custom address.

Every permission is used, and none can be dropped without losing a feature:

| Permission | Used by |
|---|---|
| `storage` | settings, saved items, seen-listing memory, score cache |
| `scripting` | registering the page script on eBay and Facebook, injecting it on click, reading sold results through an open eBay tab |
| `contextMenus` | "Check this photo", "Look up …" and "Open Tirekick in a tab" |
| eBay, Facebook, image CDNs | the two sites it works on, and photo checks |
| AI service hosts | the services a user can pick in settings |
| localhost `:11434`, `:1234` | Ollama and LM Studio |
| optional `https://*/*`, `http://*/*` | "another OpenAI-style address" only |

`tabs` is not requested and not needed: `chrome.tabs.query({ url })` works on eBay because the host
permission covers it.

### Findings

#### M1. The optional "any address" permission will likely send the item to a slower, closer review

`optional_host_permissions: ["https://*/*", "http://*/*"]` is the right design (nothing granted until the
user approves one address), but the store's review flags broad host patterns even when optional. Expect
a longer first review and possibly a question about it.

**Recommendation:** keep it. The justification and reviewer note in `store/LISTING.md` already explain
it. If the first review stalls on it, a fallback is to ship 1.0 without the custom-address option and
add it back in an update.

#### M2. The page script loads on all of www.facebook.com, not only Marketplace

Facebook is a single-page app, so the script has to be present before someone navigates into
Marketplace. It only reads anything when the address starts with `/marketplace` (`content/adapters.js:424`),
but the privacy page says Tirekick doesn't "read pages other than eBay and Facebook Marketplace". That is
accurate about reading, but a reviewer comparing it with the install warning may ask.

**Recommendation:** one sentence in the privacy policy and the reviewer note: "Tirekick's page script is
present on facebook.com so it can follow you into Marketplace, but it only reads Marketplace pages."
The draft site's privacy page already says this.

#### L1. Three panel links use page-supplied addresses without the stored-address check

`content/panel.js:2473`, `:2512` (listing links built from the page's own anchors) and `:2725` (sold
listings parsed from eBay's results) put the address straight into `href`. A `javascript:` address
there would run in the web page's own context, not the extension's, so the worst case equals the page
attacking itself.

**Recommendation (later, low priority):** wrap them in `TKShared.safeUrl(...)` like the saved-item
links, for consistency. One-line change each. **Done in 0.37.0:** the row's Open link and the sold-sales lists in the panel and the hub go through `TKShared.safeUrl`.

#### L2. A web page can open or close the panel

The panel listens for `tirekick-show` and `tirekick-toggle` events on `window` (`content/panel.js:1961`,
`:3908`), which the page's own scripts can also dispatch. That only opens, closes or switches the panel
to Home; it can't start a paid scan or read anything. **No change needed.**

#### L3. Paid AI requests are limited by the budget, not by who asks

The background worker accepts requests from any of the extension's own contexts (no other extension or
site can reach it). A page can't trigger a scan, so the realistic risk is only the user's own
clicks. The monthly budget setting already caps spending. **No change needed.**

#### L4. API keys are stored unencrypted in extension storage

This is normal for extensions that take a user's key: web pages can't read extension storage, and
encrypting it inside the extension wouldn't add protection because the key to decrypt would sit beside
it. The privacy page says keys stay in the browser profile. **No change needed.**

### Housekeeping before submission (not security)

- `homepage_url` points at `github.com/dabloonery/Second-Look`. Update it to `https://tirekick.app`
  once the domain is live (or to the renamed repo).
- The privacy policy and listing use support@tirekick.app, which works once dabloonery sets up the domain and mailbox.
- The 128 px icon is a full-bleed navy tile. The store's guidelines suggest 96 px of artwork inside
  16 px of transparent padding for the store tile; the current one is acceptable but will look a little
  larger than neighbors in search results.

### Vivaldi and other Chromium browsers

dabloonery uses Vivaldi day to day. Tirekick should behave the same there, because it only uses the standard
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
| The toolbar popup, and "Open Tirekick in a tab" on the icon's right-click menu | The popup is set per tab (the panel clears it on store pages, `panelTab`), and the menu entry uses the `action` context, both of which depend on how Vivaldi draws extension icons | Click the icon on a non-store page: a popup? On eBay: the panel? Right-click the icon and look for the entry |
| "Check this photo with Tirekick" | Standard page right-click menu | Right-click a listing photo on eBay |

This part wasn't tested in Vivaldi here; the automated tests run in Chromium. dabloonery's daily use of the
unpacked build already covers most of it. The checklist has a step to repeat these checks on the store
build.

### Not covered

The full test suite (`deno task test`) wasn't run here because Deno isn't installed in this
environment, and nothing in the extension changed. Run it before packing the build you upload.
