# SMS-001 – Monorepo-Setup

| Epic | Meilenstein | Größe | Status |
|---|---|---|---|
| A – Fundament | M0 | S | Offen |

## Beschreibung
Grundgerüst als pnpm-Workspace mit `apps/editor` (Vite + React + TypeScript), `packages/sms-core` (reines TS) und `engine/`. Einheitliches Linting/Formatting, Test-Runner und CI.

## Akzeptanzkriterien
- [ ] pnpm-Workspace mit `apps/editor`, `packages/sms-core`, `engine/` angelegt
- [ ] Vitest läuft für `sms-core` und `editor` (`pnpm test`)
- [ ] `pnpm dev` startet den Editor mit leerer Shell (Navigation zu allen geplanten Editoren als Platzhalter)
- [ ] ESLint + Prettier + `tsc --noEmit` im CI (GitHub Actions o. ä.)
- [ ] README mit Setup-Anleitung

## Abhängigkeiten
- keine

---
Kontext: [Projektplan](../PLAN.md)
