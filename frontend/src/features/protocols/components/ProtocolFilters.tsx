import React from 'react'
import type { ProtocolFilters } from '../types/protocol.types'
import { countActiveFilters, DEFAULT_FILTERS } from '../utils/protocolFilters'

interface Props {
  filters: ProtocolFilters
  onChange: (f: ProtocolFilters) => void
  activeCategory: string
  subcategories: { id: string; name: string }[]
}

const sel = (label: string, value: string, options: { value: string; label: string }[], onChange: (v: string) => void) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <label style={{ color: '#94a3b8', fontSize: 11 }}>{label}</label>
    <select value={value} onChange={e => onChange(e.target.value)} style={{
      background: '#1a1d27', border: '1px solid #2a2d3e', borderRadius: 6, color: '#e2e8f0',
      padding: '5px 8px', fontSize: 12, outline: 'none',
    }}>
      <option value="">All</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
)

const chk = (label: string, value: boolean, onChange: (v: boolean) => void) => (
  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: '#94a3b8', fontSize: 12 }}>
    <input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)} style={{ accentColor: '#6366f1' }} />
    {label}
  </label>
)

export default function ProtocolFiltersBar({ filters, onChange, activeCategory, subcategories }: Props) {
  const set = (key: keyof ProtocolFilters, val: any) => onChange({ ...filters, [key]: val })
  const activeCount = countActiveFilters({ ...filters, category: activeCategory || filters.category })

  return (
    <div style={{ background: '#1a1d27', border: '1px solid #2a2d3e', borderRadius: 8, padding: 12, marginBottom: 0 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
        {!activeCategory && sel('Source', filters.sourceType, [
          { value: 'pubmed', label: 'PubMed' }, { value: 'protocols_io', label: 'protocols.io' },
          { value: 'europe_pmc', label: 'Europe PMC' }, { value: 'crossref', label: 'Crossref' },
          { value: 'bio_protocol', label: 'Bio-protocol' }, { value: 'jove', label: 'JoVE' },
          { value: 'manual', label: 'Internal' }, { value: 'ai_generated', label: 'AI Generated' },
        ], v => set('sourceType', v))}
        {sel('Status', filters.approvalStatus, [
          { value: 'approved', label: 'Approved' }, { value: 'under_review', label: 'Under Review' },
          { value: 'draft', label: 'Draft' }, { value: 'archived', label: 'Archived' },
        ], v => set('approvalStatus', v))}
        {sel('Type', filters.protocolType, [
          { value: 'published', label: 'Published' }, { value: 'imported', label: 'Imported' },
          { value: 'internal', label: 'Internal' }, { value: 'ai_draft', label: 'AI Draft' },
        ], v => set('protocolType', v))}
        {subcategories.length > 0 && sel('Subcategory', filters.subcategory, subcategories.map(s => ({ value: s.id, label: s.name })), v => set('subcategory', v))}
        {sel('Difficulty', filters.difficulty, [
          { value: 'beginner', label: 'Beginner' }, { value: 'intermediate', label: 'Intermediate' },
          { value: 'advanced', label: 'Advanced' }, { value: 'expert', label: 'Expert' },
        ], v => set('difficulty', v))}
        {sel('BSL', filters.biosafetyLevel, [
          { value: 'BSL-1', label: 'BSL-1' }, { value: 'BSL-2', label: 'BSL-2' }, { value: 'BSL-3', label: 'BSL-3' },
        ], v => set('biosafetyLevel', v))}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {chk('Open Access Only', filters.openAccessOnly, v => set('openAccessOnly', v))}
          {chk('Has DOI', filters.hasDoi, v => set('hasDoi', v))}
          {chk('Has PMID', filters.hasPmid, v => set('hasPmid', v))}
        </div>
        {activeCount > 0 && (
          <button onClick={() => onChange(DEFAULT_FILTERS)} style={{
            background: '#ef444422', border: '1px solid #ef4444', borderRadius: 6, color: '#ef4444',
            padding: '5px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600,
          }}>
            Clear {activeCount} filter{activeCount > 1 ? 's' : ''}
          </button>
        )}
      </div>
    </div>
  )
}
