"""Write small RGB animation sequences as compressed SWF timelines."""

from __future__ import annotations

import re
import struct
import uuid
import zlib
from pathlib import Path
from typing import Iterable

import numpy as np

EXPORT_DIR = Path(__file__).resolve().parent.parent / "exports"
TWIPS_PER_PIXEL = 20
MAX_SWF_BYTES = 64 * 1024 * 1024


class _BitWriter:
    def __init__(self) -> None:
        self.data = bytearray()
        self.value = 0
        self.count = 0

    def write(self, value: int, count: int) -> None:
        for shift in range(count - 1, -1, -1):
            self.value = (self.value << 1) | ((value >> shift) & 1)
            self.count += 1
            if self.count == 8:
                self.data.append(self.value)
                self.value = 0
                self.count = 0

    def write_signed(self, value: int, count: int) -> None:
        self.write(value & ((1 << count) - 1), count)

    def finish(self) -> bytes:
        if self.count:
            self.data.append(self.value << (8 - self.count))
            self.value = 0
            self.count = 0
        return bytes(self.data)


def _signed_bits(value: int) -> int:
    bits = 1
    while not -(1 << (bits - 1)) <= value < (1 << (bits - 1)):
        bits += 1
    return max(2, bits)


def _rect(x_min: int, x_max: int, y_min: int, y_max: int) -> bytes:
    values = (x_min, x_max, y_min, y_max)
    bits = max(_signed_bits(value) for value in values)
    writer = _BitWriter()
    writer.write(bits, 5)
    for value in values:
        writer.write_signed(value, bits)
    return writer.finish()


def _tag(code: int, payload: bytes = b"") -> bytes:
    length = len(payload)
    if length < 63:
        return struct.pack("<H", (code << 6) | length) + payload
    return struct.pack("<HI", (code << 6) | 63, length) + payload


def _select_fill_and_move(writer: _BitWriter, fill_index: int, x: int, y: int, fill_bits: int) -> None:
    bits = max(_signed_bits(x), _signed_bits(y))
    writer.write(0, 1)
    writer.write(0x05, 5)
    writer.write(bits, 5)
    writer.write_signed(x, bits)
    writer.write_signed(y, bits)
    writer.write(fill_index, fill_bits)


def _straight_edge(writer: _BitWriter, dx: int, dy: int) -> None:
    delta = dy if dx == 0 else dx
    bits = _signed_bits(delta)
    writer.write(1, 1)
    writer.write(1, 1)
    writer.write(bits - 2, 4)
    writer.write(0, 1)
    writer.write(1 if dx == 0 else 0, 1)
    writer.write_signed(delta, bits)


def _shape_tag(frame: np.ndarray, character_id: int) -> bytes | None:
    height, width = frame.shape[:2]
    color_rows = []
    palette = set()
    for row in frame:
        colors = [tuple(int(channel) for channel in pixel) for pixel in row]
        color_rows.append(colors)
        palette.update(color for color in colors if color != (0, 0, 0))
    if not palette:
        return None

    ordered_colors = sorted(palette)
    fill_indices = {color: index + 1 for index, color in enumerate(ordered_colors)}
    fill_bits = max(1, len(ordered_colors).bit_length())
    shape = bytearray(struct.pack("<H", character_id))
    shape.extend(_rect(0, width * TWIPS_PER_PIXEL, 0, height * TWIPS_PER_PIXEL))
    if len(ordered_colors) < 255:
        shape.append(len(ordered_colors))
    else:
        shape.extend(b"\xff")
        shape.extend(struct.pack("<H", len(ordered_colors)))
    for red, green, blue in ordered_colors:
        shape.extend((0x00, red, green, blue, 0xFF))
    shape.append(0)

    records = _BitWriter()
    records.write(fill_bits, 4)
    records.write(0, 4)
    for y, row in enumerate(color_rows):
        x = 0
        while x < width:
            color = row[x]
            if color == (0, 0, 0):
                x += 1
                continue
            end = x + 1
            while end < width and row[end] == color:
                end += 1
            _select_fill_and_move(
                records,
                fill_indices[color],
                x * TWIPS_PER_PIXEL,
                y * TWIPS_PER_PIXEL,
                fill_bits,
            )
            run_width = (end - x) * TWIPS_PER_PIXEL
            _straight_edge(records, 0, TWIPS_PER_PIXEL)
            _straight_edge(records, run_width, 0)
            _straight_edge(records, 0, -TWIPS_PER_PIXEL)
            _straight_edge(records, -run_width, 0)
            x = end
    records.write(0, 6)
    shape.extend(records.finish())
    return _tag(32, bytes(shape))


def _place_object2(character_id: int, depth: int = 1) -> bytes:
    matrix = b"\x00"
    return _tag(26, b"\x06" + struct.pack("<HH", depth, character_id) + matrix)


def _remove_object2(depth: int = 1) -> bytes:
    return _tag(28, struct.pack("<H", depth))


def _validate_frames(frames: list[np.ndarray], fps: int) -> tuple[int, int]:
    if not frames:
        raise ValueError("Cannot export an empty animation.")
    if not 1 <= fps <= 60:
        raise ValueError("FPS must be between 1 and 60.")
    first = frames[0]
    if first.ndim != 3 or first.shape[2] != 3 or first.dtype != np.uint8:
        raise ValueError("SWF frames must be uint8 RGB arrays.")
    height, width = first.shape[:2]
    if not 1 <= width <= 120 or not 1 <= height <= 80:
        raise ValueError("SWF grid dimensions must be between 1×1 and 120×80.")
    if len(frames) > 65535:
        raise ValueError("SWF animations cannot exceed 65,535 frames.")
    for frame in frames:
        if frame.shape != first.shape or frame.dtype != np.uint8:
            raise ValueError("All SWF frames must have the same uint8 RGB dimensions.")
    return width, height


def export_swf(frames: Iterable[np.ndarray], fps: int, name: str = "toran") -> Path:
    """Write a compressed SWF with one vector-pixel shape per animation frame."""
    frame_list = list(frames)
    width, height = _validate_frames(frame_list, fps)
    body = bytearray(_rect(
        0,
        width * TWIPS_PER_PIXEL,
        0,
        height * TWIPS_PER_PIXEL,
    ))
    body.extend(struct.pack("<HH", fps << 8, len(frame_list)))
    body.extend(_tag(9, b"\x00\x00\x00"))

    character_id = 1
    placed = False
    for frame in frame_list:
        shape = _shape_tag(frame, character_id)
        if placed:
            body.extend(_remove_object2())
            placed = False
        if shape is not None:
            body.extend(shape)
            body.extend(_place_object2(character_id))
            character_id += 1
            placed = True
        body.extend(_tag(1))
        if len(body) > MAX_SWF_BYTES:
            raise ValueError("SWF animation exceeds 64 MB. Reduce the resolution or animation duration.")
    body.extend(_tag(0))

    swf_length = len(body) + 8
    output = b"CWS" + bytes((8,)) + struct.pack("<I", swf_length) + zlib.compress(bytes(body), level=6)
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    safe_name = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "toran"
    output_path = EXPORT_DIR / f"{safe_name[:48]}-{uuid.uuid4().hex[:8]}.swf"
    output_path.write_bytes(output)
    if not output_path.is_file() or output_path.stat().st_size == 0:
        raise RuntimeError("SWF export did not produce a readable output file.")
    return output_path
