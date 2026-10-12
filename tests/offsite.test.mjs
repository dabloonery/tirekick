// The site rules that need no browser: the off-site scam check and shipping amounts.
// Run by tests/run.sh with deno (no browser needed). Prints PASS/FAIL lines.
globalThis.window = globalThis;
globalThis.location = { hostname: "www.facebook.com", href: "https://www.facebook.com/" };
globalThis.document = { querySelector: () => null, querySelectorAll: () => [] };
(0, eval)(Deno.readTextFileSync(new URL("../content/adapters.js", import.meta.url)));
const SL = globalThis.SecondLook;
const check = (name, ok, why = "") => console.log(`${ok ? "PASS" : "FAIL"} ${name}${ok ? "" : ": " + why}`);
const sure = (t) => SL.offSite(t)?.sure === true;

const clean = [
  "Works perfectly. Me and my wife upgraded.",
  "Great condition. Top quality, pickup only",
  "Bought new. Store in smoke free home",
  "Selling my Switch. Us shipping only",
  "Pick up in town. Co op games included",
  "Black polka dot top, size M",
  "Battery health is 92%, I can show a screenshot of it at pickup",
  "Comes with a $20 gift card for the store",
  "Text me if you have questions about pickup",
  "Everything works. Online play tested. Shop around, price is firm.",
];
const bad = clean.filter((t) => sure(t));
check("offSite: ordinary sentences are not called scams", !bad.length, JSON.stringify(bad));

const caught = [
  "visit www . jmyzl . com for details", "go to jmyzl dot com", "go to jmyzl [dot] shop", "go to jmyzl (dot) store",
  "go to jmyzl .com", "go to jmyzl. com now", "WWW . JMYZL . COM", "message 505_507__6507 now", "remove the spaces to see it",
  "text me a screenshot of the listing", "send me a screenshot of the code", "contact me on WhatsApp", "pay with gift cards", "pay only with gift cards",
];
const missed = caught.filter((t) => !sure(t));
check("offSite: disguised contact is still caught", !missed.length, JSON.stringify(missed));
const plain = SL.offSite("call or text 555 123 4567");
check("offSite: a plain phone number is only a hint", !!plain && plain.sure === false);
check("offSite: nothing to say about a normal listing", SL.offSite("Works great, comes with charger") === null && SL.offSite("") === null);

// A listing page's own shipping line can come without a "+"; cards keep needing one.
check("shipping: a listing page's bare amount is read", SL.parseShipping("US $8.50 Standard Shipping", true) === 8.5 && SL.parseShipping("+$12.00 delivery") === 12 && SL.parseShipping("Free 2-4 day delivery") === 0);
check("shipping: a card's price next to the words isn't taken for shipping", SL.parseShipping("$85.00 Free delivery") === 0 && SL.parseShipping("$85.00 Local pickup") === null);
