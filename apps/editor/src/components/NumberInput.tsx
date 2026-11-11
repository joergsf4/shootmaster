import { useEffect, useId, useState } from 'react';

/** Getippten Text in einen gültigen Wert wandeln: auf step runden, auf min..max klemmen; leer/ungültig → null */
export function parseNum(text: string, min: number, max: number, step = 1): number | null {
  if (!text.trim()) return null;
  const n = Number(text.replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, +(Math.round(n / step) * step).toFixed(6)));
}

/**
 * Zahlenfeld: frei tippen, Übernahme erst bei Enter/Verlassen (geklemmt und gerundet), Esc verwirft.
 * Spinner und Pfeiltasten übernehmen sofort, je Feld als ein Undo-Schritt (coalesce); live=false: auch sie erst bei Enter.
 * onDraft meldet den Wert, den Enter übernehmen würde (null: nichts offen), z. B. für eine Vorwarnung.
 */
export function NumberInput({ value, min, max, step = 1, live = true, title, onCommit, onDraft }: {
  value: number; min: number; max: number; step?: number; live?: boolean; title?: string;
  onCommit: (n: number, coalesce?: string) => void; onDraft?: (n: number | null) => void;
}) {
  const key = useId();
  const [v, setV] = useState(String(value));
  useEffect(() => { setV(String(value)); }, [value]);
  const commit = (text: string, coalesce?: string) => {
    const n = parseNum(text, min, max, step);
    setV(String(value)); // leer/ungültig/geklemmt → angezeigten Wert zurücksetzen (bei Änderung überschreibt der Effekt)
    onDraft?.(null);
    // unverändert verlassen übernimmt nichts (auch wenn ein alter Wert außerhalb von min..max liegt)
    if (n !== null && n !== value && text !== String(value)) onCommit(n, coalesce);
  };
  return (
    <input type="number" min={min} max={max} step={step} value={v} title={title ?? `${min} bis ${max}`}
      onChange={(e) => {
        setV(e.target.value);
        // Spinner/Pfeiltasten liefern keinen inputType, Tippen und Einfügen schon
        if (live && !(e.nativeEvent as InputEvent).inputType) commit(e.target.value, key);
        else onDraft?.(parseNum(e.target.value, min, max, step));
      }}
      onBlur={(e) => commit(e.currentTarget.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') { e.currentTarget.value = String(value); e.currentTarget.blur(); }
      }} />
  );
}
