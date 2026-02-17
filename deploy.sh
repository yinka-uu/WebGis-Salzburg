#!/bin/bash
# Master deployment script for Salzburg WebGIS

set -e  # Exit on error

echo "========================================="
echo "Salzburg WebGIS - Complete Deployment"
echo "========================================="

# Check prerequisites
echo "Checking prerequisites..."
command -v docker >/dev/null 2>&1 || { echo "Docker required but not installed. Aborting." >&2; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "Python3 required but not installed. Aborting." >&2; exit 1; }
command -v psql >/dev/null 2>&1 || { echo "PostgreSQL client required but not installed. Aborting." >&2; exit 1; }

# Step 1: Setup database
echo "Step 1: Setting up database..."
cd backend/database
./setup.sh
cd ../..

# Step 2: Download and import data
echo "Step 2: Downloading geospatial data..."
cd backend/scripts
python3 download_data.py
python3 import_data.py
cd ../..

# Step 3: Start GeoServer stack
echo "Step 3: Starting GeoServer and PostGIS containers..."
cd backend/geoserver
docker-compose down
docker-compose up -d

# Wait for GeoServer to start
echo "Waiting for GeoServer to initialize (30 seconds)..."
sleep 30

# Step 4: Configure GeoServer
echo "Step 4: Configuring GeoServer..."
./configure_geoserver.sh
cd ../..

# Step 5: Build frontend (if using any build tools)
echo "Step 5: Preparing frontend..."
cd frontend
# If using npm build, uncomment:
# npm install
# npm run build
cd ..

# Step 6: Setup web server (optional - for production)
echo "Step 6: Configuring web server..."
if command -v nginx >/dev/null 2>&1; then
    sudo cp docs/nginx.conf /etc/nginx/sites-available/salzburg-webgis
    sudo ln -sf /etc/nginx/sites-available/salzburg-webgis /etc/nginx/sites-enabled/
    sudo systemctl reload nginx
    echo "Nginx configured"
else
    echo "Nginx not installed - skipping web server setup"
fi

# Step 7: Run tests
echo "Step 7: Running tests..."
curl -f http://localhost:8080/geoserver/web/ || { echo "GeoServer not responding"; exit 1; }
curl -f http://localhost:5050/ || { echo "pgAdmin not responding"; exit 1; }

echo "========================================="
echo "✅ DEPLOYMENT COMPLETE!"
echo "========================================="
echo ""
echo "Access your WebGIS:"
echo "📊 Map Interface: file://$(pwd)/frontend/index.html"
echo "🖥️ GeoServer: http://localhost:8080/geoserver (admin/geoserver2024)"
echo "🗄️ pgAdmin: http://localhost:5050 (admin@salzburg-gis.local/admin2024)"
echo ""
echo "To stop services: cd backend/geoserver && docker-compose down"
echo "To view logs: cd backend/geoserver && docker-compose logs -f"