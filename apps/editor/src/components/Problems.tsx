import { useState } from 'react';
import type { DiagRef, Diagnostic, Use } from '@sms/core';
import { useStore } from '../store';

/** Wie Diagnostic, aber Compiler-Fehler (z. B. Bank voll) haben kein Sprungziel */
export type Problem = Omit<Diagnostic, 'ref'> & { ref?: DiagRef };

/** Badge „✖ 1 ⚠ 3“, Klick klappt die Liste auf, Klick auf einen Eintrag springt hin */
export function Problems({ items }: { items: Problem[] }) {
  const goto = useStore((s) => s.goto);
  const [open, setOpen] = useState(false);
  if (!items.length) return <span className="budget" data-tour="problems" title="Keine Fehler oder Warnungen">✓ Keine Probleme</span>;
  const errors = items.filter((d) => d.severity === 'error').length;
  return (
    <span className="problems" data-tour="problems">
      <button className={`budget ${errors ? 'bad' : 'warn'}`} onClick={() => setOpen(!open)} title="Fehler und Warnungen anzeigen">
        ✖ {errors} ⚠ {items.length - errors}
      </button>
      {open && (
        <ul className="problem-list">
          {items.map((d, i) => (
            <li key={i} className={`${d.severity} ${d.ref ? 'link' : ''}`} onClick={() => { if (d.ref) { goto(d.ref); setOpen(false); } }}>
              {d.severity === 'error' ? '✖' : '⚠'} {d.msg}
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}

/** Löschsperre: nennt die Verwender als Sprung-Links */
export function UsedBy({ what, users, onClose }: { what: string; users: Use[]; onClose: () => void }) {
  const goto = useStore((s) => s.goto);
  return (
    <div className="used-by">
      {what} wird noch verwendet von:
      {users.map((u, i) => <button key={i} onClick={() => goto(u.ref)}>{u.label}</button>)}
      <button onClick={onClose} title="Schließen">✕</button>
    </div>
  );
}
