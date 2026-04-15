/**
 * Shared ArrivalPrediction type and formatter used by line, stop-point, and mode tools.
 *
 * This is the superset of all fields returned across the three TfL endpoints:
 *   - /Line/{ids}/Arrivals/{stopPointId}
 *   - /StopPoint/{id}/Arrivals
 *   - /Mode/{mode}/Arrivals
 */
export type ArrivalPrediction = {
  stationName?: string;
  lineName?: string;
  platformName?: string;
  destinationName?: string;
  timeToStation?: number;
  expectedArrival?: string;
};

/**
 * Formats a single arrival prediction as a human-readable line.
 *
 * The line prefix (lineName) and station prefix (stationName) are included
 * only when present — each endpoint populates a different subset of fields.
 */
export const formatArrival = (a: ArrivalPrediction): string => {
  const mins = a.timeToStation != null ? Math.round(a.timeToStation / 60) : null;
  const time = mins != null ? `${mins} min` : (a.expectedArrival ?? "?");
  const prefix = [a.stationName, a.lineName].filter(Boolean).join(" — ");
  return `  ${prefix ? `${prefix} → ` : "→ "}${a.destinationName ?? "?"}${a.platformName ? ` via ${a.platformName}` : ""} — ${time}`;
};
