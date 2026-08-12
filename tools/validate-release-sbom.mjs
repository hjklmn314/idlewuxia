import fs from "node:fs";
import path from "node:path";
import contract from "../config/production/release_build_contract.json" with { type: "json" };
import { auditCycloneDx16Bom } from "./lib/release-build.mjs";

const file = path.join(process.cwd(), contract.sbom.outputPath);
if (!fs.existsSync(file)) {
  console.error(JSON.stringify({ status: "fail", findings: [{ severity: "P0", type: "sbom-file-missing", path: contract.sbom.outputPath }] }, null, 2));
  process.exit(1);
}
const bom = JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
const audit = auditCycloneDx16Bom(bom, { requireComplete: true });
const report = { schema: "idlewuxia.release_sbom_validation.v1", status: audit.pass ? "pass" : "fail", ...audit };
console.log(JSON.stringify(report, null, 2));
if (!audit.pass) process.exit(1);
