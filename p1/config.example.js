// Copy to p1/config.js (ignored by git, D-015) and fill in the prod SDK key that
// `docker compose exec server npm run seed` prints. baseUrl is the server.
// Served by the server itself (127.0.0.1:3000/p1/ or Render), P1 needs no such file:
// /p1/config.js is generated from P1_SDK_KEY (D-014, D-015).
export const sdkKey = 'paste-the-prod-sdk-key-here';
export const baseUrl = 'http://127.0.0.1:3000';
