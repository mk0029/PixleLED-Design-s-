"""Scalable, non-character effects and their color/motion modifiers."""

from __future__ import annotations

import re

from vertical_animations import ANIMATIONS as VERTICAL_ANIMATIONS

EFFECTS = (
    ("All-Lines Top-to-Bottom Comet Bounce", "Vertical Line & Curtain Flows", "comet"),
    ("Sequential Line-by-Line Palette Waterfall", "Vertical Line & Curtain Flows", "waterfall"),
    ("Sequential Color Stacking & Drain", "Vertical Line & Curtain Flows", "stack"),
    ("Odd/Even Alternating Up-Down Zipper", "Vertical Line & Curtain Flows", "zipper"),
    ("Center-Out Vertical Split", "Vertical Line & Curtain Flows", "split"),
    ("Rain Drops", "Vertical Line & Curtain Flows", "rain"),
    ("Curtain Wipe", "Vertical Line & Curtain Flows", "curtain"),
    ("Multi-Band Sine Wave", "Vertical Line & Curtain Flows", "toran_sine_bands"),
    ("Concentric Diamond Ripple", "Vertical Line & Curtain Flows", "toran_diamond_ripple"),
    ("Multi-Point Water Drop Ripples", "Vertical Line & Curtain Flows", "toran_water_drops"),
    ("Top-Border Rectangular Pulse", "Vertical Line & Curtain Flows", "toran_top_border_pulse"),
    ("Diagonal Chevron Wave", "Vertical Line & Curtain Flows", "toran_chevron"),
    *((name, "Vertical Line & Curtain Flows", kind) for kind, (name, _) in VERTICAL_ANIMATIONS.items()),
    ("Multi-Band Spectrum Equalizer with Gravity Peak-Hold", "DJ, Club & Audio-Kinetic", "equalizer"),
    ("Dual Bass VU-Meter", "DJ, Club & Audio-Kinetic", "vu"),
    ("Rotating Laser Beams", "DJ, Club & Audio-Kinetic", "laser"),
    ("Oscilloscope Wave", "DJ, Club & Audio-Kinetic", "oscilloscope"),
    ("Strobe Tunnel Warp", "DJ, Club & Audio-Kinetic", "tunnel"),
    ("Bass Shockwave Rings", "DJ, Club & Audio-Kinetic", "shockwave"),
    ("Matrix Digital Rain", "DJ, Club & Audio-Kinetic", "matrix"),
    ("Expanding Neon Diamonds", "Geometric & Optical", "diamond"),
    ("Moving Chevrons", "Geometric & Optical", "chevron"),
    ("DNA Double Helix", "Geometric & Optical", "helix"),
    ("Liquid Plasma Vortex", "Geometric & Optical", "plasma"),
    ("Spiral Galaxy", "Geometric & Optical", "galaxy"),
    ("Kaleidoscope Symmetry", "Geometric & Optical", "kaleidoscope"),
    ("Checkerboard Morph", "Geometric & Optical", "checker"),
    ("Radar Sweep", "Geometric & Optical", "radar"),
    ("Sine Wave Interference", "Geometric & Optical", "interference"),
    ("Fireworks Rocket & Multi-Ring Burst", "Festive & Cultural Motifs", "fireworks"),
    ("Revolving Rangoli Mandala", "Festive & Cultural Motifs", "rangoli"),
    ("Glowing Diya Flame", "Festive & Cultural Motifs", "diya"),
    ("Blooming Lotus", "Festive & Cultural Motifs", "lotus"),
    ("Pulsing Hearts", "Festive & Cultural Motifs", "hearts"),
    ("Falling Sparkles", "Festive & Cultural Motifs", "sparkles"),
    ("Tricolor Wave", "Festive & Cultural Motifs", "tricolor"),
    ("5×7 Bitmap Scrolling Text", "Custom Typography", "text"),
)

MODIFIERS = (
    ("cyber-blue-amber", "Cyber Blue / Amber", "palette", 0.58),
    ("wedding-gold-crimson", "Wedding Gold / Crimson", "palette", 0.04),
    ("tricolor", "Tricolor", "palette", 0.34),
    ("neon-club", "Neon Club", "palette", 0.78),
    ("rainbow-flow", "Rainbow Flow", "rainbow", 0.0),
    ("ocean-aqua", "Ocean Aqua", "palette", 0.50),
    ("fire-flame", "Fire Flame", "palette", 0.08),
    ("mirror-symmetry", "Mirror Symmetry", "mirror", 0.0),
    ("reverse-flow", "Reverse Flow", "reverse", 0.0),
)

# Toran ripple scenes and vertical animations keep their designed colors, so palette modifiers are replaced
# by one original-colors variant.
FIXED_COLOR_KINDS = {"toran_sine_bands", "toran_diamond_ripple", "toran_water_drops", "toran_top_border_pulse",
                     "toran_chevron", *VERTICAL_ANIMATIONS}
FIXED_COLOR_MODIFIERS = (
    ("original-colors", "Original Colors", "original", 0.0),
    *(modifier for modifier in MODIFIERS if modifier[2] in {"mirror", "reverse"}),
)


def _slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def _build_catalog() -> dict[str, dict[str, object]]:
    catalog = {}
    for effect_index, (name, family, kind) in enumerate(EFFECTS):
        modifiers = FIXED_COLOR_MODIFIERS if kind in FIXED_COLOR_KINDS else MODIFIERS
        for modifier_index, (modifier_id, modifier_name, modifier_kind, hue) in enumerate(modifiers):
            effect_id = f"{_slug(name)}--{modifier_id}"
            catalog[effect_id] = {
                "id": effect_id,
                "name": f"{name} · {modifier_name}",
                "base_name": name,
                "family": family,
                "kind": kind,
                "modifier": modifier_id,
                "modifier_name": modifier_name,
                "modifier_kind": modifier_kind,
                "hue": hue,
                "effect_index": effect_index,
                "modifier_index": modifier_index,
            }
    return catalog


SCENE_PRESETS = _build_catalog()
