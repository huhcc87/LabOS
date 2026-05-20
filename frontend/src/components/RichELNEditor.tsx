import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import Typography from '@tiptap/extension-typography';
import Underline from '@tiptap/extension-underline';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import Link from '@tiptap/extension-link';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RichELNEditorProps {
  initialContent?: string;  // HTML string
  onChange?: (html: string) => void;
  readOnly?: boolean;
  placeholder?: string;
}

// ─── Tiptap-specific CSS injected once ───────────────────────────────────────

const TIPTAP_CSS = `
.ProseMirror { outline: none; min-height: 350px; padding: 16px; }
.ProseMirror p.is-editor-empty:first-child::before { color: #adb5bd; content: attr(data-placeholder); float: left; height: 0; pointer-events: none; }
.ProseMirror table { border-collapse: collapse; width: 100%; margin: 12px 0; }
.ProseMirror td, .ProseMirror th { border: 1px solid #e2e8f0; padding: 8px 10px; min-width: 80px; }
.ProseMirror th { background: #f8fafc; font-weight: 600; }
.ProseMirror ul[data-type="taskList"] { list-style: none; padding-left: 0; }
.ProseMirror ul[data-type="taskList"] li { display: flex; gap: 8px; align-items: flex-start; }
.ProseMirror ul[data-type="taskList"] li > label { margin-top: 2px; }
.ProseMirror blockquote { border-left: 3px solid #6366f1; margin: 0; padding-left: 16px; color: #64748b; }
.ProseMirror hr { border: none; border-top: 2px solid #e2e8f0; margin: 16px 0; }
.ProseMirror h1 { font-size: 1.6em; font-weight: 700; margin: 16px 0 8px; }
.ProseMirror h2 { font-size: 1.3em; font-weight: 700; margin: 14px 0 6px; }
.ProseMirror h3 { font-size: 1.1em; font-weight: 600; margin: 12px 0 4px; }
`;

let cssInjected = false;

function injectTiptapCSS() {
  if (cssInjected) return;
  const style = document.createElement('style');
  style.id = 'tiptap-eln-styles';
  style.textContent = TIPTAP_CSS;
  document.head.appendChild(style);
  cssInjected = true;
}

// ─── Toolbar button helper ────────────────────────────────────────────────────

interface ToolbarButtonProps {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}

function ToolbarButton({ onClick, active, disabled, title, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      style={{
        padding: '3px 9px',
        border: active ? '1px solid #6366f1' : '1px solid transparent',
        borderRadius: 6,
        background: active ? 'rgba(99,102,241,0.15)' : 'transparent',
        color: active ? '#6366f1' : 'inherit',
        cursor: disabled ? 'default' : 'pointer',
        fontSize: 13,
        fontWeight: active ? 700 : 500,
        opacity: disabled ? 0.4 : 1,
        transition: 'all 0.12s',
        lineHeight: 1.4,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 28,
      }}
      onMouseEnter={e => {
        if (!disabled && !active) {
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.06)';
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.background = active ? 'rgba(99,102,241,0.15)' : 'transparent';
        }
      }}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return (
    <span style={{
      width: 1,
      height: 20,
      background: '#e2e8f0',
      margin: '0 4px',
      display: 'inline-block',
      verticalAlign: 'middle',
    }} />
  );
}

// ─── Word count helper ────────────────────────────────────────────────────────

function wordCount(html: string): number {
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return text ? text.split(' ').length : 0;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RichELNEditor({
  initialContent = '',
  onChange,
  readOnly = false,
  placeholder = 'Start writing your experiment notes…',
}: RichELNEditorProps) {
  // Inject CSS once on mount
  useEffect(() => {
    injectTiptapCSS();
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Highlight,
      Typography,
      Underline,
      TaskList,
      TaskItem.configure({ nested: false }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Link.configure({ openOnClick: false }),
    ],
    content: initialContent || '',
    editable: !readOnly,
    onUpdate({ editor }) {
      onChange?.(editor.getHTML());
    },
    editorProps: {
      attributes: {
        'data-placeholder': placeholder,
      },
    },
  });

  // Sync initialContent if it changes from outside (e.g. switching entries)
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (initialContent !== current) {
      editor.commands.setContent(initialContent || '');
    }
  }, [initialContent, editor]);

  // ── Toolbar actions ──────────────────────────────────────────────────────

  const insertTable = () => {
    if (!editor) return;
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  const exportHTML = () => {
    if (!editor) return;
    const html = `<!DOCTYPE html>\n<html>\n<head><meta charset="utf-8"><title>Lab Notebook Export</title></head>\n<body>${editor.getHTML()}</body>\n</html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `lab-notes-${new Date().toISOString().slice(0, 10)}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const copyAsMarkdown = () => {
    if (!editor) return;
    // Basic HTML-to-text conversion (reasonable for notes)
    let md = editor.getHTML()
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
      .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
      .replace(/<u[^>]*>(.*?)<\/u>/gi, '_$1_')
      .replace(/<s[^>]*>(.*?)<\/s>/gi, '~~$1~~')
      .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, '> $1\n')
      .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    navigator.clipboard.writeText(md).catch(() => {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = md;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    });
  };

  const currentHTML = editor?.getHTML() ?? '';
  const wc = wordCount(currentHTML);

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div style={{
      border: '1px solid #e2e8f0',
      borderRadius: 10,
      overflow: 'hidden',
      background: '#fff',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      {/* Toolbar */}
      {!readOnly && (
        <div style={{
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          padding: '6px 10px',
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 2,
          userSelect: 'none',
        }}>
          {/* Text format */}
          <ToolbarButton
            title="Bold (⌘B)"
            active={editor?.isActive('bold')}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          >
            <strong>B</strong>
          </ToolbarButton>
          <ToolbarButton
            title="Italic (⌘I)"
            active={editor?.isActive('italic')}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          >
            <em>I</em>
          </ToolbarButton>
          <ToolbarButton
            title="Underline (⌘U)"
            active={editor?.isActive('underline')}
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
          >
            <span style={{ textDecoration: 'underline' }}>U</span>
          </ToolbarButton>
          <ToolbarButton
            title="Strikethrough"
            active={editor?.isActive('strike')}
            onClick={() => editor?.chain().focus().toggleStrike().run()}
          >
            <span style={{ textDecoration: 'line-through' }}>S</span>
          </ToolbarButton>

          <ToolbarDivider />

          {/* Headings */}
          <ToolbarButton
            title="Heading 1"
            active={editor?.isActive('heading', { level: 1 })}
            onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
          >
            H1
          </ToolbarButton>
          <ToolbarButton
            title="Heading 2"
            active={editor?.isActive('heading', { level: 2 })}
            onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            H2
          </ToolbarButton>
          <ToolbarButton
            title="Heading 3"
            active={editor?.isActive('heading', { level: 3 })}
            onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
          >
            H3
          </ToolbarButton>

          <ToolbarDivider />

          {/* Lists */}
          <ToolbarButton
            title="Bullet List"
            active={editor?.isActive('bulletList')}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          >
            &#8226;&#8226;
          </ToolbarButton>
          <ToolbarButton
            title="Ordered List"
            active={editor?.isActive('orderedList')}
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          >
            1&#46;2
          </ToolbarButton>
          <ToolbarButton
            title="Task List"
            active={editor?.isActive('taskList')}
            onClick={() => editor?.chain().focus().toggleTaskList().run()}
          >
            ☑
          </ToolbarButton>

          <ToolbarDivider />

          {/* Block elements */}
          <ToolbarButton
            title="Blockquote"
            active={editor?.isActive('blockquote')}
            onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          >
            ❝
          </ToolbarButton>
          <ToolbarButton
            title="Insert 3×3 Table"
            active={false}
            onClick={insertTable}
          >
            ⊞
          </ToolbarButton>
          <ToolbarButton
            title="Horizontal Rule"
            active={false}
            onClick={() => editor?.chain().focus().setHorizontalRule().run()}
          >
            ─
          </ToolbarButton>

          <ToolbarDivider />

          {/* Undo / Redo */}
          <ToolbarButton
            title="Undo (⌘Z)"
            disabled={!editor?.can().undo()}
            onClick={() => editor?.chain().focus().undo().run()}
          >
            ↩
          </ToolbarButton>
          <ToolbarButton
            title="Redo (⌘⇧Z)"
            disabled={!editor?.can().redo()}
            onClick={() => editor?.chain().focus().redo().run()}
          >
            ↪
          </ToolbarButton>

          {/* Word count — right-aligned */}
          <span style={{
            marginLeft: 'auto',
            fontSize: 11,
            color: '#94a3b8',
            fontVariantNumeric: 'tabular-nums',
            paddingRight: 4,
            whiteSpace: 'nowrap',
          }}>
            {wc} word{wc !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Editor area */}
      <EditorContent
        editor={editor}
        style={{
          minHeight: 350,
          background: '#fff',
          color: '#1e293b',
          fontSize: 14,
          lineHeight: 1.7,
        }}
      />

      {/* Export buttons */}
      {!readOnly && (
        <div style={{
          borderTop: '1px solid #e2e8f0',
          background: '#f8fafc',
          padding: '8px 12px',
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}>
          <button
            type="button"
            onClick={copyAsMarkdown}
            style={exportBtnStyle}
            title="Copy content as Markdown to clipboard"
          >
            📋 Copy as Markdown
          </button>
          <button
            type="button"
            onClick={exportHTML}
            style={exportBtnStyle}
            title="Download as HTML file"
          >
            ⬇ Export HTML
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            style={exportBtnStyle}
            title="Print notes"
          >
            🖨 Print
          </button>
        </div>
      )}
    </div>
  );
}

const exportBtnStyle: React.CSSProperties = {
  padding: '5px 12px',
  border: '1px solid #e2e8f0',
  borderRadius: 7,
  background: '#fff',
  color: '#475569',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 500,
  transition: 'all 0.12s',
};

export default RichELNEditor;
