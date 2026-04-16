import { AppError, ValidationError } from "../lib/errors";
import type { CombatantInput, ExactStats } from "../lib/schema";
import { createExactStatPokemon, type AdaptedPokemonInput } from "./smogon";
import { Generations, Stats, toID } from "@smogon/calc";

const GEN = Generations.get(9);
const CHAMPIONS_IV = 31;

export type ResolvedCombatant = {
  displayName: string;
  calcSpecies: string;
  level: number;
  item?: string;
  ability?: string;
  displayAbility?: string;
  megaAbility?: string;
  stats: ExactStats;
  source: "exact-stats" | "champions-points";
  championsPoints?: Partial<Record<"hp" | "atk" | "def" | "spa" | "spd" | "spe", number>>;
  nature?: string;
  forcedWeather?: string;
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

function resolveAbility(ability?: string) {
  if (!ability || ability === "Mega Sol") return { calcAbility: undefined };
  return { calcAbility: ability };
}

export async function resolveCombatant(input: CombatantInput): Promise<ResolvedCombatant> {
  const { calcAbility } = resolveAbility(input.megaAbility ?? input.ability);
  const displayAbility = input.megaAbility ?? input.ability;
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
    ability: calcAbility,
    displayAbility,
    megaAbility: input.megaAbility,
    stats,
    source: sourceType,
    championsPoints,
    nature,
    forcedWeather: displayAbility === "Mega Sol" ? "Sun" : undefined,
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
    baseStats: species.baseStats,
    stats,
  };
}
