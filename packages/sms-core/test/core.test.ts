import { describe, expect, it } from 'vitest';
import { bakePath, buildRom, compileProject, createDemoProject, validateProject, decodeTile, encodeNameEntry, encodeTile, engineBinary, framePositions, rgbToSms, smsToRgb } from '../src/index';
import { SMS, BTN, PSG } from '../../sms-emu/src/index';
import { createTemplateProject, layoutBgTiles, levelCamMax, lintProject, peakEnemies, periodTable, shotVelocity, spriteUsers, upgradeProject, type EnemyShot, type Level, type LevelEvent, type Metatile } from '../src/index';

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

describe('Hintergrund-Kollision', () => {
  // Spieler fliegt ohne Gegner in den Boden (horizontal) bzw. die Seitenwand (vertikal)
  const livesAfter = (levelIndex: number, dir: number, solid: boolean) => {
    const p = createDemoProject();
    p.levels = [p.levels[levelIndex]];
    p.levels[0].events = [];
    if (!solid) p.metatiles.forEach((m) => { m.solid = false; });
    const sms = new SMS(buildRom(engineBinary(), p).rom);
    for (let f = 0; f < 200; f++) { sms.buttons = dir; sms.runFrame(); } // < 3 Treffer, sonst Neustart mit vollen Leben
    return sms.ram[0x1e];
  };
  it.each([[0, BTN.down, 'horizontal: Boden'], [1, BTN.left, 'vertikal: Metallwand']])('Level %i – %s kostet ein Leben, nur wenn „tödlich“', (lv, dir) => {
    expect(livesAfter(lv as number, dir as number, true)).toBeLessThan(3);
    expect(livesAfter(lv as number, dir as number, false)).toBe(3);
  });
});

describe('Vorlagen „Neu“', () => {
  it.each(['h', 'v'] as const)('leere Vorlage %s ist gültig, läuft und spawnt die Formation, sobald sie platziert ist', (o) => {
    const p = createTemplateProject(o);
    expect(validateProject(JSON.parse(JSON.stringify(p)))).toBeNull();
    expect(p.levels[0].events).toEqual([]);
    p.levels[0].events.push({ pos: 0, type: 'spawn', formationId: p.formations[0].id });
    const sms = new SMS(buildRom(engineBinary(), p).rom);
    let maxEnemies = 0, sawShot = false;
    for (let f = 0; f < 300; f++) {
      sms.buttons = BTN.b1;
      sms.runFrame();
      maxEnemies = Math.max(maxEnemies, [...Array(12)].filter((_, i) => sms.ram[0x200 + i * 16] >= 2).length);
      if ([...Array(6)].some((_, i) => sms.ram[0x300 + i * 16] === 2)) sawShot = true;
    }
    expect(sms.ram[6] | (sms.ram[7] << 8)).toBeGreaterThan(100);
    expect(maxEnemies).toBeGreaterThanOrEqual(1);
    expect(sawShot).toBe(true);
  });
});

describe('Problem-Panel (lintProject)', () => {
  const msgs = (p: ReturnType<typeof createDemoProject>, sev: 'error' | 'warn') => lintProject(p).filter((d) => d.severity === sev).map((d) => d.msg);
  it('Demo-Projekt hat keine Probleme', () => {
    expect(lintProject(createDemoProject())).toEqual([]);
  });
  it('meldet die stillen Fälle des Compilers', () => {
    const p = createDemoProject();
    const lv = p.levels[0];
    lv.events.push({ pos: 100, type: 'spawn', formationId: 'weg' });
    lv.map[0] = p.metatiles.length; // würde per Modulo zu Pinsel 0
    lv.map[1] = -1;
    p.formations[0].count = 14;
    const d = lintProject(p);
    expect(d).toContainEqual({ severity: 'error', msg: `Level „${lv.name}“: Ereignis bei 100 verweist auf gelöschte Formation`, ref: { tab: 'levels', id: lv.id } });
    expect(d).toContainEqual({ severity: 'error', msg: `Level „${lv.name}“: 2 Felder mit fehlendem Pinsel`, ref: { tab: 'levels', id: lv.id } });
    expect(d).toContainEqual({ severity: 'warn', msg: `Formation „${p.formations[0].name}“: 14 Gegner, höchstens 12 erscheinen`, ref: { tab: 'formations', id: p.formations[0].id } });
  });
  it('meldet tote Sprites/Gegnertypen, kurze Pfade, Ereignisse hinter dem Ende, leere Level und Unbenutztes', () => {
    const p = createDemoProject();
    const [f0] = p.formations;
    p.enemyTypes[0].spriteId = 'weg';
    f0.enemyTypeId = 'weg';
    f0.points = f0.points.slice(0, 1);
    p.levels[0].events[0].pos = 99999;
    p.levels[1].events = [];
    p.sprites.push({ ...p.sprites[0], id: 'neu', name: 'Neu' });
    expect(msgs(p, 'error')).toEqual(expect.arrayContaining([
      `Gegnertyp „${p.enemyTypes[0].name}“: Sprite fehlt`,
      `Formation „${f0.name}“: Gegnertyp fehlt`,
      `Formation „${f0.name}“: Pfad braucht mind. 2 Punkte`,
    ]));
    expect(msgs(p, 'warn')).toEqual(expect.arrayContaining([
      `Level „${p.levels[0].name}“: Ereignis bei 99999 liegt hinter dem Levelende und kommt schon bei ${levelCamMax(p.levels[0])}`,
      `Level „${p.levels[1].name}“: keine Gegner-Ereignisse`,
      'Sprite „Neu“ wird nicht verwendet',
    ]));
  });
  it('kaputte Formation ohne Verwendung ist nur eine Warnung (der Compiler baut sie nicht ein)', () => {
    const p = createTemplateProject('h');
    p.formations[0].points = [];
    expect(msgs(p, 'error')).toEqual([]);
    expect(() => buildRom(engineBinary(), p)).not.toThrow();
  });
  it('nennt die Verwender eines Sprites', () => {
    const p = createDemoProject();
    const e = p.enemyTypes[0];
    expect(spriteUsers(p, e.spriteId)).toContainEqual({ label: `Gegnertyp „${e.name}“`, ref: { tab: 'objects', id: e.id } });
    expect(spriteUsers(p, p.player.spriteId)[0].label).toBe('Spieler');
  });
  // Zwei 8er-Ketten kurz nacheinander: die Engine hat nur 12 Gegner-Slots und verwirft den Rest still
  it.each([[16, 16, 12], [200, 8, 8]])('Ereignisse bei 0 und %i: Vorhersage %i gleichzeitig, Engine zeigt höchstens %i', (pos2, predicted, inGame) => {
    const p = createTemplateProject('h');
    const f = p.formations[0];
    f.count = 8;
    p.levels[0].events = [{ pos: 0, type: 'spawn', formationId: f.id }, { pos: pos2, type: 'spawn', formationId: f.id }];
    expect(peakEnemies(p, p.levels[0]).count).toBe(predicted);
    expect(lintProject(p).some((d) => d.msg.includes('gleichzeitig'))).toBe(predicted > 12);
    const sms = new SMS(buildRom(engineBinary(), p).rom);
    let max = 0;
    for (let fr = 0; fr < 600; fr++) { sms.runFrame(); max = Math.max(max, [...Array(12)].filter((_, i) => sms.ram[0x200 + i * 16] !== 0).length); }
    expect(max).toBe(inGame);
  });
});

describe('„Ab hier spielen“ (startCam, unverwundbar)', () => {
  it('Pause (NMI) und weiter: das Spiel läuft danach weiter', () => {
    const p = createDemoProject();
    const sms = new SMS(buildRom(engineBinary(), p).rom);
    const cam = () => sms.ram[6] | (sms.ram[7] << 8);
    for (let f = 0; f < 60; f++) sms.runFrame();
    sms.pause(); for (let f = 0; f < 30; f++) sms.runFrame();
    const c0 = cam();
    sms.pause(); for (let f = 0; f < 60; f++) sms.runFrame();
    expect(cam()).toBeGreaterThan(c0 + 20);
  });
  // Prüft jedes sichtbare Pixel: Name-Table-Eintrag unter Scrollregister = Pinsel-Viertel der Karte an Kamera + Bildschirmposition
  const screenMismatches = (sms: SMS, lv: Level, metatiles: Metatile[]) => {
    const { refs } = layoutBgTiles(metatiles);
    const cam = sms.ram[6] | (sms.ram[7] << 8);
    const hs = sms.vdp.regs[8], vs = sms.vdp.regs[9];
    const bad: string[] = [];
    for (let y = 0; y < 192; y++) for (let x = lv.orientation === 'h' ? 8 : 0; x < 256; x++) { // H: linke Spalte ist maskiert
      let cell: number, q: number;
      if (lv.orientation === 'h') {
        const wx = cam + x;
        cell = (wx >> 4) * 12 + (y >> 4);
        q = ((y >> 3) & 1) * 2 + ((wx >> 3) & 1);
      } else {
        const a = cam + 191 - y; // Pixel ab Levelanfang (unten)
        cell = (a >> 4) * 16 + (x >> 4);
        q = ((a >> 3) & 1 ? 0 : 2) + ((x >> 3) & 1);
      }
      const want = encodeNameEntry(refs[lv.map[cell]][q]);
      const addr = 0x3800 + (((y + vs) % 224) >> 3) * 64 + (((x - hs) & 0xff) >> 3) * 2;
      if (sms.vdp.vram[addr] !== want[0] || sms.vdp.vram[addr + 1] !== want[1]) bad.push(`${x},${y}`);
    }
    return bad.slice(0, 5); // erste Abweichungen reichen
  };
  const project = (levelIndex: number) => {
    const p = createDemoProject();
    const lv = p.levels[levelIndex];
    p.levels = [lv];
    lv.map = lv.map.map((_, i) => (i * 7 + (i >> 4)) % p.metatiles.length); // möglichst verschiedene Nachbarn
    return { p, lv };
  };
  it.each([[0, 300], [0, 13], [1, 300], [1, 13]])('Level %i ab Kamera %i: Startbild und weiteres Scrollen stimmen mit der Karte überein', (li, startCam) => {
    const { p, lv } = project(li);
    const sms = new SMS(buildRom(engineBinary(), p, { startCam }).rom);
    for (let f = 0; f < 30; f++) sms.runFrame(); // Start (VRAM löschen, Startbild) dauert einige Frames
    expect(sms.ram[6] | (sms.ram[7] << 8)).toBeGreaterThanOrEqual(startCam);
    sms.pause(); sms.runFrame(); sms.runFrame(); // Pause: Kamera steht, Scrollregister und Streaming sind nachgezogen
    expect(screenMismatches(sms, lv, p.metatiles)).toEqual([]);
    sms.pause();
    for (let f = 0; f < 150; f++) sms.runFrame();
    sms.pause(); sms.runFrame(); sms.runFrame();
    expect(sms.ram[6] | (sms.ram[7] << 8)).toBeGreaterThan(startCam + 40);
    expect(screenMismatches(sms, lv, p.metatiles)).toEqual([]);
  });
  it('Ereignisse vor startCam entfallen, startCam wird aufs Levelende geklemmt, nur das erste Level startet versetzt', () => {
    const p = createDemoProject();
    const lv = p.levels[0];
    lv.events = [{ pos: 100, type: 'spawn', formationId: p.formations[0].id }, { pos: 400, type: 'spawn', formationId: p.formations[1].id }, { pos: 99999, type: 'spawn', formationId: p.formations[0].id }];
    const read = (bank: Uint8Array) => {
      const evPtr = (bank[0x18] | (bank[0x19] << 8)) - 0x4000;
      const pos: number[] = [];
      for (let a = evPtr; (bank[a] | (bank[a + 1] << 8)) !== 0xffff; a += 4) pos.push(bank[a] | (bank[a + 1] << 8));
      return { cam: bank[0x28] | (bank[0x29] << 8), pos };
    };
    const d = compileProject(p, { startCam: 400 });
    expect(read(d.banks[1])).toEqual({ cam: 400, pos: [400, levelCamMax(lv)] });
    expect(read(d.banks[2]).cam).toBe(0);
    expect(read(compileProject(p, { startCam: 99999 }).banks[1])).toEqual({ cam: levelCamMax(lv), pos: [levelCamMax(lv)] });
    expect(read(compileProject(p).banks[1]).pos).toHaveLength(3);
  });
  it.each([[false, 0], [true, 3]])('unverwundbar=%s: Flug in den tödlichen Boden kostet %i… (Leben danach)', (invincible) => {
    const p = createDemoProject();
    p.levels = [p.levels[0]];
    p.levels[0].events = [];
    const sms = new SMS(buildRom(engineBinary(), p, { invincible }).rom);
    for (let f = 0; f < 200; f++) { sms.buttons = BTN.down; sms.runFrame(); }
    if (invincible) expect(sms.ram[0x1e]).toBe(3); else expect(sms.ram[0x1e]).toBeLessThan(3);
    expect(sms.ram[0x80 + 15]).toBeGreaterThan(0); // Treffer wird trotzdem angezeigt (Blinken)
  });
});

describe('Level-Ereignisse: Tempo, Musik, Warten, Checkpoint', () => {
  const cam = (sms: SMS) => sms.ram[6] | (sms.ram[7] << 8);
  const busy = (sms: SMS) => [...Array(12)].filter((_, i) => sms.ram[0x200 + i * 16] !== 0).length;
  const withEvents = (events: LevelEvent[]) => { const p = createTemplateProject('h'); p.levels[0].events = events; return p; };
  const evList = (bank: Uint8Array) => {
    const out: number[][] = [];
    for (let a = (bank[0x18] | (bank[0x19] << 8)) - 0x4000; (bank[a] | (bank[a + 1] << 8)) !== 0xffff; a += 4) out.push([bank[a] | (bank[a + 1] << 8), bank[a + 2], bank[a + 3]]);
    return out;
  };

  it('Compiler schreibt Typ und Parameter; „Ab hier“ übernimmt Tempo und Musik der weggelassenen Ereignisse', () => {
    const p = withEvents([
      { pos: 100, type: 'speed', speed: 1 },
      { pos: 100, type: 'music', musicId: '' },
      { pos: 300, type: 'waitClear' },
      { pos: 300, type: 'spawn', formationId: 'f-1' },
      { pos: 200, type: 'checkpoint' },
      { pos: 400, type: 'music', musicId: 'song-1' },
    ]);
    p.levels[0].musicId = 'song-1';
    const b = compileProject(p).banks[1];
    expect(evList(b)).toEqual([[100, 2, 16], [100, 3, 0xff], [200, 5, 0], [300, 4, 0], [300, 1, 0], [400, 3, 0]]);
    expect([b[3], b[0x25]]).toEqual([8, 0]);
    const s = compileProject(p, { startCam: 250 }).banks[1];
    expect(evList(s)).toEqual([[300, 4, 0], [300, 1, 0], [400, 3, 0]]);
    expect([s[3], s[0x25]]).toEqual([16, 0xff]);
  });

  it('Tempo: schneller ab 40, Stopp bei 200 – die Kamera bleibt dort stehen (und Lint warnt)', () => {
    const p = withEvents([{ pos: 0, type: 'spawn', formationId: 'f-1' }, { pos: 40, type: 'speed', speed: 2 }, { pos: 200, type: 'speed', speed: 0 }]);
    expect(lintProject(p).map((d) => d.msg)).toContain(`Level „${p.levels[0].name}“: Kamera bleibt bei 200 stehen (Tempo 0), das Level endet nie`);
    const sms = new SMS(buildRom(engineBinary(), p).rom);
    for (let f = 0; f < 200; f++) sms.runFrame();
    expect(cam(sms)).toBe(200); // mit 0,5 px/F wären es erst ~100
    for (let f = 0; f < 400; f++) sms.runFrame();
    expect(cam(sms)).toBe(200);
    p.levels[0].events.push({ pos: 200, type: 'speed', speed: 1 }); // gleiche Stelle, danach: geht weiter
    expect(lintProject(p).some((d) => d.msg.includes('Kamera bleibt'))).toBe(false);
  });

  it('Musik: Wechsel auf einen Song und zurück zu Stille', () => {
    const p = withEvents([{ pos: 20, type: 'music', musicId: 'song-1' }, { pos: 100, type: 'music', musicId: '' }]);
    p.levels[0].musicId = '';
    const sms = new SMS(buildRom(engineBinary(), p).rom);
    const song = () => sms.ram[0x40] | (sms.ram[0x41] << 8);
    for (let f = 0; f < 30; f++) sms.runFrame();
    expect(song()).toBe(0);
    for (let f = 0; f < 90; f++) sms.runFrame();
    expect(song()).not.toBe(0);
    for (let f = 0; f < 180; f++) sms.runFrame();
    expect(song()).toBe(0);
    expect([1, 3, 5].map((r) => sms.psg.regs[r])).toEqual([15, 15, 15]);
  });

  it('Warten: Kamera hält, bis alle Gegner-Slots frei sind, dann geht es weiter', () => {
    const p = withEvents([{ pos: 0, type: 'spawn', formationId: 'f-1' }, { pos: 10, type: 'waitClear' }]);
    const sms = new SMS(buildRom(engineBinary(), p).rom);
    let held = 0, maxWhileBusy = 0;
    for (let f = 0; f < 600; f++) {
      sms.buttons = BTN.up; // Spieler aus der Flugbahn
      sms.runFrame();
      if (busy(sms)) maxWhileBusy = Math.max(maxWhileBusy, cam(sms));
      if (busy(sms) && cam(sms) === 10) held++;
    }
    expect(maxWhileBusy).toBe(10);
    expect(held).toBeGreaterThan(100);
    expect(cam(sms)).toBeGreaterThan(100);
  });

  it('„Warten“ zwischen zwei 8er-Ketten: Vorhersage und Engine sehen höchstens 8 gleichzeitig', () => {
    const p = withEvents([{ pos: 0, type: 'spawn', formationId: 'f-1' }, { pos: 8, type: 'waitClear' }, { pos: 16, type: 'spawn', formationId: 'f-1' }]);
    p.formations[0].count = 8;
    expect(peakEnemies(p, p.levels[0]).count).toBe(8);
    const sms = new SMS(buildRom(engineBinary(), p).rom);
    let max = 0;
    for (let f = 0; f < 900; f++) { sms.runFrame(); max = Math.max(max, busy(sms)); }
    expect(max).toBe(8);
  });

  // Spieler fliegt in den tödlichen Boden, bis Game Over: Neustart an Kamera und mit Tempo des Checkpoints
  it.each([[true, 60], [false, 0]])('Checkpoint=%s: Neustart nach Game Over bei Kamera %i', (withCk, want) => {
    const p = createDemoProject();
    p.levels = [p.levels[0]];
    p.levels[0].events = [{ pos: 20, type: 'speed', speed: 1 }, ...(withCk ? [{ pos: 60, type: 'checkpoint' } as const] : [])];
    const sms = new SMS(buildRom(engineBinary(), p).rom);
    let prev = 0, respawn = -1;
    for (let f = 0; f < 900 && respawn < 0; f++) {
      sms.buttons = BTN.down;
      sms.runFrame();
      if (cam(sms) < prev) respawn = cam(sms);
      prev = cam(sms);
    }
    expect(respawn).toBe(want);
    expect(sms.ram[0x1e]).toBe(3);
    for (let f = 0; f < 40; f++) sms.runFrame();
    // mit Checkpoint gilt dessen Tempo (1 px/F), ohne beginnt das Level mit 0,5 px/F von vorn
    expect(cam(sms) - want).toBeGreaterThanOrEqual(withCk ? 36 : 16);
  });

  it('Checkpoint gilt nur im eigenen Level: Game Over im nächsten Level startet dort von vorn', () => {
    const p = createDemoProject();
    const short = { ...p.levels[0], id: 'kurz', length: 17, map: p.levels[0].map.slice(0, 17 * 12), events: [{ pos: 8, type: 'checkpoint' } as const] };
    p.levels = [short, { ...p.levels[0], events: [] }];
    const sms = new SMS(buildRom(engineBinary(), p).rom);
    let prev = 0, respawn = -1;
    for (let f = 0; f < 1200 && respawn < 0; f++) {
      sms.buttons = sms.ram[0x13] === 1 ? BTN.down : 0;
      sms.runFrame();
      if (sms.ram[0x13] === 1 && cam(sms) < prev) respawn = cam(sms);
      prev = sms.ram[0x13] === 1 ? cam(sms) : 0;
    }
    expect(sms.ram[0x13]).toBe(1);
    expect(respawn).toBe(0);
  });

  it('alte Ereignisse ohne Typ werden zu „spawn“; kaputte Ereignisse werden abgelehnt', () => {
    const demo = createDemoProject();
    demo.levels.forEach((l) => { l.events = l.events.filter((e) => e.type === 'spawn'); }); // alte Projekte kannten nur Gegner-Ereignisse
    const old = JSON.parse(JSON.stringify(demo));
    old.levels.forEach((l: { events: Record<string, unknown>[] }) => l.events.forEach((e) => { delete e.type; }));
    expect(validateProject(old)).toBe('Ungültiges Ereignis');
    const up = upgradeProject(old) as ReturnType<typeof createDemoProject>;
    expect(validateProject(up)).toBeNull();
    expect(up.levels[0].events[0]).toEqual({ pos: 40, type: 'spawn', formationId: 'f-wave' });
    expect(compileProject(up).banks[1]).toEqual(compileProject(demo).banks[1]);
    for (const bad of [{ pos: 1, type: 'boss' }, { pos: 1, type: 'speed' }, { pos: 'x', type: 'checkpoint' }, { pos: 1, type: 'spawn' }]) {
      const p = JSON.parse(JSON.stringify(createDemoProject()));
      p.levels[0].events.push(bad);
      expect(validateProject(p)).toBe('Ungültiges Ereignis');
    }
  });

  it('Lint: Musik-Ereignis mit gelöschtem Song', () => {
    const p = withEvents([{ pos: 0, type: 'spawn', formationId: 'f-1' }, { pos: 50, type: 'music', musicId: 'weg' }]);
    expect(lintProject(p)).toContainEqual({ severity: 'warn', msg: `Level „${p.levels[0].name}“: Musik-Ereignis bei 50: Song fehlt`, ref: { tab: 'levels', id: p.levels[0].id } });
  });
});

describe('Gegnerschüsse', () => {
  const POOL = 0x400; // $C400, 16 × 16 Byte
  const active = (sms: SMS) => [...Array(16)].map((_, i) => POOL + i * 16).filter((a) => sms.ram[a] !== 0);
  const s8 = (v: number) => (v << 24) >> 24;
  const s16 = (lo: number, hi: number) => ((lo | (hi << 8)) << 16) >> 16;
  const vel = (sms: SMS, a: number) => [s16(sms.ram[a + 9], sms.ram[a + 10]), s16(sms.ram[a + 11], sms.ram[a + 12])]; // 8.8
  const cam = (sms: SMS) => sms.ram[6] | (sms.ram[7] << 8);
  // Ein Gegner steht fast still mit der Sprite-Mitte bei (x, y) und schießt
  const sitter = (o: 'h' | 'v', x: number, y: number, shot: Partial<EnemyShot>, pos = 0, count = 1) => {
    const p = createTemplateProject(o);
    p.enemyTypes[0].shot = { ...p.enemyTypes[0].shot, ...shot };
    const f = p.formations[0];
    Object.assign(f, { count, spacing: 1, points: [{ x, y }, { x: x + 12, y }], speed: 0.05 }); // ~240 Frames fast an derselben Stelle
    p.levels[0].events = [{ pos, type: 'spawn', formationId: f.id }];
    return p;
  };

  it.each([['straight', 2], ['none', 3]] as const)('horizontal, „%s“: stillstehender Gegner auf Spielerhöhe → Leben danach %i', (pattern, lives) => {
    const p = sitter('h', 200, 96, { pattern, interval: 40, speed: 2 });
    const sms = new SMS(buildRom(engineBinary(), p).rom);
    let drawn = false, seen = 0;
    for (let f = 0; f < 240; f++) {
      sms.runFrame();
      for (const a of active(sms)) {
        seen++;
        expect(vel(sms, a)).toEqual([-512, 0]); // gerade = gegen die Scrollrichtung, 2 px/F
        const x = sms.ram[a + 2], y = sms.ram[a + 4];
        if ([...Array(64)].some((_, k) => sms.ram[0x100 + k] === y - 1 && sms.ram[0x140 + k * 2] === x)) drawn = true;
      }
    }
    expect(sms.ram[0x1e]).toBe(lives);
    expect(seen > 0).toBe(pattern !== 'none');
    expect(drawn).toBe(pattern !== 'none'); // Schuss steht in der Sprite-Tabelle
  });

  // Gegner schräg (45°) über dem Spieler: „gerade“ fliegt nach unten vorbei, „gezielt“ trifft
  it.each([['straight', 3], ['aimed', 2]] as const)('vertikal, „%s“: Gegner unter 45° → Leben danach ≤ %i', (pattern, lives) => {
    const p = sitter('v', 128 - 100, 168 - 100, { pattern, interval: 40, speed: 2 }); // Spieler-Hitbox-Mitte bei (128, 168)
    const sms = new SMS(buildRom(engineBinary(), p).rom);
    let v: number[] = [];
    for (let f = 0; f < 300; f++) { sms.runFrame(); const [a] = active(sms); if (a && !v.length) v = vel(sms, a); }
    expect(v).toEqual(pattern === 'straight' ? [0, 512] : shotVelocity(2, 2));
    if (pattern === 'straight') expect(sms.ram[0x1e]).toBe(3); else expect(sms.ram[0x1e]).toBeLessThanOrEqual(lives);
  });

  // Spieler fliegt in die Mitte, dann erscheint ein Gegner im Winkel d × 22,5° + 5° (Abstand 64) und schießt – also in Richtung d + 8
  const firstShots = (pattern: 'aimed' | 'fan3', d: number) => {
    const th = ((d * 22.5 + 5) * Math.PI) / 180;
    const p = sitter('h', Math.round(136 + 64 * Math.cos(th)), Math.round(96 + 64 * Math.sin(th)), { pattern, interval: 10, speed: 1.5 }, 60);
    const sms = new SMS(buildRom(engineBinary(), p).rom);
    for (let f = 0; f < 300; f++) {
      sms.buttons = sms.ram[0x82] < 128 ? BTN.right : 0;
      sms.runFrame();
      const a = active(sms);
      if (a.length) return { x: sms.ram[0x82], v: a.map((b) => vel(sms, b)) };
    }
    throw new Error('kein Schuss');
  };
  it('gezielt: alle 16 Richtungen zum Spieler (Richtung aus dx/dy über Oktanten)', () => {
    for (let d = 0; d < 16; d++) {
      const r = firstShots('aimed', d);
      expect(r.x).toBe(128); // Spieler ist schon in der Mitte
      expect([d, r.v]).toEqual([d, [shotVelocity(1.5, (d + 8) & 15)]]);
    }
  });
  it('Fächer: drei Schüsse, Mitte zum Spieler, ±22,5°', () => {
    const r = firstShots('fan3', 15);
    expect(r.v).toEqual([shotVelocity(1.5, 7), shotVelocity(1.5, 6), shotVelocity(1.5, 8)]);
  });

  // Rechenzeit: Kamera mit 0,5 px/F zeigt verlorene Frames (Hauptschleife länger als ein Bild)
  const camAfter = (p: ReturnType<typeof createTemplateProject>, frames: number, buttons: number = BTN.b1) => {
    const sms = new SMS(buildRom(engineBinary(), p, { invincible: true }).rom);
    let max = 0;
    for (let f = 0; f < frames; f++) { sms.buttons = buttons; sms.runFrame(); max = Math.max(max, active(sms).length); }
    return { cam: cam(sms), max };
  };
  // vorher lag die Hauptschleife hier bei höchstens 59 452 von 59 736 Takten je Bild
  it('Rechenzeit: 12 Gegner im Bild ohne Schüsse verlieren keinen Frame (wie vor den Gegnerschüssen)', () => {
    expect(camAfter(sitter('h', 200, 60, { pattern: 'none' }, 0, 12), 300, 0).cam).toBe(camAfter(sitter('h', 200, 60, { pattern: 'none' }), 300, 0).cam);
  });
  it('Rechenzeit: Demo mit schießenden Käfern läuft so schnell wie ohne', () => {
    const p = createDemoProject();
    p.levels = [p.levels[0]];
    const calm = createDemoProject();
    calm.levels = [calm.levels[0]];
    calm.enemyTypes.forEach((t) => { t.shot.pattern = 'none'; });
    const a = camAfter(p, 1200);
    expect(a.max).toBeGreaterThan(0);
    expect(a.cam).toBe(camAfter(calm, 1200).cam);
  });
  it('Pool voll (16 Schüsse): weitere Schüsse entfallen, das Spiel läuft (verlangsamt) weiter', () => {
    const r = camAfter(sitter('h', 200, 60, { pattern: 'fan3', interval: 8, speed: 0.5 }, 0, 12), 300);
    expect(r.max).toBe(16);
    expect(r.cam).toBeGreaterThan(50);
  });

  it('Compiler: Typ-Byte 8-9 → Schussdefinition (0 = schießt nicht); alte Projekte ohne Schuss bleiben bytegleich', () => {
    const p = createDemoProject();
    const g = compileProject(p).global;
    const types = (g[0x20] | (g[0x21] << 8)) - 0x8000;
    expect([g[types + 8], g[types + 9]]).toEqual([0, 0]); // Drohne
    const def = (g[types + 16 + 8] | (g[types + 16 + 9] << 8)) - 0x8000; // Käfer: gezielt
    expect([...g.slice(def, def + 2)]).toEqual([2, 90]);
    // Hitbox = sichtbare Pixel (Kugel x 1..6, y 5..10); Start: Gegnermitte − Schussmitte; Zielversatz: Spieler-Hitbox-Mitte (8, 8) − Schuss-Hitbox-Mitte (4, 8)
    expect([...g.slice(def + 4, def + 12)].map(s8)).toEqual([1, 5, 6, 6, 8 - 4, 8 - 8, 4, 0]);
    expect([0, 1].map((k) => s16(g[def + 12 + 8 * 4 + k * 2], g[def + 13 + 8 * 4 + k * 2]))).toEqual([-384, 0]); // Richtung 8 = links, 1,5 px/F

    const old = JSON.parse(JSON.stringify(createDemoProject()));
    old.enemyTypes.forEach((t: Record<string, unknown>) => { delete t.shot; });
    expect(validateProject(old)).toBe('Ungültiger Gegnertyp');
    const up = upgradeProject(old) as ReturnType<typeof createDemoProject>;
    expect(validateProject(up)).toBeNull();
    expect(up.enemyTypes[0].shot).toEqual({ pattern: 'none', interval: 60, spriteId: 'shot', speed: 1.5 });
    const none = createDemoProject();
    none.enemyTypes[1].shot.pattern = 'none';
    expect(compileProject(up).global).toEqual(compileProject(none).global);
    for (const bad of [{ pattern: 'laser', interval: 1, speed: 1, spriteId: '' }, { pattern: 'aimed', interval: 'x', speed: 1, spriteId: '' }, null]) {
      const q = JSON.parse(JSON.stringify(createDemoProject()));
      q.enemyTypes[0].shot = bad;
      expect(validateProject(q)).toBe('Ungültiger Gegnertyp');
    }
  });

  it('Lint: fehlendes Schuss-Sprite ist ein Fehler, das Schuss-Sprite gilt als verwendet', () => {
    const p = createDemoProject();
    const bug = p.enemyTypes[1];
    expect(spriteUsers(p, 'orb')).toEqual([{ label: `Gegnertyp „${bug.name}“ (Schuss)`, ref: { tab: 'objects', id: bug.id } }]);
    bug.shot.spriteId = 'weg';
    expect(lintProject(p)).toContainEqual({ severity: 'error', msg: `Gegnertyp „${bug.name}“: Schuss-Sprite fehlt`, ref: { tab: 'objects', id: bug.id } });
    bug.shot.pattern = 'none';
    expect(lintProject(p).filter((d) => d.severity === 'error')).toEqual([]);
  });
});
