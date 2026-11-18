"""Catalog of unique math effects and selectable color palettes."""

from __future__ import annotations

SHAPES = [
    ("Wave", "Waves", "sin(x * density + t * speed)"),
    ("Cross wave", "Waves", "cos(y * density - t * speed)"),
    ("Diagonal wave", "Waves", "sin((x + y) * density - t * speed)"),
    ("Reverse diagonal", "Waves", "cos((x - y) * density + t * speed)"),
    ("Nested wave", "Waves", "sin(x * density + sin(y * density + t * speed))"),
    ("Nested ripple", "Waves", "cos(y * density + cos(x * density - t * speed))"),
    ("Radial rings", "Radial", "sin(hypot(x - W/2, y - H/2) * density - t * speed)"),
    ("Radial pulse", "Radial", "cos(hypot(x - W/2, y - H/2) * density + t * speed)"),
    ("Soft radial", "Radial", "sin(hypot(x - W/2, y - H/2) * density + sin(t * speed))"),
    ("Double radial", "Radial", "cos(hypot(x - W/2, y - H/2) * density + sin(t * speed))"),
    ("Diagonal interference", "Interference", "sin(x * density) * cos(y * density)"),
    ("Moving interference", "Interference", "sin(x * density + t * speed) * cos(y * density - t * speed)"),
    ("Cross interference", "Interference", "sin((x - W/2) * density) * cos((y - H/2) * density)"),
    ("Grid interference", "Interference", "sin(x * density + y * density + t * speed) + cos(x * density - y * density)"),
    ("Spiral interference", "Interference", "sin(hypot(x - W/2, y - H/2) * density + t * speed) + cos((x + y) * density)"),
    ("Orbit interference", "Interference", "cos(x * density) * cos(y * density) + sin(t * speed)"),
    ("Diagonal lattice", "Geometry", "sin((x - W/2) * (y - H/2) * density + t * speed)"),
    ("Hyperbolic lattice", "Geometry", "cos((x - W/2) * (y - H/2) * density - t * speed)"),
    ("Horizontal bands", "Geometry", "sin(abs(y - H/2) * density - t * speed)"),
    ("Vertical bands", "Geometry", "cos(abs(x - W/2) * density + t * speed)"),
    ("Parabolic bands", "Geometry", "sin((x - W/2) ** 2 * density + t * speed)"),
    ("Stacked arcs", "Geometry", "cos((y - H/2) ** 2 * density - t * speed)"),
    ("Diamond field", "Geometry", "sin((abs(x - W/2) + abs(y - H/2)) * density - t * speed)"),
    ("Particle field", "Particles", "sin(hypot(x - W/2, y - H/2) * density - t * speed) * cos((x + y) * density)"),
    ("Falling drop", "Rain & Drops", "cos(hypot(x - (W/2 + sin(t*speed)*W/4), (y+t*speed)%H - H/2) * density)"),
    ("Long rain streaks", "Rain & Drops", "sin((x - W/2 - sin(t*speed)*W/4) * density) * cos((y+t*speed) * density)"),
    ("Slanted rain", "Rain & Drops", "sin((x + y*0.55) * density + t * speed)"),
    ("Heavy rain curtain", "Rain & Drops", "cos(x * density * 2 + (y+t*speed) * density)"),
    ("Double drops", "Rain & Drops", "sin(hypot(x-W/3, (y+t*speed)%H-H/2)*density) * cos(hypot(x-2*W/3, (y+t*speed*1.3)%H-H/2)*density)"),
    ("Impact ripple", "Rain & Drops", "cos(hypot(x-W/2, y-H/2)*density - t*speed)"),
    ("Puddle rings", "Rain & Drops", "sin(hypot(x-W/2, y-H/2*1.3)*density - t*speed) * cos((x+y)*density*0.2)"),
    ("Orbiting droplet", "Rain & Drops", "sin(hypot(x-W/2-sin(t*speed)*W/4, y-H/2-cos(t*speed)*H/4)*density)"),
    ("Splash crown", "Rain & Drops", "cos(abs(x-W/2)*density + abs(y-H/3)*density + t*speed)"),
    ("Dripping edge", "Rain & Drops", "sin((x+sin(t*speed)*W/5)*density) * cos(y*density - t*speed)"),
    ("Waterfall ribbons", "Rain & Drops", "cos((x+sin(y*0.3+t*speed)*2)*density)"),
    ("Rain on glass", "Rain & Drops", "sin(x*density + sin(y*0.4+t*speed)) * cos(y*density)"),
    ("Storm diagonals", "Rain & Drops", "sin((x+y*0.75)*density - t*speed*2) * cos((x-y)*density*0.3)"),
    ("Fine drizzle", "Rain & Drops", "cos(x*density*2 + t*speed) * sin(y*density*0.35)"),
    ("Twin ripple pools", "Rain & Drops", "sin(hypot(x-W/3,y-H/2)*density-t*speed) + cos(hypot(x-2*W/3,y-H/2)*density-t*speed)"),
    ("Drop lattice", "Rain & Drops", "sin((x-W/2)*(y-H/2)*density + t*speed)"),
    ("Flowing stream", "Rain & Drops", "cos((x+abs(y-H/2)*0.35)*density - t*speed)"),
    ("Circular splash", "Rain & Drops", "sin(hypot(x-W/2,y-H/2)*density + cos(t*speed))"),
    ("Twin drip", "Rain & Drops", "cos((x-W/3)*density + (y+t*speed)%H) + cos((x-2*W/3)*density + (y+t*speed*1.2)%H)"),
    ("Drip pulse", "Rain & Drops", "sin((y+t*speed)*density) * cos(x*density + sin(t*speed))"),
    ("Crossing puddle waves", "Rain & Drops", "cos((x+y)*density - t*speed) * sin((x-y)*density*0.5)"),
    ("Rain grid", "Rain & Drops", "sin(x*density+t*speed) * cos(y*density-t*speed) * sin((x+y)*density*0.4)"),
    ("Water curtain", "Rain & Drops", "sin(y*density + sin(x*density+t*speed)*2)"),
    ("Splash orbit", "Rain & Drops", "cos(hypot(x-W/2-sin(t*speed)*W/5, y-H/2-cos(t*speed)*H/5)*density)"),
]

PALETTES = [
    ("Neon", 0.0, 1.0),
    ("Ocean", 0.7, 0.8),
    ("Sunset", 1.3, 1.15),
    ("Aurora", 2.1, 0.9),
    ("Candy", 2.8, 0.72),
    ("Ember", 3.5, 1.3),
    ("Ice", 4.2, 0.85),
    ("Solar", 5.0, 1.1),
    ("Cyber", 5.7, 1.55),
    ("Forest", 0.45, 0.62),
    ("Violet", 1.85, 1.35),
    ("Retro", 3.1, 0.75),
    ("Prism", 3.9, 1.7),
    ("Cosmic", 4.8, 1.05),
    ("Gold", 5.45, 1.4),
]

_FORMULA_TEMPLATES = [
    ("Flowing ribbon", "Waves", "sin(x*density*{f} + sin(y*density*{q} + t*speed*{s}))"),
    ("Diagonal wash", "Waves", "cos((x*{f}+y*{q})*density - t*speed*{s} + {phase})"),
    ("Crossed currents", "Waves", "sin(x*density*{f}+t*speed*{s}) * cos(y*density*{q}-t*speed*{p})"),
    ("Folded wave", "Waves", "sin((x+y*{q})*density*{f} + cos(y*density*{s}+t*speed*{p}))"),
    ("Elliptic pulse", "Radial", "sin(hypot((x-W*{cx})*{f},(y-H*{cy})*{aspect})*density-t*speed*{s})"),
    ("Offset rings", "Radial", "cos(hypot(x-W*{cx},y-H*{cy})*density*{f}+sin(t*speed*{s}))"),
    ("Woven radial", "Radial", "sin(hypot(x-W/2,y-H/2)*density*{f})*cos((x-W/2)*(y-H/2)*density*{q}+t*speed*{s})"),
    ("Orbiting field", "Radial", "cos(hypot(x-W/2-sin(t*speed*{s})*W*{aspect},y-H/2-cos(t*speed*{s})*H*{cx})*density*{f})"),
    ("Weighted diamond", "Geometry", "sin((abs(x-W*{cx})+abs(y-H*{cy})*{q})*density*{f}-t*speed*{s})"),
    ("Warped lattice", "Geometry", "sin((x-W/2)*(y-H/2)*density*{f}+t*speed*{s})"),
    ("Parabolic grid", "Geometry", "cos((x-W/2)**2*density*{f}+(y-H/2)*density*{q}-t*speed*{s})"),
    ("Checker warp", "Geometry", "sin(x*density*{f}+sin(y*density*{q}))*cos(y*density*{s}+x*{p})"),
    ("Diagonal beat", "Interference", "sin((x+y)*density*{f})+cos((x-y)*density*{q}+t*speed*{s})"),
    ("Cross modulation", "Interference", "sin(x*density*{f}+t*speed*{s})*sin(y*density*{q}+t*speed*{p})"),
    ("Ring interference", "Interference", "cos(hypot(x-W/2,y-H/2)*density*{f})+sin((x+y)*density*{q}+t*speed*{s})"),
    ("Nested interference", "Interference", "sin(x*density*{f}+cos(y*density*{q}))+cos(y*density*{s}-t*speed*{p})"),
    ("Rain columns", "Rain & Drops", "cos(x*density*{f}+((y+t*speed*{s})%H)*{q})"),
    ("Falling drop body", "Rain & Drops", "cos(hypot(x-W*{cx},((y+t*speed*{s})%H-H/2)*{aspect})*density*{f})"),
    ("Windblown streaks", "Rain & Drops", "sin((x+(y+t*speed*{s})*{q})*density*{f})"),
    ("Splash spokes", "Rain & Drops", "cos(abs(x-W*{cx})*density*{f}+abs(y-H*{cy})*density*{q}-t*speed*{s})"),
    ("Impact droplets", "Rain & Drops", "cos(hypot(x-W*{cx},y-H*{cy})*density*{f}-t*speed*{s})*cos((y+t*speed*{p})%H)"),
    ("Flowing water", "Rain & Drops", "sin((y+t*speed*{s})*density*{f})*cos(x*density*{q}+sin(t*speed*{p}))"),
    ("Orbiting grains", "Particles", "sin(hypot(x-W*{cx},y-H*{cy})*density*{f}-t*speed*{s})*cos((x+y)*density*{q})"),
    ("Particle crossfield", "Particles", "sin((x-W*{cx})*density*{f})*cos((y-H*{cy})*density*{q}-t*speed*{s})"),
    ("Particle halo", "Particles", "cos(hypot(x-W/2,y-H/2)*density*{f}+t*speed*{s})*sin((x*{p}+y*{q})*density)"),
    ("Drifting particles", "Particles", "sin((x+y*{q})*density*{f}+t*speed*{s})*cos((x-y*{p})*density)"),
    ("Spiral current", "Spiral & Orbit", "sin(hypot(x-W/2,y-H/2)*density*{f}-t*speed*{s}+cos((x-y)*density*{q}))"),
    ("Twisting orbit", "Spiral & Orbit", "cos((x-W/2)*density*{f}+(y-H/2)*density*{q}+sin(t*speed*{s}))"),
    ("Offset spiral", "Spiral & Orbit", "sin((x-W*{cx})*density*{f}+cos((y-H*{cy})*density*{q}+t*speed*{s}))"),
    ("Comet orbit", "Spiral & Orbit", "cos(hypot(x-W/2-sin(t*speed*{s})*W*{cx},y-H/2-cos(t*speed*{s})*H*{cy})*density*{f}+(x+y)*density*{q})"),
]


def _expanded_shapes() -> list[tuple[str, str, str]]:
    shapes = list(SHAPES)
    for template_name, category, template in _FORMULA_TEMPLATES:
        for variant in range(1, 21):
            values = {
                "f": f"{0.35 + variant * 0.065:.2f}",
                "q": f"{0.18 + (variant * 3 % 13) * 0.085:.2f}",
                "s": f"{0.25 + (variant % 9) * 0.13:.2f}",
                "p": f"{0.12 + (variant * 5 % 9) * 0.1:.2f}",
                "cx": f"{0.1 + (variant * 3 % 9) * 0.1:.2f}",
                "cy": f"{0.1 + (variant * 5 % 9) * 0.1:.2f}",
                "aspect": f"{0.4 + (variant % 8) * 0.15:.2f}",
                "phase": f"{(variant - 1) * 0.31:.2f}",
            }
            shapes.append((
                f"{template_name} {variant:02d}",
                category,
                template.format(**values),
            ))
    return shapes


def _palette_formulas(phase: float, frequency: float) -> dict[str, str]:
    return {
        "red": f"127.5 + 127.5 * sin(v * {frequency:.2f} + t * colorSpeed + {phase:.3f})",
        "green": f"127.5 + 127.5 * sin(v * {frequency:.2f} + t * colorSpeed + {phase + 2.094:.3f})",
        "blue": f"127.5 + 127.5 * sin(v * {frequency:.2f} + t * colorSpeed + {phase + 4.188:.3f})",
    }


def math_palette_catalog() -> list[dict]:
    return [
        {"name": name, "color_formulas": _palette_formulas(phase, frequency)}
        for name, phase, frequency in PALETTES
    ]


def math_preset_catalog() -> list[dict]:
    presets = []
    palette_name, phase, frequency = PALETTES[0]
    for shape_index, (shape_name, category, formula) in enumerate(_expanded_shapes(), start=1):
        presets.append({
            "id": f"{shape_index:04d}",
            "name": shape_name,
            "effect": shape_name,
            "category": category,
            "palette": palette_name,
            "formula": formula,
            "params": {"speed": 0.3, "density": 0.4, "colorSpeed": 0.12},
            "color_mode": "formula",
            "mask_shape": False,
            "color_formulas": _palette_formulas(phase, frequency),
        })
    return presets

