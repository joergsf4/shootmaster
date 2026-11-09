// Assembliert engine/src/main.asm → engine/dist/engine.bin (+ Listing) und packages/sms-core/src/generated/engine.ts
import { Asm } from 'z80-asm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(dir, 'src', 'main.asm');
const asm = new Asm((p) => {
  try { return fs.readFileSync(path.resolve(path.dirname(src), p), 'utf8').split(/\r?\n/); } catch { return undefined; }
});
asm.assembleFile(src);

const bin = new Uint8Array(0x4000);
let errors = 0, end = 0;
const listing = [];
for (const l of asm.assembledLines) {
  if (l.error) { errors++; console.error(`Zeile ${l.lineNumber}: ${l.error}\n   ${l.line}`); }
  for (let i = 0; i < l.binary.length; i++) {
    const a = l.address + i;
    if (a >= 0x4000) { console.error(`Engine überschreitet Bank 0 bei ${a.toString(16)}`); process.exit(1); }
    bin[a] = l.binary[i];
    end = Math.max(end, a + 1);
  }
  listing.push(`${l.address.toString(16).padStart(4, '0')}  ${l.binary.map((b) => b.toString(16).padStart(2, '0')).join(' ').padEnd(24)} ${l.line}`);
}
// Reichweitenprüfung relativer Sprünge (der Assembler meldet Überläufe nicht)
const labels = new Map();
for (const l of asm.assembledLines) { const m = /^([A-Za-z_]\w*):/.exec(l.line); if (m) labels.set(m[1], l.address); }
for (const l of asm.assembledLines) {
  const m = /^\s+(jr|djnz)\s+(?:\w+\s*,\s*)?([A-Za-z_]\w*)\s*(;.*)?$/i.exec(l.line);
  if (!m || !labels.has(m[2])) continue;
  const d = labels.get(m[2]) - (l.address + 2);
  if (d < -128 || d > 127) { errors++; console.error(`Sprung außer Reichweite (${d}): ${l.line.trim()}`); }
}
if (errors) { console.error(`${errors} Fehler`); process.exit(1); }

const out = path.join(dir, 'dist');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'engine.bin'), bin.subarray(0, end));
fs.writeFileSync(path.join(out, 'engine.lst'), listing.join('\n'));
// Für den Editor als Base64-Modul
const editorDir = path.join(dir, '..', 'packages', 'sms-core', 'src', 'generated');
fs.mkdirSync(editorDir, { recursive: true });
fs.writeFileSync(path.join(editorDir, 'engine.ts'),
  `// automatisch erzeugt von engine/build.mjs – nicht bearbeiten\nexport const ENGINE_BASE64 = '${Buffer.from(bin.subarray(0, end)).toString('base64')}';\n`);
console.log(`Engine: ${end} Byte`);
