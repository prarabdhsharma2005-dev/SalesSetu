CREATE TABLE IF NOT EXISTS salesetu_workspace_usage (
  workspace text NOT NULL,
  action text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL CHECK (count >= 0),
  PRIMARY KEY (workspace, action, window_start)
);
