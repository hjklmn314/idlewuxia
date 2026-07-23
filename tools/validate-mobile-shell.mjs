import fs from "node:fs";
import path from "node:path";

const root = path.resolve(".");
const outputDir = path.join(root, "outputs");
fs.mkdirSync(outputDir, { recursive: true });
const identity = JSON.parse(
  fs.readFileSync(path.join(root, "config", "android_identity_contract.json"), "utf8").replace(/^\uFEFF/, ""),
);
const mainActivityPath = path.join(root, ...identity.paths.mainActivity.split("/"));

const files = {
  mainActivity: fs.readFileSync(mainActivityPath, "utf8"),
  styles: fs.readFileSync(path.join(root, "android", "app", "src", "main", "res", "values", "styles.xml"), "utf8"),
  manifest: fs.readFileSync(path.join(root, "android", "app", "src", "main", "AndroidManifest.xml"), "utf8"),
  index: fs.readFileSync(path.join(root, "index.html"), "utf8"),
  css: fs.readFileSync(path.join(root, "src", "wuxia.css"), "utf8"),
  uiShell: fs.readFileSync(path.join(root, "config", "ui_shell_contract.json"), "utf8"),
};

const uiShell = JSON.parse(files.uiShell);
const mobileLayout = uiShell.mobileLayout || {};
const bottomPanel = mobileLayout.bottomPanel || {};
const playfield = mobileLayout.playfield || {};

const checks = [];
const findings = [];

function check(name, pass, detail, evidence = {}) {
  checks.push({ name, status: pass ? "pass" : "fail", detail, evidence });
  if (!pass) findings.push({ severity: "error", name, detail, evidence });
}

function has(file, terms) {
  return terms.every((term) => files[file].includes(term));
}

function clamp(min, value, max) {
  return Math.max(min, Math.min(value, max));
}

function mobileEstimate(width, height) {
  const tabHeight = clamp(bottomPanel.tabHeightMinPx, height * 0.062, bottomPanel.tabHeightMaxPx);
  const cardHeight = clamp(bottomPanel.cardHeightMinPx, height * 0.108, bottomPanel.cardHeightMaxPx);
  const cardWidth = clamp(bottomPanel.cardWidthMinPx, width * 0.2, bottomPanel.cardWidthMaxPx);
  const panelHeight = tabHeight + cardHeight + bottomPanel.tabPageExtraPx + bottomPanel.safeAreaBottomMinPx;
  const visibleCards = Math.floor((width - 20 + 9) / (cardWidth + 9));
  return {
    width,
    height,
    tabHeight: Number(tabHeight.toFixed(2)),
    cardHeight: Number(cardHeight.toFixed(2)),
    cardWidth: Number(cardWidth.toFixed(2)),
    panelHeight: Number(panelHeight.toFixed(2)),
    panelShare: Number((panelHeight / height).toFixed(4)),
    playfieldShare: Number(((height - panelHeight) / height).toFixed(4)),
    visibleCards,
  };
}

check(
  "android activity applies immersive mode",
  has("mainActivity", ["applyImmersiveMode()", "WindowInsets.Type.statusBars()", "WindowInsets.Type.navigationBars()"]),
  "MainActivity must hide status/navigation bars on Android 11+.",
  { file: identity.paths.mainActivity },
);
check(
  "android activity supports legacy immersive flags",
  has("mainActivity", ["SYSTEM_UI_FLAG_IMMERSIVE_STICKY", "SYSTEM_UI_FLAG_FULLSCREEN", "SYSTEM_UI_FLAG_HIDE_NAVIGATION"]),
  "MainActivity must hide system bars on older Android devices.",
  { file: identity.paths.mainActivity },
);
check(
  "android activity reapplies on focus",
  has("mainActivity", ["onWindowFocusChanged", "if (hasFocus)", "applyImmersiveMode();"]),
  "System bars can reappear after gestures; focus regain must reapply immersive mode.",
  { file: identity.paths.mainActivity },
);
check(
  "android theme is fullscreen transparent",
  has("styles", [
    "android:windowFullscreen",
    "android:statusBarColor",
    "@android:color/transparent",
    "android:navigationBarColor",
    "android:windowLayoutInDisplayCutoutMode",
    "shortEdges",
  ]),
  "Theme should not paint opaque system bars around the WebView.",
  { file: "android/app/src/main/res/values/styles.xml" },
);
check(
  "android manifest is portrait game shell",
  has("manifest", ['android:screenOrientation="portrait"', 'android:launchMode="singleTask"', 'android:theme="@style/AppTheme.NoActionBarLaunch"']),
  "APK shell should launch as a portrait game Activity.",
  { file: "android/app/src/main/AndroidManifest.xml" },
);
check(
  "web viewport covers display cutouts",
  has("index", ["viewport-fit=cover", "width=device-width", "initial-scale=1.0"]),
  "Web layer must opt into cutout-safe viewport sizing.",
  { file: "index.html" },
);
check(
  "web shell uses dynamic viewport and safe areas",
  has("css", ["height: 100dvh", "env(safe-area-inset-top)", "env(safe-area-inset-bottom)", ".control-panel", ".topbar"]),
  "CSS must size to mobile dynamic viewport and respect safe-area insets.",
  { file: "src/wuxia.css" },
);
check(
  "mobile layout contract exists",
  Boolean(mobileLayout.bottomPanel && mobileLayout.playfield && Array.isArray(mobileLayout.targetAspectRatios)),
  "UI shell contract must define mobile panel/playfield targets.",
  { file: "config/ui_shell_contract.json" },
);
check(
  "bottom layout css variables exist",
  has("css", [
    "--bottom-tab-h",
    "--bottom-card-w",
    "--bottom-card-h",
    "--tab-page-min-h",
    "--bottom-panel-min-h",
    "--card-label-size",
    "--card-price-size",
  ]),
  "Bottom tabs/cards should be controlled through shared mobile layout variables.",
  { file: "src/wuxia.css" },
);
check(
  "bottom panel consumes layout variables",
  has("css", [
    "min-height: min(var(--bottom-panel-min-h), var(--bottom-panel-max-share))",
    "min-height: var(--bottom-tab-h)",
    "width: var(--bottom-card-w)",
    "height: var(--bottom-card-h)",
    "font-size: var(--card-label-size)",
    "font-size: var(--card-price-size)",
  ]),
  "Control panel, tabs, and upgrade cards must consume shared mobile variables.",
  { file: "src/wuxia.css" },
);
check(
  "bottom tabs are touch scroll safe",
  has("css", [".bottom-tabs", "overflow-x: auto", "touch-action: pan-x", "-webkit-overflow-scrolling: touch", "scroll-snap-type: x mandatory"]),
  "Bottom tab strip must keep native horizontal touch behavior available on narrow devices.",
  { file: "src/wuxia.css" },
);
check(
  "upgrade rails are touch scroll safe",
  has("css", [".upgrade-grid", ".mini-grid", ".slot-row", "overflow-x: auto", "touch-action: pan-x", "scroll-snap-type: x proximity"]),
  "Upgrade cards and slot chips must scroll horizontally on mobile instead of clipping.",
  { file: "src/wuxia.css" },
);

const targetDevices = [
  { width: 360, height: 640, label: "compact-9x16" },
  { width: 390, height: 844, label: "iphone-portrait" },
  { width: 412, height: 915, label: "android-tall" },
  { width: 430, height: 932, label: "large-android-tall" },
];
const estimates = targetDevices.map((device) => ({ ...device, ...mobileEstimate(device.width, device.height) }));
check(
  "bottom panel keeps enough playfield",
  estimates.every((item) => item.panelShare <= bottomPanel.maxViewportShare && item.playfieldShare >= playfield.minViewportShare),
  "Bottom panel should not crowd out the combat field on common portrait devices.",
  { estimates, maxViewportShare: bottomPanel.maxViewportShare, minPlayfieldShare: playfield.minViewportShare },
);
check(
  "upgrade rail shows multiple cards",
  estimates.every((item) => item.visibleCards >= 3),
  "Horizontal card rails should show at least three full cards before scrolling.",
  { estimates },
);

const report = {
  generatedAt: new Date().toISOString(),
  scope: "Android mobile shell and safe-area validation",
  estimates,
  checks,
  findings,
  summary: {
    total: checks.length,
    passed: checks.filter((item) => item.status === "pass").length,
    failed: findings.length,
  },
};

function markdown(reportData) {
  return [
    "# Mobile Shell Validation",
    "",
    `Generated: ${reportData.generatedAt}`,
    `Scope: ${reportData.scope}`,
    "",
    "## Summary",
    "",
    `Checks: ${reportData.summary.total}`,
    `Passed: ${reportData.summary.passed}`,
    `Failed: ${reportData.summary.failed}`,
    "",
    "## Checks",
    "",
    "| Status | Check | Detail |",
    "| --- | --- | --- |",
    ...reportData.checks.map((item) => `| ${item.status.toUpperCase()} | ${item.name} | ${item.detail} |`),
    "",
    "## Device Estimates",
    "",
    "| Device | Size | Panel share | Playfield share | Visible cards |",
    "| --- | --- | ---: | ---: | ---: |",
    ...reportData.estimates.map(
      (item) =>
        `| ${item.label} | ${item.width}x${item.height} | ${item.panelShare} | ${item.playfieldShare} | ${item.visibleCards} |`,
    ),
    "",
    "## Findings",
    "",
    reportData.findings.length
      ? reportData.findings.map((item) => `- ${item.severity}: ${item.name} - ${item.detail}`).join("\n")
      : "- clean",
    "",
  ].join("\n");
}

fs.writeFileSync(path.join(outputDir, "mobile_shell_validation_report.json"), JSON.stringify(report, null, 2), "utf8");
fs.writeFileSync(path.join(outputDir, "mobile_shell_validation_report.md"), markdown(report), "utf8");

console.log(JSON.stringify(report.summary, null, 2));

if (findings.length) {
  process.exit(1);
}
