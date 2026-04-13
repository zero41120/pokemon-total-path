import { AppError, ValidationError } from "./lib/errors";
import { runBatch, runCalc } from "./lib/calc";
import { formatScenario } from "./lib/format";
import { parseBatchCalcRequest, parseCalcRequest, parsePokemonStatsRequest, parseScenarioRequest } from "./lib/schema";
import { loadTeam } from "./lib/team";
import { listChampionsPresets } from "./lib/presets";
import { resolvePokemonStats } from "./adapters/champions";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

async function parseRequestBody(request: Request) {
  try {
    return await request.json();
  } catch (error) {
    throw new ValidationError("Expected valid JSON request body", { cause: error });
  }
}

function handleError(error: unknown) {
  if (error instanceof AppError) {
    return json({ error: error.message, details: error.details ?? null }, error.status);
  }

  return json(
    {
      error: error instanceof Error ? error.message : "Unknown server error",
    },
    500,
  );
}

export function createServer(port = Number(Bun.env.PORT ?? 3000)) {
  return {
    port,
    fetch: async (request: Request) => {
      const url = new URL(request.url);

      try {
        if (request.method === "GET" && url.pathname === "/health") {
          return json({
            ok: true,
            service: "pokemon-champions-calc",
          });
        }

        if (request.method === "GET" && url.pathname === "/team") {
          return json(await loadTeam());
        }

        if (request.method === "GET" && url.pathname === "/presets") {
          return json({
            championsPresets: listChampionsPresets(),
          });
        }

        if (request.method === "POST" && url.pathname === "/calc") {
          const body = await parseRequestBody(request);
          return json(await runCalc(parseCalcRequest(body)));
        }

        if (request.method === "POST" && url.pathname === "/pokemon/stats") {
          const body = await parseRequestBody(request);
          return json(await resolvePokemonStats(parsePokemonStatsRequest(body).pokemon));
        }

        if (request.method === "POST" && url.pathname === "/calc/batch") {
          const body = await parseRequestBody(request);
          return json({
            results: await runBatch(parseBatchCalcRequest(body)),
          });
        }

        if (request.method === "POST" && url.pathname === "/scenario/run") {
          const body = await parseRequestBody(request);
          const scenarioRequest = parseScenarioRequest(body);
          const result = await runCalc(scenarioRequest.calc);
          return json({
            result,
            formatted: formatScenario(scenarioRequest, result),
          });
        }

        return json({ error: "Not found" }, 404);
      } catch (error) {
        return handleError(error);
      }
    },
  };
}

export function startServer() {
  return Bun.serve(createServer());
}
