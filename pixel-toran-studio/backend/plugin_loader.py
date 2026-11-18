"""Discovery, validation, and execution for explicitly trusted local plugins."""

from __future__ import annotations

import ast
import importlib.util
import inspect
import math
import re
import sys
import threading
from pathlib import Path
from types import ModuleType
from typing import Any

import numpy as np

MAX_PLUGIN_BYTES = 256 * 1024
MAX_PLUGIN_FRAMES = 2400
_PLUGIN_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,62}$")
_PARAM_NAME = re.compile(r"^[A-Za-z][A-Za-z0-9_]{0,31}$")


class PluginRegistry:
    """Loads top-level .py files from a local plugin folder.

    Plugins execute as regular Python in this process and are not sandboxed.
    Only install code that the user trusts.
    """

    def __init__(self, directory: Path):
        self.directory = directory
        self._plugins: dict[str, tuple[ModuleType, dict[str, int | float]]] = {}
        self._ranges: dict[str, dict[str, list[float]]] = {}
        self._errors: list[dict[str, str]] = []
        self._lock = threading.RLock()
        self.directory.mkdir(parents=True, exist_ok=True)
        self.reload()

    def reload(self) -> dict[str, Any]:
        plugins: dict[str, tuple[ModuleType, dict[str, int | float]]] = {}
        ranges: dict[str, dict[str, list[float]]] = {}
        errors: list[dict[str, str]] = []
        self.directory.mkdir(parents=True, exist_ok=True)
        for path in sorted(self.directory.glob("*.py")):
            if path.name.startswith("_"):
                continue
            plugin_id = path.stem.lower()
            try:
                if not _PLUGIN_ID.fullmatch(path.stem):
                    raise ValueError("Filename must use letters, numbers, underscores, or hyphens.")
                if plugin_id in plugins:
                    raise ValueError(f"Plugin ID {plugin_id} is duplicated.")
                module = self._load_module(plugin_id, path)
                defaults = self._validate_module(module)
                ranges[plugin_id] = self._validate_ranges(module, defaults)
                plugins[plugin_id] = (module, defaults)
            except Exception as error:
                errors.append({"file": path.name, "error": str(error)})
                sys.modules.pop(f"pixel_toran_plugin_{plugin_id}", None)

        with self._lock:
            self._plugins = plugins
            self._ranges = ranges
            self._errors = errors
            return self.catalog()

    def catalog(self) -> dict[str, Any]:
        with self._lock:
            return {
                "plugins": [
                    {
                        "id": plugin_id,
                        "name": str(getattr(module, "PLUGIN_NAME", plugin_id)),
                        "params": params,
                        "ranges": self._ranges.get(plugin_id, {}),
                    }
                    for plugin_id, (module, params) in sorted(self._plugins.items())
                ],
                "errors": list(self._errors),
            }

    def generate(
        self,
        plugin_id: str,
        width: int,
        height: int,
        fps: int,
        frame_count: int,
        params: object = None,
    ) -> list[np.ndarray]:
        with self._lock:
            entry = self._plugins.get(plugin_id.lower())
        if entry is None:
            raise ValueError(f"Unknown plugin: {plugin_id}")
        module, defaults = entry
        merged_params = dict(defaults)
        if params is not None:
            if not isinstance(params, dict):
                raise ValueError("Plugin params must be an object.")
            for key, value in params.items():
                if key not in defaults:
                    raise ValueError(f"Unknown parameter for {plugin_id}: {key}")
                if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
                    raise ValueError(f"Plugin parameter {key} must be a finite number.")
                merged_params[key] = value
        try:
            generated = module.generate(width, height, fps, merged_params)
        except Exception as error:
            raise ValueError(f"Plugin {plugin_id} failed: {error}") from error
        if not isinstance(generated, (list, tuple)) or not 1 <= len(generated) <= MAX_PLUGIN_FRAMES:
            raise ValueError(f"Plugin {plugin_id} must return 1–{MAX_PLUGIN_FRAMES} frames.")
        expected_shape = (height, width, 3)
        for index, frame in enumerate(generated):
            if not isinstance(frame, np.ndarray) or frame.shape != expected_shape or frame.dtype != np.uint8:
                raise ValueError(
                    f"Plugin {plugin_id} frame {index} must be a uint8 RGB array with shape {expected_shape}."
                )
        return [generated[index % len(generated)] for index in range(frame_count)]

    def save_upload(self, filename: str | None, source: bytes) -> str:
        if not filename or not filename.lower().endswith(".py"):
            raise ValueError("Upload a Python source file with a .py extension.")
        stem = Path(filename).stem
        if not _PLUGIN_ID.fullmatch(stem):
            raise ValueError("Plugin filename must use letters, numbers, underscores, or hyphens.")
        if not source or len(source) > MAX_PLUGIN_BYTES:
            raise ValueError(f"Plugin file must be between 1 byte and {MAX_PLUGIN_BYTES} bytes.")
        try:
            ast.parse(source.decode("utf-8"), filename=filename)
        except (UnicodeDecodeError, SyntaxError) as error:
            raise ValueError(f"Plugin source is not valid UTF-8 Python: {error}") from error

        destination = self.directory / f"{stem}.py"
        temporary = self.directory / f".{stem}.upload"
        try:
            temporary.write_bytes(source)
            try:
                temporary.replace(destination)
            except PermissionError:
                if not destination.exists():
                    raise
                previous = destination.read_bytes()
                try:
                    destination.write_bytes(source)
                except OSError:
                    try:
                        destination.write_bytes(previous)
                    except OSError as restore_error:
                        raise OSError(
                            f"Could not update {destination.name}, and the previous plugin could not be restored."
                        ) from restore_error
                    raise
        finally:
            if temporary.exists():
                temporary.unlink()
        return stem.lower()

    @staticmethod
    def _load_module(plugin_id: str, path: Path) -> ModuleType:
        module_key = f"pixel_toran_plugin_{plugin_id}"
        spec = importlib.util.spec_from_file_location(module_key, path)
        if spec is None or spec.loader is None:
            raise ValueError("Could not create an import loader for this plugin.")
        module = importlib.util.module_from_spec(spec)
        sys.modules[module_key] = module
        code = compile(path.read_bytes(), str(path), "exec")
        exec(code, module.__dict__)
        return module

    @staticmethod
    def _validate_ranges(module: ModuleType, defaults: dict[str, int | float]) -> dict[str, list[float]]:
        ranges = getattr(module, "PARAM_RANGES", {})
        if not isinstance(ranges, dict):
            raise ValueError("PARAM_RANGES must be a dictionary of (min, max, step) entries.")
        normalized: dict[str, list[float]] = {}
        for key, bounds in ranges.items():
            if key not in defaults:
                raise ValueError(f"PARAM_RANGES key {key} is not in DEFAULT_PARAMS.")
            if not isinstance(bounds, (list, tuple)) or len(bounds) != 3 or any(
                isinstance(item, bool) or not isinstance(item, (int, float)) or not math.isfinite(item)
                for item in bounds
            ):
                raise ValueError(f"PARAM_RANGES[{key}] must be three finite numbers: (min, max, step).")
            minimum, maximum, step = bounds
            if not minimum <= defaults[key] <= maximum or step <= 0:
                raise ValueError(f"PARAM_RANGES[{key}] must contain the default value and use a positive step.")
            normalized[key] = [minimum, maximum, step]
        return normalized

    @staticmethod
    def _validate_module(module: ModuleType) -> dict[str, int | float]:
        name = getattr(module, "PLUGIN_NAME", None)
        if not isinstance(name, str) or not name.strip() or len(name) > 80:
            raise ValueError("Plugin must define PLUGIN_NAME as a non-empty string of at most 80 characters.")
        defaults = getattr(module, "DEFAULT_PARAMS", {})
        if not isinstance(defaults, dict) or len(defaults) > 16:
            raise ValueError("DEFAULT_PARAMS must be a dictionary with at most 16 numeric entries.")
        normalized: dict[str, int | float] = {}
        for key, value in defaults.items():
            if not isinstance(key, str) or not _PARAM_NAME.fullmatch(key):
                raise ValueError(f"Invalid parameter name in DEFAULT_PARAMS: {key}")
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
                raise ValueError(f"Default parameter {key} must be a finite number.")
            normalized[key] = value
        generate = getattr(module, "generate", None)
        if not callable(generate):
            raise ValueError("Plugin must define generate(W, H, FPS, params).")
        try:
            signature = inspect.signature(generate)
        except (TypeError, ValueError) as error:
            raise ValueError("Could not inspect the generate function signature.") from error
        required_names = ("W", "H", "FPS", "params")
        parameters = list(signature.parameters.values())
        if tuple(parameter.name for parameter in parameters[:4]) != required_names:
            raise ValueError("generate parameters must be named (W, H, FPS, params).")
        try:
            signature.bind(30, 20, 20, normalized)
        except (TypeError, ValueError) as error:
            raise ValueError("generate must accept (W, H, FPS, params).") from error
        return normalized
