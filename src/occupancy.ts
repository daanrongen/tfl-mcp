import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { formatError, tflRequest } from "./client.js";

interface CarPark {
	id?: string;
	name?: string;
	bays?: Array<{
		bayType?: string;
		bayCount?: number;
		free?: number;
		occupied?: number;
	}>;
	message?: string;
}

interface ChargeConnector {
	id?: string;
	sourceSystemPlaceId?: string;
	status?: string;
	connectorDetails?: Array<{
		status?: string;
		description?: string;
	}>;
}

interface BikePointOccupancy {
	id?: string;
	name?: string;
	bikesCount?: number;
	emptyDocks?: number;
	totalDocks?: number;
}

function formatCarPark(cp: CarPark): string {
	const bayInfo =
		cp.bays
			?.map(
				(b) =>
					`  ${b.bayType ?? "?"}: ${b.free ?? "?"} free / ${b.bayCount ?? "?"} total`,
			)
			.join("\n") ?? "  No bay data";
	return [
		`Car Park: ${cp.name ?? cp.id ?? "?"}`,
		bayInfo,
		cp.message ? `  Note: ${cp.message}` : "",
	]
		.filter(Boolean)
		.join("\n");
}

export function registerOccupancyTools(server: McpServer): void {
	server.registerTool(
		"occupancy_car_parks_all",
		{
			description:
				"Gets live occupancy (free spaces) for all TfL car parks that provide occupancy data.",
			inputSchema: {},
		},
		async () => {
			try {
				const data = await tflRequest<CarPark[]>("/Occupancy/CarPark");
				if (!data.length) {
					return {
						content: [
							{
								type: "text" as const,
								text: "No car park occupancy data available.",
							},
						],
					};
				}
				return {
					content: [
						{
							type: "text" as const,
							text: `Car park occupancy (${data.length} parks):\n\n${data.map(formatCarPark).join("\n\n")}`,
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
		"occupancy_car_park_by_id",
		{
			description: "Gets live occupancy for a specific TfL car park by its ID.",
			inputSchema: {
				id: z
					.string()
					.describe(
						"Car park ID (e.g. 'CarParks_800491'). Use occupancy_car_parks_all to find IDs.",
					),
			},
		},
		async ({ id }) => {
			try {
				const data = await tflRequest<CarPark>(
					`/Occupancy/CarPark/${encodeURIComponent(id)}`,
				);
				return {
					content: [{ type: "text" as const, text: formatCarPark(data) }],
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
		"occupancy_bike_points",
		{
			description:
				"Gets live occupancy (bike and dock availability) for one or more Santander Cycles docking stations by ID.",
			inputSchema: {
				ids: z
					.string()
					.describe(
						"Comma-separated bike point IDs (e.g. 'BikePoints_1,BikePoints_2'). Use bike_point_search to find IDs.",
					),
			},
		},
		async ({ ids }) => {
			try {
				const data = await tflRequest<BikePointOccupancy[]>(
					`/Occupancy/BikePoints/${encodeURIComponent(ids)}`,
				);
				const formatted = data.map(
					(bp) =>
						`${bp.name ?? bp.id ?? "?"}: ${bp.bikesCount ?? "?"} bikes, ${bp.emptyDocks ?? "?"} empty docks, ${bp.totalDocks ?? "?"} total`,
				);
				return {
					content: [
						{
							type: "text" as const,
							text: `Bike point occupancy:\n\n${formatted.join("\n")}`,
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
		"occupancy_charge_connectors_all",
		{
			description:
				"Gets live availability status for all EV charge connectors managed by TfL.",
			inputSchema: {},
		},
		async () => {
			try {
				const data = await tflRequest<ChargeConnector[]>(
					"/Occupancy/ChargeConnector",
				);
				if (!data.length) {
					return {
						content: [
							{
								type: "text" as const,
								text: "No charge connector data available.",
							},
						],
					};
				}
				const formatted = data.map(
					(c) => `${c.sourceSystemPlaceId ?? c.id ?? "?"}: ${c.status ?? "?"}`,
				);
				return {
					content: [
						{
							type: "text" as const,
							text: `Charge connector statuses (${data.length} connectors):\n\n${formatted.join("\n")}`,
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
		"occupancy_charge_connectors_by_ids",
		{
			description:
				"Gets live availability status for specific EV charge connectors by their source system IDs.",
			inputSchema: {
				ids: z
					.string()
					.describe(
						"Comma-separated charge connector source system IDs. Use occupancy_charge_connectors_all to find IDs.",
					),
			},
		},
		async ({ ids }) => {
			try {
				const data = await tflRequest<ChargeConnector[]>(
					`/Occupancy/ChargeConnector/${encodeURIComponent(ids)}`,
				);
				const formatted = data.map(
					(c) => `${c.sourceSystemPlaceId ?? c.id ?? "?"}: ${c.status ?? "?"}`,
				);
				return {
					content: [
						{
							type: "text" as const,
							text: `Charge connector statuses:\n\n${formatted.join("\n")}`,
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
