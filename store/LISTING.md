# Chrome Web Store listing

Everything the store's forms ask for. Fill in the two `<…>` placeholders, replace screenshots 1 and 2 with real captures (see below), then upload `dist/tirekick-<version>.zip` from `deno task pack`.

## Basics

- **Name:** Tirekick
- **Summary** (132 characters at most; this is the manifest's description, checked by `deno task pack`):
  Score tags, sold-price checks and scam warnings for eBay and Facebook Marketplace, judged by Claude, other AI or a local model.
- **Category:** Shopping
- **Language:** English
- **Privacy policy URL:** the public address of `store/PRIVACY.md` (for example its page on GitHub once it is on the default branch)
- **Homepage URL:** https://github.com/dabloonery/Second-Look (set in the manifest)
- **Support contact:** `<your contact email>`

## Description

Tirekick is for buying second-hand on eBay and Facebook Marketplace. It puts a small score tag on every listing, compares prices with what the same thing actually sold for, flags likely scams, and remembers what you've already seen.

**Free, with no account and no AI**
• Scam marks: the same listing reposted under new codes, a code on the end of the title, and "contact me off the site" tricks
• "% of sold" on every card once sold prices are known, price drops, "new to you", auctions ending soon
• Filter a search the way eBay does (dmg -case -game), by price, or to just the broken ones; save listings and searches
• A Home tab in the panel: saved things that got cheaper, what you've spent, and what you use
• Dock the panel left or right in three widths; Buyer and Reseller modes, each with its own tools

**With a model you choose** (the Claude API, OpenRouter, OpenAI, Gemini, DeepSeek, Mistral, xAI or another OpenAI-style service, or Ollama / LM Studio on your own computer)
• A score and verdict for each listing, one line on the price, and the reasons on hover
• Analyze one listing: red flags, questions to ask the seller, a suggested offer and a ready-to-send message, and a photo check
• Reseller mode for people who repair and resell: the likely fault, difficulty, parts, and the margin after eBay fees
• Better searches: the misspellings sellers make, other model names, tighter or looser words

It works only on pages you're looking at, when you ask. Nothing browses or checks prices in the background. Everything it keeps stays in your browser; the only things sent anywhere go to the AI service you picked, because you pressed a button. Bring your own API key (scans use Claude Haiku 5.5 by default: a scan of 50 listings costs less than a cent).

Not affiliated with or endorsed by eBay or Meta.

## Single purpose

Help people buying second-hand on eBay and Facebook Marketplace judge listings they are viewing: scoring them, comparing prices with recent sales, and warning about likely scams.

## Permission justifications

| Permission | Why |
|---|---|
| `storage` | Keeps the user's settings, saved and hidden listings, the memory of what they've seen, and cached scores, all in this browser. |
| `scripting` | Registers the page script that draws the score tags and the panel on eBay and Facebook pages (and injects it on demand when the "slim tab" setting is off), and reads eBay sold-price results from an open eBay tab when the user is on Facebook. |
| `contextMenus` | Two entries: "Check this photo with Tirekick" on images, and "Open Tirekick home" on the toolbar icon. |
| Host: `https://www.ebay.com/*`, `https://www.facebook.com/*` | The two sites it works on: reading the listings the user is viewing, and fetching eBay sold-listing pages for price comparison. |
| Host: `https://i.ebayimg.com/*`, `https://*.fbcdn.net/*` | Fetching a listing's photo when the user asks for a photo check. |
| Host: `https://api.anthropic.com/*`, `https://openrouter.ai/*`, `https://api.openai.com/*`, `https://generativelanguage.googleapis.com/*`, `https://api.deepseek.com/*`, `https://api.mistral.ai/*`, `https://api.x.ai/*` | The AI services the user can choose. Sent only when the user presses Scan, Analyze, Find better searches or Check photo. |
| Host: `http://localhost:11434/*`, `http://127.0.0.1:11434/*`, `http://localhost:1234/*`, `http://127.0.0.1:1234/*` | Ollama and LM Studio, which run on the user's own computer. |
| Optional hosts: `https://*/*`, `http://*/*` | Only for "another OpenAI-style address". The extension asks the user for permission to one specific address when they press **Test connection** for it; it cannot reach any address the user hasn't approved. |

**Remote code:** none. All code ships in the package; the extension loads no scripts from anywhere and uses no `eval`.

## Privacy practices tab

- **Data collected:** *Website content* (listing titles, card text and photos, sent to the AI service the user chose, only when the user asks) and *Authentication information* (the user's own API key, stored locally and sent only to the service it belongs to).
- **Not collected:** personally identifiable information, health, financial or payment information, location, web history, user activity (the feature counters never leave the browser), personal communications.
- **Certify:** not sold to third parties; not used or transferred for purposes unrelated to the single purpose; not used to determine creditworthiness or for lending.

## Screenshots (1280 × 800, in `store/screenshots/`)

Regenerate with `tests/e2e/run.sh screenshots.ts` (the real extension on test pages).

1. `1-scan.png`: a results page after a scan, with tags on the cards and the panel. *Draft built on a test page, not on eBay: replace it with a real capture of your own search.*
2. `2-listing.png`: analyzing one listing: the verdict, a suggested offer and the price history. *Draft: replace with a real capture.*
3. `3-home.png`: the Home tab in the panel.
4. `4-saved.png`: the Saved view in the panel.
5. `5-settings.png`: settings.

## Notes for the reviewer

Scores and analysis need an API key, which the reviewer is not expected to have. Without one, everything else works: open an eBay search, open the panel (the "Tirekick" tab at the right edge, or Alt+Shift+L), press "Just compare sold prices", try the filter bar, save a listing, and open the Home tab.

## Before you submit

- [ ] A Chrome Web Store developer account (one-time fee)
- [ ] Fill in the two `<your contact email>` placeholders (here and in `store/PRIVACY.md`) and host the privacy policy at a public address
- [ ] Replace screenshots 1 and 2 with real captures
- [ ] `deno task test`, then `deno task pack`; unzip the package into a folder and load it with Load unpacked to check it runs
- [ ] Reread the marketplaces' rules about automated access: the README's last paragraph explains why the extension only acts on pages you are looking at
