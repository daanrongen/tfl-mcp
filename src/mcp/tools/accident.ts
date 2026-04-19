import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Effect, type ManagedRuntime } from "effect";
import { z } from "zod";
import type { TflDisambiguationError, TflError } from "../../domain/errors.ts";
import { TflClient } from "../../domain/TflClient.ts";
import { formatError, formatSuccess } from "../utils.ts";

type AccidentCasualty = {
  age?: number;
  class?: string;
  severity?: string;
  mode?: string;
  ageBand?: string;
};

type AccidentDetail = {
  id?: number;
  lat?: number;
  lon?: number;
  location?: string;
  date?: string;
  severity?: string;
  borough?: string;
  casualties?: AccidentCasualty[];
  vehicles?: Array<{ type?: string }>;
};

const formatAccident = (a: AccidentDetail): string => {
  const location = a.location ?? (a.lat != null ? `${a.lat}, ${a.lon}` : "unknown location");
  const date = a.date ? a.date.slice(0, 10) : "?";
  const casualties = a.casualties?.length ?? 0;
  const severity = a.severity ?? "?";
  const borough = a.borough ? ` (${a.borough})` : "";
  return `${date} — ${severity} — ${location}${borough} — ${casualties} casualty(ies)`;
};

export const registerAccidentTools = (
  server: McpServer,
  runtime: ManagedRuntime.ManagedRuntime<TflClient, TflError | TflDisambiguationError>,
) => {
  server.tool(
    "accident_stats",
    "Gets all accident details for accidents occurring in the specified year in London.",
    {
      year: z.coerce
        .number()
        .int()
        .min(2005)
        .max(new Date().getFullYear() - 1)
        .describe("The year for which to retrieve accident statistics (e.g. 2023)"),
    },
    {
      title: "TfL Accident Statistics",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ year }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<AccidentDetail[]>(`/AccidentStats/${year}`);
          if (!data.length) return `No accident records found for ${year}.`;
          const bySeverity = data.reduce<Record<string, number>>((acc, a) => {
            const key = a.severity ?? "Unknown";
            acc[key] = (acc[key] ?? 0) + 1;
            return acc;
          }, {});
          const summary = Object.entries(bySeverity)
            .map(([sev, count]) => `${sev}: ${count}`)
            .join(", ");
          const recent = data.slice(0, 10).map(formatAccident).join("\n");
          return `Accident statistics for ${year} (${data.length} total — ${summary}):\n\nFirst 10 incidents:\n${recent}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );
};
