"""Convert absolute coordinates to relative positions from entrance perspective."""
import math


def calculate_relative_position(building_lat, building_lng, entrance_bearing_deg,
                                 target_lat, target_lng):
    """Calculate relative position of target from building entrance perspective.

    Returns relative direction string (右隣, 左隣, 向かい, 裏手, etc.)
    """
    # Calculate bearing from building to target
    bearing = _bearing(building_lat, building_lng, target_lat, target_lng)

    # Calculate angle relative to entrance direction
    relative_angle = (bearing - entrance_bearing_deg + 360) % 360

    # Map to relative direction
    if relative_angle < 45 or relative_angle >= 315:
        return "正面（向かい側）"
    elif 45 <= relative_angle < 135:
        return "右隣"
    elif 135 <= relative_angle < 225:
        return "裏手"
    else:
        return "左隣"


def _bearing(lat1, lng1, lat2, lng2):
    """Calculate bearing from point 1 to point 2 in degrees."""
    lat1, lng1, lat2, lng2 = map(math.radians, [lat1, lng1, lat2, lng2])
    dlng = lng2 - lng1
    x = math.sin(dlng) * math.cos(lat2)
    y = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlng)
    bearing = math.degrees(math.atan2(x, y))
    return (bearing + 360) % 360
