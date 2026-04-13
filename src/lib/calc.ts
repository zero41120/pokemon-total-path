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
  const speed = buildSpeedSummary(attacker.resolved.stats.spe, defender.resolved.stats.spe, request.field);

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
      description: result.desc(),
      fullDescription: result.fullDesc("px"),
      damage: result.damage,
      rawDamageRange: damageRange,
    },
    damage: {
      min: damageRange[0],
      max: damageRange[1],
      percentMin: toPercent(damageRange[0], defenderHP),
      percentMax: toPercent(damageRange[1], defenderHP),
      ko: describeKo(damageRange, defenderHP),
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
