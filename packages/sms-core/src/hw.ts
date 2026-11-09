// Hardware-Primitive des Sega Master System (VDP Mode 4)

/** SMS-Farbe (--BBGGRR) → [r,g,b] 0..255 */
export function smsToRgb(c: number): [number, number, number] {
  const lv = [0, 85, 170, 255];
  return [lv[c & 3], lv[(c >> 2) & 3], lv[(c >> 4) & 3]];
}

export function smsToCss(c: number): string {
  const [r, g, b] = smsToRgb(c);
  return `rgb(${r},${g},${b})`;
}

/** Nächste SMS-Farbe zu einem RGB-Wert. */
export function rgbToSms(r: number, g: number, b: number): number {
  const q = (v: number) => Math.max(0, Math.min(3, Math.round(v / 85)));
  return q(r) | (q(g) << 2) | (q(b) << 4);
}

/** 8×8 Pixel (Index 0..15) → 32 Byte planar 4bpp. */
export function encodeTile(px: number[]): number[] {
  const out: number[] = [];
  for (let y = 0; y < 8; y++) {
    for (let p = 0; p < 4; p++) {
      let byte = 0;
      for (let x = 0; x < 8; x++) {
        if ((px[y * 8 + x] >> p) & 1) byte |= 0x80 >> x;
      }
      out.push(byte);
    }
  }
  return out;
}

export function decodeTile(bytes: ArrayLike<number>, off = 0): number[] {
  const px: number[] = new Array(64).fill(0);
  for (let y = 0; y < 8; y++) {
    for (let p = 0; p < 4; p++) {
      const b = bytes[off + y * 4 + p];
      for (let x = 0; x < 8; x++) if (b & (0x80 >> x)) px[y * 8 + x] |= 1 << p;
    }
  }
  return px;
}

export interface NameEntry { tile: number; hflip?: boolean; vflip?: boolean; palette?: number; priority?: boolean }

/** Name-Table-Eintrag als [low, high] Byte. */
export function encodeNameEntry(e: NameEntry): [number, number] {
  const hi =
    ((e.tile >> 8) & 1) |
    (e.hflip ? 0x02 : 0) |
    (e.vflip ? 0x04 : 0) |
    (e.palette ? 0x08 : 0) |
    (e.priority ? 0x10 : 0);
  return [e.tile & 0xff, hi];
}

/** Ausschnitt aus einem Pixelbild. */
export function crop(px: number[], w: number, x0: number, y0: number, cw: number, ch: number): number[] {
  const o: number[] = [];
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) o.push(px[(y0 + y) * w + x0 + x] ?? 0);
  return o;
}
