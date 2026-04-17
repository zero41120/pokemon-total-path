import { calculate, Field, Generations, Move, Pokemon, Side } from "@smogon/calc";
import { NATURES } from "@smogon/calc/dist/data/natures.js";
import type { GenerationNum, StatID, StatsTable } from "@smogon/calc";
import { ValidationError } from "./errors";
import type { CalcRequest, PokemonInput, MoveInput, FieldInput, SideInput } from "./schemas";

const FIXED_LEVEL = 50;
const FIXED_IV = 31;
const CHAMP_THRESHOLD = 32;
const STAT_ORDER: StatID[] = ["hp", "atk", "def", "spa", "spd", "spe"];

type StatsObj = Partial<Record<StatID, number>>;

export type CalcResult = {
  description: string;
  attackerStats: string;
  defenderStats: string;
  range: [number, number];
  percent: [number, number];
  ko: { chance: number | undefined; n: number; text: string };
};

function getNatureMods(nature?: string): { plus?: StatID; minus?: StatID } {
  if (!nature) return {};
  const entry = NATURES[nature];
  if (!entry) return {};
  const [plus, minus] = entry;
  return plus === minus ? {} : { plus, minus };
}

function isChampMode(evs: StatsObj): boolean {
  return Object.values(evs).every((v) => v === undefined || v <= CHAMP_THRESHOLD);
}

function resolveEvs(evs: StatsObj | undefined): Partial<StatsTable> {
  if (!evs || Object.keys(evs).length === 0) return {};
  const champ = isChampMode(evs);
  const result: Partial<StatsTable> = {};
  for (const [k, v] of Object.entries(evs) as [StatID, number][]) {
    result[k] = champ ? v * 8 : v;
  }
  return result;
}

function toChampPoints(evs: StatsObj | undefined): Partial<Record<StatID, number>> {
  if (!evs || Object.keys(evs).length === 0) return {};
  const champ = isChampMode(evs);
  const result: Partial<Record<StatID, number>> = {};
  for (const [k, v] of Object.entries(evs) as [StatID, number][]) {
    result[k] = champ ? v : Math.round(v / 8);
  }
  return result;
}

// Back-calculate the base stat that produces targetFinal at level 50, iv=31, ev=0, given nature multiplier.
// Non-HP: finalStat = floor((2*base + 31) / 2 + 5) * nm  ≈  (base + 20) * nm
// HP:     finalStat = floor((2*base + 31) / 2) + 60       ≈  base + 75
function backCalcBase(target: number, stat: StatID, nm: number): number {
  if (stat === "hp") return target - 75;
  return Math.round(target / nm) - 20;
}

function buildPokemon(genNum: GenerationNum, input: PokemonInput): Pokemon {
  const gen = Generations.get(genNum);
  const resolvedEvs = resolveEvs(input.evs);
  const ivs = STAT_ORDER.reduce((acc, k) => ({ ...acc, [k]: FIXED_IV }), {} as Partial<StatsTable>);

  let overrides: Record<string, unknown> | undefined;
  if (input.forceStatsValue && Object.keys(input.forceStatsValue).length > 0) {
    const { plus, minus } = getNatureMods(input.nature);
    const baseStats: Partial<StatsTable> = {};
    for (const [k, v] of Object.entries(input.forceStatsValue) as [StatID, number][]) {
      if (v == null) continue;
      const nm = k === plus ? 1.1 : k === minus ? 0.9 : 1.0;
      baseStats[k] = backCalcBase(v, k, nm);
      resolvedEvs[k] = 0;
      ivs[k] = 0;
    }
    overrides = { baseStats };
  }

  return new Pokemon(gen, input.name, {
    level: FIXED_LEVEL,
    ability: input.ability,
    abilityOn: input.abilityOn,
    item: input.item,
    gender: input.gender as never,
    nature: input.nature,
    evs: resolvedEvs,
    ivs,
    boosts: input.boosts as Partial<StatsTable>,
    curHP: input.currentHp,
    status: input.status as never,
    teraType: input.teraType as never,
    isDynamaxed: input.isDynamaxed,
    dynamaxLevel: input.dynamaxLevel,
    alliesFainted: input.alliesFainted,
    boostedStat: input.boostedStat as never,
    toxicCounter: input.toxicCounter,
    moves: input.moves as never,
    overrides: overrides as never,
  });
}

function buildMove(genNum: GenerationNum, input: MoveInput): Move {
  const gen = Generations.get(genNum);
  return new Move(gen, input.name, {
    isCrit: input.isCrit,
    useZ: input.useZ,
    useMax: input.useMax,
    isStellarFirstUse: input.isStellarFirstUse,
    hits: input.hits,
    timesUsed: input.timesUsed,
    timesUsedWithMetronome: input.timesUsedWithMetronome,
  });
}

function buildSide(input?: SideInput): Side {
  if (!input) return new Side();
  return new Side(input as never);
}

function buildField(format: "Singles" | "Doubles", input?: FieldInput): Field {
  return new Field({
    gameType: (format as never),
    weather: input?.weather as never,
    terrain: input?.terrain as never,
    isMagicRoom: input?.isMagicRoom,
    isWonderRoom: input?.isWonderRoom,
    isGravity: input?.isGravity,
    isAuraBreak: input?.isAuraBreak,
    isFairyAura: input?.isFairyAura,
    isDarkAura: input?.isDarkAura,
    isBeadsOfRuin: input?.isBeadsOfRuin,
    isSwordOfRuin: input?.isSwordOfRuin,
    isTabletsOfRuin: input?.isTabletsOfRuin,
    isVesselOfRuin: input?.isVesselOfRuin,
    attackerSide: buildSide(input?.attackerSide),
    defenderSide: buildSide(input?.defenderSide),
  });
}

function formatStats(
  pokemon: Pokemon,
  inputEvs: StatsObj | undefined,
  forced: StatsObj | null | undefined,
  nature: string | undefined,
): string {
  const { plus, minus } = getNatureMods(nature);
  const pts = toChampPoints(inputEvs);

  const vals = STAT_ORDER.map((stat) => {
    const v = pokemon.stats[stat];
    const isForced = forced?.[stat] != null;
    const suffix = isForced ? "!" : stat === plus ? "+" : stat === minus ? "-" : "";
    return `${v}${suffix}`;
  });

  const ptVals = STAT_ORDER.map((stat) => {
    const p = pts[stat] ?? 0;
    const isForced = forced?.[stat] != null;
    const suffix = isForced ? "!" : stat === plus ? "+" : stat === minus ? "-" : "";
    return `${p}${suffix}`;
  });

  return `${vals.join("/")} (${ptVals.join("/")})`;
}

export function runCalc(request: CalcRequest): CalcResult {
  if (!request.format) {
    throw new ValidationError("format (Singles/Doubles) is required");
  }
  const genNum = (request.gen ?? 9) as GenerationNum;

  let attacker: Pokemon, defender: Pokemon, move: Move;
  try {
    attacker = buildPokemon(genNum, request.attacker);
    defender = buildPokemon(genNum, request.defender);
    move = buildMove(genNum, request.move);
  } catch (e) {
    throw new ValidationError(e instanceof Error ? e.message : "Invalid calc input", e);
  }

  const field = buildField(request.format, request.field);
  const result = calculate(genNum, attacker, defender, move, field);

  const [minDmg, maxDmg] = result.range();
  const defHp = defender.stats.hp;
  const minPct = Math.round((minDmg / defHp) * 1000) / 10;
  const maxPct = Math.round((maxDmg / defHp) * 1000) / 10;
  let ko: { chance: number | undefined; n: number; text: string };
  try {
    ko = result.kochance();
  } catch {
    ko = { chance: undefined, n: 0, text: "" };
  }

  return {
    description: result.desc(),
    attackerStats: formatStats(attacker, request.attacker.evs, request.attacker.forceStatsValue, request.attacker.nature),
    defenderStats: formatStats(defender, request.defender.evs, request.defender.forceStatsValue, request.defender.nature),
    range: [minDmg, maxDmg],
    percent: [minPct, maxPct],
    ko: { chance: ko.chance, n: ko.n, text: ko.text },
  };
}
