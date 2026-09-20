import type { ImportSearchResult } from '../types/protocol.types'

// NOTE: JoVE (Journal of Visualized Experiments) requires institutional subscription.
// Only citation metadata and outbound links are stored — no full-text.
// TODO: JoVE has a limited partner API. Contact support@jove.com for access.

export async function searchJove(query: string): Promise<ImportSearchResult[]> {
  await new Promise(r => setTimeout(r, 600))
  return [
    {
      externalId: 'jove-62863', title: 'Immunohistochemistry of Formalin-Fixed, Paraffin-Embedded Tissue Sections',
      authors: ['Stack EC', 'Wang C', 'Roman KA', 'Bhatt CC'],
      journal: 'Journal of Visualized Experiments', year: 2014,
      doi: '10.3791/62863', pmid: undefined,
      abstract: 'Video protocol demonstrating IHC staining of FFPE sections with antigen retrieval and chromogenic detection. Subscription required for full video access.',
      sourceType: 'jove', sourceName: 'JoVE',
      sourceUrl: 'https://www.jove.com/t/62863',
      openAccess: false, alreadyImported: false,
    },
  ]
}
