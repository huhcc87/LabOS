import type { ImportSearchResult } from '../types/protocol.types'

// protocols.io needs a per-lab API key (https://www.protocols.io/developers), which this app does not hold yet.
// Until one is configured this source returns nothing rather than invented protocols.
export async function searchProtocolsIo(_query: string): Promise<ImportSearchResult[]> {
  return []
}
