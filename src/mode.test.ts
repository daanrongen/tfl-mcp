import { beforeEach, describe, expect, it, mock } from "bun:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerModeTools } from "./mode.js";

describe("mode.ts - registerModeTools", () => {
	let server: McpServer;

	beforeEach(() => {
		server = new McpServer({ name: "TestServer", version: "1.0.0" });
		// @ts-expect-error - mock injection
		server.registerTool = mock();
	});

	it("should register tools successfully", () => {
		registerModeTools(server);
		expect(server.registerTool).toHaveBeenCalled();
	});
});
