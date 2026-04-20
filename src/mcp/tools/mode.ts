import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Effect, type ManagedRuntime } from "effect";
import { z } from "zod";
import type { TflDisambiguationError, TflError } from "../../domain/errors.ts";
import { TflClient } from "../../domain/TflClient.ts";
import { type ArrivalPrediction, formatArrival } from "../arrivals.ts";
import { formatError, formatSuccess } from "../utils.ts";

export const registerModeTools = (
  server: McpServer,
  runtime: ManagedRuntime.ManagedRuntime<TflClient, TflError | TflDisambiguationError>,
) => {
  server.tool(
    "mode_arrivals",
    "Gets the next arrival predictions for all stops of a given transport mode. Valid modes: tube, bus, dlr, overground, elizabeth-line, tram, cable-car.",
    {
      mode: z
        .string()
        .describe(
          "Transport mode (e.g. 'tube', 'bus', 'dlr', 'overground', 'elizabeth-line', 'tram')",
        ),
      count: z.coerce
        .number()
        .int()
        .positive()
        .optional()
        .describe(
          "Number of arrivals to return per stop (default: all). Use a small value like 5 to reduce response size.",
        ),
    },
    {
      title: "Mode Arrivals",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    async ({ mode, count }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<ArrivalPrediction[]>(
            `/Mode/${encodeURIComponent(mode)}/Arrivals`,
            { count },
          );
          if (!data.length) return `No arrivals found for mode: ${mode}`;
          const sorted = [...data].sort((a, b) => (a.timeToStation ?? 0) - (b.timeToStation ?? 0));
          const formatted = sorted.slice(0, 50).map(formatArrival);
          return `Next arrivals for ${mode} (showing up to 50):\n\n${formatted.join("\n")}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );
};
