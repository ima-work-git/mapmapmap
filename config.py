import os

# Flask config
SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-key-119-emergency')
DEBUG = os.environ.get('FLASK_DEBUG', '1') == '1'

# Database
DATABASE_PATH = os.path.join(os.path.dirname(__file__), 'data', 'addresses.db')

# Map defaults
MAP_CENTER_LNG = 139.9034
MAP_CENTER_LAT = 35.7847
MAP_DEFAULT_ZOOM = 14

# Tile sources (all free)
OSM_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
GSI_AERIAL_URL = "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg"
GSI_PALE_URL = "https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png"

# Nominatim (free geocoding)
NOMINATIM_URL = "https://nominatim.openstreetmap.org"

# Overpass API (free POI search)
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
