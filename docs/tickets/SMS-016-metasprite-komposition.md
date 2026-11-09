# SMS-016 – Metasprite-Komposition

| Epic | Meilenstein | Größe | Status |
|---|---|---|---|
| B – Grafik-Editoren | M1 | L | Offen |

## Beschreibung
Größere Objekte (Spieler, Gegner, Bosse) werden aus mehreren Hardware-Sprites zusammengesetzt.

## Akzeptanzkriterien
- [ ] Raster-Komposition aus HW-Sprites mit frei setzbaren Offsets (8-px-Raster und frei)
- [ ] Ankerpunkt (Ursprung) setzbar
- [ ] Hitbox (Rechteck) pro Metasprite/Frame editierbar
- [ ] Scanline-Zähler: zeigt pro Zeile die Anzahl HW-Sprites, Warnung > 4 (rot > 8)
- [ ] Automatische Erzeugung gespiegelter Variante (HW kann Sprites nicht flippen) – Tile-Kosten werden angezeigt und ins Budget gerechnet

## Abhängigkeiten
- [SMS-015 – Sprite-Editor](SMS-015-sprite-editor.md)

---
Kontext: [Projektplan](../PLAN.md)
