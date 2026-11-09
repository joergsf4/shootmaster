# SMS-018 – PNG-Import

| Epic | Meilenstein | Größe | Status |
|---|---|---|---|
| B – Grafik-Editoren | M1 | L | Offen |

## Beschreibung
Grafiken in externen Tools malen und importieren.

## Akzeptanzkriterien
- [ ] PNG/GIF-Upload, Quantisierung auf 64er-HW-Palette und max. 16 Farben (mit Vorschlag der Palette oder Mapping auf bestehende)
- [ ] Zerlegung in 8×8-Tiles mit Dedup (inkl. Flip), optional Erzeugung von Metatiles
- [ ] Vorher/Nachher-Vergleich, Anzeige der Tile-Kosten vor dem Übernehmen
- [ ] Import als Tileset, Sprite-Sheet (mit Rastergröße) oder Titelbild
- [ ] Import eines 256×192-Bildes in < 2 s

## Abhängigkeiten
- [SMS-004 – sms-core: Hardware-Primitive](SMS-004-sms-core-hw-primitive.md)
- [SMS-012 – Tile-Editor (Hintergrund)](SMS-012-tile-editor.md)
- [SMS-013 – Metatile-Editor](SMS-013-metatile-editor.md)

---
Kontext: [Projektplan](../PLAN.md)
