"""Twelve fixed-color vertical-strip animations, rendered as uint8 RGB frames (H, W, 3).

Each renderer takes the matrix size and t in seconds. Motion constants assume the 30 FPS source
design, but every frame is a pure function of t so previews and exports can start anywhere.
"""

import math

import numpy as np

SOURCE_FPS = 30


def _hsv(hue, saturation, value):
    hue = np.mod(hue, 1.0)
    sector = np.floor(hue * 6).astype(int) % 6
    fraction = hue * 6 - np.floor(hue * 6)
    saturation = np.broadcast_to(saturation, np.shape(hue))
    value = np.broadcast_to(value, np.shape(hue))
    p = value * (1 - saturation)
    q = value * (1 - fraction * saturation)
    r = value * (1 - (1 - fraction) * saturation)
    choices = np.stack([
        np.stack((value, r, p), -1), np.stack((q, value, p), -1), np.stack((p, value, r), -1),
        np.stack((p, q, value), -1), np.stack((r, p, value), -1), np.stack((value, p, q), -1),
    ])
    rgb = np.take_along_axis(choices, sector[None, ..., None], axis=0)[0]
    return (rgb * 255).astype(np.uint8)


def _grid(W, H):
    y, x = np.mgrid[0:H, 0:W]
    return x.astype(float), y.astype(float)


def _noise(index, seed):
    value = np.sin(np.asarray(index, dtype=float) * 12.9898 + seed * 78.233) * 43758.5453
    return value - np.floor(value)


def _rgb(frame, mask, r, g, b):
    frame[mask] = np.stack(np.broadcast_arrays(r, g, b, mask)[:3], -1)[mask].astype(np.uint8)


def matrix_rain(W, H, t):
    columns = np.arange(W)
    trail = max(6, H // 2)
    start = _noise(columns, 1) * 2 * H - H
    speed = 0.35 + _noise(columns, 2) * 0.5
    gap = 1 + _noise(columns, 3) * 5
    period = H + trail + gap
    head = np.trunc(np.mod(start + gap + speed * t * SOURCE_FPS, period) - gap)
    x, y = _grid(W, H)
    distance = head[None, :] - y
    frame = np.zeros((H, W, 3), dtype=np.uint8)
    intensity = np.clip(1 - distance / trail, 0, 1) ** 1.5
    _rgb(frame, (distance > 0) & (distance < trail), 0, 255 * intensity, 80 * intensity)
    frame[distance == 0] = (255, 255, 255)
    return frame


def liquid_fire(W, H, t):
    x, y = _grid(W, H)
    ny = 1 - y / max(1, H - 1)
    n1 = np.sin(x * 0.4 + t * 4.0) * 0.5 + 0.5
    n2 = np.sin(x * 0.8 - y * 0.35 + t * 7.5) * 0.5 + 0.5
    n3 = np.cos(x * 0.25 + y * 0.5 + t * 5.2) * 0.5 + 0.5
    heat = np.clip((n1 * 0.35 + n2 * 0.4 + n3 * 0.25) * ny ** 0.85 * 1.35, 0, 1)
    frame = np.zeros((H, W, 3), dtype=np.uint8)
    _rgb(frame, heat > 0.12, (heat - 0.12) / 0.28 * 255, 0, 0)
    _rgb(frame, heat > 0.4, 255, (heat - 0.4) / 0.35 * 220, 0)
    _rgb(frame, heat > 0.75, 255, 255, (heat - 0.75) * 4 * 255)
    return frame


def _bar_height(x, H, t):
    value = np.sin(x * 0.35 + t * 5.0) * 0.35 + np.cos(x * 0.7 - t * 8.0) * 0.3 + np.sin(t * 6.0 + x) * 0.2 + 0.5
    return np.clip(np.trunc(value * (H - 2)), 1, max(1, H - 1))


def peak_equalizer(W, H, t):
    x = np.arange(W, dtype=float)
    bar = _bar_height(x, H, t)
    lags = np.arange(4 * H + 1)
    history = _bar_height(x[None, :], H, t - lags[:, None] / SOURCE_FPS) - lags[:, None] * 0.25
    peak = np.trunc(np.maximum(history.max(axis=0), 0))
    _, y = _grid(W, H)
    level = H - 1 - y
    frame = _hsv(0.35 - level / H * 0.35, 1.0, 1.0)
    frame[level > bar[None, :]] = 0
    frame[(level > bar[None, :]) & (level == peak[None, :])] = (255, 255, 255)
    return frame


def waterfall_splash(W, H, t):
    x, y = _grid(W, H)
    frame = np.zeros((H, W, 3), dtype=np.uint8)
    flow = np.sin(y * 0.5 - t * 12.0 + x) * 0.5 + 0.5
    _rgb(frame, x % 3 == 0, 120 * flow, 180 + 75 * flow, 255)
    splash = np.sin(t * 15.0 + x * 2.1 + y) * 0.5 + 0.5
    value = 255 * splash
    _rgb(frame, (y >= H - 3) & (np.minimum(x % 3, 3 - x % 3) == 1) & (splash > 0.55), value * 0.85, value, value)
    return frame


def dna_helix(W, H, t):
    x, y = _grid(W, H)
    center = (H - 1) / 2
    amplitude = (H - 3) / 2
    phase = x * 0.28 - t * 4.5
    y1 = center + np.sin(phase) * amplitude
    y2 = center + np.sin(phase + math.pi) * amplitude
    frame = np.zeros((H, W, 3), dtype=np.uint8)
    rung = (x % 3 == 0) & (y >= np.trunc(np.minimum(y1, y2))) & (y <= np.trunc(np.maximum(y1, y2)))
    frame[rung] = (40, 50, 70)
    b1 = np.clip(1 - np.abs(y - y1) / 1.3, 0, 1)
    _rgb(frame, np.abs(y - y1) < 1.3, 0, 210 * b1, 255 * b1)
    b2 = np.clip(1 - np.abs(y - y2) / 1.3, 0, 1)
    _rgb(frame, np.abs(y - y2) < 1.3, 255 * b2, 140 * b2, 0)
    return frame


def comet_sweep(W, H, t):
    cycle = t * 1.4
    position = (math.sin(cycle) * 0.5 + 0.5) * (W - 1)
    direction = 1 if math.cos(cycle) >= 0 else -1
    x, _ = _grid(W, H)
    diff = (position - x) * direction
    intensity = np.clip(np.where(diff >= 0, np.exp(-np.maximum(diff, 0) * 0.35), 1 + diff), 0, 1)
    frame = _hsv(np.full(x.shape, t * 0.15), 0.9, intensity)
    frame[(diff < -1) | (diff > 10)] = 0
    frame[np.abs(x - position) < 0.8] = (255, 255, 255)
    return frame


def shutter_weave(W, H, t):
    x, y = _grid(W, H)
    even = x % 2 == 0
    wave = np.sin(y * 0.45 + np.where(even, 1, -1) * t * 5.5 + x * 0.15) * 0.5 + 0.5
    frame = _hsv(np.where(even, 0.55, 0.88) + wave * 0.1, 0.95, wave)
    frame[wave <= 0.35] = 0
    return frame


def plucked_string(W, H, t):
    x, y = _grid(W, H)
    norm_x = x / max(1, W - 1)
    envelope = np.sin(norm_x * math.pi) * abs(math.sin(t * 2.2))
    string_y = (H - 1) / 2 + np.sin(norm_x * 10.0 - t * 18.0) * (H * 0.42) * envelope
    distance = np.abs(y - string_y)
    frame = _hsv(0.52 + norm_x * 0.3, 1.0, np.clip(1 - distance / 2.2, 0, 1) ** 1.6)
    frame[distance >= 2.2] = 0
    frame[distance < 0.7] = (255, 255, 255)
    return frame


def prismatic_plasma(W, H, t):
    x, y = _grid(W, H)
    value = (np.sin(x * 0.22 + t * 2.5) + np.sin(y * 0.28 - t * 2.0) + np.sin((x + y) * 0.18 + t * 3.0)
             + np.sin(np.hypot(x - W / 2, y - H / 2) * 0.3 - t * 3.5))
    return _hsv((value + 4) / 8 + t * 0.08, 1.0, 1.0)


def spiral_vortex(W, H, t):
    x, y = _grid(W, H)
    dx = x - (W - 1) / 2
    dy = (y - (H - 1) / 2) * (W / max(1, H))
    angle = np.arctan2(dy, dx)
    radius = np.hypot(dx, dy)
    spiral = np.sin(angle * 3.0 + radius * 0.45 - t * 6.0) * 0.5 + 0.5
    return _hsv(angle / math.tau + radius * 0.02 - t * 0.15, 0.95, spiral ** 1.3)


def kaleidoscope(W, H, t):
    x, y = _grid(W, H)
    mx = np.abs(x - (W - 1) / 2)
    my = np.abs(y - (H - 1) / 2)
    pattern = np.sin(mx * 0.45 - t * 4.0) * np.cos(my * 0.45 + t * 3.2)
    ring = np.sin((mx + my) * 0.4 - t * 5.0)
    value = np.clip((pattern + ring) * 0.5 + 0.3, 0, 1)
    frame = _hsv((mx + my) * 0.03 + t * 0.2, 1.0, value)
    frame[value <= 0.2] = 0
    return frame


def voronoi_caustics(W, H, t):
    x, y = _grid(W, H)
    index = np.arange(8)[:, None, None]
    px = (np.sin(t * (0.9 + index * 0.17) + index * 2.1) * 0.45 + 0.5) * W
    py = (np.cos(t * (0.8 + index * 0.13) + index * 1.7) * 0.45 + 0.5) * H
    distances = np.sort(np.hypot(x - px, (y - py) * 1.3), axis=0)
    caustic = np.clip(1 - (distances[1] - distances[0]) * 0.35, 0, 1) ** 2.2
    frame = np.zeros((H, W, 3), dtype=np.uint8)
    _rgb(frame, np.ones_like(caustic, dtype=bool), 190 * caustic ** 2, 40 + 215 * caustic, 80 + 175 * caustic)
    return frame


ANIMATIONS = {
    "vline_matrix_rain": ("Matrix Rain", matrix_rain),
    "vline_liquid_fire": ("Liquid Fire", liquid_fire),
    "vline_peak_equalizer": ("Peak-Hold Equalizer Bars", peak_equalizer),
    "vline_waterfall_splash": ("Waterfall & Splash", waterfall_splash),
    "vline_dna_helix": ("Cyan-Amber DNA Double Helix", dna_helix),
    "vline_comet_sweep": ("Comet Curtain Sweep", comet_sweep),
    "vline_shutter_weave": ("Venetian Shutter Weave", shutter_weave),
    "vline_plucked_string": ("Plucked String Wave", plucked_string),
    "vline_prismatic_plasma": ("Prismatic Plasma", prismatic_plasma),
    "vline_spiral_vortex": ("Polar Spiral Vortex", spiral_vortex),
    "vline_kaleidoscope": ("4-Way Kaleidoscope", kaleidoscope),
    "vline_voronoi_caustics": ("Voronoi Water Caustics", voronoi_caustics),
}
