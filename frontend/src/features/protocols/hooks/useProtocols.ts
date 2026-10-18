import { useState, useMemo, useCallback } from 'react'
import { useMutation, useQuery } from 'convex/react'
import toast from 'react-hot-toast'
import { api } from '../../../../convex/_generated/api'
import { useAuth } from '../../../context/AuthContext'
import { errText } from '../../../lib/errors'
import type { Protocol, ProtocolFilters } from '../types/protocol.types'
import { PROTOCOL_CATEGORIES } from '../data/categories'
import { applyFilters, DEFAULT_FILTERS, countBySubcategory } from '../utils/protocolFilters'

export type ViewMode = 'table' | 'grid'

/** The protocol library, saved for the whole lab. Add, edit, approve and delete all write to the database. */
export function useProtocols() {
  const { token } = useAuth()
  const rows = useQuery(api.protocolLibrary.list, token ? { token } : 'skip')
  const saveM = useMutation(api.protocolLibrary.save)
  const removeM = useMutation(api.protocolLibrary.remove)
  const allProtocols = useMemo<Protocol[]>(() => (rows ?? []).flatMap(r => { try { return [JSON.parse(r.data) as Protocol] } catch { return [] } }), [rows])
  const [filters, setFilters] = useState<ProtocolFilters>(DEFAULT_FILTERS)
  const [selectedProtocol, setSelectedProtocol] = useState<Protocol | null>(null)
  const [activeCategory, setActiveCategory] = useState<string>('')
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [page, setPage] = useState(1)
  const perPage = 15

  const filteredProtocols = useMemo(() => {
    const withCategory = activeCategory ? { ...filters, category: activeCategory } : filters
    return applyFilters(allProtocols, withCategory)
  }, [allProtocols, filters, activeCategory])

  const paginatedProtocols = useMemo(() => {
    const start = (page - 1) * perPage
    return filteredProtocols.slice(start, start + perPage)
  }, [filteredProtocols, page])

  const totalPages = Math.ceil(filteredProtocols.length / perPage)

  const subcategoryCounts = useMemo(() => countBySubcategory(allProtocols), [allProtocols])

  const categoriesWithCounts = useMemo(() =>
    PROTOCOL_CATEGORIES.map(cat => ({
      ...cat,
      protocolCount: allProtocols.filter(p => p.category === cat.id).length,
      subcategories: cat.subcategories.map(sub => ({
        ...sub,
        protocolCount: subcategoryCounts[sub.id] || 0,
      })),
    })), [allProtocols, subcategoryCounts])

  const handleSetCategory = useCallback((cat: string) => {
    setActiveCategory(cat)
    setFilters(f => ({ ...f, subcategory: '' }))
    setPage(1)
  }, [])

  const handleSetFilters = useCallback((f: ProtocolFilters) => {
    setFilters(f)
    setPage(1)
  }, [])

  const persist = useCallback((p: Protocol) => {
    if (!token) return
    saveM({ token, key: p.id, data: JSON.stringify(p) }).catch(e => toast.error(errText(e)))
  }, [token, saveM])

  const addProtocol = persist
  const updateProtocol = persist

  const deleteProtocol = useCallback((id: string) => {
    if (!token) return
    removeM({ token, key: id }).catch(e => toast.error(errText(e)))
    if (selectedProtocol?.id === id) setSelectedProtocol(null)
  }, [token, removeM, selectedProtocol])

  return {
    protocols: filteredProtocols,
    paginatedProtocols,
    allProtocols,
    filters,
    setFilters: handleSetFilters,
    selectedProtocol,
    setSelectedProtocol,
    activeCategory,
    setActiveCategory: handleSetCategory,
    viewMode,
    setViewMode,
    categories: categoriesWithCounts,
    pagination: { page, perPage, totalPages, total: filteredProtocols.length, setPage },
    addProtocol,
    updateProtocol,
    deleteProtocol,
  }
}
