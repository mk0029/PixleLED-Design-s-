export class PixelEditor {
  constructor(canvas, colorInput, onSave) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.colorInput = colorInput;
    this.onSave = onSave;
    this.frames = [];
    this.frameIndex = 0;
    this.painting = false;
    this.onionSkin = true;
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

  open(width, height) {
    this.width = width;
    this.height = height;
    this.frames = [this.emptyFrame()];
    this.frameIndex = 0;
    this.setCanvasSize();
    this.render();
    this.updateLabel();
  }

  resize(width, height) {
    if (width === this.width && height === this.height) return;
    this.frames = this.frames.map((frame) =>
      Array.from({ length: height }, (_, y) =>
        Array.from({ length: width }, (_, x) => frame[y]?.[x] ? [...frame[y][x]] : [0, 0, 0])));
    this.width = width;
    this.height = height;
    this.setCanvasSize();
    this.render();
  }

  setCanvasSize() {
    const cell = Math.min(24, Math.max(7, Math.floor(660 / this.width), Math.floor(470 / this.height)));
    this.cellSize = cell;
    this.canvas.width = this.width * cell;
    this.canvas.height = this.height * cell;
  }

  emptyFrame() {
    return Array.from({ length: this.height }, () =>
      Array.from({ length: this.width }, () => [0, 0, 0]));
  }

  paintAt(event) {
    const rect = this.canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) * this.canvas.width / rect.width / this.cellSize);
    const y = Math.floor((event.clientY - rect.top) * this.canvas.height / rect.height / this.cellSize);
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const hex = this.colorInput.value.slice(1);
    this.frames[this.frameIndex][y][x] = [
      Number.parseInt(hex.slice(0, 2), 16),
      Number.parseInt(hex.slice(2, 4), 16),
      Number.parseInt(hex.slice(4, 6), 16),
    ];
    this.render();
  }

  addFrame() {
    this.frames.push(this.emptyFrame());
    this.frameIndex = this.frames.length - 1;
    this.updateLabel();
    this.render();
  }

  clearFrame() {
    this.frames[this.frameIndex] = this.emptyFrame();
    this.render();
  }

  previousFrame() {
    this.frameIndex = (this.frameIndex - 1 + this.frames.length) % this.frames.length;
    this.updateLabel();
    this.render();
  }

  nextFrame() {
    this.frameIndex = (this.frameIndex + 1) % this.frames.length;
    this.updateLabel();
    this.render();
  }

  setOnionSkin(enabled) {
    this.onionSkin = enabled;
    this.render();
  }

  updateLabel() {
    const label = document.querySelector('#spriteFrameLabel');
    label.textContent = `FRAME ${this.frameIndex + 1} / ${this.frames.length}`;
  }

  render() {
    const { context: ctx, canvas, cellSize, width, height } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#111922';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const frame = this.frames[this.frameIndex];
    if (this.onionSkin && this.frames.length > 1) {
      const previous = this.frames[(this.frameIndex - 1 + this.frames.length) % this.frames.length];
      ctx.globalAlpha = 0.22;
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const [red, green, blue] = previous[y][x];
          if (red + green + blue > 0) {
            ctx.fillStyle = `rgb(${red}, ${green}, ${blue})`;
            ctx.fillRect(x * cellSize + 1, y * cellSize + 1, cellSize - 2, cellSize - 2);
          }
        }
      }
      ctx.globalAlpha = 1;
    }
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const [red, green, blue] = frame[y][x];
        if (red + green + blue > 0) {
          ctx.fillStyle = `rgb(${red}, ${green}, ${blue})`;
          ctx.fillRect(x * cellSize + 1, y * cellSize + 1, cellSize - 2, cellSize - 2);
        }
        ctx.strokeStyle = '#26323e';
        ctx.lineWidth = 0.7;
        ctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }
  }

  save() {
    this.onSave(this.frames.map((frame) => frame.map((row) => row.map((pixel) => [...pixel]))));
  }
}
