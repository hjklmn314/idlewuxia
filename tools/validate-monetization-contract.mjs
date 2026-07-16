import fs from "node:fs";
import path from "node:path";

import {
  analyzeMonetizationContract,
  markdownMonetizationSummary,
} from "../src/monetizationContractAudit.js";

const root = path.resolve(".");
const configDir = path.join(root, "config");
const outputDir = path.join(root, "outputs");
fs.mkdirSync(outputDir, { recursive: true });

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(configDir, file), "utf8"));
}

const generatedAt = new Date().toISOString();
const report = {
  generatedAt,
  files: {
    contract: "config/monetization_backend_contract.json",
    guardrails: "config/ads_iap_guardrails.json",
    balanceOverlay: "config/optimized_balance_overlay.p0e.json",
    uiProgression: "config/ui_progression_catalog.json",
    iapProductCatalog: "config/iap_product_catalog.json",
    runtimeSource: "src/main.js",
  },
  ...analyzeMonetizationContract({
    contract: readJson("monetization_backend_contract.json"),
    guardrails: readJson("ads_iap_guardrails.json"),
    balanceOverlay: readJson("optimized_balance_overlay.p0e.json"),
    uiProgression: readJson("ui_progression_catalog.json"),
    iapProductCatalog: readJson("iap_product_catalog.json"),
    runtimeSource: fs.readFileSync(path.join(root, "src", "main.js"), "utf8"),
  }),
};

fs.writeFileSync(
  path.join(outputDir, "monetization_contract_validation_report.json"),
  JSON.stringify(report, null, 2),
  "utf8",
);

fs.writeFileSync(
  path.join(outputDir, "monetization_contract_validation_summary.md"),
  markdownMonetizationSummary(report, generatedAt),
  "utf8",
);

console.log(JSON.stringify(report.summary, null, 2));

if (report.findings.some((item) => item.severity === "error")) {
  process.exit(1);
}
