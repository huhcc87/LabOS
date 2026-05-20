import React, { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  content: string;
  className?: string;
  /** Render mermaid diagrams found in fenced code blocks */
  renderMermaid?: boolean;
}

export function MarkdownRenderer({ content, className = '', renderMermaid = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!renderMermaid || !containerRef.current) return;
    import('mermaid').then(({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false, theme: 'dark' });
      mermaid.run({ nodes: containerRef.current!.querySelectorAll('.mermaid') as NodeListOf<HTMLElement> });
    });
  }, [content, renderMermaid]);

  return (
    <div ref={containerRef} className={`markdown-body ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className: cls, children, ...props }) {
            const lang = /language-(\w+)/.exec(cls || '')?.[1];
            if (renderMermaid && lang === 'mermaid') {
              return <div className="mermaid">{String(children)}</div>;
            }
            return (
              <code
                className={cls}
                style={{
                  background: '#0d1b2a',
                  color: '#a8d5ff',
                  padding: '2px 6px',
                  borderRadius: 4,
                  fontSize: 13,
                }}
                {...props}
              >
                {children}
              </code>
            );
          },
          pre({ children }) {
            return (
              <pre style={{
                background: '#0d1b2a',
                border: '1px solid #2a4a67',
                borderRadius: 8,
                padding: '12px 16px',
                overflowX: 'auto',
                fontSize: 13,
              }}>
                {children}
              </pre>
            );
          },
          table({ children }) {
            return (
              <div style={{ overflowX: 'auto', margin: '12px 0' }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: 13,
                }}>
                  {children}
                </table>
              </div>
            );
          },
          th({ children }) {
            return (
              <th style={{
                background: '#13293d',
                border: '1px solid #2a4a67',
                padding: '6px 12px',
                textAlign: 'left',
                fontWeight: 600,
                color: '#a8d5ff',
              }}>
                {children}
              </th>
            );
          },
          td({ children }) {
            return (
              <td style={{
                border: '1px solid #1e3a54',
                padding: '6px 12px',
                color: '#c8d9ea',
              }}>
                {children}
              </td>
            );
          },
          blockquote({ children }) {
            return (
              <blockquote style={{
                borderLeft: '3px solid #2a6496',
                paddingLeft: 12,
                margin: '8px 0',
                color: '#8fa3b8',
                fontStyle: 'italic',
              }}>
                {children}
              </blockquote>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
