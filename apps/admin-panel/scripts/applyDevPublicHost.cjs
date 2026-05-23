/**
 * Expand DEV_PUBLIC_HOST into UI / telemetry URLs (dev only).
 * Set DEV_PUBLIC_HOST=localhost | 192.168.x.x | Hamachi IP in apps/admin-panel/.env.local
 * Explicit NEXT_PUBLIC_* / ADMIN_* values in .env.local always win.
 */
function applyDevPublicHost() {
  const host = (process.env.DEV_PUBLIC_HOST || 'localhost').trim()
  const uiPort = (process.env.UI_PORT || '3000').trim()
  const telemetryPort = (process.env.TELEMETRY_PORT || '3002').trim()

  const uiBase = `http://${host}:${uiPort}`
  const telemetryBase = `http://${host}:${telemetryPort}`

  const defaults = {
    NEXT_PUBLIC_TELEMETRY_SOCKET_URL: telemetryBase,
    TELEMETRY_URL: telemetryBase,
    ADMIN_PANEL_URL: uiBase,
    ADMIN_DASHBOARD_ORIGINS: uiBase,
  }

  for (const [key, value] of Object.entries(defaults)) {
    const current = process.env[key]
    if (!current || !String(current).trim()) {
      process.env[key] = value
    }
  }

  if (!process.env.GATEWAY_ORIGIN || !String(process.env.GATEWAY_ORIGIN).trim()) {
    const gatewayPort = (process.env.GATEWAY_PORT || '4001').trim()
    process.env.GATEWAY_ORIGIN = `http://127.0.0.1:${gatewayPort}`
  }
}

module.exports = { applyDevPublicHost }
