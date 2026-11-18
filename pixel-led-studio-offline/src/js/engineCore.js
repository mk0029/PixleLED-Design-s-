import { FacadeEffects } from './facadeEffects.js';
import { LargeScaleEffects } from './largeScaleEffects.js';
import { TORAN_LOOP_SECONDS, ToranScenes } from './toranScenes.js';
import { VerticalAnimations } from './verticalAnimations.js';
import { createColorResolver } from './colorResolver.js';
import { frameIndexForDirection, motionTime, orientFrame } from './direction.js';

const categories = [
  {
    name: 'Vertical Lines',
    engines: [
      ['All-Lines Top-to-Bottom Comet Bounce', 'comet'],
      ['Single-Line Top-to-Bottom Scanner', 'single_line_scanner'],
      ['Single-Line Top-to-Bottom Comet', 'single_line_comet'],
      ['Sequential Line-by-Line Palette Waterfall', 'waterfall'],
      ['Sequential Color Stack Fill & Drain', 'stack'],
      ['Odd/Even Alternating Up-Down Zipper', 'zipper'],
      ['Center-Out Vertical Split', 'split'],
      ['Digital Meteor Rain', 'meteor'],
      ...ToranScenes.engines,
      ...VerticalAnimations.engines,
    ],
  },
  { name: 'Facade & Curtain', engines: [] },
  {
    name: 'DJ & Club',
    engines: [
      ['Multi-Band Spectrum Equalizer with Gravity Peak-Hold', 'equalizer'],
      ['Dual-Side Bass VU-Meter', 'vu'],
      ['Rotating Laser Beams', 'laser'],
      ['3D Hyperspace Tunnel', 'tunnel'],
    ],
  },
  {
    name: 'Geometric',
    engines: [
      ['Expanding Neon Diamonds', 'diamond'],
      ['Moving Chevrons', 'chevron'],
      ['DNA Double Helix Spin', 'helix'],
      ['Liquid Plasma Vortex', 'plasma'],
    ],
  },
  {
    name: 'Festive',
    engines: [
      ['Kaleidoscope Mandala', 'mandala'],
      ['Celebration Fireworks Rocket & Multi-Ring Burst', 'fireworks'],
      ['Glowing Diya Flame', 'diya'],
      ['Blooming Lotus', 'lotus'],
      ['Revolving Rangoli Mandala', 'rangoli'],
    ],
  },
  {
    name: 'Typography',
    engines: [
      ['5×7 Bitmap Scrolling Banner', 'text'],
      ['Dual Text Opposing Scroll', 'dual_text'],
      ['Vertical Bitmap Text Scroll', 'vertical_text'],
    ],
  },
];

const font = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01111', '10000', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  J: ['00111', '00010', '00010', '00010', '10010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  5: ['11111', '10000', '10000', '11110', '00001', '00001', '11110'],
  6: ['01110', '10000', '10000', '11110', '10001', '10001', '01110'],
  7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  9: ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
};

const dynamicEngines = [...FacadeEffects.engines, ...LargeScaleEffects.engines]
  .map(({ name, id: kind, category }) => ({ name, kind, category }));
dynamicEngines.forEach((engine) => {
  const category = categories.find((item) => item.name === engine.category);
  if (category) category.engines.push([engine.name, engine.kind]);
});
const presets = categories.flatMap((category) => category.engines.map(([name, kind]) => ({
  id: kind,
  engineId: kind,
  kind,
  name,
  category: category.name,
})));

const engineNameSlug = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function resolveEngineId(id) {
  const value = String(id || '');
  const direct = presets.find((engine) => engine.id === value);
  if (direct) return direct.id;
  const legacySlug = value.split('--')[0];
  return presets.find((engine) => engineNameSlug(engine.name) === legacySlug)?.id || null;
}

function getDynamicEffect(kind) {
  if (FacadeEffects.isFacadeEffect(kind)) return FacadeEffects;
  if (LargeScaleEffects.isEffect(kind)) return LargeScaleEffects;
  return null;
}

function hash(a, b, c) {
  let value = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b);
  value = Math.imul(value ^ (b | 0), 0xc2b2ae35);
  value = Math.imul(value ^ (c | 0), 0x27d4eb2f);
  return ((value ^ (value >>> 15)) >>> 0) / 4294967295;
}

function textRows(text) {
  const content = String(text || 'PIXEL LED').slice(0, 64).toUpperCase();
  return Array.from({ length: 7 }, (_, y) => [...content].flatMap((character) =>
    [...(font[character] || font[' '])[y]].map(Number).concat([0])));
}

function textBackground(options, width, height, seconds, frame) {
  const modes = ['solid', 'palette', 'rainbow'];
  const mode = modes.includes(options.textBackgroundMode) ? options.textBackgroundMode : 'transparent';
  if (mode === 'transparent') return;
  const backgroundResolver = createColorResolver({
    ...options,
    backgroundMode: mode,
    backgroundColor: options.textBackgroundColor || '#101820',
    backgroundAutoSpeed: options.textBackgroundSpeed ?? 1,
    backgroundBrightness: options.textBackgroundBrightness ?? 0.22,
  });
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const position = x / Math.max(1, width - 1) * 0.65 + y / Math.max(1, height - 1) * 0.35;
      frame.set(backgroundResolver.colorAt(position, seconds, 0), (y * width + x) * 3);
    }
  }
}

function drawHorizontalText(frame, width, height, bitmap, offset, top, seconds, options, resolver) {
  for (let x = 0; x < width; x += 1) {
    const sourceX = x - offset;
    for (let y = 0; y < Math.min(height, bitmap.length); y += 1) {
      if (top + y >= height) continue;
      const chase = options.backgroundChase
        && (x + Math.floor(seconds * Number(options.speed || 1) * 8)) % Math.max(2, Math.floor(width / 6)) === 0;
      if (bitmap[y][sourceX] || chase) {
        const index = (top + y) * width * 3 + x * 3;
        const foreground = resolver.colorAt(x / Math.max(1, width - 1), seconds, 1);
        if (bitmap[y][sourceX]) frame.set(foreground, index);
        else frame.set(resolver.colorAt(0.5, seconds, 0.12), index);
      }
    }
  }
}

function textPixels(engineId, options, width, height, seconds, resolver) {
  const frame = new Uint8Array(width * height * 3);
  textBackground(options, width, height, seconds, frame);
  const speed = Math.max(0.1, Math.min(5, Number(options.speed || 1)));
  if (engineId === 'vertical_text') {
    const characters = String(options.text || 'PIXEL LED').slice(0, 64).toUpperCase();
    const bitmap = [...characters].flatMap((character) => (
      [...(font[character] || font[' '])].map((row) => [...row].map(Number)).concat([[0, 0, 0, 0, 0]])
    ));
    const fullBitmap = options.doubleHeight ? bitmap.flatMap((row) => [row, row]) : bitmap;
    const cycle = height + fullBitmap.length;
    const travel = Math.floor((Number(options.direction === 'bounce' ? motionTime(seconds, speed * 8, 'bounce', cycle) : seconds * speed * 8)) % cycle);
    const top = options.direction === 'reverse'
      ? height - ((Math.floor(seconds * speed * 8) % cycle + cycle) % cycle)
      : -fullBitmap.length + ((travel % cycle) + cycle) % cycle;
    const left = Math.floor((width - 5) / 2);
    for (let row = 0; row < fullBitmap.length; row += 1) {
      const y = top + row;
      if (y < 0 || y >= height) continue;
      for (let column = 0; column < 5; column += 1) {
        const x = left + column;
        if (x < 0 || x >= width) continue;
        const chase = options.backgroundChase && (y + Math.floor(seconds * speed * 8)) % Math.max(2, Math.floor(height / 6)) === 0;
        if (fullBitmap[row][column] || chase) {
          const offset = (y * width + x) * 3;
          frame.set(fullBitmap[row][column]
            ? resolver.colorAt(y / Math.max(1, height - 1), seconds, 1)
            : resolver.colorAt(0.5, seconds, 0.12), offset);
        }
      }
    }
    return frame;
  }

  if (engineId === 'dual_text') {
    const first = textRows(options.dualTextLeft || 'LEFT');
    const second = textRows(options.dualTextRight || 'RIGHT');
    const doubleHeight = options.doubleHeight && height >= 31;
    const firstBitmap = doubleHeight ? first.flatMap((row) => [row, row]) : first;
    const secondBitmap = doubleHeight ? second.flatMap((row) => [row, row]) : second;
    const laneHeight = Math.max(firstBitmap.length, secondBitmap.length);
    const top = Math.max(0, Math.floor((height - laneHeight * 2) / 3));
    const bottom = Math.max(top + laneHeight, height - laneHeight);
    const cycle = width + Math.max(firstBitmap[0].length, secondBitmap[0].length);
    const travel = motionTime(seconds, speed * 8, options.direction, cycle);
    const phase = ((travel % cycle) + cycle) % cycle;
    const reverse = options.direction === 'reverse';
    const leftOffset = reverse ? -firstBitmap[0].length + phase : width - phase;
    const rightOffset = reverse ? width - phase : -secondBitmap[0].length + phase;
    drawHorizontalText(frame, width, height, firstBitmap, Math.round(leftOffset), top, seconds, options, resolver);
    drawHorizontalText(frame, width, height, secondBitmap, Math.round(rightOffset), bottom, seconds, options, resolver);
    return frame;
  }

  const rows = textRows(options.text);
  const bitmap = options.doubleHeight ? rows.flatMap((row) => [row, row]) : rows;
  const cycle = width + bitmap[0].length;
  const travel = motionTime(seconds, speed * 8, options.direction, cycle);
  const offset = options.direction === 'reverse'
    ? -bitmap[0].length + Math.round(seconds * speed * 8)
    : width - Math.round(travel);
  const top = Math.max(0, Math.floor((height - bitmap.length) / 2));
  drawHorizontalText(frame, width, height, bitmap, offset, top, seconds, options, resolver);
  return frame;
}

function scalar(kind, x, y, nx, ny, t, W, H, density, amplitude) {
  const cx = (W - 1) / 2;
  const cy = (H - 1) / 2;
  const dx = (x - cx) / Math.max(1, Math.min(W, H));
  const dy = (y - cy) / Math.max(1, Math.min(W, H));
  const radius = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);
  const wave = (v) => Math.sin(v);
  switch (kind) {
    case 'single_line_scanner': {
      const phase = ((t % 1) + 1) % 1;
      const lineY = phase * (H + 1) - 1;
      return Math.abs(y - lineY) < 0.6 ? 1 : 0;
    }
    case 'single_line_comet': {
      const tailLength = Math.max(2, Math.min(6, Math.floor(H * 0.2)));
      const phase = ((t % 1) + 1) % 1;
      const lineY = phase * (H + tailLength) - tailLength;
      const trail = lineY - y;
      return trail >= 0 && trail <= tailLength ? 1 - trail / (tailLength + 1) : 0;
    }
    case 'comet': return Math.max(0, 1 - Math.abs(((ny * 1.8 + t) % 2) - 1) * 3) * (0.25 + .75 * Math.abs(wave(nx * 17)));
    case 'waterfall': return Math.max(0, Math.cos((ny * 12 + t * 3 + Math.floor(nx * 9)) * Math.PI)) ** 4;
    case 'stack': return (Math.floor(ny * (H + 1) + t * H) % 4) < 2 ? 1 : .04;
    case 'zipper': return Math.sin((y + t * H) * Math.PI + (x % 2) * Math.PI) > 0 ? 1 : .03;
    case 'split': return Math.max(0, 1 - Math.abs(nx - .5) * 2 - ((ny + t) % 1));
    case 'meteor': return hash(Math.floor(nx * W / Math.max(1, density)), 0, Math.floor(ny * H + t * 9)) > .91 ? 1 : .02;
    case 'equalizer': return ny > 1 - Math.min(1, (.25 + .7 * Math.abs(wave(nx * (5 + density * 8) * Math.PI + t * 1.7))) * amplitude) ? 1 : .025;
    case 'vu': return Math.abs(nx - .5) < (.08 + .42 * Math.abs(wave(t * 2.4 + ny * 2))) && ny > .15 ? 1 : .025;
    case 'laser': return Math.max(0, 1 - Math.abs(Math.sin(angle * 3 - t * Math.PI)) * 18);
    case 'tunnel': return Math.max(0, Math.sin(radius * 40 * density - t * 4));
    case 'diamond': return Math.max(0, Math.sin((Math.abs(dx) + Math.abs(dy)) * 50 * density - t * 4));
    case 'chevron': return Math.max(0, Math.sin((ny + Math.abs(nx - .5) * .8) * 25 * density - t * 4));
    case 'helix': return Math.abs(ny - (.5 + .38 * Math.sin(nx * Math.PI * 4 + t * 3))) < .12 ? 1 : .025;
    case 'plasma': return (Math.sin(nx * 11 * density + Math.sin(ny * 9 + t * 3) * 2) + Math.cos(ny * 13 - t * 3)) / 2;
    default: return Math.sin((nx + ny) * 18 * density + t * 3) * Math.cos((nx - ny) * 13 * density - t * 2);
  }
}

function paint(frame, width, height, x, y, color) {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || py < 0 || px >= width || py >= height) return;
  const offset = (py * width + px) * 3;
  frame.set(color, offset);
}

function renderFireworks(width, height, seconds, params, resolver) {
  const frame = new Uint8Array(width * height * 3);
  const speed = Math.max(0.1, Math.min(5, Number(params.speed || 1)));
  const time = motionTime(seconds, speed, params.direction);
  const burstCount = Math.min(4, Math.max(1, width));
  const period = 2.8;
  const launchDuration = 0.72;
  const sparkCount = Math.max(12, Math.round(Math.min(width, height) * 1.25));
  const maxRadius = Math.max(1, Math.min(width, height) * 0.48);
  const brightWhite = params.whiteAccent !== false;

  for (let burst = 0; burst < burstCount; burst += 1) {
    const seed = burst + 41;
    const x = width <= 2
      ? (width - 1) / 2
      : 1 + hash(seed, 17, 7) * (width - 2);
    const targetY = Math.max(0, Math.min(height - 1, Math.round(height * (0.18 + hash(seed, 29, 11) * 0.34))));
    const phase = ((time + burst * period / burstCount) % period + period) % period;

    if (phase < launchDuration) {
      const progress = phase / launchDuration;
      const rocketY = height - 1 - progress * (height - 1 - targetY);
      for (let tail = 0; tail < 4; tail += 1) {
        const color = tail === 0 && brightWhite
          ? resolver.applyBrightness([255, 255, 235])
          : resolver.colorAt(0.12 + tail * 0.1, seconds, Math.max(0.4, 0.9 - tail * 0.14));
        paint(frame, width, height, x, rocketY + tail, color);
      }
      continue;
    }

    const progress = (phase - launchDuration) / (period - launchDuration);
    const centerX = x;
    const centerY = targetY;
    const radius = maxRadius * progress * (0.72 + hash(seed, 43, 13) * 0.28);
    const fade = Math.max(0.32, 1 - progress * 0.68);

    for (let y = 0; y < height; y += 1) {
      for (let xPixel = 0; xPixel < width; xPixel += 1) {
        const distance = Math.hypot(xPixel - centerX, y - centerY);
        const outerRing = Math.abs(distance - radius);
        const innerRing = Math.abs(distance - radius * 0.58);
        if (outerRing < 0.7 || innerRing < 0.65) {
          const color = resolver.colorAt(
            burst * 0.7 + (outerRing < innerRing ? 0.1 : 0.65),
            seconds,
            fade * 0.92,
          );
          paint(frame, width, height, xPixel, y, color);
        }
      }
    }

    for (let spark = 0; spark < sparkCount; spark += 1) {
      const angle = spark / sparkCount * Math.PI * 2 + hash(seed, spark, 23) * 0.18;
      const distance = radius * (0.72 + hash(seed, spark, 31) * 0.34);
      const sparkX = centerX + Math.cos(angle) * distance;
      const sparkY = centerY + Math.sin(angle) * distance;
      const color = brightWhite && spark % 6 === 0
        ? resolver.applyBrightness([255, 255, 255])
        : resolver.colorAt(burst * 0.8 + spark / sparkCount * 2, seconds, fade);
      paint(frame, width, height, sparkX, sparkY, color);
      const tailLength = 1 + Math.floor(hash(seed, spark, 47) * 3);
      for (let tail = 1; tail <= tailLength; tail += 1) {
        paint(frame, width, height, sparkX - Math.cos(angle) * tail, sparkY - Math.sin(angle) * tail,
          resolver.colorAt(burst * 0.8 + spark / sparkCount * 2, seconds, fade * (1 - tail / (tailLength + 1))));
      }
    }
  }
  return frame;
}

function renderFestiveMotif(engineId, width, height, seconds, params, resolver) {
  const frame = new Uint8Array(width * height * 3);
  const speed = Math.max(0.1, Math.min(5, Number(params.speed || 1)));
  const time = motionTime(seconds, speed, params.direction);
  const unit = Math.max(1, Math.min(width, height));
  const centerX = (width - 1) / 2;
  const centerY = (height - 1) / 2;
  const whiteAccent = params.whiteAccent !== false;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = (x - centerX) / unit;
      const dy = (y - centerY) / unit;
      const radius = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      let colorPosition;
      let brightness;
      let highlight = false;

      if (engineId === 'mandala') {
        const petals = 10;
        const petalEdge = 0.12 + 0.14 * (0.5 + 0.5 * Math.cos(petals * (angle - time * 0.16)));
        const edgeDistance = Math.min(Math.abs(radius - petalEdge), Math.abs(radius - 0.075), Math.abs(radius - 0.3));
        const pulse = 0.5 + 0.5 * Math.sin(time * 2 + radius * 19 + Math.cos(petals * angle));
        brightness = 0.64 + 0.3 * pulse + (edgeDistance < 0.035 ? 0.06 : 0);
        colorPosition = angle / (Math.PI * 2) * 4 + radius * 8 + time * 0.12;
        highlight = edgeDistance < 0.025;
      } else if (engineId === 'rangoli') {
        const petals = 8;
        const radial = Math.abs(radius - (0.12 + 0.16 * Math.max(0, Math.cos(petals * angle + time * 0.22))));
        const ring = Math.min(Math.abs(radius - 0.075), Math.abs(radius - 0.24), Math.abs(radius - 0.36));
        const motifDistance = Math.min(radial, ring);
        brightness = motifDistance < 0.035
          ? 1
          : 0.62 + 0.25 * (0.5 + 0.5 * Math.sin(petals * angle + time + radius * 12));
        colorPosition = angle / (Math.PI * 2) * 5 + radius * 9 + time * 0.14;
        highlight = motifDistance < 0.018;
      } else if (engineId === 'lotus') {
        const petals = 8;
        const petalWave = (Math.cos(petals * (angle - time * 0.12)) + 1) / 2;
        const petalEdge = 0.1 + 0.22 * petalWave;
        const edgeDistance = Math.min(Math.abs(radius - petalEdge), Math.abs(radius - 0.075));
        brightness = radius <= petalEdge
          ? 0.72 + 0.24 * petalWave
          : 0.38 + 0.3 * (0.5 + 0.5 * Math.sin(angle * petals + time));
        if (edgeDistance < 0.035) brightness = 1;
        colorPosition = angle / (Math.PI * 2) * 4 + radius * 7 + time * 0.1;
        highlight = edgeDistance < 0.02;
      } else {
        const flameCenter = Math.sin(time * 2.4) * 0.025;
        const flameProgress = (0.055 - dy) / 0.34;
        const flameWidth = Math.max(0, 0.105 * (1 - flameProgress) * (0.75 + 0.25 * Math.sin(time * 5 + dy * 18)));
        const flame = flameProgress >= 0 && flameProgress <= 1 && Math.abs(dx - flameCenter) <= flameWidth;
        const bowl = dy >= 0.08 && dy <= 0.27 && Math.abs(dx) <= 0.24 - (dy - 0.15) * (dy - 0.15) * 3;
        const bowlEdge = Math.abs(dy - (0.12 + Math.abs(dx) * 0.35));
        brightness = flame
          ? 0.84 + 0.16 * (0.5 + 0.5 * Math.sin(time * 6 + dx * 22))
          : bowl
            ? 0.7 + 0.24 * (1 - Math.abs(dx) / 0.25)
            : Math.max(0, 0.18 - radius * 0.22);
        colorPosition = flame ? 0.08 + flameProgress * 0.35 : 0.45 + Math.abs(dx) * 2 + time * 0.08;
        highlight = flame && (Math.abs(dx - flameCenter) < 0.022 || flameProgress < 0.22)
          || bowl && bowlEdge < 0.025;
      }

      const color = highlight && whiteAccent
        ? resolver.applyBrightness([255, 255, 255])
        : resolver.colorAt(colorPosition, seconds, Math.min(1, brightness));
      paint(frame, width, height, x, y, color);
    }
  }
  return frame;
}

function renderEngine(engineId, width, height, fps, seconds, params = {}) {
  const resolver = createColorResolver(params);
  if (engineId === 'fireworks') {
    const frame = orientFrame(renderFireworks(width, height, seconds, params, resolver), width, height, params.direction);
    return resolver.fillBackground(frame, width, height, seconds);
  }
  if (['mandala', 'diya', 'lotus', 'rangoli'].includes(engineId)) {
    const frame = orientFrame(renderFestiveMotif(engineId, width, height, seconds, params, resolver), width, height, params.direction);
    return resolver.fillBackground(frame, width, height, seconds);
  }
  if (ToranScenes.isScene(engineId)) {
    const speed = Math.max(.1, Math.min(5, Number(params.speed || 1)));
    const phase = ((motionTime(seconds, speed, params.direction) / TORAN_LOOP_SECONDS) % 1 + 1) % 1;
    const frame = ToranScenes.render(engineId, width, height, phase, Math.round(seconds * fps), resolver.applyBrightness);
    return resolver.fillBackground(orientFrame(frame, width, height, params.direction), width, height, seconds);
  }
  if (VerticalAnimations.isAnimation(engineId)) {
    const speed = Math.max(.1, Math.min(5, Number(params.speed || 1)));
    const frame = VerticalAnimations.render(engineId, width, height, motionTime(seconds, speed, params.direction), resolver.applyBrightness);
    return resolver.fillBackground(orientFrame(frame, width, height, params.direction), width, height, seconds);
  }
  const dynamicEffect = getDynamicEffect(engineId);
  if (dynamicEffect) {
    const rawFrame = dynamicEffect.render(engineId, width, height, Math.round(seconds * fps), fps, params);
    return resolver.recolorFrame(orientFrame(rawFrame, width, height, params.direction), width, height, seconds);
  }
  if (['text', 'dual_text', 'vertical_text'].includes(engineId)) {
    const frame = orientFrame(textPixels(engineId, params, width, height, seconds, resolver), width, height, params.direction);
    return ['solid', 'palette', 'rainbow'].includes(params.textBackgroundMode)
      ? frame
      : resolver.fillBackground(frame, width, height, seconds);
  }
  const pixels = new Uint8Array(width * height * 3);
  const density = Math.max(.2, Math.min(5, Number(params.density || 1)));
  const amplitude = Math.max(.1, Math.min(4, Number(params.amplitude || 1)));
  const speed = Math.max(.1, Math.min(5, Number(params.speed || 1)));
  const t = motionTime(seconds, speed, params.direction);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const nx = x / Math.max(1, width - 1);
      const ny = y / Math.max(1, height - 1);
      const value = scalar(engineId, x, y, nx, ny, t, width, height, density, amplitude);
      let light = Math.max(0, Math.min(1, (value + .12) * .78 * amplitude));
      if (['single_line_scanner', 'single_line_comet', 'stack', 'waterfall', 'zipper', 'equalizer', 'vu', 'meteor', 'helix'].includes(engineId)) {
        light = value > .25 ? Math.min(1, value * amplitude) : .015;
      }
      const position = (nx + ny) * 0.42 + (value + 1) * 0.08;
      const isTipOrOutline = params.whiteAccent !== false
        && (['comet', 'single_line_comet'].includes(engineId) && value > 0.9
          || ['diamond', 'laser'].includes(engineId) && light > 0.96);
      const rgb = isTipOrOutline ? resolver.applyBrightness([255, 255, 255]) : resolver.colorAt(position, seconds, light);
      const offset = (y * width + x) * 3;
      pixels[offset] = rgb[0];
      pixels[offset + 1] = rgb[1];
      pixels[offset + 2] = rgb[2];
    }
  }
  return resolver.fillBackground(orientFrame(pixels, width, height, params.direction), width, height, seconds);
}

class Formula {
  constructor(source) {
    this.tokens = [];
    const expression = /\s*(?:(\d+(?:\.\d*)?|\.\d+)(?:[eE]([+-]?\d+))?|([A-Za-z_]\w*)|([()+\-*/%^,]))/y;
    let offset = 0;
    while (offset < source.length) {
      expression.lastIndex = offset;
      const match = expression.exec(source);
      if (!match) throw new Error(`Unsupported formula character at ${offset + 1}.`);
      this.tokens.push(match[1] ? Number(`${match[1]}${match[2] ? `e${match[2]}` : ''}`) : match[3] || match[4]);
      offset = expression.lastIndex;
      if (this.tokens.length > 160) throw new Error('Formula is too long.');
    }
    this.position = 0;
    this.tree = this.parseExpression();
    if (this.position !== this.tokens.length) throw new Error('Unexpected token in formula.');
  }

  peek() { return this.tokens[this.position]; }
  take() { return this.tokens[this.position++]; }
  parseExpression() { return this.binary(0); }
  binary(minimum) {
    let left = this.primary();
    const levels = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2, '^': 3 };
    while (levels[this.peek()] >= minimum) {
      const op = this.take();
      const precedence = levels[op];
      const right = this.binary(precedence + (op === '^' ? 0 : 1));
      left = { op, left, right };
    }
    return left;
  }
  primary() {
    const token = this.take();
    if (typeof token === 'number') return { number: token };
    if (token === '+' || token === '-') return { unary: token, value: this.primary() };
    if (token === '(') {
      const value = this.parseExpression();
      if (this.take() !== ')') throw new Error('Missing closing parenthesis.');
      return value;
    }
    if (typeof token !== 'string') throw new Error('Expected a number or variable.');
    if (this.peek() !== '(') return { variable: token };
    this.take();
    const args = [];
    if (this.peek() !== ')') {
      do {
        args.push(this.parseExpression());
        if (this.peek() !== ',') break;
        this.take();
      } while (true);
    }
    if (this.take() !== ')') throw new Error('Missing function parenthesis.');
    if (!['sin', 'cos', 'tan', 'hypot', 'abs', 'min', 'max', 'rand'].includes(token)) {
      throw new Error(`Function "${token}" is not allowed.`);
    }
    if (['sin', 'cos', 'tan', 'abs'].includes(token) && args.length !== 1) throw new Error(`${token}() needs one argument.`);
    if (token === 'hypot' && args.length < 2) throw new Error('hypot() needs at least two arguments.');
    if (['min', 'max'].includes(token) && args.length < 1) throw new Error(`${token}() needs at least one argument.`);
    if (token === 'rand' && args.length > 3) throw new Error('rand() accepts zero to three arguments.');
    return { call: token, args };
  }

  evaluate(context) {
    const run = (node) => {
      if ('number' in node) return node.number;
      if ('variable' in node) {
        if (node.variable === 'pi') return Math.PI;
        if (Object.hasOwn(context, node.variable)) return context[node.variable];
        throw new Error(`Variable "${node.variable}" is not available.`);
      }
      if ('unary' in node) return node.unary === '-' ? -run(node.value) : run(node.value);
      if ('op' in node) {
        const a = run(node.left);
        const b = run(node.right);
        const value = ({ '+': () => a + b, '-': () => a - b, '*': () => a * b,
          '/': () => a / b, '%': () => a % b, '^': () => a ** b })[node.op]();
        if (node.op === '^' && Math.abs(b) > 16) throw new Error('Power exponent is limited to ±16.');
        return value;
      }
      const args = node.args.map(run);
      const funcs = { sin: Math.sin, cos: Math.cos, tan: Math.tan, hypot: Math.hypot,
        abs: Math.abs, min: Math.min, max: Math.max,
        rand: (...seeds) => hash(...(seeds.length ? seeds : [context.x, context.y, context.t])) };
      return funcs[node.call](...args);
    };
    const result = run(this.tree);
    if (!Number.isFinite(result)) throw new Error('Formula must return a finite number.');
    return result;
  }
}

function renderMath(width, height, frameIndex, formulas, params) {
  const compiled = Object.fromEntries(Object.entries(formulas).map(([channel, source]) => [channel, new Formula(source)]));
  const pixels = new Uint8Array(width * height * 3);
  const speed = Math.max(0.1, Math.min(3, Number(params.speed ?? 1)));
  const density = Math.max(0.3, Math.min(3, Number(params.density ?? 1)));
  const brightness = Math.max(0, Math.min(1, Number(params.brightness ?? 1)));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const context = { x: x * density, y: y * density, t: frameIndex * speed, W: width, H: height };
      const offset = (y * width + x) * 3;
      for (const [channel, formula] of Object.entries(compiled)) {
        const target = { R: 0, G: 1, B: 2 }[channel];
        const value = Math.max(0, Math.min(255, formula.evaluate(context)));
        pixels[offset + target] = Math.round(value * brightness);
      }
    }
  }
  return pixels;
}

function generateFrames(scene, width, height, frameCount, fps = 20) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || width > 120 || height < 1 || height > 80) {
    throw new Error('Matrix must be between 1×1 and 120×80.');
  }
  if (!Number.isInteger(frameCount) || frameCount < 1 || frameCount > 18000) throw new Error('Frame count is outside supported limits.');
  if (!Number.isInteger(fps) || fps < 1 || fps > 60) throw new Error('FPS must be from 1 to 60.');
  const pattern = scene.pattern;
  const params = scene.params || scene.options || {};
  const resolver = createColorResolver(params);
  if (pattern === 'math') {
    return Array.from({ length: frameCount }, (_, index) => (
      resolver.fillBackground(
        orientFrame(
          renderMath(width, height, frameIndexForDirection(index, frameCount, params.direction), scene.formulas, params),
          width,
          height,
          params.direction,
        ),
        width,
        height,
        index / fps,
      )
    ));
  }
  if (pattern === 'draw') {
    if (!scene.frames?.length) throw new Error('Draw a frame before adding it to the timeline.');
    const sourceWidth = Number(scene.width || width);
    const sourceHeight = Number(scene.height || height);
    return Array.from({ length: frameCount }, (_, index) => {
      const sourceIndex = frameIndexForDirection(index % scene.frames.length, scene.frames.length, params.direction);
      const source = scene.frames[sourceIndex];
      if (source.length !== sourceWidth * sourceHeight * 3) throw new Error('Pixel drawing data is invalid.');
      const frame = new Uint8Array(width * height * 3);
      for (let y = 0; y < height; y += 1) {
        const sourceY = Math.min(sourceHeight - 1, Math.floor(y * sourceHeight / height));
        for (let x = 0; x < width; x += 1) {
          const sourceX = Math.min(sourceWidth - 1, Math.floor(x * sourceWidth / width));
          const sourceOffset = (sourceY * sourceWidth + sourceX) * 3;
          frame.set(source.subarray ? source.subarray(sourceOffset, sourceOffset + 3) : source.slice(sourceOffset, sourceOffset + 3), (y * width + x) * 3);
        }
      }
      return resolver.fillBackground(orientFrame(frame, width, height, params.direction), width, height, index / fps);
    });
  }
  const engineId = resolveEngineId(scene.engineId || pattern);
  if (!engineId) throw new Error('The selected effect is no longer available.');
  return Array.from({ length: frameCount }, (_, index) => renderEngine(engineId, width, height, fps, index / fps, params));
}

export const EngineCore = Object.freeze({
  categories,
  presets,
  facadeEffects: FacadeEffects,
  largeScaleEffects: LargeScaleEffects,
  createColorResolver,
  resolveEngineId,
  renderEngine,
  isDynamicEffect: (kind) => getDynamicEffect(kind) !== null,
  getDynamicParameters(kind, width, height) {
    const effect = getDynamicEffect(kind);
    return effect ? effect.getParameters(kind, width, height).filter((control) => control.key !== 'palette') : [];
  },
  getDynamicDefaults(kind, width, height) {
    const effect = getDynamicEffect(kind);
    if (!effect) return {};
    const defaults = { ...effect.defaultOptions(kind, undefined, width, height) };
    delete defaults.palette;
    delete defaults.customColors;
    return defaults;
  },
  generateFrames,
  validateFormulas(formulas) {
    const compiled = Object.fromEntries(Object.entries(formulas).map(([key, source]) => [key, new Formula(source)]));
    for (const key of ['R', 'G', 'B']) if (!compiled[key]) throw new Error(`Missing ${key} formula.`);
    return true;
  },
});
