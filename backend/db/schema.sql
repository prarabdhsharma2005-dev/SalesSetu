CREATE TABLE IF NOT EXISTS salesetu_state (
  id text PRIMARY KEY,
  version bigint NOT NULL DEFAULT 1,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS salesetu_gmail_tokens (
  owner text PRIMARY KEY,
  envelope text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS salesetu_oauth_states (
  digest text PRIMARY KEY,
  owner text NOT NULL,
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS salesetu_oauth_states_expires_idx ON salesetu_oauth_states(expires_at);

CREATE TABLE IF NOT EXISTS salesetu_scheduler_lease (
  name text PRIMARY KEY,
  owner text NOT NULL,
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS salesetu_migrations (
  name text PRIMARY KEY,
  source_sha256 text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);
