import os
import json
import struct
import tempfile
import unittest
import zipfile
import zlib
from io import BytesIO
from pathlib import Path
from unittest.mock import patch

import numpy as np
from PIL import Image

from animation_bundle import export_animation_pack
from app import app as flask_app
from pattern_engine import PATTERNS, PATTERN_FAMILIES, generate_frames, generate_math_frames, pattern_catalog
from math_presets import math_palette_catalog, math_preset_catalog
from effect_presets import SCENE_PRESETS
from plugin_loader import PluginRegistry
from swf_exporter import export_swf


class AnimationFamilyTests(unittest.TestCase):
    def test_new_patterns_render_rgb_frames_at_supported_small_grids(self):
        new_patterns = {
            "rain", "line_rain", "droplets", "ripples", "bubbles", "waterfall", "snow", "meteor", "hearts",
            "dolphin", "elephant", "lion", "tiger", "peacock", "horse", "camel", "monkey", "rabbit", "deer",
            "snake", "cobra", "eagle", "parrot", "butterfly", "dog", "cat", "dinosaur", "frog", "kangaroo",
            "bear", "fish", "dragon", "rooster", "swan", "turtle", "bird",
            "human", "moonwalk", *(
                pattern for pattern, family in PATTERN_FAMILIES.items() if family == "Punjabi Bhangra"
            ),
            "confetti", "fireflies", "aurora", "flame", "matrix", "spiral", "pulse", "comets",
        }
        for pattern in new_patterns:
            for width, height in ((1, 1), (7, 5), (30, 20)):
                frames = generate_frames(pattern, width, height, 20, 2)
                self.assertEqual(len(frames), 2)
                self.assertTrue(all(frame.shape == (height, width, 3) for frame in frames))
                self.assertTrue(all(frame.dtype == np.uint8 for frame in frames))

    def test_animal_characters_have_distinct_animated_sprites(self):
        catalog_families = {scene["id"]: scene["family"] for scene in pattern_catalog()}
        animals = [pattern for pattern, family in catalog_families.items() if family == "Animals"]
        required = {
            "lion", "tiger", "elephant", "peacock", "horse", "camel", "monkey", "rabbit", "deer", "snake",
            "cobra", "eagle", "parrot", "butterfly", "dog", "cat", "dinosaur", "frog", "kangaroo", "bear",
            "fish", "dolphin", "dragon", "rooster", "swan",
        }
        self.assertTrue(required.issubset(animals))
        sprites = set()
        for animal in animals:
            with self.subTest(animal=animal):
                frames = generate_frames(animal, 30, 8, 20, 12)
                self.assertTrue(all(frame.shape == (8, 30, 3) for frame in frames))
                self.assertTrue(all(np.any(frame) and np.any(frame == 0) for frame in frames))
                self.assertFalse(np.array_equal(frames[0], frames[-1]))
                sprites.add(frames[0].tobytes())
        self.assertEqual(len(sprites), len(animals))

    def test_animal_and_bhangra_art_scale_to_the_configured_matrix(self):
        for pattern in ("lion", "dolphin", "bhangra", "bhangra_finale"):
            for width, height in ((30, 8), (30, 50), (60, 16)):
                with self.subTest(pattern=pattern, width=width, height=height):
                    frame = generate_frames(pattern, width, height, 20, 12)[0]
                    self.assertEqual(frame.shape, (height, width, 3))
                    rows, columns = np.where(np.any(frame != 0, axis=2))
                    self.assertGreater(len(rows), 0)
                    if height == 50:
                        self.assertGreater(int(rows.max() - rows.min()), 30)

    def test_dolphin_moves_over_full_width_waves(self):
        width, height = 30, 8
        frames = generate_frames("dolphin", width, height, 20, 48)
        dolphin_centers = []
        for frame in frames:
            mask = (frame[:, :, 0] == 70) & (frame[:, :, 1] == 221) & (frame[:, :, 2] == 255)
            self.assertTrue(np.any(mask))
            y_positions, x_positions = np.where(mask)
            dolphin_centers.append(float(np.mean(x_positions)))
            self.assertLess(float(np.mean(y_positions)), height)
        self.assertGreater(max(dolphin_centers) - min(dolphin_centers), width // 2)
        self.assertTrue(all(np.any(frame == 0) for frame in frames))

    def test_walking_and_moonwalking_humans_move_in_opposite_directions(self):
        for pattern, expected_direction in (("human", 1), ("moonwalk", -1)):
            frames = generate_frames(pattern, 30, 20, 20, 48)
            centers = []
            shirt_color = (0, 210, 255) if pattern == "human" else (255, 170, 0)
            for frame in frames:
                mask = np.all(frame == shirt_color, axis=2)
                self.assertGreater(np.count_nonzero(mask), 4)
                y_positions, x_positions = np.where(mask)
                self.assertGreater(int(y_positions.max() - y_positions.min()), 8)
                centers.append(float(np.mean(x_positions)))
            self.assertGreater((centers[-1] - centers[0]) * expected_direction, 8)

    def test_walking_and_moonwalking_humans_scale_to_tall_matrices(self):
        for pattern in ("human", "moonwalk"):
            frames = generate_frames(pattern, 30, 50, 20, 12)
            self.assertTrue(all(frame.shape == (50, 30, 3) for frame in frames))
            y_positions, _ = np.where(np.any(frames[0] != 0, axis=2))
            self.assertGreater(int(y_positions.max() - y_positions.min()), 35)

    def test_bhangra_dancers_have_two_large_changing_poses(self):
        patterns = [pattern for pattern, family in PATTERN_FAMILIES.items() if family == "Punjabi Bhangra"]
        self.assertEqual(len(patterns), 20)
        sprites = set()
        for pattern in patterns:
            frames = generate_frames(pattern, 30, 8, 20, 12)
            self.assertEqual(len(frames), 12)
            self.assertTrue(all(frame.shape == (8, 30, 3) for frame in frames))
            self.assertTrue(all(np.any(frame) and np.any(frame == 0) for frame in frames))
            sprites.add(frames[0].tobytes())
        self.assertEqual(len(sprites), 20)
        frames = generate_frames("bhangra", 30, 8, 20, 12)
        self.assertFalse(np.array_equal(frames[0], frames[8]))

    def test_animation_pack_contains_editable_frames_gif_and_metadata(self):
        frame = np.zeros((8, 30, 3), dtype=np.uint8)
        frame[2:5, 10:15] = (255, 120, 35)
        next_frame = np.roll(frame, 1, axis=1)
        with tempfile.TemporaryDirectory() as directory:
            path = export_animation_pack(
                "Animals",
                [{"pattern": "test-lion", "name": "Test Lion", "frames": [frame, next_frame]}],
                fps=20,
                output_dir=Path(directory),
            )
            with zipfile.ZipFile(path) as archive:
                root = "Animals/test-lion"
                names = set(archive.namelist())
                self.assertIn(f"{root}/frames/00.png", names)
                self.assertIn(f"{root}/frames/01.png", names)
                self.assertIn(f"{root}/sprite-sheet.png", names)
                self.assertIn(f"{root}/preview.gif", names)
                self.assertIn(f"{root}/frames.json", names)
                with Image.open(BytesIO(archive.read(f"{root}/frames/00.png"))) as image:
                    self.assertEqual(image.size, (30, 8))
                with Image.open(BytesIO(archive.read(f"{root}/sprite-sheet.png"))) as image:
                    self.assertEqual(image.size, (60, 8))
                with Image.open(BytesIO(archive.read(f"{root}/preview.gif"))) as image:
                    self.assertEqual(image.size, (30, 8))
                    self.assertEqual(image.n_frames, 2)
                metadata = json.loads(archive.read(f"{root}/metadata.json"))
                self.assertEqual((metadata["width"], metadata["height"]), (30, 8))
                self.assertEqual(metadata["frame_count"], 2)
                self.assertEqual(metadata["controller_compatibility"], "not_verified")

    def test_animation_pack_preserves_custom_matrix_dimensions(self):
        frame = np.zeros((50, 30, 3), dtype=np.uint8)
        frame[10:40, 12:18] = (220, 100, 45)
        with tempfile.TemporaryDirectory() as directory:
            path = export_animation_pack(
                "Animals",
                [{"pattern": "tall-lion", "name": "Tall Lion", "frames": [frame]}],
                width=30,
                height=50,
                output_dir=Path(directory),
            )
            with zipfile.ZipFile(path) as archive:
                root = "Animals/tall-lion"
                with Image.open(BytesIO(archive.read(f"{root}/frames/00.png"))) as image:
                    self.assertEqual(image.size, (30, 50))
                metadata = json.loads(archive.read(f"{root}/metadata.json"))
                self.assertEqual((metadata["width"], metadata["height"]), (30, 50))
                readme = archive.read("README.txt").decode("utf-8")
                self.assertIn("Canvas: 30 x 50 RGB pixels.", readme)

    def test_swf_exporter_writes_compressed_timeline_with_expected_dimensions(self):
        first = np.zeros((3, 4, 3), dtype=np.uint8)
        first[1, 1:3] = (255, 20, 40)
        second = np.zeros_like(first)
        second[0, 0] = (30, 180, 255)
        with tempfile.TemporaryDirectory() as directory:
            with patch("swf_exporter.EXPORT_DIR", Path(directory)):
                path = export_swf([first, second], fps=20, name="test animation")
            data = path.read_bytes()
        self.assertEqual(path.suffix, ".swf")
        self.assertEqual(data[:3], b"CWS")
        self.assertEqual(data[3], 8)
        body = zlib.decompress(data[8:])
        self.assertEqual(struct.unpack_from("<I", data, 4)[0], len(body) + 8)

        rect_bits = body[0] >> 3
        rect_size = (5 + rect_bits * 4 + 7) // 8
        fps_fixed, frame_count = struct.unpack_from("<HH", body, rect_size)
        self.assertEqual(fps_fixed, 20 << 8)
        self.assertEqual(frame_count, 2)

        tags = []
        cursor = rect_size + 4
        while cursor < len(body):
            header = struct.unpack_from("<H", body, cursor)[0]
            cursor += 2
            code, length = header >> 6, header & 0x3F
            if length == 0x3F:
                length = struct.unpack_from("<I", body, cursor)[0]
                cursor += 4
            tags.append(code)
            cursor += length
            if code == 0:
                break
        self.assertEqual(tags.count(32), 2)
        self.assertEqual(tags.count(26), 2)
        self.assertEqual(tags.count(1), 2)
        self.assertEqual(tags[-1], 0)

    def test_playlist_export_api_returns_swf_downloads(self):
        with patch("app.export_swf", side_effect=lambda _frames, _fps, name: Path(f"{name}.swf")) as exporter:
            response = flask_app.test_client().post(
                "/api/export",
                json={
                    "width": 4,
                    "height": 3,
                    "fps": 10,
                    "playlist": [{"pattern": "lion", "duration": 0.1}],
                },
            )
        self.assertEqual(response.status_code, 200)
        result = response.get_json()
        self.assertEqual(result["format"], "SWF")
        self.assertEqual(result["master"], "/exports/toran-master.swf")
        self.assertEqual(result["scenes"][0]["url"], "/exports/lion.swf")
        self.assertEqual(exporter.call_count, 2)

    def test_preview_api_defaults_to_the_30_by_8_twelve_frame_canvas(self):
        response = flask_app.test_client().post(
            "/api/preview",
            json={"scene": {"pattern": "lion"}},
        )
        self.assertEqual(response.status_code, 200)
        preview = response.get_json()
        self.assertEqual((preview["width"], preview["height"]), (30, 8))
        self.assertEqual(len(preview["frames"]), 12)
        self.assertEqual(len(preview["frames"][0]), 8)
        self.assertEqual(len(preview["frames"][0][0]), 30)

        tall_response = flask_app.test_client().post(
            "/api/preview",
            json={"width": 30, "height": 50, "scene": {"pattern": "lion"}},
        )
        self.assertEqual(tall_response.status_code, 200)
        tall_preview = tall_response.get_json()
        self.assertEqual((tall_preview["width"], tall_preview["height"]), (30, 50))
        self.assertEqual(len(tall_preview["frames"][0]), 50)
        self.assertEqual(len(tall_preview["frames"][0][0]), 30)

    def test_collection_api_exports_each_requested_family(self):
        with patch("app.export_animation_pack", return_value=Path("collection.zip")) as exporter:
            for category, expected_count in (("Animals", 27), ("Punjabi Bhangra", 20)):
                response = flask_app.test_client().post(
                    "/api/export/collection",
                    json={"category": category},
                )
                self.assertEqual(response.status_code, 200)
                result = response.get_json()
                self.assertEqual(result["animation_count"], expected_count)
                self.assertEqual((result["width"], result["height"]), (30, 8))
                animations = exporter.call_args.args[1]
                self.assertEqual(len(animations), expected_count)
                self.assertTrue(all(
                    len(animation["frames"]) == 12
                    and all(frame.shape == (8, 30, 3) for frame in animation["frames"])
                    for animation in animations
                ))
            response = flask_app.test_client().post(
                "/api/export/collection",
                json={
                    "category": "Animals",
                    "width": 30,
                    "height": 50,
                    "fps": 25,
                    "frame_count": 8,
                },
            )
            self.assertEqual(response.status_code, 200)
            result = response.get_json()
            self.assertEqual((result["width"], result["height"], result["fps"]), (30, 50, 25))
            self.assertEqual(result["frame_count"], 8)
            self.assertEqual(
                exporter.call_args.kwargs,
                {"fps": 25, "width": 30, "height": 50},
            )
            self.assertTrue(all(
                all(frame.shape == (50, 30, 3) for frame in animation["frames"])
                for animation in exporter.call_args.args[1]
            ))

    def test_pulsing_hearts_are_recognizable_and_change_size(self):
        width, height = 30, 20
        frames = generate_frames("hearts", width, height, 20, 48)
        areas = []
        occupied = []
        for frame in frames:
            mask = (frame[:, :, 0] == 255) & (frame[:, :, 1] == 35)
            areas.append(int(np.count_nonzero(mask)))
            occupied.append(mask)
        self.assertGreater(min(areas), 0)
        self.assertGreater(max(areas), min(areas))
        y_positions, x_positions = np.where(np.any(np.stack(occupied), axis=0))
        self.assertLessEqual(int(x_positions.min()), width // 4)
        self.assertGreaterEqual(int(x_positions.max()), width * 3 // 4)
        self.assertLessEqual(int(y_positions.min()), height // 4)
        self.assertGreaterEqual(int(y_positions.max()), height * 3 // 4)

    def test_vertical_line_rain_uses_ten_to_twenty_columns_and_splashes_at_bottom(self):
        width, height = 30, 20
        frames = generate_frames("line_rain", width, height, 20, 240, seed=17)
        animation = np.stack(frames)
        active_columns = np.flatnonzero(
            np.any(animation[:, :height - 4, :, :] != 0, axis=(0, 1, 3))
        )
        self.assertGreaterEqual(len(active_columns), 10)
        self.assertLessEqual(len(active_columns), 20)
        widest_bottom_splash = max(
            np.count_nonzero(np.any(frame[height - 1] != 0, axis=1))
            for frame in frames
        )
        self.assertGreaterEqual(widest_bottom_splash, 3)
        self.assertTrue(any(np.any(frame[height - 2]) for frame in frames))
        repeated = generate_frames("line_rain", width, height, 20, 240, seed=17)
        np.testing.assert_array_equal(animation, np.stack(repeated))

    def test_scene_library_has_more_than_three_hundred_full_grid_presets(self):
        self.assertGreaterEqual(len(SCENE_PRESETS), 300)
        self.assertEqual(len({preset["name"] for preset in SCENE_PRESETS.values()}), len(SCENE_PRESETS))
        for preset_id in SCENE_PRESETS:
            frame = generate_frames(preset_id, 5, 4, 10, 1)[0]
            self.assertEqual(frame.shape, (4, 5, 3))
            self.assertEqual(frame.dtype, np.uint8)
        for kind in ("matrix", "space", "chase", "dance", "wedding", "music", "water"):
            preset_id = next(
                preset_id for preset_id, preset in SCENE_PRESETS.items()
                if preset["kind"] == kind
            )
            frame = generate_frames(preset_id, 30, 20, 20, 1)[0]
            self.assertEqual(frame.shape, (20, 30, 3))
            self.assertTrue(np.any(frame[:10]))
            self.assertTrue(np.any(frame[10:]))

    def test_legacy_character_scenes_have_full_canvas_motion(self):
        frames = generate_frames("human", 30, 20, 20, 48)
        self.assertTrue(any(np.any(frame[:10]) for frame in frames))

    def test_every_scene_has_a_family_in_the_catalog(self):
        catalog = pattern_catalog()
        self.assertEqual({scene["id"] for scene in catalog}, set(PATTERNS) - {"math"})
        self.assertEqual({scene["id"] for scene in catalog}, set(PATTERN_FAMILIES))
        self.assertTrue(all(scene["family"] for scene in catalog))

    def test_math_rain_family_has_more_than_twenty_valid_formulas(self):
        presets = math_preset_catalog()
        rain_presets = [preset for preset in presets if preset["category"] == "Rain & Drops"]
        self.assertGreater(len(rain_presets), 20)
        self.assertGreater(len({preset["formula"] for preset in rain_presets}), 20)
        self.assertGreater(len({preset["effect"] for preset in rain_presets}), 100)
        for preset in rain_presets:
            frames = generate_math_frames(
                preset["formula"],
                width=4,
                height=3,
                frame_count=2,
                params=preset["params"],
                color_formulas=preset["color_formulas"],
                mask_shape=preset["mask_shape"],
            )
            self.assertTrue(all(frame.shape == (3, 4, 3) for frame in frames))

    def test_math_library_has_over_five_hundred_unique_renderable_effects(self):
        presets = math_preset_catalog()
        self.assertGreater(len(presets), 500)
        self.assertEqual(len({preset["effect"] for preset in presets}), len(presets))
        self.assertEqual(len({preset["formula"] for preset in presets}), len(presets))
        self.assertEqual(len(math_palette_catalog()), 15)
        for preset in presets:
            frames = generate_math_frames(
                preset["formula"],
                width=3,
                height=2,
                frame_count=1,
                params=preset["params"],
                color_formulas=preset["color_formulas"],
                mask_shape=preset["mask_shape"],
            )
            self.assertEqual(frames[0].shape, (2, 3, 3))

    def test_math_color_sources_follow_shape_mask_switch(self):
        channels = {"red": "200", "green": "100", "blue": "50"}
        formula_frame = generate_math_frames(
            "0", 1, 1, frame_count=1, color_formulas=channels, mask_shape=False
        )[0]
        masked_frame = generate_math_frames(
            "0", 1, 1, frame_count=1, color_formulas=channels, mask_shape=True
        )[0]
        custom_frame = generate_math_frames(
            "0", 1, 1, frame_count=1, color=(12, 34, 56), color_mode="custom", mask_shape=False
        )[0]
        np.testing.assert_array_equal(formula_frame[0, 0], (200, 100, 50))
        np.testing.assert_array_equal(masked_frame[0, 0], (100, 50, 25))
        np.testing.assert_array_equal(custom_frame[0, 0], (12, 34, 56))


class PluginUploadTests(unittest.TestCase):
    def test_existing_plugin_can_be_updated_when_atomic_replace_is_denied(self):
        previous = (
            b"PLUGIN_NAME = 'Old name'\n"
            b"DEFAULT_PARAMS = {}\n"
            b"def generate(W, H, FPS, params):\n"
            b"    return []\n"
        )
        source = previous.replace(b"Old name", b"New name")
        with tempfile.TemporaryDirectory() as directory:
            plugin_path = Path(directory) / "sample.py"
            plugin_path.write_bytes(previous)
            registry = PluginRegistry(Path(directory))
            original_mtime = plugin_path.stat().st_mtime
            with patch.object(Path, "replace", side_effect=PermissionError("replace denied")):
                plugin_id = registry.save_upload("sample.py", source)
            os.utime(plugin_path, (original_mtime, original_mtime))
            catalog = registry.reload()
            self.assertEqual(plugin_id, "sample")
            self.assertEqual(plugin_path.read_bytes(), source)
            self.assertEqual(catalog["plugins"][0]["name"], "New name")
            self.assertFalse((Path(directory) / ".sample.upload").exists())


class HealthRouteTests(unittest.TestCase):
    def test_health_route_reports_ok_without_caching(self):
        client = flask_app.test_client()
        for path in ("/health", "/api/health"):
            response = client.get(path)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.get_json()["status"], "ok")
            self.assertEqual(response.headers["Cache-Control"], "no-store")
            self.assertEqual(client.head(path).status_code, 200)


class ToranVerticalLineEffectTests(unittest.TestCase):
    def test_ripple_scenes_are_vertical_line_effects_with_original_colors(self):
        names = {preset["base_name"] for preset in SCENE_PRESETS.values()
                 if preset["family"] == "Vertical Line & Curtain Flows"}
        for name in ("Multi-Band Sine Wave", "Concentric Diamond Ripple", "Multi-Point Water Drop Ripples",
                     "Top-Border Rectangular Pulse", "Diagonal Chevron Wave"):
            self.assertIn(name, names)
        frames = generate_frames("top-border-rectangular-pulse--original-colors", 40, 25, 30, 30)
        self.assertTrue(all(frame.shape == (25, 40, 3) for frame in frames))
        np.testing.assert_array_equal(frames[15][0], np.tile((255, 0, 0), (40, 1)))
        self.assertFalse(np.array_equal(frames[0], frames[29]))
        mirrored = generate_frames("diagonal-chevron-wave--mirror-symmetry", 40, 25, 30, 1)[0]
        np.testing.assert_array_equal(mirrored, mirrored[:, ::-1])


class ToranRippleShowPluginTests(unittest.TestCase):
    def setUp(self):
        self.registry = PluginRegistry(Path(__file__).resolve().parent.parent / "custom_plugins")

    def test_full_show_matches_toran_spec(self):
        frames = self.registry.generate("toran_ripple_show", 40, 25, 30, 1800)
        self.assertEqual(len(frames), 1800)
        self.assertTrue(all(frame.shape == (25, 40, 3) and frame.dtype == np.uint8 for frame in frames))
        self.assertLess(int(frames[0].max()), 32)
        self.assertLess(int(frames[-1].max()), 32)
        for index in range(1080 + 15, 1440 - 15, 30):
            np.testing.assert_array_equal(frames[index][0], np.tile((255, 0, 0), (40, 1)))

    def test_single_scenes_render_at_studio_grid(self):
        for scene in range(1, 6):
            with self.subTest(scene=scene):
                frames = self.registry.generate("toran_ripple_show", 30, 20, 20, 4, {"scene": scene, "seconds": 2})
                self.assertTrue(all(frame.shape == (20, 30, 3) for frame in frames))
                self.assertTrue(any(np.any(frame) for frame in frames))
        with self.assertRaises(ValueError):
            self.registry.generate("toran_ripple_show", 40, 25, 30, 1, {"scene": 6})

    def test_single_scene_loops_every_fifth_of_the_show(self):
        frames = self.registry.generate("toran_ripple_show", 40, 25, 30, 720, {"scene": 2})
        np.testing.assert_array_equal(frames[0], frames[360])
        self.assertFalse(np.array_equal(frames[0], frames[45]))

    def test_catalog_exposes_param_ranges(self):
        plugin = next(item for item in self.registry.catalog()["plugins"] if item["id"] == "toran_ripple_show")
        self.assertEqual(plugin["ranges"]["scene"], [0, 5, 1])

    def test_invalid_param_ranges_are_reported(self):
        source = (
            "PLUGIN_NAME = 'Bad ranges'\n"
            "DEFAULT_PARAMS = {'level': 5}\n"
            "PARAM_RANGES = {'level': (0, 3, 1)}\n"
            "def generate(W, H, FPS, params):\n"
            "    return []\n"
        )
        with tempfile.TemporaryDirectory() as directory:
            (Path(directory) / "bad.py").write_text(source)
            catalog = PluginRegistry(Path(directory)).catalog()
            self.assertEqual(catalog["plugins"], [])
            self.assertIn("PARAM_RANGES", catalog["errors"][0]["error"])


if __name__ == "__main__":
    unittest.main()
