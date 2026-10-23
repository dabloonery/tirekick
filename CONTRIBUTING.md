# Contributing to Tirekick

Thanks for helping. Tirekick is a browser extension that puts a price check and scam marks on eBay and Facebook
Marketplace listings. Its core checks work without any AI; an AI the user chooses is optional. Bug reports from real
listings are as valuable as code: a store changes its pages, a scam mark lands on an honest listing, a price is read
wrong. Those are the things the tests can't see.

## Getting set up

There is no build step and no dependencies to install for the extension itself.

1. Clone the repository.
2. In Chrome or Vivaldi open `chrome://extensions` (or `vivaldi://extensions`), turn on **Developer mode**, press
   **Load unpacked** and pick the repository folder.
3. After changing a file, press the reload arrow on Tirekick there and refresh the eBay or Marketplace tab.

[README.md](README.md) explains what each feature does, and **How the pieces fit** says which file does what.
[AGENTS.md](AGENTS.md) is the short version of the conventions below.

## Running the tests

You need Chrome or Chromium, [Deno](https://deno.com) 2, `python3` and `openssl`.

```sh
deno task test              # everything, about 6 minutes
deno task test:unit         # the plain rules and helpers, no browser, a few seconds
tests/e2e/run.sh real.ts    # one end-to-end file against the real extension
deno task eval              # the scam and price checks against labeled listings, with a scorecard
```

Nothing touches the real eBay, Facebook or an AI service. `tests/e2e/server.ts` serves eBay- and Marketplace-shaped
pages at their real addresses (the browser maps the hosts to it) and a fake AI that records every request.
[tests/README.md](tests/README.md) says what each file checks, and what to do when a store changes its markup.

## Making a change

- **One pull request per change**, with `deno task test` green. Say what changed and why, and for anything that
  touches scoring, scam checks or prompts, how it affects real listings (`deno task eval` gives the numbers).
- **Don't change the version** in `manifest.json`. It changes only when a build goes to the Chrome Web Store.
- **A listing that fooled the checks** goes into `tests/eval/cases.mjs` first, labeled, then the rule changes.
- **A store changed its pages?** Read [docs/adding-a-site.md](docs/adding-a-site.md) and the fixture notes in
  `tests/README.md`. Adapters in `content/adapters.js` are layered on purpose, so an old layout keeps working.
- **New permissions** need a reason in `store/LISTING.md` and the security review (`store/SECURITY-REVIEW.md`).
  Any-address host access stays optional, asked for one address at a time.
- **Shared records** (saved items, stats and the rest of `TKShared.SHARED`) change only through
  `send("storeEdit", …)`, never a direct `chrome.storage.local.set`. Storage shape changes go in
  `TKShared.upgradeStorage`.
- **Links** from storage, a backup or a web page go through `TKShared.safeUrl`.
- It must keep working in **Vivaldi** as well as Chrome.

## Ground rules

These keep users' accounts safe, and they aren't negotiable (README, **Ground rules**):

- Only pages the user is looking at. Nothing crawls, refreshes or fetches a store's pages in the background.
- Requests to the stores are few, spaced and started by the user.
- Never get past a bot check, a captcha or a rate limit.
- Nothing leaves the browser except to the AI service the user chose and eBay's own search.
- No background polling for alerts.

## Words and look

- US English everywhere, in code, copy and docs ("tire", "color").
- Follow the voice guide in [docs/REFERENCE.md](docs/REFERENCE.md): the verdict first, then why; "Likely scam",
  never "Scam"; estimates say they're estimates; sentence case.
- Never describe Tirekick as "no AI" or AI-free. The core features work without the AI, and the AI is optional.
- The look is flat Tread Dot, in color; every color, size and shape is a token in `lib/theme.js`.

## Reporting a bug

Open an issue. If the panel offers **Check this page**, paste its report (counts and three public titles, nothing
personal). Please leave out API keys, your address, and other people's names or photos from screenshots.

## How Tirekick is made

The maintainer, dabloonery, writes the basis, meaning who it's for, what it does, and the first version of each feature, rule and
piece of wording, then runs it through Claude, Anthropic's AI model, to make it more accurate and efficient. You're
welcome to use AI tools too. You answer for what you send, so read it, run the tests, and say in the pull request
if an AI wrote a large part of it. The README has the maintainer's note on AI.

## Security

Report a vulnerability privately through the Security tab on GitHub: see [SECURITY.md](SECURITY.md).

## License

Tirekick is under the [Apache License 2.0](LICENSE). By sending a pull request you agree that your contribution is
licensed the same way. Please follow the [code of conduct](CODE_OF_CONDUCT.md).
