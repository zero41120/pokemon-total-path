import type { CalcField } from "./schema";

export function buildEndState(field?: CalcField, extraNotes: string[] = []) {
  return {
    weather: field?.weather ?? "none",
    tailwind: {
      attacker: field?.attackerSide?.tailwind ? "active" : "inactive",
      defender: field?.defenderSide?.tailwind ? "active" : "inactive",
    },
    other: extraNotes,
  };
}
