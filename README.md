# TfL MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io/) server for the [Transport for London Unified API](https://api.tfl.gov.uk/), covering all 14 API domains and 87 endpoints.

## Tools (80 total)

| Domain            | Tools                                                      | Coverage                                                               |
| ----------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------- |
| **AccidentStats** | `accident_stats`                                           | Road accidents by year                                                 |
| **AirQuality**    | `air_quality`                                              | Live pollution forecasts (NO2, O3, PM10, PM2.5, SO2)                   |
| **BikePoint**     | `bike_points_all`, `bike_point_search`, `bike_point_by_id` | Santander Cycles availability                                          |
| **Cabwise**       | `cabwise_search`                                           | Licensed taxis & minicabs near a location                              |
| **Journey**       | `journey_plan`, `journey_modes`                            | Full journey planner (all modes)                                       |
| **Line**          | 14 tools                                                   | Status, routes, disruptions, arrivals, timetables, stop sequences      |
| **Mode**          | `mode_active_service_types`, `mode_arrivals`               | Cross-mode service info                                                |
| **Occupancy**     | 5 tools                                                    | Car parks, bike docks, EV charge connectors                            |
| **Place**         | 7 tools                                                    | Search, geo lookup, postcode streets, place types                      |
| **Road**          | 8 tools                                                    | TLRN status, disruptions, closures, roadworks                          |
| **Search**        | 5 tools                                                    | Full-text TfL site/data search                                         |
| **StopPoint**     | 17 tools                                                   | Search, arrivals, disruptions, crowding, routes, taxi ranks, car parks |
| **Vehicle**       | 3 tools                                                    | ULEZ compliance, emissions surcharge, vehicle arrival tracking         |

## Setup

### 1. Install Bun

```bash
curl -fsSL https://bun.sh/install | bash
```

### 2. Install dependencies

```bash
bun install
```

### 3. Build

```bash
bun run build
```

### 4. Get a TfL API key (free)

Register at [https://api-portal.tfl.gov.uk/](https://api-portal.tfl.gov.uk/). Without a key, requests are rate-limited to ~500/day.

### 5. Configure Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "tfl": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@daanrongen/tfl-mcp"],
      "env": {
        "TFL_API_KEY": "$TFL_API_KEY"
      }
    }
  }
}
```

Or add it through the CLI:

```bash
claude mcp add tfl npx -- -y @daanrongen/tfl-mcp \
  -e TFL_API_KEY=$TFL_API_KEY
```

## Development

```bash
bun run dev        # run with --watch (hot reload)
bun run start:dev  # run src/index.ts directly
bun test           # run test suite
bun test --watch   # run tests in watch mode
```

## Journey planner — location IDs

The most common failure mode is passing a free-text name to `journey_plan`, which causes TfL to return a 300 disambiguation response. The tool handles this gracefully and returns suggested `parameterValue` IDs to use on retry.

**Preferred ID formats (most to least reliable):**

| Format      | Example           | Notes                                              |
| ----------- | ----------------- | -------------------------------------------------- |
| ICS code    | `1000129`         | Most reliable — use output from `stoppoint_search` |
| Naptan ID   | `940GZZLUVIC`     | Reliable for tube/rail stations                    |
| Postcode    | `N1C4TB`          | Always resolves unambiguously                      |
| Coordinates | `51.5308,-0.1238` | Always unambiguous                                 |
| Free text   | `King's Cross`    | May trigger disambiguation                         |

**Common station ICS codes:**

| Station                  | ICS code  |
| ------------------------ | --------- |
| King's Cross St. Pancras | `1000129` |
| Victoria                 | `1000248` |
| Waterloo                 | `1000254` |
| London Bridge            | `1000135` |
| Paddington               | `1000184` |
| Liverpool Street         | `1000134` |
| Euston                   | `1000078` |
| Canary Wharf             | `1001006` |
| Brixton                  | `1000023` |
| Stratford                | `1000222` |

## Architecture

```
src/
├── index.ts          # Entry point — wires all modules into one MCP server
├── client.ts         # Shared HTTP client — API key injection, 300 disambiguation handling
├── accident.ts       # AccidentStats domain
├── air-quality.ts    # AirQuality domain
├── bike-point.ts     # BikePoint domain
├── cabwise.ts        # Cabwise domain
├── journey.ts        # Journey domain — disambiguation-aware
├── line.ts           # Line domain (14 tools)
├── mode.ts           # Mode domain
├── occupancy.ts      # Occupancy domain
├── place.ts          # Place domain
├── road.ts           # Road domain
├── search.ts         # Search domain
├── stop-point.ts     # StopPoint domain (17 tools)
└── vehicle.ts        # Vehicle domain
```
