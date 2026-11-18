import cv2
import numpy as np
import math
import os

# ==========================================
# 1. CONFIGURATION (30 VERTICAL LINES x 20 PIXELS)
# ==========================================
W, H = 30, 20                     # 30 vertical columns, 20 pixels tall
FPS = 20                          # Matches LEDEdit 2014 frame rate
OUTPUT_DIR = "toran_vertical_effects"

os.makedirs(OUTPUT_DIR, exist_ok=True)
fourcc = cv2.VideoWriter_fourcc(*'MJPG')

# Vibrant BGR Color Palette for LEDs
PALETTE = [
    (255, 140, 0),    # Electric Blue
    (0, 180, 255),    # Warm Amber / Gold
    (255, 40, 200),   # Neon Magenta
    (0, 255, 80),     # Emerald Green
    (255, 240, 0),    # Bright Cyan
    (30, 30, 255),    # Pure Red
]

# ==========================================
# 2. VERTICAL LINE ANIMATION GENERATORS
# ==========================================

# 1. ALL LINES: SIMULTANEOUS TOP-TO-BOTTOM & BOTTOM-TO-TOP BOUNCE
def gen_all_lines_top_bottom(seconds=10):
    frames = []
    tail_len = 6
    for t in range(seconds * FPS):
        img = np.zeros((H, W, 3), dtype=np.uint8)
        # Smooth triangle wave moving 0 -> 19 -> 0
        cycle = t % 38
        head_y = cycle if cycle < H else (38 - cycle)
        direction = 1 if cycle < H else -1
        color = PALETTE[(t // 38) % len(PALETTE)]

        for x in range(W):
            for k in range(tail_len):
                y = head_y - (k * direction)
                if 0 <= y < H:
                    fade = 1.0 - (k / tail_len)
                    if k == 0:
                        img[y, x] = (255, 255, 255)  # Bright white leading pixel
                    else:
                        img[y, x] = tuple(int(c * fade) for c in color)
        frames.append(img)
    return frames

# 2. SEQUENTIAL PALETTE DROP (Line 0 -> Line 29 Cascade)
def gen_sequential_palette_drop(seconds=12):
    frames = []
    tail_len = 7
    step_delay = 1.5  # Frames delay between each vertical line

    for t in range(seconds * FPS):
        img = np.zeros((H, W, 3), dtype=np.uint8)
        for x in range(W):
            local_t = t - (x * step_delay)
            if local_t >= 0:
                cycle_len = H + tail_len + 6
                pos = int(local_t) % cycle_len
                cycle_num = int(local_t) // cycle_len
                # Each vertical line picks the next color in the palette
                color = PALETTE[(x + cycle_num) % len(PALETTE)]

                for k in range(tail_len):
                    y = pos - k
                    if 0 <= y < H:
                        fade = 1.0 - (k / tail_len)
                        if k == 0:
                            img[y, x] = (255, 255, 255)
                        else:
                            img[y, x] = tuple(int(c * fade) for c in color)
        frames.append(img)
    return frames

# 3. SEQUENTIAL PALETTE STACKING (Drops & Fills Each Vertical Line)
def gen_sequential_palette_stack(seconds=12):
    frames = []
    # Track filled height per vertical line
    fill_heights = [0] * W
    drop_y = [0] * W
    active_col = 0
    palette_idx = 0

    for t in range(seconds * FPS):
        img = np.zeros((H, W, 3), dtype=np.uint8)

        # Draw already stacked pixels on all vertical lines
        for x in range(W):
            for row_from_bottom in range(fill_heights[x]):
                y = H - 1 - row_from_bottom
                col = PALETTE[(x + row_from_bottom // 4) % len(PALETTE)]
                img[y, x] = col

        # Animate falling droplet on the active & neighboring lines
        for offset in range(6):
            x = (active_col + offset) % W
            if fill_heights[x] < H:
                target_y = H - 1 - fill_heights[x]
                cy = (t * 2 + offset * 3) % (target_y + 1) if target_y > 0 else 0
                img[cy, x] = (255, 255, 255)
                if cy >= target_y:
                    fill_heights[x] += 1

        active_col = (active_col + 1) % W

        # Reset smoothly once all 30 lines are full
        if all(h >= H for h in fill_heights):
            fill_heights = [0] * W
            palette_idx = (palette_idx + 1) % len(PALETTE)

        frames.append(img)
    return frames

# 4. ALTERNATING ODD/EVEN LINES (Top-Down vs Bottom-Up Zipper)
def gen_alternating_vertical_zipper(seconds=10):
    frames = []
    tail_len = 6
    for t in range(seconds * FPS):
        img = np.zeros((H, W, 3), dtype=np.uint8)
        pos = t % (H + tail_len)
        for x in range(W):
            is_even = (x % 2 == 0)
            color = (255, 140, 0) if is_even else (0, 180, 255)  # Electric Blue vs Warm Amber
            for k in range(tail_len):
                step = pos - k
                if 0 <= step < H:
                    y = step if is_even else (H - 1 - step)
                    fade = 1.0 - (k / tail_len)
                    img[y, x] = (255, 255, 255) if k == 0 else tuple(int(c * fade) for c in color)
        frames.append(img)
    return frames

# 5. ALL LINES: CENTER-OUT VERTICAL SPLIT
def gen_center_out_vertical(seconds=8):
    frames = []
    for t in range(seconds * FPS):
        img = np.zeros((H, W, 3), dtype=np.uint8)
        spread = t % 12
        color = PALETTE[(t // 12) % len(PALETTE)]
        for x in range(W):
            # Subtle horizontal wave phase across the 30 lines
            local_spread = (spread + x // 3) % 12
            if local_spread < 10:
                top_y = 9 - local_spread
                bot_y = 10 + local_spread
                img[top_y, x] = color
                img[bot_y, x] = color
                if top_y + 1 <= 9:
                    img[top_y + 1, x] = tuple(int(c * 0.4) for c in color)
                if bot_y - 1 >= 10:
                    img[bot_y - 1, x] = tuple(int(c * 0.4) for c in color)
        frames.append(img)
    return frames

# ==========================================
# 3. AVI EXPORTER & 12MM LED SIMULATOR
# ==========================================
def write_avi(filename, frames):
    path = os.path.join(OUTPUT_DIR, filename)
    out = cv2.VideoWriter(path, fourcc, FPS, (W, H))
    for f in frames:
        out.write(f)
    out.release()
    print(f"[SAVED] {path} ({len(frames)} frames)")

def preview_led_toran(scenes, scale=24, delay_ms=50):
    scene_idx = 0
    frame_idx = 0
    paused = False

    while True:
        title, frames = scenes[scene_idx]
        f = frames[frame_idx]

        canvas = np.full((H * scale + 36, W * scale, 3), (18, 18, 22), dtype=np.uint8)
        for y in range(H):
            for x in range(W):
                bgr = tuple(int(c) for c in f[y, x])
                cx = x * scale + scale // 2
                cy = y * scale + scale // 2 + 36
                if sum(bgr) > 0:
                    halo = tuple(int(c * 0.35) for c in bgr)
                    cv2.circle(canvas, (cx, cy), int(scale * 0.44), halo, -1, cv2.LINE_AA)
                    cv2.circle(canvas, (cx, cy), int(scale * 0.32), bgr, -1, cv2.LINE_AA)
                else:
                    cv2.circle(canvas, (cx, cy), int(scale * 0.30), (38, 38, 45), -1, cv2.LINE_AA)

        hud = f"[{scene_idx+1}/{len(scenes)}] {title} (30x20) | [N] Next  [P] Pause  [Q] Quit"
        cv2.putText(canvas, hud, (10, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.50, (220, 220, 220), 1, cv2.LINE_AA)
        cv2.imshow("30x20 Vertical Line LED Simulator", canvas)

        key = cv2.waitKey(delay_ms) & 0xFF
        if key in (ord('q'), 27):
            break
        elif key in (ord('n'), ord(' ')):
            scene_idx = (scene_idx + 1) % len(scenes)
            frame_idx = 0
        elif key == ord('p'):
            paused = not paused

        if not paused:
            frame_idx += 1
            if frame_idx >= len(frames):
                frame_idx = 0
                scene_idx = (scene_idx + 1) % len(scenes)

    cv2.destroyAllWindows()

if __name__ == "__main__":
    print("Generating 30x20 Vertical Line & Sequential Palette Drop animations...")
    scenes = [
        ("01_All_Lines_Top_Bottom_Bounce", gen_all_lines_top_bottom(10)),
        ("02_Sequential_Palette_Drop",     gen_sequential_palette_drop(12)),
        ("03_Sequential_Palette_Stack",    gen_sequential_palette_stack(12)),
        ("04_Alternating_Up_Down_Zipper",  gen_alternating_vertical_zipper(10)),
        ("05_Center_Out_Vertical_Split",   gen_center_out_vertical(8)),
    ]

    all_frames = []
    for name, frames in scenes:
        write_avi(f"{name}.avi", frames)
        all_frames.extend(frames)

    write_avi("00_FULL_VERTICAL_LINES_SHOW_30x20.avi", all_frames)
    print(f"\nSaved all .avi files to: {os.path.abspath(OUTPUT_DIR)}")
    preview_led_toran(scenes)