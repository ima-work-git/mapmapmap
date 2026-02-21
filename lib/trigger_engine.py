"""Trigger evaluation engine for AI intervention conditions."""
import time


def evaluate_triggers(state):
    """Evaluate all trigger conditions against current call state.

    Returns list of active trigger IDs with metadata.
    """
    triggers = []

    if not state.get('active'):
        return triggers

    start_time = state.get('start_time', 0)
    elapsed = time.time() - start_time if start_time else 0
    gps = state.get('gps')
    searches = state.get('address_searches', [])
    confirmed = state.get('confirmed_address')

    if confirmed:
        return triggers  # Already confirmed, no triggers

    # T1: Multiple hits at same address
    for s in searches:
        if s.get('count', 0) >= 2 and s.get('same_banchi'):
            triggers.append({
                'id': 'T1',
                'name': '同一番地複数ヒット',
                'priority': 'immediate',
                'data': {
                    'query': s.get('query'),
                    'count': s['count'],
                },
            })

    # T2: Address delay (15 seconds since search with 1 result, no confirm)
    for s in searches:
        if s.get('count') == 1:
            search_elapsed = time.time() - s.get('time', 0)
            if search_elapsed >= 15 and not confirmed:
                triggers.append({
                    'id': 'T2',
                    'name': '住所確定遅延',
                    'priority': 'delayed',
                    'data': {
                        'elapsed_since_search': round(search_elapsed, 1),
                    },
                })

    # T3: GPS received + no address search (road report)
    if gps and elapsed >= 20 and not searches:
        triggers.append({
            'id': 'T3',
            'name': 'GPS受信・住所未入力',
            'priority': 'immediate',
            'data': {
                'gps': gps,
                'elapsed': round(elapsed, 1),
            },
        })

    # T4: No DB hit
    for s in searches:
        if s.get('count', 0) == 0:
            triggers.append({
                'id': 'T4',
                'name': 'DB検索ヒットなし',
                'priority': 'immediate',
                'data': {
                    'query': s.get('query'),
                },
            })

    # T6: Similar names multiple hits
    for s in searches:
        if s.get('count', 0) >= 2 and s.get('similar_names'):
            triggers.append({
                'id': 'T6',
                'name': '類似名称複数ヒット',
                'priority': 'immediate',
                'data': {
                    'query': s.get('query'),
                    'count': s['count'],
                },
            })

    return triggers
