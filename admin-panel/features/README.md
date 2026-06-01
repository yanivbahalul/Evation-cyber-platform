# Features (React UI)

> **Owner:** Yaniv · **Missions 4.2 & 4.3**

The React UI of the admin panel, organized by feature. Each feature keeps its components
and its context together.

| Feature | What it does |
|---------|--------------|
| [`auth/`](auth/) | Login, register, and 2FA UI + session context |
| [`dashboard/`](dashboard/) | Live attack monitor — map, events table, profiles, honey tokens |
| [`investigation/`](investigation/) | Per-attacker timeline and event detail panel |

## Real-time + map

- State updates from Socket.IO via React hooks (`useState`/`useEffect`).
- Attack origins are plotted on a Leaflet map (`ThreatMap`, `LeafletMap`) using GeoIP data.

Max's backend emits the `liveAlert` events; this layer renders them.
