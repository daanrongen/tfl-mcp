import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Effect, type ManagedRuntime } from "effect";
import { z } from "zod";
import type { TflDisambiguationError, TflError } from "../../domain/errors.ts";
import { TflClient } from "../../domain/TflClient.ts";
import { formatDisambiguation, formatError, formatSuccess } from "../utils.ts";

type JourneyLeg = {
  duration?: number;
  instruction?: { summary?: string };
  departureTime?: string;
  arrivalTime?: string;
  mode?: { name?: string };
  departurePoint?: { commonName?: string };
  arrivalPoint?: { commonName?: string };
};

type Journey = {
  duration?: number;
  startDateTime?: string;
  arrivalDateTime?: string;
  legs?: JourneyLeg[];
};

type JourneyPlannerResult = { journeys?: Journey[] };

const formatJourney = (j: Journey, index: number): string => {
  const lines = [
    `Journey ${index + 1}:`,
    `  Total Duration: ${j.duration ?? "??"} minutes`,
    `  Departs: ${j.startDateTime ?? "??"}`,
    `  Arrives: ${j.arrivalDateTime ?? "??"}`,
  ];
  if (j.legs?.length) {
    lines.push("  Legs:");
    for (const leg of j.legs) {
      lines.push(
        `    • ${leg.mode?.name?.toUpperCase() ?? "??"} — ${leg.departurePoint?.commonName ?? "?"} → ${leg.arrivalPoint?.commonName ?? "?"} (${leg.duration ?? "??"} min)`,
      );
      if (leg.instruction?.summary) {
        lines.push(`      ${leg.instruction.summary}`);
      }
    }
  }
  return lines.join("\n");
};

export const registerJourneyTools = (
  server: McpServer,
  runtime: ManagedRuntime.ManagedRuntime<TflClient, TflError | TflDisambiguationError>,
) => {
  server.tool(
    "journey_plan",
    "Plan a journey across London's transport network. Valid modes: tube, bus, dlr, overground, elizabeth-line, national-rail, tflrail, tram, cable-car, walking, cycle. Returns journey options with duration, modes, and step-by-step legs.",
    {
      from: z
        .string()
        .describe(
          "Origin location — can be a stop ID (e.g. '1001234'), postcode (e.g. 'SW1A1AA'), coordinates ('lat,lon'), or a place name",
        ),
      to: z
        .string()
        .describe(
          "Destination location — same formats as 'from' (stop ID, postcode, coordinates, or place name)",
        ),
      via: z.string().optional().describe("Optional intermediate stop/location to travel via"),
      date: z
        .string()
        .optional()
        .describe("Date of travel in YYYYMMDD format (e.g. '20240315'). Defaults to today."),
      time: z
        .string()
        .optional()
        .describe("Time of travel in HHMM format (e.g. '0830'). Defaults to now."),
      timeIs: z
        .enum(["Departing", "Arriving"])
        .optional()
        .describe("Whether the given time is a departure or arrival time (default: 'Departing')"),
      journeyPreference: z
        .enum(["LeastInterchange", "LeastTime", "LeastWalking"])
        .optional()
        .describe("Optimisation preference for the journey"),
      mode: z
        .string()
        .optional()
        .describe(
          "Comma-separated transport modes to use (e.g. 'tube,bus,walking'). Omit for all modes.",
        ),
      accessibilityPreference: z
        .string()
        .optional()
        .describe(
          "Accessibility requirements (e.g. 'noSolidStairs,noEscalators,noElevators,stepFreeToVehicle,stepFreeToPlatform')",
        ),
      maxWalkingMinutes: z
        .number()
        .int()
        .optional()
        .describe("Maximum acceptable walking time in minutes"),
      walkingSpeed: z
        .enum(["Slow", "Average", "Fast"])
        .optional()
        .describe("Walking speed preference"),
      cyclePreference: z
        .string()
        .optional()
        .describe("Cycle route preference (e.g. 'AllTheWay', 'LeaveAtStation', 'TakeOnTransport')"),
      alternativeCycle: z
        .boolean()
        .optional()
        .describe("If true, return alternative cycling routes"),
      alternativeWalking: z
        .boolean()
        .optional()
        .describe("If true, return alternative walking routes"),
      nationalSearch: z
        .boolean()
        .optional()
        .describe(
          "If true, include national rail options beyond London (may increase response time)",
        ),
    },
    {
      title: "Journey Planner",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    async ({
      from,
      to,
      via,
      date,
      time,
      timeIs,
      journeyPreference,
      mode,
      accessibilityPreference,
      maxWalkingMinutes,
      walkingSpeed,
      cyclePreference,
      alternativeCycle,
      alternativeWalking,
      nationalSearch,
    }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<JourneyPlannerResult>(
            `/Journey/JourneyResults/${encodeURIComponent(from)}/to/${encodeURIComponent(to)}`,
            {
              via,
              date,
              time,
              timeIs,
              journeyPreference,
              mode,
              accessibilityPreference,
              maxWalkingMinutes,
              walkingSpeed,
              cyclePreference,
              alternativeCycle,
              alternativeWalking,
              nationalSearch,
            },
          );
          const journeys = data.journeys ?? [];
          if (!journeys.length) return "No journeys found for the given parameters.";
          return `Journey options from "${from}" to "${to}":\n\n${journeys.map(formatJourney).join("\n\n")}`;
        }).pipe(
          Effect.catchTag("TflDisambiguationError", (e) =>
            Effect.succeed(formatDisambiguation(e.result)),
          ),
        ),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );
};
