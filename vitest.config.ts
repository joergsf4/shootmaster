import { defineConfig } from 'vitest/config';
// Headless-ROM-Tests emulieren tausende Frames und brauchen mehr als die 5 s Standard
export default defineConfig({ test: { include: ['packages/*/test/**/*.test.ts', 'apps/*/test/**/*.test.ts'], testTimeout: 30_000 } });
