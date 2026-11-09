import { Z80, type Hal } from 'z80-emulator';
import { VDP } from './vdp';
import { PSG } from './psg';

export const BTN = { up: 1, down: 2, left: 4, right: 8, b1: 16, b2: 32 } as const;

const CYCLES_PER_LINE = 228;
const LINES = 262;

/** Sega Master System: Z80 + VDP + PSG + Sega-Mapper + Joypad. */
export class SMS implements Hal {
  tStateCount = 0;
  readonly cpu: Z80;
  readonly vdp = new VDP();
  readonly psg = new PSG();
  readonly ram = new Uint8Array(0x2000);
  private rom: Uint8Array;
  private bankCount: number;
  private slots = [0, 1, 2];
  /** aktiv gedrückte Tasten (BTN-Bits) */
  buttons = 0;
  private pauseRequest = false;
  frameCount = 0;

  constructor(rom: Uint8Array) {
    this.rom = rom;
    this.bankCount = Math.max(1, Math.ceil(rom.length / 0x4000));
    this.cpu = new Z80(this);
    this.cpu.reset();
  }

  pause() { this.pauseRequest = true; }

  readMemory(a: number): number {
    a &= 0xffff;
    if (a < 0x400) return this.rom[a] ?? 0xff;
    if (a < 0xc000) {
      const slot = a >> 14;
      const bank = this.slots[slot] % this.bankCount;
      return this.rom[bank * 0x4000 + (a & 0x3fff)] ?? 0xff;
    }
    return this.ram[a & 0x1fff];
  }

  writeMemory(a: number, v: number): void {
    a &= 0xffff;
    if (a < 0xc000) return;
    this.ram[a & 0x1fff] = v;
    if (a >= 0xfffd) this.slots[a - 0xfffd] = v;
  }

  contendMemory(): void {}
  contendPort(): void {}

  readPort(p: number): number {
    p &= 0xff;
    if (p < 0x40) return 0xff;
    if (p < 0x80) return p & 1 ? 0 : this.vCounter();
    if (p < 0xc0) return p & 1 ? this.vdp.readStatus() : this.vdp.readData();
    if (p & 1) return 0xff;
    return ~this.buttons & 0xff;
  }

  writePort(p: number, v: number): void {
    p &= 0xff;
    if (p >= 0x40 && p < 0x80) this.psg.write(v);
    else if (p >= 0x80 && p < 0xc0) {
      if (p & 1) this.vdp.writeCtrl(v);
      else this.vdp.writeData(v);
    }
  }

  private line = 0;
  private vCounter(): number {
    const l = this.line;
    return l <= 0xda ? l : l - 6;
  }

  /** Emuliert ein komplettes Bild (262 Zeilen). */
  runFrame() {
    if (this.pauseRequest) {
      this.pauseRequest = false;
      this.cpu.nonMaskableInterrupt();
    }
    const vdp = this.vdp;
    vdp.startFrame();
    for (let line = 0; line < LINES; line++) {
      this.line = line;
      const end = this.tStateCount + CYCLES_PER_LINE;
      while (this.tStateCount < end) {
        if (vdp.irq) this.cpu.maskableInterrupt();
        this.cpu.step();
      }
      if (line < 192) vdp.renderLine(line);
      if (line === 192) vdp.status |= 0x80;
      vdp.endLine(line);
    }
    this.frameCount++;
  }
}
