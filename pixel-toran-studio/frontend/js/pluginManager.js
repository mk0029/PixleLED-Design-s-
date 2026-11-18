export class PluginManager {
  constructor(container, onAdd, notify) {
    this.container = container;
    this.onAdd = onAdd;
    this.notify = notify;
    this.list = container.querySelector('#pluginList');
    container.querySelector('#reloadPlugins').addEventListener('click', () => this.reload());
    container.querySelector('#uploadPlugin').addEventListener('click', () => container.querySelector('#pluginFile').click());
    container.querySelector('#pluginFile').addEventListener('change', (event) => this.upload(event.target.files[0]));
    this.reload();
  }

  async request(url, options = {}) {
    let response;
    try {
      response = await fetch(url, options);
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error('Cannot reach the local plugin API. Start Flask with `python backend/app.py` and open http://127.0.0.1:5000/.');
      }
      throw error;
    }
    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error(`The plugin API returned an unreadable response (HTTP ${response.status}).`);
    }
    if (!response.ok) throw new Error(result.error || `Plugin request failed (${response.status}).`);
    return result;
  }

  async reload() {
    this.list.replaceChildren(this.message('Loading local plugins…', 'muted'));
    try {
      this.render(await this.request('/api/plugins'));
    } catch (error) {
      this.list.replaceChildren(this.message(error.message, 'error'));
    }
  }

  async upload(file) {
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    try {
      const result = await this.request('/api/plugins/upload', { method: 'POST', body: form });
      this.render(result);
      this.notify(`Loaded plugin: ${file.name}`);
    } catch (error) {
      this.notify(error.message, true);
      await this.reload();
    } finally {
      this.container.querySelector('#pluginFile').value = '';
    }
  }

  render(catalog) {
    this.list.replaceChildren();
    if (!catalog.plugins.length && !catalog.errors.length) {
      this.list.append(this.message('No Python plugins found. Add one with the upload button.', 'muted'));
    }
    catalog.plugins.forEach((plugin) => this.list.append(this.pluginCard(plugin)));
    catalog.errors.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'plugin-error';
      const file = document.createElement('strong');
      file.textContent = item.file;
      const error = document.createElement('span');
      error.textContent = item.error;
      card.append(file, error);
      this.list.append(card);
    });
  }

  pluginCard(plugin) {
    const card = document.createElement('article');
    card.className = 'plugin-card';
    const heading = document.createElement('div');
    heading.className = 'plugin-card-heading';
    const name = document.createElement('strong');
    name.textContent = plugin.name;
    const id = document.createElement('span');
    id.textContent = plugin.id;
    heading.append(name, id);

    const params = document.createElement('div');
    params.className = 'plugin-params';
    const values = { ...plugin.params };
    Object.entries(plugin.params).forEach(([key, value]) => {
      const control = document.createElement('label');
      control.className = 'plugin-param';
      const label = document.createElement('span');
      label.textContent = key;
      const [min, max, step] = plugin.ranges?.[key]
        ?? [value < 0 ? -5 : 0, Math.max(3, Math.abs(value) * 3), 0.01];
      const decimals = Number.isInteger(step) ? 0 : 2;
      const output = document.createElement('output');
      output.textContent = Number(value).toFixed(decimals);
      const range = document.createElement('input');
      range.type = 'range';
      range.min = String(min);
      range.max = String(max);
      range.step = String(step);
      range.value = String(value);
      range.addEventListener('input', () => {
        values[key] = Number(range.value);
        output.textContent = Number(range.value).toFixed(decimals);
      });
      control.append(label, output, range);
      params.append(control);
    });

    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'button button-secondary compact';
    add.textContent = '＋ Add to playlist';
    add.addEventListener('click', () => this.onAdd({
      pattern: `plugin:${plugin.id}`,
      name: plugin.name,
      duration: values.seconds ?? 8,
      options: { params: { ...values } },
    }));
    card.append(heading, params, add);
    return card;
  }

  message(text, kind) {
    const element = document.createElement('div');
    element.className = `plugin-message ${kind}`;
    element.textContent = text;
    return element;
  }
}
