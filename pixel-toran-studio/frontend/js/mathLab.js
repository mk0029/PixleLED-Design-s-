const FUNCTIONS = new Set(['sin', 'cos', 'tan', 'sqrt', 'hypot', 'abs', 'rand']);
const RESERVED = new Set(['x', 'y', 't', 'v', 'W', 'H', 'pi', 'e', ...FUNCTIONS]);
const DEFAULT_PARAMS = { speed: 0.3, density: 0.4, amplitude: 1, phase: 0, colorSpeed: 0.12 };
const PAGE_SIZE = 16;

export class MathLab {
  constructor(container, onPreview, onAdd, notify) {
    this.container = container;
    this.onPreview = onPreview;
    this.onAdd = onAdd;
    this.notify = notify;
    this.params = {};
    this.presets = [];
    this.filteredPresets = [];
    this.palettes = [];
    this.selectedPalette = '';
    this.page = 0;
    this.previewTimer = 0;
    this.colorSeed = null;
    this.formula = container.querySelector('#mathFormula');
    this.paramControls = container.querySelector('#mathParamControls');
    this.color = container.querySelector('#mathColor');
    this.customColorControl = container.querySelector('#mathCustomColorControl');
    this.colorMode = container.querySelector('#mathColorMode');
    this.colorFormulas = container.querySelector('#mathColorFormulas');
    this.shapeMask = container.querySelector('#mathShapeMask');
    this.paletteControl = container.querySelector('#mathPaletteControl');
    this.paletteSelect = container.querySelector('#mathColorPalette');
    this.colorInputs = {
      red: container.querySelector('#mathRedFormula'),
      green: container.querySelector('#mathGreenFormula'),
      blue: container.querySelector('#mathBlueFormula'),
    };
    this.formula.addEventListener('input', () => {
      this.selectedPreset = null;
      this.renderParams();
      this.queuePreview();
    });
    this.color.addEventListener('input', () => this.queuePreview());
    this.colorMode.addEventListener('change', () => {
      if (this.colorMode.value === 'random') this.colorSeed = this.makeSeed();
      this.shapeMask.checked = this.colorMode.value === 'custom' || this.colorMode.value === 'random';
      this.syncColorControls();
      this.renderParams();
      this.queuePreview();
    });
    this.shapeMask.addEventListener('change', () => this.queuePreview());
    this.paletteSelect.addEventListener('change', () => this.applyPalette());
    Object.values(this.colorInputs).forEach((input) => input.addEventListener('input', () => {
      this.selectedPreset = null;
      this.renderParams();
      this.queuePreview();
    }));
    container.querySelector('#randomizeMath').addEventListener('click', () => this.randomize());
    container.querySelector('#randomColorSequence').addEventListener('click', () => this.randomColors());
    container.querySelector('#previewMath').addEventListener('click', () => this.onPreview(this.scene()));
    container.querySelector('#addMathScene').addEventListener('click', () => this.onAdd(this.scene()));
    container.querySelector('#mathPresetSearch').addEventListener('input', () => this.filterPresets());
    container.querySelector('#mathPresetCategory').addEventListener('change', () => this.filterPresets());
    container.querySelector('#mathPresetPrev').addEventListener('click', () => this.changePage(-1));
    container.querySelector('#mathPresetNext').addEventListener('click', () => this.changePage(1));
    this.syncColorControls();
    this.renderParams();
    this.loadPresets();
  }

  scene() {
    const hex = this.color.value.slice(1);
    const formula = this.formula.value.trim();
    const presetName = this.selectedPreset?.name;
    const colorMode = this.colorMode.value;
    const colorLabels = { custom: 'Custom color', random: 'Random colors', rainbow: 'Rainbow spectrum' };
    const colorDescription = colorLabels[colorMode] || this.selectedPalette;
    return {
      pattern: 'math',
      name: `Math · ${presetName || formula.slice(0, 24) || 'Formula'}${colorDescription ? ` · ${colorDescription}` : ''}`,
      duration: 5,
      options: {
        formula,
        params: { ...this.params },
        color: [
          Number.parseInt(hex.slice(0, 2), 16),
          Number.parseInt(hex.slice(2, 4), 16),
          Number.parseInt(hex.slice(4, 6), 16),
        ],
        color_mode: colorMode,
        seed: colorMode === 'random' ? this.colorSeed : null,
        mask_shape: this.shapeMask.checked,
        color_formulas: Object.fromEntries(
          Object.entries(this.colorInputs).map(([channel, input]) => [channel, input.value.trim()]),
        ),
      },
    };
  }

  async loadPresets() {
    try {
      const response = await fetch('/api/math-presets');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load math formula presets.');
      if (!Array.isArray(data.presets) || !data.presets.length) {
        throw new Error('The math preset catalog is empty or unavailable.');
      }
      let palettes = data.palettes;
      let catalogPresets = data.presets;
      const legacyCatalog = !Array.isArray(palettes) || !palettes.length;
      if (legacyCatalog) {
        const paletteMap = new Map();
        const effectMap = new Map();
        for (const preset of data.presets) {
          if (!preset || typeof preset.formula !== 'string' || typeof preset.name !== 'string') {
            throw new Error('The legacy math preset catalog contains an invalid entry.');
          }
          const colorFormulas = preset.color_formulas;
          if (
            typeof preset.palette !== 'string'
            || !colorFormulas
            || !['red', 'green', 'blue'].every((channel) => typeof colorFormulas[channel] === 'string')
          ) {
            throw new Error('The legacy math preset catalog is missing color formulas.');
          }
          if (!paletteMap.has(preset.palette)) {
            paletteMap.set(preset.palette, { name: preset.palette, color_formulas: colorFormulas });
          }
          const effect = typeof preset.effect === 'string'
            ? preset.effect
            : preset.name.split(/\s+·\s+/)[0];
          if (!effectMap.has(preset.formula)) {
            effectMap.set(preset.formula, { ...preset, name: effect, effect });
          }
        }
        palettes = [...paletteMap.values()];
        catalogPresets = [...effectMap.values()];
        if (!palettes.length || !catalogPresets.length) {
          throw new Error('The legacy math preset catalog has no usable palettes or effects.');
        }
      }
      this.presets = catalogPresets;
      this.palettes = palettes;
      const effectCount = new Set(this.presets.map((preset) => preset.effect)).size;
      this.container.querySelector('#mathPresetCount').textContent = `${this.presets.length} PRESETS · ${effectCount} EFFECTS`;
      this.paletteSelect.replaceChildren();
      this.palettes.forEach((palette) => {
        const option = document.createElement('option');
        option.value = palette.name;
        option.textContent = palette.name;
        this.paletteSelect.append(option);
      });
      this.paletteSelect.value = this.presets[0]?.palette || this.palettes[0].name;
      this.applyPalette(false);
      const category = this.container.querySelector('#mathPresetCategory');
      [...new Set(this.presets.map((preset) => preset.category))].sort().forEach((name) => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        category.append(option);
      });
      this.filterPresets();
      if (legacyCatalog) {
        this.notify('Legacy Flask catalog detected. Palettes are restored; restart Flask to load the latest effects.', false);
      }
    } catch (error) {
      this.container.querySelector('#mathPresetList').textContent = error.message;
      this.notify(error.message, true);
    }
  }

  filterPresets() {
    const search = this.container.querySelector('#mathPresetSearch').value.trim().toLowerCase();
    const category = this.container.querySelector('#mathPresetCategory').value;
    this.filteredPresets = this.presets.filter((preset) => {
      const categoryMatches = category === 'all' || preset.category === category;
      const searchMatches = `${preset.name} ${preset.effect} ${preset.category} ${preset.formula}`.toLowerCase().includes(search);
      return categoryMatches && searchMatches;
    });
    this.page = 0;
    this.renderPresets();
  }

  renderPresets() {
    const list = this.container.querySelector('#mathPresetList');
    list.replaceChildren();
    const pageCount = Math.max(1, Math.ceil(this.filteredPresets.length / PAGE_SIZE));
    const pagePresets = this.filteredPresets.slice(this.page * PAGE_SIZE, (this.page + 1) * PAGE_SIZE);
    pagePresets.forEach((preset) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'math-preset-tile';
      const name = document.createElement('strong');
      name.textContent = preset.name;
      const category = document.createElement('span');
      category.textContent = preset.category;
      const formula = document.createElement('code');
      formula.textContent = preset.formula;
      button.append(name, category, formula);
      button.title = `Use ${preset.name}`;
      button.addEventListener('click', () => this.choosePreset(preset));
      list.append(button);
    });
    if (!pagePresets.length) {
      const empty = document.createElement('span');
      empty.className = 'parameter-empty';
      empty.textContent = 'No formulas match this search.';
      list.append(empty);
    }
    const effectCount = new Set(this.filteredPresets.map((preset) => preset.effect)).size;
    this.container.querySelector('#mathPresetPageLabel').textContent =
      `${this.page + 1} / ${pageCount} · ${this.filteredPresets.length} presets · ${effectCount} effects`;
    this.container.querySelector('#mathPresetPrev').disabled = this.page === 0;
    this.container.querySelector('#mathPresetNext').disabled = this.page >= pageCount - 1;
  }

  choosePreset(preset) {
    this.selectedPreset = preset;
    this.formula.value = preset.formula;
    this.params = { ...preset.params };
    this.colorMode.value = preset.color_mode;
    this.colorSeed = null;
    this.shapeMask.checked = Boolean(preset.mask_shape);
    this.paletteSelect.value = preset.palette;
    this.applyPalette(false);
    this.syncColorControls();
    this.renderParams();
    this.onPreview(this.scene());
  }

  changePage(direction) {
    const pageCount = Math.max(1, Math.ceil(this.filteredPresets.length / PAGE_SIZE));
    this.page = Math.max(0, Math.min(pageCount - 1, this.page + direction));
    this.renderPresets();
  }

  renderParams() {
    const expressions = [
      this.formula.value,
      ...(this.colorMode.value === 'formula' ? Object.values(this.colorInputs).map((input) => input.value) : []),
      ...(this.colorMode.value === 'rainbow' ? ['colorSpeed'] : []),
    ].join(' ');
    const identifiers = expressions.match(/[A-Za-z][A-Za-z0-9_]*/g) || [];
    const names = [...new Set(identifiers)].filter((name) => !RESERVED.has(name));
    for (const name of Object.keys(this.params)) {
      if (!names.includes(name)) delete this.params[name];
    }
    this.paramControls.replaceChildren();
    if (!names.length) {
      const empty = document.createElement('span');
      empty.className = 'parameter-empty';
      empty.textContent = 'Add a parameter name to a formula to create a slider.';
      this.paramControls.append(empty);
      return;
    }
    names.forEach((name) => {
      if (!(name in this.params)) this.params[name] = DEFAULT_PARAMS[name] ?? 1;
      const group = document.createElement('label');
      group.className = 'parameter-control';
      const title = document.createElement('span');
      title.textContent = name;
      const output = document.createElement('output');
      output.textContent = Number(this.params[name]).toFixed(2);
      const range = document.createElement('input');
      range.type = 'range';
      range.min = name === 'phase' || !['speed', 'density', 'frequency', 'amplitude', 'colorSpeed'].includes(name) ? '-5' : '0';
      range.max = name === 'phase' ? '6.28' : name === 'amplitude' ? '3' : name === 'colorSpeed' ? '1' : '3';
      range.step = '0.01';
      range.value = String(this.params[name]);
      range.setAttribute('aria-label', `${name} parameter`);
      range.addEventListener('input', () => {
        this.params[name] = Number(range.value);
        this.selectedPreset = null;
        output.textContent = Number(range.value).toFixed(2);
        this.queuePreview();
      });
      group.append(title, output, range);
      this.paramControls.append(group);
    });
  }

  randomize() {
    for (const name of Object.keys(this.params)) {
      const min = name === 'phase' || !['speed', 'density', 'frequency', 'amplitude', 'colorSpeed'].includes(name) ? -2 : 0.05;
      const max = name === 'phase' ? 6.28 : name === 'amplitude' ? 2 : name === 'colorSpeed' ? 0.8 : 1.5;
      this.params[name] = Number((min + Math.random() * (max - min)).toFixed(2));
    }
    this.selectedPreset = null;
    this.renderParams();
    this.onPreview(this.scene());
  }

  randomColors() {
    this.colorMode.value = 'random';
    this.shapeMask.checked = true;
    this.colorSeed = this.makeSeed();
    this.syncColorControls();
    this.renderParams();
    this.onPreview(this.scene());
  }

  applyPalette(preview = true) {
    const palette = this.palettes.find((item) => item.name === this.paletteSelect.value);
    if (!palette) return;
    this.selectedPalette = palette.name;
    for (const [channel, input] of Object.entries(this.colorInputs)) {
      input.value = palette.color_formulas[channel];
    }
    this.renderParams();
    this.syncColorControls();
    if (preview) this.queuePreview();
  }

  syncColorControls() {
    const isFormula = this.colorMode.value === 'formula';
    this.colorFormulas.hidden = !isFormula;
    this.paletteControl.hidden = !isFormula || this.palettes.length === 0;
    this.customColorControl.hidden = this.colorMode.value !== 'custom';
  }

  makeSeed() {
    return Math.floor(Math.random() * 0x100000000);
  }

  queuePreview() {
    window.clearTimeout(this.previewTimer);
    this.previewTimer = window.setTimeout(() => this.onPreview(this.scene()), 220);
  }
}
