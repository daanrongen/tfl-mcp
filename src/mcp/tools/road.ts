import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Effect, type ManagedRuntime } from "effect";
import { z } from "zod";
import type { TflDisambiguationError, TflError } from "../../domain/errors.ts";
import { TflClient } from "../../domain/TflClient.ts";
import { formatError, formatSuccess } from "../utils.ts";

type Road = {
  id?: string;
  displayName?: string;
  statusSeverity?: string;
  statusSeverityDescription?: string;
};

type RoadDisruption = {
  id?: string;
  category?: string;
  subCategory?: string;
  comments?: string;
  currentUpdate?: string;
  severity?: string;
  level?: string;
  streets?: Array<{ name?: string; closure?: string }>;
  startDateTime?: string;
  endDateTime?: string;
};

const formatRoad = (r: Road): string =>
  [
    `Road: ${r.displayName ?? r.id ?? "Unknown"}`,
    `Status: ${r.statusSeverityDescription ?? r.statusSeverity ?? "Unknown"}`,
  ].join("\n");

const formatDisruption = (d: RoadDisruption): string => {
  const lines = [
    `ID: ${d.id ?? "?"}`,
    `Category: ${d.category ?? "?"}${d.subCategory ? ` / ${d.subCategory}` : ""}`,
    `Severity: ${d.severity ?? "?"} (${d.level ?? "?"})`,
  ];
  if (d.comments) lines.push(`Comments: ${d.comments}`);
  if (d.currentUpdate) lines.push(`Update: ${d.currentUpdate}`);
  if (d.startDateTime) lines.push(`Start: ${d.startDateTime}`);
  if (d.endDateTime) lines.push(`End: ${d.endDateTime}`);
  if (d.streets?.length) {
    lines.push(
      `Streets: ${d.streets.map((s) => `${s.name ?? "?"}${s.closure ? ` (${s.closure})` : ""}`).join(", ")}`,
    );
  }
  return lines.join("\n");
};

export const registerRoadTools = (
  server: McpServer,
  runtime: ManagedRuntime.ManagedRuntime<TflClient, TflError | TflDisambiguationError>,
) => {
  server.tool(
    "road_lookup",
    "Gets status for roads on the TfL Road Network (TLRN). Omit ids to get all roads.",
    {
      ids: z
        .string()
        .optional()
        .describe("Comma-separated road IDs (e.g. 'A1,A2'). Omit to get all roads on the TLRN."),
    },
    {
      title: "Road Lookup",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    async ({ ids }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          if (ids) {
            const data = yield* client.request<Road[]>(`/Road/${encodeURIComponent(ids)}`);
            return `Road status:\n\n${data.map(formatRoad).join("\n\n")}`;
          }
          const data = yield* client.request<Road[]>("/Road");
          return `Road network status (${data.length} roads):\n\n${data.map(formatRoad).join("\n\n")}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "road_disruptions",
    "Gets active disruptions on specific TLRN roads, or all disruptions across the entire network. Valid disruption categories: roadworks, incidents, streetworks, plannedworks, events, trafficflow.",
    {
      ids: z
        .string()
        .optional()
        .describe("Comma-separated road IDs (e.g. 'A1,A2'). Omit to get all TLRN disruptions."),
      stripContent: z
        .boolean()
        .optional()
        .describe("If true, strip HTML from disruption descriptions"),
      severities: z
        .string()
        .optional()
        .describe("Comma-separated severity filter (e.g. 'Serious,Severe')"),
      categories: z
        .string()
        .optional()
        .describe("Comma-separated category filter (e.g. 'roadworks,incidents')"),
      closures: z.boolean().optional().describe("If true, only return closures"),
    },
    {
      title: "Road Disruptions",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    async ({ ids, stripContent, severities, categories, closures }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          if (ids) {
            const data = yield* client.request<RoadDisruption[]>(
              `/Road/${encodeURIComponent(ids)}/Disruption`,
              { stripContent, severities, categories, closures },
            );
            if (!data.length) return `No active disruptions for roads: ${ids}`;
            return `Disruptions on ${ids}:\n\n${data.map(formatDisruption).join("\n---\n")}`;
          }
          const data = yield* client.request<RoadDisruption[]>("/Road/all/Disruption", {
            stripContent,
            severities,
            categories,
            closures,
          });
          if (!data.length) return "No active road disruptions on the TLRN.";
          return `All TLRN disruptions (${data.length}):\n\n${data.map(formatDisruption).join("\n---\n")}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );
};
