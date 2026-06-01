VIEWS (EJS templates)

  Root *.ejs          Owner: Sagiv — Real InnoTech HR portal (login, workspace, etc.)
  partials/           Shared layout (head, sidebar, topbar) for real and decoy pages
  decoy/              Owner: Bar — Fake vulnerable UIs shown after traps fire

Decoy pages (Bar):
  database-console.ejs   SQLi trap fake query UI
  fake-login.ejs         Brute-force / legacy auth decoy
  honey-token.ejs        Fake API keys
  sandbox-xss.ejs        XSS submission page
  file-viewer.ejs        Path traversal (LFI) decoy
  fetch-status.ejs       SSRF decoy
  admin-dashboard.ejs    Dynamic fake admin (Faker.js data)
  credential-dump.ejs    Fake leak page

Mission 2.3: admin-dashboard uses randomized realistic data per request.
