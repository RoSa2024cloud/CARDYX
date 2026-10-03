CREATE TABLE IF NOT EXISTS cardyx.admin_session (
  token_hash text PRIMARY KEY CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  username text NOT NULL,
  credentials_version text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_session_expiry_idx ON cardyx.admin_session (expires_at);

CREATE TABLE IF NOT EXISTS cardyx.admin_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username text NOT NULL,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_audit_time_idx ON cardyx.admin_audit (created_at DESC);

CREATE TABLE IF NOT EXISTS cardyx.application_configuration (
  key text PRIMARY KEY CHECK (key = 'application'),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  settings jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON cardyx.admin_session TO cardyx_api;
GRANT SELECT, INSERT ON cardyx.admin_audit TO cardyx_api;
GRANT USAGE, SELECT ON SEQUENCE cardyx.admin_audit_id_seq TO cardyx_api;
GRANT SELECT, INSERT, UPDATE ON cardyx.application_configuration TO cardyx_api;