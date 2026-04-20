import { Effect, Layer } from "effect";
import { TflError } from "../domain/errors.ts";
import { TflClient } from "../domain/TflClient.ts";

/**
 * In-memory test adapter for TflClient.
 * Handlers map path prefixes to fixture data. When no handler matches,
 * the request fails with TflError so tests can verify error paths.
 *
 * IMPORTANT: entries are matched in insertion order — place more-specific
 * prefixes before shorter, general ones so they are evaluated first.
 */
export type TflTestHandlers = Map<string, unknown>;

export const makeTflClientTest = (handlers: TflTestHandlers = new Map()) =>
  Layer.succeed(TflClient, {
    request: <T>(path: string) => {
      for (const [prefix, data] of handlers) {
        if (path.startsWith(prefix)) {
          return Effect.succeed(data as T);
        }
      }
      return Effect.fail(new TflError({ message: `No test handler for path: ${path}` }));
    },
  });

/** Default test layer with common fixture responses.
 *
 * Entries are ordered most-specific first so that prefix matching works
 * correctly when one path is a prefix of another (e.g. /Line/victoria/Status
 * must appear before /Line/victoria).
 */
export const TflClientTest = makeTflClientTest(
  new Map<string, unknown>([
    // --- meta ---
    ["/Line/Meta/Modes", [{ modeName: "tube" }, { modeName: "bus" }]],
    ["/AirQuality", { updatePeriod: "Hourly", currentForecast: [] }],
    ["/Mode/ActiveServiceTypes", [{ mode: "tube", serviceType: "Regular" }]],
    ["/StopPoint/Meta/Modes", [{ modeName: "tube", isTflService: true }]],
    ["/StopPoint/Meta/StopTypes", ["NaptanMetroStation"]],

    // --- line search ---
    [
      "/Line/Search/victoria",
      {
        input: "victoria",
        searchMatches: [{ lineId: "victoria", lineName: "Victoria", modeName: "tube" }],
      },
    ],

    // --- line status by date range (most specific first) ---
    [
      "/Line/victoria/Status/2024-01-01T00:00:00/to/2024-01-07T23:59:59",
      [
        {
          id: "victoria",
          name: "Victoria",
          modeName: "tube",
          lineStatuses: [{ statusSeverityDescription: "Good Service" }],
        },
      ],
    ],

    // --- line status by ids ---
    [
      "/Line/victoria/Status",
      [
        {
          id: "victoria",
          name: "Victoria",
          modeName: "tube",
          lineStatuses: [{ statusSeverityDescription: "Good Service" }],
        },
      ],
    ],

    // --- line status by severity ---
    [
      "/Line/Status/10",
      [
        {
          id: "victoria",
          name: "Victoria",
          modeName: "tube",
          lineStatuses: [{ statusSeverityDescription: "Good Service" }],
        },
      ],
    ],

    // --- line disruptions ---
    ["/Line/victoria/Disruption", []],

    // --- line route sequence (before /Line/victoria/Route) ---
    [
      "/Line/victoria/Route/Sequence/outbound",
      {
        lineId: "victoria",
        lineName: "Victoria",
        direction: "outbound",
        stopPointSequences: [
          {
            branchId: 0,
            direction: "outbound",
            stopPoint: [
              { id: "940GZZLUBXN", name: "Brixton" },
              { id: "940GZZLUVIC", name: "Victoria" },
            ],
          },
        ],
      },
    ],

    // --- line routes by ids ---
    [
      "/Line/victoria/Route",
      [
        {
          id: "victoria",
          name: "Victoria",
          modeName: "tube",
          routeSections: [
            {
              direction: "outbound",
              originationName: "Brixton",
              destinationName: "Walthamstow Central",
              serviceType: "Regular",
            },
          ],
        },
      ],
    ],

    // --- line stop points ---
    [
      "/Line/victoria/StopPoints",
      [
        { id: "940GZZLUVIC", commonName: "Victoria Underground Station" },
        { id: "940GZZLUBXN", commonName: "Brixton Underground Station" },
      ],
    ],

    // --- line timetable with destination (more specific first) ---
    ["/Line/victoria/Timetable/940GZZLUVIC/to/940GZZLUBXN", { lineId: "victoria", stations: [] }],

    // --- line timetable ---
    ["/Line/victoria/Timetable/940GZZLUVIC", { lineId: "victoria", stations: [] }],

    // --- line arrivals ---
    [
      "/Line/victoria/Arrivals/940GZZLUVIC",
      [
        {
          stationName: "Victoria",
          lineName: "Victoria",
          destinationName: "Walthamstow Central",
          timeToStation: 120,
        },
      ],
    ],

    // --- line mode routes (before /Line/Mode/tube) ---
    [
      "/Line/Mode/tube/Status",
      [
        {
          id: "victoria",
          name: "Victoria",
          modeName: "tube",
          lineStatuses: [{ statusSeverityDescription: "Good Service" }],
        },
      ],
    ],
    ["/Line/Mode/tube/Disruption", []],
    ["/Line/Mode/tube/Route", [{ id: "victoria", name: "Victoria", modeName: "tube" }]],

    // --- line mode (general, after mode-specific paths) ---
    ["/Line/Mode/tube", [{ id: "victoria", name: "Victoria", modeName: "tube", lineStatuses: [] }]],

    // --- line by ids (general — after all specific /Line/victoria/* paths) ---
    ["/Line/victoria", [{ id: "victoria", name: "Victoria", modeName: "tube", lineStatuses: [] }]],

    // --- all routes ---
    ["/Line/Route", [{ id: "victoria", name: "Victoria", modeName: "tube" }]],

    // --- stop point: most-specific paths first ---
    [
      "/StopPoint/Search",
      {
        matches: [
          {
            id: "940GZZLUVIC",
            icsCode: "1000303",
            commonName: "Victoria Underground Station",
            stopType: "NaptanMetroStation",
            modes: ["tube"],
          },
        ],
        total: 1,
      },
    ],

    [
      "/StopPoint/940GZZLUVIC/ArrivalDepartures",
      [
        {
          stationName: "Victoria",
          lineName: "London Overground",
          destinationName: "Watford Junction",
          scheduledTimeOfArrival: "2024-01-01T09:00:00",
          scheduledTimeOfDeparture: "2024-01-01T09:01:00",
        },
      ],
    ],
    [
      "/StopPoint/940GZZLUVIC/Arrivals",
      [
        {
          stationName: "Victoria",
          lineName: "Victoria",
          destinationName: "Walthamstow Central",
          timeToStation: 180,
        },
      ],
    ],
    ["/StopPoint/940GZZLUVIC/Disruption", []],
    [
      "/StopPoint/940GZZLUVIC/Crowding/victoria",
      [
        {
          naptanId: "940GZZLUVIC",
          commonName: "Victoria",
          passengerFlows: [{ timeSlice: "0800", value: 1200 }],
        },
      ],
    ],
    ["/StopPoint/940GZZLUVIC/CarParks", []],
    ["/StopPoint/940GZZLUVIC/TaxiRanks", []],
    [
      "/StopPoint/940GZZLUVIC/placeTypes",
      [
        {
          id: "place-1",
          commonName: "Victoria Coach Station",
          placeType: "CoachStation",
          lat: 51.4953,
          lon: -0.1474,
        },
      ],
    ],

    // --- stop point mode disruptions ---
    ["/StopPoint/Mode/tube/Disruption", []],

    // --- stop point lookup by mode (after /StopPoint/Mode/tube/Disruption) ---
    [
      "/StopPoint/Mode/tube",
      [
        {
          id: "940GZZLUVIC",
          commonName: "Victoria Underground Station",
          stopType: "NaptanMetroStation",
          modes: ["tube"],
        },
      ],
    ],

    // --- stop point lookup by type ---
    [
      "/StopPoint/Type/NaptanMetroStation",
      [
        {
          id: "940GZZLUVIC",
          commonName: "Victoria Underground Station",
          stopType: "NaptanMetroStation",
          modes: ["tube"],
        },
      ],
    ],

    // --- stop point by id (general, after all specific /StopPoint/940GZZLUVIC/* paths) ---
    [
      "/StopPoint/940GZZLUVIC",
      {
        id: "940GZZLUVIC",
        naptanId: "940GZZLUVIC",
        commonName: "Victoria Underground Station",
        stopType: "NaptanMetroStation",
        modes: ["tube"],
      },
    ],

    // --- stop point by geo (plain /StopPoint must come last — it is a prefix of all /StopPoint/* paths) ---
    [
      "/StopPoint",
      {
        stopPoints: [
          {
            id: "940GZZLUVIC",
            commonName: "Victoria Underground Station",
            stopType: "NaptanMetroStation",
            modes: ["tube"],
          },
        ],
      },
    ],

    // --- road ---
    ["/Road/all/Disruption", []],
    ["/Road/A1/Disruption", []],
    [
      "/Road/A1",
      [
        {
          id: "A1",
          displayName: "A1",
          statusSeverity: "Good",
          statusSeverityDescription: "No Exceptional Delays",
        },
      ],
    ],
    [
      "/Road",
      [
        {
          id: "A1",
          displayName: "A1",
          statusSeverity: "Good",
          statusSeverityDescription: "No Exceptional Delays",
        },
      ],
    ],

    // --- occupancy ---
    [
      "/Occupancy/CarPark/CarParks_800491",
      {
        id: "CarParks_800491",
        name: "Finchley Central",
        bays: [{ bayType: "Standard", bayCount: 50, free: 12 }],
      },
    ],
    ["/Occupancy/CarPark", []],
    [
      "/Occupancy/ChargeConnector/CC001",
      [{ id: "cc-1", sourceSystemPlaceId: "CC001", status: "Available" }],
    ],
    [
      "/Occupancy/ChargeConnector",
      [{ id: "cc-1", sourceSystemPlaceId: "CC001", status: "Available" }],
    ],
    [
      "/Occupancy/BikePoints/BikePoints_1",
      [
        {
          id: "BikePoints_1",
          name: "River Street, Clerkenwell",
          bikesCount: 5,
          emptyDocks: 14,
          totalDocks: 19,
        },
      ],
    ],

    // --- place ---
    [
      "/Place/Search",
      [
        {
          id: "place-victoria",
          commonName: "Victoria",
          placeType: "NaptanMetroStation",
          lat: 51.4965,
          lon: -0.1444,
        },
      ],
    ],
    [
      "/Place/Type/CarPark",
      [
        {
          id: "carpark-1",
          commonName: "Finchley Central Car Park",
          placeType: "CarPark",
          lat: 51.5988,
          lon: -0.1885,
        },
      ],
    ],
    [
      "/Place/victoria-id",
      {
        id: "victoria-id",
        commonName: "Victoria",
        placeType: "NaptanMetroStation",
        lat: 51.4965,
        lon: -0.1444,
      },
    ],
    [
      "/Place",
      [
        {
          id: "place-victoria",
          commonName: "Victoria",
          placeType: "NaptanMetroStation",
          lat: 51.4965,
          lon: -0.1444,
        },
      ],
    ],

    // --- search ---
    [
      "/Search/BusSchedules",
      {
        query: "25",
        total: 1,
        matches: [{ id: "bus-25", name: "Route 25 Schedule", url: "https://tfl.gov.uk" }],
      },
    ],
    [
      "/Search",
      {
        query: "victoria",
        total: 1,
        matches: [{ id: "940GZZLUVIC", name: "Victoria", modes: ["tube"], zone: "1" }],
      },
    ],

    // --- journey ---
    [
      "/Journey/JourneyResults/Victoria/to/Waterloo",
      {
        journeys: [
          {
            duration: 8,
            startDateTime: "2024-01-01T09:00:00",
            arrivalDateTime: "2024-01-01T09:08:00",
            legs: [
              {
                duration: 8,
                mode: { name: "tube" },
                departurePoint: { commonName: "Victoria" },
                arrivalPoint: { commonName: "Waterloo" },
                instruction: { summary: "Take the Jubilee line towards Stanmore" },
              },
            ],
          },
        ],
      },
    ],
    ["/Journey/Meta/Modes", [{ mode: "tube", isTflService: true }]],

    // --- bike point ---
    ["/BikePoint/Search", []],
    [
      "/BikePoint/BikePoints_1",
      {
        id: "BikePoints_1",
        commonName: "River Street, Clerkenwell",
        lat: 51.52916,
        lon: -0.10981,
        additionalProperties: [
          { key: "NbBikes", value: "5" },
          { key: "NbDocks", value: "19" },
          { key: "NbEmptyDocks", value: "14" },
          { key: "Installed", value: "true" },
          { key: "Locked", value: "false" },
        ],
      },
    ],
    ["/BikePoint", []],

    // --- accident ---
    [
      "/AccidentStats/2023",
      [
        {
          id: 1,
          lat: 51.5,
          lon: -0.1,
          location: "Oxford Street",
          date: "2023-06-15T14:30:00",
          severity: "Slight",
          borough: "Westminster",
          casualties: [{ age: 35, class: "Pedestrian", severity: "Slight", mode: "Pedestrian" }],
          vehicles: [{ type: "Car" }],
        },
      ],
    ],

    // --- cabwise ---
    [
      "/Cabwise/search",
      {
        Operators: {
          OperatorList: [
            {
              OperatorId: 1,
              TradingName: "London Cabs Ltd",
              OrganisationName: "London Cabs Limited",
              BookingsPhoneNumber: "020 7123 4567",
              OperatorType: "BlackCab",
              WheelchairAccessible: "Yes",
            },
          ],
        },
      },
    ],

    // --- mode arrivals ---
    [
      "/Mode/tube/Arrivals",
      [
        {
          stationName: "Victoria",
          lineName: "Victoria",
          destinationName: "Walthamstow Central",
          platformName: "Southbound",
          timeToStation: 60,
        },
      ],
    ],

    // --- vehicle ---
    [
      "/Vehicle/UlezCompliance",
      [
        {
          vrm: "AB12CDE",
          type: "Car",
          make: "TOYOTA",
          model: "YARIS",
          colour: "BLUE",
          compliance: "Compliant",
        },
      ],
    ],
    [
      "/Vehicle/EmissionSurcharge",
      [
        {
          vrm: "AB12CDE",
          type: "Car",
          make: "TOYOTA",
          model: "YARIS",
          colour: "BLUE",
          compliant: "Compliant",
          isCazCompliant: true,
          isUlezCompliant: true,
          charges: [],
        },
      ],
    ],
  ]),
);
