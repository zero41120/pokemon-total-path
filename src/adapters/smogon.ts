import { Field, Generations, Move, Pokemon, calculate, type StatsTable } from "@smogon/calc";
import { ValidationError } from "../lib/errors";
import type { CalcField, ExactStats } from "../lib/schema";

const GEN = Generations.get(9);
const EMPTY_BOOSTS = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

function normalizeWeather(weather?: string) {
  if (!weather) return undefined;
  const map: Record<string, string> = {
    rain: "Rain",
    sun: "Sun",
    sand: "Sand",
    snow: "Snow",
    harshsunshine: "Harsh Sunshine",
    heavyrain: "Heavy Rain",
  };
  return map[weather.toLowerCase().replace(/\s+/g, "")] ?? weather;
}

function normalizeTerrain(terrain?: string) {
  if (!terrain) return undefined;
  const map: Record<string, string> = {
    electric: "Electric",
    grassy: "Grassy",
    misty: "Misty",
    psychic: "Psychic",
  };
  return map[terrain.toLowerCase()] ?? terrain;
}

function statsToTable(stats: ExactStats): StatsTable {
  return {
    hp: stats.hp,
    atk: stats.atk,
    def: stats.def,
    spa: stats.spa,
    spd: stats.spd,
    spe: stats.spe,
  };
}

export type AdaptedPokemonInput = {
  species: string;
  displayName: string;
  level: number;
  item?: string;
  ability?: string;
  moves?: string[];
  stats: ExactStats;
  currentHP?: number;
  boosts?: Partial<Record<"atk" | "def" | "spa" | "spd" | "spe", number>>;
  teraType?: string;
};

export function createExactStatPokemon(input: AdaptedPokemonInput) {
  const options = {
    level: input.level,
    item: input.item,
    ability: input.ability,
    nature: "Serious",
    moves: input.moves ?? [],
    curHP: input.currentHP ?? input.stats.hp,
    teraType: input.teraType as any,
    boosts: {
      ...EMPTY_BOOSTS,
      ...(input.boosts ?? {}),
    },
    ivs: {
      hp: 31,
      atk: 31,
      def: 31,
      spa: 31,
      spd: 31,
      spe: 31,
    },
    evs: {
      hp: 0,
      atk: 0,
      def: 0,
      spa: 0,
      spd: 0,
      spe: 0,
    },
  };

  const pokemon = new Pokemon(GEN, input.species, options);

  const exactStats = statsToTable(input.stats);
  pokemon.name = input.displayName;
  pokemon.rawStats = exactStats;
  pokemon.stats = { ...exactStats };
  pokemon.originalCurHP = Math.min(input.currentHP ?? input.stats.hp, input.stats.hp);
  pokemon.clone = function cloneExactStatPokemon() {
    const cloned = new Pokemon(GEN, input.species, options);
    cloned.name = input.displayName;
    cloned.rawStats = { ...exactStats };
    cloned.stats = { ...exactStats };
    cloned.originalCurHP = Math.min(input.currentHP ?? input.stats.hp, input.stats.hp);
    cloned.boosts = { ...pokemon.boosts };
    cloned.status = pokemon.status;
    cloned.toxicCounter = pokemon.toxicCounter;
    cloned.moves = [...pokemon.moves];
    cloned.teraType = pokemon.teraType;
    return cloned;
  };
  return pokemon;
}

export function createMove(name: string, species?: string, item?: string, ability?: string) {
  try {
    return new Move(GEN, name, {
      species,
      item,
      ability,
    });
  } catch (error) {
    throw new ValidationError(`Unsupported or unknown move: ${name}`, { cause: error });
  }
}

export function createField(field?: CalcField) {
  return new Field({
    weather: normalizeWeather(field?.weather) as any,
    terrain: normalizeTerrain(field?.terrain) as any,
    attackerSide: {
      isTailwind: !!field?.attackerSide?.tailwind,
      isHelpingHand: !!field?.attackerSide?.helpingHand,
      isFriendGuard: !!field?.attackerSide?.friendGuard,
    },
    defenderSide: {
      isTailwind: !!field?.defenderSide?.tailwind,
      isReflect: !!field?.defenderSide?.reflect,
      isLightScreen: !!field?.defenderSide?.lightScreen,
      isAuroraVeil: !!field?.defenderSide?.auroraVeil,
      isFriendGuard: !!field?.defenderSide?.friendGuard,
      isProtected: !!field?.defenderSide?.protected,
    },
  });
}

export function runSmogonCalc(attacker: Pokemon, defender: Pokemon, move: Move, field?: Field) {
  return calculate(GEN, attacker, defender, move, field);
}
