import fs from "node:fs";
import path from "node:path";

import {
  configuredSlotCountForWorld,
  resolveSlotMatrix,
  resolveUnlockGate,
} from "../src/unlockGates.js";

const root = path.resolve(".");
const outputDir = path.join(root, "outputs");
fs.mkdirSync(outputDir, { recursive: true });

const uiUnlocks = JSON.parse(fs.readFileSync(path.join(root, "config", "original_ui_unlocks.json"), "utf8"));
const config = { uiUnlocks };
const findings = [];
let checkCount = 0;

function snapshot(worldLevel, overrides = {}) {
  return {
    worldLevel,
    debug: false,
    systems: {},
    weaponLevels: {},
    weaponMods: {},
    ...overrides,
  };
}

function expect(name, condition, detail = "") {
  checkCount += 1;
  if (!condition) findings.push({ severity: "error", name, detail });
}

function gate(state, target) {
  return resolveUnlockGate(config, state, target);
}

const g1 = snapshot(1);
expect("g1.settings.visible.enabled", gate(g1, { type: "sideEntrance", id: "settings" }).visible === true && gate(g1, { type: "sideEntrance", id: "settings" }).enabled === true);
expect("g1.command.visible.enabled", gate(g1, { type: "sideEntrance", id: "command" }).visible === true && gate(g1, { type: "sideEntrance", id: "command" }).enabled === true);
expect("g1.rankings.visible.enabled", gate(g1, { type: "sideEntrance", id: "rankings" }).visible === true && gate(g1, { type: "sideEntrance", id: "rankings" }).enabled === true);
expect("g1.bottomTabs.visible", uiUnlocks.bottomTabs.every((tab) => gate(g1, { type: "bottomTab", id: tab.id }).visible));
expect("g1.drone.slot.ready", gate(g1, { type: "slotUnlock", groupId: "drone" }).available === true);
expect("g1.vacuum.slot.locked.to.g2", gate(g1, { type: "slotUnlock", groupId: "vacuum" }).nextRequiredGalaxy === 2 && gate(g1, { type: "slotUnlock", groupId: "vacuum" }).ghost === true);
expect("g1.mortar.locked", gate(g1, { type: "weapon", id: "mortar" }).unlocked === false);

const g2 = snapshot(2);
expect("g2.vacuum.slot.ready", gate(g2, { type: "slotUnlock", groupId: "vacuum" }).available === true);
expect("g2.nextGalaxyShortcut.visible", gate(g2, { type: "sideEntrance", id: "nextGalaxyShortcut" }).visible === true);

const g8 = snapshot(8, {
  systems: { droneWing: 3, vacuumPull: 3 },
  weaponLevels: { tesla: 1 },
});
expect("g8.drone.fourth.slot.ready", gate(g8, { type: "slotUnlock", groupId: "drone" }).available === true);
expect("g8.vacuum.max.after.four.slots", gate(g8, { type: "slotUnlock", groupId: "vacuum" }).available === true);
expect("g8.tesla.unlocked", gate(g8, { type: "weapon", id: "tesla" }).unlocked === true);
expect("g8.laser.locked.to.g9", gate(g8, { type: "weapon", id: "laser" }).unlocked === false && gate(g8, { type: "weapon", id: "laser" }).unlockGalaxy === 9);
expect("g8.tesla.damage.available.after.count", gate(g8, { type: "weaponPart", weaponId: "tesla", partId: "damage" }).available === true);

const g36Debug = snapshot(36, {
  debug: true,
  systems: { droneWing: 6, vacuumPull: 4 },
  weaponLevels: { plasma: 1 },
});
expect("g36.command.visible", gate(g36Debug, { type: "sideEntrance", id: "command" }).visible === true);
expect("g36.plasma.unlocked", gate(g36Debug, { type: "weapon", id: "plasma" }).unlocked === true);
expect("g36.plasma.charge.available.after.count", gate(g36Debug, { type: "weaponPart", weaponId: "plasma", partId: "charge" }).available === true);
expect("g36.drone.slot.max", gate(g36Debug, { type: "slotUnlock", groupId: "drone" }).label === "MAX");
expect("g36.vacuum.slot.max", gate(g36Debug, { type: "slotUnlock", groupId: "vacuum" }).label === "MAX");

const droneSlotsAt8 = resolveSlotMatrix(config, g8, "drone");
expect("slotMatrix.g8.drone.has.next.fourth", droneSlotsAt8[3]?.state === "next");
expect("configuredSlotCount.g8.drone", configuredSlotCountForWorld(config, "drone", 8) === 4);
expect("configuredSlotCount.g36.plasmaBaseline", configuredSlotCountForWorld(config, "vacuum", 36) === 4);

const report = {
  generatedAt: new Date().toISOString(),
  scenarios: ["g1", "g2", "g8", "g36Debug"],
  checks: checkCount,
  findings,
};

fs.writeFileSync(path.join(outputDir, "unlock_gate_validation_report.json"), JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify(report, null, 2));

if (findings.some((item) => item.severity === "error")) {
  process.exit(1);
}
