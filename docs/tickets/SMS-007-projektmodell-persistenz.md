# SMS-007 – Projektmodell & Persistenz

| Epic | Meilenstein | Größe | Status |
|---|---|---|---|
| A – Fundament | M0 | M | Offen |

## Beschreibung
Datenmodell des gesamten Projekts als versioniertes JSON, mit globalem Store, Undo/Redo und Autosave.

## Akzeptanzkriterien
- [ ] JSON-Schema (z. B. zod) mit `formatVersion`; Migrationsfunktionen pro Version + Tests
- [ ] Zustand-Store mit Immer-Patches für Undo/Redo (mind. 100 Schritte, Strg+Z / Strg+Y)
- [ ] Autosave in IndexedDB (debounced), Projektliste mit Anlegen/Umbenennen/Löschen
- [ ] Export/Import als `.json` (oder `.zip` inkl. Originalbilder)
- [ ] Reload des Browsers stellt den letzten Stand vollständig wieder her

## Abhängigkeiten
- [SMS-001 – Monorepo-Setup](SMS-001-monorepo-setup.md)

---
Kontext: [Projektplan](../PLAN.md)
