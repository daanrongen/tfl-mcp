import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { formatError, tflRequest } from "./client.js";

interface VehicleCompliance {
	vrm?: string;
	type?: string;
	colour?: string;
	make?: string;
	model?: string;
	compliant?: string;
	isCazCompliant?: boolean;
	isUlezCompliant?: boolean;
	charges?: Array<{
		chargeIdentifier?: string;
		chargeValue?: number;
		chargeCurrency?: string;
		chargeStartDate?: string;
		chargeEndDate?: string;
	}>;
	operationID?: string;
	message?: string;
}

interface VehicleArrival {
	vehicleId?: string;
	lineName?: string;
	stationName?: string;
	platformName?: string;
	destinationName?: string;
	timeToStation?: number;
	expectedArrival?: string;
}

function formatCompliance(
	v: VehicleCompliance,
	type: "ULEZ" | "Emission",
): string {
	const lines = [
		`VRM: ${v.vrm ?? "?"}`,
		`Make/Model: ${v.make ?? "?"} ${v.model ?? ""}`.trim(),
		`Type: ${v.type ?? "?"}`,
		`Colour: ${v.colour ?? "?"}`,
		`${type} Compliant: ${type === "ULEZ" ? v.isUlezCompliant : v.isCazCompliant}`,
		v.compliant ? `Status: ${v.compliant}` : "",
	];
	if (v.charges?.length) {
		lines.push(`Charges:`);
		for (const c of v.charges) {
			lines.push(
				`  ${c.chargeIdentifier ?? "?"}: ${c.chargeCurrency ?? "£"}${c.chargeValue ?? "?"} (${c.chargeStartDate ?? "?"} – ${c.chargeEndDate ?? "?"})`,
			);
		}
	}
	if (v.message) lines.push(`Note: ${v.message}`);
	return lines.filter(Boolean).join("\n");
}

export function registerVehicleTools(server: McpServer): void {
	server.registerTool(
		"tfl_vehicle_ulez_compliance",
		{
			description:
				"Checks whether a vehicle (by registration plate) is compliant with the London ULEZ (Ultra Low Emission Zone). Non-compliant vehicles face a daily charge when driving in the ULEZ.",
			inputSchema: {
				vrm: z
					.string()
					.describe(
						"Vehicle Registration Mark (number plate), e.g. 'LJ60SME' (no spaces required)",
					),
			},
		},
		async ({ vrm }) => {
			try {
				const data = await tflRequest<VehicleCompliance>(
					"/Vehicle/UlezCompliance",
					{
						vrm: vrm.replace(/\s+/g, "").toUpperCase(),
					},
				);
				return {
					content: [
						{
							type: "text" as const,
							text: `ULEZ Compliance for ${vrm}:\n\n${formatCompliance(data, "ULEZ")}`,
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
		"tfl_vehicle_emission_surcharge",
		{
			description:
				"Checks whether a vehicle is subject to the London Emissions Surcharge (T-Charge / ULEZ precursor). Returns the surcharge status and any applicable charges.",
			inputSchema: {
				vrm: z
					.string()
					.describe("Vehicle Registration Mark (number plate), e.g. 'LJ60SME'"),
			},
		},
		async ({ vrm }) => {
			try {
				const data = await tflRequest<VehicleCompliance>(
					"/Vehicle/EmissionSurcharge",
					{
						vrm: vrm.replace(/\s+/g, "").toUpperCase(),
					},
				);
				return {
					content: [
						{
							type: "text" as const,
							text: `Emission Surcharge for ${vrm}:\n\n${formatCompliance(data, "Emission")}`,
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
		"tfl_vehicle_arrivals",
		{
			description:
				"Gets live arrival predictions for one or more specific TfL vehicles by their vehicle IDs (e.g. bus fleet numbers, DLR vehicle IDs). Useful for tracking a specific vehicle.",
			inputSchema: {
				ids: z
					.string()
					.describe(
						"Comma-separated vehicle IDs (e.g. 'BV23MXF,BV23MXG'). These are TfL fleet/vehicle identifiers, not registration plates.",
					),
			},
		},
		async ({ ids }) => {
			try {
				const data = await tflRequest<VehicleArrival[]>(
					`/Vehicle/${encodeURIComponent(ids)}/Arrivals`,
				);
				if (!data.length) {
					return {
						content: [
							{
								type: "text" as const,
								text: `No arrival predictions found for vehicle(s): ${ids}`,
							},
						],
					};
				}
				const sorted = [...data].sort(
					(a, b) => (a.timeToStation ?? 0) - (b.timeToStation ?? 0),
				);
				const formatted = sorted.map((a) => {
					const mins =
						a.timeToStation != null
							? `${Math.round(a.timeToStation / 60)} min`
							: (a.expectedArrival ?? "?");
					return `Vehicle ${a.vehicleId ?? "?"} — ${a.lineName ?? "?"} → ${a.destinationName ?? "?"} at ${a.stationName ?? "?"}/${a.platformName ?? "?"} (${mins})`;
				});
				return {
					content: [
						{
							type: "text" as const,
							text: `Arrivals for vehicle(s) ${ids}:\n\n${formatted.join("\n")}`,
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
