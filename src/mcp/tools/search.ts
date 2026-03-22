import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Effect, type ManagedRuntime } from "effect";
import { z } from "zod";
import { TflClient } from "../../domain/TflClient.ts";
import type { TflDisambiguationError, TflError } from "../../domain/errors.ts";
import { formatError, formatSuccess } from "../utils.ts";

export const registerSearchTools = (
  server: McpServer,
  runtime: ManagedRuntime.ManagedRuntime<
    TflClient,
    TflError | TflDisambiguationError
  >,
) => {
  server.tool(
    "search",
    "Search the TfL site and data for any query — finds stations, stops, lines, places, and other TfL content. Returns up to 100 results.",
    {
      query: z
        .string()
        .min(1)
        .describe(
          "Search term (e.g. 'Victoria', 'Waterloo', 'Northern line', 'bus 25')",
        ),
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
          const data = yield* client.request<unknown>("/Search", { query });
          return `Search results for "${query}":\n\n${JSON.stringify(data, null, 2)}`;
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
      query: z
        .string()
        .describe(
          "Bus route number or name to search for (e.g. '25', '73', 'N25')",
        ),
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
          const data = yield* client.request<unknown>("/Search/BusSchedules", {
            query,
          });
          return `Bus schedule search results for "${query}":\n\n${JSON.stringify(data, null, 2)}`;
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
          const data = yield* client.request<unknown>(
            "/Search/Meta/Categories",
          );
          return `Search categories:\n\n${JSON.stringify(data, null, 2)}`;
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
          const data = yield* client.request<unknown>(
            "/Search/Meta/SearchProviders",
          );
          return `Search providers:\n\n${JSON.stringify(data, null, 2)}`;
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
          const data = yield* client.request<unknown>("/Search/Meta/Sorts");
          return `Search sort options:\n\n${JSON.stringify(data, null, 2)}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );
};
