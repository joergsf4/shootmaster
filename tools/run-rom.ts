// Baut das Demo-ROM, emuliert es headless und schreibt Screenshots.
// Aufruf: pnpm tsx tools/run-rom.ts [ausgabeordner]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { buildRom, createDemoProject, engineBinary } from '../packages/sms-core/src/index';
import { SMS, BTN } from '../packages/sms-emu/src/index';

function png(rgba: Uint32Array, w: number, h: number, scale = 2): Buffer {
  const W = w * scale, H = h * scale;
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (W * 4 + 1)] = 0;
    for (let x = 0; x < W; x++) {
      const c = rgba[Math.floor(y / scale) * w + Math.floor(x / scale)];
      const o = y * (W * 4 + 1) + 1 + x * 4;
      raw[o] = c & 0xff; raw[o + 1] = (c >> 8) & 0xff; raw[o + 2] = (c >> 16) & 0xff; raw[o + 3] = 0xff;
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const out = process.argv[2] ?? 'tmp-shots';
fs.mkdirSync(out, { recursive: true });
const project = createDemoProject();
const levelArg = process.env.LEVEL ? Number(process.env.LEVEL) : 0;
if (levelArg) project.levels = [project.levels[levelArg], ...project.levels.filter((_, i) => i !== levelArg)];
const { rom, data } = buildRom(engineBinary(), project);
fs.writeFileSync(path.join(out, 'demo.sms'), rom);
console.log('ROM', rom.length, 'Byte; Stats', JSON.stringify(data.stats));

const sms = new SMS(rom);
const shots = (process.env.SHOTS ?? '10,120,300,600').split(',').map(Number);
const last = Math.max(...shots);
for (let f = 1; f <= last; f++) {
  // Skript: Spieler bewegt sich auf/ab und feuert
  sms.buttons = BTN.b1 | ((f >> 6) & 1 ? BTN.up : BTN.down) | (f % 400 < 20 ? BTN.right : 0);
  sms.runFrame();
  if (shots.includes(f)) {
    fs.writeFileSync(path.join(out, `frame-${String(f).padStart(5, '0')}.png`), png(sms.vdp.frame, 256, 192));
    const r = sms.ram;
    console.log(`frame ${f}: pc=${sms.cpu.regs.pc.toString(16)} cam=${r[6] | (r[7] << 8)} lives=${r[0x1e]} sprites=${r[0x1c]} enemies=${[...Array(12)].map((_, i) => r[0x200 + i * 16]).join('')}`);
  }
}
