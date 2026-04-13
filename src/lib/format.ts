import type { ScenarioRequest } from "./schema";

type CalcResult = Awaited<ReturnType<typeof import("./calc").runCalc>>;

export function formatScenario(request: ScenarioRequest, result: CalcResult) {
  const turnActions = request.turnActions ?? [
    `(${result.attacker.name}) - uses ${result.move}`,
    `(${result.defender.name}) - takes ${result.damage.min}-${result.damage.max} damage`,
  ];

  const otherFieldNotes = [
    ...result.endState.other,
    ...(request.fieldStateNotes ?? []),
  ];

  const lines = [
    `Scenario: ${request.scenario}`,
    "",
    "Turn 1",
    ...turnActions,
    "",
    "End state estimate",
    `${result.defender.name}: ${result.damage.defenderRemainingHPRange[0]}-${result.damage.defenderRemainingHPRange[1]} HP remaining`,
    result.damage.defenderFaints ? `${result.defender.name} faints.` : `${result.defender.name} survives the turn.`,
    result.speed.speedTie
      ? "Speed order is tied under the provided field state."
      : result.speed.attackerMovesFirst
        ? `${result.attacker.name} moves first under the provided field state.`
        : `${result.defender.name} moves first under the provided field state.`,
    "",
    "Field state",
    "",
    `- Weather: ${result.endState.weather}`,
    `- Tailwind: attacker ${result.endState.tailwind.attacker}, defender ${result.endState.tailwind.defender}`,
    `- Other: ${otherFieldNotes.length ? otherFieldNotes.join("; ") : "none"}`,
  ];

  return lines.join("\n");
}
