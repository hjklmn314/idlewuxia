export type SkinId = "black_hole_vacuum" | "clean_the_dots" | "paint_bloom";
export type DeviceTier = "low" | "mid" | "high";
export type Formation = "scatter" | "cluster" | "orbit" | "trail" | "v" | "pincer";
export type NovaPhase = "core_warmup" | "shield_ring" | "supernova_charge" | "collapse_reward" | "dead";

export interface SkinTheme {
  id: SkinId;
  displayName: string;
  positioning: string;
  primaryColor: string;
  secondaryColor: string;
  entityNames: Record<string, string>;
  vfx: Record<string, string>;
  uaHook: string;
}

export interface EnemyTypeConfig {
  id: string;
  hpRatio: number;
  valueRatio: number;
  entityCost: number;
  minWorld: number;
  spawnWeight: number;
  bossOnly?: boolean;
}

export interface WaveTemplateConfig {
  id: string;
  minWorld: number;
  weight: number;
  formation: Formation;
  enemyPool: string[];
  quantityRange: [number, number];
  budgetMultiplier: number;
  swipeFriendly?: boolean;
  uaFriendly?: boolean;
}

export interface PlayerState {
  themeId: SkinId;
  money: number;
  gems: number;
  worldIndex: number;
  killsThisWorld: number;
  upgrades: {
    damage: number;
    rate: number;
    value: number;
  };
}

export interface BossRuntimeState {
  hp: number;
  maxHp: number;
  phase: NovaPhase;
  chargeTimer: number;
  shieldNodesAlive: number;
  chargersSpawned: number;
  chargersDestroyed: number;
}
