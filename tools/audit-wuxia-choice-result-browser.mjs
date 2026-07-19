import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "outputs", "t02_03a_choice_result");
const args = Object.fromEntries(process.argv.slice(2).map((entry) => {
  const [key, ...parts] = entry.replace(/^--/, "").split("=");
  return [key, parts.join("=")];
}));
const require = createRequire(import.meta.url);
const playwright = args["module-root"]
  ? require(path.join(args["module-root"], "playwright-core"))
  : require("playwright-core");
const edgePath = args["browser-path"]
  || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function startServer() {
  const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url || "/", "http://127.0.0.1").pathname)
      .replace(/^\/+/, "");
    const target = path.resolve(root, pathname || "index.html");
    if (!target.startsWith(root)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }
    fs.readFile(target, (error, data) => {
      if (error) {
        response.writeHead(404);
        response.end("Not found");
        return;
      }
      response.writeHead(200, {
        "Content-Type": contentTypes[path.extname(target)] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      response.end(data);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

const entryActions = [
  "ACTION_FS_001_ORIGIN_SCHOLAR",
  "ACTION_FS_001_ORIGIN_RESULT_CONTINUE",
  "ACTION_FS_002_TITLE_START",
  "ACTION_FS_003_CHARACTER_STATUS",
  "ACTION_FS_004_IDLE_CONFIRM",
  "ACTION_FS_005_IDLE_TASK_CLICK_POOL_FISH",
  "ACTION_FS_005_IDLE_TASK_LIST_CONTINUE",
  "ACTION_FS_007_CHAPTER_CARD_ENTRY",
];

async function openChoice(page, baseUrl) {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  for (const actionId of entryActions) {
    const outcome = await page.evaluate(
      (id) => window.__idleWuxiaAutomation.dispatchAction(id),
      actionId,
    );
    assert.equal(
      outcome.clicked,
      true,
      `entry action ${actionId} must be accepted: ${JSON.stringify(outcome)}`,
    );
  }
  assert.equal(
    (await page.evaluate(() => window.__idleWuxiaAutomation.selectNpc("tmnpc01d"))).clicked,
    true,
  );
  assert.equal(
    (await page.evaluate(() => window.__idleWuxiaAutomation.interactNpc("tmnpc01d", "custom_caozuo1"))).clicked,
    true,
  );
  await page.locator(".wuxia-choice-dialog").waitFor({ state: "visible" });
}

fs.mkdirSync(outDir, { recursive: true });
const server = await startServer();
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}/`;
const browser = await playwright.chromium.launch({
  headless: true,
  executablePath: edgePath,
});
const viewports = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 540, height: 960 },
];
const cases = [];

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    await context.addInitScript(() => window.localStorage.clear());
    const page = await context.newPage();
    const consoleErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(String(error)));
    await openChoice(page, baseUrl);

    const evidence = await page.evaluate(() => {
      const dialog = document.querySelector(".wuxia-choice-dialog");
      const backdrop = document.querySelector(".wuxia-choice-backdrop");
      const screen = document.querySelector(".wuxia-screen");
      const buttons = [...document.querySelectorAll("[data-wuxia-choice-option]")];
      const rect = dialog.getBoundingClientRect();
      return {
        title: document.querySelector("#wuxiaChoiceTitle")?.textContent || "",
        labels: buttons.map((button) => button.textContent.trim()),
        activeOptionId: document.activeElement?.dataset?.wuxiaChoiceOption || "",
        screenInert: Boolean(screen?.inert),
        screenAriaHidden: screen?.getAttribute("aria-hidden"),
        modalRole: dialog?.getAttribute("role"),
        ariaModal: dialog?.getAttribute("aria-modal"),
        choiceId: backdrop?.dataset?.wuxiaChoiceId || "",
        dialogRect: {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
        },
        viewport: { width: window.innerWidth, height: window.innerHeight },
        documentScrollWidth: document.documentElement.scrollWidth,
      };
    });
    assert.equal(evidence.choiceId, "tmchoice01");
    assert.equal(evidence.title.includes("手心劫"), true);
    assert.deepEqual(evidence.labels, ["是", "否"]);
    assert.equal(evidence.activeOptionId, "option_1");
    assert.equal(evidence.screenInert, true);
    assert.equal(evidence.screenAriaHidden, "true");
    assert.equal(evidence.modalRole, "dialog");
    assert.equal(evidence.ariaModal, "true");
    assert.equal(evidence.documentScrollWidth <= evidence.viewport.width, true);
    assert.equal(evidence.dialogRect.left >= 0, true);
    assert.equal(evidence.dialogRect.right <= evidence.viewport.width, true);
    assert.equal(evidence.dialogRect.top >= 0, true);
    assert.equal(evidence.dialogRect.bottom <= evidence.viewport.height, true);

    await page.locator('[data-wuxia-choice-option="option_2"]').click();
    await page.locator(".wuxia-choice-dialog").waitFor({ state: "detached" });
    const resolved = await page.evaluate(() => {
      const snapshot = window.__idleWuxiaAutomation.snapshot();
      const event = snapshot.events.at(-1);
      return {
        pendingChoice: snapshot.pendingChoice,
        eventType: event?.type || "",
        optionId: event?.optionId || "",
        feedback: event?.feedback || "",
      };
    });
    assert.equal(resolved.pendingChoice, null);
    assert.equal(resolved.eventType, "choiceResolved");
    assert.equal(resolved.optionId, "option_2");
    assert.equal(resolved.feedback, "你决定暂时不进修手心劫内功。");
    assert.deepEqual(consoleErrors, []);

    const screenshot = path.join(outDir, `choice_${viewport.width}x${viewport.height}.png`);
    await openChoice(page, baseUrl);
    await page.screenshot({ path: screenshot, fullPage: true });
    cases.push({
      viewport,
      status: "pass",
      evidence,
      resolved,
      consoleErrors,
      screenshot: path.relative(root, screenshot).replaceAll("\\", "/"),
    });
    await context.close();
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

const report = {
  schema: "idlewuxia.choice_result_browser_acceptance.v1",
  generatedAt: new Date().toISOString(),
  status: "pass",
  cases,
};
fs.writeFileSync(
  path.join(outDir, "browser_acceptance.json"),
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8",
);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
