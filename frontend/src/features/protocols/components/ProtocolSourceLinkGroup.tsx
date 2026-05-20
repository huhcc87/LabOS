import React from 'react'

interface Props {
  doi?: string; pmid?: string; pmcid?: string; sourceUrl?: string; sourceName?: string
}

const linkBtn = (label: string, url: string, color: string) => (
  <a key={url} href={url} target="_blank" rel="noopener noreferrer" style={{
    display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px',
    borderRadius: 4, fontSize: 11, fontWeight: 600, textDecoration: 'none',
    background: 'transparent', border: `1px solid ${color}`, color, whiteSpace: 'nowrap',
    transition: 'background 0.15s',
  }}
    onMouseEnter={e => (e.currentTarget.style.background = color + '22')}
    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
  >
    🔗 {label}
  </a>
)

export default function ProtocolSourceLinkGroup({ doi, pmid, pmcid, sourceUrl, sourceName }: Props) {
  if (!doi && !pmid && !pmcid && !sourceUrl) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {doi && linkBtn(`DOI: ${doi}`, `https://doi.org/${doi}`, '#6366f1')}
      {pmid && linkBtn(`PMID: ${pmid}`, `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`, '#3b82f6')}
      {pmcid && linkBtn(`PMC: ${pmcid}`, `https://www.ncbi.nlm.nih.gov/pmc/articles/${pmcid}/`, '#10b981')}
      {sourceUrl && sourceName && linkBtn(sourceName, sourceUrl, '#94a3b8')}
    </div>
  )
}
