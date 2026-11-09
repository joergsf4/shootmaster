# SMS-037 – Engine: Gegner-VM

| Epic | Meilenstein | Größe | Status |
|---|---|---|---|
| D – Formationen & Gegner | M3 | L | Offen |

## Beschreibung
Interpreter für Formations-Bytecode in der Engine.

## Akzeptanzkriterien
- [ ] Fester Objekt-Pool, Größen in `layout.json` dokumentiert und im Editor sichtbar
- [ ] Bytecode-Interpreter für alle Befehle aus SMS-003
- [ ] Trigger aus Ereignisliste werden bei Erreichen der Scrollposition ausgelöst
- [ ] Gegner außerhalb des Bildschirms (mit Rand) werden freigegeben
- [ ] Performance: 16 Gegner + 24 Projektile in < 70 % Frame-Budget

## Abhängigkeiten
- [SMS-026 – Engine: Scrolling & Streaming H/V](SMS-026-engine-scroll-streaming.md)
- [SMS-036 – Pfad-Backen](SMS-036-pfad-backen.md)

---
Kontext: [Projektplan](../PLAN.md)
