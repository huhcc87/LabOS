import type { ImportSearchResult } from '../types/protocol.types'

// TODO: Replace with real protocols.io API v3:
// GET https://www.protocols.io/api/v3/protocols?key=QUERY&page_size=20
// Requires API key from https://www.protocols.io/developers
// Authorization: Bearer <API_KEY>

export async function searchProtocolsIo(query: string): Promise<ImportSearchResult[]> {
  await new Promise(r => setTimeout(r, 700))
  return [
    {
      externalId: 'pio-bwm5pc86', title: 'Microbial DNA Extraction Using Bead Beating (PowerSoil Pro)',
      authors: ['Qiagen Application Team'], journal: undefined, year: 2023,
      doi: undefined, pmid: undefined,
      abstract: 'Complete bead-beating protocol for high-yield microbial DNA extraction from soil and gut microbiome samples using MO BIO PowerSoil Pro Kit.',
      sourceType: 'protocols_io', sourceName: 'protocols.io',
      sourceUrl: 'https://www.protocols.io/view/microbial-dna-extraction-bead-beating-bwm5pc86',
      openAccess: true, alreadyImported: false,
    },
    {
      externalId: 'pio-bcq4ivyw', title: 'IncuCyte Scratch Wound Migration Assay (Sartorius)',
      authors: ['Sartorius Protocol Team'], journal: undefined, year: 2022,
      doi: undefined, pmid: undefined,
      abstract: 'Standardised scratch wound assay protocol using IncuCyte S3 for automated, label-free migration quantification.',
      sourceType: 'protocols_io', sourceName: 'protocols.io',
      sourceUrl: 'https://www.protocols.io/view/incucyte-scratch-wound-migration-bcq4ivyw',
      openAccess: true, alreadyImported: false,
    },
  ]
}
