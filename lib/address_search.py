"""Address, nameplate, and POI search logic with SQLite backend."""
import json
import math
import os
import sqlite3

import config


def init_db():
    """Initialize SQLite database with demo data."""
    os.makedirs(os.path.dirname(config.DATABASE_PATH), exist_ok=True)
    db = sqlite3.connect(config.DATABASE_PATH)
    db.execute("PRAGMA journal_mode=WAL")

    db.executescript("""
        CREATE TABLE IF NOT EXISTS addresses (
            id TEXT PRIMARY KEY,
            prefecture TEXT,
            city TEXT,
            town TEXT,
            chome INTEGER,
            banchi TEXT,
            go TEXT,
            building_name TEXT,
            room_number TEXT,
            lat REAL,
            lng REAL,
            building_type TEXT,
            floor_count INTEGER,
            full_address TEXT,
            area_id TEXT
        );

        CREATE TABLE IF NOT EXISTS nameplates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            address_id TEXT REFERENCES addresses(id),
            family_name TEXT,
            entrance_bearing_deg REAL
        );

        CREATE TABLE IF NOT EXISTS neighbor_context (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            address_id TEXT REFERENCES addresses(id),
            direction_relative TEXT,
            neighbor_name TEXT,
            neighbor_type TEXT,
            distance_m REAL,
            feature TEXT
        );

        CREATE TABLE IF NOT EXISTS pois (
            id TEXT PRIMARY KEY,
            name TEXT,
            category TEXT,
            chain_name TEXT,
            lat REAL,
            lng REAL,
            address TEXT,
            source TEXT,
            area_id TEXT
        );
    """)

    # Load demo data
    data_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'demo_data.json')
    with open(data_path, 'r', encoding='utf-8') as f:
        demo = json.load(f)

    # Clear existing demo data
    db.execute("DELETE FROM neighbor_context")
    db.execute("DELETE FROM nameplates")
    db.execute("DELETE FROM pois")
    db.execute("DELETE FROM addresses")

    areas = demo.get('areas', {})

    # Area A: Same-address cluster
    area_a = areas.get('area_a', {})
    for b in area_a.get('buildings', []):
        addr = b['address']
        db.execute("""
            INSERT OR REPLACE INTO addresses
            (id, prefecture, city, town, chome, banchi, go, building_name, lat, lng,
             building_type, floor_count, full_address, area_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (b['id'], addr['prefecture'], addr['city'], addr['town'],
              addr.get('chome'), addr['banchi'], addr.get('go'),
              None, b['lat'], b['lng'], b['type'], b['floors'],
              addr['full'], 'area_a'))

        db.execute("""
            INSERT INTO nameplates (address_id, family_name, entrance_bearing_deg)
            VALUES (?, ?, ?)
        """, (b['id'], b['nameplate'], b['entrance_bearing']))

        feat = b.get('features', {})
        for direction, name in [('右隣', feat.get('right')),
                                ('左隣', feat.get('left')),
                                ('向かい', feat.get('across')),
                                ('裏手', feat.get('back'))]:
            if name and not name.startswith('('):
                db.execute("""
                    INSERT INTO neighbor_context
                    (address_id, direction_relative, neighbor_name, neighbor_type, distance_m, feature)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (b['id'], direction, name, '住宅', 10.0, feat.get('position', '')))

    for poi in area_a.get('surrounding_pois', []):
        db.execute("""
            INSERT OR REPLACE INTO pois (id, name, category, lat, lng, address, source, area_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (f"poi_a_{poi['name']}", poi['name'], poi['category'],
              poi['lat'], poi['lng'], '千葉県松戸市松戸', 'local_db', 'area_a'))

    # Area B: Road report
    area_b = areas.get('area_b', {})
    for lm in area_b.get('landmarks', []):
        db.execute("""
            INSERT OR REPLACE INTO pois (id, name, category, lat, lng, address, source, area_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (f"poi_b_{lm['name']}", lm['name'], lm['category'],
              lm['lat'], lm['lng'], '千葉県柏市柏', 'local_db', 'area_b'))

    nh = area_b.get('nearest_house', {})
    if nh:
        db.execute("""
            INSERT OR REPLACE INTO addresses
            (id, prefecture, city, town, banchi, lat, lng, building_type, full_address, area_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, ('B1', '千葉県', '柏市', '柏', '3-5-12',
              nh['lat'], nh['lng'], 'detached', f"千葉県{nh['address']}", 'area_b'))
        db.execute("""
            INSERT INTO nameplates (address_id, family_name, entrance_bearing_deg)
            VALUES (?, ?, ?)
        """, ('B1', nh['nameplate'], 0))

    # Area C: Tenant change
    area_c = areas.get('area_c', {})
    sc = area_c.get('scenario', {})
    local_db = sc.get('local_db', {})
    if local_db:
        db.execute("""
            INSERT OR REPLACE INTO addresses
            (id, prefecture, city, town, banchi, building_name, lat, lng,
             building_type, full_address, area_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, ('C1', '千葉県', '流山市', 'おおたかの森北', '1-2-3',
              local_db['name'], local_db.get('lat', 35.8717), local_db.get('lng', 139.929),
              'office', local_db.get('full_address', f"千葉県{local_db['address']}"), 'area_c'))

    for tenant in sc.get('tenants', []):
        db.execute("""
            INSERT OR REPLACE INTO pois (id, name, category, lat, lng, address, source, area_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (f"poi_c_{tenant['name']}", tenant['name'], 'tenant',
              35.8717, 139.929, f"千葉県流山市おおたかの森北1-2-3 {tenant['floor']}F",
              'local_db', 'area_c'))

    # Area D: Similar mansions
    area_d = areas.get('area_d', {})
    for m in area_d.get('mansions', []):
        db.execute("""
            INSERT OR REPLACE INTO addresses
            (id, prefecture, city, town, banchi, building_name, lat, lng,
             building_type, floor_count, full_address, area_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (m['id'], '千葉県', '鎌ケ谷市', '新鎌ケ谷',
              m['address'].split('新鎌ケ谷')[-1],
              m['name'], m['lat'], m['lng'],
              'mansion', m['floors'], m.get('full_address', f"千葉県{m['address']}"), 'area_d'))

    db.commit()
    db.close()


def _haversine(lat1, lng1, lat2, lng2):
    """Calculate distance in meters between two points."""
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def search_addresses(db, query, lat=None, lng=None, radius=500):
    """Search addresses by text or proximity."""
    results = []

    if lat is not None and lng is not None:
        # Proximity search
        rows = db.execute("""
            SELECT a.*, n.family_name
            FROM addresses a
            LEFT JOIN nameplates n ON a.id = n.address_id
            WHERE a.lat BETWEEN ? AND ? AND a.lng BETWEEN ? AND ?
        """, (lat - 0.005, lat + 0.005, lng - 0.005, lng + 0.005)).fetchall()

        for row in rows:
            dist = _haversine(lat, lng, row['lat'], row['lng'])
            if dist <= radius:
                results.append({
                    'type': 'address',
                    'id': row['id'],
                    'full_address': row['full_address'],
                    'building_name': row['building_name'],
                    'building_type': row['building_type'],
                    'floor_count': row['floor_count'],
                    'nameplate': row['family_name'],
                    'lat': row['lat'],
                    'lng': row['lng'],
                    'distance_m': round(dist, 1),
                    'area_id': row['area_id'],
                })
        results.sort(key=lambda x: x['distance_m'])

    elif query:
        # Text search
        like = f"%{query}%"
        rows = db.execute("""
            SELECT a.*, n.family_name
            FROM addresses a
            LEFT JOIN nameplates n ON a.id = n.address_id
            WHERE a.full_address LIKE ?
               OR a.building_name LIKE ?
               OR a.town LIKE ?
               OR a.banchi LIKE ?
        """, (like, like, like, like)).fetchall()

        for row in rows:
            results.append({
                'type': 'address',
                'id': row['id'],
                'full_address': row['full_address'],
                'building_name': row['building_name'],
                'building_type': row['building_type'],
                'floor_count': row['floor_count'],
                'nameplate': row['family_name'],
                'lat': row['lat'],
                'lng': row['lng'],
                'area_id': row['area_id'],
            })

    return results


def search_nameplates(db, query):
    """Search by nameplate (family name)."""
    if not query:
        return []

    like = f"%{query}%"
    rows = db.execute("""
        SELECT n.family_name, a.*
        FROM nameplates n
        JOIN addresses a ON n.address_id = a.id
        WHERE n.family_name LIKE ?
    """, (like,)).fetchall()

    results = []
    for row in rows:
        results.append({
            'type': 'nameplate',
            'id': row['id'],
            'nameplate': row['family_name'],
            'full_address': row['full_address'],
            'building_type': row['building_type'],
            'floor_count': row['floor_count'],
            'lat': row['lat'],
            'lng': row['lng'],
            'area_id': row['area_id'],
        })
    return results


def search_pois(db, query, lat=None, lng=None, radius=500):
    """Search POIs by name or proximity."""
    results = []

    if lat is not None and lng is not None:
        rows = db.execute("""
            SELECT * FROM pois
            WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?
        """, (lat - 0.005, lat + 0.005, lng - 0.005, lng + 0.005)).fetchall()

        for row in rows:
            dist = _haversine(lat, lng, row['lat'], row['lng'])
            if dist <= radius:
                results.append({
                    'type': 'poi',
                    'id': row['id'],
                    'name': row['name'],
                    'category': row['category'],
                    'lat': row['lat'],
                    'lng': row['lng'],
                    'address': row['address'],
                    'distance_m': round(dist, 1),
                    'area_id': row['area_id'],
                })
        results.sort(key=lambda x: x['distance_m'])

    elif query:
        like = f"%{query}%"
        rows = db.execute("""
            SELECT * FROM pois WHERE name LIKE ?
        """, (like,)).fetchall()

        for row in rows:
            results.append({
                'type': 'poi',
                'id': row['id'],
                'name': row['name'],
                'category': row['category'],
                'lat': row['lat'],
                'lng': row['lng'],
                'address': row['address'],
                'area_id': row['area_id'],
            })

    return results


def get_neighbors(db, address_id):
    """Get neighbor context for an address."""
    rows = db.execute("""
        SELECT * FROM neighbor_context WHERE address_id = ?
    """, (address_id,)).fetchall()

    return [{
        'direction': row['direction_relative'],
        'name': row['neighbor_name'],
        'type': row['neighbor_type'],
        'distance_m': row['distance_m'],
        'feature': row['feature'],
    } for row in rows]
