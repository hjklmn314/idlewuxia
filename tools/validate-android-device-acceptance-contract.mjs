import fs from "node:fs";
import path from "node:path";
import { auditAndroidDeviceContract, validateAndroidDeviceContractSchema } from "./lib/android-device-acceptance.mjs";

const root = process.cwd();
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8").replace(/^\uFEFF/, ""));
const contractPath = process.argv.find((value) => value.startsWith("--contract="))?.slice(11) || "config/android_device_acceptance_contract.json";
const contract = readJson(contractPath);
const schema = readJson(contract.schemaPath || "config/android_device_acceptance_contract.schema.json");
const schemaResult = validateAndroidDeviceContractSchema(contract, schema);
const semanticResult = schemaResult.pass ? auditAndroidDeviceContract(contract) : { pass: false, findings: [] };
const report = {
  $schema: "idlewuxia.android_device_acceptance_contract_validation.v1",
  generatedAt: new Date().toISOString(),
  status: schemaResult.pass && semanticResult.pass ? "pass" : "fail",
  contractPath,
  schemaErrors: schemaResult.errors,
  semanticFindings: semanticResult.findings,
  matrix: semanticResult.matrix || null,
};
const output = path.join(root, "outputs/android_device_acceptance_contract/validation-report.json");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (report.status !== "pass") process.exitCode = 1;
