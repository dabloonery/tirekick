# Second Look: privacy policy

*Last updated: October 2026*

Second Look is a browser extension for people buying second-hand on eBay and Facebook Marketplace. This page says
what it keeps, what it sends, and to whom. The short version: **it has no server and no analytics, the developer receives
nothing, and anything that leaves your computer goes to a service you chose, because you asked for it.**

## What stays on your computer

Everything below is stored in your browser's extension storage and never sent to the developer:

- **Your settings**, including any API key you paste in. Keys are kept only in this browser profile. The pages the extension works on never receive them.
- **Listings you saved, searches you saved, and listings you marked "Not interested"**, with the prices you saw.
- **A memory of listings you've seen** (titles, prices, when) so it can say "new to you" and show price drops and history. Kept for 90 days.
- **Scores** for listings you scanned or analyzed (kept with the listing for 60 days, so they come back in other searches and tabs), and **sold-price results**, cached for six hours.
- **Small preferences**: each mode's sort and "what I want", the filter you set for each search, and where the panel sits on each site.
- **A spending estimate** for paid AI, from token counts at list price.
- **Plain counters** of which features you use (scans, saves and so on), shown on the Home tab.

You can clear the seen and hidden memory and the spending and usage counters in the extension's settings and on the Home tab, remove saved
things from the panel, and save a backup file or restore one (never including your API keys). Uninstalling the extension removes all of it.

## What leaves your computer, and only when you ask

Second Look does nothing on a page until you open its panel, press a button, or (for the free marks on cards) load an eBay or Marketplace
page you are already looking at. It never browses, checks prices, or contacts anyone in the background.

| When you… | What is sent | To whom |
|---|---|---|
| Press **Scan**, **Analyze this listing** or **Find better searches** | Listing titles and the text visible on their cards (price, shipping, seller rating, condition, listing description), the search words, and the "what I want" and "what you're into" text you wrote | The AI service you picked in settings: the Claude API (api.anthropic.com), OpenRouter, OpenAI, Google Gemini, DeepSeek, Mistral, xAI, an address you entered, or Ollama / LM Studio on your own computer (which stay on your computer) |
| Press **Check photo** or right-click a photo | The photo, and the listing's title | The same AI service |
| Compare **sold prices** (a button, or as part of a scan) | The search words, in a request to ebay.com made from your browser with your own eBay session, at most a few an hour | eBay |
| Press **Find photo elsewhere** | The photo's web address, in a new tab | Google Lens (lens.google.com) |
| Press **Test connection** in settings | Your API key, to check it | The service you picked |

Your API key is sent only to the service it belongs to, in the way that service's documentation says to. Photos and listing text
sent to an AI service are handled under *that service's* privacy policy and terms; read the one for the service you choose.
Choosing Ollama or LM Studio keeps all of it on your computer (sold-price searches still go to eBay; they can be turned off).

## What it does not do

- It does not send anything to the developer, and has no account, server, advertising or analytics.
- It does not sell or share your data, and does not use it for anything other than what is described here.
- It does not read pages other than eBay and Facebook Marketplace (and, only when you press **Test connection** for an address you entered, that address).
- It does not collect payment details or messages.

## Permissions

The permissions and what each is for are listed in `store/LISTING.md`.

## Changes and contact

If this changes, the new version will be here with a new date. Questions: **<your contact email>**
