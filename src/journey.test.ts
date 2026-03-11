import { describe, expect, it, mock } from "bun:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerJourneyTools } from "./journey.js";

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

describe("tfl_journey_plan tool", () => {
	it("registers tool and formats journey options", async () => {
		const server = new McpServer({ name: "TestServer", version: "1.0.0" });
		// biome-ignore lint/suspicious/noExplicitAny: mock
		let toolHandler: any = null;

		// @ts-expect-error
		server.registerTool = mock((name, _schema, handler) => {
			if (name === "tfl_journey_plan") toolHandler = handler;
		});

		registerJourneyTools(server);
		expect(server.registerTool).toHaveBeenCalled();

		const originalFetch = globalThis.fetch;
		const mockData = {
			journeys: [
				{
					duration: 42,
					startDateTime: "2024-03-15T08:00:00",
					arrivalDateTime: "2024-03-15T08:42:00",
					legs: [
						{
							duration: 15,
							instruction: {
								summary: "Take the Victoria line to Oxford Circus",
							},
							mode: { name: "tube" },
							departurePoint: { commonName: "King's Cross" },
							arrivalPoint: { commonName: "Oxford Circus" },
						},
					],
				},
			],
		};
		globalThis.fetch = mockFetch(200, mockData) as unknown as typeof fetch;

		try {
			const result = await toolHandler({
				from: "Kings Cross",
				to: "Oxford Circus",
			});
			expect(result.content[0].type).toBe("text");
			expect(result.content[0].text).toContain(
				'Journey options from "Kings Cross" to "Oxford Circus":',
			);
			expect(result.content[0].text).toContain("Journey 1:");
			expect(result.content[0].text).toContain("Total Duration: 42 minutes");
			expect(result.content[0].text).toContain(
				"TUBE — King's Cross → Oxford Circus (15 min)",
			);
			expect(result.content[0].text).toContain(
				"Take the Victoria line to Oxford Circus",
			);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	it("handles no journeys found gracefully", async () => {
		const server = new McpServer({ name: "TestServer", version: "1.0.0" });
		// biome-ignore lint/suspicious/noExplicitAny: mock
		let toolHandler: any = null;

		// @ts-expect-error
		server.registerTool = mock((name, _schema, handler) => {
			if (name === "tfl_journey_plan") toolHandler = handler;
		});

		registerJourneyTools(server);

		const originalFetch = globalThis.fetch;
		globalThis.fetch = mockFetch(200, {
			journeys: [],
		}) as unknown as typeof fetch;

		try {
			const result = await toolHandler({ from: "Mars", to: "Venus" });
			expect(result.content[0].text).toContain(
				"No journeys found for the given parameters.",
			);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});
