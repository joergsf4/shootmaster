# SMS-043 – Sprite-Multiplexing/Flicker

| Epic | Meilenstein | Größe | Status |
|---|---|---|---|
| E – Gameplay | M4 | M | Offen |

## Beschreibung
Umgang mit dem 8-Sprites-pro-Zeile-Limit.

## Akzeptanzkriterien
- [ ] Sprite-Reihenfolge rotiert jeden Frame, sodass bei Überlast geflackert statt verschluckt wird
- [ ] Spieler optional immer mit Priorität
- [ ] Sprite-Attributtabelle wird im VBlank per schneller ASM-Routine übertragen

## Abhängigkeiten
- [SMS-037 – Engine: Gegner-VM](SMS-037-engine-gegner-vm.md)

---
Kontext: [Projektplan](../PLAN.md)
