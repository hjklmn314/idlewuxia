import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv/dist/2020.js";
import { COMBAT_CAPABILITIES, validateCombatContent } from "../src/combatSession.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(root, "config", "wuxia_combat_content.json");
const content = JSON.parse(fs.readFileSync(file, "utf8"));
const schema = JSON.parse(fs.readFileSync(path.join(root, "config", "wuxia_combat_content.schema.json"), "utf8"));
const ajv = new Ajv({ allErrors: true, strict: false });
const ajvValidate = ajv.compile(schema);
const schemaAccepted = ajvValidate(content);
const report = {
  generatedAt: new Date().toISOString(),
  sourceFile: "config/wuxia_combat_content.json",
  schemaValidation: { accepted: schemaAccepted, errors: ajvValidate.errors || [] },
  validation: validateCombatContent(content),
  supportedSkillKinds: COMBAT_CAPABILITIES.skillKinds,
  supportedEffectKinds: COMBAT_CAPABILITIES.effectKinds,
  supportedTargetSelectors: COMBAT_CAPABILITIES.targetSelectors,
  supportedBuffControls: COMBAT_CAPABILITIES.buffControls,
  supportedBuffFeatures: COMBAT_CAPABILITIES.buffFeatures,
};
fs.mkdirSync(path.join(root, "outputs", "combat"), { recursive: true });
fs.writeFileSync(path.join(root, "outputs", "combat", "combat_content_validation.json"), JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify(report, null, 2));
if (!report.schemaValidation.accepted || !report.validation.accepted) process.exit(1);
