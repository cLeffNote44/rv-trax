#!/usr/bin/env bash
set -euo pipefail

# RV Trax - Database Initialization Script
# Creates required PostgreSQL extensions: PostGIS and TimescaleDB

PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-rvtrax}"
PGPASSWORD="${PGPASSWORD:-rvtrax_dev}"
PGDATABASE="${PGDATABASE:-rvtrax}"

export PGPASSWORD

echo "Connecting to PostgreSQL at ${PGHOST}:${PGPORT} as ${PGUSER}..."

psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" <<SQL
  CREATE EXTENSION IF NOT EXISTS postgis;
  CREATE EXTENSION IF NOT EXISTS timescaledb;
SQL

echo "Database extensions created successfully."
echo "  - postgis"
echo "  - timescaledb"
