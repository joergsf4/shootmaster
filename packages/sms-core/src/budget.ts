// Rechenzeit-Budget je Spielbild (Kostenmodell aus E0, Herleitung in docs/data-format.md §5)
import { emitterPlacement, shotVelocity } from './compile';
import { formationMembers, framePositions } from './path';
import { levelDuration } from './validate';
import { MAX_ENEMIES, MAX_ENEMY_SHOTS, MAX_SHOTS, SCREEN_H, SCREEN_W, type Formation, type Level, type Orientation, type Point, type Project, type Weapon, type WeaponLevel } from './types';

/** Takte eines TV-Bilds (228 × 262) */
export const FRAME_CYCLES = 59_736;

/** Modellkonstanten in Takten (Regression je Spielbild, konservativ aufgerundet) */
export const COST = {
  /** leeres Level samt Scrollen/Streaming, SAT, Spieler, Hintergrund-Kollision, Musik */
  BASIS: 27_000,
  /** je Gegner (Pfad, Animation, Box-Cache, Körperkontakt, 2 Hardware-Sprites) */
  EN: 2_600,
  /** je Spielerschuss (Bewegung, Pinsel-Kollision, 1 Hardware-Sprite) */
  SH: 2_400,
  /** je Gegnerschuss (Bewegung, Kollision mit dem Spieler, 1 Hardware-Sprite) */
  BU: 2_200,
  /** je Paar Spielerschuss × Gegner (volle Trefferprüfung) */
  PAIR: 128,
  /** je zusätzlichem 8×16-Hardware-Sprite (Gegner > 2, Schuss > 1, Spieler > 2) */
  XS: 400,
  /** je Gegner, der im selben Bild feuert (Zielen, Fächer, Poolsuche; Fächer ist der teuerste Fall) */
  VOLLEY: 4_000,
} as const;

/** Grün bis hier: passt in ein Bild, mit Reserve */
export const BUDGET_GREEN = 54_000;
/** Gelb bis hier: verlangsamt, höchstens halbes Tempo; darüber Rot (Drittel-Tempo droht) */
export const BUDGET_YELLOW = 110_000;

export type BudgetLevel = 'green' | 'yellow' | 'red';

export interface FrameLoad {
  /** Gegner gleichzeitig (auch wartende/explodierende Slots) */
  enemies: number;
  /** Gegnerschüsse gleichzeitig (Pool ≤ 16) */
  enemyShots: number;
  /** Spielerschüsse gleichzeitig (Pool ≤ 10) */
  playerShots: number;
  /** Hardware-Sprites über der Grundausstattung (Gegner 2, Schuss 1, Spieler 2), summiert über alle Objekte */
  extraSprites: number;
  /** Gegner, die im selben Bild feuern (schlimmstenfalls alle schießenden Gegner) */
  volleys: number;
}

/** Geschätzte Takte eines Spielbilds; obere Schranke für die gemessenen Szenen (Test „Budget-Modell“) */
export function frameCost(l: FrameLoad): number {
  const c = COST;
  return c.BASIS + c.EN * l.enemies + c.SH * l.playerShots + c.BU * l.enemyShots + c.PAIR * l.playerShots * l.enemies
    + c.XS * l.extraSprites + c.VOLLEY * l.volleys;
}

export function budgetLevel(cycles: number): BudgetLevel {
  return cycles <= BUDGET_GREEN ? 'green' : cycles <= BUDGET_YELLOW ? 'yellow' : 'red';
}

// ---------- Budget eines Levels mit einer Waffenstufe (Lint, Ampel im Editor) ----------

/** Hardware-Sprites (8×16) eines Sprites, obere Schranke (auch leere Zellen) */
const cells = (s?: { width: number; height: number }) => (s ? Math.ceil(s.width / 8) * Math.ceil(s.height / 16) : 2);

/**
 * Annahmen der Planungsschätzung (upgradeBudget), kalibriert an Demo H/V (Standard, Fächer) und den Benchmarks 1–3:
 * Schätzung ≥ gemessene Spitze und ≤ 1,35 × Spitze (budget.test.ts); Prüfer-Szenen (budget-review.test.ts):
 * gemessen > 110 000 → Warnung, gemessen ≤ 110 000 → keine Sperre.
 */
export const PLAN = {
  /** Abschuss: ein Gegner im Bild ist nach so vielen Feuerpausen je nötigem Treffer weg (≈ jede 6. Salve trifft ihn) */
  KILL_PAUSES: 6,
  /** so lange lebt jeder Gegner mindestens im Bild (Bilder), auch wenn er schnell sterben könnte: der Spieler trifft nicht sofort, steht vielleicht abseits */
  MIN_LIFE: 90,
  /** mittlere Flugstrecke eines Gegnerschusses in px (halbe Bilddiagonale) */
  BULLET_RANGE: 160,
  /** Spielerschuss × Gegner im Mittel (E1-Regression) statt Worst Case 128 */
  PAIR: 91,
  /** Sperre (Fehler) erst darüber: BUDGET_YELLOW × 1,35, die geprüfte Unschärfe der Schätzung (Schätzung ≤ 1,35 × gemessene Spitze) */
  BLOCK: 148_500,
} as const;

/** Lastverlauf eines Levels, je Spielbild ab Levelstart */
export interface LevelLoad {
  /** belegte Gegner-Slots (≤ MAX_ENEMIES) */
  enemies: Uint8Array;
  /** Gegner, die in diesem Bild feuern (±1 Bild Toleranz) */
  volleys: Uint8Array;
  /** Gegnerschüsse im Flug (≤ MAX_ENEMY_SHOTS) */
  bullets: Uint8Array;
  /** Zusatz-Sprites von Gegnern, Explosionen und Gegnerschüssen */
  extra: Uint16Array;
  /** Kameraposition des letzten Gegner-Ereignisses (Sprungziel) */
  pos: Int32Array;
}

/**
 * Lastverlauf: Gegner belegen ihren Slot vom Auslösen bis zum Pfadende oder bis zum angenommenen Abschuss
 * (kill: Schaden und Feuerpause der Spielerwaffe, PLAN.KILL_PAUSES; ohne kill kein Abschuss),
 * gefeuert wird wie in der Engine (Zähler nur im Bild, erster Schuss nach einer vollen Pause), Gegnerschüsse fliegen PLAN.BULLET_RANGE px.
 * shortcut: Abschuss und Flugstrecke sind Mittelwerte aus den Kalibrier-Szenen; Gegner außerhalb der Schussbahn leben in Wahrheit länger. Genauer erst, wenn Szenen falsch grün sind.
 * shortcut: VOLLEY gilt für alle Muster mit dem Fächer-Wert; Feuerbilder sind bis auf ±1 Bild genau (Tempo-Rundung in levelDuration).
 */
export function levelLoad(p: Project, lv: Level, kill?: { damage: number; fireRate: number }): LevelLoad {
  type M = { t: number; pos: number; f: Formation; d: number; dx: number; dy: number };
  const members: M[] = [];
  const paths = new Map<string, Point[]>();
  const path = (f: Formation) => { let q = paths.get(f.id); if (!q) paths.set(f.id, (q = framePositions(f.points, f.speed))); return q; };
  let lastEnd = 0;
  const dur = levelDuration(lv, (e, pos, t) => {
    if (e.type === 'waitClear') return Math.max(t, lastEnd);
    const f = e.type === 'spawn' ? p.formations.find((x) => x.id === e.formationId) : undefined;
    if (!f || f.points.length < 2) return t;
    for (const m of formationMembers(f)) {
      members.push({ t, pos, f, d: m.delay, dx: m.dx, dy: m.dy });
      lastEnd = Math.max(lastEnd, t + m.delay + path(f).length);
    }
    return t;
  });
  const T = Math.max(dur.frames, lastEnd) + 4;
  const L: LevelLoad = { enemies: new Uint8Array(T), volleys: new Uint8Array(T), bullets: new Uint8Array(T), extra: new Uint16Array(T), pos: new Int32Array(T) };
  const sprite = new Map(p.sprites.map((s) => [s.id, s]));
  const boom = cells(sprite.get(p.explosionSpriteId));
  const E = new Uint16Array(T), B = new Uint16Array(T);
  for (const m of members) {
    const type = p.enemyTypes.find((x) => x.id === m.f.enemyTypeId);
    const es = sprite.get(type?.spriteId ?? '');
    const pts = path(m.f);
    const t0 = m.t + m.d;
    const ox = (es?.width ?? 16) >> 1, oy = (es?.height ?? 16) >> 1;
    let end = Math.min(T, t0 + pts.length + 1);
    if (kill && type) {
      const k = pts.findIndex((q, i) => i > 0 && q.x - ox + m.dx >= 0 && q.x - ox + m.dx <= 255 && q.y - oy + m.dy >= 0 && q.y - oy + m.dy < 192); // erstes Bild sichtbar
      if (k > 0) end = Math.min(end, t0 + k + Math.max(PLAN.MIN_LIFE, Math.ceil(type.hp / Math.max(1, kill.damage)) * Math.max(1, kill.fireRate) * PLAN.KILL_PAUSES));
    }
    const ex = Math.max(0, cells(es) - 2, boom - 2);
    for (let t = m.t; t < end; t++) { E[t]++; L.extra[t] += ex; }
    for (let t = m.t; t < T; t++) L.pos[t] = Math.max(L.pos[t], m.pos);
    const shot = type?.shot;
    if (!shot || shot.pattern === 'none') continue;
    const n = shot.pattern === 'fan3' ? 3 : 1;
    const life = Math.ceil(PLAN.BULLET_RANGE / Math.max(1 / 16, shot.speed));
    const bx = n * (cells(sprite.get(shot.spriteId)) - 1);
    const rate = Math.max(1, Math.round(shot.interval));
    let c = 0;
    for (let k = 1; k < pts.length && t0 + k - 1 < end; k++) {
      const x = pts[k].x - ox + m.dx, y = pts[k].y - oy + m.dy;
      if (x < 0 || x > 255 || y < 0 || y > 255) continue; // Engine: Zähler läuft nur im Bild (High-Bytes 0)
      if (c === 0) { c = rate; continue; }
      if (--c) continue;
      c = rate;
      const tf = t0 + k - 1;
      if (tf < T) L.volleys[tf]++;
      for (let u = Math.max(0, tf - 1); u <= tf + life && u < T; u++) { B[u] += n; L.extra[u] += bx; }
    }
  }
  for (let t = 0; t < T; t++) {
    L.enemies[t] = Math.min(MAX_ENEMIES, E[t]);
    L.bullets[t] = Math.min(MAX_ENEMY_SHOTS, B[t]);
    L.volleys[t] = Math.min(L.volleys[t], L.enemies[t]);
  }
  return L;
}

/** Flugzeit (Bilder) je Austritt bis zum Bildrand, von der ungünstigsten Spielerposition */
function shotLives(p: Project, w: Weapon, st: WeaponLevel, o: Orientation): number[] {
  const ship = p.sprites.find((s) => s.id === p.player.spriteId) ?? { width: 16, height: 16 };
  const shot = p.sprites.find((s) => s.id === w.spriteId) ?? { width: 8, height: 16 };
  const [minX, maxX, minY, maxY] = [8, SCREEN_W - ship.width, 0, SCREEN_H - ship.height];
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  return st.emitters.map((e) => {
    const q = emitterPlacement(e, o, ship, shot);
    const [vx, vy] = shotVelocity(w.speed, q.dir).map((v) => v / 256);
    let life = 600;
    if (vx > 0) life = Math.min(life, Math.ceil((256 - clamp(minX + q.dx)) / vx));
    if (vx < 0) life = Math.min(life, Math.ceil((clamp(maxX + q.dx) + 1) / -vx));
    if (vy > 0) life = Math.min(life, Math.ceil((192 - clamp(minY + q.dy)) / vy));
    if (vy < 0) life = Math.min(life, Math.ceil((clamp(maxY + q.dy) + 1) / -vy));
    return life;
  });
}

/** Spielerschüsse gleichzeitig (obere Schranke): je Austritt Flugzeit ÷ Feuerpause, höchstens MAX_SHOTS */
export function stageShots(p: Project, w: Weapon, st: WeaponLevel, o: Orientation): number {
  return Math.min(MAX_SHOTS, shotLives(p, w, st, o).reduce((n, life) => n + Math.ceil(life / Math.max(1, st.fireRate)), 0));
}

/** Wirksame Salvenpause für Abschüsse: nie kürzer als die Feuerpause; ist der Pool (10 Schüsse) dauernd voll, bremst er die Salven. Halbe Pool-Wartezeit, weil Treffer Slots früher frei machen (kalibriert: Fächer Stufe 3 mit Feuerpause 1) */
const volleyPause = (p: Project, w: Weapon, st: WeaponLevel, o: Orientation) =>
  Math.max(st.fireRate, Math.ceil(shotLives(p, w, st, o).reduce((a, b) => a + b, 0) / (2 * MAX_SHOTS)));

/** Was die teuerste Stelle treibt (für den passenden Rat im Lint) */
export type BudgetCause = 'enemies' | 'enemyShots' | 'playerShots';

export interface StageBudget {
  /** teuerstes Spielbild (Planungsschätzung) und wo */
  cost: number;
  /** Ampel: grün ≤ BUDGET_GREEN, gelb bis PLAN.BLOCK, rot darüber (gesperrt) */
  level: BudgetLevel;
  pos: number;
  cause: BudgetCause;
  /** längste Strecke über einem vollen Bild (FRAME_CYCLES) am Stück (Spielbilder) und wo sie beginnt */
  slowFrames: number;
  slowPos: number;
  /** Spielerschüsse gleichzeitig (Modell) */
  shots: number;
}

/** Ampel der Planungsschätzung: rot (Sperre) erst, wenn auch bei der Unschärfe der Schätzung (≤ 1,35 × gemessen) mehr als BUDGET_YELLOW sicher ist */
export const planLevel = (cost: number): BudgetLevel => (cost <= BUDGET_GREEN ? 'green' : cost <= PLAN.BLOCK ? 'yellow' : 'red');

/**
 * Planungsschätzung der Rechenzeit eines Levels mit einer Waffenstufe (Vorgabe: Startwaffe, Stufe 1):
 * frameCost über den Lastverlauf aus levelLoad mit Abschüssen durch diese Stufe, Paarprüfung mit PLAN.PAIR.
 * Harte Absicherung der Formel bleibt der Residuen-Test (frameCost mit gezählten Werten ≥ Ist).
 */
export function upgradeBudget(p: Project, lv: Level, stage?: { weapon: Weapon; level: number }): StageBudget {
  const w = stage?.weapon ?? p.weapons.find((x) => x.id === p.player.weaponId);
  const st = w?.levels[stage?.level ?? 0];
  const load = levelLoad(p, lv, w && st ? { damage: st.damage, fireRate: volleyPause(p, w, st, lv.orientation) } : undefined);
  const S = w && st ? stageShots(p, w, st, lv.orientation) : 0;
  const shotEx = w ? cells(p.sprites.find((s) => s.id === w.spriteId)) - 1 : 0;
  const plEx = Math.max(0, cells(p.sprites.find((s) => s.id === p.player.spriteId)) - 2);
  const r: StageBudget = { cost: 0, level: 'green', pos: 0, cause: 'playerShots', slowFrames: 0, slowPos: 0, shots: S };
  let run = 0;
  for (let t = 0; t < Math.max(1, load.enemies.length); t++) {
    const E = load.enemies[t] ?? 0, B = load.bullets[t] ?? 0, V = load.volleys[t] ?? 0;
    const terms: Record<BudgetCause, number> = {
      enemies: COST.EN * E,
      enemyShots: COST.BU * B + COST.VOLLEY * V,
      playerShots: (COST.SH + PLAN.PAIR * E + COST.XS * shotEx) * S,
    };
    const c = COST.BASIS + terms.enemies + terms.enemyShots + terms.playerShots + COST.XS * ((load.extra[t] ?? 0) + plEx);
    if (c > r.cost) {
      r.cost = c;
      r.pos = load.pos[t] ?? 0;
      r.cause = (Object.keys(terms) as BudgetCause[]).reduce((a, k) => (terms[k] > terms[a] ? k : a));
    }
    run = c > FRAME_CYCLES ? run + 1 : 0;
    if (run > r.slowFrames) { r.slowFrames = run; r.slowPos = load.pos[t - run + 1]; }
  }
  r.level = planLevel(r.cost);
  return r;
}
