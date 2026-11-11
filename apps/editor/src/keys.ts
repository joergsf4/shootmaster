const NOT_TEXT = new Set(['checkbox', 'radio', 'range', 'button', 'submit', 'reset', 'file', 'color']);

/** Text-/Zahlenfeld, TEXTAREA oder contenteditable: Dort gehören Tasten dem Feld, Kürzel (Strg+Z, P, Entf, Pfeile) greifen nicht. */
export function isTextEntry(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el?.tagName) return false;
  if (el.isContentEditable || el.tagName === 'TEXTAREA') return true;
  return el.tagName === 'INPUT' && !NOT_TEXT.has((el as HTMLInputElement).type);
}
