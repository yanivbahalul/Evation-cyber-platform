GATEWAY SERVICES (business logic)

  detectionService.js  Owner: Sagiv — SQLi, XSS, scanner, path traversal pattern lists
  banService.js          Owner: Sagiv — IP ban checks (syncs with Max banned-ips API)
  (other service files)  Support real and decoy flows

Gatekeeper imports detectionService for deep packet inspection (Mission 1.2).
