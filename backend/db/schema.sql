-- QueueSmart database schema (PostgreSQL). Matches schema.dbml, plus the rules
-- DBML can't express: CHECK constraints and partial unique indexes.
-- Docker runs this file the first time the database volume is created.

CREATE TYPE user_role AS ENUM ('user', 'admin');
CREATE TYPE priority_level AS ENUM ('Low', 'Normal', 'High');
CREATE TYPE queue_status AS ENUM ('Open', 'Paused', 'Closed');
CREATE TYPE entry_status AS ENUM ('waiting', 'serving', 'served', 'left', 'removed', 'no-show');
CREATE TYPE notification_type AS ENUM ('Queue update', 'Status change');
CREATE TYPE notification_status AS ENUM ('sent', 'viewed');

CREATE TABLE place (
  id integer PRIMARY KEY, -- 6-digit id, also the join code
  name varchar(50) NOT NULL
);

CREATE TABLE user_credentials (
  id integer PRIMARY KEY, -- 6-digit id from the app
  email varchar(254) NOT NULL UNIQUE,
  password_hash varchar(255) NOT NULL, -- scrypt salt:hash, never plain text
  role user_role NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_profile (
  user_id integer PRIMARY KEY REFERENCES user_credentials (id),
  email varchar(254) NOT NULL UNIQUE REFERENCES user_credentials (email) ON UPDATE CASCADE,
  first_name varchar(50) NOT NULL,
  last_name varchar(50) NOT NULL,
  phone varchar(20),
  email_me boolean NOT NULL DEFAULT true,
  place_id integer REFERENCES place (id) -- admins only: the place they run
);

CREATE TABLE service (
  id integer PRIMARY KEY,
  place_id integer NOT NULL REFERENCES place (id),
  name varchar(100) NOT NULL,
  description varchar(500) NOT NULL,
  duration integer NOT NULL CHECK (duration BETWEEN 1 AND 480), -- minutes
  priority priority_level NOT NULL,
  max_in_line integer NOT NULL DEFAULT 25 CHECK (max_in_line BETWEEN 1 AND 500),
  opens time NOT NULL DEFAULT '09:00',
  closes time NOT NULL DEFAULT '16:30',
  appointments boolean NOT NULL DEFAULT false,
  deleted_at timestamptz, -- keeps ticket history after a delete
  CHECK (closes > opens)
);

CREATE INDEX service_place_id_idx ON service (place_id);

CREATE TABLE queue (
  id integer PRIMARY KEY,
  service_id integer NOT NULL UNIQUE REFERENCES service (id),
  status queue_status NOT NULL DEFAULT 'Closed',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE queue_entry (
  id integer PRIMARY KEY,
  queue_id integer NOT NULL REFERENCES queue (id),
  user_id integer NOT NULL REFERENCES user_credentials (id),
  ticket varchar(12) NOT NULL, -- e.g. A-001
  service_name varchar(100) NOT NULL, -- name at time of joining
  priority priority_level NOT NULL DEFAULT 'Normal',
  position integer NOT NULL, -- queueOrder in the code
  status entry_status NOT NULL DEFAULT 'waiting',
  joined_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  close_notified boolean NOT NULL DEFAULT false
);

CREATE INDEX queue_entry_queue_status_idx ON queue_entry (queue_id, status);
CREATE INDEX queue_entry_user_status_idx ON queue_entry (user_id, status);

-- A user can only have one active ticket at a time
CREATE UNIQUE INDEX one_active_ticket_per_user ON queue_entry (user_id)
  WHERE status IN ('waiting', 'serving');

-- A queue can only serve one person at a time
CREATE UNIQUE INDEX one_serving_per_queue ON queue_entry (queue_id)
  WHERE status = 'serving';

CREATE TABLE notification (
  id integer PRIMARY KEY,
  user_id integer NOT NULL REFERENCES user_credentials (id),
  type notification_type NOT NULL,
  message varchar(255) NOT NULL,
  status notification_status NOT NULL DEFAULT 'sent',
  emailed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notification_user_id_idx ON notification (user_id);

CREATE TABLE saved_place (
  user_id integer REFERENCES user_credentials (id),
  place_id integer REFERENCES place (id),
  PRIMARY KEY (user_id, place_id)
);

CREATE TABLE session (
  token uuid PRIMARY KEY,
  user_id integer NOT NULL REFERENCES user_credentials (id),
  created_at timestamptz NOT NULL DEFAULT now()
);
