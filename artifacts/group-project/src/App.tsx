import { useEffect, useMemo, useRef, useState } from 'react'
import { Accessibility, ArrowRight, ArrowUpRight, BarChart3, BookOpen, Bot, Building2, Check, CheckCircle2, ChevronDown, Clock3, Flag, GraduationCap, Hand, Headphones, Layers3, LockKeyhole, Mail, Mic, Send, ShieldCheck, Sparkles, Target, UserRound, UsersRound, Volume2, X } from 'lucide-react'
import { createScenarioForProfile, groupLevels, majorMappingPreview, openingForLevel, patternsForSkill, resolveMajorDomain, type BoardItem, type Domain, type GroupLevel, type Message, type Move, type PracticeMode, type RoleRuntimeState, type SkillCard } from './scenario'

const avatar: Record<string, string> = { Alex: 'A', Sophie: 'S', Ryan: 'R', You: 'Y', Coach: '✦' }
const colors: Record<string, string> = { Alex: 'blue', Sophie: 'lavender', Ryan: 'orange', You: 'pink', Coach: 'mint' }
type ReplayEntry = {
  nodeId: string
  skill: string
  quote: string
  teamEffect: string
  replay: Record<string, string>
  taskSettled?: boolean
  conclusion?: string
}

const levelOneStepLabels = ['Meeting opens', 'Set direction', 'Shape the work', 'Bring in evidence', 'Align the plan', 'Confirm next steps']
const neutralCueByNode: Record<string, string> = {
  clarify_direction: 'The group is beginning to turn the brief into a shared direction.',
  state_preference: 'The group is starting to shape responsibilities.',
  clarify_scope: 'Ideas are becoming tasks; details may matter now.',
  invite_evidence: 'The group is deciding what information should guide the plan.',
  integrate_views: 'The group is weighing more than one useful consideration.',
  confirm_commitments: 'The meeting is moving toward a concrete next step.',
}

const skillChineseLabels: Record<string, string> = {
  read_risk: '观察局面',
  enter: '进入对话，表达偏好',
  clarify_scope: '澄清任务',
  low_request: '提出低负担请求',
  paraphrase: '复述确认',
  summarize_next: '总结下一步',
}

// The pack is deliberately not a plot checklist. Keep a stable mixed order so
// learners choose from the whole set rather than follow the next card visually.
const skillPackOrder = ['paraphrase', 'read_risk', 'summarize_next', 'enter', 'clarify_scope', 'low_request']
const groupProjectApiBase = (import.meta.env.VITE_GROUP_PROJECT_API_BASE || '/api').replace(/\/$/, '')

const meetingStageCharacters = [
  { speaker: 'You', label: 'You', position: 'stage-you' },
  { speaker: 'Alex', label: 'Alex', position: 'stage-alex' },
  { speaker: 'Sophie', label: 'Sophie', position: 'stage-sophie' },
  { speaker: 'Ryan', label: 'Ryan', position: 'stage-ryan' },
]

function bubbleReadingDuration(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean).length
  return Math.max(4400, Math.min(10500, 1200 + words * 420))
}

function GroupProjectScene({ onExit, onComplete, initialDomain, level, practiceMode, profile }: { onExit: () => void; onComplete: (level: GroupLevel, mode: PracticeMode) => void; initialDomain: Domain; level: GroupLevel; practiceMode: PracticeMode; profile: StudentProfile }) {
  const scenario = useMemo(() => createScenarioForProfile(profile, initialDomain, level, 'A', practiceMode), [profile, initialDomain, level, practiceMode])
  const teamMembers = scenario.contract.team?.members || scenario.contract.roles || []
  const openingMessages = useMemo(() => openingForLevel(level, scenario.contract.team), [level, scenario.contract.team])
  const [phase, setPhase] = useState<'brief' | 'observe' | 'meet' | 'replay'>('brief')
  const [board, setBoard] = useState<BoardItem[]>(scenario.board)
  const [messages, setMessages] = useState<Message[]>(openingMessages)
  const [input, setInput] = useState('')
  const [event, setEvent] = useState('Observe before you enter')
  const [skills, setSkills] = useState<string[]>([])
  const [usedCardIds, setUsedCardIds] = useState<Move[]>([])
  const [actionReadyNodeIds, setActionReadyNodeIds] = useState<string[]>([])
  const [completedNodeIds, setCompletedNodeIds] = useState<string[]>([])
  const [nodeConclusions, setNodeConclusions] = useState<Record<string, string>>({})
  const [teamStates, setTeamStates] = useState<Record<string, RoleRuntimeState>>(scenario.contract.initialTeamState || {})
  const [ineffectiveAttempts, setIneffectiveAttempts] = useState<Record<string, number>>({})
  const [dismissedCueIds, setDismissedCueIds] = useState<string[]>([])
  const [helpedNodeIds, setHelpedNodeIds] = useState<string[]>([])
  const [showHint, setShowHint] = useState(false)
  const [replayEntries, setReplayEntries] = useState<ReplayEntry[]>([])
  const [equippedCard, setEquippedCard] = useState<SkillCard | null>(null)
  const [previewCard, setPreviewCard] = useState<SkillCard | null>(null)
  const [signalCollapsed, setSignalCollapsed] = useState(false)
  const [taskMomentOpen, setTaskMomentOpen] = useState(false)
  const [sceneCueOpen, setSceneCueOpen] = useState(false)
  const [shownQuickEntryNodeIds, setShownQuickEntryNodeIds] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const priorEventRef = useRef(event)
  const taskMomentNodeRef = useRef<string | null>(null)
  const [visibleOpeningCount, setVisibleOpeningCount] = useState(0)
  const [isThinking, setIsThinking] = useState(false)
  const [openingError, setOpeningError] = useState('')
  const [systemError, setSystemError] = useState('')
  const meetingStartedAt = useRef<number | null>(null)
  const [meetingDurationSeconds, setMeetingDurationSeconds] = useState(0)
  const domainInfo = scenario
  const currentNode = useMemo(() => scenario.contract.nodes?.find((node) => !completedNodeIds.includes(node.id)), [scenario.contract.nodes, completedNodeIds])
  const requiredCard = useMemo(() => currentNode ? scenario.contract.cards.find((card) => card.id === currentNode.skillId) : undefined, [scenario.contract.cards, currentNode])
  const visibleCards = useMemo(() => [...scenario.contract.cards].sort((left, right) => {
    const leftIndex = skillPackOrder.indexOf(left.id)
    const rightIndex = skillPackOrder.indexOf(right.id)
    return (leftIndex === -1 ? skillPackOrder.length : leftIndex) - (rightIndex === -1 ? skillPackOrder.length : rightIndex)
  }), [scenario.contract.cards])
  const currentSignal = phase === 'meet' ? requiredCard?.signal : undefined
  const currentNodeIndex = currentNode ? (scenario.contract.nodes?.findIndex((node) => node.id === currentNode.id) ?? -1) : (scenario.contract.nodes?.length || 0)
  const currentCue = scenario.contract.microFrictionPlan?.find((friction) => friction.nodeId === currentNode?.id)?.cue
    || (currentNode ? neutralCueByNode[currentNode.id] : undefined)
  const currentAttemptCount = currentNode ? ineffectiveAttempts[currentNode.id] || 0 : 0
  const showFullSignal = Boolean(currentNode && (showHint || currentAttemptCount >= 2))
  const showRoomCue = Boolean(currentNode && currentCue && !taskMomentOpen && !showFullSignal && !dismissedCueIds.includes(currentNode.id))
  const progress = phase === 'brief' ? 5 : phase === 'observe' ? 30 : phase === 'meet' ? 76 : 100
  const visibleMessages = phase === 'observe' ? messages.slice(0, visibleOpeningCount) : messages
  const latestMessage = visibleMessages[visibleMessages.length - 1]
  const stageBubbleMessages = visibleMessages
    .slice()
    .reverse()
    .filter((message, index, all) => message.speaker !== 'Coach' && all.findIndex((candidate) => candidate.speaker === message.speaker) === index)
    .slice(0, 4)
    .reverse()
  const missionDone = useMemo(() => {
    if (level === 1) return (scenario.contract.nodes || []).every((node) => completedNodeIds.includes(node.id))
    if (level === 2) return usedCardIds.includes('update_dependencies') && usedCardIds.length >= 3
    return usedCardIds.includes('repair_commitment') && (usedCardIds.includes('advocate_fairness') || usedCardIds.includes('contribution_repair')) && usedCardIds.length >= 4
  }, [board, completedNodeIds, level, usedCardIds, scenario.contract.nodes])
  const taskBoardUnlocked = phase !== 'brief'
  const stageImageSrc = `${import.meta.env.BASE_URL}group-project-meeting-room.png`
  const stageSlots = ['alex', 'sophie', 'ryan']
  const visualSlotBySpeaker = Object.fromEntries(teamMembers.slice(0, 3).map((member, index) => [member.id, stageSlots[index]]))
  const meetingStageCharacters = [{ speaker: 'You', label: 'You', position: 'stage-you', slot: 'you' }, ...teamMembers.slice(0, 3).map((member, index) => ({ speaker: member.id, label: member.id, position: ['stage-alex', 'stage-sophie', 'stage-ryan'][index], slot: stageSlots[index] }))]

  useEffect(() => {
    if (phase !== 'observe' || visibleOpeningCount >= openingMessages.length) return
    const currentOpening = messages[visibleOpeningCount]
    const timer = window.setTimeout(() => setVisibleOpeningCount((count) => count + 1), bubbleReadingDuration(currentOpening?.text || ''))
    return () => window.clearTimeout(timer)
  }, [phase, visibleOpeningCount, openingMessages.length, messages])
  useEffect(() => {
    if (event !== priorEventRef.current) {
      setSignalCollapsed(false)
      priorEventRef.current = event
    }
  }, [event])
  useEffect(() => {
    if (!currentNode?.stateBefore) return
    setTeamStates((all) => {
      const next = { ...all }
      Object.entries(currentNode.stateBefore || {}).forEach(([member, change]) => { next[member] = { ...next[member], ...(change as Partial<RoleRuntimeState>) } })
      return next
    })
  }, [currentNode?.id])
  useEffect(() => {
    if (phase !== 'meet' || level !== 1 || !currentNode?.taskMoment || taskMomentNodeRef.current === currentNode.id) return
    taskMomentNodeRef.current = currentNode.id
    setTaskMomentOpen(true)
  }, [currentNode?.id, level, phase])
  function restartMission() { setBoard(scenario.board); setMessages(openingMessages); setPhase('brief'); setSkills([]); setUsedCardIds([]); setActionReadyNodeIds([]); setCompletedNodeIds([]); setNodeConclusions({}); setTeamStates(scenario.contract.initialTeamState || {}); setIneffectiveAttempts({}); setDismissedCueIds([]); setHelpedNodeIds([]); setShowHint(false); setReplayEntries([]); setEquippedCard(null); setPreviewCard(null); setSystemError(''); setSignalCollapsed(false); setTaskMomentOpen(false); setSceneCueOpen(false); setShownQuickEntryNodeIds([]); taskMomentNodeRef.current = null; setMeetingDurationSeconds(0); meetingStartedAt.current = null; setEvent('Observe before you enter'); priorEventRef.current = 'Observe before you enter'; setVisibleOpeningCount(0); setOpeningError('') }
  async function startObservation() {
    if (isThinking) return
    setIsThinking(true); setOpeningError('')
    let started = false
    try {
      const response = await fetch(`${groupProjectApiBase}/group-project/opening`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile, level, scenario: { project: scenario.project, brief: scenario.brief, language: scenario.language, contract: scenario.contract }, board }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'The AI service could not create the opening.')
      setMessages(result.messages.map((message: { speaker: 'Alex' | 'Sophie' | 'Ryan'; text: string }, index: number) => ({ id: Date.now() + index, speaker: message.speaker, text: message.text, time: `00:${String((index + 1) * 9).padStart(2, '0')}` })))
      meetingStartedAt.current = Date.now()
      started = true
    } catch (error) {
      setEvent('API_CONNECTION_ERROR')
      // Provider/format details are useful in server logs, but they are not coaching
      // and should never become part of a student's learning experience.
      setOpeningError('The team could not enter the room just now. Please try again in a moment; your mission details are still saved.')
    } finally { if (started) { setVisibleOpeningCount(0); setPhase('observe') }; setIsThinking(false) }
  }
  function joinMeeting() {
    setPhase('meet'); setEvent(currentNode?.event || scenario.contract.eventChain[0])
  }
  async function enterTaskMoment() {
    setTaskMomentOpen(false)
    if (practiceMode === 'quick' && currentNode?.quickEntry?.length && !shownQuickEntryNodeIds.includes(currentNode.id)) {
      const now = Date.now()
      const entryMessages: Message[] = currentNode.quickEntry.map((line, index) => ({
        id: now + index,
        speaker: line.speaker,
        text: line.text,
        time: 'now',
        event: index === 0 ? currentNode.event : undefined,
      }))
      setShownQuickEntryNodeIds((all) => [...all, currentNode.id])
      setIsThinking(true)
      for (const entry of entryMessages) {
        setMessages((all) => [...all, entry])
        await new Promise<void>((resolve) => window.setTimeout(resolve, bubbleReadingDuration(entry.text)))
      }
      setIsThinking(false)
    }
    if (currentNode?.sceneCue) setSceneCueOpen(true)
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }
  function equipSkill(card: SkillCard) {
    if (usedCardIds.includes(card.id)) return
    setEquippedCard(card); setPreviewCard(null)
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }
  async function makeMove() {
    if (isThinking) return
    const userText = input.trim()
    if (!userText.trim()) return
    const selectedCard = equippedCard
    const userMessage: Message = { id: Date.now(), speaker: 'You', time: 'now', text: userText }
    const transcript = [...messages, userMessage]
    setMessages(transcript); setInput(''); setIsThinking(true); setSystemError('')
    try {
      const response = await fetch(`${groupProjectApiBase}/group-project/turn`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile, level, scenario: { project: scenario.project, brief: scenario.brief, objectives: scenario.objectives, language: scenario.language, contract: scenario.contract }, board, transcript, userText, selectedSkill: selectedCard ? { id: selectedCard.id, label: selectedCard.label, description: selectedCard.description } : null, completedNodeIds, actionReadyNodeIds, nodeConclusions, teamStates, ineffectiveAttempts }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'The AI service could not respond.')
      const replies: Message[] = result.messages.map((message: { speaker: 'Alex' | 'Sophie' | 'Ryan'; text: string }, index: number) => ({ id: Date.now() + index + 1, speaker: message.speaker, text: message.text, time: 'now', event: index === 0 ? result.event : undefined }))
      for (const reply of replies) {
        setMessages((all) => [...all, reply])
        await new Promise<void>((resolve) => window.setTimeout(resolve, bubbleReadingDuration(reply.text)))
      }
      setEvent(result.event || 'TEAM_RESPONSE')
      if (result.skillAccepted && result.recognizedSkillId) {
        const recognisedCard = scenario.contract.cards.find((card) => card.id === result.recognizedSkillId)
        const isNewSkill = !usedCardIds.includes(result.recognizedSkillId)
        setUsedCardIds((all) => all.includes(result.recognizedSkillId) ? all : [...all, result.recognizedSkillId])
        if (recognisedCard) setSkills((all) => all.includes(recognisedCard.label) ? all : [...all, recognisedCard.label])
        if (result.currentNodeId) setActionReadyNodeIds((all) => all.includes(result.currentNodeId) ? all : [...all, result.currentNodeId])
        if (recognisedCard && result.currentNodeId && isNewSkill) setReplayEntries((all) => [...all, { nodeId: result.currentNodeId, skill: recognisedCard.label, quote: userText, teamEffect: result.skillAssessment?.teamEffect || '', replay: result.skillAssessment?.replay || {} }])
      } else if (!result.actionPreviouslyRecognized && currentNode) setIneffectiveAttempts((all) => ({ ...all, [currentNode.id]: (all[currentNode.id] || 0) + 1 }))
      if (result.nodeCompleted && result.currentNodeId) {
        setCompletedNodeIds((all) => all.includes(result.currentNodeId) ? all : [...all, result.currentNodeId])
        setShowHint(false)
        const conclusion = typeof result.nodeMemory?.conclusion === 'string' ? result.nodeMemory.conclusion : ''
        const fallbackSkill = scenario.contract.cards.find((card) => card.id === currentNode?.skillId)
        setReplayEntries((all) => {
          const hasEntry = all.some((entry) => entry.nodeId === result.currentNodeId)
          if (!hasEntry && fallbackSkill) return [...all, { nodeId: result.currentNodeId, skill: fallbackSkill.label, quote: userText, teamEffect: result.skillAssessment?.teamEffect || 'Your follow-up helped settle the project task.', replay: result.skillAssessment?.replay || {}, taskSettled: true, conclusion }]
          return all.map((entry) => entry.nodeId === result.currentNodeId ? { ...entry, taskSettled: true, conclusion: conclusion || entry.conclusion, teamEffect: result.skillAccepted && result.skillAssessment?.teamEffect ? result.skillAssessment.teamEffect : entry.teamEffect, replay: result.skillAccepted && Object.keys(result.skillAssessment?.replay || {}).length ? result.skillAssessment.replay : entry.replay } : entry)
        })
      }
      if (result.nodeMemory?.nodeId && typeof result.nodeMemory.conclusion === 'string') setNodeConclusions((all) => ({ ...all, [result.nodeMemory.nodeId]: result.nodeMemory.conclusion }))
      if (result.roleStateUpdates && typeof result.roleStateUpdates === 'object') setTeamStates((all) => {
        const next = { ...all }
        Object.entries(result.roleStateUpdates).forEach(([member, change]) => { next[member] = { ...next[member], ...(change as Partial<RoleRuntimeState>) } })
        return next
      })
      if (Array.isArray(result.boardUpdates)) setBoard((items) => items.map((item) => { const update = result.boardUpdates.find((entry: { id: string }) => entry.id === item.id); return update ? { ...item, ...update } : item }))
    } catch (_error) {
      setSystemError('The team could not respond just now. Your message is still visible; try sending a follow-up in a moment.')
    } finally { setEquippedCard(null); setIsThinking(false) }
  }
  function openHelp() {
    if (currentNode) setHelpedNodeIds((all) => all.includes(currentNode.id) ? all : [...all, currentNode.id])
    setShowHint(true)
    setSignalCollapsed(false)
  }
  function openReplay() {
    setMeetingDurationSeconds(meetingStartedAt.current ? Math.max(1, Math.round((Date.now() - meetingStartedAt.current) / 1000)) : 0)
    setPhase('replay')
  }
  function finish() {
    openReplay()
    onComplete(level, practiceMode)
  }

  if (phase === 'replay') return <ReplayScreen scenario={scenario} practiceMode={practiceMode} entries={replayEntries} messages={messages} completedNodeIds={completedNodeIds} nodeConclusions={nodeConclusions} helpedNodeIds={helpedNodeIds} ineffectiveAttempts={ineffectiveAttempts} turnCount={messages.filter((message) => message.speaker === 'You').length} durationSeconds={meetingDurationSeconds} onExit={onExit} onReplay={restartMission} />

  return <main className="app-shell">
    <aside className="rail"><div className="logo">perspeak<span>AI</span></div><div className="rail-label">COMMUNICATION<br />SIMULATOR</div><nav><button className="rail-icon active" aria-label="Missions"><Target size={19} /></button><button className="rail-icon" aria-label="Growth path"><Layers3 size={19} /></button><button className="rail-icon" aria-label="Team"><UsersRound size={19} /></button></nav><div className="rail-bottom"><div className="mini-avatar">MC</div></div></aside>
    <section className="workspace">
      <header className="topbar"><div className="crumb"><span>GROUP PROJECT</span><ArrowRight size={14} /><strong>{groupLevels[level].title}</strong>{level === 1 && <em className={`practice-mode-badge ${practiceMode}`}>{practiceMode === 'quick' ? 'Quick practice · 6–8 min' : 'Full simulation · 15–20 min'}</em>}</div><div className="top-actions"><button className="replay-now" type="button" disabled={phase === 'brief' || isThinking} onClick={openReplay} title={phase === 'brief' ? 'Start the meeting before opening a Replay.' : 'End this practice and view your current Replay.'} aria-label="End this practice and view your current Replay"><BarChart3 size={16} /> Exit to current Replay</button><button className="sound"><Volume2 size={16} /> Text mode</button><button className="exit" onClick={onExit}><X size={17} /> Exit</button></div></header>
      <div className="mission-strip"><div className="mission-intro"><div className="mission-mark"><Flag size={17} /></div><div><div className="micro-label">TODAY’S MISSION</div><strong>{scenario.contract.objective}</strong></div></div><div className="mission-progress"><span>{progress}%</span><div><i style={{ width: `${progress}%` }} /></div></div></div>
      {level === 1 && <nav className="meeting-flow" aria-label="Meeting progress">{(scenario.contract.nodes || []).map((node, index) => <div key={node.id} className={index < currentNodeIndex ? 'complete' : index === currentNodeIndex ? 'current' : ''}><i>{index < currentNodeIndex ? <Check size={11} /> : index + 1}</i><span>{node.taskLabel || levelOneStepLabels[index]}</span></div>)}</nav>}
      <div className="content-grid">
        <section className="conversation-panel">
          <div className="scene-header"><div><div className="eyebrow"><Sparkles size={13} /> LIVE SIMULATION</div><h1>{domainInfo.project}</h1><p>{profile.major || domainInfo.label} · 4-person group</p></div><div className="profile-context"><GraduationCap size={15} /> Personalised scenario</div></div>
          <div className="team-row">{teamMembers.map((member, index) => <div className="person-card" key={member.id}><div className={`avatar ${['blue', 'lavender', 'orange'][index]}`}>{member.id.slice(0, 1)}<i /></div><div><strong>{member.id}</strong><span>{latestMessage?.speaker === member.id ? 'speaking now' : teamStates[member.id]?.participation === 'holding-back' ? 'quietly listening' : 'ready'}</span></div></div>)}<div className="you-card"><div className="avatar pink">Y</div><span>{latestMessage?.speaker === 'You' ? 'You · speaking' : 'You'}</span></div></div>
          <section className={`meeting-stage ${isThinking ? 'team-thinking' : ''}`} aria-label="Group project meeting room">
            <div className="stage-dialogue-rail" aria-live="polite">{stageBubbleMessages.map((message) => <article className={`scene-bubble bubble-${message.speaker === 'You' ? 'you' : visualSlotBySpeaker[message.speaker] || 'alex'} ${latestMessage?.id === message.id ? 'active' : ''}`} key={`stage-${message.id}`}><strong>{message.speaker}</strong><p>{message.text}</p></article>)}</div>
            <div className="stage-image">
              <img src={stageImageSrc} alt="Four students holding a group project meeting around a table" />
              <div className="stage-vignette" />
              {meetingStageCharacters.map((character) => <div className={`stage-highlight highlight-${character.slot} ${latestMessage?.speaker === character.speaker ? 'active' : ''}`} key={`highlight-${character.speaker}`} aria-hidden="true"><img src={stageImageSrc} alt="" /></div>)}
              {meetingStageCharacters.map((character) => <div className={`stage-person ${character.position} ${latestMessage?.speaker === character.speaker ? 'speaking' : latestMessage ? 'listening' : ''}`} key={character.speaker} aria-hidden="true"><span className="stage-person-name">{character.label}</span><span className="stage-motion" /></div>)}
              <div className="stage-status" aria-hidden="true"><i />{isThinking ? 'The team is thinking…' : latestMessage ? `${latestMessage.speaker} is speaking` : 'The meeting is about to begin'}</div>
            </div>
          </section>
          {phase === 'meet' && showRoomCue && <aside className="room-cue" aria-live="polite"><div className="room-cue-figure"><Bot size={16} /></div><div><div className="micro-label">MEETING CUE</div><p>{currentCue}</p></div><button type="button" onClick={() => currentNode && setDismissedCueIds((all) => [...all, currentNode.id])} aria-label="Dismiss meeting cue"><X size={13} /></button></aside>}
          {phase === 'meet' && currentSignal && showFullSignal && !signalCollapsed && <section className="team-signal" aria-live="polite"><div className="team-signal-top"><span className="signal-bolt"><Sparkles size={15} /></span><div className="micro-label">TEAM SIGNAL · HELP MODE</div></div><h2>{currentSignal.title}</h2><div className="signal-details"><p><strong>What’s happening</strong>{currentSignal.whatIsHappening}</p><p><strong>Why it matters</strong>{currentSignal.whyItMatters}</p><p><strong>Your objective</strong>{currentSignal.learnerObjective}</p></div>{requiredCard && <div className="signal-direct-help"><strong>A possible move: {requiredCard.label}</strong><span>{patternsForSkill(requiredCard, scenario.language.speakingBand)[0]}</span><button type="button" onClick={() => setPreviewCard(requiredCard)}>Open this skill guide</button></div>}<div className="signal-actions"><button type="button" className="signal-dismiss" onClick={() => setSignalCollapsed(true)}>Return to the meeting</button></div></section>}
          {phase === 'meet' && currentSignal && showFullSignal && signalCollapsed && <button type="button" className="signal-peek" onClick={() => setSignalCollapsed(false)}><Sparkles size={14} /><span>Help is available for this moment</span><b>Open</b></button>}
          {phase === 'observe' && <section className="observation-card meeting-warmup"><div><div className="eyebrow"><Sparkles size={13} /> MEETING WARM-UP</div><h2>Meet the team, then join the discussion.</h2><p>The group is exchanging first impressions of the project. Listen until everyone has had a chance to speak, then enter when you are ready.</p></div><button disabled={visibleOpeningCount < openingMessages.length} onClick={joinMeeting}>{visibleOpeningCount < openingMessages.length ? `Listening… ${visibleOpeningCount}/${openingMessages.length}` : <>Join the discussion <ArrowRight size={16} /></>}</button></section>}
          {phase === 'meet' && <section className={`input-area support-${scenario.contract.systemSupport}`}>
            <div className="live-pill"><i /> MEETING IN PROGRESS <span>{isThinking ? 'TEAM IS RESPONDING…' : 'YOUR TURN'}</span></div>
            <div className="skill-pouch"><div className="skill-pouch-head"><div><div className="micro-label">SKILL PACK · {usedCardIds.length}/{scenario.contract.cards.length}</div><strong>{equippedCard ? `Equipped: ${equippedCard.label}` : 'Choose a card, then say it your way.'}</strong></div><span>{equippedCard ? 'Sentence patterns are ready below.' : 'No card is the prescribed answer.'}</span></div><div className="skill-belt">{visibleCards.map((card) => { const used = usedCardIds.includes(card.id); const armed = equippedCard?.id === card.id; const chineseLabel = skillChineseLabels[card.id] || '沟通技能'; return <button type="button" className={`skill-orb ${used ? 'used' : ''} ${armed ? 'armed' : ''}`} key={card.id} disabled={isThinking} onClick={() => setPreviewCard(card)} title={used ? `Review ${card.label}` : `Open ${card.label}`} aria-label={`${used ? 'Review' : 'Open'} ${card.label} · ${chineseLabel}`}><span>{used ? <Check size={13} /> : <Sparkles size={13} />}</span><b>{card.label}<small>{used ? `${chineseLabel} · 已使用，可复习` : chineseLabel}</small></b></button> })}</div></div>
            {systemError && <div className="system-status" role="status"><span>Connection note</span>{systemError}</div>}
            <div className="say-box"><button className="hand" title="Raise hand"><Hand size={18} /></button><input ref={inputRef} value={input} disabled={isThinking} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') makeMove() }} placeholder={equippedCard ? `Use ${equippedCard.label} in your own words…` : 'Say it your way…'} /><button className="mic" title="Voice input will be added after text testing"><Mic size={18} /></button><button className="send" onClick={makeMove} disabled={isThinking || !input.trim()}><Send size={17} /></button></div><div className="input-note"><Headphones size={13} /> Skill cards provide guidance only. Your own wording is what the team hears. <button type="button" onClick={openHelp}>Need help?</button></div>
          </section>}
        </section>
        <aside className="right-panel">{taskBoardUnlocked ? <><section className="meeting-task-board"><div className="board-title"><div><div className="micro-label">{practiceMode === 'quick' ? 'QUICK PRACTICE' : 'TODAY’S MEETING'}</div><h2>Meeting route</h2></div><span className="deadline"><Clock3 size={14} /> {scenario.deadlineLabel}</span></div><p className="board-brief">{practiceMode === 'quick' ? 'Three decisive project decisions. The full simulation practises the other Level 1 anchors.' : 'Follow the discussion, then keep a short record of what the team has actually agreed.'}</p><div className="meeting-task-list">{(scenario.contract.nodes || []).map((node, index) => { const isDone = completedNodeIds.includes(node.id); const isCurrent = node.id === currentNode?.id; return <article className={`${isDone ? 'done' : ''} ${isCurrent ? 'current' : ''}`} key={node.id}><span>{isDone ? <Check size={13} /> : index + 1}</span><div><strong>{node.taskLabel || `Meeting task ${index +1}`}</strong>{isCurrent && <><p>Now: {node.taskMoment?.decision || `make ${node.missingFact?.toLowerCase() || 'the next decision'} clear.`}</p>{node.taskMoment?.settledWhen?.[0] && <small className="task-settle">Settled when: {node.taskMoment.settledWhen[0]}</small>}</>}{isDone && <small><b>{node.recordLabel || 'Confirmed'}:</b> {nodeConclusions[node.id] || 'Confirmed by the team.'}</small>}</div></article> })}</div></section><section className="board"><div className="board-title"><div><div className="micro-label">SHARED PROJECT BOARD</div><h2>{domainInfo.project}</h2></div></div><p className="board-brief">{domainInfo.brief}</p><div className="board-items">{board.map((item) => <div className={`board-item ${item.status}`} key={item.id}><div className="task-symbol">{item.status === 'claimed' || item.status === 'done' ? <Check size={14} /> : item.status === 'blocked' ? <X size={13} /> : <span />}</div><div><strong>{item.label}</strong><p>{item.owner} · {item.due}</p>{item.dependency && <small>{item.dependency}</small>}</div>{item.owner === 'You' && <em>Yours</em>}</div>)}</div></section></> : <section className="board board-locked"><div className="micro-label">{practiceMode === 'quick' ? 'QUICK PRACTICE' : 'TODAY’S MEETING'}</div><h2>Your meeting route will appear when the briefing begins.</h2><p className="board-brief">{practiceMode === 'quick' ? 'It records three core decisions: direction, one workable task, and commitments.' : 'It records the six small decisions the group needs to make together.'}</p><div className="board-unlock-step"><Target size={16} /><span>Unlocks when you enter the mission</span></div></section>}
          <section className="skill-panel"><div className="micro-label">YOUR ACTIVE SKILLS</div>{skills.length === 0 ? <p className="empty-skills">Use a skill card to make an intentional intervention.</p> : skills.map((skill) => <div className="skill-chip" key={skill}><Sparkles size={13} /> {skill}</div>)}{phase === 'meet' && <button className="finish-button" disabled={!missionDone} onClick={finish}>{missionDone ? 'Open meeting replay' : level === 1 ? practiceMode === 'quick' ? 'Settle the three key decisions' : 'Keep the meeting moving' : level === 2 ? 'Resolve the dependency and update the plan' : 'Repair fairly and confirm prevention'} <ArrowRight size={15} /></button>}</section>
        </aside>
      </div>
    </section>
    {previewCard && <section className="role-modal skill-modal" role="dialog" aria-modal="true" aria-label={`${previewCard.label} skill guide`}><div className="role-window skill-window"><button className="skill-close" onClick={() => setPreviewCard(null)} aria-label="Close skill guide"><X size={18} /></button><div className="skill-modal-mark"><Sparkles size={19} /></div><div className="micro-label">SKILL GUIDE · LEVEL {level}</div><h2>{previewCard.label}</h2><p>{previewCard.purpose || previewCard.description}</p>{previewCard.thoughtPrompt && <section className="thought-prompt"><span>THOUGHT PROMPT</span><strong>{previewCard.thoughtPrompt}</strong></section>}<section className="pattern-library"><div><div className="micro-label">SENTENCE PATTERNS</div><strong>Use one as a starting point. Change it to fit what you mean.</strong></div><div className="pattern-list">{patternsForSkill(previewCard, scenario.language.speakingBand).map((pattern) => <code key={pattern}>{pattern}</code>)}</div></section><div className="skill-modal-footer"><div><strong>{usedCardIds.includes(previewCard.id) ? 'This skill is recorded for this run.' : 'This card will not send a message.'}</strong><span>{usedCardIds.includes(previewCard.id) ? 'You can still review these patterns at any time.' : 'Equip it, then write or say the next turn in your own words.'}</span></div><button className="primary" disabled={usedCardIds.includes(previewCard.id)} onClick={() => equipSkill(previewCard)}>{usedCardIds.includes(previewCard.id) ? 'Skill already used' : <>Equip this skill <ArrowRight size={16} /></>}</button></div></div></section>}
    {phase === 'meet' && taskMomentOpen && currentNode?.taskMoment && <section className="role-modal task-moment-modal" role="dialog" aria-modal="true" aria-label={`Current task: ${currentNode.taskLabel || currentNode.objective}`}><div className="role-window task-moment-window"><div className="task-moment-top"><span><Target size={16} /> CURRENT DECISION</span><b>STEP {currentNodeIndex + 1} / {(scenario.contract.nodes || []).length}</b></div><h2>{currentNode.taskLabel || currentNode.objective}</h2><p>{currentNode.taskMoment.situation}</p><section className="task-decision"><span>THE TEAM NEEDS TO DECIDE</span><strong>{currentNode.taskMoment.decision}</strong></section><section className="task-settle-list"><div className="micro-label">YOU’LL KNOW IT IS SETTLED WHEN</div>{currentNode.taskMoment.settledWhen.map((item) => <div key={item}><CheckCircle2 size={15} /> {item}</div>)}</section><div className="task-moment-footer"><span>This names the meeting task, not the answer or the skill to use.</span><button className="primary" onClick={enterTaskMoment}>Enter the moment <ArrowRight size={16} /></button></div></div></section>}
    {phase === 'meet' && sceneCueOpen && !taskMomentOpen && currentNode?.sceneCue && <section className="role-modal scene-cue-modal" role="dialog" aria-modal="true" aria-label="当前剧情提示"><div className="role-window scene-cue-window"><div className="scene-cue-top"><span><Bot size={17} /> 剧情提示</span><b>当前节点 · {currentNodeIndex + 1}</b></div><h2>你刚刚看到了什么？</h2><p>{currentNode.sceneCue.summaryZh}</p><section className="scene-cue-conflict"><span>当前需要处理的矛盾</span><strong>{currentNode.sceneCue.conflictZh}</strong></section><section className="scene-cue-goal"><span>现在轮到你</span><p>{currentNode.sceneCue.userGoalZh}</p></section><div className="scene-cue-footer"><small>这不是标准答案，也不会指定你该使用哪张技能卡。</small><button className="primary" onClick={() => setSceneCueOpen(false)}>我来处理这个问题 <ArrowRight size={16} /></button></div></div></section>}
    {phase === 'brief' && <section className="role-modal board-modal"><div className="role-window mission-board-modal"><div className="modal-board-top"><div><div className="micro-label">MISSION BRIEF · {practiceMode === 'quick' ? 'QUICK PRACTICE' : groupLevels[level].shortTitle.toUpperCase()}</div><h2>{domainInfo.project}</h2></div><span><Clock3 size={14} /> {scenario.deadlineLabel}</span></div>{practiceMode === 'quick' && <div className="quick-brief-note"><Clock3 size={14} /><div><strong>6–8 minute focused route</strong><span>Practise direction, one workable task, and clear commitments. The other Level 1 anchors remain available in Full simulation.</span></div></div>}<p className="mission-narrative">{scenario.taskNarrative}</p><div className="modal-objectives"><strong>By the end of today’s meeting:</strong>{scenario.objectives.map((objective, index) => <div key={objective}>{['①', '②', '③'][index]} {objective}</div>)}</div><div className="modal-meta"><span><UsersRound size={15} /> {scenario.memberCount} members</span><span><Target size={15} /> {scenario.currentProgress}</span><span><GraduationCap size={15} /> {profile.major || domainInfo.label}</span></div>{openingError && <p className="api-error" role="alert">{openingError}</p>}<button className="primary modal-confirm" disabled={isThinking} onClick={startObservation}>{isThinking ? 'Creating your team…' : openingError ? 'Try AI again' : <>I understand the mission <ArrowRight size={16} /></>}</button></div></section>}
  </main>
}

function ReplayScreen({ scenario, practiceMode, entries, messages, completedNodeIds, nodeConclusions, helpedNodeIds, ineffectiveAttempts, turnCount, durationSeconds, onExit, onReplay }: {
  scenario: ReturnType<typeof createScenarioForProfile>
  practiceMode: PracticeMode
  entries: ReplayEntry[]
  messages: Message[]
  completedNodeIds: string[]
  nodeConclusions: Record<string, string>
  helpedNodeIds: string[]
  ineffectiveAttempts: Record<string, number>
  turnCount: number
  durationSeconds: number
  onExit: () => void
  onReplay: () => void
}) {
  const nodes = scenario.contract.nodes || []
  const completedCount = nodes.filter((node) => completedNodeIds.includes(node.id)).length
  const durationLabel = durationSeconds ? `${Math.floor(durationSeconds / 60)}m ${String(durationSeconds % 60).padStart(2, '0')}s` : 'Recorded this session'
  const teamTurnCount = messages.filter((message) => (scenario.contract.roles || []).some((role) => role.id === message.speaker)).length
  const explorationCount = Object.values(ineffectiveAttempts).reduce((total, attempts) => total + attempts, 0)
  const settledRecords = nodes.filter((node) => completedNodeIds.includes(node.id)).map((node) => ({ node, conclusion: nodeConclusions[node.id] || entries.find((entry) => entry.nodeId === node.id)?.conclusion || 'Confirmed by the team.' }))
  const nextPractice = nodes.filter((node) => !completedNodeIds.includes(node.id)).slice(0, 2)
  const outcomeLabels: Record<string, string> = { clarify_direction: 'Shared direction', state_preference: 'Your contribution entered', clarify_scope: 'One workable task', invite_evidence: 'Useful evidence invited', integrate_views: 'Views aligned', confirm_commitments: 'Next steps captured' }
  const outcomes = nodes.map((node) => ({ label: outcomeLabels[node.id] || node.taskLabel || 'Project decision', done: completedNodeIds.includes(node.id) }))
  const unpractisedNodes = scenario.unpractisedNodes || []
  return <main className="replay-page">
    <header className="replay-page-nav"><Brand onClick={onExit} /><div><span>GROUP PROJECT · LEVEL {scenario.level}{practiceMode === 'quick' ? ' · QUICK PRACTICE' : ''}</span><button onClick={onExit}>Back to pathway</button></div></header>
    <section className="replay-hero"><div><div className="studio-eyebrow">{practiceMode === 'quick' ? 'QUICK PRACTICE REPLAY' : 'MISSION REPLAY'}</div><h1>Your meeting, made visible.</h1><p>{practiceMode === 'quick' ? 'Review the three decisions you practised today, then use Full simulation for the remaining Level 1 anchors.' : 'Review the moments where your own words changed what the group could do next.'}</p></div><div className="replay-hero-result"><CheckCircle2 size={22} /><div><strong>{completedCount}/{nodes.length} communication anchors completed</strong><span>{scenario.project}</span></div></div></section>
    <section className="replay-summary-grid">
      <article className="replay-outcome-card"><div className="micro-label">MEETING OUTCOME</div><h2>{completedCount === nodes.length ? practiceMode === 'quick' ? 'You completed the focused route.' : 'The group left with a workable start.' : 'Your meeting has a clear next practice point.'}</h2><p>{completedCount === nodes.length ? scenario.contract.successCriteria.join(' · ') : 'This Replay separates moves you made from project decisions the group still needs to settle.'}</p><div className="outcome-checks">{outcomes.map((outcome) => <span className={outcome.done ? 'met' : ''} key={outcome.label}>{outcome.done ? <Check size={13} /> : <span className="empty-dot" />}{outcome.label}</span>)}</div></article>
      <article className="replay-session-card"><div className="micro-label">SESSION RECORD</div><div><strong>{turnCount}</strong><span>Your turns</span></div><div><strong>{teamTurnCount}</strong><span>Team responses</span></div><div><strong>{durationLabel}</strong><span>Meeting time</span></div><div><strong>{scenario.contract.microFrictionPlan?.length || 0}</strong><span>Visible meeting frictions</span></div><div><strong>{explorationCount}</strong><span>Extra attempts before a move landed</span></div><p>Your original transcript remains private to you. Help use and retries are shown here only to support your reflection.</p></article>
    </section>
    <section className="replay-section"><div className="replay-section-heading"><div><div className="micro-label">MEETING TIMELINE</div><h2>How the conversation moved</h2></div><p>This shows the meeting structure, not a prescribed script.</p></div><div className="replay-timeline">{nodes.map((node, index) => { const entry = entries.find((item) => item.nodeId === node.id); const isComplete = completedNodeIds.includes(node.id); const conclusion = nodeConclusions[node.id] || entry?.conclusion; return <article className={isComplete ? 'complete' : ''} key={node.id}><span className="timeline-dot">{isComplete ? <Check size={12} /> : index + 1}</span><div><strong>{node.taskLabel || levelOneStepLabels[index] || `Meeting step ${index + 1}`}</strong><p>{isComplete ? conclusion || 'The team confirmed this project decision.' : entry?.replay.strategy || 'This step did not yet produce a settled project decision.'}</p></div>{entry && <q>{entry.quote}</q>}</article> })}</div></section>
    <section className="replay-section confirmed-record"><div className="replay-section-heading"><div><div className="micro-label">CONFIRMED PROJECT RECORD</div><h2>What the team actually agreed</h2></div><p>These are the facts carried forward by the director—not inferred personality scores.</p></div>{settledRecords.length ? <div className="confirmed-record-list">{settledRecords.map(({ node, conclusion }) => <article key={node.id}><strong>{node.recordLabel || node.taskLabel}</strong><p>{conclusion}</p></article>)}</div> : <p className="replay-empty">No project decision was fully settled yet. Your next Replay will record conclusions only after teammates confirm them aloud.</p>}</section>
    <section className="replay-section key-moments"><div className="replay-section-heading"><div><div className="micro-label">KEY MOMENTS</div><h2>What your actions changed</h2></div><p>Evidence is drawn from what you actually said—not from whether you copied a pattern.</p></div>{entries.length ? <div className="moment-grid">{entries.map((entry) => <article key={entry.nodeId}><span>{entry.skill}</span><q>{entry.quote}</q><p><strong>Team effect</strong>{entry.teamEffect || 'Your move gave the group a clearer way to continue.'}</p><p><strong>{entry.taskSettled ? 'Project result' : 'Why it worked'}</strong>{entry.taskSettled ? entry.conclusion || 'The team confirmed the project decision.' : entry.replay.strategy || 'You made the needed collaboration action visible in your own words.'}</p></article>)}</div> : <p className="replay-empty">No communication action was recognised in this run yet. Try making one concrete move that changes what the group can decide or do.</p>}</section>
    <section className="replay-section next-practice"><div className="replay-section-heading"><div><div className="micro-label">NEXT PRACTICE</div><h2>{practiceMode === 'quick' && !nextPractice.length ? 'Continue in Full simulation' : 'Where to enter next time'}</h2></div><p>These are unfinished project tasks, not personality labels.</p></div>{nextPractice.length ? <div className="next-practice-list">{nextPractice.map((node) => <article key={node.id}><span><Target size={15} /></span><div><strong>{node.taskLabel}</strong><p>{node.taskMoment?.decision || node.objective}</p></div></article>)}</div> : practiceMode === 'quick' && unpractisedNodes.length ? <div className="next-practice-list">{unpractisedNodes.map((node) => <article key={node.id}><span><Target size={15} /></span><div><strong>{node.taskLabel}</strong><p>Available in Full simulation; it was not scored in this focused route.</p></div></article>)}</div> : <p className="replay-empty">You settled every Level 1 project task in this run. Replay the scenario with different wording to strengthen the same moves.</p>}</section>
    <section className="replay-section replay-growth"><div className="replay-section-heading"><div><div className="micro-label">YOUR COLLABORATION SIGNALS</div><h2>Evidence captured this time</h2></div><p>{helpedNodeIds.length ? `You chose support in ${helpedNodeIds.length} moment${helpedNodeIds.length === 1 ? '' : 's'}.` : 'You worked through the meeting without opening help mode.'}</p></div><div className="growth-grid">{scenario.contract.cards.map((card) => { const done = entries.some((entry) => entry.skill === card.label); return <article className={done ? 'met' : ''} key={card.id}><span>{done ? <Check size={15} /> : <Sparkles size={15} />}</span><div><strong>{card.label}</strong><p>{done ? 'Evidence captured in this meeting.' : 'A useful focus for your next replay.'}</p></div></article> })}</div></section>
    <section className="replay-section language-replay"><div className="replay-section-heading"><div><div className="micro-label">LANGUAGE & EXPRESSION</div><h2>Make the same move with more range</h2></div><p>These are upgrades, not pass-or-fail corrections.</p></div><div className="language-replay-list">{entries.map((entry) => <article key={entry.nodeId}><div><span>YOUR WORDS</span><q>{entry.quote}</q></div><div><span>TRY NEXT TIME</span><strong>{entry.replay.polishedVersion || entry.quote}</strong></div><p><b>Language</b>{entry.replay.languageNote || 'Keep the action specific and let the group hear what you need.'}</p><p><b>Collaboration</b>{entry.replay.pragmaticsNote || entry.replay.nextMove || 'Use the same move before the uncertainty grows.'}</p></article>)}</div></section>
    <footer className="replay-footer"><button className="outline-cta" onClick={onReplay}>Replay this mission</button><button className="primary" onClick={onExit}>Continue on your path <ArrowRight size={16} /></button></footer>
  </main>
}

type Screen = 'landing' | 'signup' | 'profile' | 'login' | 'home' | 'groupPath' | 'group'
type StudentProfile = { name: string; email: string; school: string; year: string; major: string; majorConfirmed: boolean; exam: string; overall: string; listening: string; speaking: string }

const blankProfile: StudentProfile = { name: '', email: '', school: '', year: '', major: '', majorConfirmed: false, exam: 'IELTS', overall: '', listening: '', speaking: '' }

function Brand({ onClick }: { onClick: () => void }) {
  return <button className="brand-wordmark" onClick={onClick} aria-label="PerspeakAI home">Perspeak<span>AI</span></button>
}

function Landing({ go }: { go: (screen: Screen) => void }) {
  return <main className="marketing-shell">
    <nav className="marketing-nav"><Brand onClick={() => go('landing')} /><div className="marketing-links"><a href="#how">How it works</a><a href="#universities">For universities</a><a href="#trust">Resources</a></div><div className="marketing-actions"><button className="login-link" onClick={() => go('login')}>Log in</button><button className="nav-cta" onClick={() => go('signup')}>Create account</button></div></nav>
    <section className="studio-hero"><div className="hero-copy"><div className="studio-eyebrow">PRACTICE FOR THE MOMENT THAT MATTERS</div><h1>Your ideas<br />deserve <em>the floor.</em></h1><p>Rehearse academic conversations. Participate with clarity when it counts.</p><button className="hero-button" onClick={() => go('signup')}>Practice a real scenario <ArrowRight size={20} /></button><span>Designed with student success and international education teams</span></div><div className="hero-scene" aria-label="Group project scenario preview"><div className="orbit-copy">+ Social awareness</div><div className="scene-wash" /><div className="scene-avatar avatar-a">A</div><div className="scene-avatar avatar-s">S</div><div className="scene-avatar avatar-r">R</div><div className="scene-speech"><small>Alex · Marketing</small>“Should we decide the direction first?”</div><div className="landing-board"><div className="landing-board-head"><strong>Climate campaign pitch</strong><span>Live board</span></div>{['Research', 'Data analysis', 'Slide story', 'Final pitch'].map((task) => <div className="landing-task" key={task}><i />{task}</div>)}<div className="landing-tags"><b>Friday · 5pm</b><b>4 members</b></div></div></div></section>
    <section className="launch-section" id="how"><div><div className="studio-eyebrow">BUILT FOR REAL CAMPUS MOMENTS</div><h2>Practice the conversations that shape university life.</h2></div><div className="launch-cards"><article><div className="scenario-icon"><UsersRound size={21} /></div><h3>Group Project</h3><p>Clarify, negotiate, share the floor and move a team forward.</p><button onClick={() => go('signup')}>Explore scenario <ArrowUpRight size={15} /></button></article><article><div className="scenario-icon mint-icon"><BookOpen size={21} /></div><h3>Class Discussion</h3><p>Build on ideas, challenge with care and contribute with confidence.</p><button onClick={() => go('signup')}>Explore scenario <ArrowUpRight size={15} /></button></article></div></section>
    <section className="university-section" id="universities"><div className="university-copy"><div className="studio-eyebrow">FOR UNIVERSITIES</div><h2>Support participation—without turning students into a dataset.</h2><p>Give international students a private rehearsal space for the moments that matter in class, group work and campus life.</p><button className="outline-cta">Request a demo <ArrowRight size={17} /></button></div><div className="insight-card"><div className="insight-card-head"><div><span>ANONYMISED INSTITUTION INSIGHTS</span><h3>Where students get stuck</h3></div><BarChart3 size={21} /></div><div className="insight-row"><span>Entering a discussion</span><i style={{ width: '70%' }} /><b>High</b></div><div className="insight-row"><span>Clarifying deadlines</span><i style={{ width: '51%' }} /><b>Medium</b></div><div className="insight-row"><span>Building on ideas</span><i style={{ width: '32%' }} /><b>Growing</b></div><p>Aggregate trends only. Individual recordings and conversations remain private.</p></div></section>
    <section className="trust-strip" id="trust"><div><ShieldCheck size={19} /><strong>Student-first privacy</strong><span>Clear recording controls and deletion.</span></div><div><Accessibility size={19} /><strong>Accessible by design</strong><span>Captions, text alternatives and low-pressure entry points.</span></div><div><Building2 size={19} /><strong>Institution ready</strong><span>Partner onboarding and aggregated reporting.</span></div></section>
    <footer className="marketing-footer"><Brand onClick={() => go('landing')} /><span>PerspeakAI · Academic communication rehearsal</span><button onClick={() => go('signup')}>Get started <ArrowRight size={15} /></button></footer>
  </main>
}

function AccountForm({ profile, update, next, backToLanding }: { profile: StudentProfile; update: (patch: Partial<StudentProfile>) => void; next: () => void; backToLanding: () => void }) {
  return <main className="auth-shell"><header><Brand onClick={backToLanding} /><button onClick={backToLanding}>Back to home</button></header><section className="auth-card"><div className="auth-progress"><i className="active" /><i /><span>Step 1 of 2</span></div><div className="auth-icon"><Mail size={19} /></div><div className="studio-eyebrow">CREATE YOUR ACCOUNT</div><h1>Start your practice space.</h1><p>Create your account first. Your academic profile comes next.</p><form onSubmit={(event) => { event.preventDefault(); next() }}><label>Full name<input required value={profile.name} onChange={(event) => update({ name: event.target.value })} placeholder="Your name" /></label><label>Email address<input required type="email" value={profile.email} onChange={(event) => update({ email: event.target.value })} placeholder="you@university.edu" /></label><label>Password<input required minLength={8} type="password" placeholder="At least 8 characters" /></label><button className="form-cta" type="submit">Continue <ArrowRight size={17} /></button></form><p className="auth-switch">Already have an account? <button type="button">Log in</button></p></section></main>
}

function ProfileForm({ profile, update, finish, back }: { profile: StudentProfile; update: (patch: Partial<StudentProfile>) => void; finish: () => void; back: () => void }) {
  const [majorError, setMajorError] = useState('')
  const isToefl = profile.exam.startsWith('TOEFL')
  const scorePlaceholder = profile.exam === 'TOEFL iBT (1–6)' ? '1–6' : profile.exam === 'TOEFL iBT (0–30 legacy)' ? '0–30' : profile.exam === 'Not available' ? 'Optional' : '0–9'
  const majorPreview = profile.major.trim() ? majorMappingPreview(profile.major) : null
  return <main className="auth-shell"><header><Brand onClick={() => undefined} /><button onClick={back}>Back</button></header><section className="auth-card profile-card"><div className="auth-progress"><i className="active" /><i className="active" /><span>Step 2 of 2</span></div><div className="auth-icon"><GraduationCap size={19} /></div><div className="studio-eyebrow">YOUR ACADEMIC CONTEXT</div><h1>Make every scenario relevant.</h1><p>Your major shapes the project context. Year is collected for your profile only.</p><form onSubmit={(event) => { event.preventDefault(); if (!profile.majorConfirmed) { setMajorError('Choose the closest recognised major before continuing.'); return }; finish() }}><div className="field-grid"><label>School<input required value={profile.school} onChange={(event) => update({ school: event.target.value })} placeholder="e.g. University of Toronto" /></label><label>Year<select required value={profile.year} onChange={(event) => update({ year: event.target.value })}><option value="">Select year</option><option>Foundation / Prep</option><option>Year 1</option><option>Year 2</option><option>Year 3</option><option>Year 4+</option><option>Postgraduate</option></select></label></div><label>Major keywords<input required value={profile.major} onChange={(event) => { update({ major: event.target.value, majorConfirmed: false }); setMajorError('') }} placeholder="e.g. English, Applied Linguistics, Business Analytics" /></label>{majorPreview ? <aside className="major-preview"><div className="micro-label">CLOSEST RECOGNISED MAJOR</div><button type="button" className={profile.majorConfirmed ? 'confirmed' : ''} onClick={() => { update({ major: majorPreview.closestExample, majorConfirmed: true }); setMajorError('') }}>{majorPreview.closestExample}<Check size={14} /></button></aside> : profile.major.trim() && <p className="major-error">Try a more specific subject keyword so we can match it to a relevant project.</p>}{majorError && <p className="major-error">{majorError}</p>}<div className="score-heading"><strong>English score</strong><span>Only adjusts the language surface of AI speech and coaching.</span></div><div className="field-grid score-grid"><label>Test<select value={profile.exam} onChange={(event) => update({ exam: event.target.value, overall: '', listening: '', speaking: '' })}><option>IELTS</option><option>TOEFL iBT (1–6)</option><option>TOEFL iBT (0–30 legacy)</option><option>Not available</option></select></label><label>Overall<input inputMode="decimal" value={profile.overall} onChange={(event) => update({ overall: event.target.value })} placeholder={isToefl && profile.exam === 'TOEFL iBT (0–30 legacy)' ? '0–120' : scorePlaceholder} /></label><label>Listening<input inputMode="decimal" value={profile.listening} onChange={(event) => update({ listening: event.target.value })} placeholder={scorePlaceholder} /></label><label>Speaking<input inputMode="decimal" value={profile.speaking} onChange={(event) => update({ speaking: event.target.value })} placeholder={scorePlaceholder} /></label></div><button className="form-cta" type="submit">Enter PerspeakAI <ArrowRight size={17} /></button></form><div className="profile-privacy"><LockKeyhole size={14} /> Scores shape AI language support, never scenario difficulty or evaluation standards.</div></section></main>
}

function LoginForm({ enter, backToLanding }: { enter: () => void; backToLanding: () => void }) {
  return <main className="auth-shell"><header><Brand onClick={backToLanding} /><button onClick={backToLanding}>Back to home</button></header><section className="auth-card login-card"><div className="auth-icon"><UserRound size={19} /></div><div className="studio-eyebrow">WELCOME BACK</div><h1>Pick up where you left off.</h1><p>Your practice history and personal learning path are ready.</p><form onSubmit={(event) => { event.preventDefault(); enter() }}><label>Email address<input required type="email" placeholder="you@university.edu" /></label><label>Password<input required type="password" placeholder="Your password" /></label><button className="form-cta" type="submit">Log in <ArrowRight size={17} /></button></form></section></main>
}

function StudentHome({ profile, startGroup, logout }: { profile: StudentProfile; startGroup: () => void; logout: () => void }) {
  const firstName = profile.name.trim().split(' ')[0] || 'there'
  return <main className="student-home"><header className="student-nav"><Brand onClick={() => undefined} /><div><span className="home-school">{profile.school || 'Your university'}</span><button onClick={logout}>Log out</button><div className="student-avatar">{firstName.slice(0, 1).toUpperCase()}</div></div></header><section className="student-hero"><div><div className="studio-eyebrow">YOUR NEXT CAMPUS MOMENT</div><h1>Hi, {firstName}.<br />Ready to take the floor?</h1><p>{profile.major ? `${profile.major} scenarios are ready for you.` : 'Your next real communication scenario is ready.'}</p></div><div className="growth-marker"><span>01</span><div><strong>Campus communication path</strong><p>Build confidence one real moment at a time.</p></div></div></section><section className="student-missions"><div className="section-heading"><div><div className="studio-eyebrow">PRACTICE MISSIONS</div><h2>Choose your next room.</h2></div><span>2 launch scenarios</span></div><div className="student-card-grid"><article className="student-mission group"><div className="mission-symbol"><UsersRound size={26} /></div><span>LEVEL 1 · 12 MIN</span><h3>Group Project</h3><p>Enter a kickoff meeting, read the team and claim a meaningful contribution.</p><ul><li><CheckCircle2 size={14} /> Social awareness</li><li><CheckCircle2 size={14} /> Task ownership</li><li><CheckCircle2 size={14} /> Clear commitments</li></ul><button onClick={startGroup}>Start mission <ArrowRight size={17} /></button></article><article className="student-mission discussion"><div className="mission-symbol"><BookOpen size={26} /></div><span>LEVEL 1 · NEXT</span><h3>Class Discussion</h3><p>Build on a classmate’s point, challenge with care and make your perspective heard.</p><ul><li><CheckCircle2 size={14} /> Entering a discussion</li><li><CheckCircle2 size={14} /> Building on ideas</li><li><CheckCircle2 size={14} /> Academic confidence</li></ul><button disabled>Coming next</button></article></div></section></main>
}

function GroupPath({ profile, completedLevel, back, startLevel }: { profile: StudentProfile; completedLevel: number; back: () => void; startLevel: (level: GroupLevel, mode: PracticeMode) => void }) {
  return <main className="group-path-page"><header className="student-nav"><Brand onClick={back} /><div><span className="home-school">{profile.major || 'Your personalised pathway'}</span><button onClick={back}>Back to missions</button></div></header><section className="path-hero"><button className="back-link" onClick={back}>← Practice missions</button><div className="studio-eyebrow">GROUP PROJECT · PROGRESSIVE PRACTICE</div><h1>Build your voice<br />one meeting at a time.</h1><p>Each level adds a new layer of group-work pressure. Choose a focused route when time is short, or use the full simulation to practise every anchor.</p></section><section className="level-path">{([1, 2, 3] as GroupLevel[]).map((level) => { const item = groupLevels[level]; const unlocked = level === 1 || completedLevel >= level - 1; const complete = completedLevel >= level; return <article className={`level-card ${unlocked ? 'unlocked' : 'locked'} ${complete ? 'complete' : ''}`} key={level}><div className="level-index">0{level}</div><div className="level-main"><div className="level-title"><span>{item.title}</span>{complete && <b><CheckCircle2 size={14} /> Complete</b>}</div><h2>{item.scene}</h2><div className="level-skills">{item.skills.map((skill) => <span key={skill}>{skill}</span>)}</div><p><strong>Success:</strong> {item.success}</p></div><div className="level-action">{unlocked ? level === 1 ? <div className="practice-choice"><button className="quick" onClick={() => startLevel(level, 'quick')}><span>Quick practice</span><small>6–8 min · 3 decisions</small><ArrowRight size={15} /></button><button onClick={() => startLevel(level, 'full')}><span>{complete ? 'Replay full simulation' : 'Full simulation'}</span><small>15–20 min · all 6 anchors</small><ArrowRight size={15} /></button></div> : <button onClick={() => startLevel(level, 'full')}>{complete ? 'Replay level' : 'Start level'} <ArrowRight size={16} /></button> : <div><LockKeyhole size={18} /><span>{item.lockedHint}</span></div>}</div></article>})}</section><section className="path-personalisation"><GraduationCap size={20} /><div><strong>{profile.major || 'Your major'} context is active</strong><span>Major shapes task content and task-board structure. English scores only guide the AI’s wording, sentence length and sentence patterns.</span></div></section></main>
}

function App() {
  const [screen, setScreen] = useState<Screen>('landing')
  const [profile, setProfile] = useState<StudentProfile>(blankProfile)
  const [completedGroupLevel, setCompletedGroupLevel] = useState(0)
  const [selectedGroupLevel, setSelectedGroupLevel] = useState<GroupLevel>(1)
  const [selectedPracticeMode, setSelectedPracticeMode] = useState<PracticeMode>('full')
  const updateProfile = (patch: Partial<StudentProfile>) => setProfile((current) => ({ ...current, ...patch }))
  if (screen === 'signup') return <AccountForm profile={profile} update={updateProfile} next={() => setScreen('profile')} backToLanding={() => setScreen('landing')} />
  if (screen === 'profile') return <ProfileForm profile={profile} update={updateProfile} finish={() => setScreen('home')} back={() => setScreen('signup')} />
  if (screen === 'login') return <LoginForm enter={() => setScreen('home')} backToLanding={() => setScreen('landing')} />
  if (screen === 'home') return <StudentHome profile={profile} startGroup={() => setScreen('groupPath')} logout={() => setScreen('landing')} />
  if (screen === 'groupPath') return <GroupPath profile={profile} completedLevel={completedGroupLevel} back={() => setScreen('home')} startLevel={(level, mode) => { setSelectedGroupLevel(level); setSelectedPracticeMode(mode); setScreen('group') }} />
  if (screen === 'group') {
    if (!profile.majorConfirmed) return <ProfileForm profile={profile} update={updateProfile} finish={() => setScreen('home')} back={() => setScreen('home')} />
    return <GroupProjectScene initialDomain={resolveMajorDomain(profile.major)} level={selectedGroupLevel} practiceMode={selectedPracticeMode} profile={profile} onComplete={(level, mode) => { if (mode === 'full') setCompletedGroupLevel((current) => Math.max(current, level)) }} onExit={() => setScreen('groupPath')} />
  }
  return <Landing go={setScreen} />
}

export default App
