import { describe, expect, it, mock } from "bun:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAirQualityTools } from "./air-quality.js";

function mockFetch(status: number, body: unknown) {
	return mock(() =>
		Promise.resolve(
			new Response(JSON.stringify(body), {
				status,
				headers: { "Content-Type": "application/json" },
			}),
		),
	);
}

describe("air_quality tool", () => {
	it("registers tool and formats air quality data", async () => {
		const server = new McpServer({ name: "TestServer", version: "1.0.0" });
		// biome-ignore lint/suspicious/noExplicitAny: mock
		let toolHandler: any = null;

		// @ts-expect-error
		server.registerTool = mock((name, _schema, handler) => {
			if (name === "air_quality") toolHandler = handler;
		});

		registerAirQualityTools(server);
		expect(server.registerTool).toHaveBeenCalled();

		const originalFetch = globalThis.fetch;
		const mockData = {
			updatePeriod: "Hourly",
			updateFrequency: "1",
			currentForecast: [
				{
					forecastType: "Current",
					forecastBand: "Low",
					nO2Band: "Low",
					o3Band: "Low",
				},
			],
		};
		globalThis.fetch = mockFetch(200, mockData) as unknown as typeof fetch;

		try {
			const result = await toolHandler({});
			expect(result.content[0].type).toBe("text");
			expect(result.content[0].text).toContain("Update Period: Hourly");
			expect(result.content[0].text).toContain("Band: Low");
			expect(result.content[0].text).toContain("NO2: Low");
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});
