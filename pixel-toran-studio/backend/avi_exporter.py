"""Generic MJPG AVI output at the requested RGB grid dimensions."""

from __future__ import annotations

import uuid
import struct
from pathlib import Path
from typing import Iterable

import cv2
import numpy as np

EXPORT_DIR = Path(__file__).resolve().parent.parent / "exports"


def _chunk(tag: bytes, payload: bytes) -> bytes:
    chunk = tag + struct.pack("<I", len(payload)) + payload
    return chunk + (b"\0" if len(payload) & 1 else b"")


def _list_chunk(kind: bytes, payload: bytes) -> bytes:
    return _chunk(b"LIST", kind + payload)


def export_avi(frames: Iterable[np.ndarray], fps: int, name: str = "toran") -> Path:
    """Write an RGB frame sequence as a generic MJPG AVI; controller compatibility is unverified."""
    frame_list = list(frames)
    if not frame_list:
        raise ValueError("Cannot export an empty animation.")

    first = frame_list[0]
    if first.ndim != 3 or first.shape[2] != 3:
        raise ValueError("AVI frames must be RGB arrays.")
    height, width = first.shape[:2]
    if width < 1 or height < 1:
        raise ValueError("AVI frame dimensions must be positive.")
    if not 1 <= fps <= 60:
        raise ValueError("FPS must be between 1 and 60.")

    jpeg_frames = []
    for frame in frame_list:
        if frame.shape != first.shape or frame.dtype != np.uint8:
            raise ValueError("All AVI frames must have the same RGB shape and uint8 values.")
        encoded, jpeg = cv2.imencode(
            ".jpg",
            cv2.cvtColor(frame, cv2.COLOR_RGB2BGR),
            [cv2.IMWRITE_JPEG_QUALITY, 100],
        )
        if not encoded:
            raise RuntimeError("OpenCV could not encode an MJPG video frame.")
        jpeg_frames.append(jpeg.tobytes())

    max_frame_size = max(map(len, jpeg_frames))
    main_header = struct.pack(
        "<14I",
        round(1_000_000 / fps),
        max_frame_size * fps,
        0,
        0x10,
        len(jpeg_frames),
        0,
        1,
        max_frame_size,
        width,
        height,
        0,
        0,
        0,
        0,
    )
    stream_header = struct.pack(
        "<4s4sIHH8I4h",
        b"vids",
        b"MJPG",
        0,
        0,
        0,
        0,
        1,
        fps,
        0,
        len(jpeg_frames),
        max_frame_size,
        0xFFFFFFFF,
        0,
        0,
        0,
        width,
        height,
    )
    bitmap_header = struct.pack(
        "<IiiHHIIiiII",
        40,
        width,
        height,
        1,
        24,
        int.from_bytes(b"MJPG", "little"),
        0,
        0,
        0,
        0,
        0,
    )
    headers = _list_chunk(
        b"hdrl",
        _chunk(b"avih", main_header)
        + _list_chunk(b"strl", _chunk(b"strh", stream_header) + _chunk(b"strf", bitmap_header)),
    )
    movi_chunks = []
    index_entries = []
    movi_offset = 0
    for jpeg in jpeg_frames:
        frame_chunk = _chunk(b"00dc", jpeg)
        index_entries.append(struct.pack("<4sIII", b"00dc", 0x10, movi_offset, len(jpeg)))
        movi_chunks.append(frame_chunk)
        movi_offset += len(frame_chunk)
    movie = _list_chunk(b"movi", b"".join(movi_chunks))
    index = _chunk(b"idx1", b"".join(index_entries))

    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    safe_name = "".join(char.lower() if char.isalnum() else "-" for char in name).strip("-") or "toran"
    output_path = EXPORT_DIR / f"{safe_name[:48]}-{uuid.uuid4().hex[:8]}.avi"
    avi_body = b"AVI " + headers + movie + index
    output_path.write_bytes(b"RIFF" + struct.pack("<I", len(avi_body)) + avi_body)

    if not output_path.is_file() or output_path.stat().st_size == 0:
        raise RuntimeError("AVI export did not produce a readable output file.")
    return output_path
