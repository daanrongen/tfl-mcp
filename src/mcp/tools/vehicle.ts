import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Effect, type ManagedRuntime } from "effect";
import { z } from "zod";
import type { TflDisambiguationError, TflError } from "../../domain/errors.ts";
import { TflClient } from "../../domain/TflClient.ts";
import { formatError, formatSuccess } from "../utils.ts";

type VehicleCompliance = {
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
  message?: string;
};

type VehicleUlezCompliance = {
  vrm?: string;
  type?: string;
  make?: string;
  model?: string;
  colour?: string;
  compliance?: string;
};

type VehicleArrival = {
  vehicleId?: string;
  lineName?: string;
  stationName?: string;
  platformName?: string;
  destinationName?: string;
  timeToStation?: number;
  expectedArrival?: string;
};

const formatCompliance = (v: VehicleCompliance): string => {
  const lines = [
    `VRM: ${v.vrm ?? "?"}`,
    `Make/Model: ${v.make ?? "?"} ${v.model ?? ""}`.trim(),
    `Type: ${v.type ?? "?"}`,
    `Colour: ${v.colour ?? "?"}`,
    `ULEZ Compliant: ${v.isUlezCompliant}`,
    `CAZ Compliant: ${v.isCazCompliant}`,
    v.compliant ? `Status: ${v.compliant}` : "",
  ];
  if (v.charges?.length) {
    lines.push("Charges:");
    for (const c of v.charges) {
      lines.push(
        `  ${c.chargeIdentifier ?? "?"}: ${c.chargeCurrency ?? "£"}${c.chargeValue ?? "?"} (${c.chargeStartDate ?? "?"} – ${c.chargeEndDate ?? "?"})`,
      );
    }
  }
  if (v.message) lines.push(`Note: ${v.message}`);
  return lines.filter(Boolean).join("\n");
};

const formatUlezCompliance = (v: VehicleUlezCompliance): string =>
  [
    `VRM: ${v.vrm ?? "?"}`,
    `Make/Model: ${v.make ?? "?"} ${v.model ?? ""}`.trim(),
    `Type: ${v.type ?? "?"}`,
    `Colour: ${v.colour ?? "?"}`,
    `ULEZ Compliance: ${v.compliance ?? "?"}`,
  ].join("\n");

export const registerVehicleTools = (
  server: McpServer,
  runtime: ManagedRuntime.ManagedRuntime<TflClient, TflError | TflDisambiguationError>,
) => {
  server.tool(
    "vehicle_emission_surcharge",
    "Checks emission zone compliance (ULEZ, CAZ, LEZ) for a vehicle by registration. Returns full compliance status across all schemes, vehicle details, and any applicable charges.",
    {
      vrm: z
        .string()
        .describe("Vehicle Registration Mark (number plate) to check (e.g. 'AB12CDE')"),
    },
    {
      title: "Vehicle Emission Surcharge",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ vrm }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<VehicleCompliance[]>("/Vehicle/EmissionSurcharge", {
            vrm,
          });
          if (!data.length) return `No emission surcharge data found for VRM: ${vrm}`;
          return data.map((v) => formatCompliance(v)).join("\n\n");
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "vehicle_ulez_compliance",
    "Checks ULEZ (Ultra Low Emission Zone) compliance for a vehicle by registration. Returns the vehicle details and a simple compliance status string indicating whether the vehicle must pay the ULEZ charge.",
    {
      vrm: z
        .string()
        .describe("Vehicle Registration Mark (number plate) to check (e.g. 'AB12CDE')"),
    },
    {
      title: "Vehicle ULEZ Compliance",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ vrm }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<VehicleUlezCompliance[]>("/Vehicle/UlezCompliance", {
            vrm,
          });
          if (!data.length) return `No ULEZ compliance data found for VRM: ${vrm}`;
          return data.map((v) => formatUlezCompliance(v)).join("\n\n");
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "vehicle_arrivals",
    "Gets the arrival predictions for a specific vehicle (bus or tram) by its vehicle ID.",
    {
      vehicleIds: z
        .string()
        .describe(
          "Comma-separated vehicle IDs to track (e.g. 'LTZ1001,LTZ1002'). Vehicle IDs appear in arrival prediction responses.",
        ),
    },
    {
      title: "Vehicle Arrivals",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    async ({ vehicleIds }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* TflClient;
          const data = yield* client.request<VehicleArrival[]>(
            `/Vehicle/${encodeURIComponent(vehicleIds)}/Arrivals`,
          );
          if (!data.length) return `No arrival predictions for vehicle(s): ${vehicleIds}`;
          const sorted = [...data].sort((a, b) => (a.timeToStation ?? 0) - (b.timeToStation ?? 0));
          const formatted = sorted.map((a) => {
            const mins =
              a.timeToStation != null
                ? `${Math.round(a.timeToStation / 60)} min`
                : (a.expectedArrival ?? "?");
            return `${a.stationName ?? "?"} — ${a.lineName ?? "?"} → ${a.destinationName ?? "?"} via ${a.platformName ?? "?"} (${mins})`;
          });
          return `Arrivals for vehicle(s) ${vehicleIds}:\n\n${formatted.join("\n")}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );
};
