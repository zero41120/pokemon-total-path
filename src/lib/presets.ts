import { ValidationError } from "./errors";
import type { ChampionsPoints } from "./schema";

export type ChampionsPreset = {
  name: string;
  points: ChampionsPoints;
  nature: string;
  notes: string[];
};

const PRESETS: Record<string, ChampionsPreset> = {
  fully_physical_defensive: {
    name: "fully_physical_defensive",
    points: { hp: 32, def: 32 },
    nature: "Bold",
    notes: ["32 HP, 32 Def, +Def nature. Leaves 2 Champions points unassigned."],
  },
  fully_special_defensive: {
    name: "fully_special_defensive",
    points: { hp: 32, spd: 32 },
    nature: "Calm",
    notes: ["32 HP, 32 SpD, +SpD nature. Leaves 2 Champions points unassigned."],
  },
  max_attack: {
    name: "max_attack",
    points: { atk: 32, spe: 32 },
    nature: "Adamant",
    notes: ["32 Atk, 32 Spe, +Atk nature. Leaves 2 Champions points unassigned."],
  },
  max_special_attack: {
    name: "max_special_attack",
    points: { spa: 32, spe: 32 },
    nature: "Modest",
    notes: ["32 SpA, 32 Spe, +SpA nature. Leaves 2 Champions points unassigned."],
  },
  max_speed_physical: {
    name: "max_speed_physical",
    points: { atk: 32, spe: 32 },
    nature: "Jolly",
    notes: ["32 Atk, 32 Spe, +Spe nature. Leaves 2 Champions points unassigned."],
  },
  max_speed_special: {
    name: "max_speed_special",
    points: { spa: 32, spe: 32 },
    nature: "Timid",
    notes: ["32 SpA, 32 Spe, +Spe nature. Leaves 2 Champions points unassigned."],
  },
};

export function getChampionsPreset(name: string): ChampionsPreset {
  const preset = PRESETS[name];
  if (!preset) {
    throw new ValidationError(`Unknown championsPreset: ${name}`, {
      supportedPresets: Object.keys(PRESETS),
    });
  }
  return preset;
}

export function listChampionsPresets() {
  return Object.values(PRESETS);
}
