import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Effect, type ManagedRuntime } from "effect";
import { z } from "zod";
import type { TflDisambiguationError, TflError } from "../../domain/errors.ts";
import { TflClient } from "../../domain/TflClient.ts";
import { formatError, formatSuccess } from "../utils.ts";

type SearchMatch = {
  id?: string;
  url?: string;
  name?: string;
  lat?: number;
  lon?: number;
  zone?: string;
  modes?: string[];
};

type SearchResponse = {
  query?: string;
  total?: number;
  matches?: SearchMatch[];
};

const formatMatch = (m: SearchMatch): string => {
  const parts = [m.name ?? m.id ?? "?"];
  if (m.modes?.length) parts.push(`modes: ${m.modes.join(", ")}`);
  if (m.zone) parts.push(`zone: ${m.zone}`);
  if (m.url) parts.push(m.url);
  return parts.join(" — ");
};

export const registerSearchTools = (
  server: McpServer,
  runtime: ManagedRuntime.ManagedRuntime<TflClient, TflError | TflDisambiguationError>,
) => {
  server.tool(
    "search",
    "Search the TfL site and data. Use scope='bus_schedules' to search for bus schedule documents. Returns up to 100 results.",
    {
      query: z
        .string()
        .min(1)
        .describe("Search term (e.g. 'Victoria', 'Waterloo', 'Northern line', 'bus 25')"),
      scope: z
        .enum(["general", "bus_schedules"])
        .optional()
        .describe(
          "Search scope: 'general' (default) for stations/stops/lines/places, or 'bus_schedules' to search for bus route schedule documents.",
        ),
    },
    {
      title: "TfL Search",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ query, scope }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          if (scope === "bus_schedules") {
            const data = yield* client.request<SearchResponse>("/Search/BusSchedules", { query });
            const matches = data.matches ?? [];
            if (!matches.length) return `No bus schedule documents found for "${query}".`;
            const header = `Bus schedule results for "${query}" (${matches.length} of ${data.total ?? "?"}):`;
            return `${header}\n\n${matches.map(formatMatch).join("\n")}`;
          }
          const data = yield* client.request<SearchResponse>("/Search", { query });
          const matches = data.matches ?? [];
          if (!matches.length) return `No results found for "${query}".`;
          const header = `Search results for "${query}" (${matches.length} of ${data.total ?? "?"}):`;
          return `${header}\n\n${matches.map(formatMatch).join("\n")}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );
};
