// Settings page: the model fields are menus. Reports PASS/FAIL into <pre id="result">.
(async () => {
  const out = [];
  const check = (n, ok, why = "") => out.push(`${ok ? "PASS" : "FAIL"} ${n}${ok ? "" : ": " + why}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const $ = (id) => document.getElementById(id);
  const choose = async (sel, value) => { sel.value = value; sel.dispatchEvent(new Event("change", { bubbles: true })); await wait(150); };
  try {
    await wait(800);
    const cl = $("anthropicModelPick"), cin = $("anthropicModel");
    check("Claude model is a menu with the three models", !!cl && [...cl.options].filter((o) => o.value && !o.value.startsWith("\u0000")).length === 3, cl ? [...cl.options].map((o) => o.value).join(",") : "no menu");
    check("saved Claude model is selected and its text box hidden", cl.value === "claude-sonnet-5-5" && cin.hidden, `value ${cl.value}, hidden ${cin.hidden}`);
    check("the menu is what the label points to", document.querySelector('label[for="anthropicModelPick"]') !== null, "label still points at the text box");
    await choose(cl, "claude-haiku-4-5");
    check("picking a model saves it", __store.anthropicModel === "claude-haiku-4-5", `stored ${__store.anthropicModel}`);
    await choose(cl, "\u0000other");
    check("Another model shows the text box", !cin.hidden, "still hidden");
    cin.value = "claude-experimental-1"; cin.dispatchEvent(new Event("change", { bubbles: true })); await wait(150);
    check("a typed model ID is saved and stays on Another model", __store.anthropicModel === "claude-experimental-1" && cl.value === "\u0000other" && !cin.hidden, `stored ${__store.anthropicModel}, menu ${cl.value}`);

    const oai = $("oaiModelPick"), oaiVis = $("oaiVisionModelPick");
    check("other-service model menu lists the models found by Test connection", [...oai.options].some((o) => o.value === "gpt-4o"), [...oai.options].map((o) => o.value).join(","));
    check("photo model menu starts on 'same as the model above'", oaiVis.value === "" && /Same as/.test(oaiVis.options[0].textContent), `value "${oaiVis.value}"`);
    await choose(oai, "o3-mini");
    check("picking a service model saves it", __store.oaiModel === "o3-mini", `stored ${__store.oaiModel}`);

    const tm = $("textModelPick");
    check("Ollama ranking model lists the installed models", [...tm.options].some((o) => o.value === "moondream:latest") && tm.value === "qwen3:4b", `value ${tm.value}`);
    check("a theme menu is there", $("theme").tagName === "SELECT", "no theme select");
  } catch (e) {
    out.push("FAIL harness: " + e.message);
  }
  document.body.insertAdjacentHTML("beforeend", `<pre id="result">${out.join("\n")}</pre>`);
})();
