// Mitgeliefertes Beispielprojekt (prozedural erzeugte Grafik)
import type { Formation, Level, Metatile, Project, Sfx, Song, SpriteGfx, TileRef } from './types';

type Px = number[];
const img = (w: number, h: number, f: (x: number, y: number) => number): Px => {
  const o: Px = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) o.push(f(x, y));
  return o;
};
const rnd = (seed: number) => () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

// --- Paletten (--BBGGRR) ---
const BG = [0x10, 0x3f, 0x2a, 0x15, 0x04, 0x08, 0x19, 0x0e, 0x24, 0x34, 0x20, 0x05, 0x01, 0x14, 0x39, 0x00];
// 0 Weltraum, 1 weiß, 2 hellgrau, 3 grau, 4 dunkelgrün, 5 grün, 6 oliv, 7 hellgrün, 8 blau, 9 hellblau, 10 dunkelblau, 11 braun, 12 dunkelrot, 13 graublau, 14 cyan
const SPR = [0x00, 0x3f, 0x2a, 0x15, 0x03, 0x0b, 0x0f, 0x3c, 0x30, 0x0c, 0x08, 0x33, 0x23, 0x02, 0x2f, 0x01];
// 1 weiß, 2 hellgrau, 3 grau, 4 rot, 5 orange, 6 gelb, 7 cyan, 8 blau, 9 grün, 10 dunkelgrün, 11 lila, 12 pink, 13 dunkelrot, 14 hellgelb

function tiles(): Px[] {
  const t: Px[] = [];
  t.push(img(8, 8, () => 0)); // 0 leer
  t.push(img(8, 8, (x, y) => (x === 3 && y === 2 ? 1 : 0))); // 1 Stern
  t.push(img(8, 8, (x, y) => (x === 6 && y === 5 ? 2 : x === 1 && y === 6 ? 3 : 0))); // 2 Sterne schwach
  t.push(img(8, 8, (x, y) => ((x === 4 && y >= 2 && y <= 6) || (y === 4 && x >= 2 && x <= 6) ? (x === 4 && y === 4 ? 1 : 14) : 0))); // 3 Funkelstern
  // 4 Boden-Oberkante, 5 Boden, 6 Boden mit Stein
  t.push(img(8, 8, (x, y) => (y < 2 ? 7 : y < 3 ? 5 : (x + y) % 5 === 0 ? 6 : 4)));
  t.push(img(8, 8, (x, y) => ((x * 3 + y * 5) % 7 === 0 ? 6 : (x + y * 2) % 9 === 0 ? 11 : 4)));
  t.push(img(8, 8, (x, y) => { const d = (x - 3.5) ** 2 + (y - 3.5) ** 2; return d < 6 ? (x + y < 6 ? 2 : 3) : (x * 3 + y * 5) % 7 === 0 ? 6 : 4; }));
  // 7..10 Asteroid 16×16 (TL, TR, BL, BR)
  const ast = (ox: number, oy: number) => img(8, 8, (x, y) => {
    const X = x + ox, Y = y + oy, d = Math.hypot(X - 7.5, Y - 7.5);
    const crater = Math.hypot(X - 10, Y - 5) < 2.2 || Math.hypot(X - 5, Y - 10) < 1.6;
    if (d > 7.2) return 0;
    if (crater) return 13;
    return d > 6 ? 13 : X + Y < 12 ? 2 : 3;
  });
  t.push(ast(0, 0), ast(8, 0), ast(0, 8), ast(8, 8));
  // 11 Metallplatte, 12 Platte mit Licht
  t.push(img(8, 8, (x, y) => (x === 0 || y === 0 ? 9 : x === 7 || y === 7 ? 10 : 8)));
  t.push(img(8, 8, (x, y) => (x === 0 || y === 0 ? 9 : x === 7 || y === 7 ? 10 : x >= 3 && x <= 4 && y >= 3 && y <= 4 ? 14 : 8)));
  // 13 Nebel
  const r = rnd(7);
  t.push(img(8, 8, () => (r() < 0.25 ? 10 : 0)));
  return t;
}

/** 4 Kachelverweise → 16×16-Pixelbild (auch für alte Projekte im Format 1). */
function refsToPixels(tiles: number[][], refs: TileRef[]): number[] {
  const out = new Array(256).fill(0);
  refs.forEach((ref, q) => {
    const t = tiles[ref.tile] ?? [];
    const ox = (q & 1) * 8, oy = (q >> 1) * 8;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++)
      out[(oy + y) * 16 + ox + x] = t[(ref.vflip ? 7 - y : y) * 8 + (ref.hflip ? 7 - x : x)] ?? 0;
  });
  return out;
}

const T = tiles();
const mt = (a: number, b: number, c: number, d: number): Metatile =>
  ({ pixels: refsToPixels(T, [{ tile: a }, { tile: b }, { tile: c }, { tile: d }]) });

function metatiles(): Metatile[] {
  return [
    mt(0, 0, 0, 0), // 0 Weltraum
    mt(1, 0, 0, 2), // 1 Sterne
    mt(0, 2, 3, 0), // 2 Sterne
    { ...mt(4, 4, 5, 5), solid: true }, // 3 Boden-Oberkante
    { ...mt(5, 6, 6, 5), solid: true }, // 4 Boden
    { ...mt(7, 8, 9, 10), solid: true }, // 5 Asteroid
    { ...mt(11, 12, 12, 11), solid: true }, // 6 Metall
    mt(13, 0, 0, 13), // 7 Nebel
  ];
}

function sprite(id: string, name: string, w: number, h: number, frames: Px[], frameDelay = 8): SpriteGfx {
  return { id, name, width: w, height: h, frames, frameDelay };
}

function sprites(): SpriteGfx[] {
  // Spieler: Raumgleiter (zeigt nach rechts)
  const ship = (flame: number) => img(16, 16, (x, y) => {
    const cy = Math.abs(y - 7.5);
    if (x < 3 && cy < 2 && x >= 3 - flame) return x < 1 ? 4 : 6;
    if (x >= 3 && x <= 13 && cy < (13 - x) * 0.55 + 1.2) {
      if (cy < 1.2 && x >= 8 && x <= 10) return 7;
      if (x >= 4 && x <= 6 && cy > 3) return 4;
      return cy < 2 ? 1 : 2;
    }
    if (x >= 4 && x <= 8 && cy >= 4 && cy < 7) return 3;
    return 0;
  });
  const shot = img(8, 16, (x, y) => (y >= 6 && y <= 9 ? (x >= 1 && x <= 6 ? (x >= 3 ? 1 : 6) : 0) : 0));
  const drone = (f: number) => img(16, 16, (x, y) => {
    const d = Math.abs(x - 7.5) + Math.abs(y - 7.5);
    if (d < 3) return f ? 6 : 5;
    if (d < 7) return Math.abs(x - 7.5) < 1 || Math.abs(y - 7.5) < 1 ? 13 : 4;
    if (d < 8) return 3;
    return 0;
  });
  const bug = (f: number) => img(16, 16, (x, y) => {
    const dx = x - 7.5, dy = y - 7.5;
    if (Math.hypot(dx, dy * 1.3) < 5) return Math.hypot(dx + 2, dy + 1) < 1.6 ? 1 : 9;
    const wing = f ? Math.abs(dy) > 4 && Math.abs(dy) < 8 && Math.abs(dx) < 4 : Math.abs(dx) > 4 && Math.abs(dx) < 8 && Math.abs(dy) < 4;
    return wing ? 11 : 0;
  });
  const boom = (r: number) => img(16, 16, (x, y) => {
    const d = Math.hypot(x - 7.5, y - 7.5);
    if (d > r) return 0;
    if (d > r - 1.5) return 4;
    if (d > r - 3) return 5;
    return r > 6 ? 0 : 6;
  });
  return [
    sprite('ship', 'Raumgleiter', 16, 16, [ship(2), ship(3)], 4),
    sprite('shot', 'Laser', 8, 16, [shot], 8),
    sprite('drone', 'Drohne', 16, 16, [drone(0), drone(1)], 8),
    sprite('bug', 'Käfer', 16, 16, [bug(0), bug(1)], 6),
    sprite('boom', 'Explosion', 16, 16, [boom(3), boom(5), boom(7), boom(8)], 5),
  ];
}

function levelH(): Level {
  const len = 80, across = 12, map: number[] = [];
  const r = rnd(42);
  for (let c = 0; c < len; c++) {
    const ground = 10 + (Math.sin(c / 5) > 0.6 ? -1 : 0);
    for (let row = 0; row < across; row++) {
      let m = r() < 0.12 ? 1 : r() < 0.06 ? 2 : r() < 0.03 ? 7 : 0;
      if (row === ground) m = 3;
      if (row > ground) m = 4;
      if (row === 2 && c % 23 === 11) m = 5;
      if (c > 60 && c < 70 && row === 0) m = 6;
      map.push(m);
    }
  }
  return {
    id: 'lvl-h', name: 'Orbit', orientation: 'h', length: len, speed: 0.5, map,
    events: [
      { pos: 40, formationId: 'f-wave' },
      { pos: 260, formationId: 'f-v' },
      { pos: 420, formationId: 'f-wave-low' },
      { pos: 600, formationId: 'f-loop' },
      { pos: 820, formationId: 'f-v' },
      { pos: 900, formationId: 'f-wave' },
    ],
  };
}

function levelV(): Level {
  const len = 60, across = 16, map: number[] = [];
  const r = rnd(9);
  for (let row = 0; row < len; row++) {
    for (let c = 0; c < across; c++) {
      let m = r() < 0.1 ? 1 : r() < 0.05 ? 2 : r() < 0.04 ? 7 : 0;
      if ((c === 0 || c === 15) && row % 7 < 3) m = 6;
      if (row % 9 === 4 && c === (row * 5) % 14 + 1) m = 5;
      map.push(m);
    }
  }
  return {
    id: 'lvl-v', name: 'Asteroidenfeld', orientation: 'v', length: len, speed: 0.5, map,
    events: [
      { pos: 30, formationId: 'f-dive' },
      { pos: 220, formationId: 'f-dive-r' },
      { pos: 400, formationId: 'f-v-down' },
      { pos: 560, formationId: 'f-dive' },
      { pos: 640, formationId: 'f-dive-r' },
    ],
  };
}

function formations(): Formation[] {
  const chain = (id: string, name: string, enemyTypeId: string, points: { x: number; y: number }[], count = 5, spacing = 14, speed = 1.5): Formation =>
    ({ id, name, enemyTypeId, points, speed, mode: 'chain', count, spacing, offsets: [] });
  return [
    chain('f-wave', 'Welle oben', 'e-drone', [{ x: 264, y: 30 }, { x: 200, y: 70 }, { x: 140, y: 30 }, { x: 80, y: 70 }, { x: 20, y: 30 }, { x: -40, y: 60 }]),
    chain('f-wave-low', 'Welle unten', 'e-drone', [{ x: 264, y: 130 }, { x: 200, y: 90 }, { x: 140, y: 130 }, { x: 80, y: 90 }, { x: -40, y: 110 }]),
    chain('f-loop', 'Looping', 'e-bug', [{ x: 264, y: 100 }, { x: 150, y: 100 }, { x: 110, y: 50 }, { x: 150, y: 20 }, { x: 190, y: 50 }, { x: 150, y: 100 }, { x: -40, y: 100 }], 6, 12, 2),
    { id: 'f-v', name: 'V-Formation', enemyTypeId: 'e-bug', points: [{ x: 264, y: 70 }, { x: -60, y: 70 }], speed: 1.25, mode: 'block', count: 5, spacing: 0,
      offsets: [{ x: 0, y: 0 }, { x: 18, y: -18 }, { x: 18, y: 18 }, { x: 36, y: -36 }, { x: 36, y: 36 }] },
    chain('f-dive', 'Sturzflug links', 'e-drone', [{ x: 40, y: -20 }, { x: 60, y: 90 }, { x: 140, y: 120 }, { x: 270, y: 60 }], 5, 12, 1.75),
    chain('f-dive-r', 'Sturzflug rechts', 'e-bug', [{ x: 200, y: -20 }, { x: 180, y: 90 }, { x: 100, y: 120 }, { x: -30, y: 60 }], 5, 12, 1.75),
    { id: 'f-v-down', name: 'Pfeil abwärts', enemyTypeId: 'e-drone', points: [{ x: 120, y: -20 }, { x: 120, y: 220 }], speed: 1, mode: 'block', count: 5, spacing: 0,
      offsets: [{ x: 0, y: 0 }, { x: -24, y: -16 }, { x: 24, y: -16 }, { x: -48, y: -32 }, { x: 48, y: -32 }] },
  ];
}

// Noten als Text: "C5 . D#5 -" → . = halten, - = aus (Ton: ab C3; Rauschen: k/s/h)
const N = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'H'];
const seq = (s: string) => s.trim().split(/\s+/).map((t) => {
  if (t === '.') return 0;
  if (t === '-') return 1;
  if (t === 'k') return 2 + 6; // Rauschen tief
  if (t === 's') return 2 + 5; // Rauschen mittel
  if (t === 'h') return 2 + 4; // Rauschen hoch
  const m = /^([A-H]#?)(\d)$/.exec(t)!;
  return 2 + N.indexOf(m[1]) + (Number(m[2]) - 3) * 12;
});

function songs(): Song[] {
  const melody = seq(`C5 . D#5 . G5 . F5 D#5 D5 . A#4 . C5 . . -
                      D#5 . G5 . A#5 . G#5 G5 F5 . D5 . C5 . - .`);
  const bass = seq(`C3 . C4 . C3 . C4 . G#3 . G#3 . A#3 . A#3 .
                    C3 . C4 . C3 . C4 . G#3 . G3 . F3 . G3 .`);
  const drums = seq(`k . h . s . h . k . k . s . h h
                     k . h . s . h . k . k . s . s s`);
  return [{
    id: 'song-1', name: 'Sternenpatrouille', tempo: 8, length: 32,
    channels: [
      { volume: 12, decay: 4, steps: melody },
      { volume: 13, decay: 8, steps: bass },
      { volume: 0, decay: 0, steps: new Array(32).fill(0) },
      { volume: 10, decay: 1, steps: drums },
    ],
  }];
}

function sfx(): Sfx[] {
  return [
    { id: 'sfx-shot', name: 'Laser', noise: false, frames: 7, startHz: 1800, endHz: 500, noiseMode: 0, volStart: 13, volEnd: 4 },
    { id: 'sfx-boom', name: 'Explosion', noise: true, frames: 24, startHz: 0, endHz: 0, noiseMode: 6, volStart: 15, volEnd: 0 },
    { id: 'sfx-hit', name: 'Treffer', noise: false, frames: 36, startHz: 600, endHz: 110, noiseMode: 0, volStart: 15, volEnd: 0 },
  ];
}

/** Ergänzt Sound-Felder in Projekten, die vor dem Sound-Editor gespeichert wurden. */
export function upgradeProject(p: unknown): unknown {
  let o = p as (Omit<Partial<Project>, 'formatVersion'> & { tiles?: number[][]; formatVersion?: number }) | null;
  if (!o || typeof o !== 'object') return p;
  if (!o.songs) o = { ...o, songs: songs(), sfx: sfx(), sounds: { shot: 'sfx-shot', explosion: 'sfx-boom', hit: 'sfx-hit' } };
  // Format 1 → 2: Pinsel waren Verweise auf gemeinsame Tiles, jetzt eigenständige Bilder
  if (o.formatVersion === 1 && Array.isArray(o.tiles) && Array.isArray(o.metatiles)) {
    const tiles = o.tiles;
    const metatiles = (o.metatiles as unknown as { tiles: TileRef[] }[]).map((m) => ({
      pixels: refsToPixels(tiles, m.tiles ?? []),
      priority: m.tiles?.some((t) => t.priority) || undefined,
    }));
    const { tiles: _drop, ...rest } = o;
    o = { ...rest, formatVersion: 2, metatiles };
  }
  return o;
}

export function createDemoProject(): Project {
  return {
    formatVersion: 2,
    name: 'Demo: Sternenpatrouille',
    palettes: { bg: BG, sprite: SPR },
    metatiles: metatiles(),
    sprites: sprites(),
    explosionSpriteId: 'boom',
    player: {
      spriteId: 'ship', speed: 2, hitbox: { x: 4, y: 5, w: 8, h: 6 }, lives: 3,
      shotSpriteId: 'shot', shotSpeed: 6, shotHitbox: { x: 0, y: 5, w: 8, h: 6 }, fireRate: 8, shotOffset: { x: 12, y: 0 },
    },
    enemyTypes: [
      { id: 'e-drone', name: 'Drohne', spriteId: 'drone', hp: 1, hitbox: { x: 2, y: 2, w: 12, h: 12 }, score: 10 },
      { id: 'e-bug', name: 'Käfer', spriteId: 'bug', hp: 2, hitbox: { x: 2, y: 2, w: 12, h: 12 }, score: 20 },
    ],
    formations: formations(),
    levels: [{ ...levelH(), musicId: 'song-1' }, { ...levelV(), musicId: 'song-1' }],
    songs: songs(),
    sfx: sfx(),
    sounds: { shot: 'sfx-shot', explosion: 'sfx-boom', hit: 'sfx-hit' },
  };
}
