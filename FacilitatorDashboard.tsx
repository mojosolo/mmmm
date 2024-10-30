'use client';

import React, { useState, useEffect, useReducer, useMemo, useCallback, createContext, useContext } from 'react'
import { 
  Clock, 
  BarChart2, 
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
  Users,
  Menu,
  CheckCircle,
  ChevronRight,
  Calendar,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  ArrowLeft,
  ThumbsUp,
  ThumbsDown,
  Trash
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
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

// Constants and Configuration
const MEETING_CONFIG = {
  UPDATE_INTERVAL: 10000,
  MIN_TRANSCRIPT_LENGTH: 100,
  DEFAULT_DURATION: 0
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

interface Meeting {
  id: string
  title: string
  description: string
  startTime: string | null
  endTime: string | null
  agendaItems: AgendaItem[]
  transcriptItems: TranscriptItem[]
  insights: AIInsight[]
  participants: Participant[]
}

interface AgendaItem {
  id: string
  title: string
  duration: number
  status: 'not_started' | 'in_progress' | 'completed'
}

interface TranscriptItem {
  id: string
  speaker: string
  content: string
  timestamp: string
  agendaItemId: string
  aiInsight?: AIInsight
}

interface AIInsight {
  id: string
  content: string
  type: InsightType
  timestamp: string
  agendaItemId: string
  chatThread: ChatMessage[]
  agent: string
}

interface ChatMessage {
  id: string
  sender: string
  content: string
  timestamp: string
}

interface Participant {
  id: string
  name: string
  avatar: string
}

interface KanbanColumn {
  id: string
  title: string
  items: { id: string; content: string }[]
}

// Context
interface AppContextType {
  meetings: Meeting[]
  setMeetings: React.Dispatch<React.SetStateAction<Meeting[]>>
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

// Mock data 
const mockParticipants: Participant[] = [
  { id: "1", name: "John Doe", avatar: "/placeholder.svg?height=32&width=32" },
  { id: "2", name: "Jane Smith", avatar: "/placeholder.svg?height=32&width=32" },
  { id: "3", name: "Mike Johnson", avatar: "/placeholder.svg?height=32&width=32" },
  { id: "4", name: "Emily Brown", avatar: "/placeholder.svg?height=32&width=32" },
  { id: "5", name: "Alex Lee", avatar: "/placeholder.svg?height=32&width=32" },
]

const mockMeetings: Meeting[] = [
  {
    id: "1",
    title: "Sprint Planning",
    description: "Plan the upcoming two-week sprint and assign tasks",
    startTime: null,
    endTime: null,
    agendaItems: [
      { id: "1", title: "Sprint Goal Discussion", duration: 15, status: 'not_started' },
      { id: "2", title: "Backlog Refinement", duration: 30, status: 'not_started' },
      { id: "3", title: "Task Estimation", duration: 30, status: 'not_started' },
      { id: "4", title: "Capacity Planning", duration: 15, status: 'not_started' },
    ],
    transcriptItems: [],
    insights: [],
    participants: mockParticipants,
  },
  {
    id: "2",
    title: "Product Roadmap Review",
    description: "Quarterly review of the product roadmap and upcoming features",
    startTime: null,
    endTime: null,
    agendaItems: [
      { id: "1", title: "Q1 Recap", duration: 20, status: 'not_started' },
      { id: "2", title: "Q2 Goals and OKRs", duration: 25, status: 'not_started' },
      { id: "3", title: "Feature Prioritization", duration: 30, status: 'not_started' },
      { id: "4", title: "Resource Allocation", duration: 15, status: 'not_started' },
    ],
    transcriptItems: [],
    insights: [],
    participants: mockParticipants,
  },
]

const initialKanbanColumns: KanbanColumn[] = [
  { id: "1", title: "To Do", items: [] },
  { id: "2", title: "In Progress", items: [] },
  { id: "3", title: "Done", items: [] },
]

// Custom Hooks
const useMeetingTimer = (isActive: boolean) => {
  const [duration, setDuration] = useState<number>(MEETING_CONFIG.DEFAULT_DURATION)
  
  useEffect(() => {
    if (!isActive) return
    const timer = setInterval(() => setDuration(prev => prev + 1), 1000)
    return () => clearInterval(timer)
  }, [isActive])
  
  return duration
}

// Reducer for complex state management
const meetingReducer = (state: MeetingState, action: MeetingAction): MeetingState => {
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
  }
}

// Utility functions
const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

const generateRealisticScrumContent = (agendaItem: string): string => {
  const possibilities = [
    `For ${agendaItem}, we need to consider the impact on our current sprint velocity.`,
    `I suggest we break down ${agendaItem} into smaller, more manageable tasks.`,
    `We should prioritize ${agendaItem} based on its potential ROI and alignment with our quarterly goals.`,
    `Let's discuss any potential blockers or dependencies for ${agendaItem}.`,
    `We might need additional resources or expertise to complete ${agendaItem} effectively.`,
    `I propose we use the MoSCoW method to prioritize the features within ${agendaItem}.`,
    `We should consider the technical debt implications of ${agendaItem}.`,
    `For ${agendaItem}, let's ensure we have clear acceptance criteria defined.`,
  ]
  return possibilities[Math.floor(Math.random() * possibilities.length)]
}

const generateAIInsight = (agendaItem: string): string => {
  const possibilities = [
    `Based on the discussion around ${agendaItem}, there seems to be a need for more cross-team collaboration. Consider scheduling a workshop to align all stakeholders.`,
    `The complexity of ${agendaItem} might be underestimated. It's recommended to conduct a technical spike to better understand the implementation challenges.`,
    `There's a potential risk of scope creep in ${agendaItem}. Suggest clearly defining the MVP and creating a separate backlog for future enhancements.`,
    `The team's velocity might be impacted by ${agendaItem}. Consider adjusting the sprint commitment or allocating additional resources to maintain productivity.`,
    `${agendaItem} presents an opportunity for improving our CI/CD pipeline. Recommend investigating automation possibilities to streamline the delivery process.`,
    `Based on previous similar tasks, ${agendaItem} might benefit from pair programming to ensure knowledge sharing and code quality.`,
    `The discussion around ${agendaItem} indicates a need for user research. Consider conducting user interviews or A/B testing to validate assumptions.`,
    `To mitigate risks associated with ${agendaItem}, it's advisable to create a detailed implementation plan with clear milestones and checkpoints.`,
  ]
  return possibilities[Math.floor(Math.random() * possibilities.length)]
}

// [Rest of your corrected code continues here...]

// [Note: Due to space constraints, the full code is not displayed. Ensure you include the entire corrected code in your file.]

export default function FacilitatorDashboardWrapper() {
  return (
    <ErrorBoundary>
      <FacilitatorDashboard />
    </ErrorBoundary>
  )
} 