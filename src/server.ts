import { AppError, ValidationError } from "./lib/errors";
import { runBatch } from "./lib/calc";
import { parseCalcRequests } from "./lib/schema";
import { resolvePokemonStats } from "./adapters/champions";
import { scheduleSelfUpdate } from "./lib/self-update";

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

type CreateServerOptions = {
  scheduleUpdate?: typeof scheduleSelfUpdate;
};

export function createServer(port = Number(Bun.env.PORT ?? 3000), options: CreateServerOptions = {}) {
  const runSelfUpdate = options.scheduleUpdate ?? scheduleSelfUpdate;

  return {
    port,
    fetch: async (request: Request) => {
      const url = new URL(request.url);

      try {
        if (request.method === "POST" && url.pathname === "/calc") {
          const body = await parseRequestBody(request);
          return json(await runBatch(parseCalcRequests(body)));
        }

        if (request.method === "GET" && url.pathname.startsWith("/pokemon/stats/")) {
          const name = decodeURIComponent(url.pathname.slice("/pokemon/stats/".length));
          if (!name) return json({ error: "Not found" }, 404);
          return json(await resolvePokemonStats(name));
        }

        if (request.method === "GET" && url.pathname === "/gitpull") {
          const update = runSelfUpdate();
          return json(
            {
              ok: true,
              message: "Self-update scheduled",
              pid: update.pid,
            },
            202,
          );
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
