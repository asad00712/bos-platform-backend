CREATE DATABASE bos_volatile;

\connect bos_core
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

\connect bos_volatile
CREATE EXTENSION IF NOT EXISTS pgcrypto;
