import type { ImportSearchResult } from '../types/protocol.types'

// TODO: Bio-protocol does not have a public REST API.
// Manual import is the recommended approach: copy DOI/title from https://bio-protocol.org/search
// This service returns mock results for UI demonstration.

export async function searchBioProtocol(query: string): Promise<ImportSearchResult[]> {
  await new Promise(r => setTimeout(r, 500))
  return [
    {
      externalId: 'bp-e4672', title: 'Anaerobic Culture of Gut Bacteria Using GasPak System',
      authors: ['Thiele I', 'Heinken A'], journal: 'Bio-protocol', year: 2022,
      doi: '10.21769/BioProtoc.4672', pmid: undefined,
      abstract: 'Detailed anaerobic culture procedure for obligate gut anaerobes including Akkermansia muciniphila and Faecalibacterium prausnitzii.',
      sourceType: 'bio_protocol', sourceName: 'Bio-protocol',
      sourceUrl: 'https://bio-protocol.org/e4672',
      openAccess: true, alreadyImported: false,
    },
  ]
}
