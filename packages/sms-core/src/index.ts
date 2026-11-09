export * from './types';
export * from './hw';
export * from './path';
export * from './compile';
export * from './rom';
export * from './sound';
export { createDemoProject, upgradeProject } from './demo';
export { validateProject } from './validate';
export { ENGINE_BASE64 } from './generated/engine';

import { ENGINE_BASE64 } from './generated/engine';
export function engineBinary(): Uint8Array {
  const s = atob(ENGINE_BASE64);
  const a = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
  return a;
}
