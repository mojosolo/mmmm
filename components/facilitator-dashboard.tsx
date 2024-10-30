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
  { id: '1', name: 'John Doe', avatar: '/placeholder.svg?height=32&width=32' },
  { id: '2', name: 'Jane Smith', avatar: '/placeholder.svg?height=32&width=32' },
  { id: '3', name: 'Mike Johnson', avatar: '/placeholder.svg?height=32&width=32' },
  { id: '4', name: 'Emily Brown', avatar: '/placeholder.svg?height=32&width=32' },
  { id: '5', name: 'Alex Lee', avatar: '/placeholder.svg?height=32&width=32' }
]

const mockMeetings: Meeting[] = [
  {
    id: '1',
    title: 'Sprint Planning',
    description: 'Plan the upcoming two-week sprint and assign tasks',
    startTime: null,
    endTime: null,
    agendaItems: [
      { id: '1', title: 'Sprint Goal Discussion', duration: 15, status: 'not_started' },
      { id: '2', title: 'Backlog Refinement', duration: 30, status: 'not_started' },
      { id: '3', title: 'Task Estimation', duration: 30, status: 'not_started' },
      { id: '4', title: 'Capacity Planning', duration: 15, status: 'not_started' }
    ],
    transcriptItems: [],
    insights: [],
    participants: mockParticipants
  },
  {
    id: '2',
    title: 'Product Roadmap Review',
    description: 'Quarterly review of the product roadmap and upcoming features',
    startTime: null,
    endTime: null,
    agendaItems: [
      { id: '1', title: 'Q1 Recap', duration: 20, status: 'not_started' },
      { id: '2', title: 'Q2 Goals and OKRs', duration: 25, status: 'not_started' },
      { id: '3', title: 'Feature Prioritization', duration: 30, status: 'not_started' },
      { id: '4', title: 'Resource Allocation', duration: 15, status: 'not_started' }
    ],
    transcriptItems: [],
    insights: [],
    participants: mockParticipants
  }
]

const initialKanbanColumns: KanbanColumn[] = [
  { id: '1', title: 'To Do', items: [] },
  { id: '2', title: 'In Progress', items: [] },
  { id: '3', title: 'Done', items: [] }
]

// Custom Hooks
const useMeetingTimer = (isActive: boolean) => {
  const [duration, setDuration] = useState<number>(MEETING_CONFIG.DEFAULT_DURATION)

  useEffect(() => {
    if (!isActive) return
    const timer = setInterval(() => setDuration((prev) => prev + 1), 1000)
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

const generateRealisticScrumContent = (agendaItem: string): string => {
  const possibilities = [
    `For ${agendaItem}, we need to consider the impact on our current sprint velocity.`,
    `I suggest we break down ${agendaItem} into smaller, more manageable tasks.`,
    `We should prioritize ${agendaItem} based on its potential ROI and alignment with our quarterly goals.`,
    `Let's discuss any potential blockers or dependencies for ${agendaItem}.`,
    `We might need additional resources or expertise to complete ${agendaItem} effectively.`,
    `I propose we use the MoSCoW method to prioritize the features within ${agendaItem}.`,
    `We should consider the technical debt implications of ${agendaItem}.`,
    `For ${agendaItem}, let's ensure we have clear acceptance criteria defined.`
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
    `To mitigate risks associated with ${agendaItem}, it's advisable to create a detailed implementation plan with clear milestones and checkpoints.`
  ]
  return possibilities[Math.floor(Math.random() * possibilities.length)]
}

// Component for AI Insight Modal
const AIInsightModal = ({ insight, onClose, context }: { insight: AIInsight | null, onClose: () => void, context: TranscriptItem[] }) => {
  const [chatInput, setChatInput] = useState("")
  const { meetings, setMeetings, selectedMeetingId } = useAppContext()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!insight || !selectedMeetingId) return
    
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      sender: 'User',
      content: chatInput,
      timestamp: new Date().toLocaleTimeString(),
    }

    setMeetings(prevMeetings => prevMeetings.map(meeting => 
      meeting.id === selectedMeetingId
        ? {
            ...meeting,
            insights: meeting.insights.map(item =>
              item.id === insight.id
                ? { ...item, chatThread: [...item.chatThread, newMessage] }
                : item
            )
          }
        : meeting
    ))

    setChatInput("")
  }

  if (!insight) return null

  return (
    <Dialog open={!!insight} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{insight.type.charAt(0).toUpperCase() + insight.type.slice(1)} Insight</DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          <h3 className="text-lg font-semibold mb-2">Context</h3>
          <ScrollArea className="h-40 mb-4 border rounded-md p-2">
            {context.map((item) => (
              <div key={item.id} className="mb-2">
                <span className="font-semibold">{item.speaker}: </span>
                <span>{item.content}</span>
              </div>
            ))}
          </ScrollArea>
          <h3 className="text-lg font-semibold mb-2">AI Analysis</h3>
          <p className="mb-4">{insight.content}</p>
          <h3 className="text-lg font-semibold mb-2">Suggested Next Steps</h3>
          <ul className="list-disc pl-5 mb-4">
            <li>Follow up on the discussed action items</li>
            <li>Schedule a meeting to address unresolved issues</li>
            <li>Share the meeting summary with all participants</li>
          </ul>
          <h3 className="text-lg font-semibold mb-2">Discussion</h3>
          <ScrollArea className="h-40 mb-4 border rounded-md p-2">
            {insight.chatThread.map((message) => (
              <div key={message.id} className="mb-2">
                <span className="font-semibold">{message.sender}: </span>
                <span>{message.content}</span>
              </div>
            ))}
          </ScrollArea>
          <form onSubmit={handleSubmit} className="flex space-x-2">
            <Input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Type your message..."
              className="flex-grow"
            />
            <Button type="submit">Send</Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Extracted components
const TranscriptView = ({ 
  items, 
  onInsightClick, 
  getInsightIcon 
}: { 
  items: TranscriptItem[], 
  onInsightClick: (insight: AIInsight) => void,
  getInsightIcon: (type: InsightType | undefined) => React.ReactNode
}) => (
  <ScrollArea className="h-full">
    {items.map((item) => (
      <div key={item.id} className="mb-4">
        <div className="p-3 rounded-lg bg-white">
          <div className="flex items-center justify-between">
            <span className="font-semibold">{item.speaker}</span>
            <span className="text-sm text-gray-500">{item.timestamp}</span>
          </div>
          <p className="mt-1">{item.content}</p>
        </div>
        {item.aiInsight && (
          <Collapsible className="mt-2">
            <CollapsibleTrigger className="flex items-center text-blue-500 hover:text-blue-700">
              <MessageSquare className="h-4 w-4 mr-1" />
              <span className="text-sm">{item.aiInsight.type.charAt(0).toUpperCase() + item.aiInsight.type.slice(1)}</span>
              <ChevronDown className="h-4 w-4 ml-1" />
            </CollapsibleTrigger>
            <CollapsibleContent className="p-2 bg-blue-50 rounded-lg mt-1">
              <div className="flex items-center mb-1">
                {getInsightIcon(item.aiInsight.type)}
                <span className="ml-2 font-semibold">{item.aiInsight.type.charAt(0).toUpperCase() + item.aiInsight.type.slice(1)}</span>
              </div>
              <p className="text-sm">{item.aiInsight.content}</p>
              <Button
                variant="link"
                className="mt-2 p-0 h-auto"
                onClick={() => onInsightClick(item.aiInsight!)}
              
              >
                View full context
              </Button>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    ))}
  </ScrollArea>
)

const InsightsPanel = ({ 
  insights, 
  onInsightSelect, 
  getInsightIcon 
}: { 
  insights: AIInsight[], 
  onInsightSelect: (insight: AIInsight) => void,
  getInsightIcon: (type: InsightType | undefined) => React.ReactNode
}) => (
  <ScrollArea className="h-full">
    {insights.map((insight) => (
      <div key={insight.id} className="mb-4 p-3 bg-blue-50 rounded-lg cursor-pointer" onClick={() => onInsightSelect(insight)}>
        <div className="flex items-center justify-between">
          {getInsightIcon(insight.type)}
          <span className="font-semibold ml-2 flex-grow">{insight.type.charAt(0).toUpperCase() + insight.type.slice(1)}</span>
          <span className="text-sm text-gray-500">{insight.timestamp}</span>
        </div>
        <p className="mt-1 text-sm">{insight.content.length > MEETING_CONFIG.MIN_TRANSCRIPT_LENGTH ? `${insight.content.substring(0, MEETING_CONFIG.MIN_TRANSCRIPT_LENGTH)}...` : insight.content}</p>
      </div>
    ))}
  </ScrollArea>
)

const AgendaTimeline = ({ items }: { items: AgendaItem[] }) => (
  <div className="flex space-x-2">
    {items.map((item) => (
      <div
        key={item.id}
        className={`flex-1 p-2 rounded-lg ${
          item.status === 'in_progress'
            ? 'bg-green-100 border-b-2 border-green-500'
            : item.status === 'completed'
            ? 'bg-gray-200 border-b-2 border-gray-400'
            : 'bg-gray-100'
        }`}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm truncate">{item.title}</span>
              {item.status === 'completed' && <CheckCircle className="h-4 w-4 text-gray-500" />}
              {item.status === 'in_progress' && <Circle className="h-4 w-4 text-green-500" />}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{item.title}</p>
            <p>{item.duration} minutes</p>
          </TooltipContent>
        </Tooltip>
      </div>
    ))}
  </div>
)

const MeetingsAndKanbanView = () => {
  const { meetings, kanbanColumns, setKanbanColumns, setSelectedMeetingId } = useAppContext()

  const addToKanban = useCallback((columnId: string, content: string) => {
    setKanbanColumns(prevColumns => 
      prevColumns.map(col =>
        col.id === columnId
          ? { ...col, items: [...col.items, { id: Date.now().toString(), content }] }
          : col
      )
    )
  }, [setKanbanColumns])

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">MojoMosaic Meeting Facilitator</h1>
      <Tabs defaultValue="upcoming" className="w-full">
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming Meetings</TabsTrigger>
          <TabsTrigger value="previous">Previous Meetings</TabsTrigger>
          <TabsTrigger value="kanban">Kanban Board</TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {meetings.filter(m => !m.endTime).map(meeting => (
              <Card key={meeting.id} className="cursor-pointer" onClick={() => setSelectedMeetingId(meeting.id)}>
                <CardHeader>
                  <CardTitle>{meeting.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>{meeting.description}</p>
                  <div className="mt-2 flex items-center">
                    <Calendar className="mr-2 h-4 w-4" />
                    <span>{meeting.startTime ? new Date(meeting.startTime).toLocaleString() : 'Not started'}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="previous">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {meetings.filter(m => m.endTime).map(meeting => (
              <Card key={meeting.id}>
                <CardHeader>
                  <CardTitle>{meeting.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>{meeting.description}</p>
                  <div className="mt-2 flex items-center">
                    <Calendar className="mr-2 h-4 w-4" />
                    <span>{new Date(meeting.endTime!).toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="kanban">
          <div className="flex space-x-4 overflow-x-auto">
            {kanbanColumns.map((column) => (
              <div key={column.id} className="flex-shrink-0 w-64">
                <h3 className="font-semibold mb-2">{column.title}</h3>
                <div className="bg-gray-100 p-2 rounded-lg">
                  {column.items.map((item) => (
                    <div key={item.id} className="bg-white p-2 mb-2 rounded shadow">
                      {item.content}
                    </div>
                  ))}
                  <Button 
                    onClick={() => addToKanban(column.id, `New item in ${column.title}`)}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Item
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

const LeftSidebar = ({ selectedMeeting, meetingDuration, meetingState, startMeeting, stopMeeting, setShowQRCode, setSelectedMeetingId }: {
  selectedMeeting: Meeting
  meetingDuration: number
  meetingState: MeetingState
  startMeeting: () => void
  stopMeeting: () => void
  setShowQRCode: (show: boolean) => void
  setSelectedMeetingId: (id: string | null) => void
}) => (
  <div className="w-64 bg-white shadow-md p-4 flex flex-col">
    <h2 className="text-xl font-bold mb-4">{selectedMeeting.title}</h2>
    <p className="text-gray-600 mb-4">{selectedMeeting.description}</p>
    <div className="flex items-center mb-4">
      <Clock className="h-5 w-5 text-gray-500 mr-2" />
      <span className="font-semibold">{formatTime(meetingDuration)}</span>
    </div>
    {meetingState.status === 'not_started' && (
      <Button 
        onClick={startMeeting} 
        disabled={meetingState.isLoading} 
        className="mb-4 bg-green-500 hover:bg-green-600 text-white"
        aria-busy={meetingState.isLoading}
        aria-label="Start meeting"
      >
        {meetingState.isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
        Start Meeting
      </Button>
    )}
    {meetingState.status === 'in_progress' && (
      <Button 
        onClick={stopMeeting} 
        variant="destructive" 
        disabled={meetingState.isLoading} 
        className="mb-4"
        aria-busy={meetingState.isLoading}
        aria-label="End meeting"
      >
        {meetingState.isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
        End Meeting
      </Button>
    )}
    <h3 className="font-semibold mb-2">Participants</h3>
    <ScrollArea className="flex-grow">
      {selectedMeeting.participants.map((participant) => (
        <div key={participant.id} className="flex items-center mb-2">
          <Avatar className="h-8 w-8 mr-2">
            <AvatarImage src={participant.avatar} alt={participant.name} />
            <AvatarFallback>{participant.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <span>{participant.name}</span>
        </div>
      ))}
    </ScrollArea>
    <Button onClick={() => setShowQRCode(true)} variant="outline" className="mt-4">
      <QrCode className="mr-2 h-4 w-4" />
      Show QR Code
    </Button>
    <Button onClick={() => setSelectedMeetingId(null)} variant="ghost" className="mt-2">
      Back to Meetings
    </Button>
  </div>
)

const MainContent = ({ selectedMeeting, meetingState, moveToNextAgendaItem, currentTranscriptItems, currentInsights, openInsightModal, getInsightIcon, handleAIPrompt, aiPrompt, setAiPrompt }: {
  selectedMeeting: Meeting
  meetingState: MeetingState
  moveToNextAgendaItem: () => void
  currentTranscriptItems: TranscriptItem[]
  currentInsights: AIInsight[]
  openInsightModal: (insight: AIInsight) => void
  getInsightIcon: (type: InsightType | undefined) => React.ReactNode
  handleAIPrompt: (e: React.FormEvent) => void
  aiPrompt: string
  setAiPrompt: (prompt: string) => void
}) => (
  <div className="flex-1 flex flex-col overflow-hidden">
    {meetingState.error && (
      <Alert variant="destructive" className="m-4">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{meetingState.error}</AlertDescription>
      </Alert>
    )}

    {/* Agenda Timeline */}
    <div className="bg-white shadow-md p-4 mb-4">
      <h3 className="text-lg font-semibold mb-2">Agenda</h3>
      <AgendaTimeline items={selectedMeeting.agendaItems} />
      {meetingState.status === 'in_progress' && (
        <Button onClick={moveToNextAgendaItem} className="mt-2" size="sm">
          Next Agenda Item
        </Button>
      )}
    </div>

    {/* Meeting Content */}
    <div className="flex-1 flex space-x-4 overflow-hidden p-4">
      {/* Transcript */}
      <div className="w-1/2 overflow-hidden flex flex-col">
        <Card className="h-full flex flex-col">
          <CardHeader>
            <CardTitle>Meeting Transcript</CardTitle>
          </CardHeader>
          <CardContent className="flex-grow overflow-y-auto">
            <TranscriptView 
              items={currentTranscriptItems} 
              onInsightClick={openInsightModal}
              getInsightIcon={getInsightIcon}
            />
          </CardContent>
        </Card>
      </div>

      {/* AI Insights */}
      <div className="w-1/2 overflow-hidden flex flex-col">
        <Card className="h-full flex flex-col">
          <CardHeader>
            <CardTitle>AI Insights</CardTitle>
          </CardHeader>
          <CardContent className="flex-grow overflow-y-auto">
            <InsightsPanel 
              insights={currentInsights} 
              onInsightSelect={openInsightModal}
              getInsightIcon={getInsightIcon}
            />
          </CardContent>
          <CardFooter>
            <form onSubmit={handleAIPrompt} className="w-full flex space-x-2">
              <Input
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Ask AI for insights..."
                className="flex-grow"
              />
              <Button type="submit">
                <Send className="h-4 w-4 mr-2" />
                Send
              </Button>
            </form>
          </CardFooter>
        </Card>
      </div>
    </div>
  </div>
)

function FacilitatorDashboard() {
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null)
  const [kanbanColumns, setKanbanColumns] = useState<KanbanColumn[]>(initialKanbanColumns)
  const [showQRCode, setShowQRCode] = useState(false)
  const [aiPrompt, setAiPrompt] = useState("")
  
  const [selectedInsight, setSelectedInsight] = useState<AIInsight | null>(null)
  const [insightContext, setInsightContext] = useState<TranscriptItem[]>([])

  const [meetingState, dispatch] = useReducer(meetingReducer, {
    status: 'not_started',
    duration: MEETING_CONFIG.DEFAULT_DURATION,
    currentAgendaItemIndex: 0,
    error: null,
    isLoading: false
  })

  const selectedMeeting = useMemo(() => mockMeetings.find(m => m.id === selectedMeetingId) || null, [selectedMeetingId])
  const meetingDuration = useMeetingTimer(meetingState.status === 'in_progress')

  const currentTranscriptItems = useMemo(() => {
    if (!selectedMeeting?.agendaItems?.[meetingState.currentAgendaItemIndex]) return []
    return selectedMeeting.transcriptItems.filter(
      item => item.agendaItemId === selectedMeeting.agendaItems[meetingState.currentAgendaItemIndex].id
    )
  }, [selectedMeeting, meetingState.currentAgendaItemIndex])

  const currentInsights = useMemo(() => {
    if (!selectedMeeting?.agendaItems?.[meetingState.currentAgendaItemIndex]) return []
    return selectedMeeting.insights.filter(
      insight => insight.agendaItemId === selectedMeeting.agendaItems[meetingState.currentAgendaItemIndex].id
    )
  }, [selectedMeeting, meetingState.currentAgendaItemIndex])

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

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null
    
    const simulateRealtimeUpdates = () => {
      const meeting = mockMeetings.find(m => m.id === selectedMeetingId)
      if (!meeting) return

      const currentAgendaItem = meeting.agendaItems[meetingState.currentAgendaItemIndex]
      if (!currentAgendaItem) return

      setMeetings(prevMeetings => {
        const updatedMeetings = prevMeetings.map(meetingItem => {
          if (meetingItem.id !== selectedMeetingId) return meetingItem

          const updatedMeeting = { ...meetingItem }

          // Simulate new transcript item
          const newTranscriptItem: TranscriptItem = {
            id: Date.now().toString(),
            speaker: meetingItem.participants[Math.floor(Math.random() * meetingItem.participants.length)].name,
            content: generateRealisticScrumContent(currentAgendaItem.title),
            timestamp: new Date().toLocaleTimeString(),
            agendaItemId: currentAgendaItem.id,
          }

          // Simulate AI insight (less frequently)
          if (Math.random() > 0.7) {
            const aiInsight: AIInsight = {
              id: `insight-${Date.now()}`,
              content: generateAIInsight(currentAgendaItem.title),
              type: ['think', 'reflect', 'plan'][Math.floor(Math.random() * 3)] as InsightType,
              timestamp: new Date().toLocaleTimeString(),
              agendaItemId: currentAgendaItem.id,
              chatThread: [],
              agent: 'AI',
            }
            newTranscriptItem.aiInsight = aiInsight
            updatedMeeting.insights = [...updatedMeeting.insights, aiInsight]
          }

          updatedMeeting.transcriptItems = [...updatedMeeting.transcriptItems, newTranscriptItem]

          return updatedMeeting
        })

        return updatedMeetings
      })
    }

    if (selectedMeetingId && meetingState.status === 'in_progress') {
      simulateRealtimeUpdates() // Initial update
      timer = setInterval(simulateRealtimeUpdates, MEETING_CONFIG.UPDATE_INTERVAL)
    }

    return () => {
      if (timer) clearInterval(timer)
    }
  }, [selectedMeetingId, meetingState.status, meetingState.currentAgendaItemIndex, mockMeetings])

  const moveToNextAgendaItem = useCallback(() => {
    if (!selectedMeeting) return
    const nextIndex = meetingState.currentAgendaItemIndex + 1
    if (nextIndex >= selectedMeeting.agendaItems.length) return  // Add this guard

    setMeetings(prevMeetings => prevMeetings.map(meeting => {
      if (meeting.id !== selectedMeeting.id) return meeting
      const updatedAgendaItems = [...meeting.agendaItems]
      updatedAgendaItems[meetingState.currentAgendaItemIndex].status = 'completed'
      updatedAgendaItems[nextIndex].status = 'in_progress'
      dispatch({ type: 'NEXT_AGENDA_ITEM' })
      return {
        ...meeting,
        agendaItems: updatedAgendaItems
      }
    }))
  }, [selectedMeeting, meetingState.currentAgendaItemIndex])

  const handleAIPrompt = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedMeeting || !aiPrompt.trim()) return
    
    const newInsight: AIInsight = {
      id: Date.now().toString(),
      content: `AI response to "${aiPrompt}": ${generateAIInsight(selectedMeeting.agendaItems[meetingState.currentAgendaItemIndex].title)}`,
      type: 'think',
      timestamp: new Date().toLocaleTimeString(),
      agendaItemId: selectedMeeting.agendaItems[meetingState.currentAgendaItemIndex].id,
      chatThread: [],
      agent: 'AI',
    }
    setMeetings(prevMeetings => prevMeetings.map(meeting => 
      meeting.id === selectedMeeting.id
        ? { ...meeting, insights: [...meeting.insights, newInsight] }
        : meeting
    ))
    setAiPrompt("")
  }, [selectedMeeting, aiPrompt, meetingState.currentAgendaItemIndex])

  const startMeeting = useCallback(async () => {
    if (!selectedMeeting) return
    dispatch({ type: 'SET_LOADING', payload: true })
    try {
      await new Promise(resolve => setTimeout(resolve, 1000))
      dispatch({ type: 'START_MEETING' })
      setMeetings(prevMeetings => prevMeetings.map(meeting => 
        meeting.id === selectedMeeting.id
          ? {
              ...meeting,
              startTime: new Date().toISOString(),
              agendaItems: meeting.agendaItems.map((item, index) => 
                index === 0 ? { ...item, status: 'in_progress' } : item
              )
            }
          : meeting
      ))
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to start meeting' })
    }
  }, [selectedMeeting])

  const stopMeeting = useCallback(async () => {
    if (!selectedMeeting) return
    dispatch({ type: 'SET_LOADING', payload: true })
    try {
      await new Promise(resolve => setTimeout(resolve, 1000))
      dispatch({ type: 'END_MEETING' })
      setMeetings(prevMeetings => prevMeetings.map(meeting => 
        meeting.id === selectedMeeting.id
          ? { ...meeting, endTime: new Date().toISOString() }
          : meeting
      ))
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to end meeting' })
    }
  }, [selectedMeeting])

  const addToKanban = useCallback((columnId: string, content: string) => {
    setKanbanColumns(prevColumns => 
      prevColumns.map(col =>
        col.id === columnId
          ? { ...col, items: [...col.items, { id: Date.now().toString(), content }] }
          : col
      )
    )
  }, [])

  const openInsightModal = useCallback((insight: AIInsight) => {
    if (!selectedMeeting) return
    const context = selectedMeeting.transcriptItems.filter(item => item.agendaItemId === insight.agendaItemId)
    setInsightContext(context)
    setSelectedInsight(insight)
  }, [selectedMeeting])

  const contextValue = useMemo(() => ({
    meetings,
    setMeetings,
    selectedMeetingId,
    setSelectedMeetingId,
    kanbanColumns,
    setKanbanColumns,
    meetingState,
    dispatch,
  }), [meetings, selectedMeetingId, kanbanColumns, meetingState])

  return (
    <AppContext.Provider value={contextValue}>
      <TooltipProvider>
        <div className="flex h-screen bg-gray-100">
          {selectedMeeting ? (
            <>
              <LeftSidebar 
                selectedMeeting={selectedMeeting}
                meetingDuration={meetingDuration}
                meetingState={meetingState}
                startMeeting={startMeeting}
                stopMeeting={stopMeeting}
                setShowQRCode={setShowQRCode}
                setSelectedMeetingId={setSelectedMeetingId}
              />
              <MainContent 
                selectedMeeting={selectedMeeting}
                meetingState={meetingState}
                moveToNextAgendaItem={moveToNextAgendaItem}
                currentTranscriptItems={currentTranscriptItems}
                currentInsights={currentInsights}
                openInsightModal={openInsightModal}
                getInsightIcon={getInsightIcon}
                handleAIPrompt={handleAIPrompt}
                aiPrompt={aiPrompt}
                setAiPrompt={setAiPrompt}
              />
            </>
          ) : (
            <div className="flex-1">
              <MeetingsAndKanbanView />
            </div>
          )}

          {/* AI Insight Modal */}
          {selectedInsight && (
            <AIInsightModal
              insight={selectedInsight}
              onClose={() => setSelectedInsight(null)}
              context={insightContext}
            />
          )}

          {/* QR Code Modal */}
          {showQRCode && (
            <Dialog open={showQRCode} onOpenChange={setShowQRCode}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Scan to Participate</DialogTitle>
                </DialogHeader>
                <div className="flex items-center justify-center py-6">
                  <div className="w-64 h-64 bg-gray-200 flex items-center justify-center">
                    <QrCode size={200} />
                  </div>
                </div>
                <DialogFooter className="sm:justify-start">
                  <Button type="button" variant="secondary" onClick={() => setShowQRCode(false)}>
                    Close
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </TooltipProvider>
    </AppContext.Provider>
  )
}

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: React.ReactNode}) {
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
          <Button 
            onClick={() => window.location.reload()} 
            className="mt-4"
          >
            Reload Page
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}

// Export the FacilitatorDashboard component
export function FacilitatorDashboardComponent() {
  return (
    <ErrorBoundary>
      <FacilitatorDashboard />
    </ErrorBoundary>
  );
}