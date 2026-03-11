import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { formatError, tflRequest } from "./client.js";

interface AirQualityData {
	updatePeriod?: string;
	updateFrequency?: string;
	forecastURL?: string;
	disclaimerText?: string;
	currentForecast?: Array<{
		forecastType?: string;
		forecastID?: string;
		forecastBand?: string;
		forecastSummary?: string;
		nO2Band?: string;
		o3Band?: string;
		pM10Band?: string;
		pM25Band?: string;
		sO2Band?: string;
		forecastText?: string;
	}>;
}

function formatAirQuality(data: AirQualityData): string {
	const lines: string[] = [];

	if (data.updatePeriod) lines.push(`Update Period: ${data.updatePeriod}`);
	if (data.updateFrequency)
		lines.push(`Update Frequency: ${data.updateFrequency}`);
	if (data.disclaimerText) lines.push(`\nDisclaimer: ${data.disclaimerText}`);

	if (data.currentForecast?.length) {
		lines.push("\n--- Current Air Quality Forecasts ---");
		for (const forecast of data.currentForecast) {
			lines.push(`\nForecast Type: ${forecast.forecastType ?? "Unknown"}`);
			lines.push(`Band: ${forecast.forecastBand ?? "Unknown"}`);
			if (forecast.forecastSummary)
				lines.push(`Summary: ${forecast.forecastSummary}`);
			if (forecast.nO2Band) lines.push(`NO2: ${forecast.nO2Band}`);
			if (forecast.o3Band) lines.push(`O3: ${forecast.o3Band}`);
			if (forecast.pM10Band) lines.push(`PM10: ${forecast.pM10Band}`);
			if (forecast.pM25Band) lines.push(`PM2.5: ${forecast.pM25Band}`);
			if (forecast.sO2Band) lines.push(`SO2: ${forecast.sO2Band}`);
			if (forecast.forecastText) {
				lines.push(`Details: ${forecast.forecastText.replace(/<[^>]*>/g, "")}`);
			}
			lines.push("---");
		}
	}

	return lines.join("\n");
}

export function registerAirQualityTools(server: McpServer): void {
	server.registerTool(
		"tfl_air_quality",
		{
			description:
				"Gets current and forecast London air quality data including pollution levels for NO2, O3, PM10, PM2.5 and SO2.",
			inputSchema: {},
		},
		async () => {
			try {
				const data = await tflRequest<AirQualityData>("/AirQuality");
				return {
					content: [
						{
							type: "text" as const,
							text: formatAirQuality(data),
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
