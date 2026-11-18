"""Five-scene ripple show for vertical-string Pixel LED Toran matrices.

Scenes (equal length, each fades in/out so the full show loops seamlessly):
  1. Multi-Band Sine Wave        4. Top-Border Rectangular Pulse
  2. Concentric Diamond Ripple   5. Diagonal Chevron Wave
  3. Multi-Point Water Drop Ripples

Studio: loads automatically as a plugin (params: scene 0 = full show, 1-5 = single scene loop).
CLI (LedEdit / Wi-Fi controller export, 40x25 @ 30 FPS, 60 s):
  python toran_ripple_show.py -o toran_ripple_show.avi
"""

import math

import numpy as np

PLUGIN_NAME = "Toran Ripple Show (5 Scenes)"
DEFAULT_PARAMS = {"scene": 0, "seconds": 60, "fade": 0.5}

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
    """p is the loop phase in [0, 1)."""
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


def _fade_level(local, length, fade_frames):
    if fade_frames <= 0:
        return 1.0
    return min(1.0, (local + 1) / (fade_frames + 1), (length - local) / (fade_frames + 1))


def render_show(W, H, FPS, seconds=60.0, scene=0, fade=0.5):
    """Return uint8 RGB frames (H, W, 3); scene 0 renders all five scenes back to back."""
    total = max(1, round(seconds * FPS))
    if scene:
        render = SCENES[int(scene) - 1]
        return [render(W, H, index / total, index) for index in range(total)]
    frames = []
    bounds = [round(total * index / len(SCENES)) for index in range(len(SCENES) + 1)]
    for scene_index, render in enumerate(SCENES):
        length = bounds[scene_index + 1] - bounds[scene_index]
        fade_frames = min(round(fade * FPS), length // 2)
        for local in range(length):
            frame = render(W, H, local / length, bounds[scene_index] + local)
            level = _fade_level(local, length, fade_frames)
            if level < 1.0:
                frame = (frame.astype(np.uint16) * round(level * 256) >> 8).astype(np.uint8)
            frames.append(frame)
    return frames


def generate(W, H, FPS, params):
    scene = int(params.get("scene", 0))
    if not 0 <= scene <= len(SCENES):
        raise ValueError(f"scene must be 0 (full show) or 1-{len(SCENES)}.")
    seconds = float(params.get("seconds", 60))
    seconds = min(max(seconds, 1.0), 2400 / max(FPS, 1))
    return render_show(W, H, FPS, seconds, scene, float(params.get("fade", 0.5)))


def _chunk(tag, payload):
    import struct

    return tag + struct.pack("<I", len(payload)) + payload + (b"\0" if len(payload) & 1 else b"")


def _frame_payloads(frames, codec):
    if codec == "mjpg":
        import cv2

        params = [cv2.IMWRITE_JPEG_QUALITY, 100, cv2.IMWRITE_JPEG_SAMPLING_FACTOR, cv2.IMWRITE_JPEG_SAMPLING_FACTOR_444]
        for frame in frames:
            encoded, jpeg = cv2.imencode(".jpg", cv2.cvtColor(frame, cv2.COLOR_RGB2BGR), params)
            if not encoded:
                raise RuntimeError("OpenCV could not encode an MJPG frame.")
            yield jpeg.tobytes()
        return
    width = frames[0].shape[1]
    padding = b"\0" * (((width * 3 + 3) & ~3) - width * 3)
    for frame in frames:
        rows = np.ascontiguousarray(frame[::-1, :, ::-1])
        yield b"".join(row.tobytes() + padding for row in rows)


def write_avi(frames, path, fps, codec="raw"):
    """Write an AVI at the exact frame size.

    raw: uncompressed 24-bit RGB (lossless, crisp pixels). mjpg: 4:4:4 JPEG at quality 100.
    """
    import struct

    height, width = frames[0].shape[:2]
    payloads = list(_frame_payloads(frames, codec))
    size = max(map(len, payloads))
    count = len(payloads)
    handler, compression, tag = (b"MJPG", int.from_bytes(b"MJPG", "little"), b"00dc") if codec == "mjpg" \
        else (b"DIB ", 0, b"00db")
    main_header = struct.pack("<14I", round(1_000_000 / fps), size * fps, 0, 0x10, count, 0, 1, size,
                              width, height, 0, 0, 0, 0)
    stream_header = struct.pack("<4s4sIHH8I4h", b"vids", handler, 0, 0, 0, 0, 1, fps, 0, count, size,
                                0xFFFFFFFF, 0, 0, 0, width, height)
    bitmap_header = struct.pack("<IiiHHIIiiII", 40, width, height, 1, 24, compression,
                                size if codec == "raw" else 0, 0, 0, 0, 0)
    headers = _chunk(b"LIST", b"hdrl" + _chunk(b"avih", main_header) + _chunk(
        b"LIST", b"strl" + _chunk(b"strh", stream_header) + _chunk(b"strf", bitmap_header)))
    chunks, index, offset = [], [], 4
    for payload in payloads:
        chunks.append(_chunk(tag, payload))
        index.append(struct.pack("<4sIII", tag, 0x10, offset, len(payload)))
        offset += len(chunks[-1])
    body = b"AVI " + headers + _chunk(b"LIST", b"movi" + b"".join(chunks)) + _chunk(b"idx1", b"".join(index))
    with open(path, "wb") as handle:
        handle.write(b"RIFF" + struct.pack("<I", len(body)) + body)


def main(argv=None):
    import argparse

    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("-o", "--output", default="toran_ripple_show.avi")
    parser.add_argument("--width", type=int, default=40, help="vertical lines (default 40)")
    parser.add_argument("--height", type=int, default=25, help="LEDs per line (default 25)")
    parser.add_argument("--fps", type=int, default=30)
    parser.add_argument("--seconds", type=float, default=60)
    parser.add_argument("--scene", type=int, default=0, choices=range(0, len(SCENES) + 1),
                        help="0 = full 5-scene show, 1-5 = single scene loop")
    parser.add_argument("--fade", type=float, default=0.5, help="fade in/out seconds per scene")
    parser.add_argument("--codec", choices=("raw", "mjpg"), default="raw",
                        help="raw = uncompressed, lossless crisp pixels (default); mjpg = smaller 4:4:4 JPEG frames")
    args = parser.parse_args(argv)
    frames = render_show(args.width, args.height, args.fps, args.seconds, args.scene, args.fade)
    write_avi(frames, args.output, args.fps, args.codec)
    print(f"Wrote {args.output}: {len(frames)} frames, {args.width}x{args.height} @ {args.fps} FPS")


if __name__ == "__main__":
    main()
