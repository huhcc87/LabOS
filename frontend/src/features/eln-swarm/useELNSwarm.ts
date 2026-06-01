// ═══════════════════════════════════════════════════════════════════════════
// ELN AI SWARM HOOK — React state management for notebook intelligence
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useCallback, useRef } from 'react'
import type {
  ELNAgentId, ELNAgentOutput, ELNSwarmReview, ELNConsensus,
  ExperimentGeneratorInput, GeneratedExperiment,
  TemplateSuggestions, ManuscriptSection, GrantSection,
  ELNSwarmMessage,
} from './elnSwarmTypes'
import {
  runELNSwarmReview, generateExperiment, getSmartSuggestions,
  generateManuscriptSection, generateGrantSection, askELNSwarm,
} from './elnSwarmEngine'
import type { EntryContext } from './elnSwarmEngine'

export type ELNSwarmTab = 'review' | 'generator' | 'suggestions' | 'manuscript' | 'grant' | 'chat'

export interface UseELNSwarmReturn {
  // State
  swarmTab: ELNSwarmTab
  review: ELNSwarmReview | null
  isReviewing: boolean
  progress: number
  currentAgent: string
  generatedExperiment: GeneratedExperiment | null
  isGenerating: boolean
  suggestions: TemplateSuggestions | null
  manuscriptSection: ManuscriptSection | null
  grantSection: GrantSection | null
  chatMessages: ELNSwarmMessage[]

  // Actions
  setSwarmTab: (tab: ELNSwarmTab) => void
  runReview: (entry: EntryContext) => Promise<void>
  cancelReview: () => void
  generateExp: (input: ExperimentGeneratorInput) => Promise<void>
  loadSuggestions: (template: string) => void
  genManuscript: (entry: EntryContext, type: ManuscriptSection['type']) => Promise<void>
  genGrant: (entry: EntryContext, type: GrantSection['type']) => Promise<void>
  sendChat: (content: string, context: { entryTitle?: string; template?: string }) => Promise<void>
  resetSwarm: () => void
}

export function useELNSwarm(): UseELNSwarmReturn {
  const [swarmTab, setSwarmTab] = useState<ELNSwarmTab>('review')
  const [review, setReview] = useState<ELNSwarmReview | null>(null)
  const [isReviewing, setIsReviewing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentAgent, setCurrentAgent] = useState('')
  const [generatedExperiment, setGeneratedExperiment] = useState<GeneratedExperiment | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [suggestions, setSuggestions] = useState<TemplateSuggestions | null>(null)
  const [manuscriptSection, setManuscriptSection] = useState<ManuscriptSection | null>(null)
  const [grantSection, setGrantSection] = useState<GrantSection | null>(null)
  const [chatMessages, setChatMessages] = useState<ELNSwarmMessage[]>([])
  const cancelRef = useRef(false)

  const runReview = useCallback(async (entry: EntryContext) => {
    cancelRef.current = false
    setIsReviewing(true)
    setProgress(0)
    setCurrentAgent('')
    setSwarmTab('review')

    try {
      const result = await runELNSwarmReview(entry, {
        onAgentStart: (_, name) => { if (!cancelRef.current) setCurrentAgent(name) },
        onAgentComplete: (_, idx, total) => { if (!cancelRef.current) setProgress(Math.round(((idx + 1) / total) * 100)) },
        shouldCancel: () => cancelRef.current,
      })
      if (!cancelRef.current) setReview(result)
    } catch (err) {
      console.error('[ELN Swarm] Review failed:', err)
    } finally {
      setIsReviewing(false)
      setCurrentAgent('')
    }
  }, [])

  const cancelReview = useCallback(() => {
    cancelRef.current = true
    setIsReviewing(false)
    setProgress(0)
    setCurrentAgent('')
  }, [])

  const generateExp = useCallback(async (input: ExperimentGeneratorInput) => {
    setIsGenerating(true)
    try {
      const exp = await generateExperiment(input)
      setGeneratedExperiment(exp)
      setSwarmTab('generator')
    } finally {
      setIsGenerating(false)
    }
  }, [])

  const loadSuggestions = useCallback((template: string) => {
    setSuggestions(getSmartSuggestions(template))
  }, [])

  const genManuscript = useCallback(async (entry: EntryContext, type: ManuscriptSection['type']) => {
    const section = await generateManuscriptSection(entry, type)
    setManuscriptSection(section)
    setSwarmTab('manuscript')
  }, [])

  const genGrant = useCallback(async (entry: EntryContext, type: GrantSection['type']) => {
    const section = await generateGrantSection(entry, type)
    setGrantSection(section)
    setSwarmTab('grant')
  }, [])

  const sendChat = useCallback(async (content: string, context: { entryTitle?: string; template?: string }) => {
    const userMsg: ELNSwarmMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: 'user', content, timestamp: new Date().toISOString(),
    }
    setChatMessages(prev => [...prev, userMsg])
    const response = await askELNSwarm(content, context)
    setChatMessages(prev => [...prev, response])
  }, [])

  const resetSwarm = useCallback(() => {
    setReview(null)
    setProgress(0)
    setCurrentAgent('')
    setGeneratedExperiment(null)
    setSuggestions(null)
    setManuscriptSection(null)
    setGrantSection(null)
    setChatMessages([])
  }, [])

  return {
    swarmTab, review, isReviewing, progress, currentAgent,
    generatedExperiment, isGenerating, suggestions, manuscriptSection, grantSection, chatMessages,
    setSwarmTab, runReview, cancelReview, generateExp,
    loadSuggestions, genManuscript, genGrant, sendChat, resetSwarm,
  }
}
