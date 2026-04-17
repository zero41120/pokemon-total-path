import { ValidationError } from "./errors";

export type StatID = "hp" | "atk" | "def" | "spa" | "spd" | "spe";

export type ExactStats = Record<StatID, number>;
export type ChampionsPoints = Partial<Record<StatID, number>>;

export type CombatantInput = {
  name?: string;
  species: string;
  baseSpecies?: string;
  level?: number;
  item?: string;
  ability?: string;
  moves?: string[];
  stats?: ExactStats;
  championsPoints?: ChampionsPoints;
  nature?: string;
  currentHP?: number;
  boosts?: Partial<Record<Exclude<StatID, "hp">, number>>;
  status?: string;
  teraType?: string;
};

export type CalcField = {
  weather?: string;
  terrain?: string;
  attackerSide?: {
    tailwind?: boolean;
    helpingHand?: boolean;
    friendGuard?: boolean;
  };
  defenderSide?: {
    tailwind?: boolean;
    reflect?: boolean;
    lightScreen?: boolean;
    auroraVeil?: boolean;
    friendGuard?: boolean;
    protected?: boolean;
  };
};

export type CalcRequest = {
  attacker: CombatantInput;
  defender: CombatantInput;
  move: string;
  field?: CalcField;
};

const STAT_IDS: StatID[] = ["hp", "atk", "def", "spa", "spd", "spe"];
const CHAMPIONS_POINTS_VALIDATION_DETAILS = {
  hint: "Pokemon Champions uses Champions Points instead of EVs.",
  championsPointsRules: {
    fixedIVs: 31,
    level: 50,
    totalPool: 66,
    statCap: 32,
    ratio: "1 Champions Point = +1 final level 50 stat",
  },
};

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function assertString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new ValidationError(`Expected non-empty string for ${field}`);
  }
  return value;
}

export function parseStats(value: unknown, field: string): ExactStats {
  if (!isPlainObject(value)) {
    throw new ValidationError(`Expected stats object for ${field}`);
  }

  const stats = {} as ExactStats;
  for (const stat of STAT_IDS) {
    const raw = value[stat];
    if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) {
      throw new ValidationError(`Expected positive number for ${field}.${stat}`);
    }
    stats[stat] = raw;
  }
  return stats;
}

export function parseChampionsPoints(value: unknown, field: string): ChampionsPoints {
  if (!isPlainObject(value)) {
    throw new ValidationError(
      `Expected championsPoints object for ${field}`,
      CHAMPIONS_POINTS_VALIDATION_DETAILS,
    );
  }

  const points: ChampionsPoints = {};
  let total = 0;
  for (const stat of STAT_IDS) {
    const raw = value[stat];
    if (raw === undefined) continue;
    if (!Number.isInteger(raw) || raw < 0 || raw > 32) {
      throw new ValidationError(
        `Expected integer 0-32 for ${field}.${stat}`,
        CHAMPIONS_POINTS_VALIDATION_DETAILS,
      );
    }
    points[stat] = raw;
    total += raw;
  }

  if (total > 66) {
    throw new ValidationError(
      `${field} total cannot exceed 66 points`,
      CHAMPIONS_POINTS_VALIDATION_DETAILS,
    );
  }

  return points;
}

export function parseCombatant(value: unknown, field: string): CombatantInput {
  if (!isPlainObject(value)) {
    throw new ValidationError(`Expected object for ${field}`);
  }

  if (!value.species) {
    throw new ValidationError(`${field} must include species`);
  }

  const combatant: CombatantInput = {
    species: assertString(value.species, `${field}.species`),
  };
  if (value.name !== undefined) combatant.name = assertString(value.name, `${field}.name`);
  if (value.baseSpecies !== undefined) combatant.baseSpecies = assertString(value.baseSpecies, `${field}.baseSpecies`);
  if (value.level !== undefined) {
    if (typeof value.level !== "number" || !Number.isFinite(value.level)) {
      throw new ValidationError(`Expected number for ${field}.level`);
    }
    combatant.level = value.level;
  }
  if (value.item !== undefined) combatant.item = assertString(value.item, `${field}.item`);
  if (value.ability !== undefined) combatant.ability = assertString(value.ability, `${field}.ability`);
  if (value.moves !== undefined) {
    if (!Array.isArray(value.moves) || value.moves.some((move) => typeof move !== "string")) {
      throw new ValidationError(`Expected string array for ${field}.moves`);
    }
    combatant.moves = value.moves;
  }
  if (value.stats !== undefined) combatant.stats = parseStats(value.stats, `${field}.stats`);
  if (value.championsPoints !== undefined) {
    combatant.championsPoints = parseChampionsPoints(value.championsPoints, `${field}.championsPoints`);
  }
  if (value.nature !== undefined) combatant.nature = assertString(value.nature, `${field}.nature`);
  if (value.currentHP !== undefined) {
    if (typeof value.currentHP !== "number" || !Number.isFinite(value.currentHP) || value.currentHP <= 0) {
      throw new ValidationError(`Expected positive number for ${field}.currentHP`);
    }
    combatant.currentHP = value.currentHP;
  }
  if (value.status !== undefined) combatant.status = assertString(value.status, `${field}.status`);
  if (value.teraType !== undefined) combatant.teraType = assertString(value.teraType, `${field}.teraType`);

  if (!combatant.stats && !combatant.championsPoints) {
    throw new ValidationError(`${field} requires stats or championsPoints`);
  }

  return combatant;
}

export function parseCalcRequest(value: unknown, _index?: number): CalcRequest {
  if (!isPlainObject(value)) {
    throw new ValidationError("Expected request body object");
  }

  return {
    attacker: parseCombatant(value.attacker, "attacker"),
    defender: parseCombatant(value.defender, "defender"),
    move: assertString(value.move, "move"),
    field: isPlainObject(value.field) ? (value.field as CalcField) : undefined,
  };
}

export function parseCalcRequests(value: unknown): CalcRequest[] {
  if (!isPlainObject(value) || !Array.isArray((value as Record<string, unknown>).calcs)) {
    throw new ValidationError("Expected { calcs: [] } body");
  }
  return (value as { calcs: unknown[] }).calcs.map((request, index) => parseCalcRequest(request, index));
}
