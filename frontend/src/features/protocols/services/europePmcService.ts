import type { ImportSearchResult } from '../types/protocol.types'

// TODO: Replace with real Europe PMC REST API (free):
// GET https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=QUERY&format=json&pageSize=20

export async function searchEuropePmc(query: string): Promise<ImportSearchResult[]> {
  await new Promise(r => setTimeout(r, 750))
  return [
    {
      externalId: 'epmc-PPR123456', title: 'Flow Cytometry Panel Optimisation for Tumour-Infiltrating Lymphocytes',
      authors: ['Thommen DS', 'Schumacher TN'], journal: 'Cancer Immunology Research', year: 2023,
      doi: '10.1158/2326-6066.CIR-23-0034', pmid: '36857432',
      abstract: 'Validated 14-colour flow cytometry panel for comprehensive TIL profiling from solid tumours.',
      sourceType: 'europe_pmc', sourceName: 'Europe PMC',
      sourceUrl: 'https://europepmc.org/article/MED/36857432',
      openAccess: true, alreadyImported: false,
    },
  ]
}
