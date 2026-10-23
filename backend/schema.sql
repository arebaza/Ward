-- Never store this SQL file with real member data. Tables are empty until upload.
CREATE TABLE IF NOT EXISTS directory_current (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  members_json TEXT NOT NULL,
  filename TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS household_coordinates (
  address_key TEXT PRIMARY KEY,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  review_status TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS login_attempts (
  ip TEXT PRIMARY KEY,
  failures INTEGER NOT NULL DEFAULT 0,
  blocked_until INTEGER NOT NULL DEFAULT 0
);
