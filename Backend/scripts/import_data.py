"""
Import REAL Salzburg OSM data - FIXED with CASCADE drop
"""

import psycopg2
import geopandas as gpd
from sqlalchemy import create_engine, text
from pathlib import Path

# Database connection settings
DB_CONFIG = {
    "host": "localhost",
    "database": "salzburg_gis",
    "user": "webgis_user",
    "password": "salzburg2024",
    "port": "5432"
}

# Create SQLAlchemy engine
DB_URL = f"postgresql://{DB_CONFIG['user']}:{DB_CONFIG['password']}@{DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['database']}"
engine = create_engine(DB_URL)

# YOUR actual path
DATA_DIR = Path(r"C:\Users\USER\WebGis-Salzburg\Backend\data\Salzburg-shp\shape")

def drop_table_cascade(table_name):
    """Drop table with CASCADE to remove dependent views"""
    try:
        with engine.connect() as conn:
            # Use CASCADE to automatically drop dependent views
            conn.execute(text(f"DROP TABLE IF EXISTS salzburg.{table_name} CASCADE"))
            conn.commit()
            print(f"   ✅ Dropped table {table_name} with CASCADE")
    except Exception as e:
        print(f"   ⚠️  Could not drop table: {e}")

def import_shapefile(shp_name, table_name, description):
    """Import shapefile to PostGIS using SQLAlchemy"""
    shp_path = DATA_DIR / shp_name
    
    if not shp_path.exists():
        print(f"⚠️  {shp_name} not found (skipping)")
        return 0
    
    print(f"\n📂 Importing {shp_name} -> {table_name}...")
    print(f"   ({description})")
    
    try:
        # Read shapefile
        print(f"   Reading file...")
        gdf = gpd.read_file(shp_path)
        print(f"   Read {len(gdf):,} features")
        
        # Transform to EPSG:3857 if needed
        if gdf.crs and str(gdf.crs) != "EPSG:3857":
            print(f"   Transforming from {gdf.crs} to EPSG:3857")
            gdf = gdf.to_crs("EPSG:3857")
        
        # Drop existing table with CASCADE
        drop_table_cascade(table_name)
        
        # Import to database
        print(f"   Importing to database...")
        gdf.to_postgis(
            name=table_name,
            con=engine,
            schema='salzburg',
            if_exists='replace',
            index=False
        )
        
        count = len(gdf)
        print(f"   ✅ Successfully imported {count:,} features!")
        return count
        
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return 0

def recreate_views(conn):
    """Recreate the views that were dropped"""
    cur = conn.cursor()
    
    print("\n🔄 Recreating views...")
    
    # Recreate schools view
    cur.execute("""
        CREATE OR REPLACE VIEW salzburg.schools AS 
        SELECT * FROM salzburg.buildings 
        WHERE type ILIKE '%school%' OR type ILIKE '%university%' OR type ILIKE '%college%'
    """)
    
    # Recreate hospitals view
    cur.execute("""
        CREATE OR REPLACE VIEW salzburg.hospitals AS 
        SELECT * FROM salzburg.buildings 
        WHERE type ILIKE '%hospital%' OR type ILIKE '%clinic%' OR type ILIKE '%medical%'
    """)
    
    # Recreate residential areas view
    cur.execute("""
        CREATE OR REPLACE VIEW salzburg.residential_areas AS 
        SELECT * FROM salzburg.landuse 
        WHERE type ILIKE '%residential%'
    """)
    
    # Add a parks view
    cur.execute("""
        CREATE OR REPLACE VIEW salzburg.parks AS 
        SELECT * FROM salzburg.green_spaces 
        WHERE type ILIKE '%park%' OR type ILIKE '%garden%'
    """)
    
    conn.commit()
    print("   ✅ Views recreated successfully")

def main():
    print("\n" + "=" * 70)
    print("🚀 SALZBURG WebGIS - FINAL IMPORT (with CASCADE)")
    print("=" * 70)
    
    # Check if directory exists
    if not DATA_DIR.exists():
        print(f"\n❌ Folder not found: {DATA_DIR}")
        return
    
    print(f"\n📁 Using data folder: {DATA_DIR}")
    
    # List files found
    print("\n📋 Files found:")
    shp_files = list(DATA_DIR.glob("*.shp"))
    for file in shp_files:
        print(f"   - {file.name}")
    
    if not shp_files:
        print("❌ No shapefiles found!")
        return
    
    # Map YOUR shapefiles to database tables
    shapefile_mapping = [
        ('buildings.shp', 'buildings', 'All buildings in Salzburg'),
        ('roads.shp', 'transportation', 'Road network'),
        ('landuse.shp', 'landuse', 'Land use categories'),
        ('natural.shp', 'green_spaces', 'Forests, parks, natural areas'),
        ('waterways.shp', 'water_bodies', 'Rivers and streams'),
        ('points.shp', 'pois', 'Points of interest, amenities'),
        ('places.shp', 'places', 'Named places, districts'),
        ('railways.shp', 'railways', 'Railway lines')
    ]
    
    total_counts = {}
    total_features = 0
    
    print("\n" + "-" * 70)
    print("📊 IMPORTING DATA...")
    print("-" * 70)
    
    for shp_file, table_name, description in shapefile_mapping:
        if (DATA_DIR / shp_file).exists():
            count = import_shapefile(shp_file, table_name, description)
            if count > 0:
                total_counts[table_name] = count
                total_features += count
        else:
            print(f"\n⚠️  {shp_file} not found - skipping")
    
    # Recreate views
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        recreate_views(conn)
        conn.close()
    except Exception as e:
        print(f"\n⚠️  Could not recreate views: {e}")
    
    print("\n" + "=" * 70)
    print("✅ IMPORT COMPLETE!")
    print("=" * 70)
    print("\n📊 DATABASE SUMMARY:")
    print("-" * 70)
    
    for table, count in total_counts.items():
        print(f"   {table:15} : {count:10,} features")
    
    print("-" * 70)
    print(f"   TOTAL        : {total_features:10,} features")
    print("=" * 70)
    
    if total_features > 0:
        print("\n🎉 Your Salzburg WebGIS now has REAL data!")
        print(f"   Total features: {total_features:,}")
        print("\n📌 Next steps:")
        print("1. Open the frontend: C:\\Users\\USER\\Desktop\\WebGis\\frontend\\index.html")
        print("2. Try analysis tools with real data")
        print("3. Check GeoServer: http://localhost:8080/geoserver")
    else:
        print("\n❌ No data was imported. Please check the errors above.")

if __name__ == "__main__":
    main()