export const DEMO_MODES = {
  clean10: {
    id: "clean10",
    themeId: "clean_the_dots",
    durationSeconds: 10,
    headline: "Clean all the dots!",
    reward: "100% CLEAN",
    events: [
      { at: 0, action: "dense_spawn", caption: "Clean all the dots!" },
      { at: 1.0, action: "auto_swipe", caption: "Wipe one sweep" },
      { at: 2.0, action: "upgrade", caption: "Foam power up" },
      { at: 3.2, action: "dust_swarm", caption: "Dust wave incoming" },
      { at: 5.7, action: "boss_shield", caption: "Stain core shielded" },
      { at: 6.05, action: "boss_probe", caption: "Shield holds" },
      { at: 7.0, action: "boss_charge", caption: "Stain core charging" },
      { at: 7.8, action: "interrupt", caption: "Cut the stains" },
      { at: 8.6, action: "ultimate", caption: "Mega clean" },
      { at: 8.75, action: "collapse", caption: "Core exposed" },
      { at: 8.9, action: "boss_confirm", caption: "Critical clean" },
      { at: 9.2, action: "reward", caption: "100% CLEAN", reward: "Clean cash +" },
    ],
  },
  blackhole10: {
    id: "blackhole10",
    themeId: "black_hole_vacuum",
    durationSeconds: 10,
    headline: "Absorb everything",
    reward: "VOID COLLAPSE",
    events: [
      { at: 0, action: "dense_spawn", caption: "Absorb everything" },
      { at: 1.2, action: "upgrade", caption: "Gravity up" },
      { at: 2.2, action: "orbit_wave", caption: "Force pull online" },
      { at: 3.0, action: "dust_swarm", caption: "Meteor wave" },
      { at: 5.8, action: "boss_shield", caption: "Nova Reactor shielded" },
      { at: 6.15, action: "boss_probe", caption: "Shield holds" },
      { at: 7.0, action: "boss_charge", caption: "Nova Reactor charging" },
      { at: 8.0, action: "interrupt", caption: "Break the core" },
      { at: 8.8, action: "ultimate", caption: "Void collapse" },
      { at: 8.95, action: "collapse", caption: "Core exposed" },
      { at: 9.1, action: "boss_confirm", caption: "Critical collapse" },
      { at: 9.2, action: "reward", caption: "VOID COLLAPSE", reward: "Stardust cash +" },
    ],
  },
  paint10: {
    id: "paint10",
    themeId: "paint_bloom",
    durationSeconds: 10,
    headline: "Turn dots into color",
    reward: "COLOR BLOOM",
    events: [
      { at: 0, action: "dense_spawn", caption: "Turn dots into color" },
      { at: 1.0, action: "auto_swipe", caption: "Brush stroke bloom" },
      { at: 2.4, action: "upgrade", caption: "Color value up" },
      { at: 3.4, action: "trail_chain", caption: "Ink rain" },
      { at: 5.9, action: "boss_shield", caption: "Ink core shielded" },
      { at: 6.25, action: "boss_probe", caption: "Shield holds" },
      { at: 7.2, action: "boss_charge", caption: "Ink core charging" },
      { at: 8.1, action: "interrupt", caption: "Cut the ink core" },
      { at: 8.8, action: "ultimate", caption: "Color bloom" },
      { at: 8.95, action: "collapse", caption: "Core exposed" },
      { at: 9.1, action: "boss_confirm", caption: "Critical bloom" },
      { at: 9.2, action: "reward", caption: "COLOR BLOOM", reward: "Color cash +" },
    ],
  },
};

export function resolveDemoMode(search) {
  const params = new URLSearchParams(search);
  const mode = params.get("demo");
  if (DEMO_MODES[mode]) return mode;
  const skin = params.get("skin");
  if (skin === "clean") return "clean10";
  if (skin === "paint") return "paint10";
  if (skin === "blackhole") return "blackhole10";
  return null;
}

export function createDemoDirector({ hooks, now }) {
  let activeMode = null;
  let startedAt = 0;
  const fired = new Set();

  return {
    get active() {
      return Boolean(activeMode);
    },
    get mode() {
      return activeMode;
    },
    start(modeId) {
      activeMode = DEMO_MODES[modeId];
      startedAt = now();
      fired.clear();
      hooks.prepare(activeMode, startedAt);
    },
    update() {
      if (!activeMode) return;
      const elapsed = (now() - startedAt) / 1000;
      for (const event of activeMode.events) {
        const key = `${event.at}:${event.action}`;
        if (elapsed >= event.at && !fired.has(key)) {
          fired.add(key);
          hooks.caption(event.caption, event.reward || "");
          hooks.action(event.action, activeMode, event, elapsed);
        }
      }
      hooks.tick(activeMode, elapsed);
    },
  };
}
