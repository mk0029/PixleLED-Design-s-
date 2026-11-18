import test from 'node:test';
import assert from 'node:assert/strict';
import { EngineCore } from '../src/js/engineCore.js';
import { buildAvi, buildZip } from '../src/js/aviZipBuilder.js';
import { DIRECTION_CHOICES } from '../src/js/direction.js';
import { MATH_LOGIC_CATEGORIES, MATH_LOGIC_LIBRARY } from '../src/js/mathLogicLibrary.js';

test('Math Lab library provides 512 unique, validated logics across eight families', () => {
  assert.equal(MATH_LOGIC_LIBRARY.length, 512);
  assert.equal(new Set(MATH_LOGIC_LIBRARY.map((logic) => logic.id)).size, 512);
  assert.deepEqual(MATH_LOGIC_CATEGORIES.map(([, name]) => name), [
    'Geometry', 'Water Ripples', 'Rain & Drips', 'Wave Interference',
    'Spirals & Vortices', 'Fire & Plasma', 'Sparkles & Stars', 'Curtains & Stripes',
  ]);
  for (const logic of MATH_LOGIC_LIBRARY) {
    assert.equal(Object.keys(logic.formulas).length, 3, logic.id);
    assert.doesNotThrow(() => EngineCore.validateFormulas(logic.formulas), logic.id);
  }
});

test('engine catalog contains one preset per engine in six clean categories', () => {
  assert.equal(EngineCore.presets.length, 37);
  assert.equal(EngineCore.categories.length, 6);
  assert.equal(new Set(EngineCore.presets.map((preset) => preset.category)).size, 6);
  assert.equal(new Set(EngineCore.presets.map((preset) => preset.id)).size, 37);
  assert.equal(new Set(EngineCore.presets.map((preset) => preset.name)).size, 37);
  assert.deepEqual(EngineCore.categories.map((category) => category.name), [
    'Vertical Lines', 'Facade & Curtain', 'DJ & Club', 'Geometric', 'Festive', 'Typography',
  ]);
  assert.equal(EngineCore.presets.some((preset) => /animal|danc|human|bird/i.test(preset.name)), false);
});

test('typography engines render dual and vertical text with controllable backgrounds', () => {
  const dual = EngineCore.generateFrames({
    engineId: 'dual_text',
    params: {
      dualTextLeft: 'LEFT',
      dualTextRight: 'RIGHT',
      textBackgroundMode: 'solid',
      textBackgroundColor: '#204060',
      textBackgroundBrightness: 0.5,
    },
  }, 30, 20, 2, 1);
  const vertical = EngineCore.generateFrames({
    engineId: 'vertical_text',
    params: { text: 'LED', speed: 1.5 },
  }, 30, 20, 2, 1);
  assert.equal(dual.length, 2);
  assert.ok(dual.every((frame) => frame.length === 30 * 20 * 3));
  assert.ok(vertical.every((frame) => frame.length === 30 * 20 * 3));
  assert.deepEqual([...dual[0].slice(0, 3)], [16, 32, 48]);
  assert.notDeepEqual(dual[0], dual[1]);
  assert.notDeepEqual(vertical[0], vertical[1]);

  const paletteBackground = EngineCore.generateFrames({
    engineId: 'text',
    params: {
      text: 'A',
      textBackgroundMode: 'palette',
      textBackgroundBrightness: 0.3,
      textBackgroundSpeed: 1,
    },
  }, 12, 12, 2, 1);
  assert.notDeepEqual(paletteBackground[0].slice(0, 3), paletteBackground[1].slice(0, 3));
});

test('single-line scan presets move down the matrix and return packed RGB frames', () => {
  for (const kind of ['single_line_scanner', 'single_line_comet']) {
    const preset = EngineCore.presets.find((item) => item.kind === kind);
    assert.ok(preset);
    const frames = EngineCore.generateFrames({
      engineId: preset.engineId,
      params: { colorMode: 'solid', solidColor: '#ffffff', speed: 1 },
    }, 8, 8, 4, 4);
    assert.equal(frames.length, 4);
    assert.ok(frames.every((frame) => frame.length === 8 * 8 * 3));
    const brightestRow = (frame) => {
      const brightnessByRow = Array.from({ length: 8 }, (_, y) => {
        let total = 0;
        for (let x = 0; x < 8; x += 1) {
          const offset = (y * 8 + x) * 3;
          total += frame[offset] + frame[offset + 1] + frame[offset + 2];
        }
        return total;
      });
      return brightnessByRow.indexOf(Math.max(...brightnessByRow));
    };
    assert.ok(brightestRow(frames[3]) > brightestRow(frames[1]), `${kind} travels top-to-bottom`);
  }
});

test('large-scale effects render at preset and custom matrix resolutions', () => {
  assert.equal(EngineCore.largeScaleEffects.engines.length, 7);
  const expectedControls = {
    skyscraper_bottom_up_rise: ['waveStagger', 'tipGlow', 'direction'],
    architectural_border_trace: ['borderThickness', 'innerFrameScale', 'chaseMode'],
    pulsing_polygon_star: ['starPoints', 'outerRadius', 'innerRadius', 'spinSpeed', 'whiteOutline'],
    concentric_target_rings: ['gridSpacing', 'ringRadius', 'pulseAmplitude'],
    split_horizon_wave: ['splitRatio', 'waveHeight', 'seamThickness'],
    diagonal_rainbow_curtain: ['angleDegrees', 'bandWidth', 'direction'],
    starlight_snow_drift: ['density', 'swayAmount', 'tailLength'],
  };
  for (const effect of EngineCore.largeScaleEffects.engines) {
    const preset = EngineCore.presets.find((item) => item.kind === effect.id);
    const options = EngineCore.getDynamicDefaults(effect.id, 30, 20);
    for (const [width, height] of [[1, 1], [30, 20], [25, 40], [50, 50]]) {
      const [frame] = EngineCore.generateFrames({ engineId: preset.engineId, params: options }, width, height, 1, 25);
      assert.ok(frame instanceof Uint8Array);
      assert.equal(frame.length, width * height * 3);
    }
    const keys = EngineCore.getDynamicParameters(effect.id, 30, 20).map((control) => control.key);
    for (const key of expectedControls[effect.id]) assert.ok(keys.includes(key), `${effect.id} exposes ${key}`);
    assert.equal(keys.includes('palette'), false);
    assert.ok(keys.includes('speed'));
  }
});

test('facade effects render scalable RGB frames and expose effect-specific controls', () => {
  assert.equal(EngineCore.facadeEffects.engines.length, 6);
  for (const effect of EngineCore.facadeEffects.engines) {
    const preset = EngineCore.presets.find((item) => item.kind === effect.id);
    const options = EngineCore.getDynamicDefaults(effect.id, 30, 20);
    for (const [width, height] of [[1, 1], [30, 20], [50, 50]]) {
      const frames = EngineCore.generateFrames({ engineId: preset.engineId, params: options }, width, height, 2, 25);
      assert.equal(frames.length, 2);
      assert.ok(frames.every((frame) => frame instanceof Uint8Array && frame.length === width * height * 3));
    }
    assert.ok(EngineCore.facadeEffects.getParameters(effect.id, 30, 20).length >= 4);
  }
});

test('facade custom palette and timeline options affect rendered output', () => {
  const preset = EngineCore.presets.find((item) => item.kind === 'rotating_quadrant_wheel');
  const params = {
    ...EngineCore.getDynamicDefaults(preset.kind, 30, 20),
    colorMode: 'custom',
    customColors: ['#ff0000', '#00ff00', '#0000ff', '#ffffff'],
  };
  const customFrame = EngineCore.generateFrames({ engineId: preset.engineId, params }, 30, 20, 1, 20)[0];
  const changedFrame = EngineCore.generateFrames({
    engineId: preset.engineId,
    params: { ...params, spokeCount: '8', speed: 2.4 },
  }, 30, 20, 1, 20)[0];
  assert.notDeepEqual(customFrame, changedFrame);
  assert.ok(customFrame.some((channel) => channel > 0));
});

test('direction choices include compass movement and change rendered orientation', () => {
  assert.deepEqual(DIRECTION_CHOICES.map(([value]) => value), [
    'forward', 'reverse', 'left', 'right', 'top-right', 'bottom-right', 'top-left', 'bottom-left', 'bounce',
  ]);
  const preset = EngineCore.presets.find((item) => item.kind === 'tier_waterfall_sparkle');
  const params = {
    ...EngineCore.getDynamicDefaults(preset.kind, 12, 8),
    colorMode: 'solid',
    solidColor: '#ffffff',
  };
  const forward = EngineCore.generateFrames({
    engineId: preset.engineId,
    params: { ...params, direction: 'forward' },
  }, 12, 8, 1, 20)[0];
  const right = EngineCore.generateFrames({
    engineId: preset.engineId,
    params: { ...params, direction: 'right' },
  }, 12, 8, 1, 20)[0];
  assert.notDeepEqual(right, forward);
});

test('festival presets are vivid and fireworks launch upward in multiple bursts', () => {
  for (const kind of ['diya', 'lotus', 'rangoli']) {
    const preset = EngineCore.presets.find((item) => item.kind === kind);
    assert.ok(preset, `${kind} is listed in the festival library`);
    const frame = EngineCore.generateFrames({ engineId: preset.engineId }, 30, 20, 1, 20)[0];
    assert.equal(frame.length, 30 * 20 * 3);
  }

  const mandala = EngineCore.generateFrames({ engineId: 'mandala' }, 30, 20, 1, 20)[0];
  const averageBrightness = mandala.reduce((sum, channel) => sum + channel, 0) / mandala.length;
  assert.ok(averageBrightness > 40);

  const rocketFrames = EngineCore.generateFrames({ engineId: 'fireworks' }, 1, 20, 6, 10);
  const verticalCentroid = (frame) => {
    let weightedY = 0;
    let brightness = 0;
    for (let y = 0; y < 20; y += 1) {
      const offset = y * 3;
      const pixelBrightness = frame[offset] + frame[offset + 1] + frame[offset + 2];
      weightedY += y * pixelBrightness;
      brightness += pixelBrightness;
    }
    return weightedY / brightness;
  };
  assert.ok(verticalCentroid(rocketFrames[5]) < verticalCentroid(rocketFrames[0]));

  const burst = EngineCore.generateFrames({ engineId: 'fireworks' }, 30, 20, 16, 10)[15];
  const litColumns = Array.from({ length: 30 }, (_, x) => (
    Array.from({ length: 20 }, (_, y) => burst[(y * 30 + x) * 3]).some((channel) => channel > 0)
  )).filter(Boolean).length;
  assert.ok(litColumns > 3);
});

test('color resolver supports palettes, solid, custom, rainbow, morph and hue shift modes', () => {
  const solid = EngineCore.createColorResolver({ colorMode: 'solid', solidColor: '#ff0000', hueShift: 0 });
  assert.deepEqual(solid.colorAt(0.3, 0, 1), [255, 0, 0]);
  const shifted = EngineCore.createColorResolver({ colorMode: 'solid', solidColor: '#ff0000', hueShift: 120 });
  assert.deepEqual(shifted.colorAt(0.3, 0, 1), [0, 255, 0]);
  const rainbow = EngineCore.createColorResolver({ colorMode: 'rainbow', autoColorSpeed: 1 });
  assert.notDeepEqual(rainbow.colorAt(0.2, 0), rainbow.colorAt(0.2, 1));
  const morph = EngineCore.createColorResolver({
    colorMode: 'morph',
    morphSource: 'custom',
    customColors: ['#ff0000', '#00ff00', '#0000ff', '#ffffff'],
    autoColorSpeed: 1,
  });
  assert.notDeepEqual(morph.colorAt(0, 0), morph.colorAt(0, 1));
  assert.equal(morph.isWhiteAccent([255, 255, 255]), true);
  const normalIntensity = EngineCore.createColorResolver({
    colorMode: 'solid', solidColor: '#ffffff', patternDensity: 1,
  });
  const higherDensity = EngineCore.createColorResolver({
    colorMode: 'solid', solidColor: '#ffffff', patternDensity: 2,
  });
  const halfBrightness = EngineCore.createColorResolver({
    colorMode: 'solid', solidColor: '#ffffff', brightness: 0.5,
  });
  assert.deepEqual(normalIntensity.colorAt(0, 0, 0.25), [64, 64, 64]);
  assert.deepEqual(higherDensity.colorAt(0, 0, 0.25), [128, 128, 128]);
  assert.deepEqual(halfBrightness.applyBrightness([255, 200, 100]), [128, 100, 50]);
});

test('optional animated backgrounds fill dark procedural, math and drawing pixels', () => {
  const off = EngineCore.createColorResolver({ backgroundMode: 'off' });
  const blank = new Uint8Array(3);
  assert.deepEqual([...off.fillBackground(blank.slice(), 1, 1)], [0, 0, 0]);

  const solidParams = {
    backgroundMode: 'solid',
    backgroundColor: '#204060',
    backgroundBrightness: 0.5,
  };
  const math = EngineCore.generateFrames({
    pattern: 'math',
    formulas: { R: '0', G: '0', B: '0' },
    params: solidParams,
  }, 1, 1, 1)[0];
  assert.deepEqual([...math], [16, 32, 48]);

  const drawing = EngineCore.generateFrames({
    pattern: 'draw',
    width: 1,
    height: 1,
    frames: [blank],
    params: solidParams,
  }, 1, 1, 1)[0];
  assert.deepEqual([...drawing], [16, 32, 48]);

  const rainbow = EngineCore.generateFrames({
    pattern: 'math',
    formulas: { R: '0', G: '0', B: '0' },
    params: { backgroundMode: 'rainbow', backgroundBrightness: 0.5 },
  }, 1, 1, 2, 1);
  assert.notDeepEqual(rainbow[0], rainbow[1]);
});

test('legacy cloned preset IDs resolve to the single unique engine ID', () => {
  const engineId = EngineCore.resolveEngineId('skyscraper-bottom-up-column-rise--reverse-flow');
  assert.equal(engineId, 'skyscraper_bottom_up_rise');
  const [frame] = EngineCore.generateFrames({
    pattern: 'skyscraper-bottom-up-column-rise--reverse-flow',
    params: { colorMode: 'solid', solidColor: '#ff0000', direction: 'top-down' },
  }, 4, 4, 1, 20);
  assert.equal(frame.length, 4 * 4 * 3);
});

test('procedural effects return packed RGB frames at any supported matrix size', () => {
  const preset = EngineCore.presets.find((item) => item.kind === 'plasma');
  for (const [width, height] of [[1, 1], [30, 20], [50, 50]]) {
    const [frame] = EngineCore.generateFrames({ pattern: preset.id }, width, height, 1);
    assert.ok(frame instanceof Uint8Array);
    assert.equal(frame.length, width * height * 3);
  }
});

test('pixel drawings scale from their saved matrix dimensions', () => {
  const scene = {
    pattern: 'draw',
    width: 2,
    height: 1,
    frames: [new Uint8Array([255, 0, 0, 0, 0, 255])],
  };
  const [frame] = EngineCore.generateFrames(scene, 4, 2, 1);
  assert.equal(frame.length, 24);
  assert.deepEqual([...frame.slice(0, 12)], [255, 0, 0, 255, 0, 0, 0, 0, 255, 0, 0, 255]);
});

test('math formulas allow safe functions and deterministic seeded rand', () => {
  const formulas = {
    R: 'min(255, abs(sin(x + t)) * 255)',
    G: 'hypot(x, y) + pi',
    B: 'rand(x, y, t) * 255',
  };
  EngineCore.validateFormulas(formulas);
  const first = EngineCore.generateFrames({ pattern: 'math', formulas }, 3, 2, 1)[0];
  const again = EngineCore.generateFrames({ pattern: 'math', formulas }, 3, 2, 1)[0];
  assert.deepEqual(first, again);
  assert.throws(() => EngineCore.validateFormulas({ ...formulas, R: 'window()' }), /not allowed/);
});

test('Math Lab speed, density and brightness alter formula output', () => {
  const scene = {
    pattern: 'math',
    formulas: { R: 'x + t * 10', G: '100', B: '0' },
    params: { speed: 1, density: 1, brightness: 1 },
  };
  const normal = EngineCore.generateFrames(scene, 2, 1, 2, 20)[1];
  const faster = EngineCore.generateFrames({
    ...scene,
    params: { ...scene.params, speed: 2 },
  }, 2, 1, 2, 20)[1];
  const reversed = EngineCore.generateFrames({
    ...scene,
    params: { ...scene.params, direction: 'reverse' },
  }, 2, 1, 2, 20);
  const denser = EngineCore.generateFrames({
    ...scene,
    params: { ...scene.params, density: 2 },
  }, 2, 1, 2, 20)[0];
  const dimmer = EngineCore.generateFrames({
    ...scene,
    params: { ...scene.params, brightness: 0.5 },
  }, 2, 1, 2, 20)[0];
  assert.notDeepEqual(faster, normal);
  assert.deepEqual(reversed[0], normal);
  assert.equal(denser[3], 2);
  assert.equal(dimmer[1], 50);
});

test('AVI builder emits RIFF, uncompressed stream headers and padded BGR frame bytes', async () => {
  const frame = new Uint8Array([255, 0, 0]);
  const bytes = new Uint8Array(await buildAvi([frame, frame, frame], 1, 1, 20).arrayBuffer());
  const view = new DataView(bytes.buffer);
  const content = new TextDecoder().decode(bytes);
  assert.equal(content.slice(0, 4), 'RIFF');
  assert.equal(content.slice(8, 12), 'AVI ');
  assert.ok(content.includes('hdrl'));
  assert.ok(content.includes('strf'));
  assert.ok(content.includes('movi'));
  assert.ok(content.includes('idx1'));
  const mainHeader = content.indexOf('avih');
  assert.equal(view.getUint32(mainHeader + 8 + 16, true), 3);
  const frameTag = content.indexOf('00db');
  assert.ok(frameTag > 0);
  assert.deepEqual([...bytes.slice(frameTag + 8, frameTag + 12)], [0, 0, 255, 0]);
});

test('ZIP builder emits a valid stored local entry and end directory record', async () => {
  const bytes = new Uint8Array(await (await buildZip([
    { name: 'show.avi', data: new Uint8Array([1, 2, 3]) },
    { name: 'guide.txt', data: new TextEncoder().encode('offline') },
  ])).arrayBuffer());
  const view = new DataView(bytes.buffer);
  assert.equal(view.getUint32(0, true), 0x04034b50);
  assert.equal(new TextDecoder().decode(bytes.slice(30, 38)), 'show.avi');
  assert.equal(view.getUint32(bytes.length - 22, true), 0x06054b50);
  assert.equal(view.getUint16(bytes.length - 14, true), 2);
});
