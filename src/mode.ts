import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { formatError, tflRequest } from "./client.js";

interface ArrivalPrediction {
	stationName?: string;
	lineName?: string;
	platformName?: string;
	destinationName?: string;
	timeToStation?: number;
	expectedArrival?: string;
	vehicleId?: string;
	modeName?: string;
}

export function registerModeTools(server: McpServer): void {
	server.registerTool(
		"mode_active_service_types",
		{
			description:
				"Returns the active service types for each transport mode (e.g. whether Night Tube is currently running). Currently focused on tube services.",
			inputSchema: {},
		},
		async () => {
			try {
				const data = await tflRequest<
					Array<{ mode?: string; serviceType?: string }>
				>("/Mode/ActiveServiceTypes");
				const rows = data.map(
					(s) => `${s.mode ?? "?"}: ${s.serviceType ?? "?"}`,
				);
				return {
					content: [
						{
							type: "text" as const,
							text: `Active service types:\n\n${rows.join("\n")}`,
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
		"mode_arrivals",
		{
			description:
				"Gets the next arrival predictions for all stops of a given transport mode. Useful for a broad view of incoming vehicles across a whole mode.",
			inputSchema: {
				mode: z
					.string()
					.describe(
						"Transport mode (e.g. 'tube', 'bus', 'dlr', 'overground', 'elizabeth-line', 'tram')",
					),
				count: z
					.number()
					.int()
					.positive()
					.optional()
					.describe(
						"Number of arrivals to return per stop (default: all). Use a small value like 5 to reduce response size.",
					),
			},
		},
		async ({ mode, count }) => {
			try {
				const data = await tflRequest<ArrivalPrediction[]>(
					`/Mode/${encodeURIComponent(mode)}/Arrivals`,
					{ count },
				);
				if (!data.length) {
					return {
						content: [
							{
								type: "text" as const,
								text: `No arrivals found for mode: ${mode}`,
							},
						],
					};
				}
				const sorted = [...data].sort(
					(a, b) => (a.timeToStation ?? 0) - (b.timeToStation ?? 0),
				);
				const formatted = sorted.slice(0, 50).map((a) => {
					const mins =
						a.timeToStation != null
							? `${Math.round(a.timeToStation / 60)} min`
							: (a.expectedArrival ?? "?");
					return `${a.stationName ?? "?"} — ${a.lineName ?? "?"} to ${a.destinationName ?? "?"} (${mins})`;
				});
				return {
					content: [
						{
							type: "text" as const,
							text: `Next arrivals for ${mode} (showing up to 50):\n\n${formatted.join("\n")}`,
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
