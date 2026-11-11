// Rechenzeit-Budget je Spielbild (Kostenmodell aus E0, Herleitung in docs/data-format.md §5)

/** Takte eines TV-Bilds (228 × 262) */
export const FRAME_CYCLES = 59_736;

/** Modellkonstanten in Takten (Regression je Spielbild, konservativ aufgerundet) */
export const COST = {
  /** leeres Level samt Scrollen/Streaming, SAT, Spieler, Hintergrund-Kollision, Musik */
  BASIS: 27_000,
  /** je Gegner (Pfad, Animation, Box-Cache, Körperkontakt, 2 Hardware-Sprites) */
  EN: 2_600,
  /** je Spielerschuss (Bewegung, Pinsel-Kollision, 1 Hardware-Sprite) */
  SH: 2_100,
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
  /** Spielerschüsse gleichzeitig (Pool ≤ 6) */
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
