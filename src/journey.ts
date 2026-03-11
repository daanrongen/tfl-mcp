import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { formatError, tflRequest } from "./client.js";

interface JourneyLeg {
	duration?: number;
	instruction?: { summary?: string; detailed?: string };
	departureTime?: string;
	arrivalTime?: string;
	mode?: { name?: string };
	departurePoint?: { commonName?: string };
	arrivalPoint?: { commonName?: string };
}

interface Journey {
	duration?: number;
	startDateTime?: string;
	arrivalDateTime?: string;
	legs?: JourneyLeg[];
}

interface JourneyPlannerResult {
	journeys?: Journey[];
}

function formatJourney(j: Journey, index: number): string {
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
}

export function registerJourneyTools(server: McpServer): void {
	server.registerTool(
		"tfl_journey_plan",
		{
			description:
				"Plan a journey across London's transport network. Supports tube, bus, overground, Elizabeth line, DLR, cycling and walking. Returns journey options with duration, modes, and step-by-step legs.",
			inputSchema: {
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
				via: z
					.string()
					.optional()
					.describe("Optional intermediate stop/location to travel via"),
				date: z
					.string()
					.optional()
					.describe(
						"Date of travel in YYYYMMDD format (e.g. '20240315'). Defaults to today.",
					),
				time: z
					.string()
					.optional()
					.describe(
						"Time of travel in HHMM format (e.g. '0830'). Defaults to now.",
					),
				timeIs: z
					.enum(["Departing", "Arriving"])
					.optional()
					.describe(
						"Whether the given time is a departure or arrival time (default: 'Departing')",
					),
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
					.describe(
						"Cycle route preference (e.g. 'AllTheWay', 'LeaveAtStation', 'TakeOnTransport')",
					),
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
			try {
				const data = await tflRequest<JourneyPlannerResult>(
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
				if (!journeys.length) {
					return {
						content: [
							{
								type: "text" as const,
								text: "No journeys found for the given parameters.",
							},
						],
					};
				}

				const formatted = journeys.map(formatJourney).join("\n\n");
				return {
					content: [
						{
							type: "text" as const,
							text: `Journey options from "${from}" to "${to}":\n\n${formatted}`,
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{ type: "text" as const, text: `Error: ${formatError(error)}` },
					],
					isError: true,
				};
			}
		},
	);

	server.registerTool(
		"tfl_journey_modes",
		{
			description:
				"Gets all available transport modes supported by the TfL journey planner (e.g. tube, bus, dlr, overground, elizabeth-line, cycling, walking).",
			inputSchema: {},
		},
		async () => {
			try {
				const data = await tflRequest<
					Array<{ mode?: string; isTflService?: boolean }>
				>("/Journey/Meta/Modes");
				const modes = data.map(
					(m) => `${m.mode ?? "??"} (TfL: ${m.isTflService ?? false})`,
				);
				return {
					content: [
						{
							type: "text" as const,
							text: `Available journey modes:\n\n${modes.join("\n")}`,
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{ type: "text" as const, text: `Error: ${formatError(error)}` },
					],
					isError: true,
				};
			}
		},
	);
}
