import { DIRECTION_CHOICES, motionTime } from './direction.js';

const PALETTES = {
  spectrum: ['#168cff', '#00e5ff', '#31e66b', '#ffcc33', '#ff45c4', '#ff334f'],
  diwali: ['#ff4d00', '#ffc400', '#ff2e83', '#00d1ff'],
};

export const LARGE_SCALE_ENGINES = [
  { id: 'skyscraper_bottom_up_rise', name: 'Skyscraper Bottom-Up Column Rise', category: 'Vertical Lines' },
  { id: 'architectural_border_trace', name: 'Architectural Border & Inner Frame Trace', category: 'Facade & Curtain' },
  { id: 'pulsing_polygon_star', name: 'Pulsing Polygon Starburst', category: 'Geometric' },
  { id: 'concentric_target_rings', name: 'Concentric Target Ring Portholes', category: 'Geometric' },
  { id: 'split_horizon_wave', name: 'Two-Tone Split Horizon Wave', category: 'Facade & Curtain' },
  { id: 'diagonal_rainbow_curtain', name: 'Angled Diagonal Rainbow Curtain', category: 'Facade & Curtain' },
  { id: 'starlight_snow_drift', name: 'Starlight Snow Drift', category: 'Festive' },
];

const range = (key, label, min, max, step, value, unit = '') => ({ key, label, type: 'range', min, max, step, value, unit });
const choice = (key, label, items, value) => ({ key, label, type: 'select', items, value });
const toggle = (key, label, value) => ({ key, label, type: 'toggle', value });

function definitions(kind, width, height) {
  const speed = range('speed', 'Speed', 0.1, 3, 0.1, 1, '×');
  const controls = {
    skyscraper_bottom_up_rise: [
      speed, range('waveStagger', 'Wave stagger', 0, 3, 0.1, 1.2, '×'),
      toggle('tipGlow', 'Bright leading tip', true),
      choice('colorStyle', 'Colors', [['skyline', 'Skyline Gradient (original)'], ['palette', 'Use Color Mode']], 'skyline'),
      choice('direction', 'Direction', DIRECTION_CHOICES, 'forward'),
    ],
    architectural_border_trace: [
      speed, range('borderThickness', 'Border thickness', 1, Math.max(1, Math.min(3, Math.floor(Math.min(width, height) / 2))), 1, 1, 'px'),
      range('innerFrameScale', 'Inner frame scale', 0.3, 0.8, 0.05, 0.55),
      choice('chaseMode', 'Chase mode', [['solid', 'Solid Outline'], ['comet', 'Racing Comet']], 'comet'),
    ],
    pulsing_polygon_star: [
      speed, choice('starPoints', 'Star points', [4, 5, 6, 8].map((value) => [String(value), `${value} points`]), '5'),
      range('outerRadius', 'Outer radius', 20, 95, 1, 82, '%'),
      range('innerRadius', 'Inner radius', 10, 80, 1, 42, '%'),
      range('spinSpeed', 'Spin speed', 0, 3, 0.1, 0.8, '×'),
      toggle('whiteOutline', 'White outline', true),
    ],
    concentric_target_rings: [
      speed, range('gridSpacing', 'Grid spacing', 6, 16, 1, 10, 'px'),
      range('ringRadius', 'Ring radius', 1, Math.max(1, Math.min(8, Math.floor(Math.min(width, height) / 2))), 1, Math.min(4, Math.floor(Math.min(width, height) / 2)), 'px'),
      range('pulseAmplitude', 'Pulse amplitude', 0, 1, 0.05, 0.7),
    ],
    split_horizon_wave: [
      speed, range('splitRatio', 'Split ratio', 0.2, 0.8, 0.01, 0.5),
      range('waveHeight', 'Wave height', 0, 0.4, 0.01, 0.12, '×H'),
      range('seamThickness', 'Seam thickness', 1, Math.max(1, Math.min(6, height)), 1, Math.min(2, height), 'px'),
    ],
    diagonal_rainbow_curtain: [
      speed, range('angleDegrees', 'Curtain angle', -60, 60, 1, 28, '°'),
      range('bandWidth', 'Band width', 2, Math.max(2, Math.min(20, Math.max(width, height))), 1, Math.min(8, Math.max(width, height)), 'px'),
      choice('direction', 'Direction', DIRECTION_CHOICES, 'forward'),
    ],
    starlight_snow_drift: [
      speed, range('density', 'Density', 0.05, 0.5, 0.01, 0.18),
      range('swayAmount', 'Horizontal sway', 0, Math.max(0, Math.min(8, width / 4)), 0.1, Math.min(2, width / 4), 'px'),
      range('tailLength', 'Tail length', 1, Math.max(1, Math.min(8, height)), 1, Math.min(3, height), 'px'),
    ],
  };
  return controls[kind] || [];
}

function clamp(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

function mod(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function hash(x, y, seed) {
  let value = Math.imul((x | 0) ^ 0x9e3779b9, 0x85ebca6b);
  value = Math.imul(value ^ (y | 0), 0xc2b2ae35);
  value = Math.imul(value ^ (seed | 0), 0x27d4eb2f);
  return ((value ^ (value >>> 15)) >>> 0) / 4294967295;
}

function parseColor(color) {
  if (Array.isArray(color) && color.length >= 3) return color.slice(0, 3).map((channel) => clamp(channel, 0, 255, 0));
  if (typeof color === 'string' && /^#[\da-f]{6}$/i.test(color)) {
    return [1, 3, 5].map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16));
  }
  return [255, 255, 255];
}

function getColors() {
  return PALETTES.diwali.map(parseColor);
}

function colorAt(colors, position, brightness = 1) {
  const wrapped = mod(position, colors.length);
  const left = Math.floor(wrapped);
  const right = (left + 1) % colors.length;
  const mix = wrapped - left;
  return colors[left].map((channel, index) => Math.round(
    (channel * (1 - mix) + colors[right][index] * mix) * brightness,
  ));
}

function pixel(frame, width, height, x, y, color) {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || py < 0 || px >= width || py >= height) return;
  const offset = (py * width + px) * 3;
  frame[offset] = color[0];
  frame[offset + 1] = color[1];
  frame[offset + 2] = color[2];
}

function fill(frame, width, height, color) {
  for (let offset = 0; offset < frame.length; offset += 3) {
    frame[offset] = color[0];
    frame[offset + 1] = color[1];
    frame[offset + 2] = color[2];
  }
}

function hsvToRgb(hue, saturation, value) {
  const h = mod(hue, 1) * 6;
  const sector = Math.floor(h) % 6;
  const f = h - Math.floor(h);
  const p = value * (1 - saturation);
  const q = value * (1 - f * saturation);
  const u = value * (1 - (1 - f) * saturation);
  const rgb = [[value, u, p], [q, value, p], [p, value, u], [p, q, value], [u, p, value], [value, p, q]][sector];
  return rgb.map((channel) => Math.round(channel * 255));
}

const SKYSCRAPER_CYCLE_SECONDS = 5;
const SKYSCRAPER_WINDOW = [255, 245, 235];

function skyscraperLevel(progress, maxHeight) {
  if (progress < 0.45) return (1 - (1 - progress / 0.45) ** 3) * maxHeight;
  if (progress < 0.7) return maxHeight;
  return (1 - ((progress - 0.7) / 0.3) ** 2) * maxHeight;
}

function skyscraper(frame, width, height, index, fps, options, colors) {
  const seconds = index / fps;
  const speed = clamp(options.speed, 0.1, 3, 1);
  const timeDirection = options.direction === 'reverse' ? 'forward' : options.direction;
  const t = motionTime(seconds, speed, timeDirection);
  const stagger = clamp(options.waveStagger, 0, 3, 1.2);
  const topDown = options.direction === 'reverse' || options.direction === 'top-down';
  const skylineColors = options.colorStyle !== 'palette';
  for (let x = 0; x < width; x += 1) {
    const offset = x / Math.max(1, width - 1) * 1.5 * stagger + (hash(x, 1, 108) - 0.5) * 0.3;
    const maxHeight = 0.55 + hash(x, 2, 108) * 0.45;
    const progress = mod(t - offset, SKYSCRAPER_CYCLE_SECONDS) / SKYSCRAPER_CYCLE_SECONDS;
    const topPixel = Math.round(skyscraperLevel(progress, maxHeight) * height);
    for (let level = 0; level < height; level += 1) {
      const y = topDown ? level : height - 1 - level;
      if (level < topPixel) {
        const heightRatio = level / Math.max(1, height - 1);
        const windowPulse = Math.sin(t * 6 + hash(x, level, 211) * Math.PI * 2) * 0.5 + 0.5;
        if (level % 2 === 1 && windowPulse > 0.65) {
          pixel(frame, width, height, x, y, SKYSCRAPER_WINDOW);
          continue;
        }
        const brightness = 0.55 + 0.45 * heightRatio;
        const color = skylineColors
          ? hsvToRgb(0.58 - heightRatio * 0.46 + t * 0.03, 0.92, brightness)
          : colorAt(colors, heightRatio * (colors.length - 1) + t * 0.12, brightness);
        pixel(frame, width, height, x, y, color);
      } else if (level === topPixel && topPixel > 0 && options.tipGlow !== false) {
        pixel(frame, width, height, x, y, [255, 255, 255]);
      }
    }
  }
}

function perimeterPosition(x, y, left, top, right, bottom) {
  const width = Math.max(1, right - left);
  const height = Math.max(1, bottom - top);
  if (y === top) return x - left;
  if (x === right) return width + y - top;
  if (y === bottom) return width + height + right - x;
  return width * 2 + height + bottom - y;
}

function borderTrace(frame, width, height, index, fps, options, colors) {
  const t = motionTime(index / fps, clamp(options.speed, 0.1, 3, 1), options.direction);
  fill(frame, width, height, colorAt(colors, t * 0.12, 0.12 + 0.06 * (1 + Math.sin(t)) / 2));
  const thickness = Math.round(clamp(options.borderThickness, 1, Math.max(1, Math.min(3, width, height)), 1));
  const scale = clamp(options.innerFrameScale, 0.3, 0.8, 0.55);
  const insetX = Math.max(1, Math.round(width * (1 - scale) / 2));
  const insetY = Math.max(1, Math.round(height * (1 - scale) / 2));
  const frames = [
    [0, 0, width - 1, height - 1],
    [Math.min(insetX, Math.floor((width - 1) / 2)), Math.min(insetY, Math.floor((height - 1) / 2)),
      Math.max(Math.ceil((width - 1) / 2), width - 1 - insetX), Math.max(Math.ceil((height - 1) / 2), height - 1 - insetY)],
  ];
  frames.forEach(([left, top, right, bottom], frameIndex) => {
    const perimeter = Math.max(1, 2 * (right - left) + 2 * (bottom - top));
    const cometLength = Math.max(2, perimeter * 0.16);
    for (let y = top; y <= bottom; y += 1) {
      for (let x = left; x <= right; x += 1) {
        const edgeDistance = Math.min(x - left, right - x, y - top, bottom - y);
        if (edgeDistance >= thickness) continue;
        const path = perimeterPosition(x, y, left, top, right, bottom);
        let intensity = 1;
        if (options.chaseMode === 'comet') {
          const head = mod(path - t * 12 + frameIndex * perimeter / 2, perimeter);
          const distance = Math.min(mod(head, perimeter), mod(perimeter - head, perimeter));
          intensity = 0.16 + 0.84 * Math.max(0, 1 - distance / cometLength);
        }
        const chaseColors = [[255, 255, 255], [255, 195, 72]];
        pixel(frame, width, height, x, y, colorAt(chaseColors, path / perimeter * 2 + frameIndex, intensity));
      }
    }
  });
}

function polygonStar(frame, width, height, index, fps, options, colors) {
  const t = motionTime(index / fps, clamp(options.speed, 0.1, 3, 1), options.direction);
  const points = [4, 5, 6, 8].includes(Number(options.starPoints)) ? Number(options.starPoints) : 5;
  const outer = Math.min(width, height) / 2 * clamp(options.outerRadius, 20, 95, 82) / 100;
  const inner = outer * clamp(options.innerRadius, 10, 80, 42) / 100;
  const spin = t * clamp(options.spinSpeed, 0, 3, 0.8);
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const radius = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx) - spin;
      const wave = (Math.cos(points * angle) + 1) / 2;
      const boundary = inner + (outer - inner) * wave;
      const background = 0.08 + 0.16 * (0.5 + 0.5 * Math.sin(radius * 0.8 - t * 2 + Math.cos(angle * 3)));
      const outline = Math.abs(radius - boundary) <= 0.75;
      const inStar = radius < boundary;
      const color = outline && options.whiteOutline !== false
        ? [255, 255, 255]
        : inStar
          ? colorAt(colors, angle / (Math.PI * 2) * colors.length + t * 0.3, 0.45 + 0.55 * (1 - radius / Math.max(1, outer)))
          : colorAt(colors, radius * 0.25 + angle * 0.3 + t * 0.2, background);
      pixel(frame, width, height, x, y, color);
    }
  }
}

function targetRings(frame, width, height, index, fps, options, colors) {
  const spacing = clamp(options.gridSpacing, 6, 16, 10);
  const ringRadius = clamp(options.ringRadius, 1, Math.max(1, Math.min(8, Math.floor(Math.min(width, height) / 2))), 4);
  const amplitude = clamp(options.pulseAmplitude, 0, 1, 0.7);
  const t = motionTime(index / fps, clamp(options.speed, 0.1, 3, 1), options.direction);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const cx = Math.round((x - spacing / 2) / spacing) * spacing + spacing / 2;
      const cy = Math.round((y - spacing / 2) / spacing) * spacing + spacing / 2;
      const radius = Math.hypot(x - cx, y - cy);
      const pulse = mod(t * 2 + cx * 0.07 + cy * 0.05, ringRadius * 3 + 2);
      const coreRadius = Math.max(0.7, ringRadius * (0.22 + 0.22 * amplitude));
      const whiteRadius = ringRadius * (0.55 + 0.18 * Math.sin(t * 2 + cx));
      const haloRadius = Math.max(0.8, pulse);
      let color = [0, 0, 0];
      if (radius <= coreRadius) color = colorAt(colors, cx * 0.1 + cy * 0.1 + t * 0.3, 0.5 + 0.5 * amplitude);
      else if (Math.abs(radius - whiteRadius) <= 0.75) color = [255, 255, 255];
      else if (radius <= haloRadius) color = colorAt(colors, radius / Math.max(1, ringRadius) + t * 0.2, Math.max(0.06, 0.35 * (1 - radius / Math.max(1, haloRadius))));
      pixel(frame, width, height, x, y, color);
    }
  }
}

function horizon(frame, width, height, index, fps, options, colors) {
  const t = motionTime(index / fps, clamp(options.speed, 0.1, 3, 1), options.direction);
  const ratio = clamp(options.splitRatio, 0.2, 0.8, 0.5);
  const waveHeight = clamp(options.waveHeight, 0, 0.4, 0.12) * height;
  const thickness = clamp(options.seamThickness, 1, Math.max(1, Math.min(6, height)), 2);
  for (let x = 0; x < width; x += 1) {
    const wave = Math.sin(x / Math.max(1, width - 1) * Math.PI * 2 + t * 1.4) * waveHeight;
    const seam = ratio * (height - 1) + wave;
    for (let y = 0; y < height; y += 1) {
      const distance = Math.abs(y - seam);
      if (distance <= thickness / 2) {
        const sparkle = hash(x, y, Math.floor(index / 2)) > 0.84 ? 1 : 0.75;
        pixel(frame, width, height, x, y, [255, Math.round(220 * sparkle), Math.round(185 * sparkle)]);
      } else {
        const zone = y < seam ? 0 : 1;
        const glow = Math.max(0.25, 1 - distance / Math.max(1, height * 0.55));
        pixel(frame, width, height, x, y, colorAt(colors, zone * 2 + x / Math.max(1, width - 1) * 0.35 + t * 0.08, glow));
      }
    }
  }
}

function diagonalCurtain(frame, width, height, index, fps, options, colors) {
  const speed = clamp(options.speed, 0.1, 3, 1);
  const t = motionTime(index / fps, speed, options.direction);
  const angle = clamp(options.angleDegrees, -60, 60, 28) * Math.PI / 180;
  const bandWidth = clamp(options.bandWidth, 2, Math.max(2, Math.min(20, Math.max(width, height))), 8);
  const span = Math.max(1, width * Math.abs(Math.cos(angle)) + height * Math.abs(Math.sin(angle)));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const coordinate = x * Math.cos(angle) + y * Math.sin(angle) - t * bandWidth * 2;
      const palettePosition = mod(coordinate / bandWidth, colors.length);
      const shimmer = 0.72 + 0.28 * (0.5 + 0.5 * Math.sin(coordinate / span * Math.PI * 2 - t));
      pixel(frame, width, height, x, y, colorAt(colors, palettePosition, shimmer));
    }
  }
}

function snowDrift(frame, width, height, index, fps, options, colors) {
  fill(frame, width, height, colorAt(colors, 0.65, 0.045));
  const t = motionTime(index / fps, clamp(options.speed, 0.1, 3, 1), options.direction);
  const density = clamp(options.density, 0.05, 0.5, 0.18);
  const sway = clamp(options.swayAmount, 0, Math.min(8, width / 4), 2);
  const tail = Math.round(clamp(options.tailLength, 1, Math.max(1, Math.min(8, height)), 3));
  const particles = Math.max(1, Math.round(width * height * density / 3));
  for (let particle = 0; particle < particles; particle += 1) {
    const seed = particle + 31;
    const startX = hash(seed, 17, 7) * width;
    const startY = hash(seed, 29, 11) * height;
    const fallSpeed = 1.2 + hash(seed, 43, 13) * 2.8;
    const phase = hash(seed, 53, 19) * Math.PI * 2;
    const x = startX + Math.sin(t * 1.4 + phase) * sway;
    const y = mod(startY + t * fallSpeed, height + tail) - tail;
    const warm = hash(seed, 61, 23) > 0.58;
    for (let trail = 0; trail < tail; trail += 1) {
      const brightness = Math.max(0.18, 1 - trail / tail);
      const rgb = warm ? [255, Math.round(190 * brightness), Math.round(82 * brightness)]
        : [Math.round(220 * brightness), Math.round(245 * brightness), 255];
      pixel(frame, width, height, x - Math.sin(t * 1.4 + phase) * trail * 0.12, y - trail, rgb);
    }
  }
}

const renderers = {
  skyscraper_bottom_up_rise: skyscraper,
  architectural_border_trace: borderTrace,
  pulsing_polygon_star: polygonStar,
  concentric_target_rings: targetRings,
  split_horizon_wave: horizon,
  diagonal_rainbow_curtain: diagonalCurtain,
  starlight_snow_drift: snowDrift,
};

export const LargeScaleEffects = Object.freeze({
  engines: LARGE_SCALE_ENGINES,
  isEffect: (kind) => Object.hasOwn(renderers, kind),
  keepsOriginalColors: (kind, options = {}) => kind === 'skyscraper_bottom_up_rise' && options.colorStyle !== 'palette',
  getParameters: definitions,
  defaultOptions(kind, _modifier, width = 30, height = 20) {
    const defaults = Object.fromEntries(definitions(kind, width, height).map((item) => [item.key, item.value]));
    return defaults;
  },
  render(kind, width, height, frameIndex, fps = 20, options = {}) {
    if (!Object.hasOwn(renderers, kind)) throw new Error(`Unknown large-scale effect: ${kind}.`);
    if (!Number.isInteger(width) || width < 1 || width > 120 || !Number.isInteger(height) || height < 1 || height > 80) {
      throw new Error('Matrix must be between 1×1 and 120×80.');
    }
    if (!Number.isInteger(fps) || fps < 1 || fps > 60) throw new Error('FPS must be from 1 to 60.');
    const frame = new Uint8Array(width * height * 3);
    const colors = getColors();
    const renderOptions = { ...options, direction: options.direction || 'forward' };
    renderers[kind](frame, width, height, frameIndex, fps, renderOptions, colors);
    return frame;
  },
});
