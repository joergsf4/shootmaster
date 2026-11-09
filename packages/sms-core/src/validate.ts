import type { Project } from './types';

/** Prüft eine geladene Projektdatei (Vertrauensgrenze). Gibt den ersten Fehler zurück oder null. */
export function validateProject(p: unknown): string | null {
  const o = p as Partial<Project> | null;
  if (!o || typeof o !== 'object') return 'Keine Projektdatei';
  if (o.formatVersion !== 2) return 'Unbekannte Formatversion';
  if (!o.palettes || !Array.isArray(o.palettes.bg) || !Array.isArray(o.palettes.sprite)) return 'Paletten fehlen';
  for (const k of ['metatiles', 'sprites', 'enemyTypes', 'formations', 'levels', 'songs', 'sfx'] as const)
    if (!Array.isArray(o[k])) return `„${k}“ fehlt`;
  if (!o.player || typeof o.player.spriteId !== 'string') return 'Spielerdefinition fehlt';
  if (o.metatiles!.some((m) => !Array.isArray(m?.pixels) || m.pixels.length !== 256)) return 'Ungültiger Pinsel';
  if (o.sprites!.some((s) => !s?.id || !Array.isArray(s.frames) || !s.frames.length || s.frames.some((f) => f.length !== s.width * s.height)))
    return 'Ungültiges Sprite';
  if (o.formations!.some((f) => !f?.id || !Array.isArray(f.points) || !Array.isArray(f.offsets))) return 'Ungültige Formation';
  if (o.levels!.some((l) => !l?.id || (l.orientation !== 'h' && l.orientation !== 'v') || !Array.isArray(l.map) || !Array.isArray(l.events)))
    return 'Ungültiges Level';
  if (!o.sounds || typeof o.sounds !== 'object') return 'Sound-Zuordnung fehlt';
  if (o.songs!.some((s) => !s?.id || !Array.isArray(s.channels) || s.channels.length !== 4 || s.channels.some((c) => !Array.isArray(c?.steps))))
    return 'Ungültiger Song';
  return null;
}
