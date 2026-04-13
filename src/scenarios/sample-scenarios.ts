import type { ScenarioRequest } from "../lib/schema";

export const sampleScenario: ScenarioRequest = {
  scenario: "Pelipper into no-speed Garchomp",
  calc: {
    attacker: { teamSlot: "Pelipper" },
    defender: {
      species: "Garchomp",
      level: 50,
      ability: "Rough Skin",
      item: "Clear Amulet",
      stats: {
        hp: 183,
        atk: 150,
        def: 115,
        spa: 90,
        spd: 105,
        spe: 122,
      },
    },
    move: "Ice Beam",
    field: {
      weather: "rain",
    },
    notes: ["Benchmark check against no-speed Garchomp at 122 Speed."],
  },
  turnActions: [
    "(Pelipper) - Ice Beam into Garchomp",
    "(Garchomp) - acts after Pelipper if it survives",
  ],
  fieldStateNotes: [
    "Tailwind inactive on both sides",
  ],
};
