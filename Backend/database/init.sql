-- Create database
CREATE DATABASE salzburg_gis;
\c salzburg_gis;

-- Enable PostGIS
CREATE EXTENSION postgis;
CREATE EXTENSION postgis_topology;
CREATE EXTENSION fuzzystrmatch;
CREATE EXTENSION postgis_tiger_geocoder;

-- Create schema
CREATE SCHEMA IF NOT EXISTS salzburg;

-- Create tables
CREATE TABLE salzburg.admin_boundaries (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    admin_level INTEGER,
    geom GEOMETRY(MULTIPOLYGON, 3857),
    area_ha FLOAT,
    population INTEGER,
    source VARCHAR(50),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE salzburg.transportation (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    type VARCHAR(50), -- 'road', 'railway', 'path'
    subtype VARCHAR(50), -- 'motorway', 'residential', 'cycleway'
    geom GEOMETRY(MULTILINESTRING, 3857),
    length_km FLOAT,
    speed_limit INTEGER,
    one_way BOOLEAN,
    source VARCHAR(50)
);

CREATE TABLE salzburg.landuse (
    id SERIAL PRIMARY KEY,
    type VARCHAR(50), -- 'residential', 'commercial', 'industrial', 'agricultural'
    zone_type VARCHAR(50),
    geom GEOMETRY(MULTIPOLYGON, 3857),
    area_ha FLOAT,
    source VARCHAR(50)
);

CREATE TABLE salzburg.green_spaces (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    type VARCHAR(50), -- 'park', 'forest', 'garden'
    geom GEOMETRY(MULTIPOLYGON, 3857),
    area_ha FLOAT,
    maintenance_status VARCHAR(50),
    source VARCHAR(50)
);

CREATE TABLE salzburg.water_bodies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    type VARCHAR(50), -- 'river', 'lake', 'pond'
    geom GEOMETRY(MULTIPOLYGON, 3857),
    area_ha FLOAT,
    flow_rate FLOAT,
    source VARCHAR(50)
);

CREATE TABLE salzburg.buildings (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    type VARCHAR(50), -- 'residential', 'school', 'hospital', 'commercial'
    floors INTEGER,
    height FLOAT,
    geom GEOMETRY(MULTIPOLYGON, 3857),
    footprint_area FLOAT,
    address TEXT,
    source VARCHAR(50)
);

-- Create spatial indexes
CREATE INDEX idx_admin_boundaries_geom ON salzburg.admin_boundaries USING GIST(geom);
CREATE INDEX idx_transportation_geom ON salzburg.transportation USING GIST(geom);
CREATE INDEX idx_landuse_geom ON salzburg.landuse USING GIST(geom);
CREATE INDEX idx_green_spaces_geom ON salzburg.green_spaces USING GIST(geom);
CREATE INDEX idx_water_bodies_geom ON salzburg.water_bodies USING GIST(geom);
CREATE INDEX idx_buildings_geom ON salzburg.buildings USING GIST(geom);

-- Create views for analysis
CREATE VIEW salzburg.schools AS
SELECT * FROM salzburg.buildings WHERE type = 'school';

CREATE VIEW salzburg.hospitals AS
SELECT * FROM salzburg.buildings WHERE type = 'hospital';

CREATE VIEW salzburg.residential_areas AS
SELECT * FROM salzburg.landuse WHERE type = 'residential';

-- Create function for buffer analysis
CREATE OR REPLACE FUNCTION salzburg.create_buffer(
    center_geom GEOMETRY,
    buffer_distance NUMERIC
) RETURNS GEOMETRY AS $$
BEGIN
    RETURN ST_Buffer(center_geom::GEOGRAPHY, buffer_distance)::GEOMETRY;
END;
$$ LANGUAGE plpgsql;

-- Create function for accessibility calculation
CREATE OR REPLACE FUNCTION salzburg.calculate_accessibility(
    start_point GEOMETRY,
    service_type VARCHAR,
    max_distance NUMERIC
) RETURNS TABLE(
    building_id INTEGER,
    building_name VARCHAR,
    distance_m NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        b.id,
        b.name,
        ST_Distance(start_point::GEOGRAPHY, b.geom::GEOGRAPHY) as dist
    FROM salzburg.buildings b
    WHERE b.type = service_type
    AND ST_DWithin(start_point::GEOGRAPHY, b.geom::GEOGRAPHY, max_distance)
    ORDER BY dist;
END;
$$ LANGUAGE plpgsql;

-- Create user and grant privileges
CREATE USER webgis_user WITH PASSWORD 'secure_password_2024';
GRANT CONNECT ON DATABASE salzburg_gis TO webgis_user;
GRANT USAGE ON SCHEMA salzburg TO webgis_user;
GRANT SELECT ON ALL TABLES IN SCHEMA salzburg TO webgis_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA salzburg TO webgis_user;