FEATURES (React UI modules)
Owner: Yaniv

What is here:
  auth/           Login, register, 2FA UI components and context
  dashboard/      Live attack monitor: map, events table, profiles, honey tokens
  investigation/  Per-attacker timeline and event detail panel

Mission 4.2 and 4.3 from Responsibilities.docx:
  Real-time state from Socket.IO (useState/useEffect)
  Leaflet map with GeoIP attack origins (ThreatMap, LeafletMap)

Max provides liveAlert events; this layer renders them.
