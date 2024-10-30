'use client'

import React, { useState, useEffect, useReducer, useMemo, useCallback, createContext, useContext } from 'react'
import { 
  Clock, 
  QrCode,
  Plus,
  X,
  Brain,
  Lightbulb,
  Flag,
  Send,
  Play,
  Loader2,
  Circle,
  CheckCircle,
  Calendar,
  ChevronDown,
  MessageSquare,
} from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import { 
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/components/ui/tabs'
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible'

// Constants and Configuration
const MEETING_CONFIG = {
  UPDATE_INTERVAL: 10000,
  MIN_TRANSCRIPT_LENGTH: 100,
  DEFAULT_DURATION: 0
} as const

const DEMO_CONFIG = {
  SIMULATED_DELAY: 1000,
  ERROR_PROBABILITY: 0.1,
  INSIGHT_GENERATION_INTERVAL: 5000,
} as const

// Types
type MeetingStatus = 'not_started' | 'in_progress' | 'ended'
type InsightType = 'think' | 'reflect' | 'plan'

interface MeetingState {
  status: MeetingStatus
  duration: number
  currentAgendaItemIndex: number
  error: string | null
  isLoading: boolean
}

type MeetingAction =
  | { type: 'START_MEETING' }
  | { type: 'END_MEETING' }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'NEXT_AGENDA_ITEM' }

interface KanbanColumn {
  id: string
  title: string
  items: { id: string; content: string }[]
}

// Context
interface AppContextType {
  selectedMeetingId: string | null
  setSelectedMeetingId: React.Dispatch<React.SetStateAction<string | null>>
  kanbanColumns: KanbanColumn[]
  setKanbanColumns: React.Dispatch<React.SetStateAction<KanbanColumn[]>>
  meetingState: MeetingState
  dispatch: React.Dispatch<MeetingAction>
}

const AppContext = createContext<AppContextType | undefined>(undefined)

const useAppContext = () => {
  const context = useContext(AppContext)
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider')
  }
  return context
}

// Dummy data for demonstration purposes
const initialKanbanColumns: KanbanColumn[] = [
  { id: '1', title: 'To Do', items: [] },
  { id: '2', title: 'In Progress', items: [] },
  { id: '3', title: 'Done', items: [] }
]

// Reducer for complex state management
const meetingReducer = (
  state: MeetingState,
  action: MeetingAction
): MeetingState => {
  switch (action.type) {
    case 'START_MEETING':
      return { ...state, status: 'in_progress', isLoading: false }
    case 'END_MEETING':
      return { ...state, status: 'ended', isLoading: false }
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false }
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload }
    case 'NEXT_AGENDA_ITEM':
      return { ...state, currentAgendaItemIndex: state.currentAgendaItemIndex + 1 }
    default:
      return state
  }
}

// Utility functions
const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// Add at the top with other type definitions
interface SimulatedMeeting {
  id: string
  title: string
  description: string
  startTime: string | null
  endTime: string | null
  participants: Array<{
    id: string
    name: string 
    avatar: string
  }>
}

// Add demo data
const demoMeeting: SimulatedMeeting = {
  id: '1',
  title: 'Demo Meeting',
  description: 'This is a simulated meeting for demonstration purposes',
  startTime: null,
  endTime: null,
  participants: [
    { id: '1', name: 'Demo User', avatar: '/placeholder.svg' }
  ]
}

/**
 * FacilitatorDashboard Component
 * 
 * A demo dashboard for facilitating meetings with AI-powered insights
 * and real-time transcription capabilities.
 */
function FacilitatorDashboard() {
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null)
  const [kanbanColumns, setKanbanColumns] = useState<KanbanColumn[]>(initialKanbanColumns)
  const [showQRCode, setShowQRCode] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')

  interface AIInsight {
    id: string
    type: InsightType
    content: string
    timestamp: string
    agendaItemId: string
  }

  interface TranscriptItem {
    id: string
    speaker: string
    content: string
    timestamp: string
    agendaItemId: string
  }

  interface Participant {
    id: string
    name: string
    avatar: string
  }

  const [selectedInsight, setSelectedInsight] = useState<AIInsight | null>(null)
  const [insightContext, setInsightContext] = useState<TranscriptItem[]>([])

  const [meetingState, dispatch] = useReducer(meetingReducer, {
    status: 'not_started',
    duration: MEETING_CONFIG.DEFAULT_DURATION,
    currentAgendaItemIndex: 0,
    error: null,
    isLoading: false,
  })

  const selectedMeeting = demoMeeting
  const meetingDuration = useMeetingTimer(meetingState.status === 'in_progress')
  
  const currentTranscriptItems: TranscriptItem[] = []
  const currentInsights: AIInsight[] = []

  const getInsightIcon = useCallback((type: InsightType | undefined) => {
    switch (type) {
      case 'think':
        return <Brain className="h-5 w-5 text-purple-500" />
      case 'reflect':
        return <Lightbulb className="h-5 w-5 text-yellow-500" />
      case 'plan':
        return <Flag className="h-5 w-5 text-blue-500" />
      default:
        return null
    }
  }, [])

  const moveToNextAgendaItem = useCallback(() => {
    // Simulate moving to the next agenda item
  }, [])

  const handleAIPrompt = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    // Simulate handling AI prompt
    setAiPrompt('')
  }, [])

  const startMeeting = useCallback(async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true })
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      dispatch({ type: 'START_MEETING' })
    } catch (error) {
      dispatch({ 
        type: 'SET_ERROR', 
        payload: error instanceof Error ? error.message : 'Failed to start meeting' 
      })
    }
  }, [])

  const stopMeeting = useCallback(async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true })
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      dispatch({ type: 'END_MEETING' })
    } catch (error) {
      dispatch({ 
        type: 'SET_ERROR', 
        payload: error instanceof Error ? error.message : 'Failed to end meeting' 
      })
    }
  }, [])

  const openInsightModal = useCallback((insight: AIInsight) => {
    setSelectedInsight(insight)
  }, [])

  const contextValue = useMemo(
    () => ({
      selectedMeetingId,
      setSelectedMeetingId,
      kanbanColumns,
      setKanbanColumns,
      meetingState,
      dispatch,
    }),
    [selectedMeetingId, kanbanColumns, meetingState]
  )

  return (
    <AppContext.Provider value={contextValue}>
      <TooltipProvider>
        <div className="flex h-screen bg-gray-100">
          {meetingState.error && (
            <Alert variant="destructive" className="fixed top-4 right-4 w-96">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{meetingState.error}</AlertDescription>
            </Alert>
          )}
          
          {meetingState.isLoading && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
              <div className="bg-white p-4 rounded-lg flex items-center">
                <Loader2 className="animate-spin h-6 w-6" />
                <span className="ml-2">Loading...</span>
              </div>
            </div>
          )}
          
          <div className="flex-1 flex items-center justify-center">
            <Card className="w-full max-w-2xl">
              <CardHeader>
                <CardTitle>Facilitator Dashboard Demo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">
                      {selectedMeeting.title}
                    </h2>
                    <Button
                      onClick={meetingState.status === 'in_progress' ? stopMeeting : startMeeting}
                      disabled={meetingState.isLoading}
                    >
                      {meetingState.status === 'in_progress' ? 'End Meeting' : 'Start Meeting'}
                    </Button>
                  </div>
                  <p className="text-gray-600">
                    {selectedMeeting.description}
                  </p>
                  {selectedMeeting.participants.length > 0 && (
                    <div className="mt-4">
                      <h3 className="text-sm font-medium mb-2">Participants</h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedMeeting.participants.map(participant => (
                          <div key={participant.id} className="flex items-center">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={participant.avatar} />
                              <AvatarFallback>{participant.name[0]}</AvatarFallback>
                            </Avatar>
                            <span className="ml-2 text-sm">{participant.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </TooltipProvider>
    </AppContext.Provider>
  )
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4">
          <Alert variant="destructive">
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>
              {this.state.error?.message || 'An unexpected error occurred'}
            </AlertDescription>
          </Alert>
          <Button onClick={() => window.location.reload()} className="mt-4">
            Reload Page
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}

// Export FacilitatorDashboardWrapper as a default export
export default function FacilitatorDashboardWrapper() {
  return (
    <ErrorBoundary>
      <FacilitatorDashboard />
    </ErrorBoundary>
  )
}

/**
 * Custom hook for managing meeting timer
 * @param isActive - Boolean flag indicating if the timer should be running
 * @returns Current duration in seconds
 */
const useMeetingTimer = (isActive: boolean) => {
  // ... hook code
}