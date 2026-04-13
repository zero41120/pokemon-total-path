import type { TeamFile, TeamPokemon } from "./schema";

let teamCache: TeamFile | undefined;

async function readJson<T>(relativePath: string): Promise<T> {
  const file = Bun.file(new URL(relativePath, import.meta.url));
  return await file.json();
}

export async function loadTeam(): Promise<TeamFile> {
  if (!teamCache) {
    teamCache = await readJson<TeamFile>("../../data/team.json");
  }
  return teamCache;
}

export async function getTeamMember(name: string): Promise<TeamPokemon> {
  const team = await loadTeam();
  const found = team.pokemon.find((pokemon) => pokemon.name === name);
  if (!found) {
    throw new Error(`Unknown team member: ${name}`);
  }
  return found;
}
