CREATE TABLE IF NOT EXISTS cardyx.token_social_sentiment_snapshot (
  market_id text PRIMARY KEY,
  sentiment numeric NOT NULL CHECK (sentiment BETWEEN 0 AND 100),
  posts_24h integer NOT NULL DEFAULT 0 CHECK (posts_24h >= 0),
  interactions_24h bigint NOT NULL DEFAULT 0 CHECK (interactions_24h >= 0),
  trend text NOT NULL CHECK (trend IN ('up', 'down', 'flat')),
  sources text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS token_social_sentiment_updated_idx
  ON cardyx.token_social_sentiment_snapshot (updated_at DESC);

GRANT SELECT, INSERT, UPDATE ON cardyx.token_social_sentiment_snapshot TO cardyx_api;