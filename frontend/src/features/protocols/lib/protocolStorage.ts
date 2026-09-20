import Dexie, { type Table } from 'dexie'
import type { Protocol } from '../types/protocol.types'

interface FavoriteProtocol {
  id: string
  protocolId: string
  addedAt: string
}

interface RecentProtocol {
  id: string
  protocolId: string
  viewedAt: string
  title: string
}

interface OfflineChecklist {
  id: string
  protocolId: string
  stepStatuses: Record<number, 'pending' | 'done' | 'skipped'>
  startedAt: string
  updatedAt: string
}

class ProtocolDB extends Dexie {
  draftProtocols!: Table<Protocol>
  favorites!: Table<FavoriteProtocol>
  recentlyViewed!: Table<RecentProtocol>
  offlineChecklists!: Table<OfflineChecklist>

  constructor() {
    super('ProtocolLibraryDB')
    this.version(1).stores({
      draftProtocols: 'id, category, approvalStatus, updatedAt',
      favorites: 'id, protocolId, addedAt',
      recentlyViewed: 'id, protocolId, viewedAt',
      offlineChecklists: 'id, protocolId, updatedAt',
    })
  }
}

const db = new ProtocolDB()

export async function saveDraftProtocol(protocol: Protocol) {
  await db.draftProtocols.put(protocol)
}

export async function getDraftProtocols(): Promise<Protocol[]> {
  return db.draftProtocols.toArray()
}

export async function deleteDraftProtocol(id: string) {
  await db.draftProtocols.delete(id)
}

export async function addFavorite(protocolId: string) {
  const existing = await db.favorites.where('protocolId').equals(protocolId).first()
  if (!existing) {
    await db.favorites.put({ id: `fav-${protocolId}`, protocolId, addedAt: new Date().toISOString() })
  }
}

export async function removeFavorite(protocolId: string) {
  await db.favorites.where('protocolId').equals(protocolId).delete()
}

export async function getFavoriteIds(): Promise<string[]> {
  const favs = await db.favorites.toArray()
  return favs.map(f => f.protocolId)
}

export async function addRecentlyViewed(protocolId: string, title: string) {
  await db.recentlyViewed.put({ id: `recent-${protocolId}`, protocolId, viewedAt: new Date().toISOString(), title })
  // Keep only last 20
  const all = await db.recentlyViewed.orderBy('viewedAt').reverse().toArray()
  if (all.length > 20) {
    const toDelete = all.slice(20).map(r => r.id)
    await db.recentlyViewed.bulkDelete(toDelete)
  }
}

export async function getRecentlyViewed(): Promise<RecentProtocol[]> {
  return db.recentlyViewed.orderBy('viewedAt').reverse().limit(20).toArray()
}

export async function saveChecklistProgress(protocolId: string, stepStatuses: Record<number, 'pending' | 'done' | 'skipped'>) {
  const existing = await db.offlineChecklists.where('protocolId').equals(protocolId).first()
  const now = new Date().toISOString()
  if (existing) {
    await db.offlineChecklists.update(existing.id, { stepStatuses, updatedAt: now })
  } else {
    await db.offlineChecklists.put({ id: `chk-${protocolId}`, protocolId, stepStatuses, startedAt: now, updatedAt: now })
  }
}

export async function getChecklistProgress(protocolId: string): Promise<Record<number, 'pending' | 'done' | 'skipped'>> {
  const entry = await db.offlineChecklists.where('protocolId').equals(protocolId).first()
  return entry?.stepStatuses || {}
}
