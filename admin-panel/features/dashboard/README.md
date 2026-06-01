# Dashboard Feature

> **Owner:** Yaniv · **Missions 4.2 & 4.3** — Real-time UI & live map

The live attack monitor — the centerpiece of the Blue Team interface.

| Folder | What's inside |
|--------|---------------|
| [`components/`](components/) | `ThreatMap`, `LeafletMap`, `AttackEventsTable`, `AttackerProfiles`, `HoneyTokenPanel`, `Sidebar`, `TopBar`, stat widgets |
| [`context/`](context/) | `SocketContext` — binds `socket.io-client` to React state |

Panels re-render the instant Max broadcasts a `liveAlert`; map coordinates come from the
telemetry `geoService`.
