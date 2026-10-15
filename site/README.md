# The Tirekick website

Three pages the Chrome Web Store listing links to. Plain HTML and CSS, no scripts, no tracking, the font
served from here. Every link is relative, so the folder works at any address (a GitHub Pages address
such as `https://dabloonery.github.io/tirekick-site/`, or a domain later). Not published yet.

- `index.html`: the landing page, for both audiences: everyday buyers (scam marks, a big purchase) and resellers
  (sold prices on Marketplace, Reseller mode). See `plans/tirekick-future.md` in the project files. The "Add to Chrome" button waits for the store link.
- `privacy.html`: the privacy policy, kept in step with `store/PRIVACY.md` (change both together). The store's
  **privacy policy URL** is this page.
- `support.html`: getting started, what to send when something breaks, common questions and the contact
  address. The store's **support URL** is this page.
- `style.css`: colors, type, the tread and the verdict glyphs copied from `lib/theme.js`.
- `promo-tile.html`: source for the store's small promo tile, not linked from the site.
- Replace `CONTACT_EMAIL` in all three pages before publishing.

## Publishing on GitHub Pages while this repository is private

GitHub Pages is free for public repositories only. Until this one goes public at 1.0.0, put the site in a
small public repository of its own (it holds only these pages, none of the extension's code):

1. On github.com, press **+** (top right) → **New repository**. Name it `tirekick-site`, choose **Public**, and
   press **Create repository**.
2. On the new repository's page, press **uploading an existing file**. Drag in everything inside this
   `site/` folder (the files and the `fonts` folder, not the `site` folder itself), then **Commit changes**.
3. Open **Settings** → **Pages**. Under **Build and deployment**, set **Source** to "Deploy from a branch", the
   branch to `main` and the folder to `/ (root)`, then **Save**.
4. After a minute or two the page shows "Your site is live at `https://dabloonery.github.io/tirekick-site/`".
   The privacy policy is that address plus `privacy`, the help page that address plus `support`.

To update it later, upload the changed files the same way; they replace the old ones.

## Publishing from this repository after it goes public

Open **Settings** → **Pages**, set **Source** to "GitHub Actions", then **Actions** → **Website** → **Run
workflow**. The workflow (`.github/workflows/pages.yml`) publishes this folder. To use a domain such as
tirekick.app, enter it under **Custom domain** on the same Settings page and follow GitHub's DNS steps.
