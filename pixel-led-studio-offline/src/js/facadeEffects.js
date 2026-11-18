import { DIRECTION_CHOICES } from './direction.js';

const PALETTES = {
  diwali: ['#ff4d00', '#ffc400', '#ff2e83', '#00d1ff'],
};

export const FACADE_ENGINES = [
  { id: 'tier_waterfall_sparkle', name: 'Multi-Tier Waterfall & Sparkle Drip', category: 'Facade & Curtain' },
  { id: 'opposing_color_collide', name: 'Dual-Color Opposing Curtain Wave', category: 'Facade & Curtain' },
  { id: 'pillar_block_chaser', name: 'Alternating Vertical Pillar Blocks', category: 'Facade & Curtain' },
  { id: 'tricolor_ribbon_scroll', name: 'Multi-Band Horizontal Ribbon Scroll', category: 'Facade & Curtain' },
  { id: 'rotating_quadrant_wheel', name: 'Spinning Pinwheel & Quadrant Wheel', category: 'Geometric' },
  { id: 'tiled_diamond_lattice', name: 'Tiled Diamond Lattice & Pulsing Core', category: 'Geometric' },
];

const range = (key, label, min, max, step, value, unit = '') => ({ key, label, type: 'range', min, max, step, value, unit });
const choice = (key, label, items, value) => ({ key, label, type: 'select', items, value });
const toggle = (key, label, value) => ({ key, label, type: 'toggle', value });

function definitions(kind, width, height) {
  const speed = range('speed', 'Speed', 0.1, 3, 0.1, 1, '×');
  const direction = choice('direction', 'Direction', DIRECTION_CHOICES, 'forward');
  const seamMax = Math.max(1, Math.min(8, height));
  const geometryMax = Math.max(1, Math.floor(Math.min(width, height) / 2));
  const controls = {
    tier_waterfall_sparkle: [
      speed, range('curtainHeight', 'Curtain height', 1, Math.max(1, Math.min(12, height)), 1, Math.max(1, Math.min(4, height)), 'px'),
      range('sparkleDensity', 'Sparkle density', 0, 1, 0.05, 0.3),
      range('waveCurve', 'Wave curve', 0, 3, 0.1, 1.2), direction,
    ],
    opposing_color_collide: [
      speed, range('waveAmplitude', 'Wave amplitude', 0.05, 1, 0.05, 0.65),
      range('seamThickness', 'Seam thickness', 1, seamMax, 1, Math.min(2, seamMax), 'px'),
      range('pulseRate', 'Pulse rate', 0.1, 3, 0.1, 1.2, '×'),
    ],
    pillar_block_chaser: [
      speed, range('pillarWidth', 'Pillar width', 1, Math.max(1, Math.min(8, width)), 1, Math.max(1, Math.min(3, width)), 'col'),
      range('dropAmplitude', 'Drop amplitude', 0, 1, 0.05, 0.75), direction,
    ],
    tricolor_ribbon_scroll: [
      speed, range('ribbonThickness', 'Ribbon thickness', Math.min(2, height), Math.max(1, Math.min(8, height)), 1, Math.min(3, height), 'px'),
      choice('gapSize', 'Gap size', [['0', 'No gap'], ['1', '1 px']], '1'),
      range('waveRipple', 'Wave ripple', 0, 3, 0.1, 0.7), direction,
    ],
    rotating_quadrant_wheel: [
      speed, range('outerRingRadius', 'Outer ring size', 20, 95, 1, 82, '%'),
      range('innerRingRadius', 'Inner hub size', 0, 50, 1, 18, '%'),
      choice('spokeCount', 'Spoke count', [2, 3, 4, 6, 8].map((value) => [String(value), `${value} spokes`]), '4'),
      range('ringThickness', 'Ring thickness', 1, Math.max(1, Math.min(8, geometryMax)), 1, Math.min(2, geometryMax), 'px'),
      toggle('showRingOutline', 'Show ring outline', true), direction,
    ],
    tiled_diamond_lattice: [
      speed, range('diamondSize', 'Diamond tile size', 3, 10, 1, Math.max(3, Math.min(6, geometryMax)), 'px'),
      range('borderThickness', 'Border thickness', 1, 4, 1, 1, 'px'),
      range('corePulseSpeed', 'Core pulse speed', 0.1, 3, 0.1, 1.1, '×'),
      choice('scrollMode', 'Scroll mode', [['static', 'Static'], ['horizontal', 'Horizontal'], ['diagonal', 'Diagonal']], 'diagonal'),
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

function hash(x, y, frame) {
  let value = Math.imul((x | 0) ^ 0x9e3779b9, 0x85ebca6b);
  value = Math.imul(value ^ (y | 0), 0xc2b2ae35);
  value = Math.imul(value ^ (frame | 0), 0x27d4eb2f);
  return ((value ^ (value >>> 15)) >>> 0) / 4294967295;
}

function parseColor(color) {
  if (Array.isArray(color) && color.length >= 3) {
    return color.slice(0, 3).map((channel) => clamp(channel, 0, 255, 0));
  }
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
  const leftIndex = Math.floor(wrapped);
  const rightIndex = (leftIndex + 1) % colors.length;
  const fraction = wrapped - leftIndex;
  return colors[leftIndex].map((channel, index) => Math.round(
    (channel * (1 - fraction) + colors[rightIndex][index] * fraction) * brightness,
  ));
}

function directionTime(frameIndex, fps, speed, direction, period = 4) {
  const elapsed = frameIndex / fps * speed;
  if (direction === 'reverse') return -elapsed;
  if (direction === 'bounce') {
    const phase = mod(elapsed, period * 2);
    return phase <= period ? phase : period * 2 - phase;
  }
  return elapsed;
}

function writePixel(frame, width, x, y, rgb) {
  if (x < 0 || y < 0 || x >= width) return;
  const offset = (y * width + x) * 3;
  frame[offset] = rgb[0];
  frame[offset + 1] = rgb[1];
  frame[offset + 2] = rgb[2];
}

function waterfall(frame, width, height, index, fps, options, colors) {
  const speed = clamp(options.speed, .1, 3, 1);
  const curtain = clamp(options.curtainHeight, 1, height, Math.min(4, height));
  const sparkle = clamp(options.sparkleDensity, 0, 1, .3);
  const curve = clamp(options.waveCurve, 0, 3, 1.2);
  const direction = options.direction || 'forward';
  const t = directionTime(index, fps, speed, direction, Math.max(2, height / Math.max(1, curtain)));
  const travel = t * (height / Math.max(1, curtain));
  const sparkleFrame = Math.floor(index / 2);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const wave = Math.sin((x / Math.max(1, width - 1)) * Math.PI * 2 + t * .9) * curve * Math.max(1, curtain * .45);
      const position = mod(y - travel + wave, Math.max(1, height));
      const tier = Math.floor((y - travel + wave) / Math.max(1, curtain));
      const onCurtain = position < curtain;
      const sparkleHead = mod(y - travel + wave - curtain, Math.max(1, height)) < Math.max(1, curtain * 1.4);
      const twinkle = sparkleHead && hash(x * 13 + index % 17, y * 7, sparkleFrame) < sparkle * .24;
      if (onCurtain) {
        const shimmer = .58 + .42 * (1 + Math.sin(x * .22 + index * .12)) / 2;
        const palettePosition = tier * .7 + x / Math.max(1, width) * .8;
        writePixel(frame, width, x, y, colorAt(colors, palettePosition, shimmer));
      } else if (twinkle) {
        writePixel(frame, width, x, y, hash(x, y, sparkleFrame) > .5 ? [255, 255, 255] : [100, 235, 255]);
      }
    }
  }
}

function opposingCurtain(frame, width, height, index, fps, options, colors) {
  const speed = clamp(options.speed, .1, 3, 1);
  const amplitude = clamp(options.waveAmplitude, .05, 1, .65);
  const seam = clamp(options.seamThickness, 1, Math.min(8, height), 2);
  const pulseRate = clamp(options.pulseRate, .1, 3, 1.2);
  const t = directionTime(index, fps, speed, options.direction || 'forward');
  const pulse = .68 + .32 * (1 + Math.sin(t * pulseRate * Math.PI * 2)) / 2;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const theta = x / Math.max(1, width - 1) * Math.PI * 2 + t * pulseRate;
      const waveA = (height - 1) * (.5 + amplitude * .48 * Math.sin(theta));
      const waveB = (height - 1) * (.5 + amplitude * .48 * Math.sin(theta + Math.PI));
      const distanceA = Math.abs(y - waveA);
      const distanceB = Math.abs(y - waveB);
      const collision = (waveA + waveB) / 2;
      const seamDistance = Math.abs(y - collision);
      if (seamDistance <= seam / 2) {
        writePixel(frame, width, x, y, colorAt([[255, 255, 255], [255, 120, 195]], t * .5 + x / width, pulse));
      } else {
        const distance = Math.min(distanceA, distanceB);
        const glow = Math.max(0, 1 - distance / Math.max(1, height * .16));
        const side = y < collision ? 0 : 1;
        const rgb = colorAt(colors, side * 2 + (distanceA < distanceB ? .12 : .65), .12 + glow * .88);
        writePixel(frame, width, x, y, rgb);
      }
    }
  }
}

function pillars(frame, width, height, index, fps, options, colors) {
  const pillarWidth = Math.round(clamp(options.pillarWidth, 1, Math.min(8, width), Math.min(3, width)));
  const drop = clamp(options.dropAmplitude, 0, 1, .75);
  const direction = options.direction || 'forward';
  const t = directionTime(index, fps, clamp(options.speed, .1, 3, 1), direction);
  for (let x = 0; x < width; x += 1) {
    const group = Math.floor(x / pillarWidth);
    const phase = t * 1.8 + group * .74 + (x % pillarWidth) * .09;
    const level = Math.max(0, Math.min(1, .18 + (1 - drop) * .62 + drop * (.5 + .5 * Math.sin(phase))));
    const colorIndex = group % 2 ? 1.4 : 0;
    for (let y = 0; y < height; y += 1) {
      const vertical = 1 - y / Math.max(1, height - 1);
      const cascade = Math.max(0, Math.min(1, 1 - Math.abs(vertical - level) * Math.max(2, height * .22)));
      const lit = vertical <= level ? .35 + .65 * cascade : 0;
      if (lit > .1) writePixel(frame, width, x, y, colorAt(colors, colorIndex + (vertical < level * .25 ? .45 : 0), lit));
    }
  }
}

function ribbons(frame, width, height, index, fps, options, colors) {
  const speed = clamp(options.speed, .1, 3, 1);
  const thickness = Math.round(clamp(options.ribbonThickness, Math.min(2, height), Math.min(8, height), Math.min(3, height)));
  const gap = Math.round(clamp(options.gapSize, 0, 1, 1));
  const ripple = clamp(options.waveRipple, 0, 3, .7);
  const cycle = Math.max(1, thickness + gap);
  const t = directionTime(index, fps, speed, options.direction || 'forward');
  for (let x = 0; x < width; x += 1) {
    const wave = Math.sin(x / Math.max(1, width - 1) * Math.PI * 2 + t * 1.5) * ripple;
    for (let y = 0; y < height; y += 1) {
      const scroll = t * Math.max(1, thickness) * 2;
      const phase = mod(y - scroll + wave, cycle);
      if (phase < thickness) {
        const band = Math.floor((y - scroll) / cycle);
        const glow = .78 + .22 * (1 + Math.sin(x * .12 + t * 2 + band)) / 2;
        writePixel(frame, width, x, y, colorAt(colors, band + .15, glow));
      }
    }
  }
}

function wheel(frame, width, height, index, fps, options, colors) {
  const speed = clamp(options.speed, .1, 3, 1);
  const outerPct = clamp(options.outerRingRadius, 20, 95, 82) / 100;
  const innerPct = clamp(options.innerRingRadius, 0, 50, 18) / 100;
  const spokes = [2, 3, 4, 6, 8].includes(Number(options.spokeCount)) ? Number(options.spokeCount) : 4;
  const ringThickness = clamp(options.ringThickness, 1, Math.min(8, Math.floor(Math.min(width, height) / 2)), 2);
  const t = directionTime(index, fps, speed, options.direction || 'forward');
  const radiusUnit = Math.min(width, height) / 2;
  const outer = radiusUnit * outerPct;
  const inner = outer * innerPct;
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const radius = Math.hypot(dx, dy);
      if (radius > outer || radius < inner) continue;
      const angle = Math.atan2(dy, dx) + t * Math.PI * .7;
      const sector = mod(angle / (Math.PI * 2) * spokes, spokes);
      const spokeDistance = Math.min(sector, 1 - sector) * (Math.PI * 2 / spokes) * radius;
      const outerLine = options.showRingOutline !== false && Math.abs(radius - outer) <= ringThickness / 2;
      const innerLine = options.showRingOutline !== false && inner > 0 && Math.abs(radius - inner) <= ringThickness / 2;
      const spokeLine = spokeDistance <= Math.max(.45, ringThickness / 2);
      const color = outerLine || innerLine || spokeLine
        ? [255, 255, 255]
        : colorAt(colors, Math.floor(sector), .35 + .65 * (1 - radius / Math.max(1, outer)));
      writePixel(frame, width, x, y, color);
    }
  }
}

function diamondLattice(frame, width, height, index, fps, options, colors) {
  const speed = clamp(options.speed, .1, 3, 1);
  const size = Math.round(clamp(options.diamondSize, 3, 10, 6));
  const border = clamp(options.borderThickness, 1, Math.min(4, size - 1), 1);
  const pulseSpeed = clamp(options.corePulseSpeed, .1, 3, 1.1);
  const t = directionTime(index, fps, speed, options.direction || 'forward');
  const step = size * 2;
  let offsetX = 0;
  let offsetY = 0;
  if (options.scrollMode === 'horizontal') offsetX = t * size;
  if (options.scrollMode === 'diagonal') {
    offsetX = t * size;
    offsetY = t * size;
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const px = x;
      const u = mod(px - offsetX, step);
      const v = mod(y - offsetY, step);
      const manhattan = Math.abs(u - size) + Math.abs(v - size);
      const delta = Math.abs(manhattan - size);
      const tileX = Math.floor((px - offsetX) / step);
      const tileY = Math.floor((y - offsetY) / step);
      const tile = tileX + tileY * 2;
      if (delta <= border / 2) {
        writePixel(frame, width, x, y, [255, 255, 255]);
      } else if (manhattan < size - border / 2) {
        const pulse = .35 + .65 * (1 + Math.sin(t * pulseSpeed * Math.PI * 2 + tile)) / 2;
        writePixel(frame, width, x, y, colorAt(colors, tile + t * .25, pulse));
      }
    }
  }
}

const renderers = {
  tier_waterfall_sparkle: waterfall,
  opposing_color_collide: opposingCurtain,
  pillar_block_chaser: pillars,
  tricolor_ribbon_scroll: ribbons,
  rotating_quadrant_wheel: wheel,
  tiled_diamond_lattice: diamondLattice,
};

export const FacadeEffects = Object.freeze({
  engines: FACADE_ENGINES,
  isFacadeEffect: (kind) => Object.hasOwn(renderers, kind),
  getParameters: definitions,
  defaultOptions(kind, _modifier, width = 30, height = 20) {
    const defaults = Object.fromEntries(definitions(kind, width, height).map((item) => [item.key, item.value]));
    return defaults;
  },
  render(kind, width, height, frameIndex, fps = 20, options = {}) {
    if (!Object.hasOwn(renderers, kind)) throw new Error(`Unknown facade effect: ${kind}.`);
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
