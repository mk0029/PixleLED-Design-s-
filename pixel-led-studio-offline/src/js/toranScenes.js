// Five Toran ripple scenes with fixed colors on black; p is the loop phase in [0, 1).
const BAND_COLORS = [[0, 70, 255], [0, 255, 40], [255, 220, 0], [255, 0, 0]];
const DIAMOND_COLORS = [[0, 255, 255], [255, 0, 255], [120, 255, 0]];
const DROP_COLORS = [[0, 160, 255], [0, 255, 200], [170, 60, 255]];
const FRAME_COLORS = [[255, 190, 0], [255, 90, 0], [255, 40, 140]];
const CHEVRON_COLORS = [[255, 0, 0], [255, 140, 0], [255, 255, 0], [0, 255, 0], [0, 200, 255], [60, 0, 255], [220, 0, 255]];
const RED = [255, 0, 0];
const WHITE = [255, 255, 255];
const DROP_SOURCES = [[0.22, 0.30, 0], [0.70, 0.62, 1 / 3], [0.45, 0.85, 2 / 3]];

const mod = (value, divisor) => ((value % divisor) + divisor) % divisor;
const pick = (colors, index) => colors[mod(index, colors.length)];

function sparkle(frameIndex, x, y, source) {
  const value = Math.sin(frameIndex * 12.9898 + x * 78.233 + y * 37.719 + source * 4.581) * 43758.5453;
  return value - Math.floor(value);
}

function sineBands(x, y, W, H, p) {
  const amplitude = Math.max(1, H * 0.14);
  const shifted = mod(y - amplitude * Math.sin(2 * Math.PI * (x / W * 1.5 - p * 2)), H);
  const bandHeight = H / 4;
  return mod(shifted, bandHeight) < Math.max(1, bandHeight - 1) ? pick(BAND_COLORS, Math.floor(shifted / bandHeight)) : null;
}

function diamondRipple(x, y, W, H, p) {
  const spacing = 4;
  const phase = Math.abs(x - W / 2) + Math.abs(y - H / 2) - p * spacing * 6;
  return mod(phase, spacing) < 1.5 ? pick(DIAMOND_COLORS, Math.floor(phase / spacing)) : null;
}

function waterDrops(x, y, W, H, p, frameIndex) {
  const maxRadius = Math.hypot(W, H) * 0.45;
  let color = null;
  DROP_SOURCES.forEach(([sx, sy, start], index) => {
    const cycle = mod(p * 3 + start, 1);
    const radius = cycle * maxRadius;
    const distance = Math.hypot(x - sx * W, (y - sy * H) * 1.2);
    if (distance < radius - 0.8 && distance > radius - 4 && sparkle(frameIndex, x, y, index) < 0.18 * (1 - cycle)) color = WHITE;
    if (Math.abs(distance - radius) < 0.8) color = DROP_COLORS[index];
  });
  return color;
}

function topBorderPulse(x, y, W, H, p) {
  if (y < 1) return RED;
  const innerHeight = H - 1;
  const distance = Math.max(Math.abs(x - W / 2) * innerHeight / W, Math.abs(y - (1 + innerHeight / 2)));
  const spacing = 3;
  const phase = distance - p * spacing * FRAME_COLORS.length * 2;
  return mod(phase, spacing) < 1 ? pick(FRAME_COLORS, Math.floor(phase / spacing)) : null;
}

function chevron(x, y, W, H, p) {
  const zigPeriod = Math.max(2, Math.min(10, Math.floor(H / 2) || 2));
  const zig = Math.abs(mod(y - 0.5, zigPeriod) - zigPeriod / 2);
  const spacing = 5;
  const phase = x + zig - p * spacing * CHEVRON_COLORS.length;
  return mod(phase, spacing) < 2 ? pick(CHEVRON_COLORS, -Math.floor(phase / spacing)) : null;
}

const SCENES = {
  toran_sine_bands: ['Multi-Band Sine Wave', sineBands],
  toran_diamond_ripple: ['Concentric Diamond Ripple', diamondRipple],
  toran_water_drops: ['Multi-Point Water Drop Ripples', waterDrops],
  toran_top_border_pulse: ['Top-Border Rectangular Pulse', topBorderPulse],
  toran_chevron: ['Diagonal Chevron Wave', chevron],
};

export const TORAN_LOOP_SECONDS = 12;

export const ToranScenes = Object.freeze({
  engines: Object.entries(SCENES).map(([id, [name]]) => [name, id]),
  isScene: (kind) => Object.hasOwn(SCENES, kind),
  render(kind, width, height, p, frameIndex, applyBrightness) {
    const scene = SCENES[kind][1];
    const frame = new Uint8Array(width * height * 3);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const color = scene(x + 0.5, y + 0.5, width, height, p, frameIndex);
        if (color) frame.set(applyBrightness(color), (y * width + x) * 3);
      }
    }
    return frame;
  },
});
