# Security boundaries — shared password pilot

## Public repository
The GitHub Pages repository must contain **code only**. Do not commit actual member spreadsheets, CSVs with addresses, database exports, raw passwords, API bearer tokens, or screenshots of private household data.

## Backend secret
The initial password is stored using `npx wrangler secret put PILOT_PASSWORD`, and session HMAC key using `npx wrangler secret put SESSION_SECRET`. They do not appear in `app.js`, `config.js`, or `wrangler.toml`.

## Data storage
Uploading an Excel parses records in browser and sends **member records** via HTTPS to Cloudflare Worker. Cloudflare D1 persistently stores those records and verified map points. It does not store the original .xlsx bytes. Any holder of the pilot password has read/write permissions.

## Access control limitations
A shared password and 8-hour bearer session are **not suitable for broad distribution of sensitive directory information**. The pilot has no member-specific access rules or individual audit trail. GitHub Pages is public and cannot securely host these private records itself. Confirm permission for this external hosting provider and any relevant data-handling requirements, especially children's information, before importing the real Excel.

## External requests
The web page loads third-party Leaflet and SheetJS libraries, OpenStreetMap tiles, and opens Google Maps for navigation if requested. Confirm their use is permitted for the pilot before uploading any private data.
