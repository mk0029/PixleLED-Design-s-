"""Resolution-independent RGB effect and safe mathematical frame generators."""

from __future__ import annotations

import ast
import colorsys
import math
import operator
import random
import re

import numpy as np

from effect_presets import SCENE_PRESETS
from toran_scenes import SCENE_KINDS as TORAN_SCENE_KINDS

DEFAULT_WIDTH = 30
DEFAULT_HEIGHT = 20
DEFAULT_FPS = 20
TORAN_SCENE_LOOP_SECONDS = 12

PATTERNS = {key: str(preset["name"]) for key, preset in SCENE_PRESETS.items()}
PATTERNS.update({"text": "5×7 Bitmap Scrolling Text", "custom": "Pixel Draw", "math": "Math Lab"})
PATTERN_FAMILIES = {key: str(preset["family"]) for key, preset in SCENE_PRESETS.items()}
PATTERN_FAMILIES.update({"text": "Custom Typography"})

_FONT = {
    "A": ("01110", "10001", "10001", "11111", "10001", "10001", "10001"),
    "B": ("11110", "10001", "10001", "11110", "10001", "10001", "11110"),
    "C": ("01111", "10000", "10000", "10000", "10000", "10000", "01111"),
    "D": ("11110", "10001", "10001", "10001", "10001", "10001", "11110"),
    "E": ("11111", "10000", "10000", "11110", "10000", "10000", "11111"),
    "F": ("11111", "10000", "10000", "11110", "10000", "10000", "10000"),
    "G": ("01111", "10000", "10000", "10111", "10001", "10001", "01111"),
    "H": ("10001", "10001", "10001", "11111", "10001", "10001", "10001"),
    "I": ("11111", "00100", "00100", "00100", "00100", "00100", "11111"),
    "J": ("00111", "00010", "00010", "00010", "10010", "10010", "01100"),
    "K": ("10001", "10010", "10100", "11000", "10100", "10010", "10001"),
    "L": ("10000", "10000", "10000", "10000", "10000", "10000", "11111"),
    "M": ("10001", "11011", "10101", "10101", "10001", "10001", "10001"),
    "N": ("10001", "11001", "10101", "10011", "10001", "10001", "10001"),
    "O": ("01110", "10001", "10001", "10001", "10001", "10001", "01110"),
    "P": ("11110", "10001", "10001", "11110", "10000", "10000", "10000"),
    "Q": ("01110", "10001", "10001", "10001", "10101", "10010", "01101"),
    "R": ("11110", "10001", "10001", "11110", "10100", "10010", "10001"),
    "S": ("01111", "10000", "10000", "01110", "00001", "00001", "11110"),
    "T": ("11111", "00100", "00100", "00100", "00100", "00100", "00100"),
    "U": ("10001", "10001", "10001", "10001", "10001", "10001", "01110"),
    "V": ("10001", "10001", "10001", "10001", "10001", "01010", "00100"),
    "W": ("10001", "10001", "10001", "10101", "10101", "10101", "01010"),
    "X": ("10001", "10001", "01010", "00100", "01010", "10001", "10001"),
    "Y": ("10001", "10001", "01010", "00100", "00100", "00100", "00100"),
    "Z": ("11111", "00001", "00010", "00100", "01000", "10000", "11111"),
    "0": ("01110", "10001", "10011", "10101", "11001", "10001", "01110"),
    "1": ("00100", "01100", "00100", "00100", "00100", "00100", "01110"),
    "2": ("01110", "10001", "00001", "00010", "00100", "01000", "11111"),
    "3": ("11110", "00001", "00001", "01110", "00001", "00001", "11110"),
    "4": ("00010", "00110", "01010", "10010", "11111", "00010", "00010"),
    "5": ("11111", "10000", "10000", "11110", "00001", "00001", "11110"),
    "6": ("01110", "10000", "10000", "11110", "10001", "10001", "01110"),
    "7": ("11111", "00001", "00010", "00100", "01000", "01000", "01000"),
    "8": ("01110", "10001", "10001", "01110", "10001", "10001", "01110"),
    "9": ("01110", "10001", "10001", "01111", "00001", "00001", "01110"),
    " ": ("00000",) * 7,
    "!": ("00100", "00100", "00100", "00100", "00100", "00000", "00100"),
    "-": ("00000", "00000", "00000", "11111", "00000", "00000", "00000"),
    ".": ("00000", "00000", "00000", "00000", "00000", "00110", "00110"),
    "&": ("01100", "10010", "10100", "01000", "10101", "10010", "01101"),
}
_BINARY = {ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul,
           ast.Div: operator.truediv, ast.Pow: operator.pow, ast.Mod: operator.mod}
_UNARY = {ast.UAdd: operator.pos, ast.USub: operator.neg}
_FUNCTIONS = {"sin": math.sin, "cos": math.cos, "hypot": math.hypot, "abs": abs}


def _validate_formula(expression: str) -> ast.Expression:
    if not isinstance(expression, str) or not expression.strip() or len(expression) > 256:
        raise ValueError("Formula must contain 1–256 characters.")
    try:
        parsed = ast.parse(expression, mode="eval")
    except SyntaxError as error:
        raise ValueError(f"Invalid math formula: {error.msg}.") from error
    nodes = list(ast.walk(parsed))
    allowed = (ast.Expression, ast.Constant, ast.Name, ast.Load, ast.BinOp, ast.UnaryOp,
               ast.Call, *_BINARY, *_UNARY)
    if len(nodes) > 100 or any(not isinstance(node, allowed) for node in nodes):
        raise ValueError("Formula contains an unsupported or overly complex operation.")
    for node in nodes:
        if isinstance(node, ast.Call):
            if not isinstance(node.func, ast.Name) or node.func.id not in (*_FUNCTIONS, "rand") or node.keywords:
                raise ValueError("Formula calls may only use sin, cos, hypot, abs, and rand().")
            if node.func.id == "rand" and node.args or node.func.id in ("sin", "cos", "abs") and len(node.args) != 1:
                raise ValueError(f"Invalid argument count for {node.func.id}().")
            if node.func.id == "hypot" and len(node.args) < 2:
                raise ValueError("hypot() accepts at least two arguments.")
        if isinstance(node, ast.Constant) and (isinstance(node.value, bool) or not isinstance(node.value, (int, float))):
            raise ValueError("Formula constants must be numbers.")
    return parsed


def _eval(node: ast.AST, variables: dict[str, float], rng: random.Random) -> float:
    if isinstance(node, ast.Expression):
        return _eval(node.body, variables, rng)
    if isinstance(node, ast.Constant):
        return float(node.value)
    if isinstance(node, ast.Name):
        if node.id not in variables:
            raise ValueError(f"Unknown formula variable: {node.id}.")
        return variables[node.id]
    if isinstance(node, ast.UnaryOp) and type(node.op) in _UNARY:
        return _UNARY[type(node.op)](_eval(node.operand, variables, rng))
    if isinstance(node, ast.BinOp) and type(node.op) in _BINARY:
        left, right = _eval(node.left, variables, rng), _eval(node.right, variables, rng)
        if isinstance(node.op, ast.Pow) and abs(right) > 16:
            raise ValueError("Formula powers must have exponents between -16 and 16.")
        return _BINARY[type(node.op)](left, right)
    if isinstance(node, ast.Call):
        values = [_eval(arg, variables, rng) for arg in node.args]
        return rng.random() if node.func.id == "rand" else _FUNCTIONS[node.func.id](*values)
    raise ValueError("Formula contains an unsupported operation.")


def generate_math_frames(
    formula: str, width: int = DEFAULT_WIDTH, height: int = DEFAULT_HEIGHT,
    fps: int = DEFAULT_FPS, frame_count: int = 12, params: object = None,
    color: object = None, color_formulas: object = None, color_mode: str = "formula",
    seed: object = None, mask_shape: object = None,
) -> list[np.ndarray]:
    if not 1 <= width <= 120 or not 1 <= height <= 80 or not 1 <= fps <= 60 or not 1 <= frame_count <= 2400:
        raise ValueError("Dimensions, FPS, or frame count are outside supported limits.")
    if color_mode not in {"custom", "formula", "random", "rainbow"}:
        raise ValueError("Color source must be custom, formula, random, or rainbow.")
    parsed = _validate_formula(formula)
    formulas = color_formulas or {
        "red": "127.5 + 127.5*sin(v+t*colorSpeed)",
        "green": "127.5 + 127.5*sin(v+t*colorSpeed+2.094)",
        "blue": "127.5 + 127.5*sin(v+t*colorSpeed+4.188)",
    }
    if not isinstance(formulas, dict):
        raise ValueError("Color formulas must be an object.")
    parsed_colors = {channel: _validate_formula(formulas[channel]) for channel in ("red", "green", "blue")} if color_mode == "formula" else {}
    if params is None:
        params = {}
    if not isinstance(params, dict) or len(params) > 16:
        raise ValueError("Formula parameters must be an object with at most 16 numeric values.")
    values = {}
    for key, value in params.items():
        if not isinstance(key, str) or not re.fullmatch(r"[A-Za-z][A-Za-z0-9_]{0,31}", key):
            raise ValueError("Formula parameter names must be valid identifiers.")
        if key in {"x", "y", "t", "v", "W", "H", "hue", "pi", "e", *_FUNCTIONS, "rand"}:
            raise ValueError(f"Formula parameter name is reserved: {key}.")
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
            raise ValueError(f"Formula parameter {key} must be finite.")
        values[key] = float(value)
    values.setdefault("colorSpeed", 0.12)
    rgb = color if isinstance(color, (list, tuple)) and len(color) == 3 else (255, 255, 255)
    randomizer = random.Random(seed)
    frames = []
    for t in range(frame_count):
        frame = np.zeros((height, width, 3), dtype=np.uint8)
        random_rgb = tuple(randomizer.randint(96, 255) for _ in range(3))
        for y in range(height):
            for x in range(width):
                variables = {**values, "x": x, "y": y, "t": t, "W": width, "H": height,
                             "pi": math.pi, "e": math.e}
                try:
                    value = _eval(parsed, variables, randomizer)
                    if not math.isfinite(value):
                        raise ValueError("Formula produced a non-finite value.")
                    if color_mode == "custom":
                        channels = tuple(max(0, min(255, int(channel))) for channel in rgb)
                    elif color_mode == "random":
                        channels = random_rgb
                    elif color_mode == "rainbow":
                        channels = tuple(round(component * 255) for component in colorsys.hsv_to_rgb((value * 0.12 + t * values["colorSpeed"]) % 1, 1, 1))
                    else:
                        variables["v"] = value
                        channels = tuple(max(0, min(255, round(_eval(parsed_colors[channel], variables, randomizer))))
                                         for channel in ("red", "green", "blue"))
                    brightness = (math.tanh(value) + 1) / 2 if mask_shape else 1
                    frame[y, x] = tuple(round(channel * brightness) for channel in channels)
                except (ArithmeticError, OverflowError) as error:
                    raise ValueError(f"Formula failed at frame {t}, pixel ({x}, {y}): {error}.") from error
        frames.append(frame)
    return frames


def _text_frame(options: dict[str, object], width: int, height: int, index: int, speed: float) -> np.ndarray:
    text = str(options.get("text", "TORAN"))[:64].upper() or "TORAN"
    glyphs = []
    for char in text:
        glyphs.extend((_FONT.get(char, _FONT[" "]), ("00000",)))
    bitmap = np.asarray([[int(bit) for glyph in glyphs for bit in glyph[row]] for row in range(7)], dtype=np.uint8)
    if options.get("double_height"):
        bitmap = np.repeat(bitmap, 2, axis=0)
    frame = np.zeros((height, width, 3), dtype=np.uint8)
    offset = width - round(index * speed)
    top = max(0, (height - bitmap.shape[0]) // 2)
    color = options.get("color", [0, 168, 255])
    if not isinstance(color, (list, tuple)) or len(color) != 3:
        color = [0, 168, 255]
    for x in range(width):
        source_x = x - offset
        if not 0 <= source_x < bitmap.shape[1]:
            continue
        for y in range(min(bitmap.shape[0], height)):
            if top + y < height and bitmap[y, source_x]:
                frame[top + y, x] = color
        if options.get("background_chase") and (x + index) % max(2, width // 6) == 0:
            frame[:, x] = np.maximum(frame[:, x], [28, 38, 56])
    return frame


def _render_toran_scene(preset: dict[str, object], width: int, height: int, fps: int, frame_count: int,
                        options: dict[str, object]) -> list[np.ndarray]:
    render = TORAN_SCENE_KINDS[str(preset["kind"])]
    direction = -1 if preset["modifier"] == "reverse-flow" else 1
    direction *= -1 if options.get("direction") == "reverse" else 1
    speed = max(0.01, min(8.0, float(options.get("speed", 1.0))))
    loop_frames = TORAN_SCENE_LOOP_SECONDS * fps / speed
    frames = []
    for frame_index in range(frame_count):
        frame = render(width, height, (direction * frame_index / loop_frames) % 1.0, frame_index)
        if preset["modifier"] == "mirror-symmetry":
            frame = np.maximum(frame, frame[:, ::-1])
        frames.append(frame)
    return frames


def _render_effect(preset: dict[str, object], width: int, height: int, frame_count: int,
                   options: dict[str, object]) -> list[np.ndarray]:
    kind = str(preset["kind"])
    modifier = str(preset["modifier_kind"])
    base_hue = float(preset["hue"])
    direction = -1 if preset["modifier"] == "reverse-flow" else 1
    direction *= -1 if options.get("direction") == "reverse" else 1
    speed = max(0.01, min(8.0, float(options.get("speed", 1.0))))
    density = max(0.05, min(8.0, float(options.get("density", 1.0))))
    amplitude = max(0.1, min(4.0, float(options.get("amplitude", 1.0))))
    hue_shift = float(options.get("hue_shift", 0)) / 360
    yy, xx = np.mgrid[0:height, 0:width]
    nx = xx / max(1, width - 1)
    ny = yy / max(1, height - 1)
    cx = (width - 1) / 2
    cy = (height - 1) / 2
    dx = (xx - cx) / max(1, min(width, height))
    dy = (yy - cy) / max(1, min(width, height))
    radius = np.hypot(dx, dy)
    angle = np.arctan2(dy, dx)
    frames = []
    for frame_index in range(frame_count):
        t = frame_index * speed * direction * 0.18
        phase = t * math.tau
        if kind in {"equalizer", "vu"}:
            bars = np.maximum(0.08, (0.25 + 0.75 * np.abs(np.sin(nx * (5 + density * 8) * math.pi + t * 1.7))) * amplitude)
            level = np.clip(bars * (1 if kind == "vu" else (0.85 + 0.15 * np.sin(t * 3))) * height, 1, height)
            field = np.where(height - yy <= level, 1.0 - (height - yy) / max(1, height) * 0.35, 0.03)
        elif kind == "matrix":
            stream = np.sin((np.floor(nx * width / max(1, density)) * 0.73) + t * 2 + ny * 11)
            field = np.where(stream > 0.45, np.clip(1 - ((ny * 6 + t * 2) % 1), 0.15, 1), 0.025)
        elif kind in {"comet", "waterfall", "stack", "zipper", "split", "rain", "curtain"}:
            if kind == "comet":
                field = np.maximum(0, 1 - np.abs(((ny * 1.8 + t) % 2) - 1) * 3) * (0.3 + .7 * np.abs(np.sin(nx * 17)))
            elif kind == "waterfall":
                field = np.maximum(0, np.cos((ny * 12 + t * 3 + np.floor(nx * 9)) * math.pi)) ** 4
            elif kind == "stack":
                field = ((np.floor(ny * (height + 1) + t * height) % 4) < 2).astype(float)
            elif kind == "zipper":
                field = (np.sin((ny * height + t * height) * math.pi + (xx % 2) * math.pi) > 0).astype(float)
            elif kind == "split":
                field = np.maximum(0, 1 - np.abs(nx - 0.5) * 2 - (ny + t) % 1)
            elif kind == "rain":
                field = (np.sin(np.floor(nx * width * 0.7) * 12.3 + ny * 23 - t * 8) > 0.93).astype(float)
            else:
                field = (nx < (t * 0.4) % 1).astype(float)
        elif kind in {"laser", "oscilloscope", "tunnel", "shockwave", "radar"}:
            if kind == "laser":
                beam = np.sin(angle * 3 - phase)
                field = np.maximum(0, 1 - np.abs(beam) * 16)
            elif kind == "oscilloscope":
                wave_y = 0.5 + 0.34 * np.sin(nx * math.tau * density + phase)
                field = np.maximum(0, 1 - np.abs(ny - wave_y) * height * 1.6)
            elif kind == "tunnel":
                field = np.maximum(0, np.sin(radius * 40 * density - phase * 2))
            elif kind == "shockwave":
                field = np.maximum(0, 1 - np.abs((radius * 24 - phase * 2) % 8 - 1) * 0.8)
            else:
                sweep = (angle / math.tau + 0.5 - t * 0.12) % 1
                field = np.maximum(0, 1 - sweep * 13) * (0.25 + 0.75 * np.abs(np.sin(radius * 45)))
        elif kind in {"diamond", "chevron", "helix", "plasma", "galaxy", "kaleidoscope", "checker", "interference", "rangoli", "lotus", "hearts"}:
            if kind == "diamond":
                field = np.maximum(0, np.sin((np.abs(dx) + np.abs(dy)) * 50 * density - phase))
            elif kind == "chevron":
                field = np.maximum(0, np.sin((ny + np.abs(nx - .5) * .8) * 25 * density - phase))
            elif kind == "helix":
                field = (np.sin(nx * math.tau * 2 + phase) > 0) * (np.abs(ny - (0.5 + .38 * np.sin(nx * math.tau * 2 + phase))) < .12)
            elif kind == "plasma":
                field = (np.sin(nx * 11 * density + np.sin(ny * 9 + phase) * 2 + phase) + np.cos(ny * 13 - phase)) / 2
            elif kind == "galaxy":
                field = np.sin(radius * 42 * density - angle * 3 + phase) * np.maximum(0, 1 - radius * 2)
            elif kind == "kaleidoscope":
                field = np.sin(radius * 40 * density + np.cos(angle * 6) * 4 + phase)
            elif kind == "checker":
                field = np.sin((xx + np.floor(t * 3)) * density * math.pi) * np.sin((yy + np.floor(t * 2)) * density * math.pi)
            elif kind == "rangoli":
                field = np.sin(radius * 50 * density + np.cos(angle * 8) * 3 + phase)
            elif kind == "lotus":
                field = np.sin(radius * 25 + np.cos(angle * 6 + phase) * 5)
            elif kind == "hearts":
                field = np.sin(12 * angle + phase) * np.maximum(0, 1 - radius * 3)
            else:
                field = np.sin((nx + ny) * 20 * density + phase) * np.cos((nx - ny) * 17 * density - phase)
        elif kind in {"fireworks", "diya", "sparkles", "tricolor"}:
            if kind == "fireworks":
                field = np.maximum(0, np.sin(radius * 45 - phase * 2)) * np.maximum(0, np.cos(angle * 8 + phase))
            elif kind == "diya":
                flame = np.abs(nx - .5 - np.sin(ny * 8 + phase) * .08)
                field = np.maximum(0, 1 - flame * 8) * np.clip(1 - ny + np.sin(phase) * .15, 0, 1)
            elif kind == "sparkles":
                field = (np.sin(np.floor(nx * width * .7) * 17 + np.floor(ny * height * .7) * 29 + phase * 3) > .84).astype(float)
            else:
                field = np.sin(ny * 9 + nx * 3 + phase)
        else:
            field = np.sin(nx * math.tau * density + phase) + np.cos(ny * math.tau * density - phase)

        if preset["modifier"] == "mirror-symmetry":
            field = np.maximum(field, np.fliplr(field))
        signal = np.clip((field * amplitude + 1) / 2, 0, 1)
        if kind in {"equalizer", "vu", "matrix", "rain", "sparkles", "checker"}:
            signal = np.clip(field, 0, 1)
        hue = base_hue + hue_shift
        if modifier == "rainbow":
            hue = nx * 0.72 + ny * 0.18 + t * 0.08 + hue_shift
        else:
            hue = hue + (signal - 0.5) * 0.12 + (nx if modifier in {"palette"} else 0) * 0.14
        if kind == "tricolor":
            hue = np.where(nx < 1 / 3, 0.34, np.where(nx < 2 / 3, 0.12, 0.58))
        hue = np.mod(hue, 1)
        saturation = np.full((height, width), 0.96)
        value = np.clip(0.12 + signal * 0.88, 0, 1)
        # Vectorized HSV conversion keeps full-resolution previews practical.
        h6 = hue * 6
        sector = np.floor(h6).astype(int) % 6
        fraction = h6 - np.floor(h6)
        p = value * (1 - saturation)
        q = value * (1 - fraction * saturation)
        r = value * (1 - (1 - fraction) * saturation)
        choices = np.stack([
            np.stack((value, r, p), axis=-1), np.stack((q, value, p), axis=-1),
            np.stack((p, value, r), axis=-1), np.stack((p, q, value), axis=-1),
            np.stack((r, p, value), axis=-1), np.stack((value, p, q), axis=-1),
        ])
        channels = np.take_along_axis(choices, sector[None, :, :, None], axis=0)[0]
        frames.append(np.clip(channels * 255, 0, 255).astype(np.uint8))
    return frames


def _custom_frame(source: object, width: int, height: int) -> np.ndarray:
    if not isinstance(source, list) or len(source) != height:
        raise ValueError(f"Each custom frame must contain exactly {height} rows.")
    frame = np.zeros((height, width, 3), dtype=np.uint8)
    for y, row in enumerate(source):
        if not isinstance(row, list) or len(row) != width:
            raise ValueError(f"Each custom frame row must contain exactly {width} pixels.")
        for x, pixel in enumerate(row):
            if pixel in (None, 0):
                continue
            if not isinstance(pixel, (list, tuple)) or len(pixel) != 3 or any(
                isinstance(channel, bool) or not isinstance(channel, (int, float)) or not 0 <= channel <= 255
                for channel in pixel
            ):
                raise ValueError("Custom sprite pixels must be RGB arrays or 0.")
            frame[y, x] = pixel
    return frame


def generate_frames(
    pattern: str, width: int = DEFAULT_WIDTH, height: int = DEFAULT_HEIGHT,
    fps: int = DEFAULT_FPS, frame_count: int = 48, **options: object,
) -> list[np.ndarray]:
    """Return uint8 RGB frames for a catalog effect, text, drawing, or math scene."""
    if not 1 <= width <= 120 or not 1 <= height <= 80:
        raise ValueError("Grid width must be 1–120 and height must be 1–80.")
    if not 1 <= fps <= 60 or not 1 <= frame_count <= 2400:
        raise ValueError("FPS must be 1–60 and frame count must be 1–2400.")
    if pattern == "math":
        return generate_math_frames(
            str(options.get("formula", "")), width, height, fps, frame_count,
            options.get("params"), options.get("color"), options.get("color_formulas"),
            str(options.get("color_mode", "formula")), options.get("seed"), options.get("mask_shape"),
        )
    preset = SCENE_PRESETS.get(pattern)
    if preset:
        if str(preset["kind"]) == "text":
            speed = float(options.get("speed", 1))
            return [_text_frame(options, width, height, index, speed) for index in range(frame_count)]
        if str(preset["kind"]) in TORAN_SCENE_KINDS:
            return _render_toran_scene(preset, width, height, fps, frame_count, options)
        return _render_effect(preset, width, height, frame_count, options)
    if pattern == "text":
        return [_text_frame(options, width, height, index, float(options.get("speed", 1))) for index in range(frame_count)]
    if pattern == "custom":
        custom = options.get("frames")
        if not isinstance(custom, list) or not custom:
            raise ValueError("Pixel Draw scenes need at least one painted frame.")
        return [_custom_frame(custom[index % len(custom)], width, height) for index in range(frame_count)]
    raise ValueError(f"Unknown pattern: {pattern}")


def pattern_catalog() -> list[dict[str, str]]:
    return [
        {"id": key, "name": str(preset["name"]), "family": str(preset["family"]),
         "base_name": str(preset["base_name"]), "modifier": str(preset["modifier_name"])}
        for key, preset in SCENE_PRESETS.items()
    ]
