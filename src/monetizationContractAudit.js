const REQUIRED_REWARD_FLOW = [
  "client_requests_offer",
  "backend_returns_placement_or_product",
  "client_completes_ad_or_purchase",
  "client_sends_receipt_or_ssv_context",
  "backend_verifies_with_platform",
  "backend_grants_entitlement",
  "client_refreshes_entitlement_snapshot",
];

const SKILL_PLACEMENTS = {
  storm: "storm_skill",
  dotRain: "dot_rain_skill",
  goldenDot: "golden_dot_skill",
};

const RUNTIME_SKILL_KIND = {
  storm: "storm",
  dotRain: "rain",
  goldenDot: "gold",
};

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function hasNumber(value) {
  return Number.isFinite(Number(value));
}

function finding(severity, type, message, detail = {}) {
  return { severity, type, message, ...detail };
}

function rewardShape(reward = {}) {
  return {
    hasReward: Boolean(reward && typeof reward === "object"),
    moneyScale: hasNumber(reward.moneyScale) ? Number(reward.moneyScale) : null,
    gems: hasNumber(reward.gems) ? Number(reward.gems) : null,
  };
}

function storeProductNeedsBackend(product) {
  return product.action === "preview-iap" || product.id === "remove_ads" || product.tag === "BACKEND";
}

function hasBackendProductMapping(product = {}) {
  return Boolean(product.backendProductId || product.androidProductId || product.iosProductId || product.sku);
}

function firstPurchaseIds(guardrails, contract) {
  return new Set([
    ...asArray(guardrails?.iap?.firstPurchaseOffers),
    ...asArray(contract?.targetProviders?.iap?.firstPurchaseOffers),
  ]);
}

function catalogProductIds(iapProductCatalog) {
  return new Set(asArray(iapProductCatalog?.products).flatMap((product) => [product.id, product.backendProductId].filter(Boolean)));
}

function summarizeFindings(findings) {
  const counts = { error: 0, gap: 0, warning: 0, info: 0 };
  for (const item of findings) {
    counts[item.severity] = (counts[item.severity] || 0) + 1;
  }
  return counts;
}

export function analyzeMonetizationContract(input = {}) {
  const contract = input.contract || {};
  const guardrails = input.guardrails || {};
  const balanceOverlay = input.balanceOverlay || {};
  const uiProgression = input.uiProgression || {};
  const iapProductCatalog = input.iapProductCatalog || {};
  const runtimeSource = String(input.runtimeSource || "");
  const findings = [];

  const iaa = contract.targetProviders?.iaa || {};
  const iap = contract.targetProviders?.iap || {};
  const entitlement = contract.entitlementRules || {};
  const rewardedPlacements = new Set(asArray(guardrails.ads?.rewardedPlacements));
  const skillEntries = balanceOverlay.iaa?.skillEntries || {};
  const storeProducts = asArray(uiProgression.storeProducts);
  const premiumUnlock = uiProgression.strategy?.premiumUnlock || {};
  const rewardedCosmetics = asArray(uiProgression.cosmetics).filter((item) => item.unlock?.action === "watch-ad-unlock");
  const firstPurchases = firstPurchaseIds(guardrails, contract);
  const backendCatalogIds = catalogProductIds(iapProductCatalog);
  const backendCatalogProducts = asArray(iapProductCatalog.products);
  const runtimeGatesRewardedSkillCooldown =
    runtimeSource.includes("rewardedRailSkillCooldownSeconds") && runtimeSource.includes("rewardedSkillAdCooldownSeconds");

  if (iaa.primary !== "admob") {
    findings.push(finding("error", "iaa-provider", "IAA primary provider must be AdMob.", { actual: iaa.primary || "missing" }));
  }
  if (!asArray(iaa.formats).includes("rewarded")) {
    findings.push(finding("error", "rewarded-format-missing", "IAA contract must include rewarded ad format."));
  }
  if (iaa.serverSideVerificationRequiredForRewarded !== true) {
    findings.push(finding("error", "rewarded-ssv-required", "Rewarded ads must require server-side verification."));
  }
  if (iaa.adUnitSource !== "remote_config") {
    findings.push(finding("gap", "remote-ad-unit-source", "Ad unit ids should come from remote config before live integration.", { actual: iaa.adUnitSource || "missing" }));
  }

  if (iap.android?.store !== "google_play_billing" || iap.android?.backendVerification !== "google_play_developer_api") {
    findings.push(finding("error", "android-iap-backend", "Android IAP must be verified through Google Play backend APIs."));
  }
  if (iap.ios?.store !== "apple_storekit" || iap.ios?.backendVerification !== "app_store_server_api") {
    findings.push(finding("error", "ios-iap-backend", "iOS IAP must be verified through Apple server APIs."));
  }
  if (guardrails.iap?.serverVerificationRequired !== true) {
    findings.push(finding("error", "iap-server-verification", "IAP guardrail must require server verification."));
  }
  const pendingCatalogProducts = backendCatalogProducts.filter(
    (product) =>
      product.status === "backend_pending" ||
      /^TODO_/.test(String(product.androidProductId || "")) ||
      /^TODO_/.test(String(product.iosProductId || "")),
  );
  if (pendingCatalogProducts.length > 0) {
    findings.push(
      finding("gap", "iap-platform-product-ids-pending", "IAP catalog still uses pending Google Play/App Store product ids before backend integration.", {
        pendingProductCount: pendingCatalogProducts.length,
        file: "config/iap_product_catalog.json",
      }),
    );
  }

  const rewardFlow = asArray(contract.rewardGrantFlow);
  for (const step of REQUIRED_REWARD_FLOW) {
    if (!rewardFlow.includes(step)) {
      findings.push(finding("error", "reward-flow-step-missing", "Reward grant flow is missing a required step.", { step }));
    }
  }
  if (entitlement.rewardedAdReplayProtection !== true) {
    findings.push(finding("error", "rewarded-replay-protection", "Rewarded ad replay protection must be required."));
  }
  if (entitlement.iapReceiptReplayProtection !== true) {
    findings.push(finding("error", "iap-replay-protection", "IAP receipt replay protection must be required."));
  }

  const rewardedSkills = Object.entries(skillEntries).map(([skillId, entry]) => {
    const placementId = SKILL_PLACEMENTS[skillId] || `${skillId}_skill`;
    const cooldownSeconds = Number(entry.cooldownSeconds);
    const adCooldownSeconds = Number(guardrails.ads?.rewardedSkillCooldownSeconds || 0);
    const row = {
      skillId,
      runtimeKind: RUNTIME_SKILL_KIND[skillId] || skillId,
      placementId,
      configured: true,
      placementListed: rewardedPlacements.has(placementId),
      cooldownSeconds,
      adCooldownSeconds,
      runtimeGatesAdCooldown: runtimeGatesRewardedSkillCooldown,
      rewardFeeling: entry.rewardFeeling || "",
      boostSeconds: hasNumber(entry.boostSeconds) ? Number(entry.boostSeconds) : null,
    };

    if (!row.placementListed) {
      findings.push(
        finding("gap", "rewarded-skill-placement-missing", "Rewarded skill is not listed in ad placement guardrails.", {
          skillId,
          placementId,
          file: "ads_iap_guardrails.json",
        }),
      );
    }
    if (!(cooldownSeconds >= 10)) {
      findings.push(finding("error", "rewarded-skill-cooldown-too-low", "Rewarded skill cooldown must be at least 10 seconds.", { skillId, cooldownSeconds }));
    }
    if (adCooldownSeconds && cooldownSeconds < adCooldownSeconds && !runtimeGatesRewardedSkillCooldown) {
      findings.push(
        finding("gap", "client-skill-cooldown-below-ad-cooldown", "Client skill cooldown is shorter than rewarded ad placement cooldown; backend must gate ad availability.", {
          skillId,
          cooldownSeconds,
          adCooldownSeconds,
        }),
      );
    }
    if (!row.rewardFeeling) {
      findings.push(finding("warning", "reward-preview-copy-missing", "Rewarded skill should define reward feeling/copy for offer preview.", { skillId }));
    }
    return row;
  });

  for (const requiredSkill of Object.keys(SKILL_PLACEMENTS)) {
    if (!skillEntries[requiredSkill]) {
      findings.push(finding("error", "rewarded-skill-config-missing", "Expected rewarded skill entry is missing from balance overlay.", { skillId: requiredSkill }));
    }
  }

  const cosmeticPlacements = rewardedCosmetics.map((item) => ({
    cosmeticId: item.id,
    placementId: item.unlock?.rewardedPlacement || premiumUnlock.rewardedPlacement || "",
    requiredAds: Number(item.unlock?.requiredAds || premiumUnlock.requiredAds || 0),
  }));
  for (const row of cosmeticPlacements) {
    if (!row.placementId || !rewardedPlacements.has(row.placementId)) {
      findings.push(
        finding("gap", "cosmetic-rewarded-placement-missing", "Rewarded cosmetic unlock must use a placement listed in ad guardrails.", {
          cosmeticId: row.cosmeticId,
          placementId: row.placementId || "missing",
          file: "ui_progression_catalog.json",
        }),
      );
    }
    if (!(row.requiredAds >= 1)) {
      findings.push(finding("error", "cosmetic-reward-count-invalid", "Rewarded cosmetic unlock must require at least one completed ad.", { cosmeticId: row.cosmeticId }));
    }
  }

  const storeMatrix = storeProducts.map((product) => {
    const needsBackend = storeProductNeedsBackend(product);
    const mapped = hasBackendProductMapping(product);
    const reward = rewardShape(product.reward);
    const inFirstPurchase = firstPurchases.has(product.id);
    const inBackendCatalog = backendCatalogIds.has(product.id) || backendCatalogIds.has(product.backendProductId);
    const row = {
      id: product.id,
      backendProductId: product.backendProductId || "",
      action: product.action,
      tag: product.tag || "",
      title: product.title || "",
      needsBackend,
      hasBackendProductMapping: mapped,
      inFirstPurchaseOffers: inFirstPurchase,
      inBackendCatalog,
      reward,
    };

    if (!product.id || !product.title || !product.action) {
      findings.push(finding("error", "store-product-shape", "Store product must define id, title, and action.", { productId: product.id || "missing" }));
    }
    if (!reward.hasReward || reward.moneyScale === null || reward.gems === null) {
      findings.push(finding("error", "store-product-reward-shape", "Store product reward must define moneyScale and gems.", { productId: product.id }));
    }
    if (needsBackend && !mapped) {
      findings.push(
        finding("gap", "store-product-backend-id-missing", "Backend-facing store product needs platform/backend product ids before live integration.", {
          productId: product.id,
          action: product.action,
        }),
      );
    }
    if (product.action === "preview-iap" && !inFirstPurchase && !inBackendCatalog) {
      findings.push(
        finding("gap", "iap-product-offer-not-contracted", "Preview IAP product is not represented in first-purchase offers or backend product catalog.", {
          productId: product.id,
          expectedContractIds: [...firstPurchases, ...backendCatalogIds],
        }),
      );
    }
    return row;
  });

  const noAdsProducts = storeMatrix.filter((product) => /ad/i.test(`${product.id} ${product.title}`));
  const noAdsContractKeys = new Set([
    ...asArray(entitlement.noAds),
    ...asArray(guardrails.iap?.noAdsRemoves),
    ...asArray(guardrails.iap?.firstPurchaseOffers),
  ]);
  if (noAdsProducts.length > 0 && ![...noAdsContractKeys].some((key) => /ad/i.test(key))) {
    findings.push(finding("gap", "no-ads-entitlement-unmapped", "No-ads product exists but no ads entitlement rule is visible in contract."));
  }
  for (const product of noAdsProducts) {
    if (!firstPurchases.has(product.id) && !backendCatalogIds.has(product.backendProductId)) {
      findings.push(
        finding("gap", "no-ads-product-id-mismatch", "No-ads product id does not match the current contracted offer ids.", {
          productId: product.id,
          expectedContractIds: [...firstPurchases, ...backendCatalogIds],
        }),
      );
    }
  }

  if (!asArray(guardrails.ads?.disallowed).includes("mandatory_ad_for_core_upgrade")) {
    findings.push(finding("error", "mandatory-core-ad-not-disallowed", "Core upgrades must not be gated by mandatory ads."));
  }
  if (!(Number(guardrails.ads?.noForcedInterstitialBeforeSeconds) >= 300)) {
    findings.push(finding("error", "forced-interstitial-too-early", "No forced interstitial should occur before 300 seconds."));
  }
  if (!(Number(guardrails.ads?.samePlacementCooldownSeconds) >= 120)) {
    findings.push(finding("warning", "placement-cooldown-low", "Same-placement cooldown should be at least 120 seconds."));
  }

  const directPreviewGrant =
    /action\s*===\s*["']preview-iap["'][\s\S]{0,500}?claimStoreProduct/.test(runtimeSource) ||
    /function\s+claimStoreProduct[\s\S]{0,900}?state\.money\s*\+=/.test(runtimeSource);
  if (directPreviewGrant) {
    findings.push(
      finding("gap", "runtime-local-store-grant", "P0 runtime still grants store preview rewards locally; live IAP must wait for backend entitlement refresh.", {
        file: "src/main.js",
      }),
    );
  }

  const runtimeSkillLocalGrant =
    /function\s+activateRailSkill[\s\S]{0,1600}?state\.money\s*\+=/.test(runtimeSource) ||
    /function\s+activateRailSkill[\s\S]{0,1200}?state\.boostUntil\s*=/.test(runtimeSource) ||
    /async\s+function\s+resolveRewardedPlacement[\s\S]{0,900}?granted:\s*true/.test(runtimeSource);
  if (runtimeSkillLocalGrant) {
    findings.push(
      finding("gap", "runtime-local-rewarded-resolver", "P0 runtime still resolves rewarded placements locally; live IAA must wait for SSV/backend grant.", {
        file: "src/main.js",
      }),
    );
  }

  const runtimeCosmeticBypassesResolver =
    /function\s+watchAdUnlockCosmetic[\s\S]{0,900}?state\.cosmeticUnlockProgress\[id\]\s*=\s*next/.test(runtimeSource) &&
    !/function\s+watchAdUnlockCosmetic[\s\S]{0,900}?await\s+resolveRewardedPlacement/.test(runtimeSource);
  if (runtimeCosmeticBypassesResolver) {
    findings.push(
      finding("error", "runtime-cosmetic-rewarded-bypass", "Rewarded cosmetic unlock must resolve through rewarded placement before progress changes.", {
        file: "src/main.js",
      }),
    );
  }

  const runtimeStoreBackendPending =
    /function\s+requestStoreProduct/.test(runtimeSource) && !/refreshes_entitlement_snapshot|refreshEntitlement|verifyPurchase|purchaseProduct/.test(runtimeSource);
  if (runtimeStoreBackendPending) {
    findings.push(
      finding("gap", "runtime-store-backend-pending", "P0 runtime requests store products without a live purchase/backend entitlement adapter yet.", {
        file: "src/main.js",
      }),
    );
  }

  const counts = summarizeFindings(findings);
  const status = counts.error > 0 ? "blocked" : counts.gap > 0 ? "needs_backend_mapping" : "ready_for_backend";

  return {
    schemaVersion: 1,
    status,
    summary: {
      iaaProvider: iaa.primary || "missing",
      iaaFormats: asArray(iaa.formats),
      rewardedPlacementCount: rewardedPlacements.size,
      rewardedSkillCount: rewardedSkills.length,
      rewardedCosmeticCount: cosmeticPlacements.length,
      storeProductCount: storeMatrix.length,
      backendStoreProductMappings: storeMatrix.filter((product) => product.hasBackendProductMapping).length,
      backendCatalogProductCount: backendCatalogProducts.length,
      rewardFlowStepCount: rewardFlow.length,
      findingCounts: counts,
    },
    matrices: {
      rewardedSkills,
      rewardedCosmetics: cosmeticPlacements,
      storeProducts: storeMatrix,
      rewardGrantFlow: rewardFlow.map((step, index) => ({ index, step, required: REQUIRED_REWARD_FLOW.includes(step) })),
      placementRules: {
        rewardedPlacements: [...rewardedPlacements].sort(),
        disallowed: asArray(guardrails.ads?.disallowed).sort(),
        noForcedInterstitialBeforeSeconds: Number(guardrails.ads?.noForcedInterstitialBeforeSeconds || 0),
        samePlacementCooldownSeconds: Number(guardrails.ads?.samePlacementCooldownSeconds || 0),
      },
    },
    findings,
  };
}

export function markdownMonetizationSummary(report, generatedAt = new Date().toISOString()) {
  const rows = report.findings
    .map((item) => `| ${item.severity} | ${item.type} | ${item.message} | ${item.skillId || item.productId || item.placementId || ""} |`)
    .join("\n");
  const skillRows = report.matrices.rewardedSkills
    .map(
      (skill) =>
        `| ${skill.skillId} | ${skill.placementId} | ${skill.placementListed ? "yes" : "no"} | ${skill.cooldownSeconds}s | ${skill.adCooldownSeconds}s | ${skill.runtimeGatesAdCooldown ? "yes" : "no"} |`,
    )
    .join("\n");
  const cosmeticRows = report.matrices.rewardedCosmetics
    .map((item) => `| ${item.cosmeticId} | ${item.placementId || "missing"} | ${item.requiredAds} |`)
    .join("\n");
  const productRows = report.matrices.storeProducts
    .map(
      (product) =>
        `| ${product.id} | ${product.action} | ${product.needsBackend ? "yes" : "no"} | ${product.hasBackendProductMapping ? "yes" : "no"} | ${product.inFirstPurchaseOffers ? "yes" : "no"} | ${product.inBackendCatalog ? "yes" : "no"} |`,
    )
    .join("\n");

  return [
    "# Monetization Contract Validation",
    "",
    `Generated: ${generatedAt}`,
    `Status: ${report.status}`,
    "",
    "## Summary",
    "",
    `- IAA provider: ${report.summary.iaaProvider}`,
    `- Rewarded skills: ${report.summary.rewardedSkillCount}`,
    `- Rewarded cosmetics: ${report.summary.rewardedCosmeticCount}`,
    `- Store products: ${report.summary.storeProductCount}`,
    `- Backend product mappings present: ${report.summary.backendStoreProductMappings}`,
    `- Backend catalog products: ${report.summary.backendCatalogProductCount}`,
    `- Findings: errors ${report.summary.findingCounts.error || 0}, gaps ${report.summary.findingCounts.gap || 0}, warnings ${report.summary.findingCounts.warning || 0}`,
    "",
    "## Rewarded Skills",
    "",
    "| Skill | Placement | In guardrails | Skill cooldown | Ad cooldown | Runtime gated |",
    "| --- | --- | --- | --- | --- | --- |",
    skillRows || "| none | none | no | 0s | 0s | no |",
    "",
    "## Rewarded Cosmetics",
    "",
    "| Cosmetic | Placement | Required ads |",
    "| --- | --- | ---: |",
    cosmeticRows || "| none | none | 0 |",
    "",
    "## Store Products",
    "",
    "| Product | Action | Needs backend | Has backend id | First purchase | Backend catalog |",
    "| --- | --- | --- | --- | --- | --- |",
    productRows || "| none | none | no | no | no | no |",
    "",
    "## Findings",
    "",
    "| Severity | Type | Message | Key |",
    "| --- | --- | --- | --- |",
    rows || "| info | clean | No monetization contract gaps found. | |",
    "",
  ].join("\n");
}
