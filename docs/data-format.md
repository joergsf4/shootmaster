# Datenvertrag Engine ↔ Editor

**Formatversion:** 3 · Engine: [engine/src/main.asm](../engine/src/main.asm) · Compiler: [packages/sms-core/src/compile.ts](../packages/sms-core/src/compile.ts)

Alle Mehrbyte-Werte sind Little Endian. Alle Zeiger sind CPU-Adressen in dem Slot, in den die jeweilige Bank eingeblendet ist.

## 1. ROM- und Bank-Layout (Sega-Mapper, 16-KB-Banks)

| Bank | Slot | Inhalt |
|---|---|---|
| 0 | 0 (`$0000`) | Engine (vorassembliert, max. 16 KB) |
| 1 | 2 (`$8000`) | Globale Daten; letzte 16 Byte = ROM-Header „TMR SEGA“ (`$7FF0` im ROM) |
| 2 | 1 (`$4000`) | BG-Tiles (beim Levelstart kurz eingeblendet) |
| 3 … | 1 (`$4000`) | ein Level pro Bank |

Die ROM-Größe wird auf eine Zweierpotenz aufgerundet (mindestens 64 KB). Der Header verwendet Region 4 (SMS Export) und Größencode `C` (Prüfsumme über `$0000–$7FEF`).

## 2. Globaler Header (Bank 1, `$8000`)

| Offset | Größe | Inhalt |
|---|---|---|
| 00 | 4 | Magic `SHMP` |
| 04 | 1 | Formatversion (= 3; die Engine zeigt bei Abweichung einen roten Bildschirm) |
| 05 | 1 | Anzahl Level |
| 08 | 16 | Sprite-Palette (Farbe 0 = Backdrop/transparent, wird auf Schwarz gesetzt) |
| 18 | 2 | Anzahl Sprite-Tiles (max. 192, VRAM ab Tile 256 / `$2000`) |
| 1A | 2 | → Sprite-Tiles (4bpp planar, 32 Byte pro Tile) |
| 1C | 2 | → Level-Banktabelle (1 Byte pro Level) |
| 1E | 2 | → Spielerdefinition |
| 20 | 2 | → Gegnertypen (je 16 Byte) |
| 22 | 2 | → Explosionsanimation |
| 24 | 2 | → Song-Tabelle (Zeiger je Song) |
| 26 | 2 | → Effekt-Tabelle (Zeiger je Effekt) |
| 28 | 2 | → Periodentabelle: 48 Wörter, Noten C3 … H6 (10-Bit-PSG-Periode) |
| 2A–2C | 3 | Effektindex für Schuss, Explosion, Spieler getroffen ($FF = still) |
| 2D | 1 | Soundtest: 0 = Spiel; 1+n = nur Song n; $80+n = nur Effekt n (Vorschau im Editor) |
| 2E | 1 | Unverwundbar (Test-ROM aus dem Editor): ≠ 0 = Treffer kosten kein Leben, der Spieler blinkt nur |

### Animation
`count(1) delay(1) frame[count](2 = Zeiger auf Metasprite)`

### Metasprite (8×16-Sprite-Modus)
`count(1)`, dann pro Teil `dy(int8) dx(int8) tile(1)`. `tile` ist relativ zu Sprite-Tile 256 und immer gerade.

### Spielerdefinition
| Offset | Inhalt |
|---|---|
| 0 | Tempo (px/Frame) |
| 1–4 | Hitbox x, y, w, h |
| 5–8 | minX, maxX, minY, maxY |
| 9 | → Animation |
| 11 | → Schussanimation |
| 13 | Schusstempo |
| 14–17 | Schuss-Hitbox |
| 18 | Feuerpause (Frames) |
| 19, 20 | Schussversatz x, y (int8) |
| 21 | Leben |

### Gegnertyp (16 Byte)
`hp(1) hitbox(4) animPtr(2) score(1) schussPtr(2) reserviert(6)`

`schussPtr` zeigt auf die Schussdefinition des Typs, 0 = schießt nicht.

### Schussdefinition (44 Byte)
| Offset | Inhalt |
|---|---|
| 0 | Muster: 1 = gerade (gegen die Scrollrichtung: horizontal nach links, vertikal nach unten), 2 = gezielt, 3 = Fächer (3 Schüsse: zum Spieler und ±22,5°) |
| 1 | Feuerpause in Frames (1–255). Gezählt wird nur, solange der Gegner im Bild ist; der erste Schuss kommt eine volle Pause nach dem Erscheinen |
| 2 | → Schussanimation |
| 4–7 | Hitbox x, y, w, h relativ zum Schuss-Sprite (der Compiler nimmt die sichtbaren Pixel des ersten Frames) |
| 8, 9 | Startversatz x, y (int8): Gegner oben links → Schuss oben links, sodass der Schuss in der Gegnermitte startet |
| 10, 11 | Zielversatz x, y (int8): Mitte der Spieler-Hitbox minus Mitte der Schuss-Hitbox |
| 12 | 16 Richtungen × `vx(2) vy(2)`: Tempo in 1/256 px/Frame (8.8 mit Vorzeichen). Richtung i = i × 22,5°, 0 = rechts, 4 = unten |

„Gezielt“ bestimmt die Richtung aus dx/dy zur Spieler-Hitbox: Oktant über die Vorzeichen, dann 3 Stufen je Oktant (kleiner × 5 < größer → Achse, kleiner × 3 < größer × 2 → 22,5°, sonst 45°).

## 3. Level-Header (Level-Bank, `$4000`)

| Offset | Größe | Inhalt |
|---|---|---|
| 00 | 1 | Orientierung: 0 = horizontal, 1 = vertikal |
| 01 | 2 | Länge in Metatiles entlang der Scrollachse |
| 03 | 1 | Scrolltempo, Festkomma 4.4 (px/Frame). Bei Startkamera > 0 gilt das Tempo des letzten weggelassenen Tempo-Ereignisses |
| 04 | 16 | BG-Palette |
| 14 | 2 | → Metatiles (je 8 Byte: 4 Name-Table-Wörter OL, OR, UL, UR) |
| 16 | 2 | → Karte |
| 18 | 2 | → Ereignisliste |
| 1A | 2 | → Formationstabelle (Zeiger pro lokaler Formation) |
| 1C | 1 | Bank der BG-Tiles |
| 1D | 2 | → BG-Tiles (Slot-1-Adresse) |
| 1F | 2 | Anzahl BG-Tiles (max. 256) |
| 21 | 2 | maximale Kameraposition (Level-Ende) |
| 23, 24 | 1+1 | Startposition des Spielers x, y |
| 25 | 1 | Songindex der Levelmusik ($FF = Stille). Bei Startkamera > 0 wie Offset 03 der Song des letzten weggelassenen Musik-Ereignisses |
| 26 | 2 | → Kollisionstabelle: 1 Byte je Pinsel (1 = tödlich: Spieler verliert ein Leben, Schüsse verschwinden) |
| 28 | 2 | Startkamera in Pixeln (0 = Levelanfang). Der Editor setzt sie für „Ab hier spielen“ beim ersten Level; Ereignisse davor lässt der Compiler weg. Auch nach Game Over beginnt das Level wieder hier, solange kein Checkpoint erreicht ist. |

### Karte
Ein Byte (Metatile-Index) pro Zelle.
- **Horizontal:** spaltenweise mit 12 Zeilen pro Spalte, von oben nach unten.
- **Vertikal:** zeilenweise mit 16 Spalten pro Zeile; Zeile 0 ist der Start, also der untere Bildrand.

### Ereignis
`pos(2) typ(1) param(1)`. `pos` ist die Kameraposition in Pixeln, die Liste ist danach sortiert und endet mit `pos = $FFFF`. Ereignisse mit gleicher Position laufen im selben Frame in Listenreihenfolge ab.

| Typ | Bedeutung | `param` |
|---|---|---|
| 1 | Formation spawnen | lokaler Formationsindex |
| 2 | Scrolltempo setzen | Tempo 4.4 wie Header `03`; 0 = Kamera steht (spätere Ereignisse lösen dann nicht mehr aus) |
| 3 | Musik wechseln | Songindex, $FF = Stille |
| 4 | Warten | 0. Die Kamera und alle folgenden Ereignisse halten an, bis alle 12 Gegner-Slots frei sind (auch Explosionen) |
| 5 | Checkpoint | 0. Merkt Ereigniszeiger, Kamera, Tempo und Song. Game Over startet das Level dort neu; die Ereignisse danach laufen erneut. Beim Levelwechsel verfällt der Checkpoint |

Unbekannte Typen überspringt die Engine.

Im Projekt-JSON hat jeder Gegnertyp `shot: { pattern, interval, spriteId, speed }` mit `pattern` = `none`, `straight`, `aimed` oder `fan3`, `interval` in Frames und `speed` in px/Frame. Gegnertypen ohne `shot` (ältere Projekte) bekommen über `upgradeProject` `pattern: 'none'` (das Sprite ist dann das des Spielerschusses).

Im Projekt-JSON hat jedes Ereignis `pos` und `type` (`spawn`, `speed`, `music`, `waitClear`, `checkpoint`) sowie je nach Typ `formationId`, `speed` (px/Frame) oder `musicId` (leer = Stille). Ereignisse ohne `type` (ältere Projekte) wandelt `upgradeProject` in `spawn` um.

### Formation
`typ(1) startX(int16) startY(int16) pfadPtr(2) anzahl(1)`, dann pro Mitglied `delay(1) dx(int8) dy(int8)`.
- **Kette:** delay = i × Abstand, dx = dy = 0.
- **Block:** delay = 0, dx/dy = Versatz des Mitglieds.

Die Startkoordinaten sind Bildschirmkoordinaten (oben links am Sprite). Im Editor stehen die Pfadpunkte für die Sprite-Mitte; der Compiler rechnet sie um.

### Pfad
Folge von `n(1) dx(int8) dy(int8)`: n Frames lang wird jeweils (dx, dy) addiert. `n = 0` beendet den Pfad, der Gegner verschwindet dann.

### Song
`tempo(1)` (Frames pro Schritt), `länge(1)` (Schritte, Schleife), 4 × `lautstärke(1) abklingen(1)` (Kanal Ton 1–3, Rauschen; abklingen = Frames pro Dämpfungsstufe, 0 = halten), dann je Kanal `länge` Schrittbytes hintereinander.
Schrittbyte: `0` halten · `1` aus · `n ≥ 2` Note `n-2` (Ton: Index in Periodentabelle; Rauschen: Rauschmodus 0–7).

### Effekt
`kanal(1)` (2 = Ton 3, 3 = Rauschen), `frames(1)`, dann je Frame `wert(2) dämpfung(1)` (wert = Periode bzw. Rauschmodus). Ein Effekt übernimmt seinen Kanal; danach erhält der Kanal die Lautstärke der Musik zurück.

## 4. Engine-Grenzen (v1)
- 12 Gegner, 6 Spielerschüsse, 16 Gegnerschüsse (RAM `$C400–$C4FF`, ist der Pool voll, entfällt der Schuss), 64 Hardware-Sprites
- Wenn mehr als 8 Sprites in einer Bildzeile liegen, rotiert die Reihenfolge jeden Frame, sodass es flackert statt dass Sprites verschwinden. Gegnerschüsse stehen vor den Gegnern in der Sprite-Tabelle und rotieren unter sich.
- Rechenzeit: 59 736 Takte je Bild, siehe Abschnitt 5. Viele Gegner plus viele Schüsse verlangsamen das Spiel.
- Gegnerschüsse fliegen durch tödliche Pinsel.
- Scrolltempo < 8 px/Frame (eine neue Tile-Spalte bzw. -Zeile pro Frame)
- VRAM: BG-Tiles 0–255, Sprite-Tiles 256–447, Name Table `$3800`, SAT `$3F00`

## 5. Rechenzeit (gemessen, E0)
Messgröße: `SMS.busy` = Takte eines Spielbilds vom VBlank-IRQ bis zum nächsten `halt` (Wartezeit im `halt` zählt nicht). Strecken bei abgeschaltetem Display (Init, Levelaufbau, Neustart) landen in `SMS.loadBusy` statt in `busy`/`maxBusy`; eine Strecke ohne VBlank-IRQ (Pause-NMI) zählt zum folgenden Spielbild.

Modell (Code: `packages/sms-core/src/budget.ts`, `frameCost`):
```
T = BASIS + E·EN + S·SH + B·BU + S·E·PAIR + X·XS + V·VOLLEY
```
E Gegner (belegte Slots, auch wartend/explodierend), S Spielerschüsse, B Gegnerschüsse, X Hardware-Sprites (8×16) über der Grundausstattung (Spieler 2, Gegner 2, Schuss 1; Teile laut `layoutSprites`), V Gegner, die im selben Bild feuern.

| Konstante | Takte | Regression | Bedeutung |
|---|---|---|---|
| BASIS | 27 000 | 14 940 + max. Residuum 10 820 | Scrollen/Streaming-Spitze, SAT, Spieler, Hintergrund-Kollision; Rest als Reserve für Musik (Vorlage ohne Musik) |
| EN | 2 600 | 2 568 | je Gegner (Pfad, Animation, Box-Cache, Körperkontakt, Zeichnen) |
| SH | 2 100 | 1 891 | je Spielerschuss (Bewegung, Pinsel-Kollision, Zeichnen) |
| BU | 2 200 | 1 652 | je Gegnerschuss (Bewegung, Kollision mit dem Spieler, Zeichnen) |
| PAIR | 128 | 54 (Mittel) | je Paar Spielerschuss × Gegner; 128 = volle Prüfung bei X-Überlappung (Worst Case) |
| XS | 400 | 354 | je zusätzlichem Hardware-Sprite (`drawMeta`, SAT) |
| VOLLEY | 4 000 | gerade 2 102, gezielt 1 755, Fächer 3 950 | je feuerndem Gegner (Zielen, bis zu 3 × Poolsuche, auch bei vollem Pool) |

Herleitung: Kleinste-Quadrate-Regression über 4 549 Spielbilder aus 40 Vorlage-Szenen (H und V; 0–12 Gegner; mit/ohne Dauerfeuer; breite Hitbox; Gegnerschüsse gerade/gezielt/Fächer bei 4 und 12 Gegnern; 32×16-Gegner; 32×8-Schuss; Gegner in der Schussbahn), E/S/B/X/V je Bild aus dem RAM gezählt, V über `pcCycles` am Einsprung von `efShoot`. Steigungen aufgerundet, BASIS = Achsenabschnitt + größtes Residuum, aufgerundet. Auf den Trainingsdaten gilt damit Ist/Modell ≤ 0,87.

Prüfung gegen unabhängige Szenen (Test „Budget-Modell“, jedes Spielbild Ist ≤ Modell, ohne Toleranz): Demo-Level 1 mit Musik 0,935; (1) Kette 4 + 3 Schiffe mit Laser 0,855; (2) Ring aus 12 mit gezielten Schüssen 0,855; (3) 4 schießende Gegner vor Demo-Hintergrund mit Laser 0,919. Die komplette Demo (4 368 Spielbilder, einmalig gemessen) liegt bei 0,969.

Stufen (`budgetLevel`): **grün** T ≤ 54 000 (passt mit Reserve in ein Bild), **gelb** T ≤ 110 000 (verlangsamt, höchstens halbes Tempo), **rot** darüber (Drittel-Tempo droht). Gemessene Benchmark-Nachbildungen (Spitze/Modell): (1) 56 600 / 70 376 gelb, (2) 77 197 / 94 344 gelb, (3) 67 975 / 74 060 gelb, Demo-Level 1 44 154 / 50 960 grün.

shortcut: VOLLEY nimmt für alle Muster den Fächer-Wert und E1 muss V als „alle schießenden Gegner feuern gleichzeitig“ abschätzen; Kosten je Muster und Feuer-Versatz erst, wenn das zu oft fälschlich gelb/rot meldet.
shortcut: Satelliten, Kapseln, Ladeschuss fehlen im Modell; Terme und Messung kommen mit E1.

Vorher/nachher (12 Gegner + 6 Spielerschüsse, normale Hitbox): vor E0 H 94 192 / V 91 125, nach E0 H 67 286 / V 65 647 Takte. Das Bild bleibt damit noch zu voll (> 59 736); E1 sperrt solche Kombinationen über das Budget.

Engine-Interna seit E0 (Datenformat unverändert): Box-Cache der kollidierbaren Gegner `$C1C0` (12 × x, w, y, h), Slot-Liste `$C1F0`, Anzahl `$C1FC`; `shotCount` `$C03D`; Spielerschüsse tragen in Byte 6–7 (`B_DEF`) einen Zeichenzeiger, damit `drawPool` beide Schuss-Pools zeichnet. Adressen für Tests: `ENGINE_SYMBOLS` aus `generated/engine.ts`.

## Changelog
- v3 (ohne Formatänderung): E0 – Taktmessung, Box-Cache, `shotCount`, `drawPool`, Budget-Modell `budget.ts`; Verhalten je Spielbild unverändert (Hash-Test)
- v3 (ohne Versionswechsel, Typ-Byte 8–9 waren reservierte Nullen = schießt nicht): Gegnerschüsse (Schussdefinition je Gegnertyp)
- v3 (ohne Versionswechsel, ältere Daten nutzen nur Typ 1): Ereignistypen 2–5 (Tempo, Musik, Warten, Checkpoint)
- v3 (ohne Versionswechsel, vorher reservierte Null-Byte): Startkamera (Level `28`) und Unverwundbar (Global `2E`) für Test-ROMs
- v3: Hintergrund-Kollision (tödliche Pinsel)
- v2: Sound – Songs, Effekte, Periodentabelle, Soundtest-Byte, Levelmusik
- v1: erste Version (Scrolling H/V, Formationen mit Pfaden, Spieler, Schüsse, Kollision, Explosionen, Level-Abfolge)
