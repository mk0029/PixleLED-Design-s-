export class LedSimulator {
  constructor(canvas, onFrame = () => {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onFrame = onFrame;
    this.frames = [];
    this.frame = 0;
    this.width = 30;
    this.height = 20;
    this.fps = 20;
    this.playing = true;
    this.wiring = 'z';
    this.overlay = true;
    this.zoom = 1;
    this.hover = null;
    this.lastTick = 0;
    this.pixelRatio = window.devicePixelRatio || 1;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement);
    canvas.addEventListener('pointermove', (event) => this.pointerMove(event));
    canvas.addEventListener('pointerleave', () => { this.hover = null; this.render(); });
    this.resize();
    requestAnimationFrame((time) => this.tick(time));
  }

  setFrames(frames, width, height, fps = this.fps) {
    this.frames = frames;
    this.width = width;
    this.height = height;
    this.fps = fps;
    this.frame = 0;
    this.playing = true;
    this.lastTick = 0;
    this.render();
    this.onFrame(this.frame);
  }

  setFrame(index) {
    this.frame = Math.max(0, Math.min(this.frames.length - 1, index));
    this.render();
    this.onFrame(this.frame);
  }

  setWiring(value) { this.wiring = value; this.render(); }
  setOverlay(value) { this.overlay = value; this.render(); }
  setZoom(value) { this.zoom = Math.max(.5, Math.min(1.6, value)); this.resize(); }
  toggle() { this.playing = !this.playing; return this.playing; }

  resize() {
    const box = this.canvas.parentElement.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const naturalScale = Math.min(box.width / this.width, box.height / this.height);
    const size = Math.max(5, naturalScale * this.zoom);
    this.cellSize = size;
    this.displayWidth = Math.max(1, Math.ceil(size * this.width));
    this.displayHeight = Math.max(1, Math.ceil(size * this.height));
    this.canvas.style.width = `${this.displayWidth}px`;
    this.canvas.style.height = `${this.displayHeight}px`;
    this.canvas.width = Math.round(this.displayWidth * ratio);
    this.canvas.height = Math.round(this.displayHeight * ratio);
    this.pixelRatio = ratio;
    this.render();
  }

  pointIndex(x, y) {
    if (this.wiring === 'z') {
      const position = y % 2 === 0 ? x : this.width - 1 - x;
      return y * this.width + position + 1;
    }
    const position = x % 2 === 0 ? y : this.height - 1 - y;
    return x * this.height + position + 1;
  }

  pointerMove(event) {
    const rect = this.canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) * this.width / rect.width);
    const y = Math.floor((event.clientY - rect.top) * this.height / rect.height);
    this.hover = x >= 0 && x < this.width && y >= 0 && y < this.height ? { x, y } : null;
    this.render();
  }

  tick(timestamp) {
    if (this.playing && this.frames.length && timestamp - this.lastTick >= 1000 / this.fps) {
      this.frame = (this.frame + 1) % this.frames.length;
      this.lastTick = timestamp;
      this.render();
      this.onFrame(this.frame);
    }
    requestAnimationFrame((time) => this.tick(time));
  }

  render() {
    const ctx = this.ctx;
    const ratio = this.pixelRatio;
    const cell = this.cellSize || 10;
    const width = this.width;
    const height = this.height;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, this.displayWidth || 1, this.displayHeight || 1);
    ctx.fillStyle = '#07090d';
    ctx.fillRect(0, 0, this.displayWidth || 1, this.displayHeight || 1);
    const frame = this.frames[this.frame];
    if (!frame) return;

    if (this.overlay) {
      ctx.beginPath();
      for (let index = 0; index < width * height; index += 1) {
        const x = this.wiring === 'z'
          ? (Math.floor(index / width) % 2 ? width - 1 - index % width : index % width)
          : Math.floor(index / height);
        const y = this.wiring === 'z'
          ? Math.floor(index / width)
          : (x % 2 ? height - 1 - index % height : index % height);
        const px = (x + .5) * cell;
        const py = (y + .5) * cell;
        if (index === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = 'rgba(86, 116, 145, .24)';
      ctx.lineWidth = Math.max(.7, cell * .045);
      ctx.stroke();
    }
    const radius = Math.max(1.4, Math.min(cell * .34, 10));
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const source = (y * width + x) * 3;
        const r = frame[source];
        const g = frame[source + 1];
        const b = frame[source + 2];
        const px = (x + .5) * cell;
        const py = (y + .5) * cell;
        ctx.beginPath();
        ctx.arc(px, py, radius + 1.2, 0, Math.PI * 2);
        ctx.fillStyle = '#11161f';
        ctx.fill();
        if (r + g + b > 15) {
          const bloom = ctx.createRadialGradient(px, py, radius * .15, px, py, radius * 2.4);
          bloom.addColorStop(0, `rgba(${r},${g},${b},.48)`);
          bloom.addColorStop(1, `rgba(${r},${g},${b},0)`);
          ctx.fillStyle = bloom;
          ctx.fillRect(px - radius * 2.4, py - radius * 2.4, radius * 4.8, radius * 4.8);
        }
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fillStyle = r + g + b > 15 ? `rgb(${r},${g},${b})` : '#080a0e';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(px - radius * .25, py - radius * .28, Math.max(.45, radius * .18), 0, Math.PI * 2);
        ctx.fillStyle = r + g + b > 15 ? 'rgba(255,255,255,.52)' : 'rgba(255,255,255,.07)';
        ctx.fill();
      }
    }
    if (this.hover) {
      const { x, y } = this.hover;
      const px = (x + .5) * cell;
      const py = (y + .5) * cell;
      ctx.beginPath();
      ctx.arc(px, py, radius + 3, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.font = '11px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#eaf5ff';
      ctx.fillText(`#${this.pointIndex(x, y)}  (${x + 1}, ${y + 1})`, Math.min(this.displayWidth - 105, px + 9), Math.max(12, py - 8));
    }
  }
}
