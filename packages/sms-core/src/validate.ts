import { levelCamMax, levelSpeed, sortedEvents, speedByte } from './compile';
import { formationMembers, framePositions } from './path';
import { ACROSS, LEVEL_EVENT_TYPES, MAX_ENEMIES, SHOT_PATTERNS, type EnemyShot, type Level, type LevelEvent, type Project } from './types';

/** Prüft eine geladene Projektdatei (Vertrauensgrenze). Gibt den ersten Fehler zurück oder null. */
export function validateProject(p: unknown): string | null {
  const o = p as Partial<Project> | null;
  if (!o || typeof o !== 'object') return 'Keine Projektdatei';
  if (o.formatVersion !== 2) return 'Unbekannte Formatversion';
  if (!o.palettes || !Array.isArray(o.palettes.bg) || !Array.isArray(o.palettes.sprite)) return 'Paletten fehlen';
  for (const k of ['metatiles', 'sprites', 'enemyTypes', 'formations', 'levels', 'songs', 'sfx'] as const)
    if (!Array.isArray(o[k])) return `„${k}“ fehlt`;
  if (!o.player || typeof o.player.spriteId !== 'string') return 'Spielerdefinition fehlt';
  const badShot = (s: Partial<EnemyShot> | undefined) => !s || typeof s !== 'object' || !SHOT_PATTERNS.includes(s.pattern!)
    || !Number.isFinite(s.interval) || !Number.isFinite(s.speed) || typeof s.spriteId !== 'string';
  if (o.enemyTypes!.some((t) => !t?.id || typeof t.spriteId !== 'string' || badShot(t.shot))) return 'Ungültiger Gegnertyp';
  if (o.metatiles!.some((m) => !Array.isArray(m?.pixels) || m.pixels.length !== 256)) return 'Ungültiger Pinsel';
  if (o.sprites!.some((s) => !s?.id || !Array.isArray(s.frames) || !s.frames.length || s.frames.some((f) => f.length !== s.width * s.height)))
    return 'Ungültiges Sprite';
  if (o.formations!.some((f) => !f?.id || !Array.isArray(f.points) || !Array.isArray(f.offsets))) return 'Ungültige Formation';
  if (o.levels!.some((l) => !l?.id || (l.orientation !== 'h' && l.orientation !== 'v') || !Array.isArray(l.map) || !Array.isArray(l.events)))
    return 'Ungültiges Level';
  const badEvent = (e: Partial<LevelEvent> | null) => !e || typeof e !== 'object' || !Number.isFinite(e.pos) || !LEVEL_EVENT_TYPES.includes(e.type!)
    || (e.type === 'spawn' && typeof e.formationId !== 'string') || (e.type === 'speed' && !Number.isFinite(e.speed));
  if (o.levels!.some((l) => l.events.some(badEvent))) return 'Ungültiges Ereignis';
  if (!o.sounds || typeof o.sounds !== 'object') return 'Sound-Zuordnung fehlt';
  if (o.songs!.some((s) => !s?.id || !Array.isArray(s.channels) || s.channels.length !== 4 || s.channels.some((c) => !Array.isArray(c?.steps))))
    return 'Ungültiger Song';
  return null;
}

// ---------- Inhaltliche Prüfung (Problem-Panel) ----------

export type EditorTab = 'palette' | 'tiles' | 'sprites' | 'objects' | 'formations' | 'levels' | 'sound';
/** Sprungziel im Editor: Tab und Element-ID */
export interface DiagRef { tab: EditorTab; id?: string }
export interface Diagnostic { severity: 'error' | 'warn'; msg: string; ref: DiagRef }
/** Wer ein Element verwendet */
export interface Use { label: string; ref: DiagRef }

export function spriteUsers(p: Project, id: string): Use[] {
  const u: Use[] = [];
  if (p.player.spriteId === id) u.push({ label: 'Spieler', ref: { tab: 'objects' } });
  if (p.player.shotSpriteId === id) u.push({ label: 'Schuss', ref: { tab: 'objects' } });
  if (p.explosionSpriteId === id) u.push({ label: 'Explosion', ref: { tab: 'objects' } });
  for (const e of p.enemyTypes) {
    if (e.spriteId === id) u.push({ label: `Gegnertyp „${e.name}“`, ref: { tab: 'objects', id: e.id } });
    if (e.shot.pattern !== 'none' && e.shot.spriteId === id) u.push({ label: `Gegnertyp „${e.name}“ (Schuss)`, ref: { tab: 'objects', id: e.id } });
  }
  return u;
}

export const enemyTypeUsers = (p: Project, id: string): Use[] =>
  p.formations.filter((f) => f.enemyTypeId === id).map((f) => ({ label: `Formation „${f.name}“`, ref: { tab: 'formations', id: f.id } }));

export const formationUsers = (p: Project, id: string): Use[] =>
  p.levels.filter((l) => l.events.some((e) => e.type === 'spawn' && e.formationId === id)).map((l) => ({ label: `Level „${l.name}“`, ref: { tab: 'levels', id: l.id } }));

/**
 * Höchstzahl gleichzeitig belegter Gegner-Slots in einem Level, wenn kein Gegner abgeschossen wird.
 * Ein Mitglied belegt seinen Slot ab dem Auslösen bis zum Pfadende (Wartezeit + Pfad-Frames).
 * Tempo-Ereignisse ändern das Kamera-Timing, „Warten“ hält die Zeit an, bis alle bisherigen Gegner weg sind.
 * shortcut: Abschüsse und Kollisionen geben Slots früher frei → obere Schranke; genauer erst, wenn Fehlalarme stören.
 */
export function peakEnemies(p: Project, lv: Level): { count: number; pos: number } {
  const camMax = levelCamMax(lv);
  const frames = new Map<string, number>();
  const marks: [number, number, number][] = []; // Frame, ±1, Position
  let sp = levelSpeed(lv), cam = 0, t = 0, lastEnd = 0;
  for (const e of sortedEvents(lv)) {
    const pos = Math.max(0, Math.min(camMax, Math.round(e.pos)));
    if (pos > cam) {
      if (sp === 0) break; // Kamera steht: spätere Ereignisse lösen nie aus
      t += Math.ceil(((pos - cam) * 16) / sp); // shortcut: Rundung je Abschnitt, ±1 Frame je Tempowechsel
      cam = pos;
    }
    if (e.type === 'speed') sp = speedByte(e.speed ?? 0);
    if (e.type === 'waitClear') t = Math.max(t, lastEnd);
    if (e.type !== 'spawn') continue;
    const f = p.formations.find((x) => x.id === e.formationId);
    if (!f || f.points.length < 2) continue;
    let n = frames.get(f.id);
    if (n === undefined) frames.set(f.id, (n = framePositions(f.points, f.speed).length));
    for (const m of formationMembers(f)) {
      marks.push([t, 1, pos], [t + m.delay + n, -1, pos]);
      lastEnd = Math.max(lastEnd, t + m.delay + n);
    }
  }
  marks.sort((a, b) => a[0] - b[0] || a[1] - b[1]); // frei werdende Slots vor neuen im selben Frame
  let cur = 0, count = 0, at = 0;
  for (const [, d, pos] of marks) { cur += d; if (cur > count) { count = cur; at = pos; } }
  return { count, pos: at };
}

/** Alle inhaltlichen Fehler (verhindern Spielen/Export) und Warnungen. Erwartet ein strukturell gültiges Projekt. */
export function lintProject(p: Project): Diagnostic[] {
  const out: Diagnostic[] = [];
  const add = (severity: Diagnostic['severity'], msg: string, ref: DiagRef) => out.push({ severity, msg, ref });
  const sprite = new Set(p.sprites.map((s) => s.id));
  const etype = new Set(p.enemyTypes.map((e) => e.id));
  const form = new Set(p.formations.map((f) => f.id));
  const objects: DiagRef = { tab: 'objects' };

  // Spieler & Gegner
  if (!sprite.has(p.player.spriteId)) add('error', 'Spieler: Sprite fehlt', objects);
  if (!sprite.has(p.player.shotSpriteId)) add('error', 'Schuss: Sprite fehlt', objects);
  if (!sprite.has(p.explosionSpriteId)) add('error', 'Explosion: Sprite fehlt', objects);
  for (const e of p.enemyTypes) {
    const ref: DiagRef = { tab: 'objects', id: e.id };
    if (!sprite.has(e.spriteId)) add('error', `Gegnertyp „${e.name}“: Sprite fehlt`, ref);
    if (e.shot.pattern !== 'none' && !sprite.has(e.shot.spriteId)) add('error', `Gegnertyp „${e.name}“: Schuss-Sprite fehlt`, ref);
    if (!enemyTypeUsers(p, e.id).length) add('warn', `Gegnertyp „${e.name}“ wird in keiner Formation verwendet`, ref);
  }

  // Formationen: Fehler nur, wenn sie in einem Level vorkommen (sonst baut der Compiler sie nicht ein)
  for (const f of p.formations) {
    const ref: DiagRef = { tab: 'formations', id: f.id };
    const used = formationUsers(p, f.id).length > 0;
    const sev = used ? 'error' : 'warn';
    if (!etype.has(f.enemyTypeId)) add(sev, `Formation „${f.name}“: Gegnertyp fehlt`, ref);
    if (f.points.length < 2) add(sev, `Formation „${f.name}“: Pfad braucht mind. 2 Punkte`, ref);
    if (f.count > MAX_ENEMIES) add('warn', `Formation „${f.name}“: ${f.count} Gegner, höchstens ${MAX_ENEMIES} erscheinen`, ref);
    if (!used) add('warn', `Formation „${f.name}“ ist in keinem Level platziert`, ref);
  }

  // Level
  for (const lv of p.levels) {
    const ref: DiagRef = { tab: 'levels', id: lv.id };
    const name = `Level „${lv.name}“`;
    const camMax = levelCamMax(lv);
    let bad = 0;
    for (let i = 0; i < Math.max(1, lv.length) * ACROSS[lv.orientation]; i++) {
      const v = lv.map[i] ?? 0;
      if (!Number.isInteger(v) || v < 0 || v >= p.metatiles.length) bad++;
    }
    if (bad) add('error', `${name}: ${bad} Felder mit fehlendem Pinsel`, ref);
    if (!lv.events.some((e) => e.type === 'spawn')) add('warn', `${name}: keine Gegner-Ereignisse`, ref);
    for (const e of lv.events) {
      const at = Math.round(e.pos);
      if (e.type === 'spawn' && !form.has(e.formationId ?? '')) add('error', `${name}: Ereignis bei ${at} verweist auf gelöschte Formation`, ref);
      else if (e.type === 'music' && e.musicId && !p.songs.some((s) => s.id === e.musicId)) add('warn', `${name}: Musik-Ereignis bei ${at}: Song fehlt`, ref);
      else if (e.pos > camMax) add('warn', `${name}: Ereignis bei ${at} liegt hinter dem Levelende und kommt schon bei ${camMax}`, ref);
    }
    // Tempo 0 ohne spätere Freigabe an derselben Stelle: das Level endet nie
    let sp = levelSpeed(lv), cam = 0;
    for (const e of sortedEvents(lv)) {
      const pos = Math.max(0, Math.min(camMax, Math.round(e.pos)));
      if (pos > cam && sp === 0) break;
      cam = pos;
      if (e.type === 'speed') sp = speedByte(e.speed ?? 0);
    }
    if (sp === 0 && cam < camMax) add('warn', `${name}: Kamera bleibt bei ${cam} stehen (Tempo 0), das Level endet nie`, ref);
    const peak = peakEnemies(p, lv);
    if (peak.count > MAX_ENEMIES)
      add('warn', `${name}: bis zu ${peak.count} Gegner gleichzeitig (bei ${peak.pos}), höchstens ${MAX_ENEMIES} erscheinen`, ref);
    if (lv.musicId && !p.songs.some((s) => s.id === lv.musicId)) add('warn', `${name}: Musik fehlt`, ref);
  }

  // Sound
  for (const [k, label] of [['shot', 'Schuss'], ['explosion', 'Explosion'], ['hit', 'Treffer']] as const)
    if (p.sounds[k] && !p.sfx.some((s) => s.id === p.sounds[k])) add('warn', `Sound „${label}“: Effekt fehlt`, { tab: 'sound' });

  // Unbenutzte Sprites
  for (const s of p.sprites)
    if (!spriteUsers(p, s.id).length) add('warn', `Sprite „${s.name}“ wird nicht verwendet`, { tab: 'sprites', id: s.id });

  return out;
}
