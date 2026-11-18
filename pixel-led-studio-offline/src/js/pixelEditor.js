export class PixelEditor {
  constructor(canvas, colorInput, onChange = () => {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.colorInput = colorInput;
    this.onChange = onChange;
    this.frames = [];
    this.width = 30;
    this.height = 20;
    this.painting = false;
    canvas.addEventListener('pointerdown', (event) => {
      this.painting = true;
      canvas.setPointerCapture(event.pointerId);
      this.paintAt(event);
    });
    canvas.addEventListener('pointermove', (event) => {
      if (this.painting) this.paintAt(event);
    });
    canvas.addEventListener('pointerup', () => { this.painting = false; });
    canvas.addEventListener('pointercancel', () => { this.painting = false; });
  }

  resize(width, height) {
    const old = this.frames[0];
    this.width = width;
    this.height = height;
    const next = new Uint8Array(width * height * 3);
    if (old) {
      for (let y = 0; y < Math.min(height, this.oldHeight); y += 1) {
        for (let x = 0; x < Math.min(width, this.oldWidth); x += 1) {
          const source = (y * this.oldWidth + x) * 3;
          next.set(old.subarray(source, source + 3), (y * width + x) * 3);
        }
      }
    }
    this.frames = [next];
    this.oldWidth = width;
    this.oldHeight = height;
    this.render();
  }

  color() {
    const hex = this.colorInput.value.slice(1);
    return [0, 2, 4].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));
  }

  paintAt(event) {
    const rect = this.canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) * this.width / rect.width);
    const y = Math.floor((event.clientY - rect.top) * this.height / rect.height);
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    const offset = (y * this.width + x) * 3;
    this.frames[0].set(this.color(), offset);
    this.render();
    this.onChange();
  }

  clear() {
    this.frames[0].fill(0);
    this.render();
    this.onChange();
  }

  render() {
    const box = this.canvas.parentElement.getBoundingClientRect();
    const cell = Math.max(4, Math.floor(Math.min(box.width / this.width, 420 / this.height)));
    const ratio = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(cell * this.width * ratio);
    this.canvas.height = Math.round(cell * this.height * ratio);
    this.canvas.style.width = `${cell * this.width}px`;
    this.canvas.style.height = `${cell * this.height}px`;
    const ctx = this.ctx;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = '#080b10';
    ctx.fillRect(0, 0, cell * this.width, cell * this.height);
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        const offset = (y * this.width + x) * 3;
        const [r, g, b] = this.frames[0].subarray(offset, offset + 3);
        ctx.fillStyle = r + g + b ? `rgb(${r},${g},${b})` : '#10141b';
        ctx.fillRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
        ctx.strokeStyle = '#202a37';
        ctx.strokeRect(x * cell, y * cell, cell, cell);
      }
    }
  }

  getFrame() { return new Uint8Array(this.frames[0]); }
}
