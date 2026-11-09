# Datenvertrag Engine ↔ Editor

**Formatversion:** 2 · Engine: [engine/src/main.asm](../engine/src/main.asm) · Compiler: [packages/sms-core/src/compile.ts](../packages/sms-core/src/compile.ts)

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
| 04 | 1 | Formatversion (= 2; die Engine zeigt bei Abweichung einen roten Bildschirm) |
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
`hp(1) hitbox(4) animPtr(2) score(1) reserviert(8)`

## 3. Level-Header (Level-Bank, `$4000`)

| Offset | Größe | Inhalt |
|---|---|---|
| 00 | 1 | Orientierung: 0 = horizontal, 1 = vertikal |
| 01 | 2 | Länge in Metatiles entlang der Scrollachse |
| 03 | 1 | Scrolltempo, Festkomma 4.4 (px/Frame) |
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
| 25 | 1 | Songindex der Levelmusik ($FF = Stille) |

### Karte
Ein Byte (Metatile-Index) pro Zelle.
- **Horizontal:** spaltenweise mit 12 Zeilen pro Spalte, von oben nach unten.
- **Vertikal:** zeilenweise mit 16 Spalten pro Zeile; Zeile 0 ist der Start, also der untere Bildrand.

### Ereignis
`pos(2) typ(1) param(1)`. `pos` ist die Kameraposition in Pixeln, die Liste ist danach sortiert und endet mit `pos = $FFFF`. Typ 1 = Formation spawnen, `param` = lokaler Formationsindex.

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
- 12 Gegner, 6 Spielerschüsse, 64 Hardware-Sprites
- Wenn mehr als 8 Sprites in einer Bildzeile liegen, rotiert die Gegner-Reihenfolge jeden Frame, sodass es flackert statt dass Sprites verschwinden.
- Scrolltempo < 8 px/Frame (eine neue Tile-Spalte bzw. -Zeile pro Frame)
- VRAM: BG-Tiles 0–255, Sprite-Tiles 256–447, Name Table `$3800`, SAT `$3F00`

## Changelog
- v2: Sound – Songs, Effekte, Periodentabelle, Soundtest-Byte, Levelmusik
- v1: erste Version (Scrolling H/V, Formationen mit Pfaden, Spieler, Schüsse, Kollision, Explosionen, Level-Abfolge)
