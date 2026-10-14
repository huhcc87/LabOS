import type { ImportSearchResult } from '../types/protocol.types'

// Bio-protocol has no public API. Use manual import (copy the DOI or title); this source returns nothing.
export async function searchBioProtocol(_query: string): Promise<ImportSearchResult[]> {
  return []
}
