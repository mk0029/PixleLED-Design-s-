"""Editable PNG/GIF animation collection packs."""

from __future__ import annotations

import io
import json
import re
import uuid
import zipfile
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from PIL import Image

EXPORT_DIR = Path(__file__).resolve().parent.parent / "exports"


def _safe_name(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-") or "animation"


def _png_bytes(frame: np.ndarray) -> bytes:
    if frame.dtype != np.uint8 or frame.ndim != 3 or frame.shape[2] != 3:
        raise ValueError("Animation frames must be uint8 RGB arrays.")
    encoded, buffer = cv2.imencode(".png", cv2.cvtColor(frame, cv2.COLOR_RGB2BGR))
    if not encoded:
        raise RuntimeError("Could not encode an animation frame as PNG.")
    return buffer.tobytes()


def export_animation_pack(
    category: str,
    animations: list[dict[str, Any]],
    fps: int = 20,
    width: int = 30,
    height: int = 8,
    output_dir: Path = EXPORT_DIR,
) -> Path:
    if category not in {"Animals", "Punjabi Bhangra"}:
        raise ValueError("Animation pack category must be Animals or Punjabi Bhangra.")
    if not animations:
        raise ValueError("The requested animation category is empty.")
    if not 1 <= width <= 120 or not 1 <= height <= 80:
        raise ValueError("Collection pack dimensions must be between 1×1 and 120×80 pixels.")
    if not 1 <= fps <= 60:
        raise ValueError("FPS must be between 1 and 60.")

    output_dir.mkdir(parents=True, exist_ok=True)
    pack_path = output_dir / f"{_safe_name(category)}-animation-pack-{uuid.uuid4().hex[:8]}.zip"
    with zipfile.ZipFile(pack_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(
            "README.txt",
            "Pixel Toran Studio editable animation collection\n"
            f"Canvas: {width} x {height} RGB pixels. Frames are PNG and frames.json is raw RGB source data.\n"
            "The preview GIF is for review only. The studio SWF export is a legacy Flash animation and has not been "
            "verified against a controller firmware, LED protocol, or LEDEdit project format.\n",
        )
        for animation in animations:
            pattern = str(animation["pattern"])
            name = str(animation["name"])
            frames = animation["frames"]
            if not isinstance(frames, list) or not 1 <= len(frames) <= 12:
                raise ValueError(f"{name} must contain 1–12 animation frames.")
            if any(frame.shape != (height, width, 3) for frame in frames):
                raise ValueError(f"{name} frames must all be exactly {width} × {height} RGB pixels.")
            folder = f"{category}/{_safe_name(pattern)}"
            pngs = [_png_bytes(frame) for frame in frames]
            for frame_index, png in enumerate(pngs):
                archive.writestr(f"{folder}/frames/{frame_index:02d}.png", png)

            sprite_sheet = np.concatenate(frames, axis=1)
            archive.writestr(f"{folder}/sprite-sheet.png", _png_bytes(sprite_sheet))
            gif_buffer = io.BytesIO()
            images = [Image.fromarray(frame, mode="RGB") for frame in frames]
            images[0].save(
                gif_buffer,
                format="GIF",
                save_all=True,
                append_images=images[1:],
                duration=round(1000 / fps),
                loop=0,
                optimize=False,
                disposal=2,
            )
            archive.writestr(f"{folder}/preview.gif", gif_buffer.getvalue())
            metadata = {
                "name": name,
                "pattern": pattern,
                "category": category,
                "frame_count": len(frames),
                "fps": fps,
                "width": width,
                "height": height,
                "duration_seconds": round(len(frames) / fps, 3),
                "controller_compatibility": "not_verified",
                "requested_target": "T1000 / LEDEdit 2014 (not independently verified)",
                "controller_firmware": "unverified",
                "led_protocol": "unknown",
            }
            archive.writestr(
                f"{folder}/metadata.json",
                json.dumps(metadata, indent=2),
            )
            raw_frames = {
                "width": width,
                "height": height,
                "frames": [frame.tolist() for frame in frames],
            }
            archive.writestr(
                f"{folder}/frames.json",
                json.dumps(raw_frames, separators=(",", ":")),
            )
    if not pack_path.is_file() or pack_path.stat().st_size == 0:
        raise RuntimeError("Animation pack export did not create a readable ZIP.")
    return pack_path
