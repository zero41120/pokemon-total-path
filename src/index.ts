import { startMcpServer } from "./mcp";
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

  console.log("Usage: bun run src/index.ts <server|mcp> [port]");
}

await main();
