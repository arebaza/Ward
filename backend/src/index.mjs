// Park 5th Ward Shared Pilot API — Cloudflare Worker + D1
// Secret shared password and signing key live in Cloudflare Worker Secrets.
// No member record is bundled with the public GitHub Pages source.

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" };
const TOKEN_LIFETIME_SECONDS = 8 * 60 * 60;
const encoder = new TextEncoder();

function allowedOrigin(origin) {
  return origin === "https://arebaza.github.io" || origin === "http://localhost:5500" || origin === "http://127.0.0.1:5500";
}
function cors(origin) {
  return origin && allowedOrigin(origin) ? {
    "access-control-allow-origin": origin,
    "access-control-allow-headers": "Authorization, Content-Type",
    "access-control-allow-methods": "GET, POST, PUT, OPTIONS",
    "access-control-max-age": "600",
    vary: "Origin"
  } : {};
}
function reply(obj, status, origin) {
  return new Response(JSON.stringify(obj), { status, headers: { ...JSON_HEADERS, ...cors(origin) } });
}
function asStr(x, max = 500) { return String(x ?? "").trim().slice(0, max); }
function equalConstantTime(a, b) {
  const ab = encoder.encode(a), bb = encoder.encode(b);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < Math.max(ab.length, bb.length); i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}
function encode64(bytes) {
  let s = "";
  for (const value of bytes) s += String.fromCharCode(value);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function decode64(s) {
  const binary = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - s.length % 4) % 4));
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
async function hmacKey(env) {
  return crypto.subtle.importKey("raw", encoder.encode(env.SESSION_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
async function makeToken(env) {
  const body = { sub: "park5-pilot", exp: Math.floor(Date.now() / 1000) + TOKEN_LIFETIME_SECONDS, n: crypto.randomUUID() };
  const head64 = encode64(encoder.encode(JSON.stringify({ typ: "JWT", alg: "HS256" })));
  const body64 = encode64(encoder.encode(JSON.stringify(body)));
  const unsigned = `${head64}.${body64}`;
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(env), encoder.encode(unsigned));
  return `${unsigned}.${encode64(new Uint8Array(signature))}`;
}
async function verifyToken(env, raw) {
  if (!raw || raw.length > 2048) return false;
  const parts = raw.split(".");
  if (parts.length !== 3) return false;
  try {
    const unsigned = `${parts[0]}.${parts[1]}`;
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(env), decode64(parts[2]), encoder.encode(unsigned));
    if (!ok) return false;
    const body = JSON.parse(new TextDecoder().decode(decode64(parts[1])));
    return body.sub === "park5-pilot" && Number.isSafeInteger(body.exp) && body.exp > Date.now() / 1000;
  } catch { return false; }
}
async function readJSON(request, maxLength) {
  const raw = await request.text();
  if (raw.length > maxLength) throw new Error("File/data exceeds pilot size limit.");
  try { return JSON.parse(raw); } catch { throw new Error("Invalid JSON request."); }
}
function cleanMembers(members) {
  if (!Array.isArray(members) || members.length < 1 || members.length > 2000) throw new Error("Expected 1–2000 members.");
  const cleaned = members.map(m => ({
    name: asStr(m.name, 180), address: asStr(m.address, 400),
    gender: asStr(m.gender, 12), age: asStr(m.age, 8), birth_date: asStr(m.birth_date, 40),
    phone: asStr(m.phone, 55), email: asStr(m.email, 180)
  }));
  if (cleaned.some(m => !m.name || !m.address)) throw new Error("Every member must have a name and address.");
  return cleaned;
}
function cleanCoords(rows) {
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 500) throw new Error("Expected 1–500 coordinates.");
  return rows.map(r => {
    const addressKey = asStr(r.address_key, 420);
    const latitude = Number(r.latitude), longitude = Number(r.longitude);
    if (!addressKey || !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
        latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      throw new Error("Invalid household address or coordinates.");
    }
    return { addressKey, latitude, longitude, reviewStatus: asStr(r.review_status, 150) || "Manual — verify" };
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const path = new URL(request.url).pathname;
    if (request.method === "OPTIONS") {
      if (!allowedOrigin(origin)) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: cors(origin) });
    }
    if (origin && !allowedOrigin(origin)) return reply({ error: "Origin not allowed" }, 403, origin);
    if (path === "/api/health" && request.method === "GET") return reply({ status: "ok" }, 200, origin);
    if (!env.DB || !env.PILOT_PASSWORD || !env.SESSION_SECRET) return reply({ error: "API requires database and secrets configuration." }, 503, origin);
    try {
      if (path === "/api/login" && request.method === "POST") {
        const ip = asStr(request.headers.get("CF-Connecting-IP") || "unknown", 60);
        const now = Math.floor(Date.now() / 1000);
        const attempt = await env.DB.prepare("SELECT failures, blocked_until FROM login_attempts WHERE ip = ?").bind(ip).first();
        if (attempt && attempt.blocked_until > now) return reply({ error: "Too many attempts. Try again in 15 minutes." }, 429, origin);
        const incoming = await readJSON(request, 2000);
        if (!equalConstantTime(asStr(incoming.password, 150), env.PILOT_PASSWORD)) {
          const failures = (attempt?.failures || 0) + 1;
          const lockUntil = failures >= 5 ? now + 15 * 60 : 0;
          await env.DB.prepare("INSERT INTO login_attempts (ip, failures, blocked_until) VALUES (?, ?, ?) ON CONFLICT(ip) DO UPDATE SET failures = excluded.failures, blocked_until = excluded.blocked_until").bind(ip, failures >= 5 ? 0 : failures, lockUntil).run();
          return reply({ error: "Incorrect password." }, 401, origin);
        }
        await env.DB.prepare("DELETE FROM login_attempts WHERE ip = ?").bind(ip).run();
        return reply({ token: await makeToken(env), expires_in: TOKEN_LIFETIME_SECONDS }, 200, origin);
      }

      const match = /^Bearer (.+)$/i.exec(request.headers.get("Authorization") || "");
      if (!match || !(await verifyToken(env, match[1]))) return reply({ error: "Session expired. Sign in again." }, 401, origin);

      if (path === "/api/state" && request.method === "GET") {
        const directory = await env.DB.prepare("SELECT members_json, filename, updated_at FROM directory_current WHERE id=1").first();
        const coordResult = await env.DB.prepare("SELECT address_key, latitude, longitude, review_status, updated_at FROM household_coordinates ORDER BY address_key").all();
        return reply({ members: directory ? JSON.parse(directory.members_json) : [],
          filename: directory?.filename || "", updated_at: directory?.updated_at || "",
          coordinates: coordResult.results || [] }, 200, origin);
      }

      if (path === "/api/directory" && request.method === "PUT") {
        const data = await readJSON(request, 1000000);
        const members = cleanMembers(data.members);
        const filename = asStr(data.filename, 180) || "members.xlsx";
        await env.DB.prepare("INSERT INTO directory_current (id, members_json, filename, updated_at) VALUES (1, ?, ?, datetime('now')) ON CONFLICT(id) DO UPDATE SET members_json=excluded.members_json, filename=excluded.filename, updated_at=excluded.updated_at")
          .bind(JSON.stringify(members), filename).run();
        return reply({ saved: true, count: members.length, filename }, 200, origin);
      }

      if (path === "/api/coordinates" && request.method === "PUT") {
        const data = await readJSON(request, 200000);
        const coords = cleanCoords(data.coordinates);
        // One JSON-expanded SQL query rather than 139 separate writes.
        // This stays within D1 Free's per-invocation query limits.
        const payload = JSON.stringify(coords.map(c => ({
          address_key: c.addressKey, latitude: c.latitude,
          longitude: c.longitude, review_status: c.reviewStatus
        })));
        await env.DB.prepare(`INSERT INTO household_coordinates
            (address_key, latitude, longitude, review_status, updated_at)
          SELECT json_extract(value, '$.address_key'),
                 json_extract(value, '$.latitude'),
                 json_extract(value, '$.longitude'),
                 json_extract(value, '$.review_status'), datetime('now')
          FROM json_each(?) WHERE 1
          ON CONFLICT(address_key) DO UPDATE SET
            latitude=excluded.latitude, longitude=excluded.longitude,
            review_status=excluded.review_status, updated_at=excluded.updated_at`)
          .bind(payload).run();
        return reply({ saved: true, count: coords.length }, 200, origin);
      }
      return reply({ error: "Not found" }, 404, origin);
    } catch (err) {
      const msg = err?.message || "Unexpected backend error";
      const bad = /Expected|Invalid|exceeds|Every member|size limit/.test(msg);
      if (!bad) console.error("Pilot API error", err);
      return reply({ error: bad ? msg : "Server error. Check database setup or Cloudflare logs." }, bad ? 400 : 500, origin);
    }
  }
};
