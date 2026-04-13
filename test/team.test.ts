import { describe, expect, test } from "bun:test";
import { getTeamMember, loadTeam } from "../src/lib/team";

describe("team loading", () => {
  test("loads six team members", async () => {
    const team = await loadTeam();
    expect(team.pokemon).toHaveLength(6);
  });

  test("can resolve Pelipper by name", async () => {
    const pelipper = await getTeamMember("Pelipper");
    expect(pelipper.stats.spe).toBe(123);
    expect(pelipper.moves).toContain("Ice Beam");
  });
});
