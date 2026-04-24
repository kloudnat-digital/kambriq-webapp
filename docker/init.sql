-- Kambriq - PostgreSQL initialization script
-- Runs once on first container startup (empty data directory).
-- kambriq_core is created automatically by POSTGRES_DB in docker-compose.

CREATE DATABASE kambriq_kbs;
CREATE DATABASE kambriq_kamnet;
CREATE DATABASE kambriq_lands;
CREATE DATABASE kambriq_verify;
CREATE DATABASE kambriq_valuation;
