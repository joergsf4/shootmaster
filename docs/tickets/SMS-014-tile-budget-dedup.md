# SMS-014 – Tile-Budget & Deduplizierung

| Epic | Meilenstein | Größe | Status |
|---|---|---|---|
| B – Grafik-Editoren | M1 | M | Offen |

## Beschreibung
VRAM ist mit ~448 Tiles die härteste Grenze. Budget muss jederzeit sichtbar sein.

## Akzeptanzkriterien
- [ ] Globale Budget-Leiste: BG-Tiles / Sprite-Tiles / Font / frei, Ampel (grün < 80 %, gelb < 100 %, rot)
- [ ] Berechnung pro Level (Tileset des Levels + alle im Level vorkommenden Sprites + HUD)
- [ ] Export-Dedup: identische und gespiegelte BG-Tiles werden zusammengefasst (Flip-Flag gesetzt)
- [ ] Anzeige „gespart durch Dedup: n Tiles“
- [ ] Export bricht bei Überschreitung mit Liste der größten Verbraucher ab

## Abhängigkeiten
- [SMS-012 – Tile-Editor (Hintergrund)](SMS-012-tile-editor.md)
- [SMS-015 – Sprite-Editor](SMS-015-sprite-editor.md)

---
Kontext: [Projektplan](../PLAN.md)
