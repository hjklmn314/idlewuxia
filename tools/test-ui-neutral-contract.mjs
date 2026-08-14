import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateUiNeutralContract } from "./validate-ui-neutral-contract.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const base = read("config/production/ui_neutral_visual_contract.json");
const schema = read("config/production/schemas/ui_neutral_visual_contract.schema.json");
const screenContract = read("config/wuxia_first_session_screen_contract.json");
const visualStandard = read("config/production/visual_standard.json");
const clone = (value) => structuredClone(value);

const valid = validateUiNeutralContract({ rootDir: root, contract: base, schema, screenContract, visualStandard });
assert.equal(valid.valid, true, JSON.stringify(valid.findings));
assert.equal(valid.screenBindingCount, 2);
assert.equal(valid.viewportCount, 3);
assert.equal(valid.componentCount, 6);

for (const mutate of [
  (value) => { value.shipping = true; },
  (value) => { value.platform.minimumTouchTargetDp = 43; },
  (value) => { value.screenBindings[0].screenId = "UI_Missing"; },
  (value) => { value.screenBindings[1].requiredIntentTypes = ["inventedIntent"]; },
  (value) => { value.neutralImage.rendering = "colorful-final-art"; },
]) {
  const invalid = clone(base);
  mutate(invalid);
  const result = validateUiNeutralContract({ rootDir: root, contract: invalid, schema, screenContract, visualStandard });
  assert.equal(result.valid, false, "mutated neutral UI contract must fail closed");
}

console.log("UI neutral visual contract tests: PASS (schema + viewport + screen + intent + shipping boundary)");
