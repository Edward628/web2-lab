-- The server schema; applied at every start by migrate() (src/db.js), so it must
-- stay safe to run again. Projects have dev/prod environments (D-007); each
-- environment has SDK keys and a configuration version (D-010); a flag's settings
-- per environment are stored in the C-001 shape (rules, variants as JSONB). Events
-- (C-003) fill exposures, conversions and last_evaluated_at.
CREATE TABLE IF NOT EXISTS projects (
  id         serial PRIMARY KEY,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS environments (
  id             serial PRIMARY KEY,
  project_id     integer NOT NULL REFERENCES projects (id),
  name           text NOT NULL CHECK (name IN ('dev', 'prod')),
  config_version integer NOT NULL DEFAULT 1,
  UNIQUE (project_id, name)
);

CREATE TABLE IF NOT EXISTS sdk_keys (
  key            text PRIMARY KEY,
  environment_id integer NOT NULL REFERENCES environments (id),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS flags (
  id         serial PRIMARY KEY,
  project_id integer NOT NULL REFERENCES projects (id),
  key        text NOT NULL,
  type       text NOT NULL CHECK (type IN ('boolean', 'multivariate')),
  UNIQUE (project_id, key)
);

CREATE TABLE IF NOT EXISTS flag_environments (
  flag_id        integer NOT NULL REFERENCES flags (id),
  environment_id integer NOT NULL REFERENCES environments (id),
  enabled        boolean NOT NULL,
  "default"      jsonb NOT NULL,
  rules          jsonb NOT NULL DEFAULT '[]',
  variants       jsonb NOT NULL DEFAULT '[]',
  PRIMARY KEY (flag_id, environment_id)
);

-- Stale flags (D-005): set by the SDK's evaluation counts (C-003).
ALTER TABLE flag_environments ADD COLUMN IF NOT EXISTS last_evaluated_at timestamptz;

-- An experiment = one flag in one environment, with its metric (C-003).
CREATE TABLE IF NOT EXISTS experiments (
  id             serial PRIMARY KEY,
  flag_id        integer NOT NULL REFERENCES flags (id),
  environment_id integer NOT NULL REFERENCES environments (id),
  metric         text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (flag_id, environment_id)
);

-- Once per user and experiment; the first variant seen is kept (D-005).
CREATE TABLE IF NOT EXISTS exposures (
  experiment_id integer NOT NULL REFERENCES experiments (id),
  user_id       text NOT NULL,
  variant       jsonb NOT NULL,
  exposed_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (experiment_id, user_id)
);

-- Once per user and experiment, and only after an exposure (D-005): the foreign key
-- makes a conversion without a stored exposure impossible.
CREATE TABLE IF NOT EXISTS conversions (
  experiment_id integer NOT NULL,
  user_id       text NOT NULL,
  converted_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (experiment_id, user_id),
  FOREIGN KEY (experiment_id, user_id) REFERENCES exposures (experiment_id, user_id)
);

-- Every event id already handled, per environment: a resent event is ignored (C-003).
CREATE TABLE IF NOT EXISTS ingested_events (
  environment_id integer NOT NULL REFERENCES environments (id),
  id             text NOT NULL,
  ingested_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (environment_id, id)
);
