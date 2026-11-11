// Projekt → Binärdaten gemäß docs/data-format.md (Version 1)
import { encodeNameEntry, encodeTile, crop, flipH, flipV } from './hw';
import { bakePath, formationMembers } from './path';
import { periodTable, sfxBytes, songBytes } from './sound';
import {
  ACROSS, MAX_BG_TILES, MAX_SPRITE_TILES, SCREEN_H, SCREEN_W,
  type Hitbox, type Level, type Metatile, type Project, type SpriteGfx, type TileRef,
} from './types';

export const DATA_VERSION = 3;
export const BANK_SIZE = 0x4000;
export const SLOT1 = 0x4000;
export const SLOT2 = 0x8000;

export class CompileError extends Error {}

/** Letzte Kameraposition (Pixel): dort hält das Level an. */
export const levelCamMax = (lv: Level) => Math.max(0, Math.max(1, lv.length) * 16 - (lv.orientation === 'h' ? SCREEN_W : SCREEN_H));
/** Scrolltempo im ROM: 1/16 px pro Frame */
export const speedByte = (speed: number) => Math.max(0, Math.min(0x7f, Math.round(speed * 16))) || 0;
export const levelSpeed = (lv: Level) => speedByte(lv.speed);
/** Ereignisse in Engine-Reihenfolge: nach Position, gleiche Position in Listenreihenfolge */
export const sortedEvents = (lv: Level) => [...lv.events].sort((a, c) => a.pos - c.pos);
/** Nächstes Ereignis an derselben Position in Richtung dir (−1 früher, +1 später); −1, wenn es keins gibt */
export function stackNeighbor(lv: Level, i: number, dir: -1 | 1): number {
  for (let j = i + dir; j >= 0 && j < lv.events.length; j += dir) if (lv.events[j].pos === lv.events[i].pos) return j;
  return -1;
}
/** Was Kürzen auf n Felder kostet: abgeschnittene Spalten/Zeilen (0, wenn dort nichts gemalt ist) und Ereignisse, die ans neue Ende rücken */
export function shrinkLoss(lv: Level, n: number): { cut: number; events: number } {
  const a = ACROSS[lv.orientation];
  const painted = lv.map.slice(n * a, lv.length * a).some((v) => v);
  const camMax = levelCamMax({ ...lv, length: n });
  return { cut: painted ? Math.max(0, lv.length - n) : 0, events: lv.events.filter((e) => e.pos > camMax).length };
}
const EVENT_CODE = { spawn: 1, speed: 2, music: 3, waitClear: 4, checkpoint: 5 } as const;
const SHOT_CODE = { none: 0, straight: 1, aimed: 2, fan3: 3 } as const;

/** Sichtbare Pixel des ersten Frames (leer: ganzes Sprite) */
export function opaqueBox(s: SpriteGfx): Hitbox {
  let x0 = s.width, y0 = s.height, x1 = -1, y1 = -1;
  (s.frames[0] ?? []).forEach((c, i) => {
    if (!c) return;
    const x = i % s.width, y = Math.floor(i / s.width);
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  });
  return x1 < 0 ? { x: 0, y: 0, w: s.width, h: s.height } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
/** Schuss-Geschwindigkeit je Richtung i (i × 22,5°, 0 = rechts, 4 = unten): vx, vy in 1/256 px/Frame (8.8 mit Vorzeichen) */
export const shotVelocity = (speed: number, i: number) =>
  [Math.cos, Math.sin].map((f) => Math.max(-0x7fff, Math.min(0x7fff, Math.round(f((i * Math.PI) / 8) * speed * 256))) || 0);

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

/** Zerlegt die Pinsel in 8×8-Kacheln; gleiche und gespiegelte Kacheln werden geteilt. */
export function layoutBgTiles(metatiles: Metatile[]): { tiles: number[][]; refs: TileRef[][] } {
  const tiles: number[][] = [];
  const index = new Map<string, TileRef>();
  const refs = metatiles.map((m) => [0, 1, 2, 3].map((q) => {
    const px = crop(m.pixels, 16, (q & 1) * 8, (q >> 1) * 8, 8, 8);
    let ref = index.get(px.join(','));
    if (!ref) {
      const tile = tiles.length;
      tiles.push(px);
      const h = flipH(px);
      for (const [v, r] of [[px, { tile }], [h, { tile, hflip: true }], [flipV(px), { tile, vflip: true }], [flipV(h), { tile, hflip: true, vflip: true }]] as const)
        if (!index.has(v.join(','))) index.set(v.join(','), r);
      ref = { tile };
    }
    return { ...ref, priority: m.priority };
  }));
  return { tiles, refs };
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
  /** Test-ROM „Ab hier spielen“: Kameraposition (Pixel), an der das erste Level beginnt; frühere Ereignisse entfallen */
  startCam?: number;
  /** Test-ROM: Treffer kosten kein Leben */
  invincible?: boolean;
}

export function compileProject(p: Project, opts: CompileOptions = {}): CompiledData {
  if (p.levels.length === 0) throw new CompileError('Projekt hat kein Level');
  if (p.metatiles.length === 0) throw new CompileError('Projekt hat keinen Pinsel');
  if (p.metatiles.length > 256) throw new CompileError('Mehr als 256 Pinsel');
  const bg = layoutBgTiles(p.metatiles);
  if (bg.tiles.length > MAX_BG_TILES)
    throw new CompileError(`Die Pinsel enthalten zu viele verschiedene 8×8-Muster: ${bg.tiles.length} > ${MAX_BG_TILES}`);
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
  g.put([opts.invincible ? 1 : 0, 0]); // 2E unverwundbar, 2F reserviert

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

  // Gegnertypen (je 16 Byte) mit Schussdefinition
  const typeIndex = new Map<string, number>();
  const typeBytes: number[] = [];
  const i8 = (v: number) => Math.max(-128, Math.min(127, Math.round(v))) & 0xff;
  const center = (h: Hitbox) => [h.x + (h.w >> 1), h.y + (h.h >> 1)];
  p.enemyTypes.forEach((t, i) => {
    const es = need(t.spriteId, `Gegnertyp ${t.name}`);
    typeIndex.set(t.id, i);
    let shotAddr = 0;
    if (t.shot.pattern !== 'none') {
      const ss = need(t.shot.spriteId, `Gegnertyp ${t.name}: Schuss`);
      const box = opaqueBox(ss);
      const [pcx, pcy] = center(pl.hitbox), [scx, scy] = center(box);
      shotAddr = g.put([
        SHOT_CODE[t.shot.pattern], clampB(Math.max(1, t.shot.interval)), ...w(animAddr.get(ss.id)!), ...hb(box),
        i8((es.width >> 1) - (ss.width >> 1)), i8((es.height >> 1) - (ss.height >> 1)), // Schuss startet in der Gegnermitte
        i8(pcx - scx), i8(pcy - scy),
        ...Array.from({ length: 16 }, (_, d) => shotVelocity(t.shot.speed, d)).flat().flatMap((v) => w(v & 0xffff)),
      ]);
    }
    const rec = [clampB(Math.max(1, t.hp)), ...hb(t.hitbox), ...w(animAddr.get(t.spriteId)!), clampB(t.score), ...w(shotAddr)];
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
  const tilesPtr = tb.put(bg.tiles.flatMap(encodeTile));
  const TILE_BANK = 2;

  // ---------- Bank 3+: Level ----------
  const formIdx = new Map(p.formations.map((f, i) => [f.id, i]));
  const levelBanks: Bank[] = [];
  const levelBytes: number[] = [];
  p.levels.forEach((lv, li) => {
    const b = new Bank(SLOT1, `Level „${lv.name}“`);
    const across = ACROSS[lv.orientation];
    const len = Math.max(1, lv.length);
    const camMax = levelCamMax(lv);
    const evPos = (pos: number) => Math.max(0, Math.min(camMax, Math.round(pos)));
    const songRef = (id: string | undefined) => songIdx.get(id ?? '') ?? 0xff;
    // shortcut: startCam gilt nur für das erste Level (der Editor stellt das gewählte nach vorn); je Level erst, wenn mehrere Level versetzt starten sollen
    const startCam = li === 0 ? evPos(opts.startCam ?? 0) : 0;
    const all = sortedEvents(lv);
    const events = all.filter((e) => evPos(e.pos) >= startCam);
    // Tempo und Musik der weggelassenen Ereignisse gelten ab Start
    let speed = levelSpeed(lv), music = songRef(lv.musicId);
    for (const e of all) {
      if (evPos(e.pos) >= startCam) break;
      if (e.type === 'speed') speed = speedByte(e.speed ?? 0);
      if (e.type === 'music') music = songRef(e.musicId);
    }
    b.put([lv.orientation === 'h' ? 0 : 1, ...w(len), speed]); // 00..03
    b.put(padPalette(p.palettes.bg, false)); // 04..13
    const L_MT = b.reserve(2), L_MAP = b.reserve(2), L_EV = b.reserve(2), L_FORM = b.reserve(2); // 14..1B
    b.put([TILE_BANK, ...w(tilesPtr), ...w(bg.tiles.length)]); // 1C..20
    b.put(w(camMax)); // 21
    const startPos = lv.orientation === 'h' ? [32, 88] : [120, 160];
    b.put(startPos); // 23,24
    b.put([music]); // 25
    const L_SOLID = b.reserve(2); // 26 → je Pinsel 1 = tödlich
    b.put(w(startCam)); // 28 Startkamera
    b.reserve(6);

    // Metatiles (je 4 Name-Table-Einträge)
    const mt = p.metatiles;
    b.setWord(L_SOLID, b.put(mt.map((m) => (m.solid ? 1 : 0))));
    b.setWord(L_MT, b.put(bg.refs.flatMap((r) => r.flatMap((t) => encodeNameEntry(t)))));

    // Karte
    const map: number[] = [];
    for (let i = 0; i < len * across; i++) map.push((lv.map[i] ?? 0) % mt.length);
    b.setWord(L_MAP, b.put(map));

    // Formationen dieses Levels
    const spawns = events.filter((e) => e.type === 'spawn' && formIdx.has(e.formationId ?? ''));
    const used = [...new Set(spawns.map((e) => e.formationId!))];
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
    const param = (e: (typeof events)[number]) =>
      e.type === 'spawn' ? local.get(e.formationId!)! : e.type === 'speed' ? speedByte(e.speed ?? 0) : e.type === 'music' ? songRef(e.musicId) : 0;
    const ev = events
      .filter((e) => e.type !== 'spawn' || local.has(e.formationId ?? ''))
      .flatMap((e) => [...w(evPos(e.pos)), EVENT_CODE[e.type], param(e)]);
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
      bgTiles: bg.tiles.length,
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
