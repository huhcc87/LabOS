import { useState, useCallback } from 'react'
import type { Protocol, Difficulty } from '../types/protocol.types'
import { generateProtocol, type AiGenerationParams } from '../services/protocolAiService'

const DEFAULT_PARAMS: AiGenerationParams = {
  title: '', category: '', subcategory: '', sampleType: '', organism: '',
  goal: '', platform: '', difficulty: 'intermediate', safetyLevel: 'BSL-1', notes: '',
}

export function useProtocolGeneration(onSave: (protocol: Protocol) => void) {
  const [isOpen, setIsOpen] = useState(false)
  const [params, setParams] = useState<AiGenerationParams>(DEFAULT_PARAMS)
  const [generated, setGenerated] = useState<Protocol | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')

  const setParam = useCallback(<K extends keyof AiGenerationParams>(key: K, value: AiGenerationParams[K]) => {
    setParams(prev => ({ ...prev, [key]: value }))
  }, [])

  const generate = useCallback(async () => {
    if (!params.title.trim()) { setError('Title is required.'); return }
    if (!params.category) { setError('Category is required.'); return }
    setIsGenerating(true)
    setError('')
    try {
      const result = await generateProtocol(params)
      setGenerated(result)
    } catch {
      setError('Generation failed. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }, [params])

  const saveDraft = useCallback(() => {
    if (generated) {
      onSave(generated)
      setIsOpen(false)
      setGenerated(null)
      setParams(DEFAULT_PARAMS)
    }
  }, [generated, onSave])

  const reset = useCallback(() => {
    setGenerated(null)
    setParams(DEFAULT_PARAMS)
    setError('')
  }, [])

  return {
    isOpen, setIsOpen, params, setParam, generated, isGenerating, error,
    generate, saveDraft, reset,
  }
}
