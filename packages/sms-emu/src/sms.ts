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
  /** Takte des letzten Spielbilds: Arbeit vom VBlank-IRQ bis zum nächsten halt (ohne Wartezeit im halt); > 59 736 = Bild verloren.
   *  Strecken ohne VBlank-IRQ (Pause-NMI weckt nur kurz) zählen zum folgenden Spielbild. */
  busy = 0;
  /** Maximum von busy seit Reset (nur Spielbilder, ohne Ladestrecken); zum Zurücksetzen 0 zuweisen */
  maxBusy = 0;
  /** Takte der letzten Strecke, wenn sie bei abgeschaltetem Display lief (Init, Levelaufbau), sonst 0; busy/maxBusy bleiben dann unverändert */
  loadBusy = 0;
  /** optional: Takte je PC (64 K Einträge) für Profile */
  pcCycles?: Uint32Array;
  /** optional: am Ende jedes Spielbilds bzw. jeder Ladestrecke (RAM in sich stimmig) */
  onHalt?: () => void;
  private work = 0;
  private woke = false; // VBlank-IRQ in dieser Strecke angenommen
  private load = false; // Display war in dieser Strecke aus

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
      if (p & 1) {
        this.vdp.writeCtrl(v);
        if (!(this.vdp.regs[1] & 0x40)) this.load = true; // Display aus: Ladestrecke
      } else this.vdp.writeData(v);
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
      // z80-emulator löscht beim NMI auch IFF2; echte Z80 merken IFF1 dort, sonst bleibt nach RETN der VBlank-IRQ aus
      const iff1 = this.cpu.regs.iff1;
      this.cpu.nonMaskableInterrupt();
      this.cpu.regs.iff2 = iff1;
    }
    const vdp = this.vdp, regs = this.cpu.regs;
    vdp.startFrame();
    for (let line = 0; line < LINES; line++) {
      this.line = line;
      const end = this.tStateCount + CYCLES_PER_LINE;
      while (this.tStateCount < end) {
        const t0 = this.tStateCount;
        if (vdp.irq && regs.iff1) { this.cpu.maskableInterrupt(); this.woke = true; }
        if (regs.halted) { this.cpu.step(); continue; } // wartet im halt: zählt nicht
        const pc = regs.pc;
        this.cpu.step();
        const t = this.tStateCount - t0;
        this.work += t;
        if (this.pcCycles) this.pcCycles[pc] += t;
        if (regs.halted && (this.woke || this.load)) { // gerade ins halt gegangen: Spielbild bzw. Ladestrecke fertig
          if (this.load) this.loadBusy = this.work;
          else {
            this.loadBusy = 0;
            this.busy = this.work;
            if (this.work > this.maxBusy) this.maxBusy = this.work;
          }
          this.work = 0;
          this.woke = this.load = false;
          this.onHalt?.();
        }
      }
      if (line < 192) vdp.renderLine(line);
      if (line === 192) vdp.status |= 0x80;
      vdp.endLine(line);
    }
    this.frameCount++;
  }
}
