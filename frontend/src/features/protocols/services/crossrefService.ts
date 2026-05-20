import type { ImportSearchResult } from '../types/protocol.types'

// TODO: Replace with real Crossref API (free, no key required):
// GET https://api.crossref.org/works?query=QUERY&rows=20&filter=type:journal-article
// Polite pool: add mailto param: &mailto=your@email.com

export async function searchCrossref(query: string): Promise<ImportSearchResult[]> {
  await new Promise(r => setTimeout(r, 600))
  return [
    {
      externalId: 'cr-10.1038/s41596-024-00987-1', title: 'Comprehensive Protocol for Organoid Drug Sensitivity Testing',
      authors: ['Driehuis E', 'Kolders S', 'Clevers H'], journal: 'Nature Protocols', year: 2024,
      doi: '10.1038/s41596-024-00987-1', pmid: undefined,
      abstract: 'Step-by-step protocol for organoid drug sensitivity testing compatible with automated liquid handling.',
      sourceType: 'crossref', sourceName: 'Crossref', sourceUrl: 'https://doi.org/10.1038/s41596-024-00987-1',
      openAccess: false, alreadyImported: false,
    },
  ]
}
