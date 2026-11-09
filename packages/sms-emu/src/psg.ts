// SN76489 PSG: 3 Rechteckkanäle + Rauschen
const CLOCK = 3579545 / 16;
// 2 dB pro Dämpfungsstufe, 15 = stumm
const VOL = Array.from({ length: 16 }, (_, i) => (i === 15 ? 0 : Math.pow(10, (-2 * i) / 20)));

export class PSG {
  /** [Periode0, Dämpfung0, Periode1, Dämpfung1, Periode2, Dämpfung2, Rauschsteuerung, Dämpfung3] */
  regs = [0, 15, 0, 15, 0, 15, 0, 15];
  private latch = 0;
  private count = [0, 0, 0, 0];
  private out = [1, 1, 1, 1];
  private lfsr = 0x8000;

  write(v: number) {
    if (v & 0x80) {
      this.latch = (v >> 4) & 7;
      const r = this.latch;
      if (r % 2 === 0 && r < 6) this.regs[r] = (this.regs[r] & 0x3f0) | (v & 0x0f);
      else this.regs[r] = v & 0x0f;
      if (r === 6) this.lfsr = 0x8000;
    } else {
      const r = this.latch;
      if (r % 2 === 0 && r < 6) this.regs[r] = (this.regs[r] & 0x0f) | ((v & 0x3f) << 4);
      else { this.regs[r] = v & 0x0f; if (r === 6) this.lfsr = 0x8000; }
    }
  }

  render(n: number, rate: number): Float32Array {
    const buf = new Float32Array(n);
    const step = CLOCK / rate;
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let c = 0; c < 3; c++) {
        const p = this.regs[c * 2];
        if (p <= 1) { s += VOL[this.regs[c * 2 + 1]]; continue; } // Periode 0/1 = Gleichspannung
        this.count[c] -= step;
        while (this.count[c] <= 0) { this.count[c] += p; this.out[c] ^= 1; }
        s += this.out[c] ? VOL[this.regs[c * 2 + 1]] : -VOL[this.regs[c * 2 + 1]];
      }
      const ctrl = this.regs[6];
      const np = (ctrl & 3) === 3 ? Math.max(1, this.regs[4]) : 0x10 << (ctrl & 3);
      this.count[3] -= step;
      while (this.count[3] <= 0) {
        this.count[3] += np;
        this.out[3] ^= 1;
        if (this.out[3]) {
          const fb = ctrl & 4 ? (this.lfsr ^ (this.lfsr >> 3)) & 1 : this.lfsr & 1;
          this.lfsr = (this.lfsr >> 1) | (fb << 15);
        }
      }
      s += this.lfsr & 1 ? VOL[this.regs[7]] : -VOL[this.regs[7]];
      buf[i] = s * 0.2;
    }
    return buf;
  }
}
