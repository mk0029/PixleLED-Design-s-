// Twelve fixed-color vertical-strip animations; each frame is a pure function of t in seconds.
const SOURCE_FPS = 30;
const WHITE = [255, 255, 255];
const mod = (value, divisor) => ((value % divisor) + divisor) % divisor;
const clamp01 = (value) => Math.max(0, Math.min(1, value));
const noise = (index, seed) => {
  const value = Math.sin(index * 12.9898 + seed * 78.233) * 43758.5453;
  return value - Math.floor(value);
};

function hsv(hue, saturation, value) {
  const h = mod(hue, 1);
  const sector = Math.floor(h * 6) % 6;
  const fraction = h * 6 - Math.floor(h * 6);
  const p = value * (1 - saturation);
  const q = value * (1 - fraction * saturation);
  const r = value * (1 - (1 - fraction) * saturation);
  const rgb = [[value, r, p], [q, value, p], [p, value, r], [p, q, value], [r, p, value], [value, p, q]][sector];
  return rgb.map((channel) => Math.floor(channel * 255));
}

function matrixRain(W, H, t) {
  const trail = Math.max(6, Math.floor(H / 2));
  const heads = Array.from({ length: W }, (_, x) => {
    const gap = 1 + noise(x, 3) * 5;
    const start = noise(x, 1) * 2 * H - H;
    const speed = 0.35 + noise(x, 2) * 0.5;
    return Math.trunc(mod(start + gap + speed * t * SOURCE_FPS, H + trail + gap) - gap);
  });
  return (x, y) => {
    const distance = heads[x] - y;
    if (distance === 0) return WHITE;
    if (distance <= 0 || distance >= trail) return null;
    const intensity = (1 - distance / trail) ** 1.5;
    return [0, 255 * intensity, 80 * intensity];
  };
}

function liquidFire(W, H, t) {
  return (x, y) => {
    const ny = 1 - y / Math.max(1, H - 1);
    const n1 = Math.sin(x * 0.4 + t * 4.0) * 0.5 + 0.5;
    const n2 = Math.sin(x * 0.8 - y * 0.35 + t * 7.5) * 0.5 + 0.5;
    const n3 = Math.cos(x * 0.25 + y * 0.5 + t * 5.2) * 0.5 + 0.5;
    const heat = clamp01((n1 * 0.35 + n2 * 0.4 + n3 * 0.25) * ny ** 0.85 * 1.35);
    if (heat > 0.75) return [255, 255, (heat - 0.75) * 4 * 255];
    if (heat > 0.4) return [255, (heat - 0.4) / 0.35 * 220, 0];
    if (heat > 0.12) return [(heat - 0.12) / 0.28 * 255, 0, 0];
    return null;
  };
}

function barHeight(x, H, t) {
  const value = Math.sin(x * 0.35 + t * 5.0) * 0.35 + Math.cos(x * 0.7 - t * 8.0) * 0.3 + Math.sin(t * 6.0 + x) * 0.2 + 0.5;
  return Math.max(1, Math.min(Math.max(1, H - 1), Math.trunc(value * (H - 2))));
}

function peakEqualizer(W, H, t) {
  const bars = Array.from({ length: W }, (_, x) => barHeight(x, H, t));
  const peaks = Array.from({ length: W }, (_, x) => {
    let peak = 0;
    for (let lag = 0; lag <= 4 * H; lag += 1) peak = Math.max(peak, barHeight(x, H, t - lag / SOURCE_FPS) - lag * 0.25);
    return Math.trunc(peak);
  });
  return (x, y) => {
    const level = H - 1 - y;
    if (level <= bars[x]) return hsv(0.35 - level / H * 0.35, 1, 1);
    return level === peaks[x] ? WHITE : null;
  };
}

function waterfallSplash(W, H, t) {
  return (x, y) => {
    let color = null;
    if (x % 3 === 0) {
      const flow = Math.sin(y * 0.5 - t * 12.0 + x) * 0.5 + 0.5;
      color = [120 * flow, 180 + 75 * flow, 255];
    }
    if (y >= H - 3 && Math.min(x % 3, 3 - (x % 3)) === 1) {
      const splash = Math.sin(t * 15.0 + x * 2.1 + y) * 0.5 + 0.5;
      if (splash > 0.55) color = [255 * splash * 0.85, 255 * splash, 255 * splash];
    }
    return color;
  };
}

function dnaHelix(W, H, t) {
  const center = (H - 1) / 2;
  const amplitude = (H - 3) / 2;
  return (x, y) => {
    const phase = x * 0.28 - t * 4.5;
    const y1 = center + Math.sin(phase) * amplitude;
    const y2 = center + Math.sin(phase + Math.PI) * amplitude;
    let color = null;
    if (x % 3 === 0 && y >= Math.trunc(Math.min(y1, y2)) && y <= Math.trunc(Math.max(y1, y2))) color = [40, 50, 70];
    const d1 = Math.abs(y - y1);
    const d2 = Math.abs(y - y2);
    if (d1 < 1.3) color = [0, 210 * (1 - d1 / 1.3), 255 * (1 - d1 / 1.3)];
    if (d2 < 1.3) color = [255 * (1 - d2 / 1.3), 140 * (1 - d2 / 1.3), 0];
    return color;
  };
}

function cometSweep(W, H, t) {
  const cycle = t * 1.4;
  const position = (Math.sin(cycle) * 0.5 + 0.5) * (W - 1);
  const direction = Math.cos(cycle) >= 0 ? 1 : -1;
  return (x) => {
    const diff = (position - x) * direction;
    if (diff < -1 || diff > 10) return null;
    if (Math.abs(x - position) < 0.8) return WHITE;
    return hsv(t * 0.15, 0.9, clamp01(diff >= 0 ? Math.exp(-diff * 0.35) : 1 + diff));
  };
}

function shutterWeave(W, H, t) {
  return (x, y) => {
    const even = x % 2 === 0;
    const wave = Math.sin(y * 0.45 + (even ? 1 : -1) * t * 5.5 + x * 0.15) * 0.5 + 0.5;
    return wave > 0.35 ? hsv((even ? 0.55 : 0.88) + wave * 0.1, 0.95, wave) : null;
  };
}

function pluckedString(W, H, t) {
  const pluck = Math.abs(Math.sin(t * 2.2));
  return (x, y) => {
    const normX = x / Math.max(1, W - 1);
    const stringY = (H - 1) / 2 + Math.sin(normX * 10.0 - t * 18.0) * (H * 0.42) * Math.sin(normX * Math.PI) * pluck;
    const distance = Math.abs(y - stringY);
    if (distance >= 2.2) return null;
    return distance < 0.7 ? WHITE : hsv(0.52 + normX * 0.3, 1, (1 - distance / 2.2) ** 1.6);
  };
}

function prismaticPlasma(W, H, t) {
  return (x, y) => {
    const value = Math.sin(x * 0.22 + t * 2.5) + Math.sin(y * 0.28 - t * 2.0) + Math.sin((x + y) * 0.18 + t * 3.0)
      + Math.sin(Math.hypot(x - W / 2, y - H / 2) * 0.3 - t * 3.5);
    return hsv((value + 4) / 8 + t * 0.08, 1, 1);
  };
}

function spiralVortex(W, H, t) {
  return (x, y) => {
    const dx = x - (W - 1) / 2;
    const dy = (y - (H - 1) / 2) * (W / Math.max(1, H));
    const angle = Math.atan2(dy, dx);
    const radius = Math.hypot(dx, dy);
    const spiral = Math.sin(angle * 3.0 + radius * 0.45 - t * 6.0) * 0.5 + 0.5;
    return hsv(angle / (2 * Math.PI) + radius * 0.02 - t * 0.15, 0.95, spiral ** 1.3);
  };
}

function kaleidoscope(W, H, t) {
  return (x, y) => {
    const mx = Math.abs(x - (W - 1) / 2);
    const my = Math.abs(y - (H - 1) / 2);
    const pattern = Math.sin(mx * 0.45 - t * 4.0) * Math.cos(my * 0.45 + t * 3.2);
    const value = clamp01((pattern + Math.sin((mx + my) * 0.4 - t * 5.0)) * 0.5 + 0.3);
    return value > 0.2 ? hsv((mx + my) * 0.03 + t * 0.2, 1, value) : null;
  };
}

function voronoiCaustics(W, H, t) {
  const points = Array.from({ length: 8 }, (_, i) => [
    (Math.sin(t * (0.9 + i * 0.17) + i * 2.1) * 0.45 + 0.5) * W,
    (Math.cos(t * (0.8 + i * 0.13) + i * 1.7) * 0.45 + 0.5) * H,
  ]);
  return (x, y) => {
    let d1 = Infinity;
    let d2 = Infinity;
    for (const [px, py] of points) {
      const d = Math.hypot(x - px, (y - py) * 1.3);
      if (d < d1) [d1, d2] = [d, d1];
      else if (d < d2) d2 = d;
    }
    const caustic = clamp01(1 - (d2 - d1) * 0.35) ** 2.2;
    return [190 * caustic ** 2, 40 + 215 * caustic, 80 + 175 * caustic];
  };
}

const ANIMATIONS = {
  vline_matrix_rain: ['Matrix Rain', matrixRain],
  vline_liquid_fire: ['Liquid Fire', liquidFire],
  vline_peak_equalizer: ['Peak-Hold Equalizer Bars', peakEqualizer],
  vline_waterfall_splash: ['Waterfall & Splash', waterfallSplash],
  vline_dna_helix: ['Cyan-Amber DNA Double Helix', dnaHelix],
  vline_comet_sweep: ['Comet Curtain Sweep', cometSweep],
  vline_shutter_weave: ['Venetian Shutter Weave', shutterWeave],
  vline_plucked_string: ['Plucked String Wave', pluckedString],
  vline_prismatic_plasma: ['Prismatic Plasma', prismaticPlasma],
  vline_spiral_vortex: ['Polar Spiral Vortex', spiralVortex],
  vline_kaleidoscope: ['4-Way Kaleidoscope', kaleidoscope],
  vline_voronoi_caustics: ['Voronoi Water Caustics', voronoiCaustics],
};

export const VerticalAnimations = Object.freeze({
  engines: Object.entries(ANIMATIONS).map(([id, [name]]) => [name, id]),
  isAnimation: (kind) => Object.hasOwn(ANIMATIONS, kind),
  render(kind, width, height, t, applyBrightness) {
    const pixel = ANIMATIONS[kind][1](width, height, t);
    const frame = new Uint8Array(width * height * 3);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const color = pixel(x, y);
        if (color) frame.set(applyBrightness(color.map((channel) => Math.max(0, Math.min(255, Math.trunc(channel))))), (y * width + x) * 3);
      }
    }
    return frame;
  },
});
