-- The server schema; applied at every start by migrate() (src/db.js), so it must
-- stay safe to run again. Projects have dev/prod environments (D-007); each
-- environment has SDK keys and a configuration version (D-010); a flag's settings
-- per environment are stored in the C-001 shape (rules, variants as JSONB).
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
