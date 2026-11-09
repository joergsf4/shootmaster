// Sega Master System VDP (nur Mode 4)
export class VDP {
  vram = new Uint8Array(0x4000);
  cram = new Uint8Array(32);
  regs = new Uint8Array(16);
  status = 0;
  private latch = false;
  private first = 0;
  private addr = 0;
  private code = 0;
  private readBuf = 0;
  private lineCounter = 0xff;
  lineIrq = false;
  vScrollLatch = 0;
  /** RGBA-Framebuffer 256×192 */
  frame = new Uint32Array(256 * 192);
  /** Farbtabelle CRAM → RGBA (little endian ABGR) */
  private rgba = new Uint32Array(64);

  constructor() {
    const lv = [0, 85, 170, 255];
    for (let c = 0; c < 64; c++) {
      this.rgba[c] = (0xff << 24) | (lv[(c >> 4) & 3] << 16) | (lv[(c >> 2) & 3] << 8) | lv[c & 3];
    }
    this.regs.set([0x36, 0x80, 0xff, 0xff, 0xff, 0xff, 0xfb, 0, 0, 0, 0xff]);
  }

  get irq(): boolean {
    return ((this.status & 0x80) !== 0 && (this.regs[1] & 0x20) !== 0) || (this.lineIrq && (this.regs[0] & 0x10) !== 0);
  }

  readStatus(): number {
    const s = this.status | 0x1f;
    this.status = 0;
    this.lineIrq = false;
    this.latch = false;
    return s;
  }

  readData(): number {
    this.latch = false;
    const v = this.readBuf;
    this.readBuf = this.vram[this.addr];
    this.addr = (this.addr + 1) & 0x3fff;
    return v;
  }

  writeData(v: number) {
    this.latch = false;
    if (this.code === 3) this.cram[this.addr & 31] = v & 0x3f;
    else this.vram[this.addr] = v;
    this.readBuf = v;
    this.addr = (this.addr + 1) & 0x3fff;
  }

  writeCtrl(v: number) {
    if (!this.latch) {
      this.first = v;
      this.addr = (this.addr & 0x3f00) | v;
      this.latch = true;
      return;
    }
    this.latch = false;
    this.code = v >> 6;
    this.addr = ((v & 0x3f) << 8) | this.first;
    if (this.code === 0) {
      this.readBuf = this.vram[this.addr];
      this.addr = (this.addr + 1) & 0x3fff;
    } else if (this.code === 2) {
      const r = v & 0x0f;
      if (r < 11) this.regs[r] = this.first;
    }
  }

  /** Zeilen-Ende-Verarbeitung (Line-Interrupt-Zähler). */
  endLine(line: number) {
    if (line <= 192) {
      if (this.lineCounter === 0) {
        this.lineCounter = this.regs[10];
        this.lineIrq = true;
      } else this.lineCounter--;
    } else this.lineCounter = this.regs[10];
  }

  startFrame() {
    this.vScrollLatch = this.regs[9];
  }

  renderLine(y: number) {
    const fb = this.frame;
    const base = y * 256;
    const backdrop = this.rgba[this.cram[16 + (this.regs[7] & 15)]];
    if (!(this.regs[1] & 0x40)) {
      fb.fill(backdrop, base, base + 256);
      return;
    }
    const vram = this.vram, cram = this.cram, rgba = this.rgba;
    const ntBase = (this.regs[2] & 0x0e) << 10;
    const lockTop = (this.regs[0] & 0x40) !== 0 && y < 16;
    const hScroll = lockTop ? 0 : this.regs[8];
    const lockRight = (this.regs[0] & 0x80) !== 0;
    const prio = new Uint8Array(256);
    const bgIdx = new Uint8Array(256);

    for (let sx = 0; sx < 256; sx++) {
      const vs = lockRight && sx >= 192 ? 0 : this.vScrollLatch;
      const row = (y + vs) % 224;
      const col = ((sx - hScroll) & 0xff);
      const ntAddr = ntBase + ((row >> 3) * 32 + (col >> 3)) * 2;
      const lo = vram[ntAddr], hi = vram[ntAddr + 1];
      const tile = lo | ((hi & 1) << 8);
      const hf = hi & 2, vf = hi & 4, pal = (hi & 8) ? 16 : 0;
      let ty = row & 7; if (vf) ty = 7 - ty;
      let tx = col & 7; if (hf) tx = 7 - tx;
      const ta = (tile * 32 + ty * 4) & 0x3fff;
      const bit = 7 - tx;
      const c = ((vram[ta] >> bit) & 1) | (((vram[ta + 1] >> bit) & 1) << 1) |
        (((vram[ta + 2] >> bit) & 1) << 2) | (((vram[ta + 3] >> bit) & 1) << 3);
      bgIdx[sx] = c;
      prio[sx] = (hi & 0x10) && c !== 0 ? 1 : 0;
      fb[base + sx] = rgba[cram[pal + c]];
    }

    // Sprites
    const satBase = (this.regs[5] & 0x7e) << 7;
    const tall = (this.regs[1] & 2) !== 0;
    const h = tall ? 16 : 8;
    const tileBase = (this.regs[6] & 4) ? 256 : 0;
    const shift = (this.regs[0] & 8) ? 8 : 0;
    const drawn = new Uint8Array(256);
    let count = 0;
    for (let i = 0; i < 64; i++) {
      const sy = vram[satBase + i];
      if (sy === 0xd0) break;
      const dy = (y - ((sy + 1) & 0xff)) & 0xff;
      if (dy >= h) continue;
      if (++count > 8) { this.status |= 0x40; break; }
      const sxp = vram[satBase + 0x80 + i * 2] - shift;
      let t = vram[satBase + 0x81 + i * 2];
      if (tall) t &= 0xfe;
      const ta = (((tileBase + t) * 32) + dy * 4) & 0x3fff;
      for (let px = 0; px < 8; px++) {
        const x = sxp + px;
        if (x < 0 || x > 255) continue;
        const bit = 7 - px;
        const c = ((vram[ta] >> bit) & 1) | (((vram[ta + 1] >> bit) & 1) << 1) |
          (((vram[ta + 2] >> bit) & 1) << 2) | (((vram[ta + 3] >> bit) & 1) << 3);
        if (c === 0) continue;
        if (drawn[x]) { this.status |= 0x20; continue; }
        drawn[x] = 1;
        if (!prio[x]) fb[base + x] = rgba[cram[16 + c]];
      }
    }
    if (this.regs[0] & 0x20) fb.fill(backdrop, base, base + 8);
  }
}
