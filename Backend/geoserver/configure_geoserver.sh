#!/bin/bash
# GeoServer configuration script using REST API

GEOSERVER_URL="http://localhost:8080/geoserver"
AUTH="admin:geoserver2024"

echo "Configuring GeoServer for Salzburg WebGIS..."

# Create workspace
curl -v -u $AUTH -XPOST -H "Content-type: text/xml" \
  -d "<workspace><name>salzburg</name></workspace>" \
  $GEOSERVER_URL/rest/workspaces

# Create PostGIS datastore
curl -v -u $AUTH -XPOST -H "Content-type: text/xml" \
  -d "<dataStore>
        <name>salzburg_postgis</name>
        <type>PostGIS</type>
        <enabled>true</enabled>
        <connectionParameters>
          <host>postgis</host>
          <port>5432</port>
          <database>salzburg_gis</database>
          <user>webgis_user</user>
          <passwd>secure_password_2024</passwd>
          <dbtype>postgis</dbtype>
        </connectionParameters>
      </dataStore>" \
  $GEOSERVER_URL/rest/workspaces/salzburg/datastores

# Publish layers
layers=("admin_boundaries" "transportation" "landuse" "green_spaces" "water_bodies" "buildings")

for layer in "${layers[@]}"; do
  echo "Publishing $layer..."
  
  # Create layer
  curl -v -u $AUTH -XPOST -H "Content-type: text/xml" \
    -d "<featureType>
          <name>$layer</name>
          <title>Salzburg $layer</title>
          <srs>EPSG:3857</srs>
          <enabled>true</enabled>
        </featureType>" \
    $GEOSERVER_URL/rest/workspaces/salzburg/datastores/salzburg_postgis/featuretypes
done

# Enable WMS and WFS services
curl -v -u $AUTH -XPUT -H "Content-type: text/xml" \
  -d "<wms>
        <enabled>true</enabled>
        <name>WMS</name>
        <title>Salzburg WebGIS WMS</title>
      </wms>" \
  $GEOSERVER_URL/rest/services/wms/workspaces/salzburg/settings

curl -v -u $AUTH -XPUT -H "Content-type: text/xml" \
  -d "<wfs>
        <enabled>true</enabled>
        <name>WFS</name>
        <title>Salzburg WebGIS WFS</title>
      </wfs>" \
  $GEOSERVER_URL/rest/services/wfs/workspaces/salzburg/settings

echo "GeoServer configuration complete!"