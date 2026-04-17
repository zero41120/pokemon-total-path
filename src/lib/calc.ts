import type { CalcRequest, ExactStats, ChampionsPoints } from "./schema";
import { createField, createMove, runSmogonCalc } from "../adapters/smogon";
import { toCalcPokemon } from "../adapters/champions";

const STAT_ORDER = ["hp", "atk", "def", "spa", "spd", "spe"] as const;

const NATURE_MODIFIERS: Record<string, { plus: string; minus: string }> = {
  Lonely: { plus: "atk", minus: "def" }, Brave: { plus: "atk", minus: "spe" },
  Adamant: { plus: "atk", minus: "spa" }, Naughty: { plus: "atk", minus: "spd" },
  Bold: { plus: "def", minus: "atk" }, Relaxed: { plus: "def", minus: "spe" },
  Impish: { plus: "def", minus: "spa" }, Lax: { plus: "def", minus: "spd" },
  Timid: { plus: "spe", minus: "atk" }, Hasty: { plus: "spe", minus: "def" },
  Jolly: { plus: "spe", minus: "spa" }, Naive: { plus: "spe", minus: "spd" },
  Modest: { plus: "spa", minus: "atk" }, Mild: { plus: "spa", minus: "def" },
  Quiet: { plus: "spa", minus: "spe" }, Rash: { plus: "spa", minus: "spd" },
  Calm: { plus: "spd", minus: "atk" }, Gentle: { plus: "spd", minus: "def" },
  Sassy: { plus: "spd", minus: "spe" }, Careful: { plus: "spd", minus: "spa" },
};

function formatStats(stats: ExactStats, nature?: string | null, championsPoints?: ChampionsPoints | null) {
  const mods = nature ? NATURE_MODIFIERS[nature] : undefined;
  const statsStr = STAT_ORDER.map((s) => {
    const suffix = mods?.plus === s ? "+" : mods?.minus === s ? "-" : "";
    return `${stats[s]}${suffix}`;
  }).join("/");
  if (!championsPoints) return statsStr;
  const cpStr = STAT_ORDER.map((s) => championsPoints[s] ?? 0).join("/");
  return `${statsStr} [${cpStr}]`;
}

function toPercent(value: number, hp: number) {
  return Number(((value / hp) * 100).toFixed(1));
}

function describeKo(range: [number, number], hp: number) {
  if (range[0] >= hp) return "guaranteed OHKO";
  if (range[1] >= hp) return "possible OHKO";
  if (range[1] * 2 >= hp) return "strong 2HKO pressure";
  return "no immediate KO";
}

function getOffensiveStatLabel(category?: string) {
  if (category === "Physical") return "Atk";
  if (category === "Special") return "SpA";
  return null;
}

function getDefensiveStatLabel(category?: string) {
  if (category === "Physical") return "Def";
  if (category === "Special") return "SpD";
  return null;
}

function getOffensiveStatValue(category: string | undefined, stats: { atk: number; spa: number }) {
  if (category === "Physical") return stats.atk;
  if (category === "Special") return stats.spa;
  return null;
}

function getDefensiveStatValue(category: string | undefined, stats: { def: number; spd: number }) {
  if (category === "Physical") return stats.def;
  if (category === "Special") return stats.spd;
  return null;
}

function buildResolvedDescription(
  attackerName: string,
  attackerStats: { atk: number; spa: number },
  defenderName: string,
  defenderStats: { hp: number; def: number; spd: number },
  moveName: string,
  moveCategory: string | undefined,
  damageRange: [number, number],
) {
  const offensiveLabel = getOffensiveStatLabel(moveCategory);
  const defensiveLabel = getDefensiveStatLabel(moveCategory);
  const offensiveValue = getOffensiveStatValue(moveCategory, attackerStats);
  const defensiveValue = getDefensiveStatValue(moveCategory, defenderStats);

  if (!offensiveLabel || !defensiveLabel || offensiveValue === null || defensiveValue === null) {
    return `${attackerName} ${moveName} vs. ${defenderName}`;
  }

  const percentMin = toPercent(damageRange[0], defenderStats.hp);
  const percentMax = toPercent(damageRange[1], defenderStats.hp);
  return `${offensiveValue} ${offensiveLabel} ${attackerName} ${moveName} vs. ${defenderStats.hp} HP / ${defensiveValue} ${defensiveLabel} ${defenderName}: ${damageRange[0]}-${damageRange[1]} (${percentMin} - ${percentMax}%)`;
}


export async function runCalc(request: CalcRequest) {
  const attacker = await toCalcPokemon(request.attacker);
  const defender = await toCalcPokemon(request.defender);
  const field = createField(request.field);
  const move = createMove(
    request.move,
    attacker.resolved.calcSpecies,
    attacker.resolved.item,
    attacker.resolved.ability,
  );
  const result = runSmogonCalc(attacker.pokemon, defender.pokemon, move, field);
  const damageRange = result.range();
  const defenderHP = defender.resolved.stats.hp;
  const ko = describeKo(damageRange, defenderHP);
  const resolvedDescription = buildResolvedDescription(
    attacker.resolved.displayName,
    attacker.resolved.stats,
    defender.resolved.displayName,
    defender.resolved.stats,
    request.move,
    result.move.category,
    damageRange,
  );

  return {
    description: `${resolvedDescription} -- ${ko}`,
    attacker: {
      name: attacker.resolved.displayName,
      stats: formatStats(attacker.resolved.stats, attacker.resolved.nature, attacker.resolved.championsPoints),
      item: attacker.resolved.item ?? null,
      ability: attacker.resolved.displayAbility ?? attacker.resolved.ability ?? null,
    },
    defender: {
      name: defender.resolved.displayName,
      stats: formatStats(defender.resolved.stats, defender.resolved.nature, defender.resolved.championsPoints),
      item: defender.resolved.item ?? null,
      ability: defender.resolved.displayAbility ?? defender.resolved.ability ?? null,
    },
    damage: {
      min: damageRange[0],
      max: damageRange[1],
      percentMin: toPercent(damageRange[0], defenderHP),
      percentMax: toPercent(damageRange[1], defenderHP),
      ko,
    },
  };
}

export async function runBatch(requests: CalcRequest[]) {
  return Promise.all(requests.map((request) => runCalc(request)));
}
