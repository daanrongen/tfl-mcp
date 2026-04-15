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
    "Search the TfL site and data for any query — finds stations, stops, lines, places, and other TfL content. Returns up to 100 results.",
    {
      query: z
        .string()
        .min(1)
        .describe("Search term (e.g. 'Victoria', 'Waterloo', 'Northern line', 'bus 25')"),
    },
    {
      title: "TfL Search",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ query }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
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

  server.tool(
    "search_bus_schedules",
    "Searches for bus schedule documents on TfL's S3 storage for a given bus route number.",
    {
      query: z.string().describe("Bus route number or name to search for (e.g. '25', '73', 'N25')"),
    },
    {
      title: "Bus Schedule Search",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ query }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<SearchResponse>("/Search/BusSchedules", { query });
          const matches = data.matches ?? [];
          if (!matches.length) return `No bus schedule documents found for "${query}".`;
          const header = `Bus schedule results for "${query}" (${matches.length} of ${data.total ?? "?"}):`;
          return `${header}\n\n${matches.map(formatMatch).join("\n")}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "search_meta_categories",
    "Gets the available search categories that can be used to filter TfL search results.",
    {},
    {
      title: "Search Meta Categories",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async () => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<string[]>("/Search/Meta/Categories");
          return `Search categories (${data.length}):\n\n${data.join("\n")}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "search_meta_providers",
    "Gets the available search provider names used by the TfL search API.",
    {},
    {
      title: "Search Meta Providers",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async () => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<string[]>("/Search/Meta/SearchProviders");
          return `Search providers (${data.length}):\n\n${data.join("\n")}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "search_meta_sorts",
    "Gets the available sorting options for TfL search results.",
    {},
    {
      title: "Search Meta Sorts",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async () => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<string[]>("/Search/Meta/Sorts");
          return `Search sort options (${data.length}):\n\n${data.join("\n")}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );
};
