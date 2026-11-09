// PSG-Hilfen: Notenperioden, Effekt-Backen, Song-Bytes (Format: docs/data-format.md)
import type { Sfx, Song } from './types';

export const PSG_CLOCK = 3579545;
/** Tonumfang: C3 … B6 (10-Bit-Periode reicht bis ~109 Hz hinab) */
export const NOTE_COUNT = 48;
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'H'];

export const noteName = (n: number) => `${NAMES[n % 12]}${3 + Math.floor(n / 12)}`;
export const noteHz = (n: number) => 440 * Math.pow(2, (n + 48 - 69) / 12);
export const hzToPeriod = (hz: number) => Math.max(1, Math.min(1023, Math.round(PSG_CLOCK / (32 * hz))));
export const periodTable = () => Array.from({ length: NOTE_COUNT }, (_, n) => hzToPeriod(noteHz(n)));

export const NOISE_MODES = ['Periodisch hoch', 'Periodisch mittel', 'Periodisch tief', 'Periodisch (Kanal 3)', 'Rauschen hoch', 'Rauschen mittel', 'Rauschen tief', 'Rauschen (Kanal 3)'];

/** Pro Frame: [Periode/Rauschmodus, Dämpfung 0..15] */
export function sfxFrames(s: Sfx): { value: number; att: number }[] {
  const n = Math.max(1, Math.min(255, Math.round(s.frames)));
  return Array.from({ length: n }, (_, i) => {
    const t = n > 1 ? i / (n - 1) : 0;
    const vol = Math.round(s.volStart + (s.volEnd - s.volStart) * t);
    // exponentieller Frequenzverlauf klingt gleichmäßig
    const hz = s.startHz * Math.pow(Math.max(1, s.endHz) / Math.max(1, s.startHz), t);
    return { value: s.noise ? s.noiseMode & 7 : hzToPeriod(hz), att: 15 - Math.max(0, Math.min(15, vol)) };
  });
}

export function sfxBytes(s: Sfx): number[] {
  const f = sfxFrames(s);
  return [s.noise ? 3 : 2, f.length, ...f.flatMap((x) => [x.value & 0xff, x.value >> 8, x.att])];
}

export function songBytes(s: Song): number[] {
  const len = Math.max(1, Math.min(255, s.length));
  const ch = [0, 1, 2, 3].map((c) => s.channels[c] ?? { volume: 0, decay: 0, steps: [] });
  return [
    Math.max(1, Math.min(255, s.tempo)), len,
    ...ch.flatMap((c) => [Math.max(0, Math.min(15, c.volume)), Math.max(0, Math.min(255, c.decay))]),
    ...ch.flatMap((c, i) => Array.from({ length: len }, (_, k) => {
      const v = c.steps[k] ?? 0;
      return v < 2 ? v : Math.min(v, i === 3 ? 9 : NOTE_COUNT + 1);
    })),
  ];
}
