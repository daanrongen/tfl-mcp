import { describe, expect, it, mock } from "bun:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerVehicleTools } from "./vehicle.js";

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

describe("vehicle_ulez_compliance tool", () => {
	it("registers tool and formats compliance data", async () => {
		const server = new McpServer({ name: "TestServer", version: "1.0.0" });
		// biome-ignore lint/suspicious/noExplicitAny: mock
		let toolHandler: any = null;

		// @ts-expect-error
		server.registerTool = mock((name, _schema, handler) => {
			if (name === "vehicle_ulez_compliance") toolHandler = handler;
		});

		registerVehicleTools(server);
		expect(server.registerTool).toHaveBeenCalled();

		const originalFetch = globalThis.fetch;
		const mockData = {
			vrm: "LJ60SME",
			make: "Ford",
			model: "Focus",
			type: "Car",
			colour: "Silver",
			isUlezCompliant: true,
			compliant: "Yes",
		};
		globalThis.fetch = mockFetch(200, mockData) as unknown as typeof fetch;

		try {
			const result = await toolHandler({ vrm: "LJ60SME" });
			expect(result.content[0].type).toBe("text");
			expect(result.content[0].text).toContain("ULEZ Compliance for LJ60SME:");
			expect(result.content[0].text).toContain("VRM: LJ60SME");
			expect(result.content[0].text).toContain("Make/Model: Ford Focus");
			expect(result.content[0].text).toContain("Type: Car");
			expect(result.content[0].text).toContain("Colour: Silver");
			expect(result.content[0].text).toContain("ULEZ Compliant: true");
			expect(result.content[0].text).toContain("Status: Yes");
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});
