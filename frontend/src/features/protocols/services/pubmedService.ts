import type { ImportSearchResult } from '../types/protocol.types'

// TODO: Replace mock with real NCBI E-utilities call:
// https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=QUERY&retmax=20&retmode=json
// Then fetch details: https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=PMID&retmode=json
// API key recommended for production: https://www.ncbi.nlm.nih.gov/account/

const MOCK_RESULTS: Record<string, ImportSearchResult[]> = {
  default: [
    {
      externalId: 'pmid-38001234', title: 'Optimised Protocol for Bacterial 16S rRNA Gene Amplification',
      authors: ['Smith AB', 'Jones CD', 'Williams EF'], journal: 'Microbiome', year: 2024,
      doi: '10.1186/s40168-024-01234-5', pmid: '38001234',
      abstract: 'We describe an optimised PCR amplification protocol for 16S rRNA sequencing with reduced chimera formation.',
      sourceType: 'pubmed', sourceName: 'PubMed', sourceUrl: 'https://pubmed.ncbi.nlm.nih.gov/38001234/',
      openAccess: true, alreadyImported: false,
    },
    {
      externalId: 'pmid-37812345', title: 'High-Efficiency CRISPR-Cas9 Knock-In in Primary Human Cells',
      authors: ['Lee KY', 'Park JH', 'Cho MJ'], journal: 'Nature Methods', year: 2023,
      doi: '10.1038/s41592-023-01234-x', pmid: '37812345',
      abstract: 'A ribonucleoprotein delivery approach achieving > 80% HDR efficiency in primary human T cells.',
      sourceType: 'pubmed', sourceName: 'PubMed', sourceUrl: 'https://pubmed.ncbi.nlm.nih.gov/37812345/',
      openAccess: false, alreadyImported: false,
    },
    {
      externalId: 'pmid-37654321', title: 'Single-Cell RNA Sequencing Library Preparation for Tumour Microenvironment',
      authors: ['Garcia R', 'Martinez S', 'Lopez A'], journal: 'Cell Reports Methods', year: 2023,
      doi: '10.1016/j.crmeth.2023.100467', pmid: '37654321',
      abstract: 'Optimised 10x Chromium library preparation from FFPE tumour tissue with enhanced cell recovery.',
      sourceType: 'pubmed', sourceName: 'PubMed', sourceUrl: 'https://pubmed.ncbi.nlm.nih.gov/37654321/',
      openAccess: true, alreadyImported: false,
    },
  ],
}

export async function searchPubMed(query: string, maxResults = 10): Promise<ImportSearchResult[]> {
  // Simulate network delay
  await new Promise(r => setTimeout(r, 800))
  const results = MOCK_RESULTS[query.toLowerCase()] || MOCK_RESULTS.default
  return results.slice(0, maxResults)
}
