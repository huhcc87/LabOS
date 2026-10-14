import type { ImportSearchResult } from '../types/protocol.types'

// Real Crossref REST API (free, no key; allowed by the app's CSP).
export async function searchCrossref(query: string): Promise<ImportSearchResult[]> {
  const term = query.trim()
  if (!term) return []
  const res = await fetch(`https://api.crossref.org/works?query=${encodeURIComponent(term)}&rows=10&filter=type:journal-article&select=DOI,title,author,container-title,issued,abstract,license`)
  if (!res.ok) throw new Error(`Crossref search failed (${res.status})`)
  const items: any[] = (await res.json())?.message?.items ?? []
  return items.filter(i => i.title?.[0] && i.DOI).map((i): ImportSearchResult => {
    const year = i.issued?.['date-parts']?.[0]?.[0]
    return {
      externalId: `cr-${i.DOI}`,
      title: String(i.title[0]).replace(/<[^>]+>/g, ''),
      authors: (i.author ?? []).map((a: any) => [a.family, (a.given ?? '').split(/\s+/).map((p: string) => p[0]).join('')].filter(Boolean).join(' ')).filter(Boolean),
      journal: i['container-title']?.[0] || undefined,
      year: typeof year === 'number' ? year : undefined,
      doi: i.DOI,
      pmid: undefined,
      abstract: String(i.abstract ?? '').replace(/<[^>]+>/g, ''),
      sourceType: 'crossref',
      sourceName: 'Crossref',
      sourceUrl: `https://doi.org/${i.DOI}`,
      openAccess: (i.license ?? []).some((l: any) => /creativecommons/i.test(l.URL ?? '')),
      alreadyImported: false,
    }
  })
}
