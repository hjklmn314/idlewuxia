import assert from "node:assert/strict";
import fs from "node:fs";
import { createWuxiaDomAdapter } from "../src/wuxiaDomAdapter.js";

class FakeElement {
  constructor(selector = "") {
    this.selector = selector;
    this.dataset = {};
    this.style = { values: {}, setProperty: (key, value) => { this.style.values[key] = value; } };
    this.classList = { values: new Set(), add: (value) => this.classList.values.add(value), toggle: () => {} };
    this.listeners = new Map();
    this.textContent = "";
    this.innerHTML = "";
    this.disabled = false;
    this.hidden = false;
  }

  querySelector(selector) { return this.children?.get(selector) || null; }
  querySelectorAll(selector) { return this.selectorResults?.get(selector) || []; }
  addEventListener(type, handler) { this.listeners.set(type, handler); }
  setAttribute(name, value) { this[name] = value; }
}

const title = new FakeElement("#wuxiaScreenTitle");
const step = new FakeElement("#wuxiaFlowStep");
const stage = new FakeElement(".wuxia-stage");
const back = new FakeElement("back");
const home = new FakeElement("home");
const body = new FakeElement("body");
const root = new FakeElement("html");
const documentRef = {
  body,
  documentElement: root,
  visibilityState: "visible",
  activeElement: null,
  children: new Map([
    ["#wuxiaScreenTitle", title],
    ["#wuxiaFlowStep", step],
    [".wuxia-stage", stage],
    ["[data-wuxia-action='back']", back],
    ["[data-wuxia-action='home']", home],
    ["body", body],
  ]),
  querySelector(selector) { return this.children.get(selector) || null; },
  querySelectorAll() { return []; },
  addEventListener() {},
};

const action = new FakeElement("action");
action.dataset.wuxiaActionId = "configured-action";
stage.selectorResults = new Map([["[data-wuxia-action-id]", [action]]]);

const executed = [];
const adapter = createWuxiaDomAdapter({
  documentRef,
  execute: (intent) => { executed.push(intent); return { accepted: true }; },
  persistence: null,
});

const presentation = {
  title: "配置标题",
  step: "1/1",
  screenId: "configured-screen",
  snapshot: { currentState: "configured-state" },
  screen: { mode: "story", nav: { left: "返回", right: "主页" }, navActions: { left: "back-id", right: "home-id" } },
};
adapter.present({
  presentation,
  markup: "<section data-configured='true'></section>",
  onDispatchAction: (actionId) => executed.push({ type: "dispatchAction", actionId }),
  onSelectNode: () => {},
  onResolveChoice: () => {},
  onSelectRoom: () => {},
  onSelectNpc: () => {},
  onInteractNpc: () => {},
  onSelectInteractable: () => {},
  onInteractInteractable: () => {},
});
assert.equal(title.textContent, "配置标题");
assert.equal(step.textContent, "1/1");
assert.equal(stage.innerHTML, "<section data-configured='true'></section>");
assert.equal(body.dataset.wuxiaScreen, "configured-screen");
assert.equal(back.dataset.wuxiaActionId, "back-id");
assert.equal(home.dataset.wuxiaActionId, "home-id");
action.listeners.get("click")();
assert.deepEqual(executed.at(-1), { type: "dispatchAction", actionId: "configured-action" });

adapter.applyMobileLayout({ contentMaxWidthPx: 412, orientation: "portrait", safeArea: { top: "env(safe-area-inset-top)" } });
assert.equal(root.style.values["--wuxia-content-max-width"], "412px");
assert.equal(body.dataset.wuxiaOrientation, "portrait");
assert.equal(body.dataset.wuxiaSafeArea, "false");

const mainSource = fs.readFileSync(new URL("../src/wuxia-main.js", import.meta.url), "utf8");
const wuxiaCss = fs.readFileSync(new URL("../src/wuxia.css", import.meta.url), "utf8");
const scope = JSON.parse(fs.readFileSync(new URL("../config/project_scope.json", import.meta.url), "utf8"));
assert.equal(mainSource.includes("document."), false, "DOM ownership must stay in wuxiaDomAdapter");
assert.equal(mainSource.includes("querySelector"), false, "DOM queries must stay in wuxiaDomAdapter");
assert.equal(mainSource.includes(".onclick"), false, "DOM event binding must stay in wuxiaDomAdapter");
assert.equal(scope.shippingFiles.includes("src/wuxia.css"), true);
assert.equal(scope.shippingFiles.includes("src/styles.css"), false);
assert.equal(scope.shippingFiles.includes("src/legacy-shooting.css"), false);
for (const forbidden of ["gameCanvas", "fireTesla", "bossNovaReactor", "clean_the_dots", "paint_bloom", "cash_vacuum", "space_glass_ui", ".rail-dot", ".control-panel"]) {
  assert.equal(wuxiaCss.includes(forbidden), false, `legacy selector leaked into Wuxia CSS: ${forbidden}`);
}

console.log("Wuxia UI architecture contract tests: PASS");
