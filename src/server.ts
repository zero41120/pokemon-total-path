import { AppError } from "./lib/errors";
import { runCalc } from "./lib/calc";
import { CalcRequestSchema } from "./lib/schemas";
import { scheduleSelfUpdate } from "./lib/self-update";

import * as z from "zod/v4";

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

  // Fallback check for ZodError if instanceof fails due to version/path aliasing
  const isZodError = error && typeof error === "object" && ((error as any).name === "ZodError" || (error as any).constructor?.name === "ZodError");
  
  if (isZodError) {
    const errObj = error as any;
    console.log("ZodError detected. Keys:", Object.keys(errObj));
    const issues = errObj.issues || errObj.errors || [];
    const details = Array.isArray(issues) && issues.length > 0
      ? issues.map((i: any) => `${i.path.join(".")}: ${i.message}`)
      : errObj.format ? errObj.format() : errObj;
    return json({ error: "Validation failed (v2)", details }, 400);
  }

  const errorName = (error as any)?.constructor?.name || "UnknownError";
  console.error(`Internal Server Error [${errorName}]:`, error);
  return json(
    {
      error: error instanceof Error ? error.message : "Unknown server error",
      errorType: errorName,
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

        if (request.method === "POST" && url.pathname === "/calc") {
          let body;
          try {
            body = await request.json();
          } catch (e) {
            return json({ error: "Invalid JSON body" }, 400);
          }
          const parsed = CalcRequestSchema.parse(body);
          return json(runCalc(parsed));
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
