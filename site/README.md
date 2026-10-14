# tirekick.app

The website: a landing page and the privacy policy the Chrome Web Store links to. Plain HTML and CSS,
no scripts, no tracking, the font served from here. Not deployed yet.

- `index.html`: the landing page. The "Add to Chrome" button waits for the store link.
- `privacy.html`: the privacy policy, kept in step with `store/PRIVACY.md` (change both together).
- `style.css`: colors, type, the tread and the verdict glyphs copied from `lib/theme.js`.
- Replace `CONTACT_EMAIL` in both pages before publishing.

To publish, serve this folder as the site root on any static host (GitHub Pages, Cloudflare Pages,
Netlify) and point tirekick.app at it. `.app` domains need HTTPS, which those hosts provide.
