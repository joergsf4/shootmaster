import { useEffect, useRef, useState } from 'react';
import type { DiagRef, Diagnostic, Use } from '@sms/core';
import { useStore } from '../store';

/** Wie Diagnostic, aber Compiler-Fehler (z. B. Bank voll) haben kein Sprungziel */
export type Problem = Omit<Diagnostic, 'ref'> & { ref?: DiagRef };

/** Badge „✖ 1 ⚠ 3“, Klick klappt die Liste auf, Klick auf einen Eintrag springt hin. Esc oder Klick daneben schließt. */
export function Problems({ items, open, setOpen }: { items: Problem[]; open: boolean; setOpen: (v: boolean) => void }) {
  const goto = useStore((s) => s.goto);
  const ref = useRef<HTMLSpanElement>(null);
  /** zuletzt angeklickter Eintrag (nach dem Sprung wieder auffindbar) */
  const [last, setLast] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    const kd = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const pd = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('keydown', kd);
    window.addEventListener('pointerdown', pd);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('pointerdown', pd); };
  }, [open, setOpen]);
  if (!items.length) return <span className="budget problems" data-tour="problems" title="Keine Fehler oder Warnungen">✓ Keine Probleme</span>;
  const errors = items.filter((d) => d.severity === 'error').length;
  const warns = items.length - errors;
  const sorted = [...items].sort((a, b) => (a.severity === 'error' ? 0 : 1) - (b.severity === 'error' ? 0 : 1));
  return (
    <span className="problems" data-tour="problems" ref={ref}>
      <button className={`budget ${errors ? 'bad' : 'warn'}`} onClick={() => setOpen(!open)} title="Fehler und Warnungen anzeigen">
        {[errors && `✖ ${errors}`, warns && `⚠ ${warns}`].filter(Boolean).join(' ')}
      </button>
      {open && (
        <ul className="problem-list">
          {sorted.map((d, i) => (
            <li key={i} className={`${d.severity} ${d.ref ? 'link' : ''} ${d.msg === last ? 'last' : ''}`} onClick={() => { setLast(d.msg); if (d.ref) { goto(d.ref); setOpen(false); } }}>
              {d.severity === 'error' ? '✖' : '⚠'} {d.msg}
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}

/** Löschsperre: nennt die Verwender als Sprung-Links; verschwindet, sobald keiner mehr übrig ist */
export function UsedBy({ what, users, onClose }: { what: string; users: Use[]; onClose: () => void }) {
  const goto = useStore((s) => s.goto);
  if (!users.length) return null;
  return (
    <div className="used-by">
      {what} kann nicht gelöscht werden – wähle dort erst etwas anderes:
      {users.map((u, i) => <button key={i} onClick={() => goto(u.ref)}>{u.label}</button>)}
      <button onClick={onClose} title="Schließen">✕</button>
    </div>
  );
}
