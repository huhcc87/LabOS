import { useEffect } from 'react';

// A USB scanner types far faster than a person. Gaps are looser when no text box has focus,
// tighter inside a text box so fast human typing there is never mistaken for a scan.
const GAP_PAGE_MS = 80;
const GAP_FIELD_MS = 35;
const MIN_PAGE = 4;
const MIN_FIELD = 6;
const IDLE_MS = 150; // some scanners send no Enter: finish the code when typing stops

type Field = HTMLInputElement | HTMLTextAreaElement;
const textField = (el: Element | null): Field | null =>
  el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el : null;

/** Take the scanned characters back out of the text box they were typed into (React-aware). */
function unType(el: Field, text: string): void {
  if (!el.value.endsWith(text)) return;
  const proto = el instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, el.value.slice(0, -text.length));
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * A USB barcode scanner acts like a keyboard: it types the code very fast, usually ending with Enter.
 * Catch that burst anywhere in the app — even if a text box has focus — and hand the code over.
 */
export function useScannerWedge(enabled: boolean, onScan: (code: string) => void): void {
  useEffect(() => {
    if (!enabled) return;
    let buf = '';
    let last = 0;
    let field: Field | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const minLen = () => (field ? MIN_FIELD : MIN_PAGE);
    const finish = () => {
      clearTimeout(timer);
      const code = buf.trim();
      const target = field;
      buf = ''; field = null;
      if (code.length < (target ? MIN_FIELD : MIN_PAGE)) return;
      if (target) unType(target, code);
      onScan(code);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const now = performance.now();
      const active = textField(document.activeElement);
      if (now - last > (active ? GAP_FIELD_MS : GAP_PAGE_MS) || active !== field) { buf = ''; field = active; }
      last = now;
      if (e.key === 'Enter' || e.key === 'Tab') {
        if (buf.length >= minLen()) { e.preventDefault(); e.stopPropagation(); finish(); }
        else buf = '';
        return;
      }
      if (e.key.length !== 1) return;
      buf += e.key;
      clearTimeout(timer);
      timer = setTimeout(() => { if (buf.length >= minLen() * 2) finish(); else { buf = ''; field = null; } }, IDLE_MS);
    };
    window.addEventListener('keydown', onKey, true);
    return () => { window.removeEventListener('keydown', onKey, true); clearTimeout(timer); };
  }, [enabled, onScan]);
}
