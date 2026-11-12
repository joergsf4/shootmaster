// Planungsschätzung (upgradeBudget) gegen gemessene Spitzen; eigene Datei, damit Vitest sie parallel zu core.test.ts ausführt
import { afterEach, describe, expect, it } from 'vitest';
import { createDemoProject, upgradeBudget, weaponPreset, WEAPON_PRESETS } from '../src/index';
import { bench1, bench2, bench3, demoLevel, measure, roam, wiggle, withFan } from './scenes';

afterEach(() => new Promise((r) => setTimeout(r)));

describe('Budget: Planungsschätzung', () => {
  // Ziel: gemessene Spitze ≤ Schätzung ≤ 1,35 × Spitze (ganzes Level bzw. ganze Szene)
  it.each([
    ['Demo H, Standard', () => demoLevel(0), 2400, roam],
    ['Demo V, Standard', () => demoLevel(1), 1700, roam],
    ['Demo H, Fächer', () => withFan(demoLevel(0)), 2400, roam],
    ['Demo V, Fächer', () => withFan(demoLevel(1)), 1700, roam],
    ['Demo H, Fächer Stufe 3 mit Feuerpause 1 (Pool dauernd voll)', () => { const p = withFan(demoLevel(0), 2); p.weapons[1].levels[0].fireRate = 1; return p; }, 2400, roam],
    ['Benchmark (1) Kette + Block, Laser', bench1, 330, wiggle],
    ['Benchmark (2) Ring 12, gezielt', bench2, 400, () => 0],
    ['Benchmark (3) 4 × 4 Käfer, Laser', bench3, 900, wiggle],
  ] as const)('%s: Spitze ≤ Schätzung ≤ 1,35 × Spitze', (name, mk, frames, move) => {
    const p = mk();
    const top = measure(p, frames, move);
    const est = upgradeBudget(p, p.levels[0]);
    if (process.env.PROFILE) console.log(`${name}: gemessen ${top}, geschätzt ${est.cost} (${(est.cost / top).toFixed(2)}×, ${est.level})`);
    expect(est.cost).toBeGreaterThanOrEqual(top);
    expect(est.cost).toBeLessThanOrEqual(1.35 * top);
    if (name.startsWith('Benchmark')) expect(est.level).not.toBe('red');
  });

  it('Demo: keine Waffenvorlage ist in irgendeiner Stufe rot', () => {
    const d = createDemoProject();
    const red: string[] = [];
    for (const k of WEAPON_PRESETS) {
      const w = weaponPreset(k, 'w-' + k, 'shot');
      for (const lv of d.levels) w.levels.forEach((_, i) => { const b = upgradeBudget(d, lv, { weapon: w, level: i }); if (b.level === 'red') red.push(`${k} ${i + 1} ${lv.name} ${b.cost}`); });
    }
    expect(red).toEqual([]);
  });
});
