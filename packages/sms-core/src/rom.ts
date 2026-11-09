import { BANK_SIZE, compileProject, type CompiledData, type CompileOptions } from './compile';
import type { Project } from './types';

/** Berechnet Header (TMR SEGA) + Checksumme über 0x0000–0x7FEF. */
export function writeHeader(rom: Uint8Array) {
  const h = 0x7ff0;
  'TMR SEGA'.split('').forEach((c, i) => (rom[h + i] = c.charCodeAt(0)));
  rom[h + 8] = 0xff;
  rom[h + 9] = 0xff;
  let sum = 0;
  for (let i = 0; i < 0x7ff0; i++) sum = (sum + rom[i]) & 0xffff;
  rom[h + 10] = sum & 0xff;
  rom[h + 11] = sum >> 8;
  // Produktcode 2601 (BCD), Version 0
  rom[h + 12] = 0x01;
  rom[h + 13] = 0x26;
  rom[h + 14] = 0x00;
  rom[h + 15] = 0x4c; // Region 4 = SMS Export, Größe C = 32 KB Prüfbereich
  return sum;
}

export function linkRom(engine: Uint8Array, data: CompiledData): Uint8Array {
  if (engine.length > BANK_SIZE) throw new Error(`Engine zu groß: ${engine.length} Byte`);
  const banks = 2 + data.banks.length;
  let size = 4;
  while (size < banks) size *= 2;
  if (size > 32) throw new Error('ROM größer als 512 KB');
  const rom = new Uint8Array(size * BANK_SIZE).fill(0xff);
  rom.fill(0, 0, BANK_SIZE);
  rom.set(engine, 0);
  rom.set(data.global, BANK_SIZE);
  data.banks.forEach((b, i) => rom.set(b, (2 + i) * BANK_SIZE));
  writeHeader(rom);
  data.stats.romSize = rom.length;
  return rom;
}

export function buildRom(engine: Uint8Array, project: Project, opts?: CompileOptions): { rom: Uint8Array; data: CompiledData } {
  const data = compileProject(project, opts);
  return { rom: linkRom(engine, data), data };
}
