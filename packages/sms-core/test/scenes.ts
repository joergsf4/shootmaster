// Gemeinsame Mess-Szenen (Benchmarks aus dem Upgrade-Plan, Demo-Varianten) für core.test.ts und budget.test.ts
import { BTN, SMS } from '../../sms-emu/src/index';
import { buildRom, createDemoProject, createTemplateProject, engineBinary, weaponPreset } from '../src/index';

type P = ReturnType<typeof createDemoProject>;
/** Demo mit nur einem Level */
export const demoLevel = (i: number): P => { const p = createDemoProject(); p.levels = [p.levels[i]]; return p; };
/** Fächer-Vorlage, Stufe st, als Startwaffe */
export const withFan = (p: P, st = 0): P => { const w = weaponPreset('Fächer', 'w-fan', p.weapons[0].spriteId); w.levels = [w.levels[st]]; p.weapons.push(w); p.player.weaponId = w.id; return p; };
export const px = (w: number, h: number, f: (x: number, y: number) => number) => [...Array(w * h)].map((_, i) => f(i % w, Math.floor(i / w)));
// Laser-Nachbildung: Spielerschuss 32×8 (4 Hardware-Sprites)
export const laser = (p: ReturnType<typeof createDemoProject>) => {
  p.sprites.push({ id: 'laser', name: 'Laser', width: 32, height: 8, frames: [px(32, 8, (x, y) => (y >= 3 && y <= 4 ? 6 : 0))], frameDelay: 8 });
  Object.assign(p.weapons[0], { spriteId: 'laser', hitbox: { x: 0, y: 3, w: 32, h: 2 }, speed: 6 });
  p.weapons[0].levels[0].fireRate = 4;
  return p;
};
export const roam = (g: number) => [BTN.up, BTN.right, BTN.down, BTN.left][(g >> 5) & 3];
export const wiggle = (g: number) => [BTN.up, BTN.down][(g >> 4) & 1];
// Benchmark (1): Kette aus 4 + 3 kleine Schiffe, Spieler mit Laser (Satellit erst ab E1)
export const bench1 = () => {
  const p = laser(createTemplateProject('h'));
  p.formations = [
    { id: 'k4', name: 'Kette4', enemyTypeId: 'e-1', speed: 1, mode: 'chain', count: 4, spacing: 18, offsets: [], points: [{ x: 264, y: 40 }, { x: 180, y: 70 }, { x: 120, y: 40 }, { x: -40, y: 70 }] },
    { id: 'b3', name: 'Block3', enemyTypeId: 'e-1', speed: 0.7, mode: 'block', count: 3, spacing: 0, offsets: [{ x: 0, y: 0 }, { x: 20, y: 20 }, { x: 0, y: 40 }], points: [{ x: 264, y: 110 }, { x: -40, y: 110 }] },
  ];
  p.enemyTypes[0].hp = 3;
  p.levels[0].events = [{ pos: 0, type: 'spawn', formationId: 'k4' }, { pos: 10, type: 'spawn', formationId: 'b3' }];
  return p;
};
// Benchmark (2): Ring aus 12 (MAXE; 14–16 erst ab E1) um den Spieler, gezielte Schüsse, Kamera steht
export const bench2 = () => {
  const p = createTemplateProject('h');
  p.enemyTypes[0].hp = 50;
  p.enemyTypes[0].shot = { ...p.enemyTypes[0].shot, pattern: 'aimed', interval: 120, speed: 1.5 }; // ~8 Gegnerschüsse
  const ring = [...Array(24 * 8 + 1)].map((_, i) => ({ x: Math.round(64 + 56 * Math.cos(Math.PI * i / 12)), y: Math.round(88 + 56 * Math.sin(Math.PI * i / 12)) }));
  p.formations = [{ id: 'ring', name: 'Ring', enemyTypeId: 'e-1', speed: 3, mode: 'chain', count: 12, spacing: 10, offsets: [], points: ring }];
  p.levels[0].events = [{ pos: 0, type: 'spawn', formationId: 'ring' }];
  p.levels[0].speed = 0;
  return p;
};
// Ring aus 16 (MAXE) ohne Gegnerschüsse: Nutzerwunsch, darf verlangsamen (gelb), aber nicht rot
export const ring16 = () => {
  const p = bench2();
  p.enemyTypes[0].shot.pattern = 'none';
  Object.assign(p.formations[0], { count: 16, spacing: 7 });
  return p;
};
// Fächer Stufe 2 (5 Schüsse je Salve) gegen Kette 4 + 3 Schiffe
export const fanScene = () => {
  const p = bench1();
  const w = weaponPreset('Fächer', 'w-fan', 'shot');
  w.levels = [w.levels[1]];
  p.weapons.push(w);
  p.player.weaponId = w.id;
  return p;
};
// Benchmark (3): 4 schießende Gegner vor dichtem Hintergrund (Demo-Level 1, mit Musik), Laser
export const bench3 = () => {
  const p = laser(createDemoProject());
  p.levels = [p.levels[0]];
  p.formations.push({ id: 'q4', name: 'Vier', enemyTypeId: 'e-bug', speed: 0.8, mode: 'chain', count: 4, spacing: 24, offsets: [], points: [{ x: 264, y: 50 }, { x: 160, y: 90 }, { x: 200, y: 140 }, { x: -40, y: 100 }] });
  p.enemyTypes[1].shot = { ...p.enemyTypes[1].shot, interval: 40 };
  p.levels[0].events = [...Array(4)].map((_, i) => ({ pos: i * 60, type: 'spawn' as const, formationId: 'q4' }));
  return p;
};


// ---- Prüfer-Szenen (E1-Review): Abschüsse fehlen, wenn der Spieler abseits steht; viele kleine oder langsam schießende Gegner ----
const hold = (b: number) => () => b;
const topWave = [{ x: 264, y: 24 }, { x: 200, y: 40 }, { x: 140, y: 20 }, { x: 80, y: 40 }, { x: 30, y: 24 }, { x: 80, y: 30 }, { x: 160, y: 40 }, { x: 230, y: 24 }, { x: 290, y: 30 }];
/** 10 Gegner (HP hp) gezielt alle 90 Bilder in einer Welle oben */
const toughOff = (hp: number) => () => {
  const p = createTemplateProject('h');
  p.enemyTypes[0].hp = hp;
  p.enemyTypes[0].shot = { ...p.enemyTypes[0].shot, pattern: 'aimed', interval: 90, speed: 1.5 };
  p.formations = [{ id: 'w', name: 'Oben', enemyTypeId: 'e-1', speed: 0.6, mode: 'chain', count: 10, spacing: 24, offsets: [], points: topWave }];
  p.levels[0].events = [{ pos: 0, type: 'spawn', formationId: 'w' }];
  return p;
};
/** n Mini-Gegner 8×8 (HP 1) im Block, Muster pattern alle interval Bilder */
const swarm = (n: number, pattern: 'aimed' | 'fan3' | 'straight', interval: number) => () => {
  const p = createTemplateProject('h');
  p.sprites.push({ id: 'mini', name: 'Mini', width: 8, height: 8, frames: [px(8, 8, (x, y) => ((x + y) % 3 ? 3 : 0))], frameDelay: 8 });
  p.enemyTypes[0] = { ...p.enemyTypes[0], spriteId: 'mini', hitbox: { x: 1, y: 1, w: 6, h: 6 }, hp: 1, shot: { ...p.enemyTypes[0].shot, pattern, interval, speed: 2 } };
  const off = [...Array(n)].map((_, i) => ({ x: (i % 4) * 12, y: Math.floor(i / 4) * 12 }));
  p.formations = [{ id: 'b', name: 'S', enemyTypeId: 'e-1', speed: 0.8, mode: 'block', count: n, spacing: 0, offsets: off, points: [{ x: 264, y: 30 }, { x: 120, y: 50 }, { x: -60, y: 30 }] }];
  p.levels[0].events = [{ pos: 0, type: 'spawn', formationId: 'b' }];
  return p;
};
/** n Gegner HP 1 oben, gezielt alle interval Bilder */
const topRow = (n: number, interval: number) => () => {
  const p = createTemplateProject('h');
  p.enemyTypes[0].hp = 1;
  p.enemyTypes[0].shot = { ...p.enemyTypes[0].shot, pattern: 'aimed', interval, speed: 1.5 };
  p.formations = [{ id: 'w', name: 'O', enemyTypeId: 'e-1', speed: 0.6, mode: 'chain', count: n, spacing: 24, offsets: [], points: [{ x: 264, y: 24 }, { x: 140, y: 30 }, { x: 30, y: 24 }, { x: 160, y: 30 }, { x: 290, y: 30 }] }];
  p.levels[0].events = [{ pos: 0, type: 'spawn', formationId: 'w' }];
  return p;
};
/** vertikal: 2 × V aus 7 (HP 3, Fächer alle 60), Spieler mit Fächer Stufe 3 */
const vFan = () => {
  const p = withFan(createTemplateProject('v'), 2);
  p.enemyTypes[0].hp = 3;
  p.enemyTypes[0].shot = { ...p.enemyTypes[0].shot, pattern: 'fan3', interval: 60, speed: 1.5 };
  const V = [{ x: 0, y: 0 }, { x: -16, y: -16 }, { x: 16, y: -16 }, { x: -32, y: -32 }, { x: 32, y: -32 }, { x: -48, y: -48 }, { x: 48, y: -48 }];
  p.formations = [{ id: 'v', name: 'V', enemyTypeId: 'e-1', speed: 0.7, mode: 'block', count: 7, spacing: 0, offsets: V, points: [{ x: 128, y: -20 }, { x: 128, y: 100 }, { x: 128, y: 230 }] }];
  p.levels[0].events = [{ pos: 0, type: 'spawn', formationId: 'v' }, { pos: 40, type: 'spawn', formationId: 'v' }];
  return p;
};
/** 6 Gegner HP 5, langsame gezielte Schüsse (0,5 px/Bild) alle 15 Bilder */
const slowBullets = () => {
  const p = createTemplateProject('h');
  p.enemyTypes[0].hp = 5;
  p.enemyTypes[0].shot = { ...p.enemyTypes[0].shot, pattern: 'aimed', interval: 15, speed: 0.5 };
  p.formations = [{ id: 'k', name: 'K', enemyTypeId: 'e-1', speed: 0.5, mode: 'chain', count: 6, spacing: 30, offsets: [], points: [{ x: 264, y: 40 }, { x: 180, y: 150 }, { x: 100, y: 40 }, { x: -40, y: 120 }] }];
  p.levels[0].events = [{ pos: 0, type: 'spawn', formationId: 'k' }];
  return p;
};
type Scene = [string, () => ReturnType<typeof createDemoProject>, number, (g: number) => number];
/** [Name, Projekt, Spielbilder, Bewegung]; gemessen unverwundbar mit Dauerfeuer */
export const REVIEW_SCENES: Scene[] = [
  ['A3 10 × HP 1 oben, Spieler unten', toughOff(1), 1500, hold(BTN.down)],
  ['A1 10 × HP 20 oben, Spieler unten', toughOff(20), 1500, hold(BTN.down)],
  ['B3 16 Mini, gerade alle 60, Spieler unten', () => { const p = swarm(16, 'straight', 60)(); p.formations[0].points = [{ x: 264, y: 60 }, { x: 120, y: 90 }, { x: -60, y: 60 }]; return p; }, 900, hold(BTN.down)],
  ['C1 V-Level 2 × V7 Fächer, Fächer St. 3', vFan, 900, roam],
  ['C2 V-Level 2 × V7 Fächer, Spieler links', vFan, 900, hold(BTN.left)],
  ['D1 langsame Schüsse alle 15', slowBullets, 1500, roam],
  ['D2 langsame Schüsse, Spieler unten', slowBullets, 1500, hold(BTN.down)],
  ['E1 16 Mini gezielt alle 40, Spieler unten', swarm(16, 'aimed', 40), 1200, hold(BTN.down)],
  ['E2 16 Mini Fächer alle 60, Spieler unten', swarm(16, 'fan3', 60), 1200, hold(BTN.down)],
  ['F3 4 × HP 1 oben gezielt alle 50, Spieler unten', topRow(4, 50), 1200, hold(BTN.down)],
];

/** Höchste Takte eines Spielbilds (unverwundbar, Dauerfeuer, Bewegung move) */
export const measure = (p: ReturnType<typeof createDemoProject>, frames: number, move: (g: number) => number) => {
  const sms = new SMS(buildRom(engineBinary(), p, { invincible: true }).rom);
  let g = 0, top = 0;
  sms.onHalt = () => { if (sms.loadBusy) return; g++; sms.buttons = BTN.b1 | move(g); top = Math.max(top, sms.busy); };
  for (let f = 0; f < frames; f++) sms.runFrame();
  return top;
};

