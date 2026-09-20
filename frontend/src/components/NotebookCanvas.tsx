import React, { useEffect, useRef, useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
type Tool = 'pen' | 'highlighter' | 'eraser';

interface Stroke {
  tool: Tool;
  color: string;
  width: number;     // base stroke width in px (pre-pressure)
  points: Point[];   // x,y are 0..1 normalized to page width / page height
}

interface Point {
  x: number;        // normalized 0..1 of page width
  y: number;        // normalized 0..1 of page height
  p: number;        // pressure 0..1 (defaults to 0.5 for non-pressure input)
}

interface PageData {
  strokes: Stroke[];
}

export interface NotebookCanvasValue {
  version: 1;
  pages: PageData[];
  paperStyle?: PaperStyle;
}

type PaperStyle = 'blank' | 'ruled' | 'grid' | 'dot';

interface Props {
  value?: NotebookCanvasValue;
  onChange?: (v: NotebookCanvasValue) => void;
  readOnly?: boolean;
  // Letter-portrait aspect by default: 8.5 x 11 in → 0.7727
  aspectRatio?: number;
  initialPages?: number;
}

// ─── Color & tool presets ─────────────────────────────────────────────────────
const PEN_COLORS = ['#0f172a', '#1e3a8a', '#7f1d1d', '#14532d', '#6b21a8', '#0e7490'];
const HIGHLIGHTER_COLORS = ['#fde047cc', '#86efaccc', '#7dd3fccc', '#fda4afcc', '#fdba74cc'];
const PEN_WIDTHS = [1.2, 2, 3, 4.5];
const HL_WIDTHS = [10, 16, 24];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function emptyValue(initialPages: number, paperStyle: PaperStyle = 'blank'): NotebookCanvasValue {
  return {
    version: 1,
    paperStyle,
    pages: Array.from({ length: initialPages }, () => ({ strokes: [] })),
  };
}

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, style: PaperStyle) {
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);

  if (style === 'ruled') {
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    const gap = h / 28;
    for (let y = gap * 2; y < h; y += gap) {
      ctx.beginPath();
      ctx.moveTo(w * 0.06, y);
      ctx.lineTo(w * 0.96, y);
      ctx.stroke();
    }
    // red margin
    ctx.strokeStyle = '#fecaca';
    ctx.beginPath();
    ctx.moveTo(w * 0.1, 0);
    ctx.lineTo(w * 0.1, h);
    ctx.stroke();
  } else if (style === 'grid') {
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 0.6;
    const gap = w / 40;
    for (let x = gap; x < w; x += gap) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = gap; y < h; y += gap) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
  } else if (style === 'dot') {
    ctx.fillStyle = '#cbd5e1';
    const gap = w / 40;
    for (let x = gap; x < w; x += gap) {
      for (let y = gap; y < h; y += gap) {
        ctx.beginPath();
        ctx.arc(x, y, 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

function drawStroke(ctx: CanvasRenderingContext2D, w: number, h: number, s: Stroke) {
  if (s.points.length < 2) {
    // single dot
    if (s.points.length === 1) {
      const p = s.points[0];
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, s.width * (0.5 + p.p) * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  ctx.save();
  if (s.tool === 'highlighter') {
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.7;
  }
  ctx.strokeStyle = s.color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let i = 1; i < s.points.length; i++) {
    const a = s.points[i - 1], b = s.points[i];
    // pressure-based width (pen only)
    const avgP = (a.p + b.p) / 2;
    const lw = s.tool === 'highlighter' ? s.width : s.width * (0.45 + avgP * 1.1);
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(a.x * w, a.y * h);
    // quadratic smoothing for nicer curves
    if (i < s.points.length - 1) {
      const c = s.points[i + 1];
      const mx = (b.x + c.x) / 2;
      const my = (b.y + c.y) / 2;
      ctx.quadraticCurveTo(b.x * w, b.y * h, mx * w, my * h);
    } else {
      ctx.lineTo(b.x * w, b.y * h);
    }
    ctx.stroke();
  }
  ctx.restore();
}

// ─── Single Page component ────────────────────────────────────────────────────
const NotebookPage = React.memo(function NotebookPage({
  pageIdx, page, paperStyle, aspect, readOnly,
  tool, color, width,
  onStroke, onUndoRequested,
}: {
  pageIdx: number;
  page: PageData;
  paperStyle: PaperStyle;
  aspect: number;
  readOnly: boolean;
  tool: Tool;
  color: string;
  width: number;
  onStroke: (pageIdx: number, stroke: Stroke) => void;
  onUndoRequested?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const drawingRef = useRef<Stroke | null>(null);
  const sizeRef = useRef({ w: 0, h: 0 });

  // Resize observer to keep canvas sharp at any size
  useEffect(() => {
    const wrap = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ro = new ResizeObserver(() => {
      const rect = wrap.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      sizeRef.current = { w: rect.width, h: rect.height };
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        redraw();
      }
    });
    ro.observe(wrap);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw whenever strokes change
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    if (w === 0 || h === 0) return;
    drawBackground(ctx, w, h, paperStyle);
    for (const s of page.strokes) drawStroke(ctx, w, h, s);
    if (drawingRef.current) drawStroke(ctx, w, h, drawingRef.current);
  }, [page.strokes, paperStyle]);

  useEffect(() => { redraw(); }, [redraw]);

  // Pointer handlers
  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    // pressure: pen reports 0..1, touch usually 0, mouse always 0.5
    let p = e.pressure;
    if (e.pointerType === 'mouse') p = 0.5;
    if (!p || p < 0.02) p = 0.5;
    return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)), p };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (readOnly) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);

    if (tool === 'eraser') {
      // Erase: hit-test existing strokes, drop any that intersect the touch point
      const pt = getPoint(e);
      const remaining = page.strokes.filter(s => !strokeContainsPoint(s, pt, 0.02));
      if (remaining.length !== page.strokes.length) {
        // Replace with eraser stroke marker (a no-op stroke to trigger update)
        // We'll push the changes through by emitting a "synthetic" stroke containing the
        // erased points encoded as a delete operation. Simpler: just emit each remaining
        // stroke through a full replace.
        onStroke(pageIdx, { tool: 'eraser', color: '', width: 0, points: [] }); // signal: caller knows to replace
        // Update page in place via direct call (parent does immutable update)
        (page as any).__erasedSnapshot = remaining;
      }
      return;
    }

    drawingRef.current = {
      tool,
      color,
      width,
      points: [getPoint(e)],
    };
    redraw();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || readOnly) return;
    const pt = getPoint(e);
    const last = drawingRef.current.points[drawingRef.current.points.length - 1];
    const dx = pt.x - last.x, dy = pt.y - last.y;
    if (dx * dx + dy * dy < 0.000004) return; // filter tiny moves
    drawingRef.current.points.push(pt);
    redraw();
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    canvasRef.current?.releasePointerCapture(e.pointerId);
    if (drawingRef.current) {
      const stroke = drawingRef.current;
      drawingRef.current = null;
      if (stroke.points.length >= 1) onStroke(pageIdx, stroke);
    }
  };

  // Keep canvas aspect ratio
  return (
    <div
      ref={wrapperRef}
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: String(aspect),
        background: '#ffffff',
        boxShadow: '0 1px 0 rgba(15,23,42,0.05), 0 6px 24px rgba(15,23,42,0.08)',
        borderRadius: 6,
        marginBottom: 20,
        overflow: 'hidden',
      }}
    >
      {/* Page number */}
      <div style={{
        position: 'absolute', bottom: 6, right: 14, fontSize: 11, color: '#94a3b8',
        fontFamily: 'ui-serif, Georgia, serif', userSelect: 'none', pointerEvents: 'none',
      }}>
        — {pageIdx + 1} —
      </div>
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          display: 'block',
          touchAction: 'none',     // prevent scroll while drawing on touch / stylus
          cursor: readOnly ? 'default' : (tool === 'eraser' ? 'cell' : 'crosshair'),
        }}
      />
    </div>
  );
});

function strokeContainsPoint(s: Stroke, pt: Point, tol: number): boolean {
  // simple bbox + per-point distance test
  let minX = 1, minY = 1, maxX = 0, maxY = 0;
  for (const p of s.points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  if (pt.x < minX - tol || pt.x > maxX + tol) return false;
  if (pt.y < minY - tol || pt.y > maxY + tol) return false;
  const tol2 = tol * tol;
  for (const p of s.points) {
    const dx = p.x - pt.x, dy = p.y - pt.y;
    if (dx * dx + dy * dy < tol2) return true;
  }
  return false;
}

// ─── Main NotebookCanvas ──────────────────────────────────────────────────────
export default function NotebookCanvas({
  value, onChange, readOnly = false, aspectRatio = 0.7727, initialPages = 1,
}: Props) {
  const [internal, setInternal] = useState<NotebookCanvasValue>(
    () => value && value.pages?.length ? value : emptyValue(initialPages, value?.paperStyle)
  );
  const [tool, setTool] = useState<Tool>('pen');
  const [penColor, setPenColor] = useState(PEN_COLORS[0]);
  const [hlColor, setHlColor] = useState(HIGHLIGHTER_COLORS[0]);
  const [penWidth, setPenWidth] = useState(PEN_WIDTHS[1]);
  const [hlWidth, setHlWidth] = useState(HL_WIDTHS[0]);
  const [paperStyle, setPaperStyle] = useState<PaperStyle>(internal.paperStyle || 'blank');

  // Undo stack (last 100 strokes)
  const undoStackRef = useRef<{ pageIdx: number; stroke: Stroke }[]>([]);

  // Sync external value
  useEffect(() => {
    if (value && value !== internal && value.pages?.length) setInternal(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Emit changes
  const commit = useCallback((next: NotebookCanvasValue) => {
    setInternal(next);
    onChange?.(next);
  }, [onChange]);

  const handleStroke = (pageIdx: number, stroke: Stroke) => {
    setInternal(prev => {
      const erased = (prev.pages[pageIdx] as any).__erasedSnapshot as Stroke[] | undefined;
      const pages = prev.pages.slice();
      if (stroke.tool === 'eraser' && erased) {
        delete (prev.pages[pageIdx] as any).__erasedSnapshot;
        pages[pageIdx] = { strokes: erased };
      } else {
        pages[pageIdx] = { strokes: [...prev.pages[pageIdx].strokes, stroke] };
        undoStackRef.current.push({ pageIdx, stroke });
        if (undoStackRef.current.length > 100) undoStackRef.current.shift();
      }
      const next = { ...prev, pages };
      onChange?.(next);
      return next;
    });
  };

  const undo = () => {
    const last = undoStackRef.current.pop();
    if (!last) return;
    setInternal(prev => {
      const pages = prev.pages.slice();
      const cur = pages[last.pageIdx];
      pages[last.pageIdx] = { strokes: cur.strokes.slice(0, -1) };
      const next = { ...prev, pages };
      onChange?.(next);
      return next;
    });
  };

  const addPage = () => {
    commit({ ...internal, pages: [...internal.pages, { strokes: [] }] });
  };

  const removeLastPage = () => {
    if (internal.pages.length <= 1) return;
    commit({ ...internal, pages: internal.pages.slice(0, -1) });
  };

  const clearAll = () => {
    if (!confirm('Erase all handwriting? This cannot be undone.')) return;
    undoStackRef.current = [];
    commit({ ...internal, pages: internal.pages.map(() => ({ strokes: [] })) });
  };

  const setPaperStyleAndCommit = (s: PaperStyle) => {
    setPaperStyle(s);
    commit({ ...internal, paperStyle: s });
  };

  const activeColor = tool === 'highlighter' ? hlColor : penColor;
  const activeWidth = tool === 'highlighter' ? hlWidth : penWidth;
  const totalStrokes = internal.pages.reduce((n, p) => n + p.strokes.length, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Toolbar */}
      {!readOnly && (
        <div style={{
          position: 'sticky', top: 0, zIndex: 5,
          background: 'var(--surface, #fff)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '10px 12px',
          display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center',
          boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
        }}>
          {/* Tool group */}
          <div style={{ display: 'inline-flex', gap: 4, padding: 3, background: 'var(--surface2, #f1f5f9)', borderRadius: 8 }}>
            {([
              { id: 'pen' as Tool,         icon: '🖊️', label: 'Pen' },
              { id: 'highlighter' as Tool, icon: '🖍️', label: 'Highlight' },
              { id: 'eraser' as Tool,      icon: '🧽', label: 'Erase' },
            ]).map(t => (
              <button key={t.id} onClick={() => setTool(t.id)}
                style={{
                  padding: '5px 10px', border: 'none', borderRadius: 6, cursor: 'pointer',
                  fontSize: 13, fontWeight: 600,
                  background: tool === t.id ? 'var(--accent, #6366f1)' : 'transparent',
                  color: tool === t.id ? '#fff' : 'var(--text, #0f172a)',
                }} title={t.label}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* Color */}
          {tool !== 'eraser' && (
            <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              {(tool === 'highlighter' ? HIGHLIGHTER_COLORS : PEN_COLORS).map(c => {
                const isActive = (tool === 'highlighter' ? hlColor : penColor) === c;
                return (
                  <button key={c} onClick={() => tool === 'highlighter' ? setHlColor(c) : setPenColor(c)}
                    style={{
                      width: 22, height: 22, borderRadius: '50%', cursor: 'pointer',
                      background: c, border: '2px solid ' + (isActive ? 'var(--accent, #6366f1)' : 'transparent'),
                      boxShadow: '0 0 0 1px rgba(15,23,42,0.1)',
                    }} title={c}
                  />
                );
              })}
            </div>
          )}

          {/* Width */}
          {tool !== 'eraser' && (
            <div style={{ display: 'inline-flex', gap: 4, padding: 3, background: 'var(--surface2, #f1f5f9)', borderRadius: 8 }}>
              {(tool === 'highlighter' ? HL_WIDTHS : PEN_WIDTHS).map(w => {
                const isActive = (tool === 'highlighter' ? hlWidth : penWidth) === w;
                return (
                  <button key={w} onClick={() => tool === 'highlighter' ? setHlWidth(w) : setPenWidth(w)}
                    style={{
                      width: 28, height: 24, border: 'none', borderRadius: 6, cursor: 'pointer',
                      background: isActive ? 'var(--accent, #6366f1)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }} title={`${w}px`}
                  >
                    <span style={{
                      display: 'inline-block',
                      width: tool === 'highlighter' ? 16 : Math.min(14, w * 2),
                      height: tool === 'highlighter' ? 8 : Math.min(14, w * 2),
                      background: isActive ? '#fff' : activeColor,
                      borderRadius: tool === 'highlighter' ? 2 : '50%',
                    }} />
                  </button>
                );
              })}
            </div>
          )}

          {/* Paper style */}
          <div style={{ display: 'inline-flex', gap: 4, padding: 3, background: 'var(--surface2, #f1f5f9)', borderRadius: 8 }}>
            {(['blank', 'ruled', 'grid', 'dot'] as PaperStyle[]).map(s => (
              <button key={s} onClick={() => setPaperStyleAndCommit(s)}
                style={{
                  padding: '4px 10px', border: 'none', borderRadius: 6, cursor: 'pointer',
                  fontSize: 12, fontWeight: 600,
                  background: paperStyle === s ? 'var(--accent, #6366f1)' : 'transparent',
                  color: paperStyle === s ? '#fff' : 'var(--text, #0f172a)',
                }} title={s}
              >
                {s === 'blank' ? '□' : s === 'ruled' ? '≡' : s === 'grid' ? '⊞' : '⋮⋮'} {s}
              </button>
            ))}
          </div>

          <div style={{ flex: 1 }} />

          {/* Actions */}
          <button onClick={undo} disabled={undoStackRef.current.length === 0}
            style={{ padding: '5px 10px', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', background: 'var(--surface, #fff)', color: 'var(--text, #0f172a)', fontSize: 12, fontWeight: 600 }}>
            ↶ Undo
          </button>
          <button onClick={clearAll}
            style={{ padding: '5px 10px', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', background: 'var(--surface, #fff)', color: '#ef4444', fontSize: 12, fontWeight: 600 }}>
            Clear all
          </button>
        </div>
      )}

      {/* Pages */}
      <div style={{
        background: 'var(--surface2, #f1f5f9)',
        padding: 20,
        borderRadius: 12,
        maxHeight: '70vh',
        overflowY: 'auto',
        border: '1px solid var(--border)',
      }}>
        {internal.pages.map((pg, i) => (
          <NotebookPage
            key={i}
            pageIdx={i}
            page={pg}
            paperStyle={paperStyle}
            aspect={aspectRatio}
            readOnly={readOnly}
            tool={tool}
            color={activeColor}
            width={activeWidth}
            onStroke={handleStroke}
          />
        ))}

        {/* Page controls */}
        {!readOnly && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 4 }}>
            <button onClick={addPage}
              style={{ padding: '8px 16px', border: '1px dashed var(--border)', borderRadius: 8, background: 'transparent', color: 'var(--text-muted, #64748b)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              + Add another white page
            </button>
            {internal.pages.length > 1 && (
              <button onClick={removeLastPage}
                style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface, #fff)', color: 'var(--text-muted, #64748b)', cursor: 'pointer', fontSize: 13 }}>
                Remove last page
              </button>
            )}
          </div>
        )}
      </div>

      {!readOnly && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted, #64748b)' }}>
          <span>{internal.pages.length} page{internal.pages.length > 1 ? 's' : ''} · {totalStrokes} stroke{totalStrokes === 1 ? '' : 's'}</span>
          <span>✍️ Use Apple Pencil, S Pen, or any stylus for pressure-sensitive writing</span>
        </div>
      )}
    </div>
  );
}

// Helper for callers
export function serializeNotebookCanvas(v: NotebookCanvasValue): string {
  return JSON.stringify(v);
}

export function parseNotebookCanvas(raw: string | null | undefined): NotebookCanvasValue | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.version === 1 && Array.isArray(parsed.pages)) return parsed as NotebookCanvasValue;
    return null;
  } catch { return null; }
}
