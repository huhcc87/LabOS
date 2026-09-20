import type { Protocol, ProtocolFilters } from '../types/protocol.types'

export const DEFAULT_FILTERS: ProtocolFilters = {
  search: '', category: '', subcategory: '', sourceType: '', approvalStatus: '',
  protocolType: '', year: '', organism: '', difficulty: '', biosafetyLevel: '',
  openAccessOnly: false, hasDoi: false, hasPmid: false,
}

export function applyFilters(protocols: Protocol[], filters: ProtocolFilters): Protocol[] {
  return protocols.filter(p => {
    if (filters.search) {
      const q = filters.search.toLowerCase()
      const hit = (
        p.title.toLowerCase().includes(q) ||
        p.summary.toLowerCase().includes(q) ||
        p.abstract.toLowerCase().includes(q) ||
        p.tags.some(t => t.toLowerCase().includes(q)) ||
        p.keywords.some(k => k.toLowerCase().includes(q)) ||
        p.authors.some(a => a.toLowerCase().includes(q)) ||
        (p.doi?.toLowerCase().includes(q) ?? false) ||
        (p.pmid?.includes(q) ?? false) ||
        p.subcategory.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      )
      if (!hit) return false
    }
    if (filters.category && p.category !== filters.category) return false
    if (filters.subcategory && p.subcategory !== filters.subcategory) return false
    if (filters.sourceType && p.sourceType !== filters.sourceType) return false
    if (filters.approvalStatus && p.approvalStatus !== filters.approvalStatus) return false
    if (filters.protocolType && p.protocolType !== filters.protocolType) return false
    if (filters.year && String(p.publicationYear) !== filters.year) return false
    if (filters.organism && p.organism && !p.organism.toLowerCase().includes(filters.organism.toLowerCase())) return false
    if (filters.difficulty && p.difficulty !== filters.difficulty) return false
    if (filters.biosafetyLevel && p.biosafetyLevel !== filters.biosafetyLevel) return false
    if (filters.openAccessOnly && !p.references.some(r => r.openAccess)) return false
    if (filters.hasDoi && !p.doi) return false
    if (filters.hasPmid && !p.pmid) return false
    return true
  })
}

export function getUniqueValues<K extends keyof Protocol>(protocols: Protocol[], key: K): string[] {
  const values = protocols.map(p => p[key]).filter(Boolean) as string[]
  return [...new Set(values)].sort()
}

export function getUniqueYears(protocols: Protocol[]): string[] {
  return [...new Set(protocols.map(p => p.publicationYear).filter(Boolean) as number[])]
    .sort((a, b) => b - a).map(String)
}

export function countByCategory(protocols: Protocol[]): Record<string, number> {
  return protocols.reduce((acc, p) => {
    acc[p.category] = (acc[p.category] || 0) + 1
    return acc
  }, {} as Record<string, number>)
}

export function countBySubcategory(protocols: Protocol[]): Record<string, number> {
  return protocols.reduce((acc, p) => {
    acc[p.subcategory] = (acc[p.subcategory] || 0) + 1
    return acc
  }, {} as Record<string, number>)
}

export function hasActiveFilters(filters: ProtocolFilters): boolean {
  return !!(filters.search || filters.category || filters.subcategory || filters.sourceType ||
    filters.approvalStatus || filters.protocolType || filters.year || filters.organism ||
    filters.difficulty || filters.biosafetyLevel || filters.openAccessOnly || filters.hasDoi || filters.hasPmid)
}

export function countActiveFilters(filters: ProtocolFilters): number {
  let count = 0
  if (filters.search) count++
  if (filters.category) count++
  if (filters.subcategory) count++
  if (filters.sourceType) count++
  if (filters.approvalStatus) count++
  if (filters.protocolType) count++
  if (filters.year) count++
  if (filters.organism) count++
  if (filters.difficulty) count++
  if (filters.biosafetyLevel) count++
  if (filters.openAccessOnly) count++
  if (filters.hasDoi) count++
  if (filters.hasPmid) count++
  return count
}
