// Labeled listings for tests/eval: what turns up in real searches, each marked with what it really is.
// Written by hand from the shapes real eBay and Marketplace listings take (no store pages were fetched).
// dabloonery has no labeled scam data, so these stand in for it: when a real listing fools the checks, add it here
// with its label first, then change the rules.
//
// truth: "scam" (bait, a fake, a repost, a scammer's account) or "honest".
// word: for an honest listing, the price word a buyer should see before any scan ("great", "good", "fair",
//   "pass" for Above typical, "none" when it shouldn't be priced against the search: an accessory, a game,
//   a broken one, a lot, an auction).
// scan / scanRelated / shown: a scripted scan answer (the model's verdict, and false when it said the listing
//   isn't the search) and the verdict that should show after it. Shown defaults to the scan's own verdict; for
//   a scam, any warning or pass counts.
// text: what the card says besides the title and price (seller rating, bids, time left).
// page: a Marketplace listing's page text, for the checks that only run once it's opened.
// foreign: the currency when it isn't US dollars ("CA$", "£"), as Marketplace shows it to buyers elsewhere.
// cheapWhy: the scripted scan's answer to why a low price is low ("none", "flaw", "missing parts", "different
//   model", "quick sale"), as background.js asks for it.
// group "cheap": an honest listing priced far under typical (CHEAP below). expect "clear": the card says why (a
//   flaw, missing parts, a cheaper model), so it shouldn't stay a scam once a scan has read it; "warn": it doesn't,
//   and a warning is fair. Kept out of the honest totals above and scored on their own.

// Typical prices (recent eBay sales, used) for each search: the median total, the typical shipping in it,
// and how much to trust it.
export const MARKETS = {
  "nintendo switch oled": { median: 252, ship: 14, confidence: "good", n: 48 },
  "iphone 13 128gb": { median: 290, ship: 10, confidence: "good", n: 60 },
  "ps5 console": { median: 330, ship: 25, confidence: "good", n: 55 },
  "pentax k1000": { median: 125, ship: 15, confidence: "good", n: 34 },
  "macbook air m1": { median: 420, ship: 18, confidence: "good", n: 41 },
  "dewalt dcd771": { median: 75, ship: 13, confidence: "fair", n: 22 },
  "airpods pro 2": { median: 120, ship: 6, confidence: "good", n: 60 },
  "canon ae-1": { median: 160, ship: 15, confidence: "fair", n: 19 },
  "nintendo switch": { median: 200, ship: 14, confidence: "fair", n: 52 }, // Lites, V1s and OLEDs together
};

const ebay = (query, title, price, shipping, text, rest = {}) => ({ site: "ebay", query, title, price, shipping, text, ...rest });
const fb = (query, title, price, rest = {}) => ({ site: "facebook", query, title, price, shipping: null, ...rest });
const seller = (pct, n) => `${pct}% positive (${n})`;

export const CASES = [
  // ---------- eBay: nintendo switch oled ($252) ----------
  ebay("nintendo switch oled", "Nintendo Switch OLED Model 64GB White Console", 239.99, 0, seller(99.6, "2.1K"), { truth: "honest", word: "fair", scan: "good", shown: "good" }),
  ebay("nintendo switch oled", "Nintendo Switch OLED Neon Red/Blue - Used, works great", 189, 12.5, seller(100, 312), { truth: "honest", word: "good" }),
  ebay("nintendo switch oled", "Nintendo Switch OLED with dock, screen scratches", 158, 14, seller(98.9, 87), { truth: "honest", word: "good", note: "a fair-condition one priced to move" }),
  ebay("nintendo switch oled", "Nintendo Switch OLED Mario Red Edition NEW SEALED", 349, 0, seller(99.9, "14K"), { truth: "honest", word: "pass", scan: "great", shown: "fair", note: "sealed special edition: held at Fair" }),
  ebay("nintendo switch oled", "Nintendo Switch OLED Console White - FOR PARTS, won't charge", 85, 12, seller(99.1, 540), { truth: "honest", word: "none" }),
  ebay("nintendo switch oled", "Nintendo Switch OLED Console White", 61, 0, `${seller(100, 24)} 9 bids 1d 3h left`, { truth: "honest", word: "none", note: "an auction: the price is a bid" }),
  ebay("nintendo switch oled", "Carrying Case for Nintendo Switch OLED, Hard Shell Travel Bag", 14.99, 0, seller(99.2, "45K"), { truth: "honest", word: "none" }),
  ebay("nintendo switch oled", "Tempered Glass Screen Protector for Nintendo Switch OLED 2 Pack", 7.99, 0, seller(99.5, "120K"), { truth: "honest", word: "none" }),
  ebay("nintendo switch oled", "The Legend of Zelda: Tears of the Kingdom - Nintendo Switch OLED Game", 38, 4.5, seller(100, 61), { truth: "honest", word: "none" }),
  ebay("nintendo switch oled", "Pokemon Scarlet Nintendo Switch OLED Game Brand New Sealed", 42, 0, seller(99.8, 940), { truth: "honest", word: "none", scan: "pass", scanRelated: false, note: "a game, no dash or bracket" }),
  ebay("nintendo switch oled", "Lot of 5 Nintendo Switch OLED games Mario Zelda Pokemon", 120, 8, seller(99.7, 230), { truth: "honest", word: "none" }),
  ebay("nintendo switch oled", "Nintendo Switch OLED Model White Joy-Con NEW SEALED", 99, 0, seller(100, 2), { truth: "scam", scan: "great", note: "bait: 39% from a seller with 2 ratings" }),
  ebay("nintendo switch oled", "Nintendo Switch OLED Console 64GB White - Fast Shipping", 109.99, 0, seller(100, 0), { truth: "scam", scan: "great" }),
  ebay("nintendo switch oled", "Nintendo Switch OLED White Console + Dock", 128, 0, seller(96.1, 8), { truth: "scam", scan: "good", note: "51% from a new account" }),

  ebay("nintendo switch oled", "Nintendo Switch OLED Handheld Game Console White 64GB", 236, 0, seller(99.9, "1.4K"), { truth: "honest", word: "fair", note: "\"game console\" is the machine" }),
  ebay("nintendo switch oled", "Nintendo Switch OLED console and charger", 225, 0, seller(100, 18), { truth: "honest", word: "fair" }),
  ebay("nintendo switch oled", "Nintendo Switch OLED - scratched, missing Joy-Cons", 118, 12, seller(100, 4), { truth: "honest", word: "none", note: "a casual seller, cheap because it's missing parts: no price word, as for a broken one" }),
  ebay("nintendo switch oled", "Nintendo Switch OLED White, lightly used", 229, 0, seller(100, 2), { truth: "honest", word: "fair", note: "a new seller at a normal price: Check first is fair" }),

  // ---------- eBay: iphone 13 128gb ($290) ----------
  ebay("iphone 13 128gb", "Apple iPhone 13 128GB Midnight Unlocked - Good", 279, 0, seller(99.4, "3.4K"), { truth: "honest", word: "fair", scan: "fair" }),
  ebay("iphone 13 128gb", "Apple iPhone 13 128GB Blue Unlocked Excellent Battery 91%", 309, 0, seller(99.8, "11K"), { truth: "honest", word: "pass", note: "refurbisher, a bit over typical" }),
  ebay("iphone 13 128gb", "iPhone 13 128GB Pink Verizon - cracked back, works", 189, 8, seller(100, 44), { truth: "honest", word: "good" }),
  ebay("iphone 13 128gb", "Apple iPhone 13 128GB Unlocked - Bad ESN, iCloud locked, for parts", 70, 6, seller(98.7, 160), { truth: "honest", word: "none", note: "parts phone" }),
  ebay("iphone 13 128gb", "OtterBox Defender Case for iPhone 13 128GB / 256GB", 19.5, 0, seller(99.1, "8K"), { truth: "honest", word: "none" }),
  ebay("iphone 13 128gb", "Apple iPhone 13 128GB Starlight Unlocked Brand New Sealed", 95, 0, seller(100, 1), { truth: "scam", scan: "great" }),
  ebay("iphone 13 128gb", "Apple iPhone 13 - 128GB - Midnight (Unlocked) A2482", 135, 0, seller(100, 3), { truth: "scam", scan: "good", note: "47% from a 3-rating seller" }),

  // ---------- eBay: ps5 console ($330) ----------
  ebay("ps5 console", "Sony PlayStation 5 Disc Edition Console CFI-1215A", 315, 0, seller(99.3, 820), { truth: "honest", word: "fair", note: "model number at the end" }),
  ebay("ps5 console", "PS5 Console Digital Edition with 2 Controllers", 279, 25, seller(100, 77), { truth: "honest", word: "fair" }),
  ebay("ps5 console", "DualSense Wireless Controller for PS5 Console - Midnight Black", 48, 0, seller(99.9, "30K"), { truth: "honest", word: "none" }),
  ebay("ps5 console", "Sony PS5 Disc Edition Console 825GB - NEW", 120, 0, seller(97.5, 6), { truth: "scam", scan: "great" }),

  // ---------- eBay: pentax k1000 ($125) ----------
  ebay("pentax k1000", "Pentax K1000 35mm Film Camera with SMC 50mm f2 Lens - Tested", 139, 15, seller(99.8, 950), { truth: "honest", word: "pass", note: "tested, a bit over" }),
  ebay("pentax k1000", "Pentax K1000 SLR Body Only - meter works", 72, 12, seller(100, 120), { truth: "honest", word: "good" }),
  ebay("pentax k1000", "Vintage Pentax K1000 camera, untested, sold as is", 40, 12, seller(99.2, 400), { truth: "honest", word: "none" }),

  // ---------- eBay: macbook air m1 ($420) ----------
  ebay("macbook air m1", "Apple MacBook Air 13 M1 2020 8GB 256GB Space Gray", 395, 0, seller(99.7, "5K"), { truth: "honest", word: "fair" }),
  ebay("macbook air m1", "MacBook Air M1 2020 8GB/512GB Gold - Battery 88%", 310, 18, seller(100, 51), { truth: "honest", word: "good" }),
  ebay("macbook air m1", "Apple MacBook Air M1 13.3\" 8GB 256GB Silver", 149, 0, seller(100, 0), { truth: "scam", scan: "great" }),

  // ---------- eBay: airpods pro 2 ($120) ----------
  ebay("airpods pro 2", "Apple AirPods Pro 2nd Generation with MagSafe USB-C Case", 109, 0, seller(99.6, "2K"), { truth: "honest", word: "fair" }),
  ebay("airpods pro 2", "AirPods Pro 2 Left Ear Replacement Only", 39, 4, seller(99.0, 300), { truth: "honest", word: "none" }),
  ebay("airpods pro 2", "Apple AirPods Pro 2 Wireless Earbuds with MagSafe Charging Case NEW", 32.99, 0, seller(94.2, 40), { truth: "scam", scan: "good", note: "a fake at 27%" }),

  // ---------- eBay: canon ae-1 (fair confidence, $160) ----------
  ebay("canon ae-1", "Canon AE-1 Program 35mm SLR Film Camera Body", 105, 15, seller(99.9, 700), { truth: "honest", word: "good" }),
  ebay("canon ae-1", "Canon AE-1 35mm camera w/ 50mm 1.8 FD lens, new seals", 175, 14, seller(100, 220), { truth: "honest", word: "pass" }),

  // ---------- Marketplace: nintendo switch oled (pickup: $252 less $14 shipping = $238) ----------
  fb("nintendo switch oled", "Nintendo Switch OLED", 200, { truth: "honest", word: "fair" }),
  fb("nintendo switch oled", "Nintendo switch oled barely used comes with case", 180, { truth: "honest", word: "good" }),
  fb("nintendo switch oled", "Switch OLED + 3 games + case", 230, { truth: "honest", word: "fair" }),
  fb("nintendo switch oled", "Nintendo Switch OLED white, moving must go", 150, { truth: "honest", word: "good", note: "63% of pickup typical, a real quick sale" }),
  fb("nintendo switch oled", "Mario Kart 8 Deluxe - Nintendo Switch OLED", 35, { truth: "honest", word: "none" }),
  fb("nintendo switch oled", "Switch OLED dock and charger", 40, { truth: "honest", word: "none", note: "the parts, not the console" }),
  fb("nintendo switch oled", "Looking for Nintendo Switch OLED", 150, { truth: "honest", word: "none" }),
  fb("nintendo switch oled", "Nintendo Switch OLED Model White M2465", 89, { truth: "scam", scan: "great", note: "code and bait" }),
  fb("nintendo switch oled", "Nintendo Switch OLED Model White U2X503", 92, { truth: "scam", note: "the same title under another code: a campaign" }),
  fb("nintendo switch oled", "Nintendo Switch OLED with 2 games K7Q2", 210, { truth: "scam", note: "a code at a normal price" }),
  fb("nintendo switch oled", "Nintendo switch oled brand new in box", 100, { truth: "scam", scan: "great", page: "Joined Facebook in 2026. Brand new, pick up or I can ship." }),
  fb("nintendo switch oled", "Nintendo Switch OLED neon", 170, { truth: "scam", page: "Joined Facebook in 2026 Text me on WhatsApp for quick deal" }),

  fb("nintendo switch oled", "Nintendo Switch OLED white", 180, { foreign: "CA$", truth: "honest", word: "none", note: "a Canadian buyer: CA$180 is about US$130" }),
  fb("nintendo switch oled", "Nintendo Switch OLED Neon", 95, { foreign: "£", truth: "honest", word: "none", note: "a UK buyer" }),

  // ---------- Marketplace: iphone 13 128gb (pickup $280) ----------
  fb("iphone 13 128gb", "iPhone 13 128gb unlocked", 260, { truth: "honest", word: "fair" }),
  fb("iphone 13 128gb", "iPhone 13 128GB T-Mobile cracked screen", 140, { truth: "honest", word: "none" }),
  fb("iphone 13 128gb", "iPhone 13 128gb like new", 110, { truth: "scam", scan: "great", page: "Joined Facebook in 2019. Email me at deals . shop for more pictures" }),
  fb("iphone 13 128gb", "iPhone 13 128 GB blue", 215, { truth: "honest", word: "good" }),

  // ---------- Marketplace: ps5 console (pickup $305) ----------
  fb("ps5 console", "PS5 console disc version with controller", 300, { truth: "honest", word: "fair" }),
  fb("ps5 console", "PS5 Console - must go today", 240, { truth: "honest", word: "good" }),
  fb("ps5 console", "PS5 console and 4 games, text 505_507__6507", 150, { truth: "scam", note: "disguised phone number in the title, before the listing is opened" }),
  fb("ps5 console", "PS5 Console Slim 1TB", 125, { truth: "scam", scan: "great" }),

  // ---------- Marketplace: dewalt dcd771 ($75, fair confidence; pickup $62) ----------
  fb("dewalt dcd771", "DeWalt 20V Max Drill DCD771C2", 60, { truth: "honest", word: "fair", scan: "fair", note: "the model number reads as a code" }),
  fb("dewalt dcd771", "Dewalt dcd771 drill with 2 batteries and charger", 70, { truth: "honest", word: "pass" }),
  fb("dewalt dcd771", "DeWalt DCD771 drill tool only no battery", 30, { truth: "honest", word: "none", note: "the bare tool: the typical price is for kits" }),

  // ---------- Marketplace: pentax k1000 (pickup $110) ----------
  fb("pentax k1000", "Pentax K1000 with 50mm lens", 90, { truth: "honest", word: "fair" }),
  fb("pentax k1000", "Pentax K1000 film camera, needs light seals", 48, { truth: "honest", word: "none", note: "cheap for a reason it says: no price word, as for a broken one" }),
  fb("pentax k1000", "Pentax k1000 35mm camera", 1234, { truth: "honest", word: "none", note: "a stand-in price" }),

  // ---------- Marketplace: macbook air m1 (pickup $402) ----------
  fb("macbook air m1", "MacBook Air M1 2020 256GB", 350, { truth: "honest", word: "fair" }),
  fb("macbook air m1", "Macbook Air M1 8GB 256GB space gray A2337", 160, { truth: "scam", scan: "great", note: "bait with the real model number" }),

  // ---------- scams that give the same excuses as honest cheap listings (CHEAP below) ----------
  ebay("nintendo switch oled", "Nintendo Switch OLED - minor scratch, works perfect", 79, 0, seller(100, 0), { truth: "scam", scan: "good", cheapWhy: "flaw", note: "bait with a flaw story, 31% from a new seller" }),
  ebay("nintendo switch oled", "Nintendo Switch OLED moving sale must go", 89, 0, seller(100, 1), { truth: "scam", scan: "good", cheapWhy: "quick sale" }),
  ebay("airpods pro 2", "Apple AirPods Pro 2nd Generation USB-C", 29.99, 0, seller(99.1, "1.2K"), { truth: "scam", scan: "good", cheapWhy: "none", note: "a fake from an established seller, 25%" }),
  ebay("iphone 13 128gb", "iPhone 13 Mini 128GB Unlocked NEW SEALED", 89, 0, seller(100, 0), { truth: "scam", scan: "great", cheapWhy: "different model", note: "\"mini\" bait, 31%" }),
  ebay("nintendo switch oled", "Nintendo Switch OLED console only no dock", 69, 0, seller(100, 0), { truth: "scam", scan: "good", cheapWhy: "missing parts", note: "27% from a new seller" }),
  ebay("canon ae-1", "Canon AE-1 Program film camera tested", 45, 0, seller(100, 0), { truth: "scam", scan: "good", cheapWhy: "none", note: "28% on a fair reference, new seller" }),
  fb("nintendo switch oled", "Nintendo Switch OLED small scratch K9F21", 95, { truth: "scam", scan: "good", cheapWhy: "flaw", note: "a code and a flaw story" }),
  fb("ps5 console", "PS5 Slim moving sale", 110, { truth: "scam", scan: "good", cheapWhy: "quick sale", page: "Joined Facebook in 2026. Moving tomorrow, first to pay gets it." }),
  fb("iphone 13 128gb", "iPhone 13 128gb minor scratches", 85, { truth: "scam", scan: "good", cheapWhy: "flaw", note: "30% of pickup, no other sign" }),
  fb("macbook air m1", "MacBook Air M1 like new, moving", 150, { truth: "scam", scan: "good", cheapWhy: "quick sale", page: "Joined Facebook in 2026." }),
];

// Honest listings priced far under typical: the ones the checks are most likely to call scams. Written from what
// people really write when they sell something cheap: a flaw, missing parts, a lock, a cheaper version than the
// search, a quick sale, or no reason at all.
const cheap = (c, expect, cheapWhy, shown, note) => ({ ...c, truth: "honest", group: "cheap", expect, scan: shown === "suspicious" ? "good" : shown, cheapWhy, shown, note });
export const CHEAP = [
  // eBay, with a reason on the card
  cheap(ebay("nintendo switch oled", "Nintendo Switch OLED - dead pixel on screen, otherwise works", 115, 12, seller(99.8, "2K")), "clear", "flaw", "good", "50%"),
  cheap(ebay("nintendo switch oled", "Nintendo Switch OLED heavy wear, drift on joycons", 105, 10, seller(99.1, 300)), "clear", "flaw", "fair", "46%"),
  cheap(ebay("nintendo switch oled", "Nintendo Switch OLED console only, no dock", 118, 0, seller(99.5, 600)), "clear", "missing parts", "good", "47%"),
  cheap(ebay("nintendo switch oled", "Nintendo Switch OLED console only, no dock", 118, 0, seller(100, 2)), "clear", "missing parts", "good", "47% from a new seller"),
  cheap(ebay("iphone 13 128gb", "iPhone 13 128GB Unlocked - battery 76%, scratches", 150, 0, seller(99.5, 410)), "clear", "flaw", "good", "52%"),
  cheap(ebay("iphone 13 128gb", "iPhone 13 128GB Verizon - carrier locked", 150, 0, seller(99, 200)), "clear", "flaw", "fair", "52%, locked to a carrier"),
  cheap(ebay("iphone 13 128gb", "Apple iPhone 13 Mini 128GB Pink Unlocked", 155, 0, seller(99.6, "1K")), "clear", "different model", "good", "53%: a mini sells for less"),
  cheap(ebay("macbook air m1", "MacBook Air M1 8GB 256GB - dent on corner, screen spots", 200, 0, seller(99.9, 700)), "clear", "flaw", "good", "48%"),
  cheap(ebay("macbook air m1", "MacBook Air M1 MDM locked", 160, 0, seller(99, 300)), "clear", "flaw", "fair", "38%: locked to a company, close to parts"),
  cheap(ebay("airpods pro 2", "AirPods Pro 2 - right earbud only + case", 45, 0, seller(99, 150)), "clear", "missing parts", "fair", "38%"),
  cheap(ebay("airpods pro 2", "Apple AirPods Pro 1st Generation", 52, 0, seller(99.5, "3K")), "clear", "different model", "good", "43%: the older generation"),
  cheap(ebay("nintendo switch", "Nintendo Switch Lite Turquoise", 85, 0, seller(99.7, 900)), "clear", "different model", "good", "43% of a search that mixes models"),
  cheap(ebay("pentax k1000", "Pentax K1000 SLR body, meter dead, shutter works", 45, 12, seller(99.6, 800)), "clear", "flaw", "good", "46%"),
  cheap(ebay("canon ae-1", "Canon AE-1 Program - shutter squeak, as found", 60, 15, seller(99.4, 260)), "clear", "flaw", "fair", "47%"),
  // eBay, no reason on the card
  cheap(ebay("nintendo switch oled", "Nintendo Switch OLED White - moving sale, works perfectly", 125, 0, seller(100, 0)), "warn", "quick sale", "suspicious", "50% from a new seller: moving isn't a reason"),
  cheap(ebay("nintendo switch oled", "Nintendo Switch OLED White Console", 125, 0, seller(100, 1)), "warn", "none", "suspicious", "50% from a new seller, no reason (the PR #54 trade-off)"),
  cheap(ebay("nintendo switch oled", "Nintendo Switch OLED White Console", 132, 0, seller(100, 6)), "warn", "none", "suspicious", "52% from a seller with 6 ratings"),
  // Marketplace, with a reason
  cheap(fb("ps5 console", "PS5 disc, controller has drift, moving", 140), "clear", "flaw", "good", "46% of pickup"),
  cheap(fb("macbook air m1", "MacBook Air M1 2020 cracked bezel works", 190), "clear", "flaw", "good", "47% of pickup"),
  cheap(fb("iphone 13 128gb", "iPhone 13 128gb small crack on back, battery 80%", 140), "clear", "flaw", "good", "50% of pickup"),
  cheap(fb("iphone 13 128gb", "iPhone 13 mini 128gb", 140), "clear", "different model", "good", "50% of pickup"),
  cheap(fb("nintendo switch", "Nintendo Switch Lite gray", 80), "clear", "different model", "good", "43% of pickup"),
  cheap(fb("dewalt dcd771", "DeWalt DCD771 drill, no charger, one battery", 28), "clear", "missing parts", "good", "45% of pickup"),
  // Marketplace, no reason
  cheap(fb("nintendo switch oled", "Nintendo Switch OLED - moving, need gone", 110), "warn", "quick sale", "suspicious", "46% of pickup"),
  cheap(fb("nintendo switch oled", "Switch OLED", 115), "warn", "none", "suspicious", "48% of pickup"),
  cheap(fb("ps5 console", "PS5", 160), "warn", "none", "suspicious", "52% of pickup"),
  cheap(fb("pentax k1000", "Old Pentax camera K1000 my dads", 45), "warn", "none", "suspicious", "41% of pickup, an estate find"),
  cheap(fb("nintendo switch oled", "Nintendo Switch OLED", 120, { page: "Joined Facebook in 2026. Moving out of state, must sell this week." }), "warn", "quick sale", "suspicious", "50% from an account made this year"),
];
