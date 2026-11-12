// Planungsschätzung außerhalb der Kalibrierung (Prüfer-Szenen E1): eigene Datei, läuft parallel
import { afterEach, describe, expect, it } from 'vitest';
import { BUDGET_YELLOW, createTemplateProject, FRAME_CYCLES, lintProject, upgradeBudget } from '../src/index';
import { measure, REVIEW_SCENES } from './scenes';

afterEach(() => new Promise((r) => setTimeout(r)));

describe('Budget: Prüfer-Szenen', () => {
  // Szenen außerhalb der Kalibrierung (Spieler abseits, viele kleine Schützen, langsame Schüsse, Wand aus Fächer-Schützen):
  // gemessen rot (> 110 000) → mindestens eine Lint-Warnung; gemessen ≤ 110 000 → keine Sperre
  const wall = () => {
    const p = createTemplateProject('h');
    p.enemyTypes[0].hp = 50;
    p.enemyTypes[0].shot = { ...p.enemyTypes[0].shot, pattern: 'fan3', interval: 30 };
    p.formations = [{ id: 'w', name: 'Wand', enemyTypeId: 'e-1', speed: 0.5, mode: 'block', count: 16, spacing: 0, offsets: [...Array(16)].map((_, i) => ({ x: 0, y: i * 12 - 90 })), points: [{ x: 264, y: 96 }, { x: -40, y: 96 }] }];
    p.levels[0].events = [{ pos: 0, type: 'spawn', formationId: 'w' }];
    return p;
  };
  it.each([...REVIEW_SCENES, ['W Wand aus 16 Fächer-Schützen', wall, 700, () => 0] as const])('%s: gemessen rot → Warnung, gemessen ≤ 110 000 → keine Sperre', (name, mk, frames, move) => {
    const p = mk();
    const top = measure(p, frames, move);
    const est = upgradeBudget(p, p.levels[0]);
    const warned = lintProject(p).some((d) => /Rechenzeit|verlangsam/.test(d.msg));
    if (process.env.PROFILE) console.log(`${name}: gemessen ${top}, geschätzt ${est.cost} (${(est.cost / top).toFixed(2)}×, ${est.level})`);
    if (top > BUDGET_YELLOW) expect([name, est.cost > FRAME_CYCLES, warned]).toEqual([name, true, true]);
    else expect([name, est.level]).not.toEqual([name, 'red']);
  });

});
