# Tirekick: privacy policy

*Last updated: October 2026*

Tirekick is a browser extension for people buying second-hand online. It currently works on eBay and
Facebook Marketplace. This page says what it keeps, what it sends, and to whom.

**The short version:** Tirekick has no server and no analytics. The developer receives nothing.
Anything that leaves your computer goes to a service you chose, because you asked it to.

## What stays in your browser

All of this is kept in your browser's extension storage and never sent to the developer:

- **Your settings**, including any API key you paste in. Keys stay in this browser profile; the pages Tirekick works on never see them.
- **Listings and searches you saved, and listings you hid**, with the prices you saw.
- **Listings you've seen** (title, price, when), so it can say "new to you" and show price drops and history. Kept for 90 days.
- **Scores** for listings you scanned or analyzed, kept for 60 days so they come back in other searches and tabs, and **sold-price results**, kept for six hours.
- **Small preferences**: each mode's sort, each search's "what I want" and filter, and where the panel sits on each site.
- **A spending estimate** for paid AI, worked out from token counts at list price.
- **Simple counters** of which features you use, shown on the Home tab.

You can clear what you've seen and hidden, and the spending and usage counters, in settings and on the
Home tab. You can remove saved things from the panel, and save or restore a backup file (which never
includes your API keys). Uninstalling Tirekick deletes all of it.

## What leaves your computer, and only when you ask

Tirekick does nothing on a page until you open its panel, press a button, or (for the free marks on
cards) load an eBay or Marketplace page you're already looking at. With **Scan new listings
automatically** turned on (it's off until you turn it on), a search page you're looking at is scanned
as its listings load, as if you'd pressed Scan. It never browses, checks prices or contacts anyone in
the background.

| When you… | What is sent | To whom |
|---|---|---|
| Press **Scan** (or have it scan automatically), **Analyze this listing** or **Better searches** | Listing titles and the text on their cards (price, shipping, seller rating, condition, description), your search words, and the "what I want" and "what you're into" text you wrote | The AI service you picked in settings: the Claude API (api.anthropic.com), OpenRouter, OpenAI, Google Gemini, DeepSeek, Mistral, xAI, an address you entered, or Ollama / LM Studio on your own computer (which keeps it on your computer) |
| Press **Check photo** or right-click a photo | The photo and the listing's title | The same AI service |
| Compare **sold prices** (a button, as part of a scan, or **Look up** on Tirekick's own page, including words you select on any page and choose "Look up … on eBay and Marketplace") | Your search words, in a request to ebay.com from your browser with your own eBay session, a few an hour at most | eBay |
| Press **Find photo elsewhere** | The photo's web address, opened in a new tab | Google Lens (lens.google.com) |
| Press **Test connection** in settings | Your API key, to check it works | The service you picked |

Your API key goes only to the service it belongs to, the way that service's documentation says to send
it. Photos and listing text sent to an AI service fall under *that service's* privacy policy and terms,
so read the one for the service you pick. Ollama and LM Studio keep everything on your computer
(sold-price lookups still go to eBay, and you can turn those off).

## What Tirekick doesn't do

- Send anything to the developer. There's no account, server, advertising or analytics.
- Sell or share your data, or use it for anything not described here.
- Read pages other than eBay and Facebook Marketplace (and, only when you press **Test connection** for an address you entered, that address). Its page script is present across facebook.com so it can follow you into Marketplace, but it only reads Marketplace pages. On other pages, the only thing it receives is text you select and choose to look up from the right-click menu.
- Collect payment details or messages.

## Permissions

Each permission and what it's for is listed in `store/LISTING.md`.

## Changes and contact

If this policy changes, the new version will be posted here with a new date.
Questions: **<your contact email>**
