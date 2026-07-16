import fs from "node:fs";
import path from "node:path";

const root = path.resolve(".");
const configDir = path.join(root, "config");
const outputDir = path.join(root, "outputs");
fs.mkdirSync(outputDir, { recursive: true });

const files = [
  "skins.json",
  "enemies.json",
  "wave_templates.json",
  "boss_nova_reactor.json",
  "boss_templates.json",
  "worlds_patch.json",
  "ads_iap_guardrails.json",
  "analytics_events.json",
  "original_world_scaling.json",
  "original_world_ui_attributes.json",
  "original_boss_scaling.json",
  "original_boss_rewards.json",
  "original_economy_constants.json",
  "weapon_runtime_tuning.json",
  "presentation_runtime_tuning.json",
  "theme_semantic_contract.json",
  "ad_demo_timelines.json",
  "vfx_recipes.json",
  "ui_shell_contract.json",
  "acceptance_gates_p0d.json",
  "monetization_backend_contract.json",
  "iap_product_catalog.json",
  "optimized_balance_overlay.p0e.json",
  "ui_progression_catalog.json",
  "original_ui_unlocks.json",
  "combat_feedback.json",
];

const findings = [];

function finding(severity, message, file) {
  findings.push({ severity, message, file });
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(path.join(configDir, file), "utf8"));
  } catch (error) {
    finding("error", error.message, file);
    return null;
  }
}

function collectJsonKey(value, targetKey, currentPath = "$", hits = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectJsonKey(item, targetKey, `${currentPath}[${index}]`, hits));
    return hits;
  }
  if (!value || typeof value !== "object") return hits;
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${currentPath}.${key}`;
    if (key === targetKey) hits.push({ path: childPath, object: value, value: child });
    collectJsonKey(child, targetKey, childPath, hits);
  }
  return hits;
}

const data = {};
for (const file of files) {
  if (!fs.existsSync(path.join(configDir, file))) {
    finding("error", "Missing config file", file);
  } else {
    data[file] = readJson(file);
  }
}

const skins = data["skins.json"]?.skins || [];
const enemies = data["enemies.json"]?.enemyTypes || [];
const waves = data["wave_templates.json"]?.waveTemplates || [];
const bosses = data["boss_templates.json"]?.bossTemplates || [];
const worlds = data["worlds_patch.json"]?.worldProgression || [];
const nova = data["boss_nova_reactor.json"];
const guardrails = data["ads_iap_guardrails.json"];
const semantic = data["theme_semantic_contract.json"];
const adDemos = data["ad_demo_timelines.json"];
const uiShell = data["ui_shell_contract.json"];
const monetizationBackend = data["monetization_backend_contract.json"];
const iapProductCatalog = data["iap_product_catalog.json"];
const balanceOverlay = data["optimized_balance_overlay.p0e.json"];
const uiProgression = data["ui_progression_catalog.json"];
const uiUnlocks = data["original_ui_unlocks.json"];
const originalWorldUi = data["original_world_ui_attributes.json"];
const originalEconomy = data["original_economy_constants.json"];
const originalBossRewards = data["original_boss_rewards.json"];
const weaponRuntimeTuning = data["weapon_runtime_tuning.json"];
const presentationRuntime = data["presentation_runtime_tuning.json"];
const combatFeedback = data["combat_feedback.json"];

if (skins.length < 3) finding("error", "Expected at least three skins", "skins.json");
for (const skin of skins) {
  for (const key of ["dot", "swarmDot", "splitter", "shieldNode", "charger", "bossNovaReactor", "cash", "gems"]) {
    if (!skin.entityNames?.[key]) finding("warning", `Skin ${skin.id} missing entity name ${key}`, "skins.json");
  }
}

const enemyIds = new Set(enemies.map((enemy) => enemy.id));
for (const enemy of enemies) {
  if (!(enemy.hpRatio > 0 && enemy.valueRatio > 0 && enemy.entityCost > 0)) {
    finding("error", `Enemy ${enemy.id} ratios/cost must be positive`, "enemies.json");
  }
}

const waveIds = new Set(waves.map((wave) => wave.id));
for (const wave of waves) {
  if (!Array.isArray(wave.quantityRange) || wave.quantityRange[0] > wave.quantityRange[1]) {
    finding("error", `Wave ${wave.id} has invalid quantityRange`, "wave_templates.json");
  }
  for (const enemyId of wave.enemyPool || []) {
    if (!enemyIds.has(enemyId)) finding("error", `Wave ${wave.id} references missing enemy ${enemyId}`, "wave_templates.json");
  }
}

const bossIds = new Set(bosses.map((boss) => boss.id));
bossIds.add("nova_reactor");
for (const world of worlds) {
  for (const waveId of world.waveTypes || []) {
    if (!waveIds.has(waveId)) finding("error", `World ${world.world} references missing wave ${waveId}`, "worlds_patch.json");
  }
  if (world.boss && !bossIds.has(world.boss)) {
    finding("error", `World ${world.world} references missing boss ${world.boss}`, "worlds_patch.json");
  }
}

if (!Array.isArray(nova?.phases) || nova.phases.length < 4) {
  finding("error", "Nova Reactor needs at least four phases", "boss_nova_reactor.json");
}
const novaSpawnWaveHits = collectJsonKey(nova, "spawnWave");
if (novaSpawnWaveHits.length) {
  finding("error", "Nova Reactor must not use production-looking spawnWave; use qaLegacySpawnWave with runtimeScope=qa_legacy", "boss_nova_reactor.json");
}
for (const hit of collectJsonKey(nova, "qaLegacySpawnWave")) {
  if (hit.object?.runtimeScope !== "qa_legacy") {
    finding("error", `qaLegacySpawnWave at ${hit.path} must declare runtimeScope=qa_legacy`, "boss_nova_reactor.json");
  }
}

if (guardrails?.ads?.noForcedInterstitialBeforeSeconds < 300) {
  finding("error", "No-forced-interstitial guardrail must be at least 300 seconds", "ads_iap_guardrails.json");
}
if (guardrails?.iap?.serverVerificationRequired !== true) {
  finding("error", "IAP server verification must be required", "ads_iap_guardrails.json");
}

for (const themeKey of ["blackhole", "clean", "paint"]) {
  if (!semantic?.themes?.[themeKey]) {
    finding("error", `Missing P0D semantic theme ${themeKey}`, "theme_semantic_contract.json");
  } else {
    const sourceId = semantic.themes[themeKey].sourceSkinId;
    if (!skins.some((skin) => skin.id === sourceId)) {
      finding("error", `P0D semantic theme ${themeKey} references missing skin ${sourceId}`, "theme_semantic_contract.json");
    }
  }
}

for (const demoId of ["clean10", "blackhole10", "paint10"]) {
  const timeline = adDemos?.demos?.[demoId];
  if (!Array.isArray(timeline) || timeline.length < 6) {
    finding("error", `Missing or short P0D demo timeline ${demoId}`, "ad_demo_timelines.json");
  } else if (timeline.some((event) => event.action === "spawnWave")) {
    finding("error", `P0D demo ${demoId} must use qaLegacySpawnWave instead of spawnWave`, "ad_demo_timelines.json");
  }
}

if (uiShell?.keepOriginalShell !== true) {
  finding("warning", "P0D UI shell contract should keep original shell", "ui_shell_contract.json");
}

if (monetizationBackend?.targetProviders?.iaa?.primary !== "admob") {
  finding("error", "IAA target provider must be AdMob", "monetization_backend_contract.json");
}
if (monetizationBackend?.targetProviders?.iaa?.serverSideVerificationRequiredForRewarded !== true) {
  finding("error", "Rewarded AdMob placements must require server-side verification", "monetization_backend_contract.json");
}
if (monetizationBackend?.targetProviders?.iap?.android?.backendVerification !== "google_play_developer_api") {
  finding("error", "Android IAP must use Google backend verification", "monetization_backend_contract.json");
}
if (monetizationBackend?.targetProviders?.iap?.ios?.backendVerification !== "app_store_server_api") {
  finding("error", "iOS IAP must use Apple backend verification", "monetization_backend_contract.json");
}
if (monetizationBackend?.nonProductLauncherPolicy?.allowExternalLauncher !== false) {
  finding("error", "External launcher shells must be disallowed", "monetization_backend_contract.json");
}
if (monetizationBackend?.nonProductLauncherPolicy?.allowExternalAdSdkHooks !== false) {
  finding("error", "External ad SDK hooks must be disallowed", "monetization_backend_contract.json");
}
if (monetizationBackend?.nonProductLauncherPolicy?.allowExternalPurchaseHooks !== false) {
  finding("error", "External purchase hooks must be disallowed", "monetization_backend_contract.json");
}
if (monetizationBackend?.nonProductLauncherPolicy?.stripFromDeliverables !== true) {
  finding("error", "Non-product launcher content must be stripped from deliverables", "monetization_backend_contract.json");
}
if (monetizationBackend?.targetProviders?.iap?.productCatalog?.source !== "config/iap_product_catalog.json") {
  finding("error", "IAP product catalog source must point to config/iap_product_catalog.json", "monetization_backend_contract.json");
}
if (iapProductCatalog?.modContentPolicy?.includeModShellProducts !== false) {
  finding("error", "IAP catalog must exclude MOD shell products", "iap_product_catalog.json");
}
if (iapProductCatalog?.modContentPolicy?.includeExternalLauncherProducts !== false) {
  finding("error", "IAP catalog must exclude external launcher products", "iap_product_catalog.json");
}
const iapCatalogProducts = iapProductCatalog?.products || [];
if (iapCatalogProducts.length < 24) {
  finding("error", "IAP catalog must map at least the 24 first-party original products", "iap_product_catalog.json");
}
const iapCatalogIds = new Set(iapCatalogProducts.map((product) => product.backendProductId || product.id));
for (const product of iapCatalogProducts) {
  for (const key of ["id", "type", "backendProductId", "androidProductId", "iosProductId", "status"]) {
    if (!product[key]) finding("error", `IAP catalog product missing ${key}`, "iap_product_catalog.json");
  }
}

if (balanceOverlay?.principles?.preserveOriginalConfigText !== true) {
  finding("error", "P0E overlay must preserve original config text", "optimized_balance_overlay.p0e.json");
}
if (balanceOverlay?.principles?.applyAsOverlayOnly !== true) {
  finding("error", "P0E balance must be applied as overlay only", "optimized_balance_overlay.p0e.json");
}
const firstUpgradeTarget = balanceOverlay?.economy?.pacingTargetsSeconds?.firstUpgrade || [];
if (firstUpgradeTarget[0] < 2 || firstUpgradeTarget[1] > 12 || firstUpgradeTarget[0] >= firstUpgradeTarget[1]) {
  finding("error", "First upgrade pacing target must stay inside 2-12 seconds", "optimized_balance_overlay.p0e.json");
}
const bossP50 = balanceOverlay?.combat?.targetTtkSeconds?.bossP50 || [];
if (bossP50[0] < 30 || bossP50[1] > 90 || bossP50[0] >= bossP50[1]) {
  finding("error", "Boss P50 TTK target should stay in a readable 30-90 second band", "optimized_balance_overlay.p0e.json");
}
const roiShare = balanceOverlay?.economy?.roiRotation?.maxBestChoiceShareOverWindow;
if (!(roiShare > 0.25 && roiShare <= 0.5)) {
  finding("error", "ROI rotation max best-choice share must be between 0.25 and 0.5", "optimized_balance_overlay.p0e.json");
}
const skillEntries = balanceOverlay?.iaa?.skillEntries || {};
for (const skill of ["storm", "dotRain", "goldenDot"]) {
  if (!(skillEntries[skill]?.cooldownSeconds >= 10)) {
    finding("error", `IAA skill ${skill} needs a cooldown >= 10s`, "optimized_balance_overlay.p0e.json");
  }
}

if (presentationRuntime?.status !== "p1-polish-overlay") {
  finding("error", "Presentation runtime tuning must be marked as p1-polish-overlay", "presentation_runtime_tuning.json");
}
if (!(presentationRuntime?.particles?.maxRuntimeParticles >= 300 && presentationRuntime?.particles?.maxRuntimeParticles <= 900)) {
  finding("error", "Presentation particle cap must stay in a mobile-safe 300-900 range", "presentation_runtime_tuning.json");
}
if (!(presentationRuntime?.audio?.masterGain >= 0 && presentationRuntime?.audio?.masterGain <= 0.8)) {
  finding("error", "Presentation audio master gain must stay under 0.8", "presentation_runtime_tuning.json");
}
for (const visual of [
  "enemyCoreAlpha",
  "enemyRimAlpha",
  "enemyOrbitAlpha",
]) {
  const value = presentationRuntime?.visuals?.[visual];
  if (!(value >= 0 && value <= 1)) {
    finding("error", `Presentation visual ${visual} must be in the 0-1 range`, "presentation_runtime_tuning.json");
  }
}
for (const [section, visual] of [
  ["helper", "thrusterAlpha"],
  ["helper", "rangeAlpha"],
  ["turret", "aimLineAlpha"],
  ["turret", "recoilGlowAlpha"],
  ["projectile", "sparkAlpha"],
]) {
  const value = presentationRuntime?.visuals?.[section]?.[visual];
  if (!(value >= 0 && value <= 1)) {
    finding("error", `Presentation visual ${section}.${visual} must be in the 0-1 range`, "presentation_runtime_tuning.json");
  }
}
for (const sfx of ["shoot", "hit", "kill", "upgrade", "skill", "bossHit", "deny"]) {
  const config = presentationRuntime?.audio?.sfx?.[sfx] || {};
  if (!(config.frequency > 0 && config.duration > 0 && config.gain > 0)) {
    finding("error", `Presentation SFX ${sfx} must define positive frequency, duration, and gain`, "presentation_runtime_tuning.json");
  }
}

const validMetrics = new Set([
  "totalKills",
  "totalUpgradeLevels",
  "skillUses",
  "galaxy",
  "bossWins",
  "bossGateProgress",
  "systemLevels",
  "droneLevels",
  "vacuumLevels",
  "economyLevels",
]);
const validStoreActions = new Set(["claim-gift", "preview-iap", "locked"]);
const validCosmeticUnlockActions = new Set(["watch-ad-unlock"]);
const validCosmeticTabs = new Set(["trails", "skins", "explosions"]);
const skinIds = new Set(skins.map((skin) => skin.id));
const strategy = uiProgression?.strategy || {};
if (strategy.productStrategyVersion !== "p0f-low-cpi-default") {
  finding("error", "UI strategy must default to p0f-low-cpi-default", "ui_progression_catalog.json");
}
if (strategy.defaultCosmeticId !== "cash" || strategy.defaultThemeId !== "cash_vacuum") {
  finding("error", "Default UI must use the lowest-CPI Cash Vacuum skin", "ui_progression_catalog.json");
}
if (strategy.premiumCosmeticId !== "space_glass") {
  finding("error", "Premium space UI cosmetic must be space_glass", "ui_progression_catalog.json");
}
if (!(strategy.premiumUnlock?.requiredAds > 0)) {
  finding("error", "Premium space UI skin must require rewarded ad progress", "ui_progression_catalog.json");
}

if (!Array.isArray(uiProgression?.missions) || uiProgression.missions.length < 4) {
  finding("error", "Expected at least four daily missions", "ui_progression_catalog.json");
}
for (const mission of uiProgression?.missions || []) {
  if (!mission.id || !mission.title || !mission.detail) {
    finding("error", "Mission missing id/title/detail", "ui_progression_catalog.json");
  }
  if (!validMetrics.has(mission.metric)) {
    finding("error", `Mission ${mission.id} uses unknown metric ${mission.metric}`, "ui_progression_catalog.json");
  }
  if (!(mission.target > 0)) {
    finding("error", `Mission ${mission.id} target must be positive`, "ui_progression_catalog.json");
  }
  if (!mission.reward || mission.reward.moneyScale === undefined || mission.reward.gems === undefined) {
    finding("error", `Mission ${mission.id} reward must define moneyScale and gems`, "ui_progression_catalog.json");
  }
}

if (!Array.isArray(uiProgression?.achievements) || uiProgression.achievements.length < 6) {
  finding("error", "Expected at least six achievements", "ui_progression_catalog.json");
}
for (const achievement of uiProgression?.achievements || []) {
  if (!validMetrics.has(achievement.metric)) {
    finding("error", `Achievement ${achievement.id} uses unknown metric ${achievement.metric}`, "ui_progression_catalog.json");
  }
  if (!(achievement.target > 0)) {
    finding("error", `Achievement ${achievement.id} target must be positive`, "ui_progression_catalog.json");
  }
  if (!achievement.reward || achievement.reward.moneyScale === undefined || achievement.reward.gems === undefined) {
    finding("error", `Achievement ${achievement.id} reward must define moneyScale and gems`, "ui_progression_catalog.json");
  }
}

if (!Array.isArray(uiProgression?.storeProducts) || uiProgression.storeProducts.length < 5) {
  finding("error", "Expected at least five store products", "ui_progression_catalog.json");
}
for (const product of uiProgression?.storeProducts || []) {
  if (!validStoreActions.has(product.action)) {
    finding("error", `Store product ${product.id} has invalid action ${product.action}`, "ui_progression_catalog.json");
  }
  if (!product.reward || product.reward.moneyScale === undefined || product.reward.gems === undefined) {
    finding("error", `Store product ${product.id} reward must define moneyScale and gems`, "ui_progression_catalog.json");
  }
  if (product.action === "preview-iap" || product.tag === "BACKEND") {
    if (!product.backendProductId || !iapCatalogIds.has(product.backendProductId)) {
      finding("error", `Store product ${product.id} must map to iap_product_catalog backendProductId`, "ui_progression_catalog.json");
    }
  }
}

if (!Array.isArray(uiProgression?.cosmetics) || uiProgression.cosmetics.length < 8) {
  finding("error", "Expected at least eight cosmetic items", "ui_progression_catalog.json");
}
for (const cosmetic of uiProgression?.cosmetics || []) {
  if (!validCosmeticTabs.has(cosmetic.tab)) {
    finding("error", `Cosmetic ${cosmetic.id} has invalid tab ${cosmetic.tab}`, "ui_progression_catalog.json");
  }
  if (cosmetic.themeId && !skinIds.has(cosmetic.themeId)) {
    finding("error", `Cosmetic ${cosmetic.id} references missing skin ${cosmetic.themeId}`, "ui_progression_catalog.json");
  }
  if (cosmetic.unlock) {
    if (!validCosmeticUnlockActions.has(cosmetic.unlock.action)) {
      finding("error", `Cosmetic ${cosmetic.id} has invalid unlock action ${cosmetic.unlock.action}`, "ui_progression_catalog.json");
    }
    if (!(cosmetic.unlock.requiredAds > 0)) {
      finding("error", `Cosmetic ${cosmetic.id} unlock requiredAds must be positive`, "ui_progression_catalog.json");
    }
  }
}

if (uiUnlocks?.drone?.maxSlots !== 6) {
  finding("error", "Original drone unlock must keep six slots", "original_ui_unlocks.json");
}
if (JSON.stringify(uiUnlocks?.drone?.slotRequirementsGalaxy || []) !== JSON.stringify([1, 3, 5, 8, 20, 30])) {
  finding("error", "Original drone slot requirements must be [1,3,5,8,20,30]", "original_ui_unlocks.json");
}
if (uiUnlocks?.vacuum?.maxSlots !== 4) {
  finding("error", "Original vacuum unlock must keep four slots", "original_ui_unlocks.json");
}
if (JSON.stringify(uiUnlocks?.vacuum?.slotRequirementsGalaxy || []) !== JSON.stringify([2, 4, 6, 8])) {
  finding("error", "Original vacuum slot requirements must be [2,4,6,8]", "original_ui_unlocks.json");
}
if (!Array.isArray(uiUnlocks?.bottomTabs) || uiUnlocks.bottomTabs.map((tab) => tab.id).join(",") !== "defense,drone,vacuum,economy,galaxy") {
  finding("error", "Original bottom tab order must be defense,drone,vacuum,economy,galaxy", "original_ui_unlocks.json");
}
if (uiUnlocks?.sideEntrances?.command?.visibleFromGalaxy !== 1 || uiUnlocks?.sideEntrances?.command?.original !== true) {
  finding("error", "Reference command entrance must be visible from galaxy 1", "original_ui_unlocks.json");
}
if (uiUnlocks?.sideEntrances?.rankings?.visibleFromGalaxy !== 1 || uiUnlocks?.sideEntrances?.rankings?.original !== true) {
  finding("error", "Reference rankings entrance must be visible from galaxy 1", "original_ui_unlocks.json");
}
if ((uiUnlocks?.defenseWeapons || []).length < 10) {
  finding("warning", "Defense weapon unlock catalog is incomplete versus original late-game tabs", "original_ui_unlocks.json");
}

const originalBaseCosts = originalEconomy?.baseCosts || {};
const originalGrowthRates = originalEconomy?.growthRates || {};
if (weaponRuntimeTuning?.runtimeOverlay?.status !== "intentional_runtime_overlay") {
  finding("error", "Weapon runtime tuning must explicitly mark cooldown/dps values as intentional_runtime_overlay", "weapon_runtime_tuning.json");
}
for (const field of ["cooldown", "dpsFactor"]) {
  if (!weaponRuntimeTuning?.runtimeOverlay?.overlayFields?.includes(field)) {
    finding("error", `Weapon runtime overlay must include ${field}`, "weapon_runtime_tuning.json");
  }
}
for (const field of ["baseCost", "growth"]) {
  if (!weaponRuntimeTuning?.runtimeOverlay?.referenceDerivedFields?.includes(field)) {
    finding("error", `Weapon runtime tuning must mark ${field} as reference-derived`, "weapon_runtime_tuning.json");
  }
}
for (const [kind, originalKey] of Object.entries(originalEconomy?.upgradeKeyMap || {})) {
  if (!(originalKey in originalBaseCosts)) {
    finding("error", `Upgrade ${kind} maps to missing original base cost ${originalKey}`, "original_economy_constants.json");
  }
  if (!(originalKey in originalGrowthRates)) {
    finding("error", `Upgrade ${kind} maps to missing original growth rate ${originalKey}`, "original_economy_constants.json");
  }
}
if (JSON.stringify(originalEconomy?.slotUnlocks?.droneWing?.requirementsGalaxy || []) !== JSON.stringify([1, 3, 5, 8, 20, 30])) {
  finding("error", "Original economy droneWing slot requirements must be [1,3,5,8,20,30]", "original_economy_constants.json");
}
if (JSON.stringify(originalEconomy?.slotUnlocks?.vacuumPull?.requirementsGalaxy || []) !== JSON.stringify([2, 4, 6, 8])) {
  finding("error", "Original economy vacuumPull slot requirements must be [2,4,6,8]", "original_economy_constants.json");
}
if (originalEconomy?.galaxyTravel?.baseCost !== 5000 || originalEconomy?.galaxyTravel?.growth !== 15) {
  finding("error", "Original galaxy travel must keep baseCost=5000 and growth=15", "original_economy_constants.json");
}
if (originalEconomy?.galaxyTravel?.instantMultiplier !== 2.5) {
  finding("error", "Original instant galaxy travel multiplier must stay 2.5", "original_economy_constants.json");
}
for (const weapon of uiUnlocks?.defenseWeapons || []) {
  if (!Array.isArray(weapon.originalKeys) || weapon.originalKeys.length === 0) {
    finding("error", `Defense weapon ${weapon.id} must expose originalKeys`, "original_ui_unlocks.json");
  }
  const tuning = weaponRuntimeTuning?.weapons?.[weapon.id];
  if (!tuning) {
    finding("error", `Defense weapon ${weapon.id} missing runtime tuning`, "weapon_runtime_tuning.json");
  } else {
    for (const key of ["baseCost", "growth", "cooldown", "dpsFactor"]) {
      if (!(Number(tuning[key]) > 0)) {
        finding("error", `Defense weapon ${weapon.id} tuning ${key} must be positive`, "weapon_runtime_tuning.json");
      }
    }
  }
  for (const originalKey of weapon.originalKeys || []) {
    if (!(originalKey in originalBaseCosts) || !(originalKey in originalGrowthRates)) {
      finding("error", `Defense weapon ${weapon.id} references missing economy key ${originalKey}`, "original_ui_unlocks.json");
    }
  }
  for (const part of weapon.parts || []) {
    if (!part.originalKey) {
      finding("error", `Defense weapon ${weapon.id}.${part.id} must use an originalKey for cost parity`, "original_ui_unlocks.json");
      continue;
    }
    if (!(part.originalKey in originalBaseCosts) || !(part.originalKey in originalGrowthRates)) {
      finding("error", `Defense weapon ${weapon.id}.${part.id} references missing economy key ${part.originalKey}`, "original_ui_unlocks.json");
    }
  }
}

for (const boss of data["original_boss_scaling.json"] || []) {
  const reward = originalBossRewards?.bosses?.[boss.bossId];
  if (!reward) {
    finding("error", `Original boss ${boss.bossId} missing reward config`, "original_boss_rewards.json");
    continue;
  }
  if (!(Number(reward.moneyMultiplier) > 0)) {
    finding("error", `Original boss ${boss.bossId} reward moneyMultiplier must be positive`, "original_boss_rewards.json");
  }
  if (Number(reward.gems) !== Number(boss.bossGems)) {
    finding("error", `Original boss ${boss.bossId} reward gems must match original boss scaling`, "original_boss_rewards.json");
  }
}

const expectedDamageSources = [
  "turret",
  "drone",
  "swipe",
  "vacuum",
  "burn",
  "mortar",
  "marines",
  "tesla",
  "laser",
  "security_beam",
  "missile",
  "railgun",
  "flame",
  "cryo",
  "plasma",
];
const validDeathKinds = new Set(["none", "blast", "embers", "ice_shards", "micro_shards", "beam_trace", "arcs", "spiral"]);
for (const source of expectedDamageSources) {
  const entry = combatFeedback?.damageSources?.[source];
  if (!entry) {
    finding("error", `Combat feedback missing damage source ${source}`, "combat_feedback.json");
    continue;
  }
  if (!/^#[0-9a-f]{6}$/i.test(entry.color || "")) {
    finding("error", `Combat feedback source ${source} must define a hex color`, "combat_feedback.json");
  }
  if (!(entry.impact > 0)) {
    finding("error", `Combat feedback source ${source} impact must be positive`, "combat_feedback.json");
  }
  if (!validDeathKinds.has(entry.deathKind)) {
    finding("error", `Combat feedback source ${source} has invalid deathKind`, "combat_feedback.json");
  }
}
for (const phase of ["core_warmup", "shield_ring", "supernova_charge", "collapse_reward"]) {
  const entry = combatFeedback?.bossPhases?.[phase];
  if (!entry) {
    finding("error", `Combat feedback missing boss phase ${phase}`, "combat_feedback.json");
    continue;
  }
  if (!entry.label || !/^#[0-9a-f]{6}$/i.test(entry.color || "")) {
    finding("error", `Boss phase ${phase} must define label and hex color`, "combat_feedback.json");
  }
  if (!(entry.hitSparkScale > 0) || !(entry.phaseBurstCount > 0)) {
    finding("error", `Boss phase ${phase} needs positive hitSparkScale and phaseBurstCount`, "combat_feedback.json");
  }
}
if (!Array.isArray(originalWorldUi) || originalWorldUi.length < 15) {
  finding("error", "Original world UI attributes must include at least the 15 hand-authored worlds", "original_world_ui_attributes.json");
}
for (const world of originalWorldUi || []) {
  if (!(world.level > 0) || !world.name) {
    finding("error", "Original world UI row must include level and name", "original_world_ui_attributes.json");
  }
  if (!(world.mobilityMultiplier > 0) || !(world.sizeMultiplier > 0)) {
    finding("error", `World ${world.level} must include positive mobility/size multipliers`, "original_world_ui_attributes.json");
  }
  if (!world.unlocksFeature) {
    finding("warning", `World ${world.level} missing unlocksFeature`, "original_world_ui_attributes.json");
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  counts: {
    skins: skins.length,
    enemies: enemies.length,
    waves: waves.length,
    bossTemplates: bosses.length,
    worldProgression: worlds.length,
    originalWorlds: data["original_world_scaling.json"]?.length || 0,
    originalBosses: data["original_boss_scaling.json"]?.length || 0,
    originalBossRewards: Object.keys(originalBossRewards?.bosses || {}).length,
    originalEconomyKeys: Object.keys(originalBaseCosts).length,
    weaponRuntimeTuning: Object.keys(weaponRuntimeTuning?.weapons || {}).length,
    presentationSfx: Object.keys(presentationRuntime?.audio?.sfx || {}).length,
    presentationVisuals: Object.keys(presentationRuntime?.visuals || {}).length,
    p0dDemos: Object.keys(adDemos?.demos || {}).length,
    monetizationBackend: monetizationBackend?.targetProviders?.iaa?.primary || "missing",
    iapCatalogProducts: iapCatalogProducts.length,
    balanceOverlay: balanceOverlay?.id || "missing",
    uiMissions: uiProgression?.missions?.length || 0,
    uiAchievements: uiProgression?.achievements?.length || 0,
    uiStoreProducts: uiProgression?.storeProducts?.length || 0,
    uiCosmetics: uiProgression?.cosmetics?.length || 0,
    uiBottomTabs: uiUnlocks?.bottomTabs?.length || 0,
    defenseWeaponUnlocks: uiUnlocks?.defenseWeapons?.length || 0,
    originalWorldUi: originalWorldUi?.length || 0,
    combatFeedbackSources: Object.keys(combatFeedback?.damageSources || {}).length,
    combatFeedbackBossPhases: Object.keys(combatFeedback?.bossPhases || {}).length,
  },
  findings,
};

fs.writeFileSync(path.join(outputDir, "validation_report.json"), JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify(report, null, 2));

if (findings.some((item) => item.severity === "error")) {
  process.exit(1);
}
