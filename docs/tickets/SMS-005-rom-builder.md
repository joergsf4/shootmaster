# SMS-005 – ROM-Builder

| Epic | Meilenstein | Größe | Status |
|---|---|---|---|
| A – Fundament | M0 | M | Offen |

## Beschreibung
Baut aus Engine-Binary und kompilierten Projektdaten eine gültige `.sms`-Datei.

## Akzeptanzkriterien
- [ ] Engine-Binary wird geladen, Daten-Banks ab erster freier Bank angehängt (Sega-Mapper, 16-KB-Banks)
- [ ] Zeigertabelle an Adresse aus `layout.json` gepatcht
- [ ] Header „TMR SEGA“ bei 0x7FF0, Produktcode, Version, Region (Export), ROM-Größencode
- [ ] Checksumme korrekt berechnet (gegen Referenz-Tool, z. B. Emulicious/MEKA geprüft)
- [ ] Padding auf Zweierpotenz (64/128/256/512 KB)
- [ ] Download als `<projektname>.sms` im Browser
- [ ] Klare Fehlermeldung, wenn Daten > 512 KB

## Abhängigkeiten
- [SMS-003 – Datenvertrag v1 (Binärformat Engine ↔ Editor)](SMS-003-datenvertrag-v1.md)
- [SMS-004 – sms-core: Hardware-Primitive](SMS-004-sms-core-hw-primitive.md)

---
Kontext: [Projektplan](../PLAN.md)
