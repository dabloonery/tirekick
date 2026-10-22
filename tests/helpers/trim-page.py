# Turns a saved eBay or Marketplace search page into a small fixture that is safe to commit: only the result
# cards, with no scripts, tracking, photos, item ids, seller names or places (those are replaced with made-up ones),
# and nothing Tirekick added to the page while it was open.
#   python3 tests/helpers/trim-page.py ebay saved.html tests/fixtures/ebay-results-real.html
#   python3 tests/helpers/trim-page.py facebook saved.html tests/fixtures/facebook-marketplace-real.html
# Needs BeautifulSoup and lxml (pip install beautifulsoup4 lxml). Read the result before committing it: the
# titles stay as the sellers wrote them, so look for a name, phone number or address in one.
import copy, re, sys
from bs4 import BeautifulSoup, Comment

site, src, out = sys.argv[1], sys.argv[2], sys.argv[3]
assert site in ("ebay", "facebook"), "first argument: ebay or facebook"
s = BeautifulSoup(open(src, encoding="utf-8").read(), "lxml")
for c in s.find_all(string=lambda t: isinstance(t, Comment)): c.extract()
for t in s(["script", "noscript", "link", "iframe", "svg", "style", "button", "input", "form"]): t.decompose()
for t in s.select('[class*="tirekick"], [id^="tirekick"]'): t.decompose()

ids = {}
def fake_id(orig, base):
    ids.setdefault(orig, str(base + len(ids) + 1))
    return ids[orig]
FAKE_PLACES = ["Springfield, IL", "Shelbyville, IL", "Ogdenville, IL", "North Haverbrook, IL", "Capital City, IL", "Brockway, IL"]
places = {}
PLACE = re.compile(r"^[A-Z][A-Za-z .'-]{1,30}, [A-Z]{2}$")
KEEP = {"class", "href", "role", "aria-label", "aria-hidden", "aria-level", "alt", "src", "dir"}
photos = [0]

def clean(root):
    if site == "facebook":  # places first, so the labels and photo descriptions that repeat them can follow
        for t in root.find_all(string=True):
            if PLACE.match(t.strip()):
                p = t.strip()
                places.setdefault(p, FAKE_PLACES[len(places) % len(FAKE_PLACES)] if len(places) < len(FAKE_PLACES) else f"Town {len(places)}, IL")
                t.replace_with(places[p])
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
            el["src"] = f"https://i.ebayimg.com/images/g/fixture{photos[0]}/s-l500.webp" if site == "ebay" else f"https://scontent.test.fbcdn.net/v/fixture/{photos[0]}_n.jpg"
        for k in ("aria-label", "alt"):
            if el.get(k):
                v = el[k]
                for real, made_up in places.items(): v = v.replace(real, made_up)
                el[k] = re.sub(r"listing (\d+)", lambda m: "listing " + fake_id(m.group(1), 900000000000000), v)

if site == "ebay":
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
html = f'<!doctype html>\n<!-- A real saved page, trimmed and sanitized by tests/helpers/trim-page.py. -->\n<html lang="en"><head><meta charset="utf-8"><title>{title}</title></head><body>{body}</body></html>\n'
open(out, "w", encoding="utf-8").write(re.sub(r">\s+<", "><", html))
print(f"{out}: {len(html) // 1024} KB, {len(ids)} listings, {photos[0]} photos")
