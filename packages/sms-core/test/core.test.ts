import { describe, expect, it } from 'vitest';
import { bakePath, buildRom, compileProject, createDemoProject, validateProject, decodeTile, encodeNameEntry, encodeTile, engineBinary, framePositions, rgbToSms, smsToRgb } from '../src/index';
import { SMS, BTN, PSG } from '../../sms-emu/src/index';
import { layoutBgTiles, periodTable, upgradeProject } from '../src/index';

describe('Hardware-Primitive', () => {
  it('kodiert Tiles planar 4bpp und zurück', () => {
    const px = Array.from({ length: 64 }, (_, i) => i % 16);
    const bytes = encodeTile(px);
    expect(bytes).toHaveLength(32);
    expect(decodeTile(bytes)).toEqual(px);
    // erste Zeile: Pixel 0..7 = Farben 0..7 → Plane0 = 01010101
    expect(bytes[0]).toBe(0b01010101);
    expect(bytes[1]).toBe(0b00110011);
    expect(bytes[2]).toBe(0b00001111);
    expect(bytes[3]).toBe(0);
  });
  it('Name-Table-Eintrag mit Flags', () => {
    expect(encodeNameEntry({ tile: 0x123, hflip: true, vflip: true, palette: 1, priority: true })).toEqual([0x23, 0x1f]);
  });
  it('Farbumrechnung', () => {
    expect(smsToRgb(0x3f)).toEqual([255, 255, 255]);
    expect(rgbToSms(255, 0, 0)).toBe(0x03);
    expect(rgbToSms(0, 0, 170)).toBe(0x20);
  });
});

describe('Pfade', () => {
  it('backt Pfad mit Abweichung ≤ 1 px', () => {
    const pts = [{ x: 264, y: 30 }, { x: 140, y: 90 }, { x: -40, y: 30 }];
    const { start, bytes } = bakePath(pts, 1.5);
    const ref = framePositions(pts, 1.5);
    let x = start.x, y = start.y, k = 0;
    for (let i = 0; bytes[i] !== 0; i += 3) {
      const n = bytes[i], dx = (bytes[i + 1] << 24) >> 24, dy = (bytes[i + 2] << 24) >> 24;
      for (let j = 0; j < n; j++) { x += dx; y += dy; k++; expect(Math.abs(x - ref[k].x)).toBeLessThanOrEqual(1); expect(Math.abs(y - ref[k].y)).toBeLessThanOrEqual(1); }
    }
    expect(k).toBe(ref.length - 1);
  });
});

describe('ROM', () => {
  const { rom } = buildRom(engineBinary(), createDemoProject());
  it('hat gültigen Header und Checksumme', () => {
    expect(String.fromCharCode(...rom.slice(0x7ff0, 0x7ff8))).toBe('TMR SEGA');
    let sum = 0;
    for (let i = 0; i < 0x7ff0; i++) sum = (sum + rom[i]) & 0xffff;
    expect(rom[0x7ffa] | (rom[0x7ffb] << 8)).toBe(sum);
    expect(rom.length & (rom.length - 1)).toBe(0);
  });
  // Spielt ein Level 900 Frames lang mit Dauerfeuer und meldet, was passiert ist
  const play = (levelIndex: number) => {
    const p = createDemoProject();
    p.levels = [p.levels[levelIndex], ...p.levels.filter((_, i) => i !== levelIndex)];
    const sms = new SMS(buildRom(engineBinary(), p).rom);
    let maxEnemies = 0, sawShot = false;
    for (let f = 0; f < 900; f++) {
      sms.buttons = BTN.b1;
      sms.runFrame();
      const r = sms.ram;
      maxEnemies = Math.max(maxEnemies, [...Array(12)].filter((_, i) => r[0x200 + i * 16] >= 2).length);
      if ([...Array(6)].some((_, i) => r[0x300 + i * 16] === 2)) sawShot = true;
    }
    return { cam: sms.ram[6] | (sms.ram[7] << 8), maxEnemies, sawShot, sms };
  };
  it.each([[0, 'horizontal'], [1, 'vertikal']])('Level %i (%s) läuft im Emulator: scrollt, spawnt Gegner, Spieler schießt', (i) => {
    const r = play(i as number);
    expect(r.cam).toBeGreaterThan(400);
    expect(r.maxEnemies).toBeGreaterThanOrEqual(5);
    expect(r.sawShot).toBe(true);
  });
  it('vertikales Level baut die Name Table korrekt auf (Startbild = Kartenzeilen 0..11)', () => {
    const p = createDemoProject();
    const lv = p.levels[1];
    p.levels = [lv];
    const sms = new SMS(buildRom(engineBinary(), p).rom);
    for (let f = 0; f < 30; f++) sms.runFrame(); // Kamera noch bei 0 bzw. knapp darüber
    const nt = sms.vdp.vram;
    // Tile-Zeile 0 (unten im Bild) liegt in Name-Table-Zeile 27, linkes unteres Viertel des Metatiles
    const { refs } = layoutBgTiles(p.metatiles);
    for (let c = 0; c < 16; c++) {
      const r = refs[lv.map[c]];
      const addr = 0x3800 + 27 * 64 + c * 4;
      expect(nt[addr]).toBe(r[2].tile);
      expect(nt[addr + 2]).toBe(r[3].tile);
    }
  });
});

describe('Spielregeln', () => {
  it('Schuss erscheint nicht am anderen Bildschirmrand, wenn der Versatz überläuft', () => {
    const p = createDemoProject();
    p.player.shotOffset.x = 30;
    p.levels[0].events = [];
    const sms = new SMS(buildRom(engineBinary(), p).rom);
    let wrapped = false;
    for (let f = 0; f < 400; f++) {
      sms.buttons = BTN.right | (f > 200 ? BTN.b1 : 0);
      sms.runFrame();
      for (let i = 0; i < 6; i++) if (sms.ram[0x300 + i * 16] === 2 && sms.ram[0x302 + i * 16] < 100) wrapped = true;
    }
    expect(sms.ram[0x82]).toBe(240);
    expect(wrapped).toBe(false);
  });
  it('Wellen hinter dem Levelende werden ans Ende gelegt statt verworfen', () => {
    const p = createDemoProject();
    p.levels[0].length = 40; // Kamera endet bei 384
    const bank = compileProject(p).banks[1];
    const evPtr = (bank[0x18] | (bank[0x19] << 8)) - 0x4000;
    const pos: number[] = [];
    for (let a = evPtr; (bank[a] | (bank[a + 1] << 8)) !== 0xffff; a += 4) pos.push(bank[a] | (bank[a + 1] << 8));
    expect(Math.max(...pos)).toBe(384);
    expect(pos).toHaveLength(p.levels[0].events.length);
  });
});

describe('Projektdatei prüfen', () => {
  it('akzeptiert das Demo-Projekt', () => {
    expect(validateProject(JSON.parse(JSON.stringify(createDemoProject())))).toBeNull();
  });
  it.each([
    ['kein Objekt', null],
    ['falsche Version', { ...createDemoProject(), formatVersion: 99 }],
    ['Level ohne Karte', { ...createDemoProject(), levels: [{ id: 'x' }] }],
    ['fehlende Sprites', { ...createDemoProject(), sprites: undefined }],
    ['kaputter Pinsel', { ...createDemoProject(), metatiles: [{ pixels: [1, 2, 3] }] }],
  ])('lehnt ab: %s', (_, p) => {
    expect(validateProject(p)).not.toBeNull();
  });
});

describe('Sound', () => {
  it('PSG erzeugt die eingestellte Tonhöhe', () => {
    const psg = new PSG();
    const period = periodTable()[21]; // A4 = 440 Hz
    psg.write(0x80 | (period & 15)); psg.write(period >> 4); psg.write(0x90); // Kanal 0, laut
    const s = psg.render(44100, 44100);
    let flips = 0;
    for (let i = 1; i < s.length; i++) if (Math.sign(s[i]) !== Math.sign(s[i - 1])) flips++;
    expect(Math.abs(flips / 2 - 440)).toBeLessThan(5);
  });
  it('Engine spielt die Levelmusik und den Schuss-Effekt', () => {
    const p = createDemoProject();
    const sms = new SMS(buildRom(engineBinary(), p).rom);
    const melodyPeriod = periodTable()[p.songs[0].channels[0].steps[0] - 2];
    let heardMelody = false, heardShot = false;
    for (let f = 0; f < 200; f++) {
      sms.buttons = f > 100 ? BTN.b1 : 0;
      sms.runFrame();
      if (sms.psg.regs[0] === melodyPeriod && sms.psg.regs[1] < 15) heardMelody = true;
      if (sms.psg.regs[5] < 15) heardShot = true; // Kanal 3 ist im Song still → nur der Laser
    }
    expect(heardMelody).toBe(true);
    expect(heardShot).toBe(true);
  });
  it('Soundtest-ROM spielt einen Effekt und verstummt danach', () => {
    const p = createDemoProject();
    const sms = new SMS(buildRom(engineBinary(), p, { soundTest: { sfx: 'sfx-boom' } }).rom);
    let loud = false;
    for (let f = 0; f < 30; f++) { sms.runFrame(); if (sms.psg.regs[7] < 10 && sms.psg.regs[6] === 6) loud = true; }
    for (let f = 0; f < 30; f++) sms.runFrame();
    expect(loud).toBe(true);
    expect(sms.psg.regs[7]).toBe(15);
  });
  it('alte Projekte ohne Sound bekommen Standard-Sounds', () => {
    const old = JSON.parse(JSON.stringify(createDemoProject()));
    delete old.songs; delete old.sfx; delete old.sounds;
    expect(validateProject(old)).not.toBeNull();
    expect(validateProject(upgradeProject(old))).toBeNull();
  });
});

describe('Pinsel', () => {
  it('teilt gleiche und gespiegelte 8×8-Kacheln automatisch', () => {
    const quarter = Array.from({ length: 64 }, (_, i) => (i % 8 < 3 && i < 40 ? 5 : 0)); // in beide Richtungen asymmetrisch
    const px = new Array(256).fill(0);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      px[y * 16 + x] = quarter[y * 8 + x];            // oben links: Original
      px[y * 16 + 8 + x] = quarter[y * 8 + 7 - x];    // oben rechts: gespiegelt
      px[(8 + y) * 16 + x] = quarter[(7 - y) * 8 + x]; // unten links: vertikal gespiegelt
      px[(8 + y) * 16 + 8 + x] = 0;                   // unten rechts: leer
    }
    const { tiles, refs } = layoutBgTiles([{ pixels: px }]);
    expect(tiles).toHaveLength(2);
    expect(refs[0][1]).toEqual({ tile: 0, hflip: true, priority: undefined });
    expect(refs[0][2]).toEqual({ tile: 0, vflip: true, priority: undefined });
  });
  it('Pinsel ändern sich nicht gegenseitig (eigene Pixel je Pinsel)', () => {
    const p = createDemoProject();
    p.metatiles[0].pixels[0] = 7;
    expect(p.metatiles.slice(1).every((m) => m !== p.metatiles[0])).toBe(true);
    expect(validateProject(p)).toBeNull();
  });
  it('wandelt Projekte im alten Kachel-Format (1) bildgleich um', () => {
    const tile = Array.from({ length: 64 }, (_, i) => i % 16);
    const old = { ...JSON.parse(JSON.stringify(createDemoProject())), formatVersion: 1, tiles: [tile],
      metatiles: [{ tiles: [{ tile: 0 }, { tile: 0, hflip: true }, { tile: 0 }, { tile: 0, priority: true }] }] };
    const up = upgradeProject(old) as ReturnType<typeof createDemoProject>;
    expect(validateProject(up)).toBeNull();
    expect('tiles' in up).toBe(false);
    expect(up.metatiles[0].pixels[0]).toBe(tile[0]);
    expect(up.metatiles[0].pixels[8]).toBe(tile[7]); // gespiegelt
    expect(up.metatiles[0].priority).toBe(true);
  });
});
