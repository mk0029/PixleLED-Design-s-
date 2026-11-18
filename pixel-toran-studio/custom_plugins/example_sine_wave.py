import math

import numpy as np

PLUGIN_NAME = "Sine Wave"
DEFAULT_PARAMS = {"speed": 0.3, "density": 0.4}


def generate(W, H, FPS, params):
    frames = []
    speed = params.get("speed", 0.3)
    density = params.get("density", 0.4)
    for t in range(8 * FPS):
        image = np.zeros((H, W, 3), dtype=np.uint8)
        for y in range(H):
            for x in range(W):
                value = math.sin(x * density + t * speed) + math.cos(y * density - t * speed)
                image[y, x] = (int((value + 2) * 63), 140, 255)
        frames.append(image)
    return frames
