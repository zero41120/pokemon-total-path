import { runCalc } from "./lib/calc";
import { formatScenario } from "./lib/format";
import { startMcpServer } from "./mcp";
import { loadTeam } from "./lib/team";
import { sampleScenario } from "./scenarios/sample-scenarios";
import { startServer } from "./server";

async function main() {
  const command = Bun.argv[2] ?? "help";

  if (command === "server") {
    if (Bun.argv[3]) {
      Bun.env.PORT = Bun.argv[3];
    }
    const server = startServer();
    console.log(`Server listening on ${server.url}`);
    return;
  }

  if (command === "mcp") {
    if (Bun.argv[3]) {
      Bun.env.MCP_PORT = Bun.argv[3];
    }
    startMcpServer();
    return;
  }

  if (command === "example") {
    const result = await runCalc(sampleScenario.calc);
    console.log(formatScenario(sampleScenario, result));
    return;
  }

  if (command === "health") {
    const team = await loadTeam();
    console.log(JSON.stringify({ ok: true, team: team.teamName }, null, 2));
    return;
  }

  console.log("Usage: bun run src/index.ts <server|mcp|example|health> [port]");
}

await main();
