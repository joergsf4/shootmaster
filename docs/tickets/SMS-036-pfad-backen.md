# SMS-036 – Pfad-Backen

| Epic | Meilenstein | Größe | Status |
|---|---|---|---|
| D – Formationen & Gegner | M3 | M | Offen |

## Beschreibung
Umwandlung der Editor-Splines in Engine-Daten.

## Akzeptanzkriterien
- [ ] Spline + Tempo → Position pro Frame → Deltas (dx, dy) als int8
- [ ] RLE-Kompression gleicher Deltas
- [ ] Akkumulierter Fehler ≤ 1 px gegenüber Spline (Test)
- [ ] Formation → Bytecode (MOVE_PATH, WAIT, SHOOT, SET_ANIM, SET_SPEED, END)
- [ ] Größenanzeige pro Formation

## Abhängigkeiten
- [SMS-003 – Datenvertrag v1 (Binärformat Engine ↔ Editor)](SMS-003-datenvertrag-v1.md)
- [SMS-030 – Formations-Bühne & Pfad-Werkzeug](SMS-030-formations-buehne-pfad.md)

---
Kontext: [Projektplan](../PLAN.md)
