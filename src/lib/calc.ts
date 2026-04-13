import type { BatchCalcRequest, CalcRequest } from "./schema";
import { buildEndState } from "./state";
import { createField, createMove, runSmogonCalc } from "../adapters/smogon";
import { toCalcPokemon } from "../adapters/champions";

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

function buildSpeedSummary(attackerSpe: number, defenderSpe: number, field?: CalcRequest["field"]) {
  const attackerTailwind = field?.attackerSide?.tailwind ? 2 : 1;
  const defenderTailwind = field?.defenderSide?.tailwind ? 2 : 1;
  const attackerEffective = attackerSpe * attackerTailwind;
  const defenderEffective = defenderSpe * defenderTailwind;

  return {
    attacker: attackerEffective,
    defender: defenderEffective,
    attackerMovesFirst: attackerEffective > defenderEffective,
    speedTie: attackerEffective === defenderEffective,
  };
}

export async function runCalc(request: CalcRequest) {
  const attacker = await toCalcPokemon(request.attacker);
  const defender = await toCalcPokemon(request.defender);
  const forcedWeather = attacker.resolved.forcedWeather ?? defender.resolved.forcedWeather;
  const field = createField({
    ...request.field,
    weather: forcedWeather ?? request.field?.weather,
  });
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
  const speed = buildSpeedSummary(attacker.resolved.stats.spe, defender.resolved.stats.spe, request.field);
  const resolvedDescription = buildResolvedDescription(
    attacker.resolved.displayName,
    attacker.resolved.stats,
    defender.resolved.displayName,
    defender.resolved.stats,
    request.move,
    result.move.category,
    damageRange,
  );

  const notes = [
    ...attacker.resolved.notes,
    ...defender.resolved.notes,
    ...(forcedWeather
      ? [`Weather was forced to ${forcedWeather} because Mega Sol ignores all other weather for this calculation.`]
      : []),
    ...(request.notes ?? []),
  ];

  return {
    input: request,
    attacker: {
      name: attacker.resolved.displayName,
      species: attacker.resolved.calcSpecies,
      stats: attacker.resolved.stats,
      source: attacker.resolved.source,
      championsPoints: attacker.resolved.championsPoints ?? null,
      nature: attacker.resolved.nature ?? null,
      item: attacker.resolved.item,
      ability: attacker.resolved.displayAbility ?? attacker.resolved.ability ?? attacker.resolved.megaAbility ?? null,
    },
    defender: {
      name: defender.resolved.displayName,
      species: defender.resolved.calcSpecies,
      stats: defender.resolved.stats,
      source: defender.resolved.source,
      championsPoints: defender.resolved.championsPoints ?? null,
      nature: defender.resolved.nature ?? null,
      item: defender.resolved.item,
      ability: defender.resolved.displayAbility ?? defender.resolved.ability ?? defender.resolved.megaAbility ?? null,
    },
    move: request.move,
    engine: {
      description: `${resolvedDescription} -- ${ko}`,
      fullDescription: `${resolvedDescription} -- ${ko}`,
      libraryDescription: result.desc(),
      libraryFullDescription: result.fullDesc("px"),
      damage: result.damage,
      rawDamageRange: damageRange,
    },
    damage: {
      min: damageRange[0],
      max: damageRange[1],
      percentMin: toPercent(damageRange[0], defenderHP),
      percentMax: toPercent(damageRange[1], defenderHP),
      ko,
      defenderRemainingHPRange: [
        Math.max(defenderHP - damageRange[1], 0),
        Math.max(defenderHP - damageRange[0], 0),
      ],
      defenderFaints: damageRange[0] >= defenderHP,
    },
    speed,
    branches: request.branches ?? [],
    endState: buildEndState(
      {
        ...request.field,
        weather: forcedWeather ? forcedWeather.toLowerCase() : request.field?.weather,
      },
      forcedWeather ? ["Mega Sol forced sun and ignored other weather."] : [],
    ),
    notes,
  };
}

export async function runBatch(batchRequest: BatchCalcRequest) {
  return Promise.all(batchRequest.requests.map((request) => runCalc(request)));
}
