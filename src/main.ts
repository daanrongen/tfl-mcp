#!/usr/bin/env bun
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ManagedRuntime } from "effect";
import { TflClientLive } from "./infra/TflClientLive.ts";
import { createMcpServer } from "./mcp/server.ts";

const runtime = ManagedRuntime.make(TflClientLive);

const server = createMcpServer(runtime);

const transport = new StdioServerTransport();

await server.connect(transport);

const shutdown = async () => {
  await runtime.runPromise(runtime.disposeEffect);
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
