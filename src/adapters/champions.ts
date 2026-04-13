import { ValidationError } from "../lib/errors";
import type { CombatantInput, TeamPokemon } from "../lib/schema";
import { getTeamMember } from "../lib/team";
import { createExactStatPokemon, type AdaptedPokemonInput } from "./smogon";
import { Generations, Stats, toID } from "@smogon/calc";
import { getChampionsPreset } from "../lib/presets";

const GEN = Generations.get(9);
const CHAMPIONS_IV = 32;

export type ResolvedCombatant = {
  displayName: string;
  calcSpecies: string;
  level: number;
  item?: string;
  ability?: string;
  displayAbility?: string;
  megaAbility?: string;
  stats: TeamPokemon["stats"];
  source: "exact-stats" | "champions-points";
  championsPoints?: Partial<Record<"hp" | "atk" | "def" | "spa" | "spd" | "spe", number>>;
  nature?: string;
  forcedWeather?: string;
  moves?: string[];
  currentHP?: number;
  boosts?: CombatantInput["boosts"];
  teraType?: string;
  notes: string[];
};

function mergeChampionsPoints(
  presetPoints: Partial<Record<"hp" | "atk" | "def" | "spa" | "spd" | "spe", number>>,
  overridePoints: Partial<Record<"hp" | "atk" | "def" | "spa" | "spd" | "spe", number>> = {},
) {
  const merged = { ...presetPoints, ...overridePoints };
  const total = Object.values(merged).reduce((sum, value) => sum + (value ?? 0), 0);
  if (total > 66) {
    throw new ValidationError("Combined Champions point total cannot exceed 66");
  }
  return merged;
}

function calculateChampionsStats(speciesName: string, level: number, points: Record<string, number>, nature: string) {
  const species = GEN.species.get(toID(speciesName));
  if (!species) {
    throw new ValidationError(`Unknown species for Champions point conversion: ${speciesName}`);
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

async function normalizeSpecies(species: string) {
  return {
    calcSpecies: species,
    notes: [] as string[],
  };
}

async function normalizeAbility(ability?: string) {
  if (!ability) {
    return {
      calcAbility: undefined,
      notes: [] as string[],
    };
  }
  if (ability === "Mega Sol") {
    return {
      calcAbility: undefined,
      notes: ["Mega Sol forces sun for this Pokemon's calculations and ignores all other weather."],
    };
  }
  return {
    calcAbility: ability,
    notes: [] as string[],
  };
}

function mergeTeamMember(teamMember: TeamPokemon, overrides: CombatantInput): TeamPokemon {
  return {
    ...teamMember,
    ...overrides,
    stats: overrides.stats ?? teamMember.stats,
    moves: overrides.moves ?? teamMember.moves,
    level: overrides.level ?? teamMember.level,
    item: overrides.item ?? teamMember.item,
    ability: overrides.ability ?? teamMember.ability,
    megaAbility: overrides.megaAbility ?? teamMember.megaAbility,
  };
}

export async function resolveCombatant(input: CombatantInput): Promise<ResolvedCombatant> {
  const source = input.teamSlot ? mergeTeamMember(await getTeamMember(input.teamSlot), input) : ({
    name: input.name ?? input.species!,
    species: input.species!,
    baseSpecies: input.baseSpecies,
    item: input.item,
    ability: input.ability,
    megaAbility: input.megaAbility,
    level: input.level ?? 50,
    stats: input.stats!,
    moves: input.moves ?? [],
  } as TeamPokemon);

  const { calcSpecies, notes: speciesNotes } = await normalizeSpecies(source.species);
  const { calcAbility, notes: abilityNotes } = await normalizeAbility(source.megaAbility ?? source.ability);
  const displayAbility = source.megaAbility ?? source.ability;
  const preset = input.championsPreset ? getChampionsPreset(input.championsPreset) : undefined;
  const nature = input.nature ?? preset?.nature ?? "Serious";
  const championsPoints = preset || input.championsPoints
    ? mergeChampionsPoints(preset?.points ?? {}, input.championsPoints ?? {})
    : undefined;
  const notes = [
    ...speciesNotes,
    ...abilityNotes,
  ];
  let stats = source.stats;
  let sourceType: ResolvedCombatant["source"] = "exact-stats";

  if (!input.stats && championsPoints) {
    if (source.species !== calcSpecies && source.baseSpecies) {
      throw new ValidationError(
        `Champions point conversion is not supported for custom remapped species ${source.species}; provide exact stats instead.`,
      );
    }
    stats = calculateChampionsStats(calcSpecies, source.level, championsPoints, nature);
    sourceType = "champions-points";
    notes.push(
      `Final stats were derived from Champions points using fixed IV ${CHAMPIONS_IV}, level ${source.level}, and nature ${nature}.`,
      ...(preset?.notes ?? []),
    );
  } else {
    notes.push("Exact final stats override the standard Gen 9 EV and IV stat calculation.");
  }

  return {
    displayName: source.name,
    calcSpecies: source.baseSpecies ?? calcSpecies,
    level: source.level,
    item: source.item,
    ability: calcAbility,
    displayAbility,
    megaAbility: source.megaAbility,
    stats,
    source: sourceType,
    championsPoints,
    nature,
    forcedWeather: displayAbility === "Mega Sol" ? "Sun" : undefined,
    moves: source.moves,
    currentHP: input.currentHP,
    boosts: input.boosts,
    teraType: input.teraType,
    notes,
  };
}

export async function toCalcPokemon(input: CombatantInput) {
  const resolved = await resolveCombatant(input);
  if (!resolved.calcSpecies) {
    throw new ValidationError(`Could not resolve calc species for ${resolved.displayName}`);
  }

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
