// hub.html?popup is the toolbar icon's popup: marked before the page draws, so it lays out narrow from the start
// (a file, not an inline script: extension pages don't run inline scripts).
if (new URLSearchParams(location.search).has("popup")) document.documentElement.classList.add("popup");
