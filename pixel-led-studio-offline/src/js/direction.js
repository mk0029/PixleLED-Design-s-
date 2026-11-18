export const DIRECTION_CHOICES = [
  ['forward', 'Forward'],
  ['reverse', 'Reverse'],
  ['left', 'Left'],
  ['right', 'Right'],
  ['top-right', 'Top Right'],
  ['bottom-right', 'Bottom Right'],
  ['top-left', 'Top Left'],
  ['bottom-left', 'Bottom Left'],
  ['bounce', 'Bounce'],
];

const ROTATION_BY_DIRECTION = {
  left: Math.PI / 2,
  right: -Math.PI / 2,
  'top-right': -3 * Math.PI / 4,
  'bottom-right': -Math.PI / 4,
  'top-left': 3 * Math.PI / 4,
  'bottom-left': Math.PI / 4,
};

function mod(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

export function motionTime(seconds, speed, direction, period = 4) {
  const elapsed = seconds * speed;
  if (direction === 'reverse') return -elapsed;
  if (direction === 'bounce') {
    const phase = mod(elapsed, period * 2);
    return phase <= period ? phase : period * 2 - phase;
  }
  return elapsed;
}

export function frameIndexForDirection(index, frameCount, direction) {
  if (direction === 'reverse') return frameCount - 1 - index;
  if (direction !== 'bounce' || frameCount < 2) return index;
  const period = 2 * (frameCount - 1);
  const phase = index % period;
  return phase < frameCount ? phase : period - phase;
}

export function orientFrame(frame, width, height, direction) {
  const angle = ROTATION_BY_DIRECTION[direction];
  if (angle === undefined || width === 1 && height === 1) return frame;

  const output = new Uint8Array(frame.length);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const centerX = (width - 1) / 2;
  const centerY = (height - 1) / 2;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = x - centerX;
      const dy = y - centerY;
      const sourceX = mod(Math.round(centerX + cos * dx + sin * dy), width);
      const sourceY = mod(Math.round(centerY - sin * dx + cos * dy), height);
      const sourceOffset = (sourceY * width + sourceX) * 3;
      const targetOffset = (y * width + x) * 3;
      output.set(frame.subarray(sourceOffset, sourceOffset + 3), targetOffset);
    }
  }
  return output;
}
