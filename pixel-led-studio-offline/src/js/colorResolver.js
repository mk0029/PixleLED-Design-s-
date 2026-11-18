export const COLOR_DEFAULTS = Object.freeze({
  colorMode: 'preset',
  presetPalette: 'cyber',
  morphSource: 'preset',
  customColors: ['#00a8ff', '#ffaa00', '#f34f9a', '#45e0c3'],
  solidColor: '#00a8ff',
  autoColorSpeed: 1,
  hueShift: 0,
  brightness: 1,
  whiteAccent: true,
  backgroundMode: 'off',
  backgroundColor: '#101820',
  backgroundAutoSpeed: 1,
  backgroundBrightness: 0.22,
});

export const PRESET_PALETTES = Object.freeze({
  cyber: ['#00a8ff', '#ffaa00', '#183450', '#ffffff'],
  diwali: ['#ff4d00', '#ffc400', '#ff2e83', '#00d1ff'],
  wedding: ['#d4af37', '#b20d30', '#ffffff', '#ff5470'],
  tricolor: ['#ff7218', '#ffffff', '#138a42', '#2364d2'],
  neon: ['#00ffff', '#ff00c8', '#a6ff00', '#ff8200'],
  ocean: ['#00d9ff', '#1368ce', '#7affdd', '#eefcff'],
  fire: ['#ff2b0a', '#ff8b00', '#ffd126', '#fff1cb'],
});

export const PRESET_PALETTE_CHOICES = [
  ['cyber', 'Cyber Blue & Amber'],
  ['diwali', 'Diwali Vivid'],
  ['wedding', 'Wedding Gold & Crimson'],
  ['tricolor', 'Indian Tricolor'],
  ['neon', 'Neon Club'],
  ['ocean', 'Ocean Aqua'],
  ['fire', 'Fire Blaze'],
];

export const COLOR_MODE_CHOICES = [
  ['preset', 'Preset Palette'],
  ['custom', 'Custom Multi-Color'],
  ['solid', 'Single Solid Color'],
  ['rainbow', 'Auto Rainbow Cycle'],
  ['morph', 'Auto Palette Morph'],
];

function clamp(value, min, max, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

function mod(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function parseColor(value) {
  if (Array.isArray(value) && value.length >= 3) return value.slice(0, 3).map((part) => clamp(part, 0, 255, 0));
  if (typeof value === 'string' && /^#[\da-f]{6}$/i.test(value)) {
    return [1, 3, 5].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
  }
  return [0, 168, 255];
}

function rgbToHsl([r8, g8, b8]) {
  const r = r8 / 255;
  const g = g8 / 255;
  const b = b8 / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  if (max === min) return [0, 0, lightness];
  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue;
  if (max === r) hue = (g - b) / delta + (g < b ? 6 : 0);
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  return [hue / 6, saturation, lightness];
}

function hslToRgb(hue, saturation, lightness) {
  if (saturation === 0) {
    const channel = Math.round(lightness * 255);
    return [channel, channel, channel];
  }
  const q = lightness < 0.5
    ? lightness * (1 + saturation)
    : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;
  const hueChannel = (offset) => {
    let value = hue + offset;
    if (value < 0) value += 1;
    if (value > 1) value -= 1;
    if (value < 1 / 6) return p + (q - p) * 6 * value;
    if (value < 1 / 2) return q;
    if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6;
    return p;
  };
  return [hueChannel(1 / 3), hueChannel(0), hueChannel(-1 / 3)].map((channel) => Math.round(channel * 255));
}

function shiftHue(color, degrees) {
  const [hue, saturation, lightness] = rgbToHsl(color);
  return hslToRgb(mod(hue + degrees / 360, 1), saturation, lightness);
}

function interpolate(colors, position) {
  const normalized = mod(position, 1) * colors.length;
  const start = Math.floor(normalized);
  const end = (start + 1) % colors.length;
  const amount = normalized - start;
  return colors[start].map((channel, index) => Math.round(
    channel * (1 - amount) + colors[end][index] * amount,
  ));
}

function selectColors(params, mode) {
  if (mode === 'custom' || (mode === 'morph' && params.morphSource === 'custom')) {
    const colors = Array.isArray(params.customColors) ? params.customColors.slice(0, 4).map(parseColor) : [];
    return colors.length === 4 ? colors : PRESET_PALETTES.cyber.map(parseColor);
  }
  const key = PRESET_PALETTES[params.presetPalette] ? params.presetPalette : COLOR_DEFAULTS.presetPalette;
  return PRESET_PALETTES[key].map(parseColor);
}

export function createColorResolver(params = {}) {
  const mode = COLOR_MODE_CHOICES.some(([id]) => id === params.colorMode) ? params.colorMode : COLOR_DEFAULTS.colorMode;
  const colors = selectColors(params, mode);
  const speed = clamp(params.autoColorSpeed, 0.2, 5, COLOR_DEFAULTS.autoColorSpeed);
  const hueShift = clamp(params.hueShift ?? params.hue, 0, 360, COLOR_DEFAULTS.hueShift);
  const brightnessScale = clamp(params.brightness, 0, 1, COLOR_DEFAULTS.brightness);
  const density = clamp(params.patternDensity, 0.05, 3, 1);
  const backgroundMode = ['solid', 'palette', 'rainbow'].includes(params.backgroundMode)
    ? params.backgroundMode
    : COLOR_DEFAULTS.backgroundMode;
  const backgroundColor = parseColor(params.backgroundColor || COLOR_DEFAULTS.backgroundColor);
  const backgroundSpeed = clamp(params.backgroundAutoSpeed, 0.2, 5, COLOR_DEFAULTS.backgroundAutoSpeed);
  const backgroundBrightness = clamp(params.backgroundBrightness, 0, 1, COLOR_DEFAULTS.backgroundBrightness);
  const hasBackground = backgroundMode !== 'off';
  const solidColor = parseColor(params.solidColor || COLOR_DEFAULTS.solidColor);
  const whiteAccent = params.whiteAccent !== false;
  const applyBrightness = (color) => color.map((channel) => Math.round(channel * brightnessScale));
  const backgroundAt = (position, seconds) => {
    const spatialPosition = mod(Number.isFinite(position) ? position : 0, 1);
    let color;
    if (backgroundMode === 'solid') color = backgroundColor;
    else if (backgroundMode === 'rainbow') {
      color = hslToRgb(mod(spatialPosition + seconds * backgroundSpeed / 8, 1), 0.9, 0.42);
    } else {
      color = interpolate(colors, spatialPosition * 0.2 + seconds * backgroundSpeed * 0.12);
    }
    return color.map((channel) => Math.round(channel * backgroundBrightness));
  };

  const colorAt = (position, seconds = 0, brightness = 1) => {
    const spatialPosition = mod(Number.isFinite(position) ? position : 0, 1);
    const time = Number.isFinite(seconds) ? seconds : 0;
    const intensity = clamp(brightness, 0, 1, 1);
    if (hasBackground && intensity <= 0.035) return backgroundAt(spatialPosition, time);
    const adjustedIntensity = Math.pow(intensity, 1 / density) * brightnessScale;
    let color;
    if (mode === 'rainbow') {
      color = hslToRgb(mod(spatialPosition + time * speed / 4, 1), 1, 0.5);
    } else if (mode === 'morph') {
      color = interpolate(colors, spatialPosition * 0.25 + time * speed * 0.12);
    } else if (mode === 'solid') {
      color = solidColor;
    } else {
      color = interpolate(colors, spatialPosition);
    }
    return shiftHue(color, hueShift).map((channel) => Math.round(channel * adjustedIntensity));
  };

  return Object.freeze({
    colorAt,
    applyBrightness,
    fillBackground(frame, width, height, seconds = 0) {
      if (!(frame instanceof Uint8Array) || frame.length !== width * height * 3) {
        throw new Error('RGB frame does not match the configured matrix.');
      }
      if (!hasBackground) return frame;
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const offset = (y * width + x) * 3;
          if (Math.max(frame[offset], frame[offset + 1], frame[offset + 2]) > 8) continue;
          const position = x / Math.max(1, width - 1) * 0.65 + y / Math.max(1, height - 1) * 0.35;
          frame.set(backgroundAt(position, seconds), offset);
        }
      }
      return frame;
    },
    isWhiteAccent(color) {
      return whiteAccent
        && Math.min(color[0], color[1], color[2]) >= 232
        && Math.max(color[0], color[1], color[2]) - Math.min(color[0], color[1], color[2]) <= 18;
    },
    recolorFrame(frame, width, height, seconds = 0) {
      if (!(frame instanceof Uint8Array) || frame.length !== width * height * 3) {
        throw new Error('RGB frame does not match the configured matrix.');
      }
      const output = new Uint8Array(frame.length);
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const offset = (y * width + x) * 3;
          const source = [frame[offset], frame[offset + 1], frame[offset + 2]];
          const maxChannel = Math.max(...source);
          const position = (x / Math.max(1, width - 1) * 0.65)
            + (y / Math.max(1, height - 1) * 0.25)
            + ((maxChannel - Math.min(...source)) / 255 * 0.1);
          if (maxChannel === 0 || (hasBackground && maxChannel <= 8)) {
            if (hasBackground) output.set(backgroundAt(position, seconds), offset);
            continue;
          }
          const minChannel = Math.min(...source);
          if (this.isWhiteAccent(source)) {
            output.set(applyBrightness(source), offset);
            continue;
          }
          const brightness = maxChannel / 255;
          output.set(colorAt(position, seconds, brightness), offset);
        }
      }
      return output;
    },
  });
}
