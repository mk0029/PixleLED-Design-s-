import { EngineCore } from './engineCore.js';
import { buildAvi, buildZip, downloadBlob } from './aviZipBuilder.js';
import { COLOR_DEFAULTS, COLOR_MODE_CHOICES, PRESET_PALETTE_CHOICES } from './colorResolver.js';
import { DIRECTION_CHOICES } from './direction.js';
import { LedSimulator } from './ledSimulator.js';
import { MATH_LOGIC_CATEGORIES, MATH_LOGIC_LIBRARY } from './mathLogicLibrary.js';
import { PixelEditor } from './pixelEditor.js';

const $ = (selector) => document.querySelector(selector);
const STORAGE_KEY = 'pixel-led-studio-project-v1';
const DEFAULT_FRAME_COUNT = 60;
const MAX_PREVIEW_FRAMES = 600;
const MAX_FRAME_COUNT = 18000;
const DEFAULT_DURATION = 3;
const DEFAULT_LIVE_PARAMS = Object.freeze({
  ...COLOR_DEFAULTS,
  speed: 1,
  density: 1,
  amplitude: 1,
  brightness: 1,
  direction: 'forward',
  text: 'PIXEL LED',
  dualTextLeft: 'LEFT',
  dualTextRight: 'RIGHT',
  textBackgroundMode: 'transparent',
  textBackgroundColor: '#101820',
  textBackgroundSpeed: 1,
  textBackgroundBrightness: 0.22,
  backgroundChase: true,
  doubleHeight: false,
});
const state = {
  width: 30,
  height: 20,
  fps: 20,
  category: 'All effects',
  activePreset: EngineCore.presets[0],
  activeScene: null,
  previewFrames: [],
  timeline: [],
  renderRequest: 0,
  toastTimer: 0,
  mathTimer: 0,
  mathParameters: {
    speed: 1,
    density: 1,
    brightness: 1,
    direction: 'forward',
    frameCount: DEFAULT_FRAME_COUNT,
    duration: DEFAULT_DURATION,
  },
};

const simulator = new LedSimulator($('#ledCanvas'), updateFrameLabel);
const editor = new PixelEditor($('#paintCanvas'), $('#brushColor'), () => persist());

function toast(message, error = false) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.toggle('error', error);
  element.classList.add('visible');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => element.classList.remove('visible'), 3600);
}

function safeProjectName() {
  const name = $('#projectName').value.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/\s+/g, ' ');
  return name.slice(0, 64) || 'LED-Show';
}

function formulasFromUI() {
  return {
    R: $('#formulaR').value.trim(),
    G: $('#formulaG').value.trim(),
    B: $('#formulaB').value.trim(),
  };
}

function colorParamsFromUI() {
  return {
    colorMode: $('#colorMode').value,
    presetPalette: $('#presetPalette').value,
    morphSource: $('#morphSource').value,
    customColors: ['#customColorPrimary', '#customColorSecondary', '#customColorAccent1', '#customColorAccent2']
      .map((selector) => $(selector).value),
    solidColor: $('#solidColor').value,
    autoColorSpeed: Number($('#autoColorSpeed').value),
    hueShift: Number($('#hueShift').value),
    whiteAccent: $('#whiteAccent').checked,
    backgroundMode: $('#backgroundMode').value,
    backgroundColor: $('#backgroundColor').value,
    backgroundAutoSpeed: Number($('#backgroundAutoSpeed').value),
    backgroundBrightness: Number($('#backgroundBrightness').value),
  };
}

function paramsFromUI() {
  return {
    speed: Number($('#speed').value),
    density: Number($('#density').value),
    amplitude: Number($('#density').value),
    brightness: Number($('#brightness').value),
    direction: $('#direction').value,
    text: $('#bannerText').value.trim() || 'PIXEL LED',
    dualTextLeft: $('#dualTextLeft').value.trim() || 'LEFT',
    dualTextRight: $('#dualTextRight').value.trim() || 'RIGHT',
    textBackgroundMode: $('#textBackgroundMode').value,
    textBackgroundColor: $('#textBackgroundColor').value,
    textBackgroundSpeed: Number($('#textBackgroundSpeed').value),
    textBackgroundBrightness: Number($('#textBackgroundBrightness').value),
    backgroundChase: $('#backgroundChase').checked,
    doubleHeight: $('#doubleHeight').checked,
    ...colorParamsFromUI(),
  };
}

function mathParamsFromUI() {
  const params = {
    speed: Number($('#mathSpeed').value),
    density: Number($('#mathDensity').value),
    brightness: Number($('#mathBrightness').value),
    direction: $('#mathDirection').value,
  };
  state.mathParameters = {
    ...params,
    frameCount: Number($('#mathFrames').value),
    duration: Number($('#mathDuration').value),
  };
  return params;
}

function normalizeMathSettings(settings, fps = state.fps) {
  const speed = Number(settings?.speed);
  const density = Number(settings?.density);
  const brightness = Number(settings?.brightness);
  const direction = DIRECTION_CHOICES.some(([id]) => id === settings?.direction)
    ? settings.direction
    : 'forward';
  const duration = Number(settings?.duration);
  const frameCount = Number(settings?.frameCount);
  const safeDuration = validDuration(duration) ? duration : DEFAULT_DURATION;
  const safeFrameCount = validFrameCount(frameCount, fps)
    ? frameCount
    : frameCountForDuration(safeDuration, fps);
  return {
    speed: Number.isFinite(speed) ? Math.max(0.1, Math.min(3, speed)) : 1,
    density: Number.isFinite(density) ? Math.max(0.3, Math.min(3, density)) : 1,
    brightness: Number.isFinite(brightness) ? Math.max(0, Math.min(1, brightness)) : 1,
    direction,
    frameCount: safeFrameCount,
    duration: safeFrameCount / fps,
  };
}

function syncMathControls(scene = null) {
  if (scene?.pattern === 'math') {
    const params = scene.params || {};
    state.mathParameters = normalizeMathSettings({
      ...state.mathParameters,
      ...params,
      frameCount: scene.frameCount,
      duration: scene.duration,
    });
  }
  state.mathParameters = normalizeMathSettings(state.mathParameters);
  const values = state.mathParameters;
  $('#mathSpeed').value = String(values.speed);
  $('#mathDensity').value = String(values.density);
  $('#mathBrightness').value = String(values.brightness);
  $('#mathDirection').value = values.direction;
  $('#mathFrames').min = String(minimumFrameCount());
  $('#mathFrames').max = String(MAX_FRAME_COUNT);
  $('#mathFrames').value = String(values.frameCount);
  $('#mathDuration').value = String(values.duration);
  updateMathParameterLabels();
}

function populateMathLogicControls() {
  const categorySelect = $('#mathCategory');
  MATH_LOGIC_CATEGORIES.forEach(([id, name]) => categorySelect.add(new Option(name, id)));
}

function syncMathLogicSelection(scene) {
  if (scene.pattern !== 'math') return;
  const logic = MATH_LOGIC_LIBRARY.find((entry) => entry.id === scene.mathLogicId);
  if (logic) $('#mathCategory').value = logic.category;
}

function activateMathScene(scene) {
  state.activeScene = scene;
  state.activePreset = null;
  $('#activeEffect').textContent = scene.name;
  setTextControlsVisible(null);
  syncSceneControls(scene);
  renderPreview();
  persist();
}

function applyMathLogic(logic) {
  EngineCore.validateFormulas(logic.formulas);
  $('#mathCategory').value = logic.category;
  $('#formulaR').value = logic.formulas.R;
  $('#formulaG').value = logic.formulas.G;
  $('#formulaB').value = logic.formulas.B;
  const scene = createMathScene(logic.id);
  scene.name = `Math Lab · ${logic.name}`;
  activateMathScene(scene);
  toast(`${logic.name} loaded into Math Lab.`);
}

function switchMathPattern() {
  const category = $('#mathCategory').value;
  const options = MATH_LOGIC_LIBRARY.filter((logic) => logic.category === category);
  const currentIndex = options.findIndex((logic) => logic.id === state.activeScene?.mathLogicId);
  const logic = options[(currentIndex + 1) % options.length];
  if (logic) applyMathLogic(logic);
}

function validDuration(value) {
  const duration = Number(value);
  return Number.isFinite(duration) && duration >= 0.1 && duration <= 120;
}

function minimumFrameCount(fps = state.fps) {
  return Math.max(1, Math.ceil(0.1 * fps));
}

function validFrameCount(value, fps = state.fps) {
  const frameCount = Number(value);
  return Number.isInteger(frameCount)
    && frameCount >= minimumFrameCount(fps)
    && frameCount <= MAX_FRAME_COUNT;
}

function frameCountForDuration(value, fps = state.fps) {
  const duration = Number(value);
  const frameCount = Number.isFinite(duration) ? Math.round(duration * fps) : DEFAULT_FRAME_COUNT;
  return Math.max(minimumFrameCount(fps), Math.min(MAX_FRAME_COUNT, frameCount));
}

function syncDensityControl(scene, preset) {
  const definition = preset && EngineCore.isDynamicEffect(preset.kind)
    ? EngineCore.getDynamicParameters(preset.kind, state.width, state.height).find((item) => item.key === 'density')
    : null;
  const input = $('#density');
  const min = definition?.min ?? 0.3;
  const max = definition?.max ?? 3;
  const step = definition?.step ?? 0.1;
  const value = Number(scene.params.density ?? 1);
  const density = Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : 1;
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(density);
  scene.params.density = density;
  scene.params.amplitude = density;
  scene.params.densityAffectsIntensity = !definition;
  scene.params.patternDensity = definition ? 1 : density;
}

function setActivePreset(preset) {
  state.activePreset = preset;
  const defaults = EngineCore.isDynamicEffect(preset.kind)
    ? EngineCore.getDynamicDefaults(preset.kind, state.width, state.height)
    : {};
  const params = {
    ...DEFAULT_LIVE_PARAMS,
    customColors: [...COLOR_DEFAULTS.customColors],
    ...defaults,
  };
  const frameCount = DEFAULT_FRAME_COUNT;
  state.activeScene = {
    pattern: preset.id,
    engineId: preset.engineId,
    name: preset.name,
    kind: preset.kind,
    params,
    frameCount,
    duration: frameCount / state.fps,
  };
  syncSceneControls(state.activeScene);
  $('#activeEffect').textContent = preset.name;
  setTextControlsVisible(preset.kind);
  renderPreview();
  persist();
}

function setTextControlsVisible(kind) {
  const visible = ['text', 'dual_text', 'vertical_text'].includes(kind);
  $('#textParameters').hidden = !visible;
  $('#bannerTextField').hidden = !visible || kind === 'dual_text';
  $('#dualTextLeftField').hidden = kind !== 'dual_text';
  $('#dualTextRightField').hidden = kind !== 'dual_text';
}

function syncSceneControls(scene) {
  const selectedPreset = EngineCore.presets.find((preset) => preset.id === EngineCore.resolveEngineId(scene.engineId || scene.pattern));
  const defaults = selectedPreset && EngineCore.isDynamicEffect(selectedPreset.kind)
    ? EngineCore.getDynamicDefaults(selectedPreset.kind, state.width, state.height)
    : {};
  scene.params = {
    ...COLOR_DEFAULTS,
    customColors: [...COLOR_DEFAULTS.customColors],
    ...defaults,
    ...(scene.params || scene.options || {}),
  };
  const requestedDuration = validDuration(scene.duration) ? Number(scene.duration) : DEFAULT_DURATION;
  scene.frameCount = validFrameCount(scene.frameCount)
    ? Number(scene.frameCount)
    : frameCountForDuration(requestedDuration);
  scene.duration = scene.frameCount / state.fps;
  $('#animationFrames').min = String(minimumFrameCount());
  $('#animationFrames').max = String(MAX_FRAME_COUNT);
  $('#animationFrames').value = String(scene.frameCount);
  $('#animationDuration').value = String(scene.duration);
  updatePresetDurations();
  if (scene.params.hueShift === undefined && scene.params.hue !== undefined) scene.params.hueShift = scene.params.hue;
  const params = scene.params;
  $('#playbackParameters').hidden = scene.pattern === 'math';
  if (scene.pattern === 'math' && scene.formulas) {
    $('#formulaR').value = scene.formulas.R;
    $('#formulaG').value = scene.formulas.G;
    $('#formulaB').value = scene.formulas.B;
  }
  if (Number.isFinite(Number(params.speed))) {
    const speed = Math.max(0.1, Math.min(3, Number(params.speed)));
    params.speed = speed;
    $('#speed').value = String(speed);
  }
  if (Number.isFinite(Number(params.brightness))) $('#brightness').value = String(params.brightness);
  syncDensityControl(scene, selectedPreset);
  const direction = DIRECTION_CHOICES.some(([id]) => id === params.direction) ? params.direction : 'forward';
  params.direction = direction;
  $('#direction').value = direction;
  $('#bannerText').value = typeof params.text === 'string' ? params.text : 'PIXEL LED';
  $('#dualTextLeft').value = typeof params.dualTextLeft === 'string' ? params.dualTextLeft : 'LEFT';
  $('#dualTextRight').value = typeof params.dualTextRight === 'string' ? params.dualTextRight : 'RIGHT';
  $('#textBackgroundMode').value = ['solid', 'palette', 'rainbow'].includes(params.textBackgroundMode)
    ? params.textBackgroundMode
    : 'transparent';
  $('#textBackgroundColor').value = /^#[\da-f]{6}$/i.test(params.textBackgroundColor || '')
    ? params.textBackgroundColor
    : '#101820';
  const textBackgroundSpeed = Number(params.textBackgroundSpeed ?? 1);
  $('#textBackgroundSpeed').value = String(Number.isFinite(textBackgroundSpeed)
    ? Math.max(0.2, Math.min(5, textBackgroundSpeed))
    : 1);
  const textBackgroundBrightness = Number(params.textBackgroundBrightness ?? 0.22);
  $('#textBackgroundBrightness').value = String(Number.isFinite(textBackgroundBrightness)
    ? Math.max(0.05, Math.min(1, textBackgroundBrightness))
    : 0.22);
  if (typeof params.backgroundChase === 'boolean') $('#backgroundChase').checked = params.backgroundChase;
  if (typeof params.doubleHeight === 'boolean') $('#doubleHeight').checked = params.doubleHeight;
  updateTextBackgroundVisibility();
  syncColorControls(params);
  updateParameterLabels();
  syncMathControls(scene.pattern === 'math' ? scene : null);
  syncMathLogicSelection(scene);
  renderDynamicParameters(scene, selectedPreset);
}

function syncColorControls(params) {
  const colorMode = COLOR_MODE_CHOICES.some(([id]) => id === params.colorMode) ? params.colorMode : COLOR_DEFAULTS.colorMode;
  const presetPalette = PRESET_PALETTE_CHOICES.some(([id]) => id === params.presetPalette)
    ? params.presetPalette
    : COLOR_DEFAULTS.presetPalette;
  $('#colorMode').value = colorMode;
  $('#presetPalette').value = presetPalette;
  $('#morphSource').value = params.morphSource === 'custom' ? 'custom' : 'preset';
  const colors = Array.isArray(params.customColors) && params.customColors.length === 4
    ? params.customColors
    : COLOR_DEFAULTS.customColors;
  ['#customColorPrimary', '#customColorSecondary', '#customColorAccent1', '#customColorAccent2']
    .forEach((selector, index) => { $(selector).value = colors[index]; });
  $('#solidColor').value = params.solidColor || COLOR_DEFAULTS.solidColor;
  $('#autoColorSpeed').value = String(params.autoColorSpeed ?? COLOR_DEFAULTS.autoColorSpeed);
  $('#hueShift').value = String(params.hueShift ?? COLOR_DEFAULTS.hueShift);
  $('#whiteAccent').checked = params.whiteAccent !== false;
  const backgroundMode = ['solid', 'palette', 'rainbow'].includes(params.backgroundMode)
    ? params.backgroundMode
    : COLOR_DEFAULTS.backgroundMode;
  $('#backgroundMode').value = backgroundMode;
  $('#backgroundColor').value = params.backgroundColor || COLOR_DEFAULTS.backgroundColor;
  $('#backgroundAutoSpeed').value = String(params.backgroundAutoSpeed ?? COLOR_DEFAULTS.backgroundAutoSpeed);
  $('#backgroundBrightness').value = String(params.backgroundBrightness ?? COLOR_DEFAULTS.backgroundBrightness);
  updateColorControlVisibility();
}

function updateColorControlVisibility() {
  const mode = $('#colorMode').value;
  const source = $('#morphSource').value;
  $('#presetPaletteField').hidden = mode !== 'preset' && !(mode === 'morph' && source === 'preset');
  $('#morphSourceField').hidden = mode !== 'morph';
  $('#customColorControls').hidden = mode !== 'custom' && !(mode === 'morph' && source === 'custom');
  $('#solidColorField').hidden = mode !== 'solid';
  const backgroundMode = $('#backgroundMode').value;
  $('#backgroundColorField').hidden = backgroundMode !== 'solid';
  $('#backgroundAutoSpeedField').hidden = !['palette', 'rainbow'].includes(backgroundMode);
  $('#backgroundBrightnessField').hidden = backgroundMode === 'off';
}

function renderDynamicParameters(scene, preset) {
  const container = $('#dynamicParameters');
  const isDynamic = Boolean(preset && EngineCore.isDynamicEffect(preset.kind));
  $('#standardParameters').hidden = isDynamic;
  container.hidden = !isDynamic;
  container.replaceChildren();
  if (!isDynamic) return;

  const defaults = EngineCore.getDynamicDefaults(preset.kind, state.width, state.height);
  scene.params = { ...COLOR_DEFAULTS, customColors: [...COLOR_DEFAULTS.customColors], ...defaults, ...(scene.params || {}) };
  if (!Array.isArray(scene.params.customColors) || scene.params.customColors.length !== 4) {
    scene.params.customColors = [...COLOR_DEFAULTS.customColors];
  }
  const controls = EngineCore.getDynamicParameters(preset.kind, state.width, state.height)
    .filter((definition) => !['speed', 'density', 'direction'].includes(definition.key));
  const refresh = () => {
    renderPreview();
    persist();
  };
  let customColorPicker;
  controls.forEach((definition) => {
    if (definition.type === 'range') {
      const label = document.createElement('label');
      label.className = 'range-control';
      const title = document.createElement('span');
      title.append(document.createTextNode(definition.label));
      const output = document.createElement('output');
      const input = document.createElement('input');
      input.type = 'range';
      input.min = String(definition.min);
      input.max = String(definition.max);
      input.step = String(definition.step);
      input.value = String(scene.params[definition.key] ?? definition.value);
      output.value = `${input.value}${definition.unit}`;
      title.append(output);
      input.addEventListener('input', () => {
        scene.params[definition.key] = Number(input.value);
        output.value = `${input.value}${definition.unit}`;
        refresh();
      });
      label.append(title, input);
      container.append(label);
      return;
    }

    if (definition.type === 'select') {
      const label = document.createElement('label');
      label.className = 'compact-field';
      label.append(document.createTextNode(definition.label));
      const select = document.createElement('select');
      select.dataset.parameter = definition.key;
      definition.items.forEach(([value, name]) => select.add(new Option(name, value)));
      select.value = String(scene.params[definition.key] ?? definition.value);
      select.addEventListener('change', () => {
        scene.params[definition.key] = select.value;
        if (definition.key === 'palette' && customColorPicker) customColorPicker.hidden = select.value !== 'custom';
        refresh();
      });
      label.append(select);
      container.append(label);
      if (definition.key === 'palette') {
        customColorPicker = document.createElement('div');
        customColorPicker.className = 'custom-colors';
        customColorPicker.hidden = select.value !== 'custom';
        ['Color 1', 'Color 2', 'Color 3', 'Color 4'].forEach((name, index) => {
          const colorLabel = document.createElement('label');
          colorLabel.append(document.createTextNode(name));
          const colorInput = document.createElement('input');
          colorInput.type = 'color';
          colorInput.value = String(scene.params.customColors[index]);
          colorInput.setAttribute('aria-label', name);
          colorInput.addEventListener('input', () => {
            scene.params.customColors[index] = colorInput.value;
            refresh();
          });
          colorLabel.append(colorInput);
          customColorPicker.append(colorLabel);
        });
        container.append(customColorPicker);
      }
      return;
    }

    if (definition.type === 'toggle') {
      const label = document.createElement('label');
      label.className = 'check-row';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = Boolean(scene.params[definition.key] ?? definition.value);
      input.addEventListener('change', () => {
        scene.params[definition.key] = input.checked;
        refresh();
      });
      label.append(input, document.createTextNode(definition.label));
      container.append(label);
    }
  });
}

function renderCategoryPills() {
  const parent = $('#categories');
  parent.replaceChildren();
  const names = ['All effects', ...EngineCore.categories.map((category) => category.name)];
  names.forEach((name) => {
    const button = document.createElement('button');
    button.className = `category-pill${state.category === name ? ' active' : ''}`;
    button.type = 'button';
    button.textContent = name;
    button.addEventListener('click', () => {
      state.category = name;
      renderCategoryPills();
      renderPresetList();
    });
    parent.append(button);
  });
}

function renderPresetList() {
  const search = $('#search').value.trim().toLowerCase();
  const items = EngineCore.presets.filter((preset) => (
    (state.category === 'All effects' || preset.category === state.category)
    && `${preset.name} ${preset.category}`.toLowerCase().includes(search)
  ));
  const list = $('#presetList');
  list.replaceChildren();
  $('#presetCount').textContent = String(EngineCore.presets.length);
  items.forEach((preset) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `preset-card${state.activePreset?.id === preset.id ? ' selected' : ''}`;
    button.dataset.category = preset.category;
    const name = document.createElement('strong');
    name.textContent = preset.name;
    const metadata = document.createElement('span');
    metadata.textContent = `${preset.category} · ${validDuration($('#animationDuration').value) ? $('#animationDuration').value : DEFAULT_DURATION} sec`;
    button.append(name, metadata);
    button.addEventListener('click', () => {
      setActivePreset(preset);
      renderPresetList();
    });
    list.append(button);
  });
  if (!items.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-message';
    empty.textContent = 'No effects match this search.';
    list.append(empty);
  }
}

function updatePresetDurations() {
  const duration = validDuration($('#animationDuration').value) ? $('#animationDuration').value : DEFAULT_DURATION;
  document.querySelectorAll('#presetList .preset-card').forEach((button) => {
    const metadata = button.querySelector('span');
    if (metadata) metadata.textContent = `${button.dataset.category} · ${duration} sec`;
  });
}

function updateFrameLabel(index = simulator.frame) {
  const total = Math.max(1, simulator.frames.length);
  $('#frameLabel').textContent = `FRAME ${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
  $('#scrubber').max = String(total - 1);
  $('#scrubber').value = String(index);
}

function renderPreview() {
  $('#matrixDimensions').textContent = `${state.width} × ${state.height}`;
  $('#pixelCount').textContent = (state.width * state.height).toLocaleString();
  if (!state.activeScene) return;
  const request = ++state.renderRequest;
  try {
    const previewFrameCount = Math.min(state.activeScene.frameCount || DEFAULT_FRAME_COUNT, MAX_PREVIEW_FRAMES);
    const frames = EngineCore.generateFrames(state.activeScene, state.width, state.height, previewFrameCount, state.fps);
    if (request !== state.renderRequest) return;
    state.previewFrames = frames;
    simulator.setFrames(frames, state.width, state.height, state.fps);
    $('#play').textContent = 'Ⅱ';
    $('#resolution').textContent = `${state.width} × ${state.height} · ${(state.width * state.height).toLocaleString()} PIXELS`;
  } catch (error) {
    toast(error.message, true);
  }
}

function formatTime(seconds) {
  const safe = Math.floor(seconds);
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

function renderTimeline() {
  const track = $('#timelineTrack');
  track.replaceChildren();
  if (!state.timeline.length) {
    const empty = document.createElement('div');
    empty.className = 'timeline-empty';
    empty.textContent = 'Choose an effect and add it to your show.';
    track.append(empty);
  }
  state.timeline.forEach((scene, index) => {
    const card = document.createElement('article');
    card.className = 'timeline-scene';
    card.draggable = true;
    card.dataset.index = String(index);
    const title = document.createElement('strong');
    title.textContent = scene.name;
    const duration = document.createElement('input');
    duration.type = 'number';
    duration.min = '0.1';
    duration.max = '120';
    duration.step = 'any';
    duration.value = String(scene.duration);
    duration.setAttribute('aria-label', `${scene.name} duration in seconds`);
    duration.addEventListener('change', () => {
      const value = Number(duration.value);
      if (!Number.isFinite(value) || value < .1 || value > 120) {
        duration.value = String(scene.duration);
        toast('Scene duration must be from 0.1 to 120 seconds.', true);
        return;
      }
      scene.frameCount = frameCountForDuration(value);
      scene.duration = scene.frameCount / state.fps;
      if (state.activeScene === scene) {
        syncSceneControls(scene);
        updatePresetDurations();
        renderPreview();
      }
      renderTimeline();
      persist();
    });
    const frameCount = document.createElement('input');
    frameCount.type = 'number';
    frameCount.min = String(minimumFrameCount());
    frameCount.max = String(MAX_FRAME_COUNT);
    frameCount.step = '1';
    frameCount.value = String(scene.frameCount);
    frameCount.setAttribute('aria-label', `${scene.name} frame count`);
    frameCount.addEventListener('change', () => {
      if (!validFrameCount(frameCount.value)) {
        frameCount.value = String(scene.frameCount);
        toast(`Scene frames must be from ${minimumFrameCount()} to ${MAX_FRAME_COUNT}.`, true);
        return;
      }
      scene.frameCount = Number(frameCount.value);
      scene.duration = scene.frameCount / state.fps;
      if (state.activeScene === scene) {
        syncSceneControls(scene);
        updatePresetDurations();
        renderPreview();
      }
      renderTimeline();
      persist();
    });
    const actions = document.createElement('div');
    actions.className = 'scene-actions';
    const preview = actionButton('Preview', () => {
      state.activeScene = scene;
      const selected = EngineCore.presets.find((preset) => preset.id === EngineCore.resolveEngineId(scene.engineId || scene.pattern));
      state.activePreset = selected || null;
      if (selected) {
        $('#activeEffect').textContent = selected.name;
      } else {
        $('#activeEffect').textContent = scene.name;
      }
      setTextControlsVisible(selected?.kind);
      syncSceneControls(scene);
      renderPreview();
    });
    const up = actionButton('↑', () => reorder(index, -1));
    const down = actionButton('↓', () => reorder(index, 1));
    const remove = actionButton('×', () => {
      state.timeline.splice(index, 1);
      renderTimeline();
      persist();
    });
    actions.append(preview, up, down, remove);
    const durationLabel = document.createElement('label');
    durationLabel.textContent = 'Seconds';
    durationLabel.append(duration);
    const frameLabel = document.createElement('label');
    frameLabel.textContent = 'Frames';
    frameLabel.append(frameCount);
    card.append(title, durationLabel, frameLabel, actions);
    card.addEventListener('dragstart', (event) => {
      event.dataTransfer.setData('text/plain', String(index));
      event.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragover', (event) => event.preventDefault());
    card.addEventListener('drop', (event) => {
      event.preventDefault();
      const source = Number(event.dataTransfer.getData('text/plain'));
      if (!Number.isInteger(source) || source === index) return;
      const [moved] = state.timeline.splice(source, 1);
      state.timeline.splice(index, 0, moved);
      renderTimeline();
      persist();
    });
    track.append(card);
  });
  const frameCount = state.timeline.reduce((sum, scene) => sum + scene.frameCount, 0);
  $('#sceneCount').textContent = `${state.timeline.length} ${state.timeline.length === 1 ? 'scene' : 'scenes'}`;
  $('#runtime').textContent = formatTime(frameCount / state.fps);
}

function actionButton(label, action) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', action);
  return button;
}

function reorder(index, direction) {
  const target = index + direction;
  if (target < 0 || target >= state.timeline.length) return;
  [state.timeline[index], state.timeline[target]] = [state.timeline[target], state.timeline[index]];
  renderTimeline();
  persist();
}

function serializableScene(scene) {
  const copy = { ...scene, params: cloneParams(scene.params || scene.options) };
  delete copy.options;
  if (copy.frames) copy.frames = copy.frames.map((frame) => Array.from(frame));
  return copy;
}

function cloneParams(params) {
  if (!params) return {};
  return {
    ...params,
    ...(Array.isArray(params.customColors) ? { customColors: [...params.customColors] } : {}),
  };
}

function snapshot() {
  return {
    version: 1,
    projectName: safeProjectName(),
    width: state.width,
    height: state.height,
    fps: state.fps,
    timeline: state.timeline.map(serializableScene),
    activeScene: state.activeScene ? serializableScene(state.activeScene) : null,
    mathFormulas: formulasFromUI(),
    mathParameters: { ...state.mathParameters },
  };
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot()));
  } catch (error) {
    toast(`Local save failed: ${error.message}`, true);
  }
}

function normalizeLegacyParams(params, oldPattern, engineId) {
  const normalized = { ...params };
  if (normalized.hueShift === undefined && normalized.hue !== undefined) normalized.hueShift = normalized.hue;
  if (!normalized.colorMode) {
    normalized.colorMode = 'preset';
    const legacyModifier = String(oldPattern || '').split('--').pop();
    const paletteByModifier = {
      'cyber-blue-amber': 'cyber',
      'wedding-gold-crimson': 'wedding',
      tricolor: 'tricolor',
      'neon-club': 'neon',
      'ocean-aqua': 'ocean',
      'fire-flame': 'fire',
    };
    if (legacyModifier === 'rainbow-flow') normalized.colorMode = 'rainbow';
    else if (paletteByModifier[legacyModifier]) normalized.presetPalette = paletteByModifier[legacyModifier];
    if (legacyModifier === 'reverse-flow') {
      normalized.direction = engineId === 'skyscraper_bottom_up_rise' ? 'top-down' : 'reverse';
    }
  }
  if (normalized.direction === 'bottom-up') normalized.direction = 'forward';
  if (normalized.direction === 'top-down') normalized.direction = 'reverse';
  return {
    ...COLOR_DEFAULTS,
    customColors: [...COLOR_DEFAULTS.customColors],
    ...normalized,
  };
}

function normalizeProjectScene(scene, fps = state.fps) {
  if (!scene || typeof scene !== 'object') throw new Error('A project scene has invalid metadata.');
  const engineId = ['math', 'draw'].includes(scene.pattern)
    ? null
    : EngineCore.resolveEngineId(scene.engineId || scene.pattern);
  if (!engineId && !['math', 'draw'].includes(scene.pattern)) {
    throw new Error(`Unknown effect in project: ${String(scene.pattern)}.`);
  }
  const { options, ...rest } = scene;
  const params = normalizeLegacyParams({ ...(options || {}), ...(scene.params || {}) }, scene.pattern, engineId);
  const duration = validDuration(scene.duration) ? Number(scene.duration) : DEFAULT_DURATION;
  const frameCount = validFrameCount(scene.frameCount, fps)
    ? Number(scene.frameCount)
    : frameCountForDuration(duration, fps);
  return {
    ...rest,
    frameCount,
    duration: frameCount / fps,
    pattern: engineId || scene.pattern,
    ...(engineId ? { engineId } : {}),
    params,
  };
}

function applyProject(project) {
  if (!project || project.version !== 1 || !Array.isArray(project.timeline)) throw new Error('Unsupported or invalid project file.');
  const width = Number(project.width);
  const height = Number(project.height);
  const fps = Number(project.fps);
  if (!Number.isInteger(width) || width < 1 || width > 120 || !Number.isInteger(height) || height < 1 || height > 80) {
    throw new Error('Project matrix dimensions are invalid.');
  }
  if (![15, 20, 25, 30, 60].includes(fps)) throw new Error('Project FPS is invalid.');
  if (project.timeline.length > 500) throw new Error('A project cannot contain more than 500 timeline scenes.');
  const normalizedTimeline = project.timeline.map((scene) => normalizeProjectScene(scene, fps));
  const totalFrames = normalizedTimeline.reduce((sum, scene) => {
    if (!scene || typeof scene !== 'object' || typeof scene.name !== 'string' || scene.name.length > 120) {
      throw new Error('A project scene has invalid metadata.');
    }
    if (!validFrameCount(scene.frameCount, fps)) {
      throw new Error(`Project scene frame counts must be from ${minimumFrameCount(fps)} to ${MAX_FRAME_COUNT}.`);
    }
    if (typeof scene.duration !== 'number' || !Number.isFinite(scene.duration) || scene.duration < .1 || scene.duration > 120) {
      throw new Error('Project scene durations must be from 0.1 to 120 seconds.');
    }
    if (scene.pattern === 'math') EngineCore.validateFormulas(scene.formulas);
    if (scene.pattern === 'draw') {
      const sourceWidth = Number(scene.width || width);
      const sourceHeight = Number(scene.height || height);
      if (!Number.isInteger(sourceWidth) || sourceWidth < 1 || sourceWidth > 120 || !Number.isInteger(sourceHeight) || sourceHeight < 1 || sourceHeight > 80
        || !Array.isArray(scene.frames) || !scene.frames.length || scene.frames.some((frame) => (
        !Array.isArray(frame) || frame.length !== sourceWidth * sourceHeight * 3
        || frame.some((channel) => !Number.isInteger(channel) || channel < 0 || channel > 255)
      ))) {
        throw new Error('A drawing scene does not match the project matrix dimensions.');
      }
    }
    scene.duration = scene.frameCount / fps;
    return sum + scene.frameCount;
  }, 0);
  if (totalFrames > 18000) throw new Error('A project show cannot exceed 18,000 frames.');
  state.width = width;
  state.height = height;
  state.fps = fps;
  state.mathParameters = normalizeMathSettings(project.mathParameters || state.mathParameters, fps);
  state.timeline = normalizedTimeline.map((scene) => {
    if (scene.pattern === 'draw' && Array.isArray(scene.frames)) {
      return { ...scene, frames: scene.frames.map((frame) => new Uint8Array(frame)) };
    }
    return scene;
  });
  if (project.activeScene && typeof project.activeScene === 'object') {
    const active = normalizeProjectScene(project.activeScene, fps);
    if (active.pattern === 'math') EngineCore.validateFormulas(active.formulas);
    if (active.pattern === 'draw') {
      const sourceWidth = Number(active.width || width);
      const sourceHeight = Number(active.height || height);
      if (!Number.isInteger(sourceWidth) || sourceWidth < 1 || sourceWidth > 120 || !Number.isInteger(sourceHeight) || sourceHeight < 1 || sourceHeight > 80
        || !Array.isArray(active.frames) || !active.frames.length || active.frames.some((frame) => (
        !Array.isArray(frame) || frame.length !== sourceWidth * sourceHeight * 3
        || frame.some((channel) => !Number.isInteger(channel) || channel < 0 || channel > 255)
      ))) throw new Error('The active drawing does not match the project matrix.');
      state.activeScene = { ...active, frames: active.frames.map((frame) => new Uint8Array(frame)) };
    } else {
      state.activeScene = active;
    }
  } else {
    const preset = EngineCore.presets[0];
    state.activeScene = {
      pattern: preset.id,
      engineId: preset.engineId,
      name: preset.name,
      kind: preset.kind,
      params: paramsFromUI(),
    };
  }
  state.activePreset = EngineCore.presets.find((preset) => preset.id === EngineCore.resolveEngineId(state.activeScene.engineId || state.activeScene.pattern)) || null;
  $('#activeEffect').textContent = state.activeScene.name || 'Active effect';
  syncSceneControls(state.activeScene);
  if (state.activePreset) {
    setTextControlsVisible(state.activePreset.kind);
  } else {
    setTextControlsVisible(null);
  }
  $('#projectName').value = String(project.projectName || 'LED Show').slice(0, 64);
  $('#fps').value = String(fps);
  const preset = document.querySelector(`#matrixPreset option[value="${width}x${height}"]`);
  if (preset) {
    $('#matrixPreset').value = `${width}x${height}`;
    $('#customSize').hidden = true;
  } else {
    $('#matrixPreset').value = 'custom';
    $('#customSize').hidden = false;
    $('#matrixWidth').value = String(width);
    $('#matrixHeight').value = String(height);
  }
  if (project.mathFormulas) {
    $('#formulaR').value = project.mathFormulas.R;
    $('#formulaG').value = project.mathFormulas.G;
    $('#formulaB').value = project.mathFormulas.B;
  }
  editor.resize(width, height);
  renderTimeline();
  renderPreview();
  persist();
}

function addScene(scene) {
  const frameCount = validFrameCount(scene.frameCount)
    ? Number(scene.frameCount)
    : frameCountForDuration(validDuration(scene.duration)
      ? scene.duration
      : (validDuration($('#animationDuration').value) ? $('#animationDuration').value : DEFAULT_DURATION));
  state.timeline.push({
    ...scene,
    ...(scene.engineId ? { engineId: scene.engineId } : {}),
    params: cloneParams(scene.params),
    frameCount,
    duration: frameCount / state.fps,
  });
  renderTimeline();
  persist();
  toast(`${scene.name} added to show.`);
}

function createMathScene(mathLogicId = null) {
  const formulas = formulasFromUI();
  EngineCore.validateFormulas(formulas);
  const params = mathParamsFromUI();
  const frameCount = validFrameCount(state.mathParameters.frameCount)
    ? state.mathParameters.frameCount
    : DEFAULT_FRAME_COUNT;
  const duration = frameCount / state.fps;
  state.mathParameters.frameCount = frameCount;
  state.mathParameters.duration = duration;
  return {
    pattern: 'math',
    name: 'Math Lab · RGB formula',
    ...(mathLogicId && mathLogicId !== 'custom' ? { mathLogicId } : {}),
    formulas,
    params,
    frameCount,
    duration,
  };
}

function buildShowFrames() {
  if (!state.timeline.length) throw new Error('Add at least one scene before exporting.');
  const frameCount = state.timeline.reduce((total, scene) => total + scene.frameCount, 0);
  const paddedRowSize = Math.ceil(state.width * 3 / 4) * 4;
  const predictedAviSize = paddedRowSize * state.height * frameCount + 4 * frameCount + 4096;
  if (frameCount > 18000) throw new Error('A show cannot exceed 18,000 frames.');
  if (predictedAviSize > 128 * 1024 * 1024) throw new Error('AVI exceeds the 128 MiB browser-memory limit; shorten the show or lower the matrix resolution.');
  const frames = [];
  for (const scene of state.timeline) {
    const count = scene.frameCount;
    if (frames.length + count > 18000) throw new Error('A show cannot exceed 18,000 frames.');
    frames.push(...EngineCore.generateFrames(scene, state.width, state.height, count, state.fps));
  }
  return frames;
}

function guideText(frameCount) {
  const wireText = simulator.wiring === 'z'
    ? 'Z-Type: rows run left-to-right, alternating direction on each successive row.'
    : 'S-Type: columns run top-to-bottom, alternating direction on each successive column.';
  return [
    `${safeProjectName()} — LEDEdit AVI setup`,
    '',
    `Matrix: ${state.width} × ${state.height} RGB pixels`,
    `Frame rate: ${state.fps} FPS`,
    `Frames: ${frameCount}`,
    `Runtime: ${(frameCount / state.fps).toFixed(2)} seconds`,
    `Wiring overlay selected in studio: ${simulator.wiring.toUpperCase()}-Type`,
    wireText,
    '',
    'Import: In LEDEdit 2014, use Video Effect → Open Video and select the AVI file.',
    'Confirm the target project dimensions, controller model, firmware, codec support, and color order before sending to hardware.',
    'This archive contains a generic uncompressed 24-bit BGR AVI. Controller and LEDEdit compatibility have not been independently verified.',
    '',
    'The ZIP and AVI were generated locally in this browser. No project data was uploaded.',
  ].join('\r\n');
}

async function exportShow(button) {
  const original = button.textContent;
  button.disabled = true;
  button.textContent = 'Building AVI…';
  try {
    const frames = buildShowFrames();
    const avi = buildAvi(frames, state.width, state.height, state.fps);
    button.textContent = 'Packaging ZIP…';
    const projectStem = safeProjectName().replace(/[^\w.-]+/g, '_');
    const zip = await buildZip([
      { name: `${projectStem}_LEDEdit.avi`, data: avi },
      { name: 'LEDEdit_Setup_Guide.txt', data: new TextEncoder().encode(guideText(frames.length)) },
    ]);
    downloadBlob(zip, `${projectStem}_LEDEdit.zip`);
    toast(`Local ZIP ready · ${state.width}×${state.height} · ${frames.length} frames`);
  } catch (error) {
    toast(error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

function saveProjectFile() {
  const data = new TextEncoder().encode(JSON.stringify(snapshot(), null, 2));
  downloadBlob(new Blob([data], { type: 'application/json' }), `${safeProjectName().replace(/\s+/g, '_')}.json`);
  toast('Project JSON saved to this device.');
}

function updateMathParameters() {
  const params = mathParamsFromUI();
  state.mathParameters = normalizeMathSettings(state.mathParameters);
  $('#speed').value = String(params.speed);
  $('#density').value = String(params.density);
  $('#brightness').value = String(params.brightness);
  $('#direction').value = params.direction;
  updateParameterLabels();
  if (state.activeScene?.pattern === 'math') {
    state.activeScene.params = { ...state.activeScene.params, ...params };
    renderPreview();
  }
  persist();
}

function updateMathTiming(source) {
  let frameCount;
  if (source === 'duration') {
    if (!validDuration($('#mathDuration').value)) {
      $('#mathDuration').value = String(state.mathParameters.duration);
      toast('Math Lab duration must be from 0.1 to 120 seconds.', true);
      return;
    }
    frameCount = frameCountForDuration($('#mathDuration').value);
  } else {
    if (!validFrameCount($('#mathFrames').value)) {
      $('#mathFrames').value = String(state.mathParameters.frameCount);
      toast(`Math Lab frame count must be from ${minimumFrameCount()} to ${MAX_FRAME_COUNT}.`, true);
      return;
    }
    frameCount = Number($('#mathFrames').value);
  }
  state.mathParameters = normalizeMathSettings({
    ...mathParamsFromUI(),
    frameCount,
    duration: frameCount / state.fps,
  });
  syncMathControls();
  if (state.activeScene?.pattern === 'math') {
    state.activeScene.params = { ...state.activeScene.params, ...mathParamsFromUI() };
    state.activeScene.frameCount = state.mathParameters.frameCount;
    state.activeScene.duration = state.mathParameters.duration;
    syncSceneControls(state.activeScene);
    renderPreview();
    if (state.timeline.includes(state.activeScene)) renderTimeline();
  }
  persist();
}

function updateParameterLabels() {
  $('#brightnessOut').value = `${Math.round(Number($('#brightness').value) * 100)}%`;
  $('#speedOut').value = `${Number($('#speed').value).toFixed(1)}×`;
  $('#densityOut').value = Number($('#density').value).toFixed(2);
  $('#autoColorSpeedOut').value = `${Number($('#autoColorSpeed').value).toFixed(1)}×`;
  $('#hueShiftOut').value = `${$('#hueShift').value}°`;
  $('#backgroundAutoSpeedOut').value = `${Number($('#backgroundAutoSpeed').value).toFixed(1)}×`;
  $('#backgroundBrightnessOut').value = `${Math.round(Number($('#backgroundBrightness').value) * 100)}%`;
  $('#textBackgroundSpeedOut').value = `${Number($('#textBackgroundSpeed').value).toFixed(1)}×`;
  $('#textBackgroundBrightnessOut').value = `${Math.round(Number($('#textBackgroundBrightness').value) * 100)}%`;
  updateMathParameterLabels();
}

function updateMathParameterLabels() {
  $('#mathSpeedOut').value = `${Number($('#mathSpeed').value).toFixed(1)}×`;
  $('#mathDensityOut').value = Number($('#mathDensity').value).toFixed(2);
  $('#mathBrightnessOut').value = `${Math.round(Number($('#mathBrightness').value) * 100)}%`;
}

function updateTextBackgroundVisibility() {
  $('#textBackgroundColorField').hidden = $('#textBackgroundMode').value !== 'solid';
}

function populateColorPalettes() {
  const select = $('#presetPalette');
  select.replaceChildren();
  PRESET_PALETTE_CHOICES.forEach(([id, name]) => select.add(new Option(name, id)));
}

function updateActiveSceneParams(params) {
  if (state.activeScene) {
    state.activeScene.params = { ...(state.activeScene.params || {}), ...params };
    if (state.activeScene.pattern === 'math') syncMathControls(state.activeScene);
    renderPreview();
  }
  persist();
}

function installEvents() {
  $('#search').addEventListener('input', renderPresetList);
  $('#matrixPreset').addEventListener('change', () => {
    const value = $('#matrixPreset').value;
    $('#customSize').hidden = value !== 'custom';
    if (value !== 'custom') {
      [state.width, state.height] = value.split('x').map(Number);
      $('#matrixWidth').value = String(state.width);
      $('#matrixHeight').value = String(state.height);
    } else {
      state.width = Number($('#matrixWidth').value);
      state.height = Number($('#matrixHeight').value);
    }
    if (!Number.isInteger(state.width) || state.width < 1 || state.width > 120 || !Number.isInteger(state.height) || state.height < 1 || state.height > 80) {
      toast('Custom matrix dimensions must be 1–120 wide and 1–80 high.', true);
      return;
    }
    if (state.activeScene) syncSceneControls(state.activeScene);
    editor.resize(state.width, state.height);
    renderPreview();
    persist();
  });
  ['#matrixWidth', '#matrixHeight'].forEach((selector) => $(selector).addEventListener('change', () => {
    const width = Number($('#matrixWidth').value);
    const height = Number($('#matrixHeight').value);
    if (!Number.isInteger(width) || width < 1 || width > 120 || !Number.isInteger(height) || height < 1 || height > 80) {
      toast('Custom matrix dimensions must be 1–120 wide and 1–80 high.', true);
      return;
    }
    state.width = width;
    state.height = height;
    try {
      EngineCore.generateFrames(state.activeScene, state.width, state.height, 1);
      if (state.activeScene) syncSceneControls(state.activeScene);
      editor.resize(state.width, state.height);
      renderPreview();
      persist();
    } catch (error) {
      toast(error.message, true);
    }
  }));
  $('#fps').addEventListener('change', () => {
    state.fps = Number($('#fps').value);
    const retime = (scene) => {
      const duration = validDuration(scene.duration) ? Number(scene.duration) : DEFAULT_DURATION;
      scene.frameCount = frameCountForDuration(duration, state.fps);
      scene.duration = scene.frameCount / state.fps;
    };
    state.timeline.forEach(retime);
    if (state.activeScene && !state.timeline.includes(state.activeScene)) retime(state.activeScene);
    if (state.activeScene) syncSceneControls(state.activeScene);
    if (state.activeScene?.pattern !== 'math') {
      const frameCount = frameCountForDuration(state.mathParameters.duration, state.fps);
      state.mathParameters = normalizeMathSettings({
        ...state.mathParameters,
        frameCount,
        duration: frameCount / state.fps,
      });
      syncMathControls();
    }
    renderTimeline();
    renderPreview();
    persist();
  });
  ['#brightness', '#speed', '#density'].forEach((selector) => $(selector).addEventListener('input', () => {
    updateParameterLabels();
    if (state.activeScene?.pattern !== 'draw') {
      updateActiveSceneParams({
        brightness: Number($('#brightness').value),
        speed: Number($('#speed').value),
        density: Number($('#density').value),
        amplitude: Number($('#density').value),
        patternDensity: state.activeScene?.params?.densityAffectsIntensity === false
          ? 1
          : Number($('#density').value),
      });
    }
    else persist();
  }));
  ['#mathSpeed', '#mathDensity', '#mathBrightness', '#mathDirection'].forEach((selector) => {
    const control = $(selector);
    control.addEventListener(control.tagName === 'SELECT' ? 'change' : 'input', updateMathParameters);
  });
  $('#mathDuration').addEventListener('change', () => updateMathTiming('duration'));
  $('#mathFrames').addEventListener('change', () => updateMathTiming('frames'));
  $('#switchMathPattern').addEventListener('click', () => {
    try {
      switchMathPattern();
    } catch (error) {
      toast(error.message, true);
    }
  });
  $('#animationDuration').addEventListener('change', () => {
    if (!validDuration($('#animationDuration').value)) {
      $('#animationDuration').value = String(state.activeScene?.duration ?? DEFAULT_DURATION);
      toast('Animation duration must be from 0.1 to 120 seconds.', true);
      return;
    }
    if (state.activeScene) {
      state.activeScene.frameCount = frameCountForDuration($('#animationDuration').value);
      state.activeScene.duration = state.activeScene.frameCount / state.fps;
      syncSceneControls(state.activeScene);
      renderPreview();
      if (state.timeline.includes(state.activeScene)) renderTimeline();
    } else {
      const frameCount = frameCountForDuration($('#animationDuration').value);
      $('#animationFrames').value = String(frameCount);
      $('#animationDuration').value = String(frameCount / state.fps);
    }
    updatePresetDurations();
    persist();
  });
  $('#animationFrames').addEventListener('change', () => {
    if (!validFrameCount($('#animationFrames').value)) {
      $('#animationFrames').value = String(state.activeScene?.frameCount || DEFAULT_FRAME_COUNT);
      toast(`Frame count must be from ${minimumFrameCount()} to ${MAX_FRAME_COUNT}.`, true);
      return;
    }
    const frameCount = Number($('#animationFrames').value);
    if (state.activeScene) {
      state.activeScene.frameCount = frameCount;
      state.activeScene.duration = frameCount / state.fps;
      syncSceneControls(state.activeScene);
      renderPreview();
      if (state.timeline.includes(state.activeScene)) renderTimeline();
    } else {
      $('#animationDuration').value = String(frameCount / state.fps);
    }
    updatePresetDurations();
    persist();
  });
  [
    '#bannerText', '#dualTextLeft', '#dualTextRight', '#backgroundChase', '#doubleHeight',
    '#textBackgroundMode', '#textBackgroundColor', '#textBackgroundSpeed', '#textBackgroundBrightness',
  ].forEach((selector) => {
    const control = $(selector);
    const eventName = ['SELECT', 'CHECKBOX'].includes(control.tagName) ? 'change' : 'input';
    control.addEventListener(eventName, () => {
      if (['text', 'dual_text', 'vertical_text'].includes(state.activeScene?.kind)) {
        updateTextBackgroundVisibility();
        updateParameterLabels();
        updateActiveSceneParams({
          text: $('#bannerText').value.trim() || 'PIXEL LED',
          dualTextLeft: $('#dualTextLeft').value.trim() || 'LEFT',
          dualTextRight: $('#dualTextRight').value.trim() || 'RIGHT',
          textBackgroundMode: $('#textBackgroundMode').value,
          textBackgroundColor: $('#textBackgroundColor').value,
          textBackgroundSpeed: Number($('#textBackgroundSpeed').value),
          textBackgroundBrightness: Number($('#textBackgroundBrightness').value),
          backgroundChase: $('#backgroundChase').checked,
          doubleHeight: $('#doubleHeight').checked,
        });
      }
    });
  });
  $('#direction').addEventListener('change', () => {
    updateActiveSceneParams({ direction: $('#direction').value });
  });
  ['#colorMode', '#presetPalette', '#morphSource', '#solidColor', '#autoColorSpeed', '#hueShift', '#whiteAccent',
    '#customColorPrimary', '#customColorSecondary', '#customColorAccent1', '#customColorAccent2',
    '#backgroundMode', '#backgroundColor', '#backgroundAutoSpeed', '#backgroundBrightness'].forEach((selector) => {
    const control = $(selector);
    const eventName = ['SELECT', 'CHECKBOX'].includes(control.tagName) ? 'change' : 'input';
    control.addEventListener(eventName, () => {
      updateParameterLabels();
      updateColorControlVisibility();
      updateActiveSceneParams(colorParamsFromUI());
    });
  });
  $('#randomizeColors').addEventListener('click', () => {
    ['#customColorPrimary', '#customColorSecondary', '#customColorAccent1', '#customColorAccent2'].forEach((selector) => {
      $(selector).value = `#${Math.floor(Math.random() * 0x1000000).toString(16).padStart(6, '0')}`;
    });
    updateActiveSceneParams(colorParamsFromUI());
  });
  $('#play').addEventListener('click', () => {
    const playing = simulator.toggle();
    $('#play').textContent = playing ? 'Ⅱ' : '▶';
  });
  $('#scrubber').addEventListener('input', () => simulator.setFrame(Number($('#scrubber').value)));
  $('#zoom').addEventListener('input', () => simulator.setZoom(Number($('#zoom').value) / 100));
  $('#wireOverlay').addEventListener('change', (event) => simulator.setOverlay(event.target.checked));
  document.querySelectorAll('[data-wire]').forEach((button) => button.addEventListener('click', () => {
    simulator.setWiring(button.dataset.wire);
    document.querySelectorAll('[data-wire]').forEach((wire) => wire.classList.toggle('active', wire === button));
  }));
  document.querySelectorAll('.tab').forEach((button) => button.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((tab) => tab.classList.toggle('active', tab === button));
    document.querySelectorAll('.inspector-pane').forEach((pane) => {
      pane.hidden = pane.id !== button.dataset.pane;
      pane.classList.toggle('active', pane.id === button.dataset.pane);
    });
    if (button.dataset.pane === 'draw') editor.render();
  }));
  $('#addScene').addEventListener('click', () => {
    if (state.activeScene) addScene({ ...state.activeScene, params: cloneParams(state.activeScene.params) });
  });
  $('#useMath').addEventListener('click', () => {
    try {
      const currentLogic = MATH_LOGIC_LIBRARY.find((logic) => logic.id === state.activeScene?.mathLogicId);
      const logicId = currentLogic?.category === $('#mathCategory').value ? currentLogic.id : null;
      activateMathScene(createMathScene(logicId));
      toast('Math Lab is now the active preview.');
    } catch (error) { toast(error.message, true); }
  });
  ['#formulaR', '#formulaG', '#formulaB'].forEach((selector) => $(selector).addEventListener('input', () => {
    if (state.activeScene?.pattern !== 'math') return;
    clearTimeout(state.mathTimer);
    state.mathTimer = setTimeout(() => {
      try {
        const formulas = formulasFromUI();
        EngineCore.validateFormulas(formulas);
        state.activeScene.formulas = formulas;
        delete state.activeScene.mathLogicId;
        state.activeScene.name = 'Math Lab · RGB formula';
        $('#activeEffect').textContent = state.activeScene.name;
        renderPreview();
        persist();
      } catch (error) {
        toast(error.message, true);
      }
    }, 220);
  }));
  $('#newDrawing').addEventListener('click', () => {
    document.querySelector('[data-pane="draw"]').click();
    $('#paintCanvas').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  $('#clearDrawing').addEventListener('click', () => editor.clear());
  $('#addDrawing').addEventListener('click', () => {
    const scene = {
      pattern: 'draw',
      name: 'Custom Pixel Drawing',
      width: state.width,
      height: state.height,
      frames: [editor.getFrame()],
      params: paramsFromUI(),
    };
    state.activeScene = scene;
    $('#activeEffect').textContent = scene.name;
    renderPreview();
    addScene(scene);
  });
  $('#clearTimeline').addEventListener('click', () => {
    state.timeline = [];
    renderTimeline();
    persist();
  });
  $('#renderShow').addEventListener('click', (event) => exportShow(event.currentTarget));
  $('#export').addEventListener('click', (event) => exportShow(event.currentTarget));
  $('#saveProject').addEventListener('click', saveProjectFile);
  $('#loadProject').addEventListener('click', () => $('#projectFile').click());
  $('#projectFile').addEventListener('change', async (event) => {
    const [file] = event.target.files;
    if (!file) return;
    try {
      if (file.size > 16 * 1024 * 1024) throw new Error('Project JSON must be smaller than 16 MiB.');
      applyProject(JSON.parse(await file.text()));
      toast('Project loaded locally.');
    }
    catch (error) { toast(`Could not load project: ${error.message}`, true); }
    finally { event.target.value = ''; }
  });
  $('#projectName').addEventListener('input', persist);
  const pluginInput = $('#pluginInput');
  const drop = $('#pluginDrop');
  pluginInput.addEventListener('change', () => {
    const [file] = pluginInput.files;
    if (file) toast(`${file.name} selected. Python plugins are not executed in this browser.`);
    pluginInput.value = '';
  });
  drop.addEventListener('dragover', (event) => { event.preventDefault(); drop.classList.add('dragging'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('dragging'));
  drop.addEventListener('drop', (event) => {
    event.preventDefault();
    drop.classList.remove('dragging');
    const file = [...event.dataTransfer.files].find((item) => item.name.toLowerCase().endsWith('.py'));
    if (file) toast(`${file.name} received. Python plugins are never executed by this offline app.`);
  });
  $('#fullscreen').addEventListener('click', toggleFullscreen);
  document.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() === 'f' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
      event.preventDefault();
      toggleFullscreen();
    }
    if (event.code === 'Space' && !['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(document.activeElement.tagName)) {
      event.preventDefault();
      $('#play').click();
    }
  });
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await $('#viewport').requestFullscreen();
  } catch (error) {
    toast(`Fullscreen unavailable: ${error.message}`, true);
  }
}

function loadLocalProject() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return false;
  applyProject(JSON.parse(stored));
  return true;
}

function startServiceWorker() {
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('./sw.js').catch((error) => toast(`Offline cache could not start: ${error.message}`, true));
  }
}

populateColorPalettes();
populateMathLogicControls();
renderCategoryPills();
renderPresetList();
installEvents();
updateParameterLabels();
syncColorControls(COLOR_DEFAULTS);
editor.resize(state.width, state.height);
simulator.setWiring('z');
renderTimeline();
try {
  if (!loadLocalProject()) setActivePreset(EngineCore.presets[0]);
} catch (error) {
  toast(`Local project could not be restored: ${error.message}`, true);
  setActivePreset(EngineCore.presets[0]);
}
startServiceWorker();
