import { LedSimulator } from './ledSimulator.js';
import { PixelEditor } from './pixelEditor.js';
import { MathLab } from './mathLab.js';
import { PluginManager } from './pluginManager.js';

const $ = (selector) => document.querySelector(selector);
const SCENE_PAGE_SIZE = 24;
const PREVIEW_FRAME_COUNT = 12;
const sceneMeta = {
  dolphin: { name: 'Leaping Dolphin', icon: '🐬' },
  elephant: { name: 'Walking Elephant', icon: '🐘' },
  lion: { name: 'Walking & Roaring Lion', icon: '🦁' },
  tiger: { name: 'Running Tiger', icon: '🐅' },
  peacock: { name: 'Dancing Peacock', icon: '🦚' },
  horse: { name: 'Galloping Horse', icon: '🐎' },
  camel: { name: 'Walking Camel', icon: '🐪' },
  monkey: { name: 'Dancing & Jumping Monkey', icon: '🐒' },
  rabbit: { name: 'Jumping Rabbit', icon: '🐇' },
  deer: { name: 'Running Deer', icon: '🦌' },
  snake: { name: 'Dancing Snake', icon: '🐍' },
  cobra: { name: 'Hooded Cobra', icon: '🐍' },
  eagle: { name: 'Flying Eagle', icon: '🦅' },
  parrot: { name: 'Flying Parrot', icon: '🦜' },
  butterfly: { name: 'Flapping Butterfly', icon: '🦋' },
  dog: { name: 'Walking & Wagging Dog', icon: '🐕' },
  cat: { name: 'Walking & Jumping Cat', icon: '🐈' },
  dinosaur: { name: 'Walking Dinosaur', icon: '🦖' },
  frog: { name: 'Jumping Frog', icon: '🐸' },
  kangaroo: { name: 'Jumping Kangaroo', icon: '🦘' },
  bear: { name: 'Dancing Bear', icon: '🐻' },
  dragon: { name: 'Flying Dragon', icon: '🐉' },
  rooster: { name: 'Crowing Rooster', icon: '🐓' },
  swan: { name: 'Swimming Swan', icon: '🦢' },
  turtle: { name: 'Swimming Turtle', icon: '🐢' },
  bird: { name: 'Flying Bird', icon: '🐦' },
  bhangra: { name: 'Punjabi Bhangra Man', icon: '🕺' },
  gidda: { name: 'Punjabi Gidda Girl', icon: '💃' },
  dhol_player: { name: 'Punjabi Dhol Player', icon: '🥁' },
  baraat: { name: 'Punjabi Wedding Baraat', icon: '🎊' },
  fish: { name: 'Colorful Fish', icon: '🐠' },
  human: { name: 'Walking Human', icon: '🚶' },
  moonwalk: { name: 'Moonwalking Human', icon: '🕺' },
  fireworks: { name: 'Fireworks & Sparkles', icon: '🎆' },
  hearts: { name: 'Pulsing Hearts', icon: '💗' },
  hyperspace: { name: 'Hyperspace Tunnel', icon: '🌀' },
  plasma: { name: 'Rainbow Plasma', icon: '🌈' },
  spectrum: { name: 'DJ Spectrum', icon: '🎚️' },
  diamonds: { name: 'Diamonds & Chevrons', icon: '◇' },
  rain: { name: 'Rain Shower', icon: '🌧️' },
  line_rain: { name: 'Vertical Line Rain & Splash', icon: '💦' },
  droplets: { name: 'Falling Drops & Splash', icon: '💧' },
  ripples: { name: 'Water Ripples', icon: '◉' },
  bubbles: { name: 'Rising Bubbles', icon: '🫧' },
  waterfall: { name: 'Waterfall', icon: '🌊' },
  snow: { name: 'Snowfall', icon: '❄️' },
  meteor: { name: 'Meteor Shower', icon: '☄️' },
  confetti: { name: 'Confetti Burst', icon: '🎊' },
  fireflies: { name: 'Fireflies', icon: '✨' },
  aurora: { name: 'Aurora Curtains', icon: '🌌' },
  flame: { name: 'Dancing Flame', icon: '🔥' },
  matrix: { name: 'Digital Matrix Rain', icon: '▥' },
  spiral: { name: 'Rainbow Spiral', icon: '🌀' },
  pulse: { name: 'Pulse Rings', icon: '◉' },
  comets: { name: 'Comet Trails', icon: '☄️' },
  text: { name: 'Scrolling Text', icon: 'Aa' },
  custom: { name: 'Custom Sprite', icon: '✳' },
};
const familyIcons = {
  Animals: '🐾',
  'Punjabi Bhangra': '🥁',
  Characters: '🐾',
  'Digital Effects': '▥',
  'Space & Light': '🌀',
  'Music & Geometry': '🎚️',
  'Dance & Celebration': '💃',
  'Wedding & Welcome': '✨',
  'Water & Weather': '💦',
};

const simulator = new LedSimulator(
  $('#ledCanvas'),
  $('#frameScrubber'),
  20,
  updateFrameDisplay,
  updatePlayButton,
);
const playlist = [];
let activeScene = { pattern: 'dolphin', name: sceneMeta.dolphin.name, duration: 2, options: {} };
let sceneCatalog = [];
let filteredSceneCatalog = [];
let scenePage = 0;
let wiring = 'z';
let previewRequest = 0;
let toastTimeout;
let editorInitialized = false;

const editor = new PixelEditor($('#paintCanvas'), $('#brushColor'), (frames) => {
  addScene({ pattern: 'custom', name: 'Custom Sprite', duration: 3, options: { frames } });
});

new MathLab($('#mathPanel'), (scene) => setActiveScene(scene), (scene) => addScene(scene), notify);
new PluginManager($('#drawPluginsPanel'), (scene) => addScene(scene), notify);

function config() {
  return {
    width: Number($('#gridWidth').value),
    height: Number($('#gridHeight').value),
    fps: Number($('#gridFps').value),
  };
}

function updateGridSummary() {
  const { width, height } = config();
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 120 || height > 80) return;
  $('#gridSummary').textContent = `${width} × ${height} · ${(width * height).toLocaleString()} RGB pixels`;
  $('#collectionResolution').textContent = `${width} × ${height} · 12-FRAME EDITABLE PACKS`;
}

function messageOptions() {
  const hex = $('#messageColor').value.slice(1);
  return {
    text: $('#messageText').value.trim() || 'TORAN',
    speed: Number($('#messageSpeed').value),
    color: [
      Number.parseInt(hex.slice(0, 2), 16),
      Number.parseInt(hex.slice(2, 4), 16),
      Number.parseInt(hex.slice(4, 6), 16),
    ],
  };
}

function notify(text, error = false) {
  const toast = $('#toast');
  toast.textContent = text;
  toast.classList.toggle('error', error);
  toast.classList.add('visible');
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => toast.classList.remove('visible'), 3200);
}

function formatTime(seconds) {
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

function updateFrameDisplay(frameIndex = simulator.frameIndex) {
  const frameCount = simulator.frames.length;
  const fps = Number($('#gridFps').value) || 10;
  $('#frameCount').textContent = `${String(frameIndex + 1).padStart(2, '0')} / ${String(frameCount).padStart(2, '0')}`;
  $('#currentTime').textContent = formatPlayerTime(frameIndex / fps);
  $('#totalTime').textContent = formatPlayerTime(frameCount / fps);
}

function formatPlayerTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const wholeSeconds = Math.floor(seconds % 60);
  const tenths = Math.floor((seconds % 1) * 10);
  return `${String(minutes).padStart(2, '0')}:${String(wholeSeconds).padStart(2, '0')}.${tenths}`;
}

function updatePlayButton(playing = simulator.playing) {
  $('#playButton').textContent = playing ? 'Ⅱ' : '▶';
  $('#playButton').setAttribute('aria-label', playing ? 'Pause animation' : 'Play animation');
}

function setActiveScene(scene) {
  activeScene = scene;
  loadPreview();
}

function activateTab(panelId) {
  document.querySelectorAll('.studio-tab').forEach((button) => {
    const active = button.dataset.tab === panelId;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  document.querySelectorAll('.tab-panel').forEach((panel) => {
    const active = panel.id === panelId;
    panel.hidden = !active;
    panel.classList.toggle('active', active);
  });
  if (panelId === 'drawPluginsPanel') initializeEditor();
}

function initializeEditor(reset = false) {
  const { width, height } = config();
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 120 || height > 80) {
    notify('Grid size must be between 1×1 and 120×80.', true);
    return;
  }
  if (reset || !editorInitialized) editor.open(width, height);
  else editor.resize(width, height);
  editorInitialized = true;
  $('#spriteDimensions').textContent = `${width} × ${height} GRID`;
  editor.setOnionSkin($('#onionSkin').checked);
}

function handleGridChange() {
  updateGridSummary();
  drawWiring();
  const { width, height } = config();
  if (editorInitialized && Number.isInteger(width) && Number.isInteger(height) && width >= 1 && height >= 1 && width <= 120 && height <= 80) {
    initializeEditor();
  }
  loadPreview();
}

async function loadPreview() {
  const requestId = ++previewRequest;
  const { width, height, fps } = config();
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 120 || height > 80) {
    notify('Grid size must be between 1×1 and 120×80.', true);
    return;
  }
  try {
    const response = await fetch('/api/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ width, height, fps, frame_count: PREVIEW_FRAME_COUNT, scene: activeScene }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not render this preview.');
    if (requestId !== previewRequest) return;
    simulator.setFrames(data.frames, width, height, Number($('#playSpeed').value));
    $('#resolutionLabel').textContent = `${width} × ${height}`;
    $('#pixelCount').textContent = (width * height).toLocaleString();
    updateFrameDisplay();
  } catch (error) {
    if (requestId === previewRequest) notify(error.message, true);
  }
}

function drawWiring() {
  const canvas = $('#wiringCanvas');
  const ctx = canvas.getContext('2d');
  const { width, height } = config();
  const cols = Math.max(2, Math.min(width, 10));
  const rows = Math.max(2, Math.min(height, 4));
  const points = [];
  for (let row = 0; row < rows; row += 1) {
    const reverse = wiring === 'z' ? row % 2 === 1 : row % 2 === 0;
    for (let col = 0; col < cols; col += 1) {
      const x = reverse ? cols - col - 1 : col;
      points.push([7 + x * 9.5, 6 + row * 9]);
    }
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.beginPath();
  points.forEach(([x, y], index) => {
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = '#345063';
  ctx.lineWidth = 1;
  ctx.stroke();
  points.forEach(([x, y], index) => {
    ctx.beginPath();
    ctx.arc(x, y, index === 0 ? 2.4 : 1.5, 0, Math.PI * 2);
    ctx.fillStyle = index === 0 ? '#00a8ff' : '#8292a1';
    ctx.fill();
  });
}

function renderPlaylist() {
  const container = $('#playlistList');
  container.replaceChildren();
  $('#playlistEmpty').hidden = playlist.length > 0;
  playlist.forEach((scene, index) => {
    const row = document.createElement('div');
    row.className = 'playlist-item';
    const number = document.createElement('span');
    number.className = 'playlist-num';
    number.textContent = String(index + 1).padStart(2, '0');
    const icon = document.createElement('span');
    icon.className = 'playlist-symbol';
    const sceneFamily = sceneCatalog.find(({ id }) => id === scene.pattern)?.family;
    icon.textContent = sceneMeta[scene.pattern]?.icon || familyIcons[sceneFamily] || '✳';
    const name = document.createElement('button');
    name.className = 'playlist-name item-action';
    name.textContent = scene.name;
    name.title = 'Preview this scene';
    name.addEventListener('click', () => setActiveScene(scene));
    const duration = document.createElement('input');
    duration.className = 'duration-input';
    duration.type = 'number';
    duration.min = '0.1';
    duration.max = '120';
    duration.step = '0.5';
    duration.value = scene.duration;
    duration.setAttribute('aria-label', `${scene.name} duration in seconds`);
    duration.addEventListener('change', () => {
      const value = Number(duration.value);
      if (value < 0.1 || value > 120) {
        duration.value = String(scene.duration);
        notify('Scene duration must be from 0.1 to 120 seconds.', true);
        return;
      }
      scene.duration = value;
      updatePlaylistTotal();
    });
    const up = actionButton('↑', 'Move scene up', () => moveScene(index, -1));
    const down = actionButton('↓', 'Move scene down', () => moveScene(index, 1));
    const remove = actionButton('×', 'Remove scene', () => {
      playlist.splice(index, 1);
      renderPlaylist();
    });
    remove.classList.add('remove');
    row.append(number, icon, name, duration, up, down, remove);
    container.append(row);
  });
  updatePlaylistTotal();
}

function actionButton(label, title, action) {
  const button = document.createElement('button');
  button.className = 'item-action';
  button.type = 'button';
  button.textContent = label;
  button.title = title;
  button.addEventListener('click', action);
  return button;
}

function moveScene(index, direction) {
  const destination = index + direction;
  if (destination < 0 || destination >= playlist.length) return;
  [playlist[index], playlist[destination]] = [playlist[destination], playlist[index]];
  renderPlaylist();
}

function updatePlaylistTotal() {
  const total = playlist.reduce((sum, scene) => sum + Number(scene.duration), 0);
  $('#playlistTotal').textContent = formatTime(total);
}

function addScene(scene) {
  playlist.push({ ...scene, duration: scene.duration || 3 });
  renderPlaylist();
  setActiveScene(scene);
  notify(`${scene.name} added to playlist`);
}

function renderLibrary(patterns) {
  sceneCatalog = patterns;
  const familyFilter = $('#sceneFamilyFilter');
  const selectedFamily = familyFilter.value || 'all';
  const families = [...new Set(patterns.map(({ family }) => family || 'Other'))].sort();
  familyFilter.replaceChildren(new Option('All families', 'all'));
  families.forEach((family) => familyFilter.add(new Option(family, family)));
  familyFilter.value = families.includes(selectedFamily) ? selectedFamily : 'all';
  scenePage = 0;
  filterSceneLibrary();
}

function navigateAnimation(direction) {
  const choices = filteredSceneCatalog.length ? filteredSceneCatalog : sceneCatalog;
  if (!choices.length) return;
  let current = choices.findIndex(({ id }) => id === activeScene.pattern);
  if (current < 0) current = direction > 0 ? -1 : 0;
  const selected = choices[(current + direction + choices.length) % choices.length];
  setActiveScene({
    pattern: selected.id,
    name: selected.name,
    duration: 2,
    options: selected.id === 'text' ? messageOptions() : {},
  });
}

async function exportCollection(category, button) {
  const { width, height, fps } = config();
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 120 || height > 80) {
    notify('Grid size must be between 1×1 and 120×80.', true);
    return;
  }
  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = 'Packing…';
  try {
    const response = await fetch('/api/export/collection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, width, height, fps, frame_count: 12 }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Animation pack export failed.');
    const link = document.createElement('a');
    link.href = data.url;
    link.download = '';
    document.body.append(link);
    link.click();
    link.remove();
    notify(`${category} pack ready · ${data.animation_count} animations · ${width} × ${height} pixels`);
  } catch (error) {
    notify(error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function filterSceneLibrary() {
  const search = $('#sceneSearch').value.trim().toLowerCase();
  const selectedFamily = $('#sceneFamilyFilter').value;
  filteredSceneCatalog = sceneCatalog.filter(({ id, name, family }) => {
    const familyMatches = selectedFamily === 'all' || (family || 'Other') === selectedFamily;
    const searchMatches = `${name} ${family} ${id}`.toLowerCase().includes(search);
    return familyMatches && searchMatches;
  });
  const pageCount = Math.max(1, Math.ceil(filteredSceneCatalog.length / SCENE_PAGE_SIZE));
  scenePage = Math.min(scenePage, pageCount - 1);
  const visiblePatterns = filteredSceneCatalog.slice(
    scenePage * SCENE_PAGE_SIZE,
    (scenePage + 1) * SCENE_PAGE_SIZE,
  );
  const library = $('#sceneLibrary');
  library.replaceChildren();
  visiblePatterns.forEach(({ id, name, family }) => {
    const button = document.createElement('button');
    button.className = 'scene-tile';
    button.type = 'button';
    const icon = document.createElement('span');
    icon.className = 'scene-icon';
    icon.textContent = sceneMeta[id]?.icon || familyIcons[family] || '✳';
    const label = document.createElement('strong');
    label.textContent = name;
    const plus = document.createElement('span');
    plus.className = 'scene-add';
    plus.textContent = '+';
    button.append(icon, label, plus);
    button.title = `Add ${name} to the playlist`;
    button.addEventListener('click', () => addScene({
      pattern: id,
      name,
      duration: 3,
      options: id === 'text' ? messageOptions() : {},
    }));
    library.append(button);
  });
  if (!visiblePatterns.length) {
    const empty = document.createElement('span');
    empty.className = 'parameter-empty';
    empty.textContent = 'No animations match this search.';
    library.append(empty);
  }
  $('#sceneCount').textContent = `${filteredSceneCatalog.length} EFFECTS`;
  $('#scenePageLabel').textContent =
    `${scenePage + 1} / ${pageCount} · ${filteredSceneCatalog.length} effects`;
  $('#scenePrev').disabled = scenePage === 0;
  $('#sceneNext').disabled = scenePage >= pageCount - 1;
}

async function exportPlaylist() {
  if (!playlist.length) {
    notify('Add at least one scene before exporting.', true);
    return;
  }
  const buttons = [$('#exportButton'), $('#exportTop')];
  buttons.forEach((button) => { button.disabled = true; });
  $('#exportButton').textContent = 'Rendering…';
  try {
    const response = await fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...config(), playlist }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'SWF export failed.');
    const link = document.createElement('a');
    link.href = data.master;
    link.download = '';
    document.body.append(link);
    link.click();
    link.remove();
    notify(`Master SWF ready · ${data.frame_count} frames · ${data.duration}s`);
  } catch (error) {
    notify(error.message, true);
  } finally {
    buttons.forEach((button) => { button.disabled = false; });
    $('#exportButton').innerHTML = '↥ Export .SWF';
  }
}

document.querySelectorAll('.studio-tab').forEach((button) => {
  button.addEventListener('click', () => activateTab(button.dataset.tab));
});
$('#playButton').addEventListener('click', () => {
  simulator.setPlaying(!simulator.playing);
});
$('#restartPreview').addEventListener('click', () => simulator.restart());
$('#previousFrame').addEventListener('click', () => simulator.stepFrames(-1));
$('#nextFrame').addEventListener('click', () => simulator.stepFrames(1));
$('#previousAnimation').addEventListener('click', () => navigateAnimation(-1));
$('#nextAnimation').addEventListener('click', () => navigateAnimation(1));
$('#loopToggle').addEventListener('change', (event) => simulator.setLoop(event.target.checked));
$('#fullscreenPreview').addEventListener('click', async () => {
  const stage = $('.sim-stage');
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (stage.requestFullscreen) await stage.requestFullscreen();
  } catch (error) {
    notify(`Fullscreen preview failed: ${error.message}`, true);
  }
});
$('#frameScrubber').addEventListener('input', () => updateFrameDisplay());
$('#playSpeed').addEventListener('input', (event) => {
  const speed = Number(event.target.value);
  simulator.setPlaybackRate(speed);
  $('#playSpeedLabel').textContent = `${speed} FPS`;
});
$('#previewBrightness').addEventListener('input', (event) => {
  const brightness = Number(event.target.value);
  simulator.setBrightness(brightness / 100);
  $('#brightnessLabel').value = `${brightness}%`;
});
const rgbBalanceInputs = ['#redBalance', '#greenBalance', '#blueBalance'].map((selector) => $(selector));
const updateRgbBalance = () => simulator.setRgbBalance(rgbBalanceInputs.map((input) => Number(input.value) / 100));
rgbBalanceInputs.forEach((input) => input.addEventListener('input', updateRgbBalance));
$('#gridWidth').addEventListener('change', handleGridChange);
$('#gridHeight').addEventListener('change', handleGridChange);
$('#gridFps').addEventListener('change', loadPreview);
$('#sceneFamilyFilter').addEventListener('change', () => {
  scenePage = 0;
  filterSceneLibrary();
});
$('#sceneSearch').addEventListener('input', () => {
  scenePage = 0;
  filterSceneLibrary();
});
$('#scenePrev').addEventListener('click', () => {
  scenePage = Math.max(0, scenePage - 1);
  filterSceneLibrary();
});
$('#sceneNext').addEventListener('click', () => {
  const pageCount = Math.ceil(filteredSceneCatalog.length / SCENE_PAGE_SIZE);
  scenePage = Math.min(Math.max(0, pageCount - 1), scenePage + 1);
  filterSceneLibrary();
});
document.querySelectorAll('[data-wiring]').forEach((button) => button.addEventListener('click', () => {
  wiring = button.dataset.wiring;
  document.querySelectorAll('[data-wiring]').forEach((option) => option.classList.toggle('active', option === button));
  simulator.setWiring(wiring);
  drawWiring();
}));
$('#wireOverlay').addEventListener('change', (event) => simulator.setWireOverlay(event.target.checked));
$('#messageColor').addEventListener('input', (event) => {
  $('.text-row .color-dot').style.background = event.target.value;
});
$('#addText').addEventListener('click', () => addScene({
  pattern: 'text',
  name: `Text · ${messageOptions().text}`,
  duration: 4,
  options: messageOptions(),
}));
$('#clearPlaylist').addEventListener('click', () => {
  playlist.length = 0;
  renderPlaylist();
});
$('#exportButton').addEventListener('click', exportPlaylist);
$('#exportTop').addEventListener('click', exportPlaylist);
$('#exportAnimalsPack').addEventListener('click', (event) => exportCollection('Animals', event.currentTarget));
$('#exportBhangraPack').addEventListener('click', (event) => exportCollection('Punjabi Bhangra', event.currentTarget));
$('#openEditor').addEventListener('click', () => {
  activateTab('drawPluginsPanel');
  $('#paintCanvas').scrollIntoView({ behavior: 'smooth', block: 'center' });
});
$('#clearFrame').addEventListener('click', () => editor.clearFrame());
$('#addSpriteFrame').addEventListener('click', () => editor.addFrame());
$('#useSprite').addEventListener('click', () => editor.save());
$('#resetSprite').addEventListener('click', () => initializeEditor(true));
$('#brushColor').addEventListener('input', (event) => {
  $('#drawPluginsPanel .color-dot').style.background = event.target.value;
});
$('#spritePrevFrame').addEventListener('click', () => editor.previousFrame());
$('#spriteNextFrame').addEventListener('click', () => editor.nextFrame());
$('#onionSkin').addEventListener('change', (event) => editor.setOnionSkin(event.target.checked));

simulator.setWiring(wiring);
simulator.setWireOverlay($('#wireOverlay').checked);
updateGridSummary();
drawWiring();
renderPlaylist();
fetch('/api/patterns')
  .then((response) => {
    if (!response.ok) throw new Error('Could not load scene library.');
    return response.json();
  })
  .then(({ patterns }) => renderLibrary(patterns))
  .catch((error) => notify(error.message, true));
loadPreview();
