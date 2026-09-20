import type { ImportSearchResult, Protocol, SourceType } from '../types/protocol.types'
import { searchPubMed } from './pubmedService'
import { searchProtocolsIo } from './protocolsIoService'
import { searchCrossref } from './crossrefService'
import { searchEuropePmc } from './europePmcService'
import { searchBioProtocol } from './bioProtocolService'
import { searchJove } from './joveService'
import { MOCK_PROTOCOLS } from '../data/mockProtocols'

export async function searchAllSources(query: string, sources: SourceType[]): Promise<ImportSearchResult[]> {
  const promises: Promise<ImportSearchResult[]>[] = []
  if (sources.includes('pubmed'))       promises.push(searchPubMed(query))
  if (sources.includes('protocols_io')) promises.push(searchProtocolsIo(query))
  if (sources.includes('crossref'))     promises.push(searchCrossref(query))
  if (sources.includes('europe_pmc'))   promises.push(searchEuropePmc(query))
  if (sources.includes('bio_protocol')) promises.push(searchBioProtocol(query))
  if (sources.includes('jove'))         promises.push(searchJove(query))
  const results = await Promise.allSettled(promises)
  const all: ImportSearchResult[] = []
  results.forEach(r => { if (r.status === 'fulfilled') all.push(...r.value) })
  return deduplicateResults(all)
}

export function deduplicateResults(results: ImportSearchResult[]): ImportSearchResult[] {
  const seen = new Set<string>()
  return results.filter(r => {
    const key = r.doi || r.pmid || r.title.toLowerCase().slice(0, 50)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function markAlreadyImported(results: ImportSearchResult[]): ImportSearchResult[] {
  const existingDois = new Set(MOCK_PROTOCOLS.map(p => p.doi).filter(Boolean))
  const existingPmids = new Set(MOCK_PROTOCOLS.map(p => p.pmid).filter(Boolean))
  return results.map(r => ({
    ...r,
    alreadyImported: !!(r.doi && existingDois.has(r.doi)) || !!(r.pmid && existingPmids.has(r.pmid)),
  }))
}

export function importToLibrary(result: ImportSearchResult): Protocol {
  return {
    id: `imported-${Date.now()}`,
    slug: result.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60),
    title: result.title,
    category: 'molecular-biology',
    subcategory: 'dna-extraction',
    summary: result.abstract.slice(0, 200),
    abstract: result.abstract,
    protocolType: 'imported',
    approvalStatus: 'under_review',
    sourceType: result.sourceType,
    sourceName: result.sourceName,
    sourceUrl: result.sourceUrl,
    doi: result.doi,
    pmid: result.pmid,
    journal: result.journal,
    publicationYear: result.year,
    authors: result.authors,
    keywords: [],
    tags: [],
    field: '',
    reagents: [],
    equipment: [],
    prerequisites: [],
    safetyNotes: [],
    qcChecklist: [],
    troubleshooting: [],
    steps: [],
    references: [],
    relatedArticles: [],
    version: '1.0',
    createdBy: result.authors[0] || 'Import',
    owner: 'Pending Assignment',
    aiGenerated: false,
    evidenceLinks: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}
