# Turns a saved eBay or Marketplace search page into a small fixture that is safe to commit: only the result
# cards, with no scripts, tracking, photos, item ids, seller names or places (those are replaced with made-up ones),
# and nothing Tirekick added to the page while it was open. A listing page works too (ebay-item, facebook-item):
# eBay's main content, or Marketplace's listing overlay and a few of the cards behind it, sanitized the same way.
#   python3 tests/helpers/trim-page.py ebay saved.html tests/fixtures/ebay-results-real.html
#   python3 tests/helpers/trim-page.py facebook saved.html tests/fixtures/facebook-marketplace-real.html
#   python3 tests/helpers/trim-page.py ebay-item saved.html tests/fixtures/ebay-item-real.html
#   python3 tests/helpers/trim-page.py craigslist saved.html tests/fixtures/craigslist-results-real.html
#   python3 tests/helpers/trim-page.py craigslist-item saved.html tests/fixtures/craigslist-item-real.html
# Needs BeautifulSoup and lxml (pip install beautifulsoup4 lxml). Read the result before committing it: the
# titles stay as the sellers wrote them, so look for a name, phone number or address in one.
import copy, re, sys
from bs4 import BeautifulSoup, Comment

site, src, out = sys.argv[1], sys.argv[2], sys.argv[3]
assert site in ("ebay", "facebook", "ebay-item", "facebook-item", "craigslist", "craigslist-item"), "first argument: ebay, facebook, craigslist, or one of them with -item"
item = site.endswith("-item")
site = site.split("-")[0]
s = BeautifulSoup(open(src, encoding="utf-8").read(), "lxml")
for c in s.find_all(string=lambda t: isinstance(t, Comment)): c.extract()
for t in s(["script", "noscript", "link", "iframe", "svg", "style", "input", "form"] + ([] if item else ["button"])): t.decompose()
for t in s.select('[class*="tirekick"], [id^="tirekick"]'): t.decompose()

ids = {}
def fake_id(orig, base):
    ids.setdefault(orig, str(base + len(ids) + 1))
    return ids[orig]
FAKE_PLACES = ["Springfield, IL", "Shelbyville, IL", "Ogdenville, IL", "North Haverbrook, IL", "Capital City, IL", "Brockway, IL"]
places = {}
PLACE = re.compile(r"^[A-Z][A-Za-z .'-]{1,30}, [A-Z]{2}$")
KEEP = {"class", "href", "role", "aria-label", "aria-hidden", "aria-level", "alt", "src", "dir", "data-testid", "data-zoom-src"}
photos = [0]

def clean(root):
    if site == "facebook":  # places first, so the labels and photo descriptions that repeat them can follow
        for t in root.find_all(string=True):
            if PLACE.match(t.strip()):
                p = t.strip()
                places.setdefault(p, FAKE_PLACES[len(places) % len(FAKE_PLACES)] if len(places) < len(FAKE_PLACES) else f"Town {len(places)}, IL")
                t.replace_with(places[p])
        # the town on its own, in a title ("ISO Albuquerque Journal") or a longer place name
        towns = sorted({p.rsplit(",", 1)[0] for p in places}, key=len, reverse=True)
        for t in root.find_all(string=True):
            v = str(t)
            for town in towns: v = v.replace(town, "Springfield")
            if v != str(t): t.replace_with(v)
    for el in [root] + root.find_all(True):
        for k in list(el.attrs):
            if k not in KEEP or (site == "facebook" and k == "class"): del el[k]  # Facebook's class names are generated noise
        h = el.get("href")
        if h is not None:
            m = re.search(r"/itm/(\d+)" if site == "ebay" else r"/marketplace/item/(\d+)", h)
            if not m: el["href"] = "#"
            elif site == "ebay": el["href"] = f"https://www.ebay.com/itm/{fake_id(m.group(1), 900000000000)}"
            else: el["href"] = f"https://www.facebook.com/marketplace/item/{fake_id(m.group(1), 900000000000000)}/?ref=search&referral_code=null"
        if el.name == "img":
            photos[0] += 1
            if el.get("data-zoom-src"): el["data-zoom-src"] = f"https://i.ebayimg.com/images/g/fixture{photos[0]}/s-l1600.webp"
            el["src"] = f"https://i.ebayimg.com/images/g/fixture{photos[0]}/s-l500.webp" if site == "ebay" else f"https://scontent.test.fbcdn.net/v/fixture/{photos[0]}_n.jpg"
        for k in ("aria-label", "alt"):
            if el.get(k):
                v = el[k]
                for real, made_up in places.items(): v = v.replace(real, made_up)
                for town in sorted({p.rsplit(",", 1)[0] for p in places}, key=len, reverse=True): v = v.replace(town, "Springfield")
                el[k] = re.sub(r"listing (\d+)", lambda m: "listing " + fake_id(m.group(1), 900000000000000), v)

def buyer_zip(root):  # "Delivery … to 87106", "Free pickup: 3 mi from 87106": the buyer's ZIP code
    for t in root.find_all(string=re.compile(r"\b\d{5}\b")):
        v = re.sub(r"(from|near|to) \d{5}\b", r"\1 62701", str(t))
        prev = t.find_previous(string=lambda x: x.strip())
        if re.fullmatch(r"\s*\d{5}\s*", v) and prev is not None and prev.strip() in ("to", "from", "near"): v = "62701"
        if v != str(t): t.replace_with(v)

# Craigslist: posts are www.craigslist.org/view/d/<slug>/<code>. The slug starts with the seller's town, so it goes;
# the code, post numbers, places and photos become made-up ones; the post's structured data (which carries the
# phone number) and the map are dropped, and the town in the title bar is replaced.
codes = {}
def fake_code(orig):
    codes.setdefault(orig, f"Fixture{len(codes) + 1:03d}" + "x" * 12)
    return codes[orig]
def clean_cl(root):
    for el in [root] + root.find_all(True):
        for k in list(el.attrs):
            if k not in KEEP | {"title", "datetime", "id"} or (k == "id" and el[k] not in ("postingbody", "titletextonly")): del el[k]
        h = el.get("href")
        if h is not None:
            m = re.search(r"/view/(?:d/[^/]+/)?([A-Za-z0-9]{16,40})", h)
            el["href"] = f"https://www.craigslist.org/view/d/springfield-item/{fake_code(m.group(1))}" if m else "#"
        if el.name == "img":
            photos[0] += 1
            el["src"] = f"https://images.craigslist.org/00000_fixture{photos[0]}_0CI0t2_600x450.jpg"
            if el.get("alt"): el["alt"] = re.sub(r"\s*\d+$", "", el["alt"]) + " 1"

if site == "craigslist" and not item:
    cards = s.select("div.cl-search-result")[:24]
    keep = []
    for c in cards:
        c = copy.copy(c)
        for t in c.select(".dots, button"): t.decompose()
        for sw in c.select(".swipe-wrap > div"):  # one photo per card, as it first loads
            if not sw.find("img"): sw.decompose()
        clean_cl(c)
        for t in c.select(".result-location"):
            p = t.get_text().strip()
            places.setdefault(p, FAKE_PLACES[len(places) % len(FAKE_PLACES)].split(",")[0])
            t.string = places[p]
        keep.append(str(c))
    body = f'<div class="cl-search-results"><div class="results cl-results-page">{"".join(keep)}</div></div>'
    title = "springfield electronics for sale - craigslist"
elif site == "craigslist":
    page = s.new_tag("section", attrs={"class": "body"})
    for sel in ("h1.postingtitle", "section.userbody figure", ".attrgroup", "#postingbody", ".postinginfos", ".avoid-scams"):
        part = s.select_one(sel)
        if part:
            part = copy.copy(part)
            if sel == ".attrgroup":
                w = s.new_tag("div", attrs={"class": "mapAndAttrs"}); w.append(part); part = w
            page.append(part)
    for t in page.select(".print-qrcode"): t.decompose()
    clean_cl(page)
    for t in page.select(".postingtitletext > span"):  # " (Albuquerque, New Mexico)"
        if re.fullmatch(r"\s*\(.*\)\s*", t.get_text()): t.string = " (Springfield, Illinois)"
    for t in page.find_all(string=re.compile(r"post id: \d+")): t.replace_with("post id: 7900000001")
    for t in page.find_all(string=re.compile(r"\b\d{3}[\s.-]\d{3}[\s.-]\d{4}\b")): t.replace_with(re.sub(r"\b\d{3}([\s.-])\d{3}([\s.-])\d{4}\b", r"555\g<1>555\g<2>0100", str(t)))
    og = s.select_one('meta[property="og:image"]')
    head = f'<meta property="og:title" content="{s.select_one("#titletextonly").get_text().strip()}"><meta property="og:image" content="https://images.craigslist.org/00000_fixture1_0CI0t2_600x450.jpg">' if og else ""
    body = str(page)
    title = s.title.get_text().strip()
elif item and site == "ebay":
    # The photos, the summary on the right (title, price, seller, shipping) and "About this item", inside <main> as on eBay.
    main = s.new_tag("main")
    for sel in ("#PicturePanel", "#mainContent", ".x-about-this-item"):
        part = s.select_one(sel)
        if part: main.append(copy.copy(part))
    clean(main)
    for t in main.select(".x-sellercard-atf__info__about-seller a, .x-sellercard-atf__info__about-seller span"):
        if t.string and t.string.strip() and not re.search(r"[\d%]", t.string): t.string = "seller1"
    for t in main.find_all(string=re.compile(r"Located in:")):
        t.replace_with(re.sub(r"Located in:.*", "Located in: Springfield, Illinois, United States", str(t)))
    for t in main.find_all(string=re.compile(r"^\s*[A-Z][a-z]+(?: [A-Z][a-z]+)*, [A-Z][a-z]+(?: [A-Z][a-z]+)*, United States\s*$")):
        t.replace_with("Springfield, Illinois, United States")
    buyer_zip(main)
    body = str(main)
    title = "eBay listing"
elif item:
    dialog = next(d for d in s.select('[role="dialog"]') if d.select_one('a[href*="/marketplace/profile/"]'))  # the listing, not the notifications
    d = copy.copy(dialog)
    for a in d.select('a[href*="/marketplace/profile/"]'):  # the seller's name (not the "Seller details" link)
        for t in a.find_all(string=True):
            if t.strip() and t.strip() != "Seller details": t.replace_with("Pat Seller")
    for a in d.select("a[href]"):
        if "/marketplace/item/" not in a["href"]: a["href"] = "#"
    cells = []
    for a in s.select('[role="main"] a[href*="/marketplace/item/"]')[:6]:
        c = copy.copy(a)
        clean(c)
        cells.append(f"<div><div>{c}</div></div>")
    clean(d)
    for t in d.find_all(string=True):  # the town alone, in "Listed … in Springfield, IL" or a related search link
        v = str(t)
        for real in places: v = v.replace(real.rsplit(",", 1)[0], "Springfield")
        if v != str(t): t.replace_with(v)
    body = f'<div role="main"><div>{"".join(cells)}</div></div><div role="dialog" aria-label="Marketplace listing">{d.decode_contents()}</div>'
    title = "Marketplace"
elif site == "ebay":
    results = s.select_one("ul.srp-results")
    keep = s.new_tag("ul", attrs={"class": "srp-results srp-list clearfix"})
    carousel = False
    for li in results.find_all("li", recursive=False):
        cls = " ".join(li.get("class") or [])
        if "s-card" in cls.split(): keep.append(copy.copy(li))
        elif "carousel" in cls.lower() and li.select(".carousel__list > li") and not carousel:  # one, to check it's skipped
            c = copy.copy(li)
            for extra in c.select(".carousel__list > li")[2:]: extra.decompose()
            keep.append(c)
            carousel = True
    placeholder = s.select_one("div.s-clipped li.s-card")  # eBay's hidden "Shop on eBay" card
    for part in (keep, placeholder):
        if part: clean(part)
    # Seller names: "name 99.5% positive (10K)" in one piece, or the name in the piece before the rating.
    sellers = {}
    def seller(name):
        sellers.setdefault(name, f"seller{len(sellers) + 1}")
        return sellers[name]
    for sp in keep.find_all("span"):
        t = sp.get_text().strip()
        if sp.find(True): continue
        m = re.match(r"^(\S+)\s+(\d{1,3}(?:\.\d)?% positive.*)$", t)
        if m: sp.string = f"{seller(m.group(1))} {m.group(2)}"
        elif re.match(r"^\d{1,3}(?:\.\d)?% positive", t):
            prev = sp.find_previous_sibling("span")
            if prev is not None and re.fullmatch(r"\S+\s*", prev.get_text()): prev.string = seller(prev.get_text().strip()) + " "
    buyer_zip(keep)
    body = f'<div class="srp-river-main"><div class="s-clipped"><ul>{placeholder or ""}</ul></div><div id="srp-river-results" class="srp-river-results clearfix"><h2>Results</h2>{keep}</div></div>'
    title = "for sale | eBay"
else:
    cells = []
    for a in s.select('a[href*="/marketplace/item/"]'):
        c = copy.copy(a)
        clean(c)
        cells.append(f"<div><div>{c}</div></div>")
    body = f'<div role="main"><div>{"".join(cells)}</div></div>'
    title = "Marketplace - Search results"
html = f'<!doctype html>\n<!-- A real saved page, trimmed and sanitized by tests/helpers/trim-page.py. -->\n<html lang="en"><head><meta charset="utf-8"><title>{title}</title>{head if site == "craigslist" and item else ""}</head><body>{body}</body></html>\n'
open(out, "w", encoding="utf-8").write(re.sub(r">\s+<", "><", html))
print(f"{out}: {len(html) // 1024} KB, {len(ids) + len(codes)} listings, {photos[0]} photos")
