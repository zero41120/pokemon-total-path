import { calculate, Field, Generations, Move, Pokemon, Side } from "@smogon/calc";
import { NATURES } from "@smogon/calc/dist/data/natures.js";
import type { GenerationNum, StatID, StatsTable } from "@smogon/calc";
import { ValidationError } from "./errors";
import type { CalcRequest, PokemonInput, PokemonParams, MoveInput, MoveParams, FieldInput, SideInput } from "./schemas";

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
  const p = input.params ?? {};
  const resolvedEvs = resolveEvs(p.evs);
  const ivs = STAT_ORDER.reduce((acc, k) => ({ ...acc, [k]: FIXED_IV }), {} as Partial<StatsTable>);

  let overrides: Record<string, unknown> | undefined;
  if (p.forceStatsValue && Object.keys(p.forceStatsValue).length > 0) {
    const { plus, minus } = getNatureMods(p.nature);
    const baseStats: Partial<StatsTable> = {};
    for (const [k, v] of Object.entries(p.forceStatsValue) as [StatID, number][]) {
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
    ability: p.ability,
    abilityOn: p.abilityOn,
    item: p.item,
    gender: p.gender as never,
    nature: p.nature,
    evs: resolvedEvs,
    ivs,
    boosts: p.boosts as Partial<StatsTable>,
    curHP: p.currentHp,
    status: p.status as never,
    teraType: p.teraType as never,
    isDynamaxed: p.isDynamaxed,
    dynamaxLevel: p.dynamaxLevel,
    alliesFainted: p.alliesFainted,
    boostedStat: p.boostedStat as never,
    toxicCounter: p.toxicCounter,
    moves: p.moves as never,
    overrides: overrides as never,
  });
}

function buildMove(genNum: GenerationNum, input: MoveInput): Move {
  const gen = Generations.get(genNum);
  const p = input.params ?? {};
  return new Move(gen, input.name, {
    isCrit: p.isCrit,
    useZ: p.useZ,
    useMax: p.useMax,
    isStellarFirstUse: p.isStellarFirstUse,
    hits: p.hits,
    timesUsed: p.timesUsed,
    timesUsedWithMetronome: p.timesUsedWithMetronome,
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
  params: PokemonParams | undefined,
): string {
  const { plus, minus } = getNatureMods(params?.nature);
  const pts = toChampPoints(params?.evs);
  const forced = params?.forceStatsValue;

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
  const defCurHp = defender.curHP();
  const minPct = Math.round((minDmg / defHp) * 1000) / 10;
  const maxPct = Math.round((maxDmg / defHp) * 1000) / 10;
  let ko: { chance: number | undefined; n: number; text: string };
  try {
    ko = result.kochance();
  } catch {
    ko = { chance: undefined, n: 0, text: "" };
  }

  // Post-process KO analysis for multi-hit moves or other edge cases where the underlying lib might be too optimistic.
  // If the total max damage is less than the defender's current health, it's impossible to KO in 1 turn.
  if (maxDmg < defCurHp) {
    ko = { chance: 0, n: 1, text: "not a KO" };
  }

  let description = result.desc();
  // If we corrected the KO text to 'not a KO', ensure the description reflects this.
  if (ko.text === "not a KO" && description.includes("--")) {
    const parts = description.split(" -- ");
    if (parts.length > 1) {
      // The last part is usually the KO chance
      description = parts.slice(0, -1).join(" -- ") + " -- " + ko.text;
    }
  }

  return {
    description,
    attackerStats: formatStats(attacker, request.attacker.params),
    defenderStats: formatStats(defender, request.defender.params),
    range: [minDmg, maxDmg],
    percent: [minPct, maxPct],
    ko: { chance: ko.chance, n: ko.n, text: ko.text },
  };
}
