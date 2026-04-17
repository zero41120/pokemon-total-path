import { AppError, ValidationError } from "./lib/errors";
import { scheduleSelfUpdate } from "./lib/self-update";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
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
