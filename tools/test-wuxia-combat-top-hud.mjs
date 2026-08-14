import assert from "node:assert/strict";
import fs from "node:fs";
import { buildCombatTopHudModel, renderCombatTopHud } from "../src/combatTopHud.js";
import { validateCombatTopHudContract } from "./validate-wuxia-combat-top-hud-test-helper.mjs";

const contract = JSON.parse(fs.readFileSync("config/wuxia_combat_top_hud.json", "utf8"));
assert.equal(validateCombatTopHudContract(contract).valid, true);

const units = [
  { unitId: "p1", name: "无名少女", hp: 80, alive: true, visual: { symbol: "侠" } },
  { unitId: "p2", name: "同门", hp: 0, alive: false, visual: { symbol: "同" } },
  { unitId: "e1", name: "武馆老管家", hp: 60, alive: true, visual: { symbol: "馆" } },
  { unitId: "e2", name: "青衣刀客", hp: 40, alive: true, visual: { symbol: "刀" } },
];
const model = buildCombatTopHudModel({
  contract,
  encounterId: "encounter_hidden_from_player",
  encounterLabel: "武馆试招",
  status: "active",
  round: 2,
  turnOrder: ["p1", "e1", "e2", "p2"],
  turnIndex: 1,
  units,
  playerUnitIds: ["p1", "p2"],
  enemyUnitIds: ["e1", "e2"],
});
assert.equal(model.currentActorId, "e1");
assert.equal(model.nextActorId, "e2");
assert.equal(model.tokens.filter((token) => token.state === "current").length, 1);
assert.equal(model.tokens.find((token) => token.unitId === "p2").state, "defeated");
assert.equal(model.tokens.find((token) => token.unitId === "e1").actorMount, "enemy-stage-e1");
const html = renderCombatTopHud(model);
assert.match(html, /data-testid="combat-top-hud"/);
assert.match(html, /data-wuxia-combat-top-current-actor="e1"/);
assert.match(html, /data-wuxia-combat-top-next-actor="e2"/);
assert.match(html, /武馆试招/);
assert.doesNotMatch(html, />encounter_hidden_from_player</);
assert.equal((html.match(/class="wuxia-combat-top-token[^\"]* current/g) || []).length, 1);

const paused = buildCombatTopHudModel({ ...model, contract, paused: true, turnIndex: 1, units, turnOrder: ["p1", "e1", "e2", "p2"], playerUnitIds: ["p1", "p2"], enemyUnitIds: ["e1", "e2"] });
assert.equal(paused.currentActorId, "e1");
assert.match(renderCombatTopHud(paused), /已暂停/);

console.log("combat top HUD runtime tests: PASS (config binding, current/next/defeated semantics, pause context, no raw encounter ID text)");
