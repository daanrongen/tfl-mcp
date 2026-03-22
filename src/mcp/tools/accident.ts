import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Effect, type ManagedRuntime } from "effect";
import { z } from "zod";
import { TflClient } from "../../domain/TflClient.ts";
import type { TflDisambiguationError, TflError } from "../../domain/errors.ts";
import { formatError, formatSuccess } from "../utils.ts";

export const registerAccidentTools = (
  server: McpServer,
  runtime: ManagedRuntime.ManagedRuntime<
    TflClient,
    TflError | TflDisambiguationError
  >,
) => {
  server.tool(
    "accident_stats",
    "Gets all accident details for accidents occurring in the specified year in London.",
    {
      year: z
        .number()
        .int()
        .min(2005)
        .max(new Date().getFullYear())
        .describe(
          "The year for which to retrieve accident statistics (e.g. 2023)",
        ),
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
          const data = yield* client.request<unknown[]>(
            `/AccidentStats/${year}`,
          );
          const count = Array.isArray(data) ? data.length : "unknown";
          return `Accident statistics for ${year} (${count} incidents):\n\n${JSON.stringify(data, null, 2)}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );
};
