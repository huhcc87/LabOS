import { useState, useMemo, useCallback } from 'react'
import type { Protocol, ProtocolFilters } from '../types/protocol.types'
import { MOCK_PROTOCOLS } from '../data/mockProtocols'
import { PROTOCOL_CATEGORIES } from '../data/categories'
import { applyFilters, DEFAULT_FILTERS, countBySubcategory } from '../utils/protocolFilters'

export type ViewMode = 'table' | 'grid'

export function useProtocols() {
  const [allProtocols, setAllProtocols] = useState<Protocol[]>(MOCK_PROTOCOLS)
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

  const addProtocol = useCallback((p: Protocol) => {
    setAllProtocols(prev => [p, ...prev])
  }, [])

  const updateProtocol = useCallback((p: Protocol) => {
    setAllProtocols(prev => prev.map(x => x.id === p.id ? p : x))
  }, [])

  const deleteProtocol = useCallback((id: string) => {
    setAllProtocols(prev => prev.filter(x => x.id !== id))
    if (selectedProtocol?.id === id) setSelectedProtocol(null)
  }, [selectedProtocol])

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
