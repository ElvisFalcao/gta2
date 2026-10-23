// Tiny localStorage save system (wrapped in try/catch: private mode can throw).

const KEY = 'mothercity.save.v1';
const SETTINGS_KEY = 'mothercity.settings.v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeSave(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
  } catch {
    return {};
  }
}

export function writeSettings(s) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function freshState() {
  return {
    version: 1,
    money: 60,
    respect: 0,
    stats: { muscle: 0, stamina: 0, fat: 0, gymDay: -1, gymSets: 0, beachDay: -1, staminaXp: 0, bodyDay: 1 },
    weapons: { owned: { fists: true }, ammo: {}, current: 'fists' },
    boxing: 0, // boxing lessons done at the Langa club (0..3)
    done: [],
    flags: {},
    proteas: [],
    clues: [],
    choices: {},
    totals: { fares: 0, sideQuests: 0, missions: 0, gymSets: 0, wasted: 0, busted: 0 },
    time: { hours: 7, day: 1 },
    pos: null,
  };
}
