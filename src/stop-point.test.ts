import { describe, expect, it, mock } from "bun:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerStopPointTools } from "./stop-point.js";

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

describe("stoppoint_search tool", () => {
	it("registers tool and formats search results", async () => {
		const server = new McpServer({ name: "TestServer", version: "1.0.0" });
		// biome-ignore lint/suspicious/noExplicitAny: mock
		let toolHandler: any = null;

		// @ts-expect-error
		server.registerTool = mock((name, _schema, handler) => {
			if (name === "stoppoint_search") toolHandler = handler;
		});

		registerStopPointTools(server);
		expect(server.registerTool).toHaveBeenCalled();

		const originalFetch = globalThis.fetch;
		const mockData = {
			total: 1,
			matches: [
				{
					icsCode: "1000129",
					naptanId: "HUBKGX",
					commonName: "King's Cross St. Pancras",
					stopType: "TransportInterchange",
					modes: ["tube", "national-rail", "bus"],
					lines: [
						{ id: "victoria", name: "Victoria" },
						{ id: "metropolitan", name: "Metropolitan" },
					],
				},
			],
		};
		globalThis.fetch = mockFetch(200, mockData) as unknown as typeof fetch;

		try {
			const result = await toolHandler({ query: "Kings Cross" });
			expect(result.content[0].type).toBe("text");
			expect(result.content[0].text).toContain(
				'Stop points matching "Kings Cross" (1 of 1):',
			);
			expect(result.content[0].text).toContain("King's Cross St. Pancras");
			expect(result.content[0].text).toContain("ID: 1000129");
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	it("handles empty results array", async () => {
		const server = new McpServer({ name: "TestServer", version: "1.0.0" });
		// biome-ignore lint/suspicious/noExplicitAny: mock
		let toolHandler: any = null;

		// @ts-expect-error
		server.registerTool = mock((name, _schema, handler) => {
			if (name === "stoppoint_search") toolHandler = handler;
		});

		registerStopPointTools(server);

		const originalFetch = globalThis.fetch;
		globalThis.fetch = mockFetch(200, {
			total: 0,
			matches: [],
		}) as unknown as typeof fetch;

		try {
			const result = await toolHandler({ query: "xyznonexistent" });
			expect(result.content[0].text).toContain(
				'No stop points found matching "xyznonexistent".',
			);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});

describe("stoppoint_arrivals tool", () => {
	it("registers tool and formats arrivals", async () => {
		const server = new McpServer({ name: "TestServer", version: "1.0.0" });
		// biome-ignore lint/suspicious/noExplicitAny: mock
		let toolHandler: any = null;

		// @ts-expect-error
		server.registerTool = mock((name, _schema, handler) => {
			if (name === "stoppoint_arrivals") toolHandler = handler;
		});

		registerStopPointTools(server);

		const originalFetch = globalThis.fetch;
		const arrivals = [
			{
				vehicleId: "LJ60SME",
				lineName: "Victoria",
				stationName: "King's Cross St. Pancras",
				platformName: "Northbound - Platform 4",
				destinationName: "Walthamstow Central",
				timeToStation: 180,
			},
			{
				vehicleId: "LJ61ADE",
				lineName: "Victoria",
				stationName: "King's Cross St. Pancras",
				platformName: "Northbound - Platform 4",
				destinationName: "Walthamstow Central",
				timeToStation: 60,
			},
		];
		globalThis.fetch = mockFetch(200, arrivals) as unknown as typeof fetch;

		try {
			const result = await toolHandler({ id: "940GZZLUKSX" });
			expect(result.content[0].type).toBe("text");
			expect(result.content[0].text).toContain(
				"Arrivals at King's Cross St. Pancras:",
			);
			expect(result.content[0].text).toContain(
				"Victoria → Walthamstow Central via Northbound - Platform 4 — 1 min",
			);
			expect(result.content[0].text).toContain(
				"Victoria → Walthamstow Central via Northbound - Platform 4 — 3 min",
			);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	it("handles empty arrivals list", async () => {
		const server = new McpServer({ name: "TestServer", version: "1.0.0" });
		// biome-ignore lint/suspicious/noExplicitAny: mock
		let toolHandler: any = null;

		// @ts-expect-error
		server.registerTool = mock((name, _schema, handler) => {
			if (name === "stoppoint_arrivals") toolHandler = handler;
		});

		registerStopPointTools(server);

		const originalFetch = globalThis.fetch;
		globalThis.fetch = mockFetch(200, []) as unknown as typeof fetch;

		try {
			const result = await toolHandler({ id: "940GZZLUKSX" });
			expect(result.content[0].text).toContain(
				"No arrivals currently predicted at stop 940GZZLUKSX.",
			);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});

describe("stoppoint_by_geo tool", () => {
	it("registers tool and formats geo search results", async () => {
		const server = new McpServer({ name: "TestServer", version: "1.0.0" });
		// biome-ignore lint/suspicious/noExplicitAny: mock
		let toolHandler: any = null;

		// @ts-expect-error
		server.registerTool = mock((name, _schema, handler) => {
			if (name === "stoppoint_by_geo") toolHandler = handler;
		});

		registerStopPointTools(server);

		const originalFetch = globalThis.fetch;
		const mockData = {
			stopPoints: [
				{
					naptanId: "940GZZLUKSX",
					icsCode: "1000129",
					commonName: "King's Cross St. Pancras Underground Station",
					stopType: "NaptanMetroStation",
					modes: ["tube"],
				},
			],
		};
		globalThis.fetch = mockFetch(200, mockData) as unknown as typeof fetch;

		try {
			const result = await toolHandler({
				lat: 51.5308,
				lon: -0.1238,
				stopTypes: "NaptanMetroStation",
			});
			expect(result.content[0].type).toBe("text");
			expect(result.content[0].text).toContain(
				"Stop points near (51.5308, -0.1238) within 200m (1):",
			);
			expect(result.content[0].text).toContain(
				"King's Cross St. Pancras Underground Station",
			);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});
