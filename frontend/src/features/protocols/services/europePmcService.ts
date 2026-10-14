import type { ImportSearchResult } from '../types/protocol.types'

// Real Europe PMC REST API (free; allowed by the app's CSP).
export async function searchEuropePmc(query: string): Promise<ImportSearchResult[]> {
  const term = query.trim()
  if (!term) return []
  const res = await fetch(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(term)}&format=json&resultType=core&pageSize=10`)
  if (!res.ok) throw new Error(`Europe PMC search failed (${res.status})`)
  const hits: any[] = (await res.json())?.resultList?.result ?? []
  return hits.filter(h => h.title).map((h): ImportSearchResult => {
    const year = parseInt(h.pubYear, 10)
    const source = h.source ?? 'MED'
    return {
      externalId: `epmc-${source}-${h.id}`,
      title: String(h.title).replace(/<[^>]+>/g, ''),
      authors: String(h.authorString ?? '').replace(/\.$/, '').split(', ').filter(Boolean),
      journal: h.journalTitle || undefined,
      year: Number.isFinite(year) ? year : undefined,
      doi: h.doi || undefined,
      pmid: h.pmid || undefined,
      abstract: String(h.abstractText ?? '').replace(/<[^>]+>/g, ''),
      sourceType: 'europe_pmc',
      sourceName: 'Europe PMC',
      sourceUrl: `https://europepmc.org/article/${source}/${h.id}`,
      openAccess: h.isOpenAccess === 'Y',
      alreadyImported: false,
    }
  })
}
