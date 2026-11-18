"""Five Toran ripple scenes shared by the vertical-line effect catalog and the ripple-show plugin.

Each scene renders crisp integer-pixel uint8 RGB frames (H, W, 3) on a black background;
p is the loop phase in [0, 1) and frame_index seeds per-frame sparkles.
"""

import math

import numpy as np

SCENE_NAMES = (
    "Multi-Band Sine Wave",
    "Concentric Diamond Ripple",
    "Multi-Point Water Drop Ripples",
    "Top-Border Rectangular Pulse",
    "Diagonal Chevron Wave",
)

BLACK = (0, 0, 0)
RED = (255, 0, 0)
BAND_COLORS = np.array([(0, 70, 255), (0, 255, 40), (255, 220, 0), (255, 0, 0)], dtype=np.uint8)
DIAMOND_COLORS = np.array([(0, 255, 255), (255, 0, 255), (120, 255, 0)], dtype=np.uint8)
DROP_COLORS = np.array([(0, 160, 255), (0, 255, 200), (170, 60, 255)], dtype=np.uint8)
FRAME_COLORS = np.array([(255, 190, 0), (255, 90, 0), (255, 40, 140)], dtype=np.uint8)
CHEVRON_COLORS = np.array(
    [(255, 0, 0), (255, 140, 0), (255, 255, 0), (0, 255, 0), (0, 200, 255), (60, 0, 255), (220, 0, 255)],
    dtype=np.uint8,
)


def _grid(W, H):
    y, x = np.mgrid[0:H, 0:W]
    return x + 0.5, y + 0.5


def _paint(W, H, mask, colors, index):
    frame = np.zeros((H, W, 3), dtype=np.uint8)
    frame[mask] = colors[index[mask] % len(colors)]
    return frame


def scene_sine_bands(W, H, p, frame_index):
    x, y = _grid(W, H)
    amplitude = max(1.0, H * 0.14)
    offset = amplitude * np.sin(2 * math.pi * (x / W * 1.5 - p * 2))
    shifted = (y - offset) % H
    band_height = H / 4
    band = np.floor(shifted / band_height).astype(int)
    lit = (shifted % band_height) < max(1.0, band_height - 1)
    return _paint(W, H, lit, BAND_COLORS, band)


def scene_diamond_ripple(W, H, p, frame_index):
    x, y = _grid(W, H)
    spacing = 4
    distance = np.abs(x - W / 2) + np.abs(y - H / 2)
    phase = distance - p * spacing * 6
    ring = np.floor(phase / spacing).astype(int)
    lit = (phase % spacing) < 1.5
    return _paint(W, H, lit, DIAMOND_COLORS, ring)


def scene_water_drops(W, H, p, frame_index):
    x, y = _grid(W, H)
    frame = np.zeros((H, W, 3), dtype=np.uint8)
    rng = np.random.default_rng(9173 + frame_index)
    sources = ((0.22, 0.30, 0.0), (0.70, 0.62, 1 / 3), (0.45, 0.85, 2 / 3))
    max_radius = math.hypot(W, H) * 0.45
    drops_per_loop = 3
    for index, (sx, sy, start) in enumerate(sources):
        cycle = (p * drops_per_loop + start) % 1.0
        radius = cycle * max_radius
        distance = np.hypot(x - sx * W, (y - sy * H) * 1.2)
        trail = (distance < radius - 0.8) & (distance > radius - 4) & (rng.random((H, W)) < 0.18 * (1 - cycle))
        frame[trail] = (255, 255, 255)
        ring = np.abs(distance - radius) < 0.8
        frame[ring] = DROP_COLORS[index]
    return frame


def scene_top_border_pulse(W, H, p, frame_index):
    x, y = _grid(W, H)
    frame = np.zeros((H, W, 3), dtype=np.uint8)
    if H > 1:
        inner_h = H - 1
        center_y = 1 + inner_h / 2
        scale_x = inner_h / W
        distance = np.maximum(np.abs(x - W / 2) * scale_x, np.abs(y - center_y))
        spacing = 3
        phase = distance - p * spacing * len(FRAME_COLORS) * 2
        ring = np.floor(phase / spacing).astype(int)
        lit = ((phase % spacing) < 1) & (y >= 1)
        frame = _paint(W, H, lit, FRAME_COLORS, ring)
    frame[0, :] = RED
    return frame


def scene_chevron(W, H, p, frame_index):
    x, y = _grid(W, H)
    zig_period = max(2, min(10, H // 2 or 2))
    zig = np.abs(((y - 0.5) % zig_period) - zig_period / 2)
    spacing = 5
    phase = x + zig - p * spacing * len(CHEVRON_COLORS)
    stripe = np.floor(phase / spacing).astype(int)
    lit = (phase % spacing) < 2
    return _paint(W, H, lit, CHEVRON_COLORS, -stripe)


SCENES = (scene_sine_bands, scene_diamond_ripple, scene_water_drops, scene_top_border_pulse, scene_chevron)
SCENE_KINDS = dict(zip(
    ("toran_sine_bands", "toran_diamond_ripple", "toran_water_drops", "toran_top_border_pulse", "toran_chevron"),
    SCENES,
))
