// Projekt → Binärdaten gemäß docs/data-format.md (Version 1)
import { encodeNameEntry, encodeTile, crop } from './hw';
import { bakePath, formationMembers } from './path';
import { periodTable, sfxBytes, songBytes } from './sound';
import {
  ACROSS, MAX_BG_TILES, MAX_SPRITE_TILES, SCREEN_H, SCREEN_W,
  type Hitbox, type Metatile, type Project, type SpriteGfx,
} from './types';

export const DATA_VERSION = 2;
export const BANK_SIZE = 0x4000;
export const SLOT1 = 0x4000;
export const SLOT2 = 0x8000;

export class CompileError extends Error {}

/** Einfacher Linker für eine 16-KB-Bank. */
class Bank {
  bytes: number[] = [];
  constructor(public base: number, public name: string, public limit = BANK_SIZE) {}
  get addr() { return this.base + this.bytes.length; }
  put(data: number[]): number {
    const a = this.addr;
    this.bytes.push(...data.map((b) => b & 0xff));
    if (this.bytes.length > this.limit) throw new CompileError(`${this.name}: Bank voll (${this.bytes.length} > ${this.limit} Byte)`);
    return a;
  }
  reserve(n: number): number { return this.put(new Array(n).fill(0)); }
  setByte(addr: number, v: number) { this.bytes[addr - this.base] = v & 0xff; }
  setWord(addr: number, v: number) { this.setByte(addr, v); this.setByte(addr + 1, v >> 8); }
  toArray(): Uint8Array { const a = new Uint8Array(BANK_SIZE); a.set(this.bytes); return a; }
}

const w = (v: number) => [v & 0xff, (v >> 8) & 0xff];
const clampB = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

export interface SpriteLayout {
  /** VRAM-Tiles ab 256 (je 32 Byte) */
  tiles: number[][];
  /** Metasprite pro Sprite/Frame: Teile (dy, dx, tile) */
  metasprites: Map<string, { dy: number; dx: number; tile: number }[][]>;
}

/** Zerlegt Sprites in 8×16-Zellen, dedupliziert, vergibt Sprite-Tiles. */
export function layoutSprites(sprites: SpriteGfx[]): SpriteLayout {
  const tiles: number[][] = [];
  const index = new Map<string, number>();
  const metasprites = new Map<string, { dy: number; dx: number; tile: number }[][]>();
  for (const s of sprites) {
    const frames = s.frames.map((px) => {
      const parts: { dy: number; dx: number; tile: number }[] = [];
      for (let cy = 0; cy < s.height; cy += 16) {
        for (let cx = 0; cx < s.width; cx += 8) {
          const top = crop(px, s.width, cx, cy, 8, 8);
          const bot = crop(px, s.width, cx, cy + 8, 8, 8);
          if (top.every((p) => p === 0) && bot.every((p) => p === 0)) continue;
          const key = top.join(',') + '|' + bot.join(',');
          let t = index.get(key);
          if (t === undefined) {
            t = tiles.length;
            tiles.push(top, bot);
            index.set(key, t);
          }
          parts.push({ dy: cy, dx: cx, tile: t });
        }
      }
      return parts;
    });
    metasprites.set(s.id, frames);
  }
  return { tiles, metasprites };
}

export interface CompileStats {
  bgTiles: number;
  spriteTiles: number;
  levelBytes: number[];
  romSize: number;
}

export interface CompiledData {
  /** Bank 1: globale Daten (Slot 2, 0x8000) */
  global: Uint8Array;
  /** Bank 2: BG-Tiles; Bank 3+: Level */
  banks: Uint8Array[];
  stats: CompileStats;
}

export interface CompileOptions {
  /** Soundtest-ROM: spielt nur einen Song oder Effekt, ohne Spiel */
  soundTest?: { song: string } | { sfx: string };
}

export function compileProject(p: Project, opts: CompileOptions = {}): CompiledData {
  if (p.levels.length === 0) throw new CompileError('Projekt hat kein Level');
  if (p.tiles.length > MAX_BG_TILES) throw new CompileError(`Zu viele BG-Tiles: ${p.tiles.length} > ${MAX_BG_TILES}`);
  const spriteById = new Map(p.sprites.map((s) => [s.id, s]));
  const need = (id: string, what: string) => {
    const s = spriteById.get(id);
    if (!s) throw new CompileError(`${what}: Sprite „${id}“ fehlt`);
    return s;
  };

  // ---------- Sprites ----------
  const layout = layoutSprites(p.sprites);
  if (layout.tiles.length > MAX_SPRITE_TILES)
    throw new CompileError(`Zu viele Sprite-Tiles: ${layout.tiles.length} > ${MAX_SPRITE_TILES}`);

  // ---------- Bank 1: Global ----------
  const g = new Bank(SLOT2, 'Globale Daten', BANK_SIZE - 16); // letzte 16 Byte = ROM-Header
  g.put([0x53, 0x48, 0x4d, 0x50, DATA_VERSION, p.levels.length, 0, 0]); // 00..07
  g.put(padPalette(p.palettes.sprite, true)); // 08..17
  const H_SPR_COUNT = g.reserve(2); // 18
  const H_SPR_PTR = g.reserve(2); // 1A
  const H_LEVELS = g.reserve(2); // 1C
  const H_PLAYER = g.reserve(2); // 1E
  const H_ETYPES = g.reserve(2); // 20
  const H_EXPL = g.reserve(2); // 22
  const H_SONGS = g.reserve(2); // 24
  const H_SFX = g.reserve(2); // 26
  const H_PERIODS = g.reserve(2); // 28
  const H_SOUNDS = g.reserve(3); // 2A..2C Schuss, Explosion, Treffer
  const H_TEST = g.reserve(1); // 2D Soundtest
  g.reserve(2);

  g.setWord(H_SPR_COUNT, layout.tiles.length);
  g.setWord(H_SPR_PTR, g.put(layout.tiles.flatMap(encodeTile)));

  // Metasprites + Animationen
  const animAddr = new Map<string, number>();
  for (const s of p.sprites) {
    const frames = layout.metasprites.get(s.id)!;
    const msAddrs = frames.map((parts) =>
      g.put([parts.length, ...parts.flatMap((q) => [q.dy, q.dx, q.tile])]),
    );
    animAddr.set(s.id, g.put([frames.length, clampB(Math.max(1, s.frameDelay)), ...msAddrs.flatMap(w)]));
  }

  // Spieler
  const pl = p.player;
  const ps = need(pl.spriteId, 'Spieler');
  need(pl.shotSpriteId, 'Spielerschuss');
  const hb = (h: Hitbox) => [h.x, h.y, h.w, h.h].map(clampB);
  g.setWord(H_PLAYER, g.put([
    clampB(pl.speed), ...hb(pl.hitbox),
    8, SCREEN_W - ps.width, 0, SCREEN_H - ps.height,
    ...w(animAddr.get(pl.spriteId)!), ...w(animAddr.get(pl.shotSpriteId)!),
    clampB(pl.shotSpeed), ...hb(pl.shotHitbox), clampB(Math.max(1, pl.fireRate)),
    pl.shotOffset.x & 0xff, pl.shotOffset.y & 0xff, clampB(Math.max(1, pl.lives)),
  ]));

  // Gegnertypen (je 16 Byte)
  const typeIndex = new Map<string, number>();
  const typeBytes: number[] = [];
  p.enemyTypes.forEach((t, i) => {
    need(t.spriteId, `Gegnertyp ${t.name}`);
    typeIndex.set(t.id, i);
    const rec = [clampB(Math.max(1, t.hp)), ...hb(t.hitbox), ...w(animAddr.get(t.spriteId)!), clampB(t.score)];
    typeBytes.push(...rec, ...new Array(16 - rec.length).fill(0));
  });
  g.setWord(H_ETYPES, g.put(typeBytes.length ? typeBytes : new Array(16).fill(0)));
  need(p.explosionSpriteId, 'Explosion');
  g.setWord(H_EXPL, animAddr.get(p.explosionSpriteId)!);

  // Sound
  const songIdx = new Map(p.songs.map((s, i) => [s.id, i]));
  const sfxIdx = new Map(p.sfx.map((s, i) => [s.id, i]));
  if (p.songs.length > 127 || p.sfx.length > 127) throw new CompileError('Höchstens 127 Songs bzw. Effekte');
  g.setWord(H_PERIODS, g.put(periodTable().flatMap(w)));
  const songAddrs = p.songs.map((s) => g.put(songBytes(s)));
  g.setWord(H_SONGS, g.put(songAddrs.flatMap(w).concat([0, 0])));
  const sfxAddrs = p.sfx.map((s) => g.put(sfxBytes(s)));
  g.setWord(H_SFX, g.put(sfxAddrs.flatMap(w).concat([0, 0])));
  const sfxRef = (id: string) => sfxIdx.get(id) ?? 0xff;
  [p.sounds.shot, p.sounds.explosion, p.sounds.hit].forEach((id, i) => g.setByte(H_SOUNDS + i, sfxRef(id)));
  const t = opts.soundTest;
  if (t) {
    const i = 'song' in t ? songIdx.get(t.song) : sfxIdx.get(t.sfx);
    if (i === undefined) throw new CompileError('Soundtest: Song/Effekt fehlt');
    g.setByte(H_TEST, 'song' in t ? 1 + i : 0x80 | i);
  }

  // ---------- Bank 2: BG-Tiles ----------
  const tb = new Bank(SLOT1, 'BG-Tiles');
  const tilesPtr = tb.put(p.tiles.flatMap(encodeTile));
  const TILE_BANK = 2;

  // ---------- Bank 3+: Level ----------
  const formIdx = new Map(p.formations.map((f, i) => [f.id, i]));
  const levelBanks: Bank[] = [];
  const levelBytes: number[] = [];
  p.levels.forEach((lv) => {
    const b = new Bank(SLOT1, `Level „${lv.name}“`);
    const across = ACROSS[lv.orientation];
    const len = Math.max(1, lv.length);
    const camMax = Math.max(0, len * 16 - (lv.orientation === 'h' ? SCREEN_W : SCREEN_H));
    const speed = Math.max(0, Math.min(0x7f, Math.round(lv.speed * 16)));
    b.put([lv.orientation === 'h' ? 0 : 1, ...w(len), speed]); // 00..03
    b.put(padPalette(p.palettes.bg, false)); // 04..13
    const L_MT = b.reserve(2), L_MAP = b.reserve(2), L_EV = b.reserve(2), L_FORM = b.reserve(2); // 14..1B
    b.put([TILE_BANK, ...w(tilesPtr), ...w(p.tiles.length)]); // 1C..20
    b.put(w(camMax)); // 21
    const startPos = lv.orientation === 'h' ? [32, 88] : [120, 160];
    b.put(startPos); // 23,24
    b.put([songIdx.get(lv.musicId ?? '') ?? 0xff]); // 25
    b.reserve(10);

    // Metatiles
    const mt: Metatile[] = p.metatiles.length ? p.metatiles : [{ tiles: [{ tile: 0 }, { tile: 0 }, { tile: 0 }, { tile: 0 }] }];
    if (mt.length > 256) throw new CompileError('Mehr als 256 Metatiles');
    b.setWord(L_MT, b.put(mt.flatMap((m) => m.tiles.flatMap((t) => encodeNameEntry({ tile: t.tile, hflip: t.hflip, vflip: t.vflip, priority: t.priority })))));

    // Karte
    const map: number[] = [];
    for (let i = 0; i < len * across; i++) map.push((lv.map[i] ?? 0) % mt.length);
    b.setWord(L_MAP, b.put(map));

    // Formationen dieses Levels
    const used = [...new Set(lv.events.map((e) => e.formationId).filter((id) => formIdx.has(id)))];
    const local = new Map(used.map((id, i) => [id, i]));
    const formAddrs = used.map((id) => {
      const f = p.formations[formIdx.get(id)!];
      const t = typeIndex.get(f.enemyTypeId);
      if (t === undefined) throw new CompileError(`Formation „${f.name}“: Gegnertyp fehlt`);
      if (f.points.length < 2) throw new CompileError(`Formation „${f.name}“: Pfad braucht mind. 2 Punkte`);
      const baked = bakePath(f.points, f.speed);
      const pathAddr = b.put(baked.bytes);
      const mem = formationMembers(f);
      // Pfadpunkte bezeichnen die Sprite-Mitte
      const es = spriteById.get(p.enemyTypes[t].spriteId)!;
      const sx = baked.start.x - (es.width >> 1), sy = baked.start.y - (es.height >> 1);
      return b.put([t, ...w(sx), ...w(sy), ...w(pathAddr), mem.length,
        ...mem.flatMap((m) => [m.delay, m.dx, m.dy])]);
    });
    b.setWord(L_FORM, b.put(formAddrs.flatMap(w).concat(formAddrs.length ? [] : [0, 0])));

    // Ereignisse
    const ev = lv.events
      .filter((e) => local.has(e.formationId))
      .sort((a, c) => a.pos - c.pos)
      .flatMap((e) => [...w(Math.max(0, Math.min(camMax, Math.round(e.pos)))), 1, local.get(e.formationId)!]);
    b.setWord(L_EV, b.put([...ev, 0xff, 0xff, 0, 0]));

    levelBanks.push(b);
    levelBytes.push(b.bytes.length);
  });

  g.setWord(H_LEVELS, g.put(levelBanks.map((_, i) => 3 + i)));

  const banks = [tb.toArray(), ...levelBanks.map((b) => b.toArray())];
  return {
    global: g.toArray(),
    banks,
    stats: {
      bgTiles: p.tiles.length,
      spriteTiles: layout.tiles.length,
      levelBytes,
      romSize: 0,
    },
  };
}

function padPalette(pal: number[], spriteBlack: boolean): number[] {
  const o = Array.from({ length: 16 }, (_, i) => (pal[i] ?? 0) & 0x3f);
  if (spriteBlack) o[0] = 0; // Sprite-Farbe 0 = Backdrop (linke Maskenspalte)
  return o;
}
