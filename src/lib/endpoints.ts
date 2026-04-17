import * as z from "zod/v4";
import { CalcRequestSchema } from "./schemas";

export type RestEndpoint = {
  toolName: string;
  title: string;
  description: string;
  method: "GET" | "POST";
  path: string;
  inputSchema: z.ZodTypeAny;
  mcpInputSchema?: z.ZodTypeAny;
  toMcpRequestBody?: (args: unknown) => unknown;
};

export const REST_ENDPOINTS: RestEndpoint[] = [
  {
    toolName: "calc",
    title: "Calculate damage",
    description:
      "Calculate damage between an attacker and defender for a given move and field state. " +
      "Level and IVs are locked to 50 and 31 (Champions format). " +
      "EVs with all values ≤ 32 are auto-detected as Champion stat points (x8 conversion, IVs fixed at 31).",
    method: "POST",
    path: "/calc",
    inputSchema: CalcRequestSchema,
  },
];
