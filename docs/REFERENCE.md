# Tirekick reference

How Tirekick sounds, and where the standing reference documents are. Plans and next steps are in
[ROADMAP.md](ROADMAP.md).

## Contents

- [Voice and tone](#voice-and-tone): the guide for any new copy (from the 0.35.0 copy pass)
- [Where the rest lives](#where-the-rest-lives): the store listing, privacy policy, security review and other references

---

## Voice and tone

### Who Tirekick sounds like

A friend who has bought a lot of used stuff and been burned a few times. They walk around the thing
with you, point at what matters, tell you the price is fine or that it smells like a scam, and then
let you decide. They don't hype, don't lecture, and don't pretend to be sure when they aren't.

The current copy is already most of the way there: plain, honest, specific. The rename is a chance to
keep that and add a little warmth and a recognizable name, not to bolt on a personality.

### Four rules

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

### The tire metaphor: a budget

The name carries the metaphor, so the copy mostly shouldn't. Use it in **brand moments only**:

| Use it | Don't |
|---|---|
| Tagline, store summary, welcome title, empty states, the about line | Buttons, labels, errors, settings, hover-card reasons |
| "Kick the tires before you buy." | "Tire-rific deal!", "Let's roll!", "Pump the brakes", "Hit a pothole" |
| At most one tire/garage line per screen | Car puns on listings that aren't cars |

Verbs from the metaphor that read fine in plain copy: *check*, *look over*, *kick the tires*. Use
"kick" as a verb for the action only in the tagline and welcome; buttons stay "Scan" and "Analyze".

### Words we use

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

### Verdicts (unchanged, confirmed)

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

### Stores

More stores are planned, so copy about what Tirekick *is* never depends on eBay and Marketplace:

- Describe the product with store-neutral words: "secondhand marketplaces", "secondhand listings", "the page you're on" (dabloonery, 2026-10-15). Write "secondhand", one word, the US spelling.
- Name the supported stores once, near the end, as the current list: "Works on eBay and Facebook Marketplace." Adding a store then means editing that one line.
- Store names stay where a feature really is store-specific (eBay sold prices, eBay fees, Marketplace scam patterns) and in the privacy page, which must list exactly which sites it reads and contacts, and gets updated with each new store.

### Mechanics

- **US English** everywhere: tire, color, gray, canceled, judgment, recognize, behavior.
- **Sentence case** for everything: buttons, headings, menu items. "Save a backup", not "Save A Backup".
- **Numbers:** dollars as `$40` (no `.00`), percentages `13%`, scores as bare numbers `82`. "1 listing",
  "2 listings".
- **Punctuation:** colons to join a label and its reason. No exclamation marks except in the
  ready-to-send seller message ("Hi!"). Curly quotes in UI. Ellipsis character (…) for progress.
- **Contractions** are fine and friendly: "isn't", "can't", "you've".
- **Second person** for the user ("your price"), no first person for the product ("we", "I"), except
  "What I want", which is the user talking.

### Tone by moment

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

## Where the rest lives

Each of these has one copy. Older drafts that were merged into this file (the 0.35.0 store listing and privacy
drafts, the in-app copy tables, the US English fix list and the rename plan, all done) are in git history
before 2026-10-22.

| What | Where |
|---|---|
| Store listing text, permission reasons, reviewer notes | [`store/LISTING.md`](../store/LISTING.md) |
| Privacy policy (kept in step with `site/privacy.html`) | [`store/PRIVACY.md`](../store/PRIVACY.md) |
| Security and permissions review (re-reviewed at 0.57.0, with the Vivaldi checks) | [`store/SECURITY-REVIEW.md`](../store/SECURITY-REVIEW.md) |
| What to do for each store upload | [ROADMAP.md](ROADMAP.md#chrome-web-store-each-upload) |
| How the extension behaves, state by state | [`ux-spec.md`](ux-spec.md) |
| What each number is made from and how far to trust it | [`accuracy-audit.md`](accuracy-audit.md) |
| Adding a store | [`adding-a-site.md`](adding-a-site.md) |
| Renaming the extension (a checklist from the Second Look → Tirekick rename) | [`renaming.md`](renaming.md) |
| Past design and accessibility rounds (0.20.0 to 0.28.1) | [`archive/`](archive/) |
