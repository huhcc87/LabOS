// ═══════════════════════════════════════════════════════════════════════════
// AI SWARM HOOK — React state management for swarm intelligence
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useCallback, useRef } from 'react'
import type {
  AgentId, AgentOutput, SwarmSession, SwarmConsensus,
  GeneratedSOP, SOPGeneratorInput, SwarmChatMessage,
} from './swarmTypes'
import { runSwarmAnalysis, askSwarm } from './swarmEngine'

export type SwarmPhase = 'idle' | 'input' | 'running' | 'complete' | 'chat' | 'sop-view'

export interface UseSwarmReturn {
  // State
  phase: SwarmPhase
  session: SwarmSession | null
  sessions: SwarmSession[]
  agentOutputs: AgentOutput[]
  activeAgentId: AgentId | null
  consensus: SwarmConsensus | null
  generatedSOP: GeneratedSOP | null
  chatMessages: SwarmChatMessage[]
  isRunning: boolean
  progress: number // 0-100
  currentAgent: string

  // Actions
  startNewSession: () => void
  runAnalysis: (input: SOPGeneratorInput) => Promise<void>
  cancelAnalysis: () => void
  setActiveAgent: (id: AgentId | null) => void
  sendChatMessage: (content: string) => Promise<void>
  viewSOP: () => void
  viewChat: () => void
  viewResults: () => void
  loadSession: (session: SwarmSession) => void
  resetSwarm: () => void
  exportSOP: () => GeneratedSOP | null
}

export function useSwarm(): UseSwarmReturn {
  const [phase, setPhase] = useState<SwarmPhase>('idle')
  const [session, setSession] = useState<SwarmSession | null>(null)
  const [sessions, setSessions] = useState<SwarmSession[]>([])
  const [agentOutputs, setAgentOutputs] = useState<AgentOutput[]>([])
  const [activeAgentId, setActiveAgentId] = useState<AgentId | null>(null)
  const [consensus, setConsensus] = useState<SwarmConsensus | null>(null)
  const [generatedSOP, setGeneratedSOP] = useState<GeneratedSOP | null>(null)
  const [chatMessages, setChatMessages] = useState<SwarmChatMessage[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentAgent, setCurrentAgent] = useState('')
  const cancelRef = useRef(false)

  const startNewSession = useCallback(() => {
    setPhase('input')
    setAgentOutputs([])
    setConsensus(null)
    setGeneratedSOP(null)
    setChatMessages([])
    setActiveAgentId(null)
    setProgress(0)
    setCurrentAgent('')
  }, [])

  const runAnalysis = useCallback(async (input: SOPGeneratorInput) => {
    cancelRef.current = false
    setPhase('running')
    setIsRunning(true)
    setAgentOutputs([])
    setProgress(0)

    try {
      const result = await runSwarmAnalysis(input, {
        onAgentStart: (agentId: AgentId, agentName: string) => {
          if (cancelRef.current) return
          setCurrentAgent(agentName)
        },
        onAgentComplete: (output: AgentOutput, idx: number, total: number) => {
          if (cancelRef.current) return
          setAgentOutputs(prev => [...prev, output])
          setProgress(Math.round(((idx + 1) / total) * 100))
        },
        shouldCancel: () => cancelRef.current,
      })

      if (cancelRef.current) return

      setSession(result)
      setConsensus(result.consensus)
      setGeneratedSOP(result.generatedSOP || null)
      setSessions(prev => [result, ...prev])
      setPhase('complete')
    } catch (err) {
      console.error('[Swarm] Analysis failed:', err)
      setPhase('idle')
    } finally {
      setIsRunning(false)
      setCurrentAgent('')
    }
  }, [])

  const cancelAnalysis = useCallback(() => {
    cancelRef.current = true
    setIsRunning(false)
    setPhase('idle')
    setProgress(0)
    setCurrentAgent('')
  }, [])

  const setActiveAgent = useCallback((id: AgentId | null) => {
    setActiveAgentId(id)
  }, [])

  const sendChatMessage = useCallback(async (content: string) => {
    const userMsg: SwarmChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    }
    setChatMessages(prev => [...prev, userMsg])

    const response = await askSwarm(content, {
      protocolTitle: session?.protocolTitle,
      technique: undefined,
      category: session?.protocolCategory,
    })
    setChatMessages(prev => [...prev, response])
  }, [session])

  const viewSOP = useCallback(() => setPhase('sop-view'), [])
  const viewChat = useCallback(() => setPhase('chat'), [])
  const viewResults = useCallback(() => setPhase('complete'), [])

  const loadSession = useCallback((s: SwarmSession) => {
    setSession(s)
    setAgentOutputs(s.agents)
    setConsensus(s.consensus)
    setGeneratedSOP(s.generatedSOP || null)
    setPhase('complete')
  }, [])

  const resetSwarm = useCallback(() => {
    setPhase('idle')
    setSession(null)
    setAgentOutputs([])
    setActiveAgentId(null)
    setConsensus(null)
    setGeneratedSOP(null)
    setChatMessages([])
    setProgress(0)
    setCurrentAgent('')
  }, [])

  const exportSOP = useCallback(() => generatedSOP, [generatedSOP])

  return {
    phase, session, sessions, agentOutputs, activeAgentId,
    consensus, generatedSOP, chatMessages, isRunning, progress, currentAgent,
    startNewSession, runAnalysis, cancelAnalysis, setActiveAgent,
    sendChatMessage, viewSOP, viewChat, viewResults, loadSession,
    resetSwarm, exportSOP,
  }
}
