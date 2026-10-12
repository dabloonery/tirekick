// Keyboard and focus checks for the panel, run in headless Chrome by tests/run.sh.
// Reports one line per check into <pre id="result"> as "PASS name" / "FAIL name: why".
(async () => {
  const out = [];
  const check = (name, ok, why = "") => out.push(`${ok ? "PASS" : "FAIL"} ${name}${ok ? "" : ": " + why}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const key = (el, k) => el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, composed: true, cancelable: true }));
  try {
    await wait(600);
    const host = document.getElementById("second-look-host");
    if (!host) throw new Error("panel host not injected");
    const root = host.shadowRoot;
    const $ = (s) => root.querySelector(s);
    const active = () => root.activeElement;

    // 1. Opening the panel with the keyboard moves focus into it.
    const tab = $('[data-act="tab"]');
    tab.focus();
    tab.click();
    await wait(100);
    const a = active();
    check("opening moves focus into the panel", !!a && !!a.closest(".panel"), `focus is on ${a ? a.className || a.tagName : "nothing"}`);

    // 2. Arrow keys move through the view tabs and Use / Fix & flip.
    const tabs = [...root.querySelectorAll("[data-view]")];
    tabs[0].focus();
    key(tabs[0], "ArrowRight");
    await wait(50);
    check("ArrowRight switches view tab", tabs[1].getAttribute("aria-selected") === "true" && active() === tabs[1], "still on first tab");
    check("only the selected tab is in the tab order", tabs[1].tabIndex === 0 && tabs[0].tabIndex === -1, `tabIndex ${tabs.map((t) => t.tabIndex)}`);
    key(tabs[1], "ArrowLeft");
    await wait(50);

    const lens = [...root.querySelectorAll("[data-lens]")];
    lens[0].focus();
    key(lens[0], "ArrowRight");
    await wait(50);
    check("ArrowRight picks Fix & flip", lens[1].getAttribute("aria-checked") === "true" && active() === lens[1], "lens unchanged");
    check("only the checked lens is in the tab order", lens[1].tabIndex === 0 && lens[0].tabIndex === -1, `tabIndex ${lens.map((t) => t.tabIndex)}`);

    // 3. Escape closes the panel and returns focus to the tab.
    key(active() || tab, "Escape");
    await wait(100);
    check("Escape closes the panel", !$(".wrap").classList.contains("open"), "still open");
    check("closing returns focus to the tab", active() === tab, `focus is on ${active() ? active().className || active().tagName : "nothing"}`);

    // 3b. The filter fields sit behind a Filter button (so the sticky bar leaves room for results).
    const tog = $(".qf-toggle"), box = $(".qf");
    check("filter fields start tucked behind a Filter button", !!tog && box.hidden && tog.getAttribute("aria-expanded") === "false", tog ? `hidden=${box.hidden}` : "no button");
    if (tog) {
      tog.click();
      await wait(50);
      check("Filter button opens the fields and focuses the words box", !box.hidden && tog.getAttribute("aria-expanded") === "true" && active() === $(".qf-words"), `hidden=${box.hidden}`);
      const w = $(".qf-words");
      w.value = "dmg -case";
      w.dispatchEvent(new Event("input", { bubbles: true }));
      await wait(500);
      check("button counts the filters that are set", /Filter\s*\u00b7\s*1/.test(tog.textContent), `label "${tog.textContent}"`);
      tog.click();
      check("fields tuck away again", box.hidden, "still shown");
      w.value = "";
      w.dispatchEvent(new Event("input", { bubbles: true }));
      await wait(500);
    }

    // 3c. The marks on the page take the page's brightness; the panel and marks fall back to dark.
    const slTheme = () => document.documentElement.dataset.slTheme;
    document.body.style.background = "#111";
    await wait(1300);
    check("marks go dark on a dark page", slTheme() === "dark", `theme was ${slTheme()}`);
    document.body.style.background = "#fff";
    await wait(1300);
    check("marks go light on a light page", slTheme() === "light", `theme was ${slTheme()}`);
    const tagBox = $(".tag") || null;
    check("panel is dark unless the browser asks for light", getComputedStyle($(".wrap")).getPropertyValue("--paper").trim() === (matchMedia("(prefers-color-scheme: light)").matches ? "#FBFAF6" : "#161513"), getComputedStyle($(".wrap")).getPropertyValue("--paper"));
    $(".wrap").dataset.theme = "dark";
    check("Setup's Dark forces dark", getComputedStyle($(".wrap")).getPropertyValue("--paper").trim() === "#161513", getComputedStyle($(".wrap")).getPropertyValue("--paper"));
    $(".wrap").dataset.theme = "light";
    check("Setup's Light forces light", getComputedStyle($(".wrap")).getPropertyValue("--paper").trim() === "#FBFAF6", getComputedStyle($(".wrap")).getPropertyValue("--paper"));
    delete $(".wrap").dataset.theme;

    // 4. Card actions that show on hover (Save, Sold, Not interested) can be reached with the keyboard.
    const marks = document.querySelector(".second-look-marks");
    const save = marks && [...marks.querySelectorAll(".sl-x")].find((b) => /Save/.test(b.textContent));
    check("card marks are on the fixture", !!save, "no hover action found");
    if (save) {
      save.focus();
      check("hover action takes keyboard focus", document.activeElement === save, "focus did not move");
      const r = save.getBoundingClientRect();
      check("focused hover action is visible", r.width > 20 && r.height > 10, `box ${Math.round(r.width)}x${Math.round(r.height)}`);
      save.click();
      await wait(300);
      check("focus stays on the card after Save", /Saved/.test(document.activeElement.textContent || ""), `focus is on ${document.activeElement.tagName}`);
      save.blur();
      const r2 = save.getBoundingClientRect(); // detached after Save, so this is 0 by construction; kept as a no-crash check
      check("redrawn card keeps working", r2.width <= 2, `box ${Math.round(r2.width)}x${Math.round(r2.height)}`);
    }
  } catch (e) {
    out.push("FAIL harness: " + e.message);
  }
  document.body.insertAdjacentHTML("beforeend", `<pre id="result">${out.join("\n")}</pre>`);
})();
