CREATE TABLE IF NOT EXISTS cardyx.community_message (
  id bigserial PRIMARY KEY,
  channel text NOT NULL DEFAULT 'general',
  author_name text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (char_length(author_name) BETWEEN 2 AND 32),
  CHECK (char_length(body) BETWEEN 1 AND 1000)
);

CREATE INDEX IF NOT EXISTS community_message_channel_created_idx
  ON cardyx.community_message (channel, created_at DESC);

GRANT SELECT, INSERT ON cardyx.community_message TO cardyx_api;
GRANT USAGE, SELECT ON SEQUENCE cardyx.community_message_id_seq TO cardyx_api;