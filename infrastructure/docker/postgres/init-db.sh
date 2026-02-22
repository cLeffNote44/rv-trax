#!/bin/bash
set -e

# Create extensions on the rvtrax database
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS "postgis";
    -- TimescaleDB is pre-loaded in the timescale/timescaledb-ha image
    CREATE EXTENSION IF NOT EXISTS "timescaledb";
EOSQL

# Create separate DB for ChirpStack
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    CREATE DATABASE chirpstack;
    GRANT ALL PRIVILEGES ON DATABASE chirpstack TO $POSTGRES_USER;
EOSQL
