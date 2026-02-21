"""119番 住所特定AI支援 地図システム - Flask Application"""
import json
import os
import queue
import sqlite3
import threading
import time

from flask import Flask, Response, jsonify, render_template, request

import config
from lib.address_search import search_addresses, search_nameplates, search_pois
from lib.trigger_engine import evaluate_triggers

app = Flask(__name__)
app.config.from_object(config)

# SSE clients
sse_clients = []
sse_lock = threading.Lock()

# Current call state (in-memory for demo)
call_state = {
    'active': False,
    'call_id': None,
    'start_time': None,
    'gps': None,
    'address_searches': [],
    'confirmed_address': None,
    'scenario': None,
}
call_state_lock = threading.Lock()


def get_db():
    db = sqlite3.connect(config.DATABASE_PATH)
    db.row_factory = sqlite3.Row
    return db


def broadcast_sse(event_type, data):
    """Broadcast SSE event to all connected clients."""
    msg = f"event: {event_type}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
    with sse_lock:
        dead = []
        for i, q in enumerate(sse_clients):
            try:
                q.put_nowait(msg)
            except Exception:
                dead.append(i)
        for i in reversed(dead):
            sse_clients.pop(i)


# --- Routes ---

@app.route('/')
def index():
    return render_template('index.html', config={
        'map_center_lng': config.MAP_CENTER_LNG,
        'map_center_lat': config.MAP_CENTER_LAT,
        'map_default_zoom': config.MAP_DEFAULT_ZOOM,
        'osm_tile_url': config.OSM_TILE_URL,
        'gsi_aerial_url': config.GSI_AERIAL_URL,
    })


@app.route('/api/events')
def sse_stream():
    """SSE endpoint for real-time events."""
    q = queue.Queue(maxsize=50)
    with sse_lock:
        sse_clients.append(q)

    def generate():
        try:
            while True:
                try:
                    msg = q.get(timeout=30)
                    yield msg
                except queue.Empty:
                    yield ": keepalive\n\n"
        except GeneratorExit:
            with sse_lock:
                try:
                    sse_clients.remove(q)
                except ValueError:
                    pass

    return Response(generate(), mimetype='text/event-stream',
                    headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'})


@app.route('/api/search', methods=['GET'])
def api_search():
    """Address/nameplate/POI incremental search."""
    q = request.args.get('q', '').strip()
    if not q:
        return jsonify({'results': []})

    db = get_db()
    try:
        addresses = search_addresses(db, q)
        nameplates = search_nameplates(db, q)
        pois = search_pois(db, q)
        results = addresses + nameplates + pois
        return jsonify({'results': results, 'count': len(results)})
    finally:
        db.close()


@app.route('/api/reverse_geocode', methods=['GET'])
def api_reverse_geocode():
    """Reverse geocode from lat/lng."""
    lat = request.args.get('lat', type=float)
    lng = request.args.get('lng', type=float)
    if lat is None or lng is None:
        return jsonify({'error': 'lat and lng required'}), 400

    db = get_db()
    try:
        results = search_addresses(db, '', lat=lat, lng=lng, radius=100)
        return jsonify({'results': results})
    finally:
        db.close()


@app.route('/api/nearby_pois', methods=['GET'])
def api_nearby_pois():
    """Search POIs near a point."""
    lat = request.args.get('lat', type=float)
    lng = request.args.get('lng', type=float)
    radius = request.args.get('radius', 200, type=int)
    if lat is None or lng is None:
        return jsonify({'error': 'lat and lng required'}), 400

    db = get_db()
    try:
        pois = search_pois(db, '', lat=lat, lng=lng, radius=radius)
        return jsonify({'results': pois})
    finally:
        db.close()


@app.route('/api/demo_data', methods=['GET'])
def api_demo_data():
    """Get demo scenario data."""
    data_path = os.path.join(os.path.dirname(__file__), 'data', 'demo_data.json')
    with open(data_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return jsonify(data)


@app.route('/api/demo/start_call', methods=['POST'])
def demo_start_call():
    """Simulate call start."""
    data = request.get_json() or {}
    scenario = data.get('scenario', 'area_a')
    call_id = f"DEMO-{int(time.time())}"

    with call_state_lock:
        call_state.update({
            'active': True,
            'call_id': call_id,
            'start_time': time.time(),
            'gps': None,
            'address_searches': [],
            'confirmed_address': None,
            'scenario': scenario,
        })

    broadcast_sse('call_started', {
        'call_id': call_id,
        'timestamp': time.time(),
        'scenario': scenario,
    })
    return jsonify({'ok': True, 'call_id': call_id})


@app.route('/api/demo/send_gps', methods=['POST'])
def demo_send_gps():
    """Simulate GPS reception."""
    data = request.get_json() or {}
    lat = data.get('lat')
    lng = data.get('lng')
    accuracy = data.get('accuracy_m', 150)

    with call_state_lock:
        call_state['gps'] = {'lat': lat, 'lng': lng, 'accuracy_m': accuracy}

    broadcast_sse('gps_received', {
        'call_id': call_state.get('call_id'),
        'lat': lat,
        'lng': lng,
        'accuracy_m': accuracy,
    })
    return jsonify({'ok': True})


@app.route('/api/demo/address_searched', methods=['POST'])
def demo_address_searched():
    """Simulate address search event from command system."""
    data = request.get_json() or {}
    query = data.get('query', '')
    results = data.get('results', [])
    count = data.get('count', len(results))

    with call_state_lock:
        call_state['address_searches'].append({
            'query': query,
            'count': count,
            'time': time.time(),
        })

    broadcast_sse('address_searched', {
        'call_id': call_state.get('call_id'),
        'query': query,
        'results': results,
        'count': count,
    })
    return jsonify({'ok': True})


@app.route('/api/demo/confirm_address', methods=['POST'])
def demo_confirm_address():
    """Simulate address confirmation."""
    data = request.get_json() or {}

    with call_state_lock:
        call_state['confirmed_address'] = data.get('address')

    broadcast_sse('address_confirmed', {
        'call_id': call_state.get('call_id'),
        'address': data.get('address'),
    })
    return jsonify({'ok': True})


@app.route('/api/demo/end_call', methods=['POST'])
def demo_end_call():
    """Simulate call end."""
    call_id = call_state.get('call_id')

    with call_state_lock:
        call_state.update({
            'active': False,
            'call_id': None,
            'start_time': None,
            'gps': None,
            'address_searches': [],
            'confirmed_address': None,
            'scenario': None,
        })

    broadcast_sse('call_ended', {'call_id': call_id})
    return jsonify({'ok': True})


@app.route('/api/call_state', methods=['GET'])
def api_call_state():
    """Get current call state."""
    with call_state_lock:
        return jsonify(call_state)


@app.route('/api/evaluate_triggers', methods=['POST'])
def api_evaluate_triggers():
    """Evaluate trigger conditions and return active triggers."""
    data = request.get_json() or {}
    with call_state_lock:
        state = dict(call_state)
    state.update(data)
    triggers = evaluate_triggers(state)
    return jsonify({'triggers': triggers})


if __name__ == '__main__':
    # Initialize database
    from lib.address_search import init_db
    init_db()
    app.run(host='0.0.0.0', port=5000, debug=True, threaded=True)
