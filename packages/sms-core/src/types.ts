// Projektmodell (formatVersion 2). Siehe docs/data-format.md
export type Orientation = 'h' | 'v';

export interface Point { x: number; y: number }
export interface Hitbox { x: number; y: number; w: number; h: number }

/** Verweis auf ein BG-Tile (intern beim Kompilieren, nicht im Projekt gespeichert). */
export interface TileRef { tile: number; hflip?: boolean; vflip?: boolean; priority?: boolean }

/** Pinsel: ein eigenständiges 16×16-Bild. Gemeinsame 8×8-Kacheln ermittelt der Compiler selbst. */
export interface Metatile {
  /** 256 Pixel (Index in BG-Palette) */
  pixels: number[];
  /** liegt vor den Sprites */
  priority?: boolean;
}

/** Sprite-Grafik: Breite Vielfaches von 8, Höhe Vielfaches von 16 (8×16-Sprite-Modus). */
export interface SpriteGfx {
  id: string;
  name: string;
  width: number;
  height: number;
  /** Je Frame width*height Pixel (Index in Sprite-Palette, 0 = transparent). */
  frames: number[][];
  /** Frames pro Animationsschritt (1..255). */
  frameDelay: number;
}

export interface EnemyType {
  id: string;
  name: string;
  spriteId: string;
  hp: number;
  hitbox: Hitbox;
  score: number;
}

export interface PlayerDef {
  spriteId: string;
  speed: number; // px/Frame (1..4)
  hitbox: Hitbox;
  lives: number;
  shotSpriteId: string;
  shotSpeed: number; // px/Frame
  shotHitbox: Hitbox;
  fireRate: number; // Frames zwischen Schüssen
  shotOffset: Point; // relativ zum Spieler
}

export type FormationMode = 'chain' | 'block';

export interface Formation {
  id: string;
  name: string;
  enemyTypeId: string;
  /** Wegpunkte in Bildschirmkoordinaten (0..255 × 0..191, Off-Screen erlaubt). */
  points: Point[];
  /** Geschwindigkeit in px/Frame. */
  speed: number;
  mode: FormationMode;
  count: number;
  /** Kette: Abstand in Frames zwischen Gegnern. */
  spacing: number;
  /** Block: Versatz je Mitglied relativ zum Pfad. */
  offsets: Point[];
}

export interface LevelEvent {
  /** Scroll-Position (Pixel) bei der das Ereignis auslöst. */
  pos: number;
  formationId: string;
}

export interface Level {
  id: string;
  name: string;
  orientation: Orientation;
  /** Länge in Metatiles entlang der Scrollachse. */
  length: number;
  /** Scrolltempo in px/Frame (0..7.9375, Raster 1/16). */
  speed: number;
  /**
   * Metatile-Indizes. Index = along * across + acrossPos
   * H: along = Spalte (links→rechts), across = Zeile 0..11 (oben→unten)
   * V: along = Zeile (unten→oben, 0 = Start), across = Spalte 0..15
   */
  map: number[];
  events: LevelEvent[];
  /** Hintergrundmusik (Song-ID), leer = Stille */
  musicId?: string;
}

/** Kanal eines Songs. Schritte: 0 = halten, 1 = aus, ≥ 2 = Note (Ton: n-2 ab C3; Rauschen: Modus n-2). */
export interface SongChannel { volume: number; decay: number; steps: number[] }

export interface Song {
  id: string;
  name: string;
  /** Frames pro Schritt */
  tempo: number;
  /** Anzahl Schritte (läuft in Schleife) */
  length: number;
  /** 3 Tonkanäle + Rauschkanal */
  channels: SongChannel[];
}

export interface Sfx {
  id: string;
  name: string;
  noise: boolean;
  /** Länge in Frames */
  frames: number;
  startHz: number;
  endHz: number;
  /** Rauschmodus 0..7 (Bit 2 = weißes Rauschen, Bits 0-1 = Rate) */
  noiseMode: number;
  volStart: number;
  volEnd: number;
}

export interface Project {
  formatVersion: 2;
  name: string;
  /** SMS-Farbwerte 0..63 (--BBGGRR). */
  palettes: { bg: number[]; sprite: number[] };
  metatiles: Metatile[];
  sprites: SpriteGfx[];
  explosionSpriteId: string;
  player: PlayerDef;
  enemyTypes: EnemyType[];
  formations: Formation[];
  levels: Level[];
  songs: Song[];
  sfx: Sfx[];
  /** Zuordnung Spielereignis → Effekt-ID (leer = still) */
  sounds: { shot: string; explosion: string; hit: string };
}

export const ACROSS = { h: 12, v: 16 } as const;
export const SCREEN_W = 256;
export const SCREEN_H = 192;
export const MAX_BG_TILES = 256;
export const MAX_SPRITE_TILES = 192;
export const MAX_ENEMIES = 12;
export const MAX_SHOTS = 6;
