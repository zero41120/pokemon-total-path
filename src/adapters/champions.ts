import { Generations, Stats, toID } from "@smogon/calc";
import { AppError, ValidationError } from "../lib/errors";
import type { CombatantInput, ExactStats } from "../lib/schema";
import { createExactStatPokemon, type AdaptedPokemonInput } from "./smogon";

const GEN = Generations.get(9);
const CHAMPIONS_IV = 31;

export type ResolvedCombatant = {
  displayName: string;
  calcSpecies: string;
  level: number;
  item?: string;
  ability?: string;
  displayAbility?: string;
  stats: ExactStats;
  source: "exact-stats" | "champions-points";
  championsPoints?: Partial<Record<"hp" | "atk" | "def" | "spa" | "spd" | "spe", number>>;
  nature?: string;
  moves?: string[];
  currentHP?: number;
  boosts?: CombatantInput["boosts"];
  teraType?: string;
};

function mergeChampionsPoints(
  points: Partial<Record<"hp" | "atk" | "def" | "spa" | "spd" | "spe", number>>,
) {
  const total = Object.values(points).reduce((sum, value) => sum + (value ?? 0), 0);
  if (total > 66) {
    throw new ValidationError("Combined Champions point total cannot exceed 66");
  }
  return points;
}

function calculateChampionsStats(speciesName: string, level: number, points: Record<string, number>, nature: string) {
  const species = GEN.species.get(toID(speciesName));
  if (!species) {
    throw new AppError(`Unknown species: ${speciesName}`, 404);
  }

  return {
    hp: Stats.calcStat(GEN, "hp", species.baseStats.hp, CHAMPIONS_IV, (points.hp ?? 0) * 8, level, nature),
    atk: Stats.calcStat(GEN, "atk", species.baseStats.atk, CHAMPIONS_IV, (points.atk ?? 0) * 8, level, nature),
    def: Stats.calcStat(GEN, "def", species.baseStats.def, CHAMPIONS_IV, (points.def ?? 0) * 8, level, nature),
    spa: Stats.calcStat(GEN, "spa", species.baseStats.spa, CHAMPIONS_IV, (points.spa ?? 0) * 8, level, nature),
    spd: Stats.calcStat(GEN, "spd", species.baseStats.spd, CHAMPIONS_IV, (points.spd ?? 0) * 8, level, nature),
    spe: Stats.calcStat(GEN, "spe", species.baseStats.spe, CHAMPIONS_IV, (points.spe ?? 0) * 8, level, nature),
  };
}

export async function resolveCombatant(input: CombatantInput): Promise<ResolvedCombatant> {
  const nature = input.nature ?? "Serious";
  const championsPoints = input.championsPoints
    ? mergeChampionsPoints(input.championsPoints)
    : undefined;

  let stats = input.stats!;
  let sourceType: ResolvedCombatant["source"] = "exact-stats";

  if (!input.stats && championsPoints) {
    stats = calculateChampionsStats(input.species, input.level ?? 50, championsPoints, nature);
    sourceType = "champions-points";
  }

  return {
    displayName: input.name ?? input.species,
    calcSpecies: input.baseSpecies ?? input.species,
    level: input.level ?? 50,
    item: input.item,
    ability: input.ability,
    displayAbility: input.ability,
    stats,
    source: sourceType,
    championsPoints,
    nature,
    moves: input.moves,
    currentHP: input.currentHP,
    boosts: input.boosts,
    teraType: input.teraType,
  };
}

export async function toCalcPokemon(input: CombatantInput) {
  const resolved = await resolveCombatant(input);

  const smogonInput: AdaptedPokemonInput = {
    species: resolved.calcSpecies,
    displayName: resolved.displayName,
    level: resolved.level,
    item: resolved.item,
    ability: resolved.ability,
    moves: resolved.moves,
    stats: resolved.stats,
    currentHP: resolved.currentHP,
    boosts: resolved.boosts,
    teraType: resolved.teraType,
  };

  return {
    resolved,
    pokemon: createExactStatPokemon(smogonInput),
  };
}

export async function resolvePokemonStats(speciesName: string) {
  const species = GEN.species.get(toID(speciesName));
  if (!species) {
    throw new AppError(`Unknown species: ${speciesName}`, 404);
  }

  const stats = calculateChampionsStats(speciesName, 50, {}, "Serious");
  return {
    name: speciesName,
    species: speciesName,
    stats,
    note: "IV are always 31 and is included in the stats field."
  };
}
