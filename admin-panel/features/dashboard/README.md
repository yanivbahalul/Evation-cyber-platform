## DASHBOARD FEATURE (UI)

Owner: Yaniv — Missions 4.2 and 4.3

  components/  ThreatMap, LeafletMap, AttackEventsTable, AttackerProfiles,
               HoneyTokenPanel, Sidebar, TopBar, stats widgets
  context/     SocketContext — binds socket.io-client to React state

Live updates when Max broadcasts liveAlert. Geo from Max's geoService via API.
