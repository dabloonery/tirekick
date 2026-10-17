# The Tirekick website

Three pages the Chrome Web Store listing links to. Plain HTML and CSS, no scripts, no tracking, the font
served from here. Every link is relative. It lives at https://tirekick.app and goes live together with the extension.

- `index.html`: the landing page, for both audiences: everyday buyers (scam marks, a big purchase) and resellers
  (sold prices on Marketplace, Reseller mode). See `plans/tirekick-future.md` in the project files. Its "Add to Chrome" button links to the store listing (https://chromewebstore.google.com/detail/lmcpkglegjjamhickcmibcfjebjeoodj).
- `privacy.html`: the privacy policy, kept in step with `store/PRIVACY.md` (change both together). The store's
  **privacy policy URL** is this page.
- `support.html`: getting started, what to send when something breaks, common questions and the contact
  address. The store's **support URL** is this page.
- `style.css`: colors, type, the tread and the verdict glyphs copied from `lib/theme.js`.
- The store's promo tiles are drawn from `store/art.html` (which uses this folder's `style.css`) by `scripts/store-art.sh`.
- `CNAME`: the custom domain, tirekick.app.
- The contact address is support@tirekick.app. It works once the mailbox is set up.

## Putting it up at tirekick.app

The site goes on GitHub Pages (free) from a small public repository of its own, `tirekick-site`, which
holds only these pages and none of the extension's code. The `CNAME` file here tells GitHub Pages the
address is tirekick.app. Do it in this order:

**1. Make the repository and upload the pages**

1. On github.com, press **+** (top right) → **New repository**. Name it `tirekick-site`, choose **Public**,
   and press **Create repository**.
2. On the new repository's page, press **uploading an existing file**. Unzip `tirekick-site-upload.zip`
   (in the project files, under `builds/`) and drag in everything inside it: the files, the `CNAME` file
   and the `fonts` folder. Press **Commit changes**.
3. Open **Settings** → **Pages**. Under **Build and deployment**, set **Source** to "Deploy from a branch",
   the branch to `main` and the folder to `/ (root)`, then **Save**.
4. On the same page, **Custom domain** should already say `tirekick.app` (from the `CNAME` file). If it's
   empty, type `tirekick.app` and press **Save**.

**2. Point tirekick.app at GitHub (at the company you bought the domain from)**

Open the domain's **DNS** settings there and add these records. Delete any existing "parked" or
"forwarding" record for `@` or `www` first.

| Type  | Name (host) | Value                  |
|-------|-------------|------------------------|
| A     | @           | 185.199.108.153        |
| A     | @           | 185.199.109.153        |
| A     | @           | 185.199.110.153        |
| A     | @           | 185.199.111.153        |
| AAAA  | @           | 2606:50c0:8000::153    |
| AAAA  | @           | 2606:50c0:8001::153    |
| AAAA  | @           | 2606:50c0:8002::153    |
| AAAA  | @           | 2606:50c0:8003::153    |
| CNAME | www         | dabloonery.github.io   |

`@` means the bare tirekick.app; some companies want it left blank instead.

**3. Wait, then turn on HTTPS**

DNS changes take from a few minutes to a day. Back in **Settings** → **Pages**, wait until the DNS check
shows a green tick, then tick **Enforce HTTPS** (it may take a little longer to become clickable).
`.app` addresses only open over HTTPS, so the site shows nothing until then; that's normal.

Then https://tirekick.app is the home page, https://tirekick.app/privacy the privacy policy and
https://tirekick.app/support the help page: the addresses the store listing asks for.

**Optional: verify the domain.** **Settings** (your account, not the repository) → **Pages** → **Add a
domain**, then add the TXT record it shows. It stops anyone else's GitHub Pages from claiming
tirekick.app.

**Email.** support@tirekick.app needs mail set up separately at the same company (look for "email
forwarding") and pointed at your inbox. GitHub Pages doesn't handle email.

**Later changes.** Upload the changed files the same way; they replace the old ones.

## Publishing from this repository after it goes public

Open **Settings** → **Pages**, set **Source** to "GitHub Actions", then **Actions** → **Website** → **Run
workflow**. The workflow (`.github/workflows/pages.yml`) publishes this folder, `CNAME` included. Remove the
custom domain from `tirekick-site` first, because one domain can only point at one repository.
