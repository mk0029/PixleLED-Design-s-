function number(value) {
  return Number(value.toFixed(3)).toString();
}

function centeredDistance(frequency, phase, speed) {
  return `hypot((x-W/2)*${frequency},(y-H/2)*${frequency})-${phase}-t*${speed}`;
}

function formulasFor(type, frequency, phase, speed) {
  const f = number(frequency);
  const p = phase;
  const s = number(speed);
  const wave = (expression) => `127 + 127 * sin(${expression})`;
  switch (type) {
    case 'geometry':
      return {
        R: wave(`(abs(x-W/2)+abs(y-H/2))*${f}-t*${s}+${p}`),
        G: wave(`hypot(x-W/2,y-H/2)*${f}+t*${s}+${p + 1.7}`),
        B: wave(`(x-y)*${f}+(x+y)*${f / 2}-t*${s}+${p + 3.4}`),
      };
    case 'water':
      return {
        R: wave(centeredDistance(f, p, s)),
        G: wave(`hypot((x-W/2)*${f / 2},(y-H/2)*${f / 2})*${f}-t*${s}+${p + 2.1}`),
        B: wave(centeredDistance(f * 1.5, p + 4.2, s * 0.75)),
      };
    case 'rain':
      return {
        R: `255 * abs(sin(x*${f}+sin(y*${f / 3}+t*${s})*2+t*${s}))`,
        G: `255 * rand(x*${f}+${p},y*${f}+t*${s},${p + 17})`,
        B: `255 * abs(sin(x*${f}+sin(y*${f / 2}+t*${s * 1.4})*3+${p}))`,
      };
    case 'waves':
      return {
        R: wave(`y*${f}+sin(x*${f / 2}+t*${s})*${p + 1}+t*${s}`),
        G: wave(`x*${f}+sin(y*${f / 2}-t*${s})*${p + 1.5}-t*${s}`),
        B: wave(`(x+y)*${f / 2}+sin((x-y)*${f})*${p + 2}+t*${s}`),
      };
    case 'spiral':
      return {
        R: wave(`${centeredDistance(f, p, s)}+(x-y)*${f / 3}`),
        G: wave(`${centeredDistance(f * 1.4, p + 1.8, s * 0.8)}+(x+y)*${f / 4}`),
        B: wave(`${centeredDistance(f * 0.7, p + 3.6, s * 1.2)}-(x-y)*${f / 2}`),
      };
    case 'fire':
      return {
        R: `255 * max(0,sin(x*${f}+sin(y*${f / 2}+t*${s})*2+t*${s}+${p}))`,
        G: `255 * max(0,sin(x*${f / 2}+sin(y*${f}+t*${s * 0.8})*1.5+t*${s * 0.7}+${p + 2}))`,
        B: `255 * max(0,sin(x*${f / 3}+sin(y*${f / 2}-t*${s})+${p + 4}))`,
      };
    case 'sparkles':
      return {
        R: `255 * rand(x*${f}+t*${s},y*${f},${p})`,
        G: `255 * rand(x*${f},y*${f}+t*${s * 1.2},${p + 23})`,
        B: `255 * rand(x*${f}+${p},y*${f}+t*${s * 0.8},${p + 47})`,
      };
    case 'curtains':
      return {
        R: wave(`x*${f}+sin(y*${f / 2}+t*${s})*${p + 1}+t*${s}`),
        G: wave(`x*${f * 1.4}+sin(y*${f / 3}-t*${s})*${p + 2}-t*${s}`),
        B: wave(`y*${f}+sin(x*${f / 2}+t*${s})*${p + 1.5}+t*${s * 0.6}`),
      };
    default:
      throw new Error(`Unknown math logic family: ${type}`);
  }
}

export const MATH_LOGIC_CATEGORIES = Object.freeze([
  ['geometry', 'Geometry'],
  ['water', 'Water Ripples'],
  ['rain', 'Rain & Drips'],
  ['waves', 'Wave Interference'],
  ['spiral', 'Spirals & Vortices'],
  ['fire', 'Fire & Plasma'],
  ['sparkles', 'Sparkles & Stars'],
  ['curtains', 'Curtains & Stripes'],
]);

const logicPerCategory = 64;

export const MATH_LOGIC_LIBRARY = Object.freeze(MATH_LOGIC_CATEGORIES.flatMap(([category, name]) => (
  Array.from({ length: logicPerCategory }, (_, index) => {
    const frequency = 0.08 + index * 0.017;
    const phase = 0.15 + (index % 16) * 0.21 + Math.floor(index / 16) * 0.37;
    const speed = 0.025 + (index % 8) * 0.035 + Math.floor(index / 8) * 0.018;
    const variant = String(index + 1).padStart(3, '0');
    return Object.freeze({
      id: `${category}-${variant}`,
      category,
      categoryName: name,
      name: `${name} ${variant}`,
      formulas: Object.freeze(formulasFor(category, frequency, phase, speed)),
    });
  })
)));
