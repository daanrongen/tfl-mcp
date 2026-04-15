# tfl-mcp

MCP server for the [Transport for London Unified API](https://api.tfl.gov.uk/) — lines, journeys, stop points, arrivals, bike points, occupancy, road disruptions and more over stdio.

## Installation

```bash
bunx @daanrongen/tfl-mcp
```

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

## Configuration

### API key (optional but recommended)

Register for a free key at [https://api-portal.tfl.gov.uk/](https://api-portal.tfl.gov.uk/). Without one, requests are rate-limited to ~500/day.

## Setup

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "tfl": {
      "type": "stdio",
      "command": "bunx",
      "args": ["@daanrongen/tfl-mcp"],
      "env": {
        "TFL_API_KEY": "your-key-here"
      }
    }
  }
}
```

### Claude Code CLI

```bash
claude mcp add tfl bunx -- @daanrongen/tfl-mcp -e TFL_API_KEY=your-key-here
```

## Development

```bash
bun install
bun run dev        # run with --watch
bun test           # run test suite
bun run build      # bundle to dist/main.js
bun run inspect    # open MCP Inspector in browser
```

## Inspecting locally

`bun run inspect` launches the [MCP Inspector](https://github.com/modelcontextprotocol/inspector) against the local build:

```bash
bun run build && bun run inspect
```

This opens the Inspector UI in your browser where you can call any tool interactively and inspect request/response shapes.

## Journey planner — location IDs

The most common failure mode is passing a free-text name to `journey_plan`, which causes TfL to return a 300 disambiguation response. The tool handles this gracefully and returns suggested `parameterValue` IDs to retry with.

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
├── config.ts           # Effect Config — TFL_API_KEY
├── main.ts             # Entry point — ManagedRuntime + StdioServerTransport
├── domain/
│   ├── TflClient.ts    # Context.Tag service interface
│   └── errors.ts       # TflError, TflDisambiguationError
├── infra/
│   ├── TflClientLive.ts  # Layer.effect — HTTP client with disambiguation handling
│   └── TflClientTest.ts  # In-memory test adapter
└── mcp/
    ├── server.ts       # McpServer wired to ManagedRuntime
    ├── utils.ts        # formatSuccess, formatError, formatDisambiguation
    └── tools/          # One module per TfL domain (13 files)
```

## License

MIT
