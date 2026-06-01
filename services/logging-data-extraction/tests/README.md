# Telemetry Tests

> **Owner:** Max

| File | What it checks |
|------|----------------|
| `geoService.test.js` | GeoIP lookup behavior and fallbacks |
| `mockAttack.js` | Smoke test — connects a socket, fires `/test-trap`, asserts the `liveAlert` shape |

```bash
npm test             # unit tests
npm run mock-attack  # live socket smoke test (server must be running)
```
