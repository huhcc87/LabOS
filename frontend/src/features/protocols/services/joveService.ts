import type { ImportSearchResult } from '../types/protocol.types'

// JoVE only offers a partner API (contact support@jove.com). Until access exists this source returns nothing.
export async function searchJove(_query: string): Promise<ImportSearchResult[]> {
  return []
}
