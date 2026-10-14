import type { ImportSearchResult } from '../types/protocol.types'

// Real NCBI E-utilities (free, no key needed at this volume; allowed by the app's CSP).
const EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'

function text(node: Element | null | undefined): string {
  return node?.textContent?.replace(/\s+/g, ' ').trim() ?? ''
}

export async function searchPubMed(query: string, maxResults = 10): Promise<ImportSearchResult[]> {
  const term = query.trim()
  if (!term) return []
  const search = await fetch(`${EUTILS}/esearch.fcgi?db=pubmed&retmode=json&retmax=${maxResults}&term=${encodeURIComponent(term)}`)
  if (!search.ok) throw new Error(`PubMed search failed (${search.status})`)
  const ids: string[] = (await search.json())?.esearchresult?.idlist ?? []
  if (ids.length === 0) return []

  const fetched = await fetch(`${EUTILS}/efetch.fcgi?db=pubmed&retmode=xml&id=${ids.join(',')}`)
  if (!fetched.ok) throw new Error(`PubMed fetch failed (${fetched.status})`)
  const xml = new DOMParser().parseFromString(await fetched.text(), 'text/xml')

  return Array.from(xml.querySelectorAll('PubmedArticle')).map((article): ImportSearchResult => {
    const pmid = text(article.querySelector('MedlineCitation > PMID'))
    const doi = text(article.querySelector('ArticleId[IdType="doi"]')) || undefined
    const authors = Array.from(article.querySelectorAll('AuthorList > Author')).map(a => {
      const last = text(a.querySelector('LastName'))
      const initials = text(a.querySelector('Initials'))
      return [last, initials].filter(Boolean).join(' ')
    }).filter(Boolean)
    const year = parseInt(text(article.querySelector('JournalIssue > PubDate > Year')) || text(article.querySelector('ArticleDate > Year')), 10)
    return {
      externalId: `pmid-${pmid}`,
      title: text(article.querySelector('ArticleTitle')),
      authors,
      journal: text(article.querySelector('Journal > Title')) || undefined,
      year: Number.isFinite(year) ? year : undefined,
      doi,
      pmid,
      abstract: Array.from(article.querySelectorAll('Abstract > AbstractText')).map(text).join(' '),
      sourceType: 'pubmed',
      sourceName: 'PubMed',
      sourceUrl: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      openAccess: !!article.querySelector('ArticleId[IdType="pmc"]'),
      alreadyImported: false,
    }
  }).filter(r => r.title)
}
