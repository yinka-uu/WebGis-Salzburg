#!/bin/bash
# Database setup script

echo "Setting up PostgreSQL/PostGIS database for Salzburg WebGIS..."

# Run SQL initialization
sudo -u postgres psql -f backend/database/init.sql

# Test connection
psql -h localhost -U webgis_user -d salzburg_gis -c "SELECT postgis_version();"

echo "Database setup complete!"