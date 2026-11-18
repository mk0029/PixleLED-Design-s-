export class LedSimulator {
  constructor(canvas, scrubber, fps = 20, onFrameChange = () => {}, onPlaybackChange = () => {}) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.scrubber = scrubber;
    this.fps = fps;
    this.onFrameChange = onFrameChange;
    this.onPlaybackChange = onPlaybackChange;
    this.frames = [];
    this.frameIndex = 0;
    this.playing = true;
    this.loop = true;
    this.brightness = 1;
    this.rgbBalance = [1, 1, 1];
    this.wiring = 'z';
    this.wireOverlay = true;
    this.lastTick = 0;
    this.draw = this.draw.bind(this);
    this.resizeCanvas = this.layoutCanvas.bind(this);
    window.addEventListener('resize', this.resizeCanvas);
    this.scrubber.addEventListener('input', () => {
      this.frameIndex = Number(this.scrubber.value);
      this.render();
      this.onFrameChange(this.frameIndex);
    });
    requestAnimationFrame(this.draw);
  }

  setFrames(frames, width, height, fps = this.fps) {
    this.frames = frames;
    this.width = width;
    this.height = height;
    this.fps = fps;
    this.frameIndex = 0;
    this.playing = true;
    this.lastTick = 0;
    this.scrubber.min = '0';
    this.scrubber.max = String(Math.max(0, frames.length - 1));
    this.scrubber.value = '0';
    this.canvas.width = Math.max(1, width * 24);
    this.canvas.height = Math.max(1, height * 24);
    this.canvas.style.aspectRatio = `${width} / ${height}`;
    this.layoutCanvas();
    this.render();
    this.onFrameChange(this.frameIndex);
    this.onPlaybackChange(this.playing);
  }

  setPlaybackRate(fps) {
    this.fps = fps;
  }

  setWiring(wiring) {
    this.wiring = wiring;
    this.render();
  }

  setWireOverlay(enabled) {
    this.wireOverlay = enabled;
    this.render();
  }

  setLoop(enabled) {
    this.loop = enabled;
  }

  setBrightness(value) {
    this.brightness = Math.max(0, value);
    this.render();
  }

  setRgbBalance(values) {
    this.rgbBalance = values.map((value) => Math.max(0, value));
    this.render();
  }

  layoutCanvas() {
    if (!this.width || !this.height || !this.canvas.parentElement) return;
    const stage = this.canvas.parentElement;
    const stageStyle = getComputedStyle(stage);
    const availableWidth = Math.max(
      1,
      stage.clientWidth - Number.parseFloat(stageStyle.paddingLeft) - Number.parseFloat(stageStyle.paddingRight),
    );
    const fullscreen = stage.matches(':fullscreen');
    const maxHeight = fullscreen
      ? window.innerHeight * 0.9
      : Math.min(400, window.innerHeight * 0.55);
    const aspectRatio = this.width / this.height;
    const displayHeight = Math.min(maxHeight, availableWidth / aspectRatio);
    const displayWidth = displayHeight * aspectRatio;
    this.canvas.style.width = `${displayWidth}px`;
    this.canvas.style.height = `${displayHeight}px`;
  }

  setPlaying(playing) {
    this.playing = playing;
    this.lastTick = 0;
    this.onPlaybackChange(this.playing);
  }

  restart() {
    if (!this.frames.length) return;
    this.frameIndex = 0;
    this.scrubber.value = '0';
    this.setPlaying(true);
    this.render();
    this.onFrameChange(this.frameIndex);
  }

  stepFrames(amount) {
    if (!this.frames.length) return;
    const count = this.frames.length;
    this.frameIndex = this.loop
      ? (this.frameIndex + amount + count) % count
      : Math.max(0, Math.min(count - 1, this.frameIndex + amount));
    this.scrubber.value = String(this.frameIndex);
    this.render();
    this.onFrameChange(this.frameIndex);
  }

  draw(timestamp) {
    if (this.playing && this.frames.length && timestamp - this.lastTick >= 1000 / this.fps) {
      if (this.frameIndex === this.frames.length - 1 && !this.loop) {
        this.setPlaying(false);
        return;
      }
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
      this.scrubber.value = String(this.frameIndex);
      this.render();
      this.lastTick = timestamp;
      this.onFrameChange(this.frameIndex);
    }
    requestAnimationFrame(this.draw);
  }

  render() {
    if (!this.frames.length || !this.width || !this.height) return;
    const { context: ctx, width, height } = this;
    const cellW = this.canvas.width / width;
    const cellH = this.canvas.height / height;
    const frame = this.frames[this.frameIndex];
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.wireOverlay) this.drawWirePath(ctx, cellW, cellH, width, height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const [sourceRed, sourceGreen, sourceBlue] = frame[y][x];
        const red = Math.min(255, Math.round(sourceRed * this.rgbBalance[0] * this.brightness));
        const green = Math.min(255, Math.round(sourceGreen * this.rgbBalance[1] * this.brightness));
        const blue = Math.min(255, Math.round(sourceBlue * this.rgbBalance[2] * this.brightness));
        const cx = (x + 0.5) * cellW;
        const cy = (y + 0.5) * cellH;
        const radius = Math.max(2, Math.min(cellW, cellH) * 0.31);
        if (red + green + blue > 12) {
          const halo = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius * 2.4);
          halo.addColorStop(0, `rgba(${red}, ${green}, ${blue}, .56)`);
          halo.addColorStop(1, `rgba(${red}, ${green}, ${blue}, 0)`);
          ctx.fillStyle = halo;
          ctx.beginPath();
          ctx.arc(cx, cy, radius * 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = red + green + blue > 12
          ? `rgb(${red}, ${green}, ${blue})`
          : '#090909';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx - radius * 0.24, cy - radius * 0.27, radius * 0.22, 0, Math.PI * 2);
        ctx.fillStyle = red + green + blue > 12 ? 'rgba(255,255,255,.52)' : 'rgba(255,255,255,.07)';
        ctx.fill();
      }
    }
  }

  drawWirePath(ctx, cellW, cellH, width, height) {
    ctx.beginPath();
    for (let y = 0; y < height; y += 1) {
      const reverse = this.wiring === 'z' ? y % 2 === 1 : y % 2 === 0;
      for (let position = 0; position < width; position += 1) {
        const x = reverse ? width - 1 - position : position;
        const px = (x + 0.5) * cellW;
        const py = (y + 0.5) * cellH;
        if (x === (reverse ? width - 1 : 0) && y === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
    }
    ctx.strokeStyle = 'rgba(95, 119, 137, .28)';
    ctx.lineWidth = Math.max(1, Math.min(cellW, cellH) * 0.08);
    ctx.stroke();
  }
}
