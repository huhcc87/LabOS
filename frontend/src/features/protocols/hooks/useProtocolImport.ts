import { useState, useCallback } from 'react'
import type { ImportSearchResult, SourceType } from '../types/protocol.types'
import { searchAllSources, markAlreadyImported, importToLibrary } from '../services/protocolImportService'

export function useProtocolImport(onImport: (protocol: any) => void) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedSources, setSelectedSources] = useState<SourceType[]>(['pubmed', 'protocols_io'])
  const [results, setResults] = useState<ImportSearchResult[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isSearching, setIsSearching] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [error, setError] = useState('')

  const search = useCallback(async () => {
    if (!query.trim()) return
    setIsSearching(true)
    setError('')
    try {
      const raw = await searchAllSources(query, selectedSources)
      setResults(markAlreadyImported(raw))
      setSelected(new Set())
    } catch (e) {
      setError('Search failed. Please try again.')
    } finally {
      setIsSearching(false)
    }
  }, [query, selectedSources])

  const toggleSource = useCallback((src: SourceType) => {
    setSelectedSources(prev =>
      prev.includes(src) ? prev.filter(s => s !== src) : [...prev, src]
    )
  }, [])

  const toggleResult = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const doImport = useCallback(async () => {
    setIsImporting(true)
    try {
      const toImport = results.filter(r => selected.has(r.externalId))
      toImport.forEach(r => onImport(importToLibrary(r)))
      setIsOpen(false)
      setResults([])
      setSelected(new Set())
      setQuery('')
    } finally {
      setIsImporting(false)
    }
  }, [results, selected, onImport])

  const reset = useCallback(() => {
    setQuery('')
    setResults([])
    setSelected(new Set())
    setError('')
  }, [])

  return {
    isOpen, setIsOpen, query, setQuery, selectedSources, toggleSource,
    results, selected, toggleResult, isSearching, isImporting, error,
    search, doImport, reset,
  }
}
