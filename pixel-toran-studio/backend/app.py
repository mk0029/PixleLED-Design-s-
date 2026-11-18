"""Flask API and static-file server for Pixel LED Toran Studio."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from flask import Flask, jsonify, request, send_from_directory

from flask_cors import CORS

from math_presets import math_palette_catalog, math_preset_catalog
from pattern_engine import (
    DEFAULT_FPS,
    DEFAULT_HEIGHT,
    DEFAULT_WIDTH,
    PATTERNS,
    generate_frames,
    generate_math_frames,
    pattern_catalog,
)
from plugin_loader import MAX_PLUGIN_BYTES, PluginRegistry
from avi_exporter import export_avi

ROOT = Path(__file__).resolve().parent.parent
FRONTEND = Path(os.environ.get("FRONTEND_DIR", ROOT.parent / "pixel-led-studio-offline" / "dist")).resolve()
EXPORTS = ROOT / "exports"
PLUGINS = ROOT / "custom_plugins"
MAX_REQUEST_BYTES = 32 * 1024 * 1024
app = Flask(__name__, static_folder=str(FRONTEND), static_url_path="")
app.config["MAX_CONTENT_LENGTH"] = MAX_REQUEST_BYTES
CORS(app, origins=["http://127.0.0.1:5000", "http://localhost:5000"])
plugin_registry = PluginRegistry(PLUGINS)


def _integer(payload: dict[str, Any], key: str, default: int, minimum: int, maximum: int) -> int:
    value = payload.get(key, default)
    if isinstance(value, bool) or not isinstance(value, int) or not minimum <= value <= maximum:
        raise ValueError(f"{key} must be an integer from {minimum} to {maximum}.")
    return value


def _scene_frames(scene: dict[str, Any], width: int, height: int, fps: int, count: int) -> list:
    pattern = scene.get("pattern", scene.get("id"))
    options = scene.get("options", {})
    if not isinstance(options, dict):
        raise ValueError("Scene options must be an object.")
    if pattern == "math":
        return generate_math_frames(
            options.get("formula", ""),
            width,
            height,
            fps,
            count,
            options.get("params", {}),
            options.get("color"),
            options.get("color_formulas"),
            options.get("color_mode", "formula"),
            options.get("seed"),
            options.get("mask_shape"),
        )
    if isinstance(pattern, str) and pattern.startswith("plugin:"):
        return plugin_registry.generate(
            pattern.split(":", 1)[1],
            width,
            height,
            fps,
            count,
            options.get("params", {}),
        )
    if pattern not in PATTERNS:
        raise ValueError(f"Unknown scene pattern: {pattern}")
    return generate_frames(pattern, width, height, fps, count, **options)


def _trusted_local_origin() -> bool:
    origin = request.headers.get("Origin")
    return origin is None or origin in {
        "http://127.0.0.1:5000",
        "http://localhost:5000",
    }


@app.get("/")
def index():
    return send_from_directory(FRONTEND, "index.html")


@app.get("/api/patterns")
def patterns():
    return jsonify({"patterns": pattern_catalog()})


@app.get("/api/math-presets")
def math_presets():
    return jsonify({"presets": math_preset_catalog(), "palettes": math_palette_catalog()})


@app.get("/api/plugins")
def plugins():
    return jsonify(plugin_registry.catalog())


@app.post("/api/plugins/reload")
def reload_plugins():
    if not _trusted_local_origin():
        return jsonify({"error": "Plugin reload is available only from the local studio."}), 403
    return jsonify(plugin_registry.reload())


@app.post("/api/plugins/upload")
def upload_plugin():
    if not _trusted_local_origin():
        return jsonify({"error": "Plugin uploads are available only from the local studio."}), 403
    plugin_file = request.files.get("file")
    if plugin_file is None:
        return jsonify({"error": "Choose a .py plugin file to upload."}), 400
    try:
        plugin_id = plugin_registry.save_upload(plugin_file.filename, plugin_file.stream.read(MAX_PLUGIN_BYTES + 1))
        catalog = plugin_registry.reload()
        errors = [item for item in catalog["errors"] if Path(item["file"]).stem.lower() == plugin_id]
        if errors:
            return jsonify({"error": errors[0]["error"], **catalog}), 400
        return jsonify(catalog), 201
    except (OSError, ValueError) as error:
        return jsonify({"error": str(error)}), 400


@app.post("/api/preview")
def preview():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "Request body must be a JSON object."}), 400
    try:
        width = _integer(payload, "width", DEFAULT_WIDTH, 1, 120)
        height = _integer(payload, "height", DEFAULT_HEIGHT, 1, 80)
        fps = _integer(payload, "fps", DEFAULT_FPS, 1, 60)
        count = _integer(payload, "frame_count", 12, 1, 120)
        scene = payload.get("scene", payload)
        if not isinstance(scene, dict):
            raise ValueError("scene must be an object.")
        frames = _scene_frames(scene, width, height, fps, count)
        return jsonify({
            "width": width,
            "height": height,
            "fps": fps,
            "frames": [frame.tolist() for frame in frames],
        })
    except (TypeError, ValueError) as error:
        return jsonify({"error": str(error)}), 400


@app.post("/api/export")
def export():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "Request body must be a JSON object."}), 400
    try:
        width = _integer(payload, "width", DEFAULT_WIDTH, 1, 120)
        height = _integer(payload, "height", DEFAULT_HEIGHT, 1, 80)
        fps = _integer(payload, "fps", DEFAULT_FPS, 1, 60)
        scenes = payload.get("playlist")
        if not isinstance(scenes, list) or not scenes:
            raise ValueError("Add at least one scene to the playlist before exporting.")

        all_frames = []
        scene_links = []
        for scene in scenes:
            if not isinstance(scene, dict):
                raise ValueError("Every playlist item must be an object.")
            duration = scene.get("duration", 3)
            if isinstance(duration, bool) or not isinstance(duration, (int, float)) or not 0.1 <= duration <= 120:
                raise ValueError("Scene duration must be from 0.1 to 120 seconds.")
            count = max(1, round(duration * fps))
            if len(all_frames) + count > 18000:
                raise ValueError("The complete playlist cannot exceed 18,000 frames.")
            frames = _scene_frames(scene, width, height, fps, count)
            pattern = scene.get("pattern", scene.get("id", "scene"))
            scene_links.append({"name": scene.get("name", PATTERNS.get(pattern, str(pattern))), "frame_count": len(frames)})
            all_frames.extend(frames)

        master_path = export_avi(all_frames, fps, "pixel-led-show")
        return jsonify({
            "master": f"/exports/{master_path.name}",
            "scenes": scene_links,
            "frame_count": len(all_frames),
            "duration": round(len(all_frames) / fps, 2),
            "format": "AVI (MJPG)",
            "controller_compatibility": "not_verified",
        })
    except (OSError, TypeError, ValueError, RuntimeError) as error:
        return jsonify({"error": str(error)}), 400


@app.get("/exports/<path:filename>")
def download_export(filename: str):
    return send_from_directory(EXPORTS, filename, as_attachment=True)


@app.errorhandler(413)
def request_too_large(_error):
    return jsonify({"error": f"Request exceeds the {MAX_REQUEST_BYTES // (1024 * 1024)} MB API request limit."}), 413


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
