const DEFAULT_SIDE_RULE = { visibleFromGalaxy: 1, enabledFromGalaxy: 1 };

const SYSTEM_GROUPS = {
  droneWing: { type: "slotUnlock", groupId: "drone" },
  vacuumPull: { type: "slotUnlock", groupId: "vacuum" },
  droneFocus: { type: "gatedSystem", groupId: "drone", title: "SPEED" },
  droneLoop: { type: "gatedSystem", groupId: "drone", title: "AGILITY" },
  droneSize: { type: "gatedSystem", groupId: "drone", title: "SIZE" },
  vacuumChain: { type: "gatedSystem", groupId: "vacuum", title: "SPEED" },
  vacuumSurge: { type: "gatedSystem", groupId: "vacuum", title: "SUCTION" },
  vacuumAgility: { type: "gatedSystem", groupId: "vacuum", title: "AGILITY" },
};

function uiUnlocksFrom(config) {
  return config?.uiUnlocks || config || {};
}

function worldLevelOf(snapshot = {}) {
  return Math.max(1, Number(snapshot.worldLevel || snapshot.level || 1));
}

function systemLevel(snapshot = {}, key) {
  return Math.max(0, Number(snapshot.systems?.[key] || 0));
}

function weaponLevel(snapshot = {}, key) {
  return Math.max(0, Number(snapshot.weaponLevels?.[key] || 0));
}

function weaponModLevel(snapshot = {}, key) {
  return Math.max(0, Number(snapshot.weaponMods?.[key] || 0));
}

function groupRule(uiUnlocks, groupId) {
  return uiUnlocks?.[groupId] || {};
}

function slotKeyFor(groupId, group) {
  return group.slotSystemKey || (groupId === "drone" ? "droneWing" : "vacuumPull");
}

function slotPlaceholder(groupId, group) {
  return group.lockedPlaceholder || (groupId === "drone" ? "UNLOCK DRONE" : "UNLOCK VACUUM");
}

function weaponRule(uiUnlocks, weaponId) {
  return (uiUnlocks.defenseWeapons || []).find((weapon) => weapon.id === weaponId) || null;
}

function weaponPartRule(uiUnlocks, weaponId, partId) {
  return weaponRule(uiUnlocks, weaponId)?.parts?.find((part) => part.id === partId) || null;
}

function weaponPartKey(weaponId, partId) {
  return `${weaponId}_${partId}`;
}

function resolveSideEntrance(uiUnlocks, snapshot, key) {
  const rule = uiUnlocks.sideEntrances?.[key] || DEFAULT_SIDE_RULE;
  const level = worldLevelOf(snapshot);
  const debugAllowed = !rule.debugOnly || Boolean(snapshot.debug);
  const visible = debugAllowed && level >= (rule.visibleFromGalaxy || 1);
  const enabled = visible && level >= (rule.enabledFromGalaxy || rule.visibleFromGalaxy || 1);
  return {
    kind: "sideEntrance",
    id: key,
    visible,
    enabled,
    locked: visible && !enabled,
    lockedReason: !debugAllowed ? "Debug only" : enabled ? "" : `Galaxy ${rule.enabledFromGalaxy || rule.visibleFromGalaxy || 1}`,
    sourceRule: rule,
  };
}

function resolveBottomTab(uiUnlocks, snapshot, tabId) {
  const rule = (uiUnlocks.bottomTabs || []).find((item) => item.id === tabId) || { visibleFromGalaxy: 1 };
  const visible = worldLevelOf(snapshot) >= (rule.visibleFromGalaxy || 1);
  return {
    kind: "bottomTab",
    id: tabId,
    visible,
    enabled: visible,
    locked: !visible,
    lockedReason: visible ? "" : `Galaxy ${rule.visibleFromGalaxy || 1}`,
    sourceRule: rule,
  };
}

function resolveSlotUnlock(uiUnlocks, snapshot, groupId) {
  const group = groupRule(uiUnlocks, groupId);
  const slotKey = slotKeyFor(groupId, group);
  const slots = systemLevel(snapshot, slotKey);
  const requirements = group.slotRequirementsGalaxy || [];
  const maxSlots = group.maxSlots || requirements.length || 1;
  const nextRequiredGalaxy = requirements[Math.min(slots, requirements.length - 1)] || 999;
  const level = worldLevelOf(snapshot);

  if (slots >= maxSlots) {
    return {
      kind: "slotUnlock",
      id: groupId,
      visible: true,
      enabled: false,
      available: false,
      labelKind: "static",
      label: "MAX",
      reason: "MAX",
      level: `${slots}/${maxSlots}`,
      ghost: false,
      slotKey,
      slots,
      maxSlots,
      nextRequiredGalaxy,
      sourceRule: group,
    };
  }

  if (level < nextRequiredGalaxy) {
    return {
      kind: "slotUnlock",
      id: groupId,
      visible: true,
      enabled: false,
      available: false,
      labelKind: "static",
      label: `GALAXY ${nextRequiredGalaxy}`,
      reason: `Galaxy ${nextRequiredGalaxy}`,
      level: `${slots}/${maxSlots}`,
      ghost: true,
      slotKey,
      slots,
      maxSlots,
      nextRequiredGalaxy,
      sourceRule: group,
    };
  }

  return {
    kind: "slotUnlock",
    id: groupId,
    visible: true,
    enabled: true,
    available: true,
    labelKind: "cost",
    label: "",
    reason: "",
    level: `${slots}/${maxSlots}`,
    ghost: false,
    slotKey,
    slots,
    maxSlots,
    nextRequiredGalaxy,
    sourceRule: group,
  };
}

function resolveGatedSystem(uiUnlocks, snapshot, kind, groupId, activeTitle) {
  const group = groupRule(uiUnlocks, groupId);
  const slotKey = slotKeyFor(groupId, group);
  const slots = systemLevel(snapshot, slotKey);
  const placeholder = slotPlaceholder(groupId, group);
  if (slots <= 0) {
    return {
      kind: "gatedSystem",
      id: kind,
      visible: true,
      enabled: false,
      available: false,
      labelKind: "static",
      label: "",
      reason: placeholder,
      title: placeholder,
      level: "",
      ghost: true,
      slotKey,
      sourceRule: group,
    };
  }

  return {
    kind: "gatedSystem",
    id: kind,
    visible: true,
    enabled: true,
    available: true,
    labelKind: "cost",
    label: "",
    reason: "",
    title: activeTitle,
    level: `L${systemLevel(snapshot, kind)}`,
    ghost: false,
    slotKey,
    sourceRule: group,
  };
}

function resolveSystem(uiUnlocks, snapshot, kind) {
  const routed = SYSTEM_GROUPS[kind];
  if (routed?.type === "slotUnlock") return resolveSlotUnlock(uiUnlocks, snapshot, routed.groupId);
  if (routed?.type === "gatedSystem") return resolveGatedSystem(uiUnlocks, snapshot, kind, routed.groupId, routed.title);
  return {
    kind: "system",
    id: kind,
    visible: true,
    enabled: true,
    available: true,
    labelKind: "cost",
    label: "",
    reason: "",
    level: `L${systemLevel(snapshot, kind)}`,
    ghost: false,
  };
}

function resolveWeapon(uiUnlocks, snapshot, weaponId) {
  const rule = weaponRule(uiUnlocks, weaponId);
  const unlockGalaxy = rule?.unlockGalaxy || 1;
  const unlocked = Boolean(rule) && worldLevelOf(snapshot) >= unlockGalaxy;
  return {
    kind: "weapon",
    id: weaponId,
    visible: Boolean(rule),
    enabled: unlocked,
    available: unlocked,
    unlocked,
    locked: Boolean(rule) && !unlocked,
    lockedReason: unlocked ? "" : `Galaxy ${unlockGalaxy}`,
    unlockGalaxy,
    sourceRule: rule,
  };
}

function resolveWeaponPart(uiUnlocks, snapshot, weaponId, partId) {
  const weapon = resolveWeapon(uiUnlocks, snapshot, weaponId);
  const part = weaponPartRule(uiUnlocks, weaponId, partId);
  const countLevel = weaponLevel(snapshot, weaponId);
  const partLevel = partId === "count" ? countLevel : weaponModLevel(snapshot, weaponPartKey(weaponId, partId));
  const partActive = weapon.unlocked && (partId === "count" || countLevel > 0);
  const title = partId === "count" ? weapon.sourceRule?.label || part?.label : part?.label || partId.toUpperCase();

  if (!weapon.unlocked) {
    return {
      kind: "weaponPart",
      id: `${weaponId}.${partId}`,
      visible: Boolean(part),
      enabled: false,
      available: false,
      unlocked: false,
      ghost: true,
      title,
      labelKind: "static",
      label: `GALAXY ${weapon.unlockGalaxy}`,
      reason: weapon.lockedReason,
      level: "",
      weapon,
      sourceRule: part,
    };
  }

  if (partId !== "count" && countLevel <= 0) {
    return {
      kind: "weaponPart",
      id: `${weaponId}.${partId}`,
      visible: Boolean(part),
      enabled: false,
      available: false,
      unlocked: true,
      ghost: true,
      title,
      labelKind: "static",
      label: "BUY COUNT",
      reason: "BUY COUNT",
      level: "",
      weapon,
      sourceRule: part,
    };
  }

  return {
    kind: "weaponPart",
    id: `${weaponId}.${partId}`,
    visible: Boolean(part),
    enabled: true,
    available: true,
    unlocked: true,
    ghost: !partActive,
    title,
    labelKind: "cost",
    label: "",
    reason: "",
    level: `L${partLevel}`,
    weapon,
    sourceRule: part,
  };
}

export function resolveUnlockGate(config, snapshot = {}, target = {}) {
  const uiUnlocks = uiUnlocksFrom(config);
  const type = target.type || target.kind;
  if (type === "sideEntrance") return resolveSideEntrance(uiUnlocks, snapshot, target.id || target.key);
  if (type === "bottomTab") return resolveBottomTab(uiUnlocks, snapshot, target.id || target.tabId);
  if (type === "slotUnlock") return resolveSlotUnlock(uiUnlocks, snapshot, target.groupId || target.id);
  if (type === "gatedSystem") return resolveGatedSystem(uiUnlocks, snapshot, target.id || target.kindId, target.groupId, target.title);
  if (type === "system") return resolveSystem(uiUnlocks, snapshot, target.id || target.kindId);
  if (type === "weapon") return resolveWeapon(uiUnlocks, snapshot, target.id || target.weaponId);
  if (type === "weaponPart") return resolveWeaponPart(uiUnlocks, snapshot, target.weaponId || target.weapon, target.partId || target.part);
  throw new Error(`Unknown unlock gate target: ${type || "missing"}`);
}

export function resolveSlotMatrix(config, snapshot = {}, groupId) {
  const uiUnlocks = uiUnlocksFrom(config);
  const group = groupRule(uiUnlocks, groupId);
  const slotKey = slotKeyFor(groupId, group);
  const slots = systemLevel(snapshot, slotKey);
  const requirements = group.slotRequirementsGalaxy || [];
  const maxSlots = group.maxSlots || requirements.length || 1;
  const level = worldLevelOf(snapshot);
  return Array.from({ length: maxSlots }, (_, index) => {
    const requiredGalaxy = requirements[index] || requirements[requirements.length - 1] || 1;
    const owned = index < slots;
    const next = !owned && index === slots && level >= requiredGalaxy;
    const locked = !owned && !next;
    return {
      index,
      requiredGalaxy,
      label: owned ? `SLOT ${index + 1}` : next ? "UNLOCK" : `G${requiredGalaxy}`,
      state: owned ? "owned" : next ? "next" : locked ? "locked" : "",
    };
  });
}

export function configuredSlotCountForWorld(config, groupId, level) {
  const uiUnlocks = uiUnlocksFrom(config);
  const group = groupRule(uiUnlocks, groupId);
  const requirements = group.slotRequirementsGalaxy || [];
  const maxSlots = group.maxSlots || requirements.length || 0;
  return Math.min(maxSlots, Math.max(0, requirements.filter((required) => Number(level) >= required).length));
}
