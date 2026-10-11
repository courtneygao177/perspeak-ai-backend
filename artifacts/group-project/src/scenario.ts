export type Domain = 'business' | 'law_policy' | 'social_science' | 'education' | 'humanities' | 'creative_media' | 'data_science' | 'natural_science' | 'computing' | 'engineering' | 'health' | 'environment' | 'services'
export type Move =
  | 'read_risk' | 'enter' | 'clarify_scope' | 'low_request' | 'paraphrase' | 'summarize_next'
  | 'bridge_views' | 'probe_commitment' | 'balance_floor' | 'invite_quiet' | 'interrupt_refocus' | 'update_dependencies' | 'negotiate_option'
  | 'advocate_fairness' | 'separate_impact_intent' | 'acknowledge_feeling' | 'third_story' | 'contribution_repair' | 'name_dynamic' | 'repair_commitment'
  | 'custom'

export type BoardStatus = 'open' | 'claimed' | 'blocked' | 'done'
export type BoardItem = { id: string; label: string; owner: string; due: string; status: BoardStatus; dependency?: string }
export type Message = { id: number; speaker: string; text: string; time: string; event?: string }
export type GroupLevel = 1 | 2 | 3
export type PracticeMode = 'quick' | 'full'
export type ScenarioProfile = { major: string; year: string; exam: string; overall: string; listening: string; speaking: string }
export type TeamId = 'A' | 'B' | 'C' | 'D'

export type SkillCard = {
  id: Move
  label: string
  description: string
  events: string[]
  response: string
  purpose?: string
  thoughtPrompt?: string
  patterns?: string[]
  advancedPatterns?: string[]
  signal?: {
    eyebrow: string
    title: string
    whatIsHappening: string
    whyItMatters: string
    learnerObjective: string
  }
}
export type RoleProfile = {
  id: string
  function: string
  initiative: number
  talkativeness: number
  cooperation: number
  challengeLevel: number
  clarity: number
  interruptionTendency: number
  openingRule: string
  strength?: string
  difficulty?: string
  pressureBehavior?: string
}
export type TeamDefinition = { id: TeamId; label: string; members: RoleProfile[] }
export type RoleRuntimeState = { participation: string; taskStance: string; interaction: string; tone: string }
export type NodeDirectorContract = {
  issue: string
  visibleEvidence: string[]
  errorLine?: string
  proofLine?: string
  consequenceLine?: string
  handoffQuestion?: string
  leadRule: string
  supportRule: string
  thirdRoleRule: string
  ignoreEscalation: string
  resolutionEffect: string
  conclusionSchema: string
}
export type NodeResolutionRequirements = {
  facts: string[]
  minTeamConfirmations: number
  requireAllTeammates?: boolean
}
export type NodeSpeakerPlan = {
  // The scripted observation opening: error → consequence → evidence → open question.
  opening: string[]
  // A short, role-specific response when the learner has not yet settled the task.
  unresolved: string[]
  // The exact natural confirmation/transition sequence once the task is settled.
  resolved: string[]
}
// The director decides this before language is generated.  It gives every
// permitted line a conversational reason, rather than treating a speaker plan
// as a bare queue of names.
export type InteractionBeat = {
  speaker: string
  target: 'You' | 'team' | string
  dialogueAct: 'surface_risk' | 'add_evidence' | 'hold_position' | 'confirm' | 'connect_next' | 'ask_open_question' | 'state_boundary' | 'acknowledge'
  refersTo: string
  reasonToSpeak: string
}
export type NodeInteractionPlan = {
  unresolved: InteractionBeat[]
  resolved: InteractionBeat[]
  silenceReason: string
}
export type NodeTaskMoment = {
  situation: string
  decision: string
  settledWhen: string[]
}
export type NodeSceneCue = {
  summaryZh: string
  conflictZh: string
  userGoalZh: string
}
export type NodeEntryLine = {
  speaker: string
  text: string
}
export type SceneNode = {
  id: string
  event: string
  skillId: Move
  objective: string
  completionEvidence: string
  primaryResponder: string
  supportingResponder?: string
  thirdResponder?: string
  entryLine: string
  taskLabel?: string
  missingFact?: string
  recordLabel?: string
  resolutionRequirements?: NodeResolutionRequirements
  speakerPlan?: NodeSpeakerPlan
  interactionPlan?: NodeInteractionPlan
  taskMoment?: NodeTaskMoment
  sceneCue?: NodeSceneCue
  // Quick Practice opens each active decision as a separate short scene.
  // These two lines show the problem and its concrete missing detail before
  // the learner is asked to take the next turn.
  quickEntry?: NodeEntryLine[]
  stateBefore?: Record<string, Partial<RoleRuntimeState>>
  stateAfter?: Record<string, Partial<RoleRuntimeState>>
  director?: NodeDirectorContract
}
export type MicroFriction = {
  id: string
  nodeId: string
  cue: string
  directorRule: string
  entryLine: string
}
export type SignalQuestion = { person: string; title: string; options: string[]; correct: number; evidence: string }
export type LevelContract = {
  objective: string
  projectState: string
  timePressure: string
  relationshipState: string
  interaction: string
  systemSupport: 'guided' | 'selective' | 'replay'
  allowedEvents: string[]
  eventChain: string[]
  skillSequence?: Move[]
  skillTriggers?: Partial<Record<Move, string>>
  openingDirection: string
  successCriteria: string[]
  cards: SkillCard[]
  signals: SignalQuestion[]
  nodes?: SceneNode[]
  roles?: RoleProfile[]
  microFrictionLimit?: { min: number; max: number }
  microFrictionPlan?: MicroFriction[]
  team?: TeamDefinition
  initialTeamState?: Record<string, RoleRuntimeState>
  practiceMode?: PracticeMode
  estimatedMinutes?: string
  unpractisedNodeIds?: string[]
}

const groupProjectRoles: RoleProfile[] = [
  { id: 'Alex', function: 'Creates momentum without being hostile.', initiative: 5, talkativeness: 4, cooperation: 4, challengeLevel: 2, clarity: 4, interruptionTendency: 3, openingRule: 'Speak twice in the opening: propose moving quickly, then suggest a visible next step. Do not decide the group’s work alone.' },
  { id: 'Sophie', function: 'Brings high-value evidence when the group makes room for it.', initiative: 2, talkativeness: 2, cooperation: 4, challengeLevel: 4, clarity: 5, interruptionTendency: 1, openingRule: 'Speak once only in the opening, in no more than 15 words. Mention one specific piece of evidence or constraint; do not explain the conclusion.' },
  { id: 'Ryan', function: 'Is willing to help but needs scope and time made concrete.', initiative: 3, talkativeness: 3, cooperation: 5, challengeLevel: 1, clarity: 2, interruptionTendency: 1, openingRule: 'Speak once in the opening. Offer help warmly, but leave either the task scope or timing genuinely vague.' },
]

export const groupProjectTeams: Record<TeamId, TeamDefinition> = {
  A: {
    id: 'A', label: 'Group A',
    members: [
      { id: 'Alex', function: 'Creates momentum without being hostile.', initiative: 5, talkativeness: 4, cooperation: 4, challengeLevel: 2, clarity: 4, interruptionTendency: 3, openingRule: 'Suggests movement before the shared direction is clear.', strength: 'Keeps the group moving.', difficulty: 'May rush into tasks before the direction is clear.', pressureBehavior: 'Moves quickly toward task division.' },
      { id: 'Sophie', function: 'Brings high-value evidence when the group makes room for it.', initiative: 2, talkativeness: 2, cooperation: 4, challengeLevel: 4, clarity: 5, interruptionTendency: 1, openingRule: 'Shares a short evidence note but does not force it into the room.', strength: 'Notices useful evidence and weak claims.', difficulty: 'May keep an important concern to herself.', pressureBehavior: 'Offers a brief fact, then lets the group move on.' },
      { id: 'Ryan', function: 'Is willing to help but needs scope and time made concrete.', initiative: 3, talkativeness: 3, cooperation: 5, challengeLevel: 1, clarity: 2, interruptionTendency: 1, openingRule: 'Offers help warmly but leaves scope or time vague.', strength: 'Is friendly and willing to contribute.', difficulty: 'May agree to help without a clear task or time.', pressureBehavior: 'Makes helpful but imprecise commitments.' },
    ],
  },
  B: {
    id: 'B', label: 'Group B',
    members: [
      { id: 'Maya', function: 'Creates structure through clear planning.', initiative: 4, talkativeness: 3, cooperation: 4, challengeLevel: 2, clarity: 4, interruptionTendency: 1, openingRule: 'Starts a plan before the shared output is selected.', strength: 'Turns work into clear steps.', difficulty: 'May plan work before the project goal is clear.', pressureBehavior: 'Builds structure too early.' },
      { id: 'Noah', function: 'Brings several workable options.', initiative: 4, talkativeness: 4, cooperation: 4, challengeLevel: 2, clarity: 3, interruptionTendency: 2, openingRule: 'Adds useful options faster than the team can choose.', strength: 'Offers creative directions and options.', difficulty: 'May add choices faster than the group can decide.', pressureBehavior: 'Widens the scope with more ideas.' },
      { id: 'Leila', function: 'Tests whether a plan really works.', initiative: 3, talkativeness: 2, cooperation: 4, challengeLevel: 4, clarity: 3, interruptionTendency: 1, openingRule: 'Raises a concern without explaining it fully at first.', strength: 'Tests whether a plan really works.', difficulty: 'May challenge an idea without explaining her concern fully.', pressureBehavior: 'Signals a concern before making it specific.' },
    ],
  },
  C: {
    id: 'C', label: 'Group C',
    members: [
      { id: 'Jordan', function: 'Builds momentum and wants a quick start.', initiative: 5, talkativeness: 4, cooperation: 4, challengeLevel: 2, clarity: 3, interruptionTendency: 3, openingRule: 'Moves ahead before every useful input has entered.', strength: 'Creates momentum in a meeting.', difficulty: 'May move on before everyone has contributed.', pressureBehavior: 'Treats an early answer as enough to start.' },
      { id: 'Hannah', function: 'Has careful observations and useful notes.', initiative: 1, talkativeness: 1, cooperation: 4, challengeLevel: 2, clarity: 4, interruptionTendency: 1, openingRule: 'Hints at useful information but waits to be invited.', strength: 'Has careful observations and useful notes.', difficulty: 'May wait too long to share important information.', pressureBehavior: 'Makes a small signal rather than claiming the floor.' },
      { id: 'Daniel', function: 'Protects quality and completeness.', initiative: 3, talkativeness: 3, cooperation: 4, challengeLevel: 3, clarity: 4, interruptionTendency: 1, openingRule: 'Raises quality requirements before a realistic scope is agreed.', strength: 'Protects quality and completeness.', difficulty: 'May find it hard to accept a realistic trade-off.', pressureBehavior: 'Pushes for full quality before scope is realistic.' },
    ],
  },
  D: {
    id: 'D', label: 'Group D',
    members: [
      { id: 'Priya', function: 'Brings structure to the group’s work.', initiative: 4, talkativeness: 3, cooperation: 4, challengeLevel: 2, clarity: 4, interruptionTendency: 1, openingRule: 'Treats a task list as if roles and scope are already clear.', strength: 'Brings structure to the group’s work.', difficulty: 'May treat a task list as if roles are already clear.', pressureBehavior: 'Moves from list to allocation before agreement.' },
      { id: 'Ethan', function: 'Is positive and willing to take work on.', initiative: 3, talkativeness: 3, cooperation: 5, challengeLevel: 1, clarity: 2, interruptionTendency: 1, openingRule: 'Offers help without naming an achievable task.', strength: 'Is positive and willing to take work on.', difficulty: 'May promise more than he can realistically finish.', pressureBehavior: 'Offers flexible help without a boundary.' },
      { id: 'Olivia', function: 'Brings alternative ways to approach a project.', initiative: 4, talkativeness: 4, cooperation: 4, challengeLevel: 2, clarity: 3, interruptionTendency: 2, openingRule: 'Keeps widening the output choices.', strength: 'Brings alternative ways to approach a project.', difficulty: 'May keep widening the project scope.', pressureBehavior: 'Adds outputs before the team has selected one.' },
    ],
  },
}

// Level 1 currently has one deliberately designed team.  Keep the earlier
// alternative team data out of the active product path until future levels
// have their own tested director contracts.
export function groupProjectTeam(_teamId: TeamId = 'A') {
  return groupProjectTeams.A
}

function initialTeamState(team: TeamDefinition): Record<string, RoleRuntimeState> {
  return Object.fromEntries(team.members.map((member) => [member.id, {
    participation: member.initiative >= 4 ? 'leading' : member.initiative <= 2 ? 'holding-back' : 'contributing',
    taskStance: 'unclear',
    interaction: 'open',
    tone: 'neutral',
  }]))
}

const levelOneNodes: SceneNode[] = [
  { id: 'clarify_direction', event: 'TASK_AMBIGUITY', skillId: 'read_risk', objective: 'Help the group name a shared direction before roles are fixed.', completionEvidence: 'The learner identifies a concrete risk of dividing work before the project direction is clear, or asks the group to agree the main question first.', resolutionRequirements: { facts: ['mainDirection', 'projectFocus', 'evidenceLink'], minTeamConfirmations: 2 }, primaryResponder: 'Alex', supportingResponder: 'Sophie', entryLine: 'Before we split the work, what is the main question we want to answer?' },
  { id: 'state_preference', event: 'ROLE_AMBIGUITY', skillId: 'enter', objective: 'Make one meaningful contribution preference visible before roles settle.', completionEvidence: 'The learner enters the discussion and states a contribution they would value or a role they would like to take.', resolutionRequirements: { facts: ['learnerContribution', 'teamNeed'], minTeamConfirmations: 1 }, primaryResponder: 'Alex', entryLine: 'Now that we have a direction, what part would each person like to help with?' },
  { id: 'clarify_scope', event: 'TASK_AMBIGUITY', skillId: 'clarify_scope', objective: 'Turn one vague task, role, or deadline into something actionable.', completionEvidence: 'The learner asks a specific clarifying question about task boundaries, ownership, or time.', resolutionRequirements: { facts: ['owner', 'deliverable', 'deadline'], minTeamConfirmations: 2 }, primaryResponder: 'Alex', supportingResponder: 'Ryan', entryLine: 'Before we choose tasks, what should each task include?' },
  { id: 'invite_evidence', event: 'ROLE_AMBIGUITY', skillId: 'low_request', objective: 'Invite useful evidence into the decision without taking over.', completionEvidence: 'The learner makes a specific, low-burden request for Sophie to explain or share her relevant information.', resolutionRequirements: { facts: ['evidence', 'projectImpact'], minTeamConfirmations: 2 }, primaryResponder: 'Sophie', supportingResponder: 'Alex', entryLine: 'Sophie has a useful note, but the group is starting to move on without it.' },
  { id: 'integrate_views', event: 'LIGHT_DISAGREEMENT', skillId: 'paraphrase', objective: 'Show that two valid concerns can be aligned before a decision.', completionEvidence: 'The learner accurately paraphrases Alex’s pace concern, Sophie’s evidence concern, or both before moving the discussion on.', resolutionRequirements: { facts: ['firstConcern', 'secondConcern', 'decisionRule'], minTeamConfirmations: 2 }, primaryResponder: 'Sophie', supportingResponder: 'Alex', entryLine: 'Alex wants to move quickly. Sophie wants to check the evidence first.' },
  { id: 'confirm_commitments', event: 'DEADLINE_AMBIGUITY', skillId: 'summarize_next', objective: 'Close with a decision, owner, time, and next step.', completionEvidence: 'The learner summarises at least one owner, a specific time, and a next step; the team can confirm the plan.', resolutionRequirements: { facts: ['owners', 'handoffTime', 'nextCheckIn'], minTeamConfirmations: 3, requireAllTeammates: true }, primaryResponder: 'Ryan', supportingResponder: 'Alex', entryLine: 'Before we finish, we still need clear owners and a clear time.' },
]

const levelOneBoardDetails: Record<string, Pick<SceneNode, 'taskLabel' | 'missingFact' | 'recordLabel' | 'taskMoment'>> = {
  clarify_direction: { taskLabel: 'Agree the direction', missingFact: 'Main question', recordLabel: 'Project direction', taskMoment: { situation: 'People are starting to divide work before the group has agreed what problem the project will solve.', decision: 'Choose one main question and a focused first project direction.', settledWhen: ['One main question is named.', 'The first project focus is clear enough to work on.', 'One useful piece of evidence supports the choice.'] } },
  state_preference: { taskLabel: 'State my contribution', missingFact: 'Your contribution', recordLabel: 'My contribution', taskMoment: { situation: 'Roles are beginning to settle, but your own contribution has not entered the plan.', decision: 'Make one contribution you want to own visible to the team.', settledWhen: ['Your contribution is named.', 'The team can see how it helps the project.'] } },
  clarify_scope: { taskLabel: 'Clarify the task', missingFact: 'Scope, owner, or time', recordLabel: 'Task definition', taskMoment: { situation: 'A task has a name, but the team cannot yet tell exactly what will be delivered or when.', decision: 'Turn one vague task into a bounded, workable commitment.', settledWhen: ['One owner is clear.', 'The deliverable is specific.', 'A handoff time is agreed.'] } },
  invite_evidence: { taskLabel: 'Invite useful input', missingFact: 'Evidence or constraint', recordLabel: 'Evidence added', taskMoment: { situation: 'Useful information has appeared, but the group is close to deciding without using it.', decision: 'Bring one relevant piece of evidence into the current decision.', settledWhen: ['The evidence is made specific.', 'The team says how it changes the plan.'] } },
  integrate_views: { taskLabel: 'Align two views', missingFact: 'Decision rationale', recordLabel: 'Decision rationale', taskMoment: { situation: 'Two useful concerns are pulling the group in different directions.', decision: 'Make a decision that addresses both concerns.', settledWhen: ['Both concerns are named fairly.', 'The team states the rule or trade-off behind its decision.'] } },
  confirm_commitments: { taskLabel: 'Confirm commitments', missingFact: 'Owner, date, or check-in', recordLabel: 'Commitments', taskMoment: { situation: 'The team is ready to leave, but key handoffs and times are still loose.', decision: 'Leave with a shared plan that can actually be followed.', settledWhen: ['Each necessary owner is named.', 'The next handoff has a specific time.', 'The next check-in is agreed.'] } },
}

// This is not a prescribed response or a skill hint. It is the learner-facing
// Chinese readout of the social situation after the node's two AI setup lines.
// It makes the project conflict visible before the learner decides how to act.
const levelOneSceneCues: Record<string, NodeSceneCue> = {
  clarify_direction: {
    summaryZh: '有人已经想开始分工，另一位组员却提出了晚间校园支持的访谈线索；团队还没有选定要解决的核心问题。',
    conflictZh: '项目方向未定，却准备开始分工。',
    userGoalZh: '先让团队确定一个共同方向和具体聚焦点，再继续谈任务。',
  },
  state_preference: {
    summaryZh: '组员开始谈谁做什么，但你的贡献偏好还没有进入计划。',
    conflictZh: '角色正在形成，你可能被动接下剩余工作。',
    userGoalZh: '清楚表达你想承担的贡献，以及它能怎样帮助项目。',
  },
  clarify_scope: {
    summaryZh: '有人愿意做 research，但没有说清要交什么、由谁负责、什么时候交；计划却准备把它记下来。',
    conflictZh: '任务只有名称，没有清晰的产出和交接时间。',
    userGoalZh: '让团队把一项模糊任务变成明确负责人、具体产出和时间点。',
  },
  invite_evidence: {
    summaryZh: '一条与学生晚间求助有关的重要信息已经出现，但团队正准备跳过它，直接继续分工。',
    conflictZh: '有用证据尚未进入项目决定。',
    userGoalZh: '为这条信息创造发言空间，并让团队说明它会怎样影响计划。',
  },
  integrate_views: {
    summaryZh: '一位组员希望今天尽快决定，另一位担心这样会忽略证据；两种合理关切还没有被放进同一个方案。',
    conflictZh: '速度与证据之间还没有形成共同的决策规则。',
    userGoalZh: '先承接两边的关切，再帮助团队形成能执行的取舍方式。',
  },
  confirm_commitments: {
    summaryZh: '团队准备结束会议，但有人只说“这周晚些时候”完成，任务交接和下次确认时间都不明确。',
    conflictZh: '承诺模糊，会议结束后计划可能无法执行。',
    userGoalZh: '确认谁做什么、何时交接，以及团队何时再次确认进度。',
  },
}

const teamNodeOverlays: Record<TeamId, Record<string, Partial<SceneNode>>> = {
  A: {
    clarify_direction: { primaryResponder: 'Alex', supportingResponder: 'Sophie', entryLine: 'Let’s each take a section now. We can choose the main question later.', stateBefore: { Alex: { tone: 'rushed' }, Sophie: { interaction: 'unheard' } }, stateAfter: { Alex: { tone: 'acknowledged', interaction: 'open' }, Sophie: { participation: 'invited', interaction: 'acknowledged' } } },
    state_preference: { primaryResponder: 'Alex', entryLine: 'I can coordinate the first draft. What part would you like to help with?', stateAfter: { Alex: { participation: 'contributing' } } },
    clarify_scope: { primaryResponder: 'Ryan', supportingResponder: 'Alex', entryLine: 'I can do the research part, maybe by the end of the week.', stateBefore: { Ryan: { taskStance: 'unclear' } }, stateAfter: { Ryan: { taskStance: 'owns-task', tone: 'clear' }, Alex: { interaction: 'open' } } },
    invite_evidence: { primaryResponder: 'Sophie', supportingResponder: 'Alex', entryLine: 'One interview said students cannot find support after 6 PM.', stateBefore: { Sophie: { participation: 'holding-back', interaction: 'unheard' } }, stateAfter: { Sophie: { participation: 'contributing', interaction: 'acknowledged' } } },
    integrate_views: { primaryResponder: 'Alex', supportingResponder: 'Sophie', entryLine: 'We need to decide today, or we will lose time. Sophie wants to check the interview point first.', stateBefore: { Alex: { tone: 'rushed' }, Sophie: { tone: 'concerned' } }, stateAfter: { Alex: { interaction: 'acknowledged' }, Sophie: { interaction: 'acknowledged', tone: 'relieved' } } },
    confirm_commitments: { primaryResponder: 'Ryan', supportingResponder: 'Alex', entryLine: 'I can probably send my part later this week.', stateBefore: { Ryan: { taskStance: 'unclear' } }, stateAfter: { Ryan: { taskStance: 'owns-task', tone: 'clear' }, Alex: { tone: 'relieved' } } },
  },
  B: {
    clarify_direction: { primaryResponder: 'Maya', supportingResponder: 'Noah', entryLine: 'I can make a task plan for all three ideas. We can choose one later.', stateBefore: { Maya: { tone: 'rushed' }, Noah: { tone: 'expansive' } }, stateAfter: { Maya: { interaction: 'open', tone: 'acknowledged' }, Noah: { tone: 'focused' } } },
    state_preference: { primaryResponder: 'Maya', supportingResponder: 'Leila', entryLine: 'We have research, a prototype, and the final explanation. Which part fits you best?', stateAfter: { Leila: { interaction: 'open' } } },
    clarify_scope: { primaryResponder: 'Noah', supportingResponder: 'Maya', entryLine: 'We could make a map, a guide, a poster, and a short video.', stateBefore: { Noah: { tone: 'expansive' }, Maya: { tone: 'rushed' } }, stateAfter: { Noah: { tone: 'focused' }, Maya: { taskStance: 'clear' } } },
    invite_evidence: { primaryResponder: 'Leila', supportingResponder: 'Noah', entryLine: 'I’m not sure one source really supports that idea.', stateBefore: { Leila: { interaction: 'concerned', taskStance: 'unclear' } }, stateAfter: { Leila: { participation: 'contributing', taskStance: 'clear' } } },
    integrate_views: { primaryResponder: 'Noah', supportingResponder: 'Leila', entryLine: 'A map and a guide would make the project more useful. I worry two outputs will be too much for four days.', stateBefore: { Noah: { tone: 'expansive' }, Leila: { tone: 'concerned' } }, stateAfter: { Noah: { tone: 'focused' }, Leila: { tone: 'relieved', interaction: 'acknowledged' } } },
    confirm_commitments: { primaryResponder: 'Maya', supportingResponder: 'Leila', entryLine: 'The plan has the tasks, so we can add the dates in the chat.', stateBefore: { Maya: { taskStance: 'unclear' } }, stateAfter: { Maya: { taskStance: 'clear' }, Leila: { tone: 'relieved' } } },
  },
  C: {
    clarify_direction: { primaryResponder: 'Jordan', supportingResponder: 'Hannah', entryLine: 'We have enough to start. Let’s choose sections now.', stateBefore: { Jordan: { tone: 'rushed' }, Hannah: { participation: 'holding-back', interaction: 'unheard' } }, stateAfter: { Jordan: { tone: 'acknowledged' }, Hannah: { participation: 'invited', interaction: 'acknowledged' } } },
    state_preference: { primaryResponder: 'Daniel', entryLine: 'We will need someone to check the final quality. Is there a part you would like to own?', stateAfter: { Daniel: { interaction: 'open' } } },
    clarify_scope: { primaryResponder: 'Daniel', supportingResponder: 'Jordan', entryLine: 'The final guide should cover every possible service in detail.', stateBefore: { Daniel: { tone: 'concerned' }, Jordan: { tone: 'rushed' } }, stateAfter: { Daniel: { tone: 'aligned' }, Jordan: { taskStance: 'clear' } } },
    invite_evidence: { primaryResponder: 'Hannah', supportingResponder: 'Daniel', entryLine: 'I wrote down one useful pattern from the interviews.', stateBefore: { Hannah: { participation: 'holding-back', interaction: 'unheard' } }, stateAfter: { Hannah: { participation: 'contributing', interaction: 'acknowledged' }, Daniel: { interaction: 'open' } } },
    integrate_views: { primaryResponder: 'Jordan', supportingResponder: 'Daniel', entryLine: 'A simple version is enough if we can show it working. It still needs to be accurate and easy to use.', stateBefore: { Jordan: { tone: 'rushed' }, Daniel: { tone: 'concerned' } }, stateAfter: { Jordan: { tone: 'acknowledged' }, Daniel: { tone: 'relieved', interaction: 'acknowledged' } } },
    confirm_commitments: { primaryResponder: 'Jordan', supportingResponder: 'Hannah', entryLine: 'Let’s message each other later about the exact times.', stateBefore: { Jordan: { taskStance: 'unclear' }, Hannah: { taskStance: 'unclear' } }, stateAfter: { Jordan: { tone: 'relieved' }, Hannah: { taskStance: 'clear', tone: 'relieved' } } },
  },
  D: {
    clarify_direction: { primaryResponder: 'Priya', supportingResponder: 'Olivia', entryLine: 'Good, I’ll assign owners for this whole list. We can add ideas as we go.', stateBefore: { Priya: { tone: 'rushed' }, Olivia: { tone: 'expansive' } }, stateAfter: { Priya: { interaction: 'open', tone: 'acknowledged' }, Olivia: { tone: 'focused' } } },
    state_preference: { primaryResponder: 'Olivia', supportingResponder: 'Priya', entryLine: 'We have a few ways to help the project. What would you enjoy contributing?', stateAfter: { Priya: { interaction: 'open' } } },
    clarify_scope: { primaryResponder: 'Ethan', supportingResponder: 'Priya', entryLine: 'I can help with the presentation, the research, or anything else.', stateBefore: { Ethan: { taskStance: 'unclear' }, Priya: { tone: 'rushed' } }, stateAfter: { Ethan: { taskStance: 'owns-task', tone: 'clear' }, Priya: { taskStance: 'clear' } } },
    invite_evidence: { primaryResponder: 'Olivia', supportingResponder: 'Ethan', entryLine: 'I have two notes about what students need at night, but I’m not sure which one matters.', stateBefore: { Olivia: { tone: 'uncertain' }, Ethan: { taskStance: 'unclear' } }, stateAfter: { Olivia: { participation: 'contributing', tone: 'focused' }, Ethan: { interaction: 'open' } } },
    integrate_views: { primaryResponder: 'Priya', supportingResponder: 'Olivia', entryLine: 'We need one clear plan that everyone can finish. I do not want us to cut the student ideas too early.', stateBefore: { Priya: { tone: 'concerned' }, Olivia: { tone: 'expansive' } }, stateAfter: { Priya: { tone: 'relieved', interaction: 'acknowledged' }, Olivia: { tone: 'focused' } } },
    confirm_commitments: { primaryResponder: 'Ethan', supportingResponder: 'Priya', entryLine: 'I’ll help with the slides at some point this weekend.', stateBefore: { Ethan: { taskStance: 'unclear' }, Priya: { taskStance: 'unclear' } }, stateAfter: { Ethan: { taskStance: 'owns-task', tone: 'clear' }, Priya: { tone: 'relieved' } } },
  },
}

// These sequences come directly from the Level 1 story chains. They prevent
// a generic three-agent chorus: a node only uses the members whose behaviour
// makes that exact project problem visible, and its completion has a planned
// confirmation/next-question handoff.
const levelOneSpeakerPlans: Record<TeamId, Record<string, NodeSpeakerPlan>> = {
  A: {
    clarify_direction: { opening: ['Alex', 'Sophie', 'Ryan', 'Alex'], unresolved: ['Alex', 'Sophie'], resolved: ['Alex', 'Sophie', 'Alex'] },
    state_preference: { opening: ['Alex', 'Ryan', 'Alex'], unresolved: ['Alex', 'Ryan'], resolved: ['Alex', 'Sophie', 'Ryan'] },
    clarify_scope: { opening: ['Ryan', 'Alex', 'Sophie', 'Alex'], unresolved: ['Ryan', 'Alex'], resolved: ['Ryan', 'Alex', 'Sophie'] },
    invite_evidence: { opening: ['Sophie', 'Alex', 'Ryan', 'Alex'], unresolved: ['Sophie', 'Alex'], resolved: ['Sophie', 'Alex', 'Alex'] },
    integrate_views: { opening: ['Alex', 'Sophie', 'Ryan', 'Alex'], unresolved: ['Alex', 'Sophie'], resolved: ['Alex', 'Sophie', 'Ryan'] },
    confirm_commitments: { opening: ['Ryan', 'Alex', 'Sophie', 'Alex'], unresolved: ['Ryan', 'Alex'], resolved: ['Ryan', 'Sophie', 'Alex'] },
  },
  B: {
    clarify_direction: { opening: ['Maya', 'Noah', 'Leila', 'Maya'], unresolved: ['Maya', 'Noah'], resolved: ['Maya', 'Noah', 'Maya'] },
    state_preference: { opening: ['Maya', 'Leila', 'Noah', 'Maya'], unresolved: ['Maya', 'Leila'], resolved: ['Maya', 'Noah', 'Noah'] },
    clarify_scope: { opening: ['Noah', 'Maya', 'Leila', 'Maya'], unresolved: ['Noah', 'Maya'], resolved: ['Noah', 'Maya', 'Leila'] },
    invite_evidence: { opening: ['Leila', 'Noah', 'Maya', 'Maya'], unresolved: ['Leila', 'Noah'], resolved: ['Leila', 'Maya', 'Noah'] },
    integrate_views: { opening: ['Noah', 'Leila', 'Maya', 'Maya'], unresolved: ['Noah', 'Leila'], resolved: ['Noah', 'Leila', 'Maya'] },
    confirm_commitments: { opening: ['Maya', 'Leila', 'Noah', 'Maya'], unresolved: ['Maya', 'Leila'], resolved: ['Leila', 'Noah', 'Maya'] },
  },
  C: {
    clarify_direction: { opening: ['Jordan', 'Hannah', 'Daniel', 'Jordan'], unresolved: ['Jordan', 'Hannah'], resolved: ['Jordan', 'Hannah', 'Daniel'] },
    state_preference: { opening: ['Daniel', 'Jordan', 'Hannah', 'Jordan'], unresolved: ['Daniel', 'Jordan'], resolved: ['Jordan', 'Daniel', 'Daniel'] },
    clarify_scope: { opening: ['Daniel', 'Jordan', 'Hannah', 'Daniel'], unresolved: ['Daniel', 'Jordan'], resolved: ['Daniel', 'Jordan', 'Hannah'] },
    invite_evidence: { opening: ['Hannah', 'Daniel', 'Jordan', 'Jordan'], unresolved: ['Hannah', 'Daniel'], resolved: ['Hannah', 'Daniel', 'Jordan'] },
    integrate_views: { opening: ['Jordan', 'Daniel', 'Hannah', 'Jordan'], unresolved: ['Jordan', 'Daniel'], resolved: ['Jordan', 'Daniel', 'Jordan'] },
    confirm_commitments: { opening: ['Jordan', 'Hannah', 'Daniel', 'Jordan'], unresolved: ['Jordan', 'Hannah'], resolved: ['Hannah', 'Daniel', 'Jordan'] },
  },
  D: {
    clarify_direction: { opening: ['Priya', 'Olivia', 'Ethan', 'Priya'], unresolved: ['Priya', 'Olivia'], resolved: ['Priya', 'Olivia', 'Olivia'] },
    state_preference: { opening: ['Olivia', 'Priya', 'Ethan', 'Olivia'], unresolved: ['Olivia', 'Priya'], resolved: ['Priya', 'Ethan', 'Ethan'] },
    clarify_scope: { opening: ['Ethan', 'Priya', 'Olivia', 'Priya'], unresolved: ['Ethan', 'Priya'], resolved: ['Ethan', 'Priya', 'Olivia'] },
    invite_evidence: { opening: ['Olivia', 'Priya', 'Ethan', 'Olivia'], unresolved: ['Olivia', 'Priya'], resolved: ['Olivia', 'Priya', 'Priya'] },
    integrate_views: { opening: ['Priya', 'Olivia', 'Ethan', 'Priya'], unresolved: ['Priya', 'Olivia'], resolved: ['Priya', 'Olivia', 'Ethan'] },
    confirm_commitments: { opening: ['Ethan', 'Priya', 'Olivia', 'Priya'], unresolved: ['Ethan', 'Priya'], resolved: ['Ethan', 'Olivia', 'Priya'] },
  },
}

// Group A is the currently released Level 1 team.  These contracts are the
// interaction layer beneath its six teaching nodes: they tell the director who
// has a reason to speak, who they are answering, what thread they must pick up,
// and why the remaining teammate should not fill the silence.
const groupAInteractionPlans: Record<string, NodeInteractionPlan> = {
  clarify_direction: {
    unresolved: [
      { speaker: 'Alex', target: 'You', dialogueAct: 'surface_risk', refersTo: 'his early suggestion to split sections before choosing one question', reasonToSpeak: 'He wants to keep the meeting moving and needs the learner to respond to the premature split.' },
      { speaker: 'Sophie', target: 'Alex', dialogueAct: 'add_evidence', refersTo: 'the choice of main question and her interview note about support after 6 PM', reasonToSpeak: 'Her evidence shows why the direction cannot be chosen casually, but she does not take over the decision.' },
    ],
    resolved: [
      { speaker: 'Alex', target: 'You', dialogueAct: 'acknowledge', refersTo: 'the learner’s proposed direction and focus', reasonToSpeak: 'He must pause allocation and show that the team now has a shared starting point.' },
      { speaker: 'Sophie', target: 'You', dialogueAct: 'confirm', refersTo: 'the evidence link supporting the chosen focus', reasonToSpeak: 'She confirms that her evidence is now part of the decision.' },
      { speaker: 'Alex', target: 'team', dialogueAct: 'connect_next', refersTo: 'the agreed direction', reasonToSpeak: 'Only after confirmation can he ask how the group wants to contribute.' },
    ],
    silenceReason: 'Ryan stays quiet because he cannot choose useful research work until the group has a direction.',
  },
  state_preference: {
    unresolved: [
      { speaker: 'Alex', target: 'You', dialogueAct: 'ask_open_question', refersTo: 'the unfilled contribution slot', reasonToSpeak: 'He is beginning to allocate work and leaves a real opening for the learner to enter.' },
      { speaker: 'Ryan', target: 'Alex', dialogueAct: 'hold_position', refersTo: 'his own vague willingness to help', reasonToSpeak: 'His flexible answer makes it visible that the learner’s preference has not yet entered the plan.' },
    ],
    resolved: [
      { speaker: 'Alex', target: 'You', dialogueAct: 'acknowledge', refersTo: 'the learner’s preferred contribution and why it helps', reasonToSpeak: 'He must treat the preference as a real allocation constraint.' },
      { speaker: 'Sophie', target: 'You', dialogueAct: 'confirm', refersTo: 'how that contribution supports the agreed direction', reasonToSpeak: 'She confirms the contribution fits the project rather than merely being a personal preference.' },
      { speaker: 'Ryan', target: 'team', dialogueAct: 'connect_next', refersTo: 'the emerging roles', reasonToSpeak: 'He can now raise his own still-vague research offer for the next task-definition moment.' },
    ],
    silenceReason: 'Sophie stays quiet until a contribution is named; she should not choose a role for the learner.',
  },
  clarify_scope: {
    unresolved: [
      { speaker: 'Ryan', target: 'You', dialogueAct: 'hold_position', refersTo: 'his offer to do research by an unclear time', reasonToSpeak: 'He owns the vague commitment, so he must not repair it before someone asks for specifics.' },
      { speaker: 'Alex', target: 'Ryan', dialogueAct: 'surface_risk', refersTo: 'writing “research” into the plan without an output or time', reasonToSpeak: 'He makes the practical consequence of accepting Ryan’s vague offer visible.' },
    ],
    resolved: [
      { speaker: 'Ryan', target: 'You', dialogueAct: 'confirm', refersTo: 'the bounded deliverable and agreed handoff time', reasonToSpeak: 'He must explicitly own the newly clear commitment.' },
      { speaker: 'Alex', target: 'Ryan', dialogueAct: 'acknowledge', refersTo: 'the deliverable, owner, and deadline', reasonToSpeak: 'He can now update the working plan without inventing detail.' },
      { speaker: 'Sophie', target: 'team', dialogueAct: 'connect_next', refersTo: 'the now-clear research handoff', reasonToSpeak: 'She can introduce the useful evidence that should shape the next planning choice.' },
    ],
    silenceReason: 'Sophie stays silent because Ryan must define his own work; she cannot supply his commitment for him.',
  },
  invite_evidence: {
    unresolved: [
      { speaker: 'Sophie', target: 'You', dialogueAct: 'add_evidence', refersTo: 'her interview finding about students after 6 PM', reasonToSpeak: 'She has the relevant evidence but needs an opening to explain its implication.' },
      { speaker: 'Alex', target: 'Sophie', dialogueAct: 'surface_risk', refersTo: 'his attempt to move from the fact straight back to task allocation', reasonToSpeak: 'His speed makes the risk of losing the evidence audible without making him hostile.' },
    ],
    resolved: [
      { speaker: 'Sophie', target: 'You', dialogueAct: 'confirm', refersTo: 'how the evidence changes the project focus or design constraint', reasonToSpeak: 'She must connect the fact to a practical project consequence.' },
      { speaker: 'Alex', target: 'Sophie', dialogueAct: 'acknowledge', refersTo: 'the new constraint in the plan', reasonToSpeak: 'He records the evidence instead of treating it as an optional aside.' },
      { speaker: 'Alex', target: 'team', dialogueAct: 'connect_next', refersTo: 'the agreed direction plus evidence constraint', reasonToSpeak: 'He can now name the pace-versus-evidence decision the group still needs to make.' },
    ],
    silenceReason: 'Ryan stays quiet because this is Sophie’s evidence to explain; he should not paraphrase it for her.',
  },
  integrate_views: {
    unresolved: [
      { speaker: 'Alex', target: 'You', dialogueAct: 'hold_position', refersTo: 'his need to decide today', reasonToSpeak: 'He represents the legitimate time-pressure concern without dismissing the evidence.' },
      { speaker: 'Sophie', target: 'Alex', dialogueAct: 'hold_position', refersTo: 'her concern that the interview finding could change the choice', reasonToSpeak: 'She keeps the evidence concern visible but does not turn it into a personal disagreement.' },
    ],
    resolved: [
      { speaker: 'Alex', target: 'You', dialogueAct: 'acknowledge', refersTo: 'the learner’s fair summary of pace and evidence', reasonToSpeak: 'He needs to show that the time concern has been heard.' },
      { speaker: 'Sophie', target: 'You', dialogueAct: 'confirm', refersTo: 'the agreed small evidence check or decision rule', reasonToSpeak: 'She confirms that evidence is protected in a workable way.' },
      { speaker: 'Ryan', target: 'team', dialogueAct: 'connect_next', refersTo: 'the decision rule the team just set', reasonToSpeak: 'With the decision rule clear, he can ask for concrete owners and times before leaving.' },
    ],
    silenceReason: 'Ryan waits because he needs the team’s decision rule before he can commit to a realistic task.',
  },
  confirm_commitments: {
    unresolved: [
      { speaker: 'Ryan', target: 'You', dialogueAct: 'hold_position', refersTo: 'his vague “later this week” handoff', reasonToSpeak: 'He must keep the timing gap observable until the group asks for a real commitment.' },
      { speaker: 'Alex', target: 'Ryan', dialogueAct: 'surface_risk', refersTo: 'his wish to close the meeting despite the missing time', reasonToSpeak: 'He makes the closing pressure visible without supplying a deadline himself.' },
    ],
    resolved: [
      { speaker: 'Ryan', target: 'You', dialogueAct: 'confirm', refersTo: 'his specific deliverable and handoff time', reasonToSpeak: 'He confirms the commitment in his own words.' },
      { speaker: 'Sophie', target: 'team', dialogueAct: 'confirm', refersTo: 'the evidence-related handoff or dependency', reasonToSpeak: 'She confirms the part of the plan her evidence depends on.' },
      { speaker: 'Alex', target: 'team', dialogueAct: 'acknowledge', refersTo: 'owners, times, and the next check-in', reasonToSpeak: 'He closes only after the plan is concrete and shared.' },
    ],
    silenceReason: 'No one else fills in Ryan’s date for him; the owner must make the commitment audible.',
  },
}

function interactionPlanForNode(team: TeamDefinition, node: SceneNode): NodeInteractionPlan {
  if (team.id === 'A' && groupAInteractionPlans[node.id]) return groupAInteractionPlans[node.id]
  const speakerPlan = levelOneSpeakerPlans[team.id][node.id]
  const lead = node.primaryResponder
  const support = node.supportingResponder || team.members.find((member) => member.id !== lead)?.id || lead
  const makeBeats = (speakers: string[], resolved: boolean): InteractionBeat[] => speakers.map((speaker, index) => ({
    speaker,
    target: index === 0 ? 'You' : speakers[index - 1],
    dialogueAct: resolved ? (index === speakers.length - 1 ? 'connect_next' : 'confirm') : (index === 0 ? 'surface_risk' : 'add_evidence'),
    refersTo: resolved ? 'the facts the group has just settled' : index === 0 ? node.entryLine : node.director?.visibleEvidence?.[index] || 'the current unresolved project fact',
    reasonToSpeak: speaker === lead ? node.director?.leadRule || 'They are responsible for making the current project issue visible.' : speaker === support ? node.director?.supportRule || 'They add the second relevant piece of evidence.' : 'They give the next necessary response without taking over the learner’s task.',
  }))
  return {
    unresolved: makeBeats(speakerPlan.unresolved, false),
    resolved: makeBeats(speakerPlan.resolved, true),
    silenceReason: node.director?.thirdRoleRule || 'The teammate remains quiet because they cannot responsibly solve this issue for the learner.',
  }
}

// The six learning moves stay constant for Level 1. What changes by team is
// the source of the problem, the visible behaviour learners can notice, and
// what each teammate must do after the learner intervenes. These contracts are
// sent to the director on every turn; they are not merely UI copy.
const teamNodeContracts: Record<TeamId, Record<string, Pick<SceneNode, 'thirdResponder' | 'director'>>> = {
  A: {
    clarify_direction: { thirdResponder: 'Ryan', director: {
      issue: 'Work is being divided before the group has chosen one question.',
      visibleEvidence: ['Alex names two sections and starts assigning them.', 'Sophie gives one interview fact, then loses the floor.', 'Ryan agrees before knowing what the group will study.'],
      leadRule: 'Alex must make a concrete early allocation, then ask the group to move on. He is efficient, not rude.',
      supportRule: 'Sophie gives one short evidence clue and pauses; she does not force a conclusion.',
      thirdRoleRule: 'Ryan warmly agrees to help, which makes Alex’s rushed division look easier to accept.',
      ignoreEscalation: 'Alex adds one more task to the unfinished split. Do not add a separate conflict.',
      resolutionEffect: 'Alex pauses task allocation and asks for the shared question; Sophie is explicitly invited to connect her fact to it.',
      conclusionSchema: 'Main question or direction agreed before roles are assigned.',
    } },
    state_preference: { thirdResponder: 'Sophie', director: {
      issue: 'Roles are beginning to settle while the learner’s contribution is invisible.',
      visibleEvidence: ['Alex claims coordination first.', 'Ryan says he is happy with anything.', 'Sophie waits for the direction before naming a task.'],
      leadRule: 'Alex names the coordination role and then leaves one useful gap for the learner to enter.',
      supportRule: 'Ryan gives a friendly but non-specific answer; he does not decide for the learner.',
      thirdRoleRule: 'Sophie stays quiet while the group is still choosing roles.',
      ignoreEscalation: 'Alex offers the learner the remaining task without knowing their preference.',
      resolutionEffect: 'Alex repeats the learner’s preferred contribution as a real input to later allocation.',
      conclusionSchema: 'Learner contribution preference and its value to the team.',
    } },
    clarify_scope: { thirdResponder: 'Sophie', director: {
      issue: 'Ryan has offered help, but the deliverable and handoff time are missing.',
      visibleEvidence: ['Ryan says he can do research “maybe by the end of the week”.', 'Alex is ready to write “research” into the task list.', 'Sophie does not fill in Ryan’s missing details.'],
      leadRule: 'Ryan must make a warm but genuinely incomplete commitment; do not clarify it on his own.',
      supportRule: 'Alex treats the vague offer as ready to record, showing why the gap matters.',
      thirdRoleRule: 'Sophie stays out of Ryan’s commitment and lets the ambiguity remain observable.',
      ignoreEscalation: 'Alex records “research” with no output or date, then tries to move on.',
      resolutionEffect: 'Ryan confirms one bounded output and a concrete time; Alex can then update the plan.',
      conclusionSchema: 'Named owner, bounded deliverable, and a specific handoff time.',
    } },
    invite_evidence: { thirdResponder: 'Ryan', director: {
      issue: 'A useful interview fact has appeared, but the group is about to leave it out of the decision.',
      visibleEvidence: ['Sophie mentions that students cannot find help after 6 PM.', 'Alex immediately turns back to tasks.', 'Ryan waits for an assignment instead of asking about the fact.'],
      leadRule: 'Sophie gives one specific fact but does not explain its implication unless someone makes room.',
      supportRule: 'Alex signals that the meeting is moving on before the fact shapes the direction.',
      thirdRoleRule: 'Ryan remains ready but passive, leaving space for the learner to invite Sophie.',
      ignoreEscalation: 'Alex labels the fact “something for later” and continues the task list.',
      resolutionEffect: 'Sophie explains how the fact changes the project direction, and the group records one design constraint.',
      conclusionSchema: 'Evidence or constraint added and its effect on the chosen direction.',
    } },
    integrate_views: { thirdResponder: 'Ryan', director: {
      issue: 'Alex needs a decision today; Sophie needs the interview finding checked. Both concerns are valid.',
      visibleEvidence: ['Alex says delay will cost time.', 'Sophie says the finding may change the choice.', 'Ryan does not choose a side.'],
      leadRule: 'Alex presses for a decision today without dismissing Sophie personally.',
      supportRule: 'Sophie explains the evidence concern in one clear sentence.',
      thirdRoleRule: 'Ryan waits for a shared way forward and does not solve the disagreement.',
      ignoreEscalation: 'Alex asks for an immediate vote while Sophie repeats that she is unsure.',
      resolutionEffect: 'Both concerns are named, and the group agrees on one small evidence check before deciding.',
      conclusionSchema: 'Decision rule that protects both pace and the evidence check.',
    } },
    confirm_commitments: { thirdResponder: 'Sophie', director: {
      issue: 'The meeting is ending with friendly offers but no dependable time or handoff.',
      visibleEvidence: ['Ryan says “later this week”.', 'Alex is ready to close.', 'Sophie waits for the plan to become concrete.'],
      leadRule: 'Ryan keeps timing vague until a teammate asks for a concrete commitment.',
      supportRule: 'Alex signals a desire to end the meeting without solving the date gap.',
      thirdRoleRule: 'Sophie listens for a confirmed plan and does not invent dates.',
      ignoreEscalation: 'Alex says the group can sort it out in chat, leaving no check-in.',
      resolutionEffect: 'Ryan and the relevant owners confirm a time and the group names the next check-in.',
      conclusionSchema: 'Owners, dates, and the next check-in.',
    } },
  },
  B: {
    clarify_direction: { thirdResponder: 'Leila', director: {
      issue: 'The group has more planned options than it can choose or complete.',
      visibleEvidence: ['Maya starts a plan for three directions.', 'Noah adds a fourth direction.', 'Leila signals that one source may not support an option.'],
      leadRule: 'Maya must organise several parallel plans before any shared choice is made.',
      supportRule: 'Noah adds one useful additional option rather than helping to reduce the list.',
      thirdRoleRule: 'Leila gives one brief, incomplete concern and does not yet explain it.',
      ignoreEscalation: 'Maya begins assigning work across four directions, making the overload visible.',
      resolutionEffect: 'Maya pauses the parallel plan; the group selects one main direction and parks the rest as options.',
      conclusionSchema: 'Chosen main direction and the criterion used to select it.',
    } },
    state_preference: { thirdResponder: 'Noah', director: {
      issue: 'Maya has made a tidy work-flow, but the learner has not said where they can contribute.',
      visibleEvidence: ['Maya lists research, prototype, and explanation.', 'Leila waits for the learner to speak.', 'Noah is ready to add another possibility.'],
      leadRule: 'Maya asks a structured role question but does not guess the learner’s preference.',
      supportRule: 'Leila leaves deliberate room for the learner rather than speaking over them.',
      thirdRoleRule: 'Noah briefly signals another idea but does not take the learner’s turn.',
      ignoreEscalation: 'Maya fills the final open box without the learner’s input.',
      resolutionEffect: 'Maya adds a provisional task that reflects the learner’s stated contribution.',
      conclusionSchema: 'Learner contribution preference linked to a project need.',
    } },
    clarify_scope: { thirdResponder: 'Leila', director: {
      issue: 'Noah keeps adding outputs while Maya turns every idea into work for this week.',
      visibleEvidence: ['Noah names a map, guide, poster, and short video.', 'Maya starts adding all four to the plan.', 'Leila says only “that may be too much”.'],
      leadRule: 'Noah lists multiple attractive outputs in one turn; do not narrow them himself.',
      supportRule: 'Maya converts those outputs into tasks, which exposes the scope risk.',
      thirdRoleRule: 'Leila offers a short concern but not the solution.',
      ignoreEscalation: 'The task list grows to four outputs while the deadline stays unchanged.',
      resolutionEffect: 'The team defines one minimum deliverable; other ideas remain optional.',
      conclusionSchema: 'Required deliverable, excluded or optional outputs, and the current deadline.',
    } },
    invite_evidence: { thirdResponder: 'Maya', director: {
      issue: 'Leila has questioned a source, but her concern is not specific enough to improve the plan.',
      visibleEvidence: ['Leila says she is not sure a source supports the idea.', 'Noah is ready to continue design.', 'Maya waits for something she can assign or check.'],
      leadRule: 'Leila raises a real concern, then stops before naming the evidence or consequence.',
      supportRule: 'Noah moves toward the attractive design option, not maliciously but quickly.',
      thirdRoleRule: 'Maya waits for a concrete checkable detail before changing the plan.',
      ignoreEscalation: 'Noah continues the design discussion and Leila’s concern remains unused.',
      resolutionEffect: 'Leila states a checkable evidence question; Maya records a small verification action.',
      conclusionSchema: 'Evidence question, owner of the check, and how it affects the direction.',
    } },
    integrate_views: { thirdResponder: 'Maya', director: {
      issue: 'Noah wants more useful outputs; Leila wants a deliverable the team can finish in four days.',
      visibleEvidence: ['Noah argues for a map and guide.', 'Leila names the completion risk.', 'Maya cannot schedule until the group chooses.'],
      leadRule: 'Noah argues for practical usefulness, not for being right.',
      supportRule: 'Leila argues for a realistic scope with a neutral tone.',
      thirdRoleRule: 'Maya visibly waits to re-plan once the trade-off is settled.',
      ignoreEscalation: 'Noah adds features while Leila repeats the time limit; the plan remains blocked.',
      resolutionEffect: 'The group selects one core output plus one small supporting element.',
      conclusionSchema: 'Core output, permitted small addition, and reason for the trade-off.',
    } },
    confirm_commitments: { thirdResponder: 'Noah', director: {
      issue: 'The plan has tasks but dates and an evidence check are being postponed to chat.',
      visibleEvidence: ['Maya says the dates can be added later.', 'Leila needs someone to own the source check.', 'Noah has moved to another idea.'],
      leadRule: 'Maya treats a task list as nearly finished although key dates are absent.',
      supportRule: 'Leila names the unowned evidence check without attacking anyone.',
      thirdRoleRule: 'Noah waits for the main plan before revisiting additional ideas.',
      ignoreEscalation: 'Maya closes the plan with no date or owner for verification.',
      resolutionEffect: 'Every agreed task and the evidence check have an owner, date, and check-in.',
      conclusionSchema: 'Task owners, dates, evidence-check owner, and check-in.',
    } },
  },
  C: {
    clarify_direction: { thirdResponder: 'Daniel', director: {
      issue: 'Jordan treats the early answer as enough, while Hannah’s useful note has not entered and Daniel is already expanding quality requirements.',
      visibleEvidence: ['Jordan says the group has enough information to start.', 'Hannah looks at notes and only hints at a pattern.', 'Daniel asks for complete coverage.'],
      leadRule: 'Jordan must declare the group ready to begin before checking for further input.',
      supportRule: 'Hannah offers only a small signal of her useful note and waits.',
      thirdRoleRule: 'Daniel introduces a broad quality requirement that cannot be resolved until direction is clearer.',
      ignoreEscalation: 'Jordan starts assigning sections; Hannah’s note stays out and Daniel’s quality concern has no place.',
      resolutionEffect: 'Jordan pauses for Hannah’s input before the group chooses a direction.',
      conclusionSchema: 'Direction grounded in one named learner need or evidence pattern.',
    } },
    state_preference: { thirdResponder: 'Hannah', director: {
      issue: 'A quality role is being named while the learner’s own contribution remains unspoken.',
      visibleEvidence: ['Daniel names quality checking as necessary.', 'Jordan wants roles filled quickly.', 'Hannah remains quiet.'],
      leadRule: 'Daniel describes one needed quality task and makes a genuine opening for the learner.',
      supportRule: 'Jordan creates mild speed pressure by wanting to fill roles now.',
      thirdRoleRule: 'Hannah listens and does not speak for the learner.',
      ignoreEscalation: 'Jordan places the learner in the remaining role by default.',
      resolutionEffect: 'The learner’s preferred contribution is explicitly represented in the role plan.',
      conclusionSchema: 'Learner contribution preference and how it supports quality or delivery.',
    } },
    clarify_scope: { thirdResponder: 'Hannah', director: {
      issue: 'Daniel wants full coverage; Jordan wants to decide immediately. The first version has no realistic boundary.',
      visibleEvidence: ['Daniel says the guide must cover every service.', 'Jordan says the group must decide today.', 'Hannah cannot tell what the first version will include.'],
      leadRule: 'Daniel asks for completeness without treating simplification as careless.',
      supportRule: 'Jordan pushes for a timely decision without dismissing quality.',
      thirdRoleRule: 'Hannah waits because the scope boundary is not yet clear.',
      ignoreEscalation: 'Daniel lists more exceptions while Jordan tries to force a choice.',
      resolutionEffect: 'The group agrees the first-version coverage and one basic accuracy check.',
      conclusionSchema: 'First-version scope and the minimum accuracy check.',
    } },
    invite_evidence: { thirdResponder: 'Jordan', director: {
      issue: 'Hannah has a useful interview pattern but will not take the floor without a specific invitation.',
      visibleEvidence: ['Hannah says she noted one pattern, then stops.', 'Daniel is willing to test it.', 'Jordan is ready to move back to roles.'],
      leadRule: 'Hannah gives a precise but incomplete cue and waits to be invited.',
      supportRule: 'Daniel shows that the information could be checked if it is made specific.',
      thirdRoleRule: 'Jordan creates the natural risk of moving on, but remains respectful.',
      ignoreEscalation: 'Jordan returns to task division and Hannah’s evidence stays outside the plan.',
      resolutionEffect: 'Hannah gives one useful finding, and Daniel names a proportionate way to verify it.',
      conclusionSchema: 'Evidence finding and its use or verification step.',
    } },
    integrate_views: { thirdResponder: 'Hannah', director: {
      issue: 'Jordan wants a simple demonstrable version; Daniel needs it to be accurate and usable.',
      visibleEvidence: ['Jordan prioritises a working demo.', 'Daniel names the risk of inaccurate guidance.', 'Hannah waits to see which user need matters most.'],
      leadRule: 'Jordan frames simplicity as a way to deliver, not as a reason to ignore users.',
      supportRule: 'Daniel frames accuracy as a minimum standard, not as a demand for perfection.',
      thirdRoleRule: 'Hannah waits for the decision to connect to the student evidence.',
      ignoreEscalation: 'Jordan calls the quality check slow; Daniel keeps adding requirements.',
      resolutionEffect: 'The team agrees on a simple but checked first version.',
      conclusionSchema: 'First-version decision and the accuracy safeguard.',
    } },
    confirm_commitments: { thirdResponder: 'Daniel', director: {
      issue: 'The group has tasks, but Jordan wants to arrange times later and Hannah’s evidence check has no handoff.',
      visibleEvidence: ['Jordan says exact times can be messaged later.', 'Hannah has a task but no time.', 'Daniel needs to know when quality checking can happen.'],
      leadRule: 'Jordan postpones dates because he wants the meeting to end, not because he is avoiding work.',
      supportRule: 'Hannah does not volunteer a deadline until someone asks for one.',
      thirdRoleRule: 'Daniel makes the downstream quality dependency visible.',
      ignoreEscalation: 'The team leaves with approximate work but no dates or handoffs.',
      resolutionEffect: 'The evidence, quality check, and check-in have explicit owners and times.',
      conclusionSchema: 'Owners, evidence handoff, quality check, and check-in time.',
    } },
  },
  D: {
    clarify_direction: { thirdResponder: 'Ethan', director: {
      issue: 'Priya has started allocating a detailed list while Olivia keeps adding outputs; the team has not made a shared decision.',
      visibleEvidence: ['Priya assigns owners from a full task list.', 'Olivia adds another output idea.', 'Ethan says he can take anything.'],
      leadRule: 'Priya must treat a useful list as ready to allocate before the direction is agreed.',
      supportRule: 'Olivia adds one attractive output without narrowing what is essential.',
      thirdRoleRule: 'Ethan agrees to broad help, making premature allocation appear easy.',
      ignoreEscalation: 'Priya assigns another owner and Olivia adds another output; the list grows without a decision.',
      resolutionEffect: 'Priya moves the list back to “to decide”; Olivia’s extra idea is parked as an option.',
      conclusionSchema: 'Shared direction and current core output before allocation.',
    } },
    state_preference: { thirdResponder: 'Ethan', director: {
      issue: 'The team is ready to fill task-list boxes, but the learner has not yet said what they want to contribute.',
      visibleEvidence: ['Olivia offers several ways to help.', 'Priya has a blank task table ready.', 'Ethan says he is flexible.'],
      leadRule: 'Olivia invites a preference by naming more than one possible contribution.',
      supportRule: 'Priya waits to enter the learner’s stated preference into the task table.',
      thirdRoleRule: 'Ethan remains flexible and does not compete for the learner’s contribution.',
      ignoreEscalation: 'Priya uses the first empty box for the learner without asking.',
      resolutionEffect: 'The learner’s preferred contribution becomes a constraint on later allocation.',
      conclusionSchema: 'Learner preference and the project contribution it supports.',
    } },
    clarify_scope: { thirdResponder: 'Olivia', director: {
      issue: 'Ethan has offered everything, and Priya is about to give him several tasks with no clear boundary.',
      visibleEvidence: ['Ethan offers research, presentation, or anything else.', 'Priya starts listing multiple tasks under his name.', 'Olivia keeps mentioning new outputs.'],
      leadRule: 'Ethan offers broad help sincerely but does not define a realistic task or time by himself.',
      supportRule: 'Priya attempts to turn broad willingness into several assignments.',
      thirdRoleRule: 'Olivia adds a small scope pressure by mentioning another output.',
      ignoreEscalation: 'Ethan receives multiple unclear tasks and the task table becomes less reliable.',
      resolutionEffect: 'Ethan owns one bounded deliverable with a time; other tasks remain visibly unassigned.',
      conclusionSchema: 'One realistic Ethan task, deliverable, and deadline.',
    } },
    invite_evidence: { thirdResponder: 'Ethan', director: {
      issue: 'Olivia has two useful notes but does not know which should affect the plan; Priya is ready to include both.',
      visibleEvidence: ['Olivia names two late-night student needs.', 'Priya wants both on the list.', 'Ethan offers help but has no decision criterion.'],
      leadRule: 'Olivia shares two pieces of information and asks indirectly which matters, without choosing herself.',
      supportRule: 'Priya treats both notes as requirements, making scope expansion visible.',
      thirdRoleRule: 'Ethan remains willing but waits for a clear priority.',
      ignoreEscalation: 'Both notes go into the requirements list and the scope expands again.',
      resolutionEffect: 'Olivia connects one key note to the core output; the other becomes a later option.',
      conclusionSchema: 'Key evidence chosen for the current direction and deferred option.',
    } },
    integrate_views: { thirdResponder: 'Ethan', director: {
      issue: 'Priya wants a plan everyone can finish; Olivia wants useful ideas not to disappear.',
      visibleEvidence: ['Priya asks for one stable list.', 'Olivia adds another student-facing idea.', 'Ethan waits for a task he can realistically own.'],
      leadRule: 'Priya argues for an achievable plan, not for deleting ideas because they are inconvenient.',
      supportRule: 'Olivia argues for preserving value, not for making every idea mandatory.',
      thirdRoleRule: 'Ethan illustrates why an unclear list makes fair commitment difficult.',
      ignoreEscalation: 'Priya locks a list while Olivia keeps adding items, recreating the same loop.',
      resolutionEffect: 'The team separates one core output from safe future options.',
      conclusionSchema: 'Core output, saved optional ideas, and why this scope is workable.',
    } },
    confirm_commitments: { thirdResponder: 'Olivia', director: {
      issue: 'Priya’s table looks finished, but Ethan’s contribution still has no trackable handoff time.',
      visibleEvidence: ['Ethan says “some point this weekend”.', 'Priya treats the list as complete.', 'Olivia waits to learn which idea is kept for later.'],
      leadRule: 'Ethan keeps a friendly, vague weekend commitment until the group asks for a real handoff.',
      supportRule: 'Priya signals completion too early because the list has owners.',
      thirdRoleRule: 'Olivia needs the decision about core versus later options before she can act.',
      ignoreEscalation: 'Priya closes the task table while Ethan’s contribution remains untrackable.',
      resolutionEffect: 'Only confirmed owners and dates remain on the task board; optional ideas are recorded separately.',
      conclusionSchema: 'Confirmed owner, exact handoff time, and next check-in.',
    } },
  },
}

// These are not optional examples. They are the minimum observable beats the
// director must make audible before expecting the learner to intervene. The
// factual nouns may be adapted to a confirmed course brief, but the mistaken
// collaboration logic, consequence, and unresolved question must stay intact.
const teamNodeSpeech: Record<TeamId, Record<string, Pick<NodeDirectorContract, 'errorLine' | 'proofLine' | 'consequenceLine' | 'handoffQuestion'>>> = {
  A: {
    clarify_direction: {
      errorLine: 'Let’s split the work now. We can choose the main question later.',
      proofLine: 'One interview said students cannot find help after 6 PM.',
      consequenceLine: 'Ryan is ready to research, but he does not know what the group is trying to answer.',
      handoffQuestion: 'If we split first, what question are we all trying to answer?',
    },
    state_preference: {
      errorLine: 'I can coordinate, and Ryan can start research. We can fill the last role after that.',
      proofLine: 'I am happy with anything, really.',
      consequenceLine: 'The learner’s contribution has not entered the plan, so the last role may be assigned by default.',
      handoffQuestion: 'Before we fill that role, what kind of work would you want to do?',
    },
    clarify_scope: {
      errorLine: 'I can do the research part, maybe by the end of the week.',
      proofLine: 'Great, I’ll just put “research” next to Ryan’s name.',
      consequenceLine: 'The task has a name, but no clear output or handoff time.',
      handoffQuestion: 'Before I write it down, what do we still need to make clear?',
    },
    invite_evidence: {
      errorLine: 'Okay, let’s move on to the tasks now.',
      proofLine: 'The interviews said students cannot find help after 6 PM.',
      consequenceLine: 'The group is about to choose tasks without using the evidence that could set its direction.',
      handoffQuestion: 'Does that note change our focus, or should we leave it for later?',
    },
    integrate_views: {
      errorLine: 'We need a decision today, or we will lose time.',
      proofLine: 'But the interview note may change the direction. I am not ready to ignore it.',
      consequenceLine: 'Ryan cannot begin a useful task until pace and evidence are connected.',
      handoffQuestion: 'Can we decide today without missing the point Sophie is raising?',
    },
    confirm_commitments: {
      errorLine: 'I can send my part later this week.',
      proofLine: 'Great, we can sort out the details in the group chat.',
      consequenceLine: 'The group is closing, but there is no dependable time or handoff.',
      handoffQuestion: 'Before we leave, can someone make the handoffs and times clear?',
    },
  },
  B: {
    clarify_direction: {
      errorLine: 'I made a plan for three ideas. We can choose one after we start.',
      proofLine: 'We could also make a short video. That might be more useful.',
      consequenceLine: 'The team is planning four possible projects and has not chosen one deliverable.',
      handoffQuestion: 'If we plan all four, which one are we truly delivering this week?',
    },
    state_preference: {
      errorLine: 'For this idea, we need research, a prototype, and a short explanation.',
      proofLine: 'I can still think of a few extra features.',
      consequenceLine: 'The plan has roles, but the learner has not said where they can contribute.',
      handoffQuestion: 'Before I fill the last box, which part would you want to own?',
    },
    clarify_scope: {
      errorLine: 'The first version could have a map, a guide, a poster, and a short video.',
      proofLine: 'I can add all four to the plan.',
      consequenceLine: 'The possible output is growing, but the four-day deadline is unchanged.',
      handoffQuestion: 'What is the one thing we must finish this week, even if the rest waits?',
    },
    invite_evidence: {
      errorLine: 'I am not sure the student survey really supports that feature.',
      proofLine: 'The feature still sounds useful to me.',
      consequenceLine: 'The concern is real but too vague to change the plan or test the idea.',
      handoffQuestion: 'Which survey point worries you, and what would it change?',
    },
    integrate_views: {
      errorLine: 'A guide and a map would help students more.',
      proofLine: 'Two full outputs may mean that neither one is finished well.',
      consequenceLine: 'Maya cannot set dates until the team chooses between usefulness and a realistic scope.',
      handoffQuestion: 'Can we keep the useful part without promising more than we can finish?',
    },
    confirm_commitments: {
      errorLine: 'The tasks are in the plan. We can add the dates in the chat.',
      proofLine: 'Who will check the survey point?',
      consequenceLine: 'The plan looks complete, but its evidence check has no owner or date.',
      handoffQuestion: 'Before we close, who owns the evidence check, the guide, and the next check-in?',
    },
  },
  C: {
    clarify_direction: {
      errorLine: 'We have enough information. Let’s choose sections and start.',
      proofLine: 'I wrote down one pattern from the interviews.',
      consequenceLine: 'Hannah’s note is still outside the decision, while Daniel is already asking for full coverage.',
      handoffQuestion: 'Are we really ready to choose without hearing Hannah’s note?',
    },
    state_preference: {
      errorLine: 'We need someone to check that the information is accurate.',
      proofLine: 'Yes, but we need to fill the roles quickly.',
      consequenceLine: 'A quality role is being named before the learner has said how they want to contribute.',
      handoffQuestion: 'Before I put someone in the last role, what part would you like to contribute?',
    },
    clarify_scope: {
      errorLine: 'The guide should cover every possible support service in detail.',
      proofLine: 'We need to decide today. We cannot research everything first.',
      consequenceLine: 'The group has no boundary for a first version that can be both useful and accurate.',
      handoffQuestion: 'What must the first version include so it is useful but still accurate?',
    },
    invite_evidence: {
      errorLine: 'I noticed one pattern in the interviews.',
      proofLine: 'We could check whether that pattern is reliable.',
      consequenceLine: 'Jordan is ready to return to roles before the useful pattern becomes part of the plan.',
      handoffQuestion: 'Which one finding would change our decision most?',
    },
    integrate_views: {
      errorLine: 'A simple demo is enough if we can show it working.',
      proofLine: 'It cannot send students to the wrong service.',
      consequenceLine: 'The team needs a small version, but it also needs a clear accuracy safeguard.',
      handoffQuestion: 'Can we make it simple without making it unreliable?',
    },
    confirm_commitments: {
      errorLine: 'We can message later about the exact times.',
      proofLine: 'I can send the interview note, but I do not know when it is needed.',
      consequenceLine: 'The evidence and quality checks depend on each other, yet neither handoff has a time.',
      handoffQuestion: 'What needs to happen first, and when should each handoff be ready?',
    },
  },
  D: {
    clarify_direction: {
      errorLine: 'I made a list. I’ll assign owners for the research, guide, video, and slides now.',
      proofLine: 'We could also add a map. It would make the project better.',
      consequenceLine: 'The list has owners, but the team has not selected one core output.',
      handoffQuestion: 'Which one is our actual core output before we assign the list?',
    },
    state_preference: {
      errorLine: 'We could help with user research, design, writing, or the demo.',
      proofLine: 'I have an empty space in the task table.',
      consequenceLine: 'The learner’s task may be chosen by the empty box rather than by their contribution preference.',
      handoffQuestion: 'Before Priya fills that space, what kind of contribution would suit you?',
    },
    clarify_scope: {
      errorLine: 'I can do research, the slides, or anything else you need.',
      proofLine: 'Great, I’ll put you on research and slides, then.',
      consequenceLine: 'Ethan has offered everything, so one friendly offer is becoming several unclear tasks.',
      handoffQuestion: 'Before I give Ethan all of that, what is one task he can really own?',
    },
    invite_evidence: {
      errorLine: 'Students need late-night help, and they also want information about every service.',
      proofLine: 'I can add both to the requirements list.',
      consequenceLine: 'Both needs are being treated as first-version requirements, so the scope is expanding again.',
      handoffQuestion: 'Which note should guide the first version, and which one can wait?',
    },
    integrate_views: {
      errorLine: 'We need one plan everyone can finish.',
      proofLine: 'I do not want to lose the good student ideas too early.',
      consequenceLine: 'The group needs a core output, but it has not decided how to save useful ideas for later.',
      handoffQuestion: 'Can we keep the useful ideas without treating all of them as work for this week?',
    },
    confirm_commitments: {
      errorLine: 'I’ll help with the slides at some point this weekend.',
      proofLine: 'The table has owners now, so I think we are done.',
      consequenceLine: 'The table looks finished, but Ethan’s work still has no trackable handoff time.',
      handoffQuestion: 'Before we close the table, what needs a real owner, time, or follow-up?',
    },
  },
}

function levelOneNodesForTeam(team: TeamDefinition): SceneNode[] {
  return levelOneNodes.map((node) => {
    const overlay = teamNodeOverlays[team.id][node.id]
    const contract = teamNodeContracts[team.id][node.id]
    const director = contract.director
    if (!director) throw new Error(`Missing director contract for ${team.id}:${node.id}`)
    const configuredNode: SceneNode = {
      ...node,
      ...levelOneBoardDetails[node.id],
      sceneCue: levelOneSceneCues[node.id],
      ...overlay,
      ...contract,
      speakerPlan: levelOneSpeakerPlans[team.id][node.id],
      director: { ...director, ...teamNodeSpeech[team.id][node.id] },
    }
    return { ...configuredNode, interactionPlan: interactionPlanForNode(team, configuredNode) }
  })
}

function levelOneCardsForTeam(team: TeamDefinition, nodes: SceneNode[]): SkillCard[] {
  const nodeForSkill = (skillId: Move) => nodes.find((node) => node.skillId === skillId)
  return levelContracts[1].cards.map((card) => {
    const node = nodeForSkill(card.id)
    if (!node?.primaryResponder || !card.signal) return card
    const lead = node.primaryResponder
    const support = node.supportingResponder || team.members.find((member) => member.id !== lead)?.id || lead
    const signalBySkill: Record<string, NonNullable<SkillCard['signal']>> = {
      read_risk: { eyebrow: 'MEETING CUE · MAIN IDEA', title: 'The group is moving before the main idea is clear.', whatIsHappening: `${lead} is moving toward tasks, but the group has not agreed on the main question.`, whyItMatters: 'The group may make separate pieces that do not fit together.', learnerObjective: 'Help the group agree on one clear direction first.' },
      enter: { eyebrow: 'MEETING CUE · YOUR TURN', title: 'The group is starting to talk about roles.', whatIsHappening: `${lead} is starting to name jobs, but your own preference is not in the plan yet.`, whyItMatters: 'You may end up with a task that does not use your strengths.', learnerObjective: 'Say what kind of work you would like to do.' },
      clarify_scope: { eyebrow: 'MEETING CUE · TASK DETAILS', title: 'A task has a name, but not clear details.', whatIsHappening: `${lead} has offered a task, but its boundary, owner, or time is still unclear.`, whyItMatters: 'People may do the same work, or miss part of the work.', learnerObjective: 'Ask one clear question about the task, owner, or time.' },
      low_request: { eyebrow: 'MEETING CUE · USEFUL INFO', title: 'Useful information is not in the plan yet.', whatIsHappening: `${lead} has mentioned a useful point, but the group is about to decide without making space for it.`, whyItMatters: 'The group may make a choice without the information it needs.', learnerObjective: `Invite ${lead} to share one useful point.` },
      paraphrase: { eyebrow: 'MEETING CUE · TWO IDEAS', title: 'The group has two useful concerns.', whatIsHappening: `${lead} and ${support} are prioritising different useful things.`, whyItMatters: 'The group needs to understand both ideas before it decides.', learnerObjective: 'Show that you understand both concerns.' },
      summarize_next: { eyebrow: 'MEETING CUE · BEFORE YOU LEAVE', title: 'The plan still needs a clear finish.', whatIsHappening: `${lead} has made a helpful offer, but an owner or time is still unclear.`, whyItMatters: 'The same problem may come back after the meeting.', learnerObjective: 'Say who will do what, by when, and what happens next.' },
    }
    return { ...card, signal: signalBySkill[card.id] || card.signal }
  })
}

export const groupLevels: Record<GroupLevel, { title: string; shortTitle: string; scene: string; skills: string[]; success: string; lockedHint: string }> = {
  1: { title: 'Level 1 · Kickoff', shortTitle: 'Kickoff', scene: 'First meeting · understand the task · agree roles', skills: ['Read collaboration signals', 'Enter the conversation', 'State a preference', 'Claim responsibility'], success: 'Leave with roles, tasks, deadlines and a next step.', lockedHint: 'Available now' },
  2: { title: 'Level 2 · Delivery', shortTitle: 'Delivery', scene: 'Progress mismatch · missing information · changing scope', skills: ['Clarify blockers', 'Ask useful follow-ups', 'Secure commitments', 'Handle disagreement'], success: 'Update the plan and confirm owners and dependencies.', lockedHint: 'Complete Level 1 to unlock' },
  3: { title: 'Level 3 · Pressure', shortTitle: 'Pressure', scene: 'Deadline pressure · rejected idea · conflict or overlooked contribution', skills: ['Advocate for yourself', 'Negotiate trade-offs', 'Repair conflict', 'Summarise a decision'], success: 'Move a fair, workable decision forward under pressure.', lockedHint: 'Complete Level 2 to unlock' },
}

export const levelContracts: Record<GroupLevel, LevelContract> = {
  1: {
    objective: 'Turn a first meeting into a shared structure, clear roles, deadlines, and a next step.',
    projectState: '0% complete · work has not started', timePressure: '4–7 days remain', relationshipState: 'Neutral · trust has not formed yet', interaction: 'Four people meeting for the first time; mostly turn-taking.', systemSupport: 'guided',
    allowedEvents: ['TASK_AMBIGUITY', 'ROLE_AMBIGUITY', 'DEADLINE_AMBIGUITY', 'LIGHT_DISAGREEMENT', 'CLOSING_WINDOW'],
    eventChain: ['TASK_AMBIGUITY', 'ROLE_AMBIGUITY', 'TASK_AMBIGUITY', 'ROLE_AMBIGUITY', 'LIGHT_DISAGREEMENT', 'DEADLINE_AMBIGUITY', 'CLOSING_WINDOW'],
    skillSequence: ['read_risk', 'enter', 'clarify_scope', 'low_request', 'paraphrase', 'summarize_next'],
    skillTriggers: {
      read_risk: 'TASK_AMBIGUITY',
      enter: 'ROLE_AMBIGUITY',
      clarify_scope: 'TASK_AMBIGUITY',
      low_request: 'ROLE_AMBIGUITY',
      paraphrase: 'LIGHT_DISAGREEMENT',
      summarize_next: 'DEADLINE_AMBIGUITY',
    },
    nodes: levelOneNodes,
    roles: groupProjectRoles,
    microFrictionLimit: { min: 2, max: 3 },
    openingDirection: 'Keep the Level 1 kickoff low-stakes and realistic. The six learning anchors remain in order: establish direction, enter with a preference, make task boundaries workable, bring useful evidence in, align two valid concerns, and close with commitments. Do not turn every anchor into a conflict. Only the selected two or three micro-frictions may become clearly visible; all other anchors should surface through ordinary ambiguity, a brief pause, or an incomplete response. Do not introduce blame, missed commitments, personal attack, emotional escalation, or a second independent problem.',
    successCriteria: ['A workable structure or direction is named', 'At least two responsibilities have named owners', 'A specific deadline or check-in is confirmed', 'The team leaves with one next step'],
    cards: [
      { id: 'read_risk', label: 'Read the room', description: 'Spot the project risk before it grows.', events: ['TASK_AMBIGUITY'], response: '', purpose: 'Pause a rushed meeting long enough to notice what is still unclear.', thoughtPrompt: 'What could become a problem if the group divides work now?', patterns: ['It sounds like ___ is still unclear.', 'I’m not sure we’ve decided who will ___.', 'One possible risk is that ___.', 'We may need to clarify ___ before we move on.'], signal: { eyebrow: 'TEAM SIGNAL · DIRECTION NOT CLEAR YET', title: 'The team is moving before the decision is ready.', whatIsHappening: 'Alex is moving toward task assignment, but the group has not agreed what the project needs to find out.', whyItMatters: 'If work is divided now, the team may produce disconnected pieces.', learnerObjective: 'Help the team name a shared direction before roles are fixed.' } },
      { id: 'enter', label: 'Enter & state a preference', description: 'Take a clear, low-pressure turn and name a contribution you value.', events: ['ROLE_AMBIGUITY'], response: '', purpose: 'Enter before roles are fixed, while making one meaningful preference visible.', patterns: ['Can I add something here?', 'I’d like to build on that idea.', 'I’d prefer ___ because ___.', 'My initial preference would be ___, mainly because ___.'], signal: { eyebrow: 'TEAM SIGNAL · YOUR CONTRIBUTION IS NOT VISIBLE YET', title: 'A visible role is being claimed before your preference enters.', whatIsHappening: 'Alex is beginning to take a visible part of the project, while your own contribution preference has not entered the plan.', whyItMatters: 'Waiting may leave you with work that does not use your strengths or interests.', learnerObjective: 'Make one meaningful preference visible before roles settle.' } },
      { id: 'clarify_scope', label: 'Clarify the task', description: 'Make the task, role, or deadline specific.', events: ['TASK_AMBIGUITY', 'DEADLINE_AMBIGUITY'], response: '', purpose: 'Turn a vague task, role, or date into something the group can act on.', patterns: ['When you say ___, do you mean ___?', 'What exactly would ___ include?', 'Can we clarify who owns each part?', 'Can we agree on a specific time?'], signal: { eyebrow: 'TEAM SIGNAL · TASK BOUNDARY IS STILL VAGUE', title: 'The group has a direction, but not a workable task structure.', whatIsHappening: 'The team knows it needs to move forward, but no one has made clear what each task should include.', whyItMatters: 'Vague roles often create duplicated work or gaps later in the project.', learnerObjective: 'Turn one vague task, role, or deadline into something the group can act on.' } },
      { id: 'low_request', label: 'Make a small request', description: 'Ask for one useful contribution without taking over.', events: ['ROLE_AMBIGUITY'], response: '', purpose: 'Bring useful information into the room with one clear, peer-level request.', patterns: ['Could you share ___ with the group?', 'Can you check ___ when you get a chance?', 'Could you add ___ to the shared document?', 'Could you send me ___? I want to check it before ___.'], signal: { eyebrow: 'TEAM SIGNAL · USEFUL EVIDENCE HAS NOT ENTERED', title: 'Sophie has information, but it has not shaped the decision.', whatIsHappening: 'Sophie has mentioned a potentially useful finding, but the group is about to decide without asking her to explain it.', whyItMatters: 'A specific invitation can bring the evidence into the plan before the group commits.', learnerObjective: 'Invite one useful contribution without taking over the conversation.' } },
      { id: 'paraphrase', label: 'Paraphrase', description: 'Check shared understanding in simple words.', events: ['LIGHT_DISAGREEMENT'], response: '', purpose: 'Show that you heard two concerns and make the shared decision clearer.', patterns: ['So you’re saying that ___.', 'If I understand you correctly, ___.', 'What I’m hearing is ___.', 'It sounds like your main concern is ___.'], signal: { eyebrow: 'TEAM SIGNAL · TWO VALID CONCERNS ARE COMPETING', title: 'The team needs alignment, not a winner.', whatIsHappening: 'Alex is focused on moving quickly, while Sophie wants the group to check the evidence before deciding.', whyItMatters: 'If each person responds only to their own concern, the group may treat a workable difference as a conflict.', learnerObjective: 'Show that you understand the concerns before helping the team decide.' } },
      { id: 'summarize_next', label: 'Capture next steps', description: 'Close with owners and a time.', events: ['DEADLINE_AMBIGUITY', 'CLOSING_WINDOW'], response: '', purpose: 'Close the meeting with a decision, an owner, a time, and one next step.', patterns: ['So far, we’ve agreed that ___.', '___ will handle ___, and I’ll take care of ___.', 'We’ll each finish our part by ___.', 'Once ___ is done, we can ___.'], signal: { eyebrow: 'TEAM SIGNAL · THE MEETING IS ABOUT TO CLOSE', title: 'The plan is forming, but at least one commitment is still vague.', whatIsHappening: 'The group has discussed direction and tasks, but a responsibility or time point has not been made specific.', whyItMatters: 'If the team leaves without recording owners and times, the same uncertainty returns later as a project risk.', learnerObjective: 'Close with a decision, an owner, a time, and one clear next step.' } },
    ],
    signals: [
      { person: 'Alex', title: 'Alex is already moving toward roles. What helps the team most right now?', options: ['Pause task assignment briefly so each member can add what they know.', 'Let Alex assign everything so the meeting ends quickly.', 'Wait until Alex asks you a direct question.'], correct: 0, evidence: 'Alex is creating momentum, but the group has not yet agreed on a direction or heard every useful input.' },
      { person: 'Sophie', title: 'Sophie mentions information that may change the project direction. What is the most useful next action?', options: ['Invite Sophie to explain the information before the team decides.', 'Leave the information until after all roles are assigned.', 'Give Sophie an easy task without asking about the information.'], correct: 0, evidence: 'A specific invitation gives useful evidence a place in the decision.' },
      { person: 'Ryan', title: 'Ryan says he can “help with whatever is needed” but is “a little busy.” What should be clarified?', options: ['What he can own and exactly when he can deliver it.', 'Nothing—being flexible is enough for now.', 'Whether he should leave the group.'], correct: 0, evidence: 'Scope and timing are still missing; making them explicit prevents a hidden project risk.' },
    ],
  },
  2: {
    objective: 'Recover a project at about 55% by resolving a dependency and resetting a realistic plan.',
    projectState: '55% complete · one visible output is finished and one dependency is blocked', timePressure: 'A fixed deadline remains, with limited room to adjust', relationshipState: 'Light friction · collaboration is still possible', interaction: 'Overlapping talk, a quiet member, and a strong voice compete for attention.', systemSupport: 'selective',
    allowedEvents: ['DEPENDENCY_BLOCKED', 'MISSING_INFORMATION', 'SCOPE_CHANGE', 'SILENT_MEMBER', 'DOMINANT_MEMBER', 'OVERLAPPING_TALK', 'TANGENT', 'HIGH_IMPOSITION_REQUEST', 'PLAN_UPDATE'],
    eventChain: ['DEPENDENCY_BLOCKED', 'OVERLAPPING_TALK', 'SILENT_MEMBER', 'HIGH_IMPOSITION_REQUEST', 'PLAN_UPDATE'],
    openingDirection: 'Start with one completed board item and one blocked dependency. Show both task pressure and interaction pressure: Alex tries to accelerate, Sophie has not had a clear entry, and Ryan is unclear about a handoff. No one is malicious. The team needs the learner to decide what to handle first.',
    successCriteria: ['The blocked dependency is named and given a recovery path', 'The plan names owners, deliverables, dependencies, and a new time', 'Participation is balanced enough for Sophie’s information to enter the plan'],
    cards: [
      { id: 'bridge_views', label: 'Bridge viewpoints', description: 'Connect two valid concerns into one decision.', events: ['OVERLAPPING_TALK', 'SCOPE_CHANGE'], response: 'I hear that Alex wants to keep moving and Sophie wants the evidence checked. Can we use the evidence to choose what to cut?' },
      { id: 'probe_commitment', label: 'Probe a commitment', description: 'Turn a vague promise into a concrete handoff.', events: ['MISSING_INFORMATION', 'HIGH_IMPOSITION_REQUEST'], response: 'Ryan, what can you send, in what format, and by what time?' },
      { id: 'balance_floor', label: 'Balance the floor', description: 'Slow overlapping talk and make space for one voice.', events: ['OVERLAPPING_TALK', 'DOMINANT_MEMBER'], response: 'Could we take one point at a time? I want to hear Sophie’s evidence before we decide.' },
      { id: 'invite_quiet', label: 'Invite the quiet voice', description: 'Give a specific member a useful entry point.', events: ['SILENT_MEMBER', 'DEPENDENCY_BLOCKED'], response: 'Sophie, your notes affect the blocked section. What is the one finding we need to plan around?' },
      { id: 'interrupt_refocus', label: 'Interrupt and refocus', description: 'Bring the group back to the dependency that blocks delivery.', events: ['TANGENT', 'OVERLAPPING_TALK'], response: 'Can I pause us for a second? The decision we need first is what unblocks the next deliverable.' },
      { id: 'update_dependencies', label: 'Update the plan', description: 'Name owner, deliverable, dependency, and time.', events: ['DEPENDENCY_BLOCKED', 'PLAN_UPDATE'], response: 'Let’s update the board: who owns the blocked item, what do they need, and when will the handoff happen?' },
      { id: 'negotiate_option', label: 'Negotiate an alternative', description: 'Offer a realistic trade-off instead of accepting an unfair request.', events: ['HIGH_IMPOSITION_REQUEST', 'SCOPE_CHANGE'], response: 'I can take part of that, but not the whole extra section. Could we reduce the scope and split the remaining work by tonight?' },
    ],
    signals: [
      { person: 'Project risk', title: 'What needs attention before the team chooses a new deadline?', options: ['The blocked evidence handoff, because the next task depends on it.', 'The colour of the final slides.', 'Whether everyone agrees with the first idea immediately.'], correct: 0, evidence: 'A recovery plan cannot be real until the dependency that blocks later work is visible.' },
      { person: 'Participation', title: 'Two people start talking over Sophie. What helps the project most?', options: ['Pause the overlap and invite Sophie to give the evidence the plan depends on.', 'Let the fastest speakers decide to save time.', 'Ask Sophie to send her thoughts after the meeting.'], correct: 0, evidence: 'The quiet member’s information is directly connected to the delivery risk.' },
      { person: 'Commitment', title: 'Ryan says he can “try to send something later.” What should the group ask?', options: ['What he can send, in which format, and by what time.', 'Whether he feels generally positive about helping.', 'Whether Alex can do all of Ryan’s work instead.'], correct: 0, evidence: 'A usable recovery plan needs a concrete owner, deliverable, and handoff time.' },
    ],
  },
  3: {
    objective: 'Make a fair, executable decision near submission while repairing enough trust to continue working.',
    projectState: '82% complete · the original plan cannot all be finished in time', timePressure: 'Submission is imminent; today’s decision directly affects the deliverable', relationshipState: 'Trust is under pressure: missed commitments, attribution, defensiveness, or hurt may surface', interaction: 'Multiple people are off balance; alliance, avoidance, or repeated dominance can appear.', systemSupport: 'replay',
    allowedEvents: ['MISSED_COMMITMENT', 'TRUTH_BATTLE', 'INTENT_ATTRIBUTION', 'BLAME_LOOP', 'IDENTITY_THREAT', 'FEELING_EXPRESSION', 'REPEATED_CONCERN', 'UNRESOLVED_CONFLICT', 'DOMINANT_MEMBER', 'FAIR_RECOMMITMENT', 'PREVENTION_PLAN'],
    eventChain: ['MISSED_COMMITMENT', 'TRUTH_BATTLE', 'BLAME_LOOP', 'FEELING_EXPRESSION', 'FAIR_RECOMMITMENT', 'PREVENTION_PLAN'],
    openingDirection: 'A high-consequence gap has appeared near the deadline. Let it create a chain: work is blocked, then people interpret what happened, then defensiveness or hurt appears. Do not write anyone as cruel. The learner cannot pass by volunteering to do all the remaining work; the group must make a fair redistribution, explicit commitments, and one prevention measure.',
    successCriteria: ['Scope is reduced or a key gap is repaired through a fair redistribution', 'The group distinguishes impact from intention and lowers defensiveness', 'Every remaining task has a named, realistic commitment', 'The group creates one prevention measure for the next handoff'],
    cards: [
      { id: 'advocate_fairness', label: 'Advocate fairly', description: 'State a boundary and propose a workable distribution.', events: ['MISSED_COMMITMENT', 'FAIR_RECOMMITMENT'], response: 'I want to help us finish, but I cannot take the whole missing section. Can we divide the remaining work by capacity and cut one non-essential piece?' },
      { id: 'separate_impact_intent', label: 'Separate impact from intent', description: 'Name what happened without claiming why it happened.', events: ['INTENT_ATTRIBUTION', 'BLAME_LOOP'], response: 'I do not want to assume anyone’s intention. The impact is that the missing evidence has left the draft unsupported.' },
      { id: 'acknowledge_feeling', label: 'Acknowledge the feeling', description: 'Recognise pressure without accepting blame that is not yours.', events: ['FEELING_EXPRESSION', 'IDENTITY_THREAT'], response: 'I can hear that this feels frustrating and unfair. I think we can address that while still making a concrete plan.' },
      { id: 'third_story', label: 'Third Story', description: 'Describe the difference neutrally before taking sides.', events: ['TRUTH_BATTLE', 'UNRESOLVED_CONFLICT'], response: 'It sounds like Alex is focused on submitting something complete, while Sophie is focused on not making a claim the evidence cannot support.' },
      { id: 'contribution_repair', label: 'Repair contributions', description: 'Shift from blame to what each person can now contribute.', events: ['BLAME_LOOP', 'MISSED_COMMITMENT'], response: 'Rather than deciding who is at fault, can we list what each of us can realistically complete before submission?' },
      { id: 'name_dynamic', label: 'Name the dynamic', description: 'Point out when the group is stuck in an unhelpful pattern.', events: ['DOMINANT_MEMBER', 'REPEATED_CONCERN'], response: 'We are repeating the same argument and some voices are not getting in. Can we pause and decide the remaining work first?' },
      { id: 'repair_commitment', label: 'Repair and recommit', description: 'Close with fairness, deadlines, and a prevention step.', events: ['FAIR_RECOMMITMENT', 'PREVENTION_PLAN'], response: 'Let’s write the revised owners and times now, and add a check-in so a missing handoff is visible before the final hour.' },
    ],
    signals: [
      { person: 'Task and relationship', title: 'A key section is missing and the group begins blaming each other. What is the most useful first move?', options: ['Name the delivery impact without assuming anyone’s intention.', 'Choose who is most at fault before discussing the work.', 'Offer to complete all remaining work yourself.'], correct: 0, evidence: 'The team needs to move from attribution to the concrete impact and a fair repair plan.' },
      { person: 'Fairness', title: 'Alex asks you to absorb the missing work because you are “good at it.” What protects both delivery and fairness?', options: ['Set a boundary, propose a capacity-based split, and reduce non-essential scope.', 'Accept everything so the team stops arguing.', 'Refuse to discuss the missing work.'], correct: 0, evidence: 'Level 3 is not solved by one person rescuing the group; it needs a workable redistribution.' },
      { person: 'Prevention', title: 'The team has a new task split. What still needs to be added before you close?', options: ['A check-in or handoff rule that catches problems before the next deadline.', 'A promise that no one will ever make a mistake again.', 'A longer discussion of who was right.'], correct: 0, evidence: 'A prevention measure turns a one-time repair into a more reliable way of working.' },
    ],
  },
}

export const domains: Record<Domain, { label: string; project: string; brief: string; board: BoardItem[] }> = {
  business: {
    label: 'Business analytics', project: 'Campus café growth strategy',
    brief: 'Recommend one practical growth strategy for the campus café using survey and sales data.',
    board: [
      { id: 'research', label: 'Market research', owner: 'Unassigned', due: 'Fri 5:00 PM', status: 'open' },
      { id: 'analysis', label: 'Data analysis', owner: 'Unassigned', due: 'Fri 5:00 PM', status: 'open' },
      { id: 'slides', label: 'Slide narrative', owner: 'Unassigned', due: 'Sun 6:00 PM', status: 'open' },
      { id: 'pitch', label: 'Final pitch', owner: 'Unassigned', due: 'Mon 10:00 AM', status: 'open' },
    ],
  },
  computing: {
    label: 'Computer science', project: 'Student wellbeing prototype',
    brief: 'Build and demo a low-fidelity prototype that helps students find campus support quickly.',
    board: [
      { id: 'requirements', label: 'User requirements', owner: 'Unassigned', due: 'Thu 6:00 PM', status: 'open' },
      { id: 'prototype', label: 'Prototype build', owner: 'Unassigned', due: 'Sat 4:00 PM', status: 'open' },
      { id: 'testing', label: 'Usability testing', owner: 'Unassigned', due: 'Sun 3:00 PM', status: 'open' },
      { id: 'demo', label: 'Demo & documentation', owner: 'Unassigned', due: 'Mon 10:00 AM', status: 'open' },
    ],
  },
  humanities: {
    label: 'Humanities', project: 'Stories of the campus neighbourhood',
    brief: 'Develop a comparative argument about how local histories shape student life today.',
    board: [
      { id: 'sources', label: 'Source reading', owner: 'Unassigned', due: 'Thu 6:00 PM', status: 'open' },
      { id: 'argument', label: 'Argument map', owner: 'Unassigned', due: 'Fri 5:00 PM', status: 'open' },
      { id: 'draft', label: 'Draft & editing', owner: 'Unassigned', due: 'Sun 4:00 PM', status: 'open' },
      { id: 'seminar', label: 'Seminar presentation', owner: 'Unassigned', due: 'Mon 10:00 AM', status: 'open' },
    ],
  },
  law_policy: {
    label: 'Law & public policy', project: 'Campus policy recommendation', brief: 'Develop an evidence-based recommendation for a campus policy decision.',
    board: [
      { id: 'authority', label: 'Authorities & sources', owner: 'Unassigned', due: 'Thu 6:00 PM', status: 'open' },
      { id: 'framing', label: 'Issue framing', owner: 'Unassigned', due: 'Fri 5:00 PM', status: 'open' },
      { id: 'risk', label: 'Counterargument & risk', owner: 'Unassigned', due: 'Sun 3:00 PM', status: 'open' },
      { id: 'recommendation', label: 'Oral recommendation', owner: 'Unassigned', due: 'Mon 10:00 AM', status: 'open' },
    ],
  },
  social_science: {
    label: 'Social science', project: 'Student experience mini-study', brief: 'Design a small study and present an evidence-based recommendation about student experience.',
    board: [
      { id: 'question', label: 'Research question', owner: 'Unassigned', due: 'Thu 6:00 PM', status: 'open' },
      { id: 'method', label: 'Method & ethics', owner: 'Unassigned', due: 'Fri 5:00 PM', status: 'open' },
      { id: 'analysis', label: 'Analysis', owner: 'Unassigned', due: 'Sun 2:00 PM', status: 'open' },
      { id: 'interpretation', label: 'Interpretation & limits', owner: 'Unassigned', due: 'Mon 10:00 AM', status: 'open' },
    ],
  },
  education: {
    label: 'Education', project: 'Student learning support intervention', brief: 'Create a practical learning-support intervention for a real campus need.',
    board: [
      { id: 'needs', label: 'Learner needs', owner: 'Unassigned', due: 'Thu 6:00 PM', status: 'open' },
      { id: 'design', label: 'Lesson / intervention design', owner: 'Unassigned', due: 'Fri 5:00 PM', status: 'open' },
      { id: 'assessment', label: 'Assessment evidence', owner: 'Unassigned', due: 'Sun 2:00 PM', status: 'open' },
      { id: 'facilitation', label: 'Facilitation plan', owner: 'Unassigned', due: 'Mon 10:00 AM', status: 'open' },
    ],
  },
  creative_media: {
    label: 'Media & design', project: 'Campus voices media project', brief: 'Create an evidence-led media or design response about student belonging.',
    board: [
      { id: 'audience', label: 'Audience insight', owner: 'Unassigned', due: 'Thu 6:00 PM', status: 'open' },
      { id: 'concept', label: 'Concept & narrative', owner: 'Unassigned', due: 'Fri 5:00 PM', status: 'open' },
      { id: 'assets', label: 'Production assets', owner: 'Unassigned', due: 'Sun 2:00 PM', status: 'open' },
      { id: 'launch', label: 'Critique & launch', owner: 'Unassigned', due: 'Mon 10:00 AM', status: 'open' },
    ],
  },
  data_science: {
    label: 'Data & quantitative research', project: 'Campus wellbeing data dashboard', brief: 'Use anonymised survey data to create a useful, responsible campus insight.',
    board: [
      { id: 'definition', label: 'Problem & assumptions', owner: 'Unassigned', due: 'Thu 6:00 PM', status: 'open' },
      { id: 'data', label: 'Data & validation', owner: 'Unassigned', due: 'Fri 5:00 PM', status: 'open' },
      { id: 'analysis', label: 'Analysis', owner: 'Unassigned', due: 'Sun 2:00 PM', status: 'open' },
      { id: 'story', label: 'Interpretation & visual story', owner: 'Unassigned', due: 'Mon 10:00 AM', status: 'open' },
    ],
  },
  natural_science: {
    label: 'Natural science', project: 'Campus research poster study', brief: 'Develop a feasible research study and a careful interpretation of its evidence.',
    board: [
      { id: 'question', label: 'Research question', owner: 'Unassigned', due: 'Thu 6:00 PM', status: 'open' },
      { id: 'protocol', label: 'Protocol & safety', owner: 'Unassigned', due: 'Fri 5:00 PM', status: 'open' },
      { id: 'data', label: 'Data & analysis', owner: 'Unassigned', due: 'Sun 2:00 PM', status: 'open' },
      { id: 'discussion', label: 'Discussion & limits', owner: 'Unassigned', due: 'Mon 10:00 AM', status: 'open' },
    ],
  },
  engineering: {
    label: 'Engineering & built environment', project: 'Sustainable study-space prototype', brief: 'Design and justify a practical prototype that improves a shared campus study space.',
    board: [
      { id: 'constraints', label: 'Requirements & constraints', owner: 'Unassigned', due: 'Thu 6:00 PM', status: 'open' },
      { id: 'design', label: 'Design & calculations', owner: 'Unassigned', due: 'Fri 5:00 PM', status: 'open' },
      { id: 'prototype', label: 'Prototype / simulation', owner: 'Unassigned', due: 'Sun 2:00 PM', status: 'open' },
      { id: 'verification', label: 'Verification & recommendation', owner: 'Unassigned', due: 'Mon 10:00 AM', status: 'open' },
    ],
  },
  health: {
    label: 'Health & wellbeing', project: 'Campus health intervention', brief: 'Develop a safe, evidence-informed intervention for a campus health need.',
    board: [
      { id: 'assessment', label: 'Case / population assessment', owner: 'Unassigned', due: 'Thu 6:00 PM', status: 'open' },
      { id: 'evidence', label: 'Evidence & safety', owner: 'Unassigned', due: 'Fri 5:00 PM', status: 'open' },
      { id: 'plan', label: 'Intervention plan', owner: 'Unassigned', due: 'Sun 2:00 PM', status: 'open' },
      { id: 'handover', label: 'Handover & reflection', owner: 'Unassigned', due: 'Mon 10:00 AM', status: 'open' },
    ],
  },
  environment: {
    label: 'Environment & food systems', project: 'Campus sustainability systems proposal', brief: 'Develop a feasible, evidence-led response to a campus sustainability challenge.',
    board: [
      { id: 'diagnosis', label: 'Site / system diagnosis', owner: 'Unassigned', due: 'Thu 6:00 PM', status: 'open' },
      { id: 'stakeholders', label: 'Evidence & stakeholder needs', owner: 'Unassigned', due: 'Fri 5:00 PM', status: 'open' },
      { id: 'intervention', label: 'Intervention design', owner: 'Unassigned', due: 'Sun 2:00 PM', status: 'open' },
      { id: 'impact', label: 'Impact & implementation', owner: 'Unassigned', due: 'Mon 10:00 AM', status: 'open' },
    ],
  },
  services: {
    label: 'Services & operations', project: 'Campus service improvement plan', brief: 'Develop an operational plan that improves a student-facing campus service.',
    board: [
      { id: 'journey', label: 'User journey', owner: 'Unassigned', due: 'Thu 6:00 PM', status: 'open' },
      { id: 'operations', label: 'Operations & resources', owner: 'Unassigned', due: 'Fri 5:00 PM', status: 'open' },
      { id: 'risk', label: 'Risk & contingency', owner: 'Unassigned', due: 'Sun 2:00 PM', status: 'open' },
      { id: 'briefing', label: 'Delivery briefing', owner: 'Unassigned', due: 'Mon 10:00 AM', status: 'open' },
    ],
  },
}

const courseContext: Record<Domain, { course: string; output: string }> = {
  business: { course: 'Applied Business Strategy', output: 'evidence-based recommendation and short pitch' },
  law_policy: { course: 'Public Policy Workshop', output: 'policy recommendation and oral briefing' },
  social_science: { course: 'Research Methods', output: 'mini-study and evidence-based recommendation' },
  education: { course: 'Learning Design', output: 'learner-support intervention plan' },
  humanities: { course: 'Humanities Seminar', output: 'comparative argument and seminar presentation' },
  creative_media: { course: 'Media Campaign Lab', output: 'creative concept, production assets, and launch rationale' },
  data_science: { course: 'Applied Data Analytics', output: 'campus insight dashboard and interpretation' },
  natural_science: { course: 'Research Methods Lab', output: 'research poster with a careful discussion of findings' },
  computing: { course: 'Human-Centred Computing', output: 'prototype demo and concise technical documentation' },
  engineering: { course: 'Engineering Design Studio', output: 'prototype or simulation and technical recommendation' },
  health: { course: 'Public Health Practice', output: 'safe intervention plan and handover briefing' },
  environment: { course: 'Sustainability Systems', output: 'systems proposal with an implementation plan' },
  services: { course: 'Service Operations', output: 'operational improvement plan and delivery briefing' },
}

const studentFacingTask: Record<Domain, { project: string; brief: string; output: string }> = {
  business: { project: 'Campus service plan', brief: 'Use student feedback and simple data. Find one campus problem and suggest one useful change.', output: 'short plan and class presentation' },
  law_policy: { project: 'Student housing policy', brief: 'Read the current rule and student feedback. Suggest one fair change to the policy.', output: 'short policy plan and class talk' },
  social_science: { project: 'Late-night library study', brief: 'Use student comments and short observations. Find one problem and suggest one change.', output: 'short study report and class presentation' },
  education: { project: 'First-year writing workshop', brief: 'Use tutor feedback and student answers. Plan one workshop that helps students write essays.', output: 'workshop plan and class presentation' },
  humanities: { project: 'Bilingual campus signs', brief: 'Look at campus signs and student comments. Explain how the signs help students find services and feel welcome.', output: 'short argument and class presentation' },
  creative_media: { project: 'New student arrival campaign', brief: 'Use new student feedback. Make a clear campaign that explains arrival steps.', output: 'campaign idea and class presentation' },
  data_science: { project: 'Late-night study data', brief: 'Use simple campus data. Find one clear pattern in late-night study stress.', output: 'simple dashboard and short explanation' },
  natural_science: { project: 'Library air study', brief: 'Compare air, room use, and student comfort in three library spaces.', output: 'research poster and short presentation' },
  computing: { project: 'Late-night student help tool', brief: 'Use student interviews and website checks. Design a simple tool that helps students find support after 6 PM.', output: 'simple prototype and short guide' },
  engineering: { project: 'Quiet study-space prototype', brief: 'Design a simple idea that saves energy in a study space without making it less comfortable.', output: 'prototype idea and short recommendation' },
  health: { project: 'Student wellbeing support', brief: 'Use student feedback and campus data. Plan one safe way to help first-year students ask for help earlier.', output: 'support plan and short presentation' },
  environment: { project: 'Reusable cup return plan', brief: 'Use café waste data and student feedback. Plan one way to help more students return reusable cups.', output: 'short plan and class presentation' },
  services: { project: 'International help-desk plan', brief: 'Use queue data and student feedback. Find one way to reduce waiting time at the help desk.', output: 'service plan and short presentation' },
}

const plainLevelOneSignals: Record<string, NonNullable<SkillCard['signal']>> = {
  read_risk: { eyebrow: 'MEETING CUE · MAIN IDEA', title: 'The group is moving before the main idea is clear.', whatIsHappening: 'Alex wants to split the work, but the group has not agreed on the main question.', whyItMatters: 'The group may make separate pieces that do not fit together.', learnerObjective: 'Help the group agree on one clear direction first.' },
  enter: { eyebrow: 'MEETING CUE · YOUR TURN', title: 'The group is starting to talk about roles.', whatIsHappening: 'Other people are starting to name jobs, but your own preference is not in the plan yet.', whyItMatters: 'You may end up with a task that does not use your strengths.', learnerObjective: 'Say what kind of work you would like to do.' },
  clarify_scope: { eyebrow: 'MEETING CUE · TASK DETAILS', title: 'A task has a name, but not clear details.', whatIsHappening: 'The group has named jobs, but no one has said what each job includes.', whyItMatters: 'People may do the same work, or miss part of the work.', learnerObjective: 'Ask one clear question about the task, owner, or time.' },
  low_request: { eyebrow: 'MEETING CUE · USEFUL INFO', title: 'Sophie has useful information that is not in the plan yet.', whatIsHappening: 'Sophie mentioned a useful point, but the group is about to decide without asking about it.', whyItMatters: 'The group may make a choice without the information it needs.', learnerObjective: 'Invite Sophie to share one useful point.' },
  paraphrase: { eyebrow: 'MEETING CUE · TWO IDEAS', title: 'The group has two useful concerns.', whatIsHappening: 'Alex wants to move quickly. Sophie wants to check the evidence first.', whyItMatters: 'The group needs to understand both ideas before it decides.', learnerObjective: 'Show that you understand both concerns.' },
  summarize_next: { eyebrow: 'MEETING CUE · BEFORE YOU LEAVE', title: 'The plan still needs a clear finish.', whatIsHappening: 'The group has ideas and tasks, but at least one person or time is still unclear.', whyItMatters: 'The same problem may come back after the meeting.', learnerObjective: 'Say who will do what, by when, and what happens next.' },
}

function studentFriendlyContract(contract: LevelContract, level: GroupLevel): LevelContract {
  if (level !== 1) return contract
  return { ...contract, cards: contract.cards.map((card) => ({ ...card, signal: plainLevelOneSignals[card.id] || card.signal })) }
}

const majorPreviewMetadata: Record<Domain, { cluster: string; examples: string[]; output: string }> = {
  business: { cluster: 'Business, management & entrepreneurship', examples: ['Business', 'Finance', 'Accounting', 'Marketing', 'Economics', 'Management'], output: 'Evidence-based recommendation and short pitch' },
  law_policy: { cluster: 'Law, public policy & international relations', examples: ['Law', 'Criminology', 'Public Policy', 'Politics', 'International Relations'], output: 'Policy recommendation and oral briefing' },
  social_science: { cluster: 'Social & behavioural sciences', examples: ['Psychology', 'Sociology', 'Anthropology', 'Human Geography', 'Communication Studies'], output: 'Mini-study and evidence-based recommendation' },
  education: { cluster: 'Education & language education', examples: ['Education', 'TESOL', 'Early Childhood Education', 'Special Education', 'English Language Teaching'], output: 'Learner-support intervention plan' },
  humanities: { cluster: 'Humanities, languages & area studies', examples: ['English', 'English Literature', 'Applied Linguistics', 'Linguistics', 'History', 'Philosophy'], output: 'Comparative argument and seminar presentation' },
  creative_media: { cluster: 'Media, design & creative industries', examples: ['Journalism', 'Media Studies', 'Film', 'Graphic Design', 'UX Design', 'Fashion'], output: 'Creative concept, production assets, and launch rationale' },
  data_science: { cluster: 'Mathematics, statistics & data science', examples: ['Data Science', 'Statistics', 'Mathematics', 'Actuarial Science', 'Bioinformatics'], output: 'Campus insight dashboard and interpretation' },
  natural_science: { cluster: 'Natural sciences & experimental research', examples: ['Biology', 'Chemistry', 'Physics', 'Biochemistry', 'Earth Science'], output: 'Research poster with a careful discussion of findings' },
  computing: { cluster: 'Computing, information & digital products', examples: ['Computer Science', 'Software Engineering', 'Information Systems', 'Cybersecurity', 'Artificial Intelligence'], output: 'Prototype demo and concise technical documentation' },
  engineering: { cluster: 'Engineering, manufacturing & built environment', examples: ['Mechanical Engineering', 'Civil Engineering', 'Electrical Engineering', 'Architecture', 'Construction'], output: 'Prototype or simulation and technical recommendation' },
  health: { cluster: 'Health, medicine & life services', examples: ['Medicine', 'Nursing', 'Pharmacy', 'Public Health', 'Physiotherapy', 'Nutrition'], output: 'Safe intervention plan and handover briefing' },
  environment: { cluster: 'Agriculture, environment & food systems', examples: ['Environmental Science', 'Sustainability', 'Agriculture', 'Forestry', 'Veterinary Science', 'Food Science'], output: 'Systems proposal with an implementation plan' },
  services: { cluster: 'Services, tourism, logistics & safety', examples: ['Hospitality', 'Tourism', 'Sport Management', 'Logistics', 'Aviation', 'Occupational Safety'], output: 'Operational improvement plan and delivery briefing' },
}

function matchedMajorDomain(major: string): Domain | null {
  const value = major.trim().toLowerCase()
  if (!value) return null
  if (/(law|legal|criminology|politic|international relation|public policy|public administration)/.test(value)) return 'law_policy'
  if (/(education|tesol|teaching|curriculum|early childhood|special education)/.test(value)) return 'education'
  if (/(psychology|neuroscience|sociology|anthropology|geography|communication stud|social research)/.test(value)) return 'social_science'
  if (/(journalism|media|film|advertising|graphic design|ux|ui |fashion|music|theatre|visual design)/.test(value)) return 'creative_media'
  if (/(bioinformatics|computational biology|data science|data analytics|statistics|mathematics|actuarial|operations research|quantitative)/.test(value)) return 'data_science'
  if (/(biology|chemistry|physics|astronomy|biochemistry|earth science)/.test(value)) return 'natural_science'
  if (/(computer|software|informatics|cybersecurity|information systems|coding|artificial intelligence|\bai\b)/.test(value)) return 'computing'
  if (/(engineering|architecture|construction|manufacturing|industrial design)/.test(value)) return 'engineering'
  if (/(medicine|nursing|pharmacy|public health|physiotherapy|nutrition|dentistry|occupational therapy)/.test(value)) return 'health'
  if (/(agriculture|forestry|fisher|veterinary|food science|horticulture|environment|sustainability)/.test(value)) return 'environment'
  if (/(hospitality|tourism|sport|logistics|aviation|occupational safety|security)/.test(value)) return 'services'
  if (/(\benglish\b|literature|philosophy|linguistics|language|classics|theology|history|cultural)/.test(value)) return 'humanities'
  if (/(business|finance|accounting|marketing|economics|management|entrepreneur)/.test(value)) return 'business'
  return null
}

export function resolveMajorDomain(major: string): Domain {
  return matchedMajorDomain(major) || 'business'
}

export function majorMappingPreview(major: string) {
  const domain = matchedMajorDomain(major)
  if (!domain) return null
  const metadata = majorPreviewMetadata[domain]
  const inputTokens: string[] = major.toLowerCase().match(/[a-z]+/g) ?? []
  const closestExample = metadata.examples.reduce<string>((best, candidate) => {
    const candidateTokens: string[] = candidate.toLowerCase().match(/[a-z]+/g) ?? []
    const sharedTokens = candidateTokens.filter((token) => inputTokens.includes(token)).length
    const candidateScore = sharedTokens * 50 + (major.toLowerCase().includes(candidate.toLowerCase()) ? 35 : 0) + candidateTokens.length
    const bestTokens: string[] = best.toLowerCase().match(/[a-z]+/g) ?? []
    const bestSharedTokens = bestTokens.filter((token) => inputTokens.includes(token)).length
    const bestScore = bestSharedTokens * 50 + (major.toLowerCase().includes(best.toLowerCase()) ? 35 : 0) + bestTokens.length
    return candidateScore > bestScore ? candidate : best
  }, metadata.examples[0] ?? major)
  return { domain, ...metadata, closestExample }
}

export const opening: Message[] = [
  { id: 1, speaker: 'Alex', time: '00:04', text: 'Hey everyone. I looked at the brief, and I think we should divide the sections quickly so we can get moving.' },
  { id: 2, speaker: 'Ryan', time: '00:12', text: 'Sounds good! I can probably help with whatever is needed. This week is a little busy, but I’m flexible.' },
  { id: 3, speaker: 'Sophie', time: '00:20', text: 'I found the course data folder already. There are a few things in it that might affect the direction we take.' },
  { id: 4, speaker: 'Alex', time: '00:29', text: 'Great. I can lead the presentation. We can sort out the details as we go.' },
]

export function openingForLevel(level: GroupLevel, team: TeamDefinition = groupProjectTeam('A')): Message[] {
  if (level === 2) return [
    { id: 21, speaker: 'Alex', time: '00:04', text: 'We are behind on the first draft. I think we should cut one section and move on.' },
    { id: 22, speaker: 'Ryan', time: '00:12', text: 'I have some of the analysis, but I am not sure which version of the question we are using now.' },
    { id: 23, speaker: 'Sophie', time: '00:20', text: 'The data does not support one of the claims in the current outline. I have notes, but I have not sent them yet.' },
    { id: 24, speaker: 'Alex', time: '00:29', text: 'Okay, let’s not get stuck in details. Can everyone just finish their part this weekend?' },
  ]
  if (level === 3) return [
    { id: 31, speaker: 'Alex', time: '00:04', text: 'The deadline is tomorrow. I think we should keep the current plan and avoid changing anything major.' },
    { id: 32, speaker: 'Ryan', time: '00:12', text: 'I can finish my section, but I cannot also take on the missing evidence tonight.' },
    { id: 33, speaker: 'Sophie', time: '00:20', text: 'The current conclusion overstates what our data can show. I am worried about presenting it that way.' },
    { id: 34, speaker: 'Alex', time: '00:29', text: 'We do not have time to reopen the whole argument. Let’s just divide what is left.' },
  ]
  const nodes = levelOneNodesForTeam(team)
  const firstNode = nodes[0]
  const lead = firstNode.primaryResponder
  const support = firstNode.supportingResponder || team.members[1]?.id || lead
  const third = team.members.find((member) => member.id !== lead && member.id !== support)?.id || support
  return [
    { id: 1, speaker: lead, time: '00:04', text: firstNode.entryLine },
    { id: 2, speaker: third, time: '00:12', text: `${third} is ready to help, but waits for the group to make the first decision clear.` },
    { id: 3, speaker: support, time: '00:20', text: `${support} has one useful point to add, but does not take over the discussion.` },
    { id: 4, speaker: lead, time: '00:29', text: 'What do you think we should agree before we divide the work?' },
  ]
}

export const personalities = levelContracts[1].signals

export function signalsForLevel(level: GroupLevel, microFrictionPlan: MicroFriction[] = [], team: TeamDefinition = groupProjectTeam('A')): SignalQuestion[] {
  if (level !== 1) return levelContracts[level].signals

  const openingFriction = microFrictionPlan.find((friction) => friction.nodeId === 'clarify_direction')
  const firstNode = levelOneNodesForTeam(team)[0]
  const lead = firstNode.primaryResponder
  const support = firstNode.supportingResponder || team.members[1]?.id || lead
  const directionSignal: SignalQuestion = openingFriction?.id === 'rushed_direction' || openingFriction?.id === 'rush_before_input'
    ? {
        person: lead,
        title: 'What needs attention before the group divides the work?',
        options: ['Agree on the main direction', 'Choose presentation colours', 'Write the final conclusion'],
        correct: 0,
        evidence: 'Alex is creating momentum, but the group has not agreed on one shared direction yet.',
      }
    : {
        person: lead,
        title: 'What is the first decision the group still needs to make?',
        options: ['The main direction', 'The final grade', 'The last slide'],
        correct: 0,
        evidence: 'The group needs a shared direction before anyone takes a role.',
      }

  return [
    directionSignal,
    {
      person: support,
      title: 'What should the group hear before it settles the direction?',
      options: ['One useful fact or note', 'A finished draft', 'A new deadline'],
      correct: 0,
      evidence: 'A small piece of evidence can help the group make a better first decision.',
    },
  ]
}

export function userMoveText(move: Move, board: BoardItem[], input: string) {
  const openTask = board.find((item) => item.status === 'open')
  return input || {
    read_risk: 'I notice we are close to assigning work before we agree on the structure. Could we settle that first?',
    enter: 'Could I add one point before we divide the work? I would like to take a meaningful part of the project once we agree on the structure.',
    clarify_scope: 'Before we assign this, could we be specific about the task, owner, and first deadline?',
    low_request: 'Sophie, could you share the key point from the folder before we decide?',
    paraphrase: 'So we agree the evidence should shape the direction before we split the sections, right?',
    summarize_next: 'Let me check that we have one owner for each task and a time for the first update.',
    bridge_views: 'I hear that we want to keep moving, and that the evidence needs checking. Can we use it to choose what to cut?',
    probe_commitment: 'What can you send, in what format, and by what time?',
    balance_floor: 'Could we take one point at a time? I want to hear the evidence before we decide.',
    invite_quiet: 'Sophie, your notes affect the blocked section. What is the one finding we need to plan around?',
    interrupt_refocus: 'Can I pause us for a second? The decision we need first is what unblocks the next deliverable.',
    update_dependencies: 'Let’s update the board: who owns the blocked item, what do they need, and when will the handoff happen?',
    negotiate_option: `I can take part of ${openTask?.label.toLowerCase() ?? 'that task'}, but not the whole extra section. Could we reduce the scope and split the remaining work?`,
    advocate_fairness: 'I want to help us finish, but I cannot take the whole missing section. Can we divide the remaining work by capacity and cut one non-essential piece?',
    separate_impact_intent: 'I do not want to assume anyone’s intention. The impact is that the missing evidence has left the draft unsupported.',
    acknowledge_feeling: 'I can hear that this feels frustrating and unfair. I think we can address that while still making a concrete plan.',
    third_story: 'It sounds like one person is focused on submitting something complete, while another is focused on not making a claim the evidence cannot support.',
    contribution_repair: 'Rather than deciding who is at fault, can we list what each of us can realistically complete before submission?',
    name_dynamic: 'We are repeating the same argument and some voices are not getting in. Can we pause and decide the remaining work first?',
    repair_commitment: 'Let’s write the revised owners and times now, and add a check-in so a missing handoff is visible before the final hour.',
    custom: input,
  }[move]
}

type LanguageBand = 1 | 2 | 3 | 4

function scoreBand(scoreText: string, exam: string, skill: 'listening' | 'speaking'): LanguageBand {
  const score = Number(scoreText)
  if (!Number.isFinite(score) || exam === 'Not available') return 2
  if (exam === 'TOEFL iBT (1–6)') return score <= 3 ? 1 : score <= 4 ? 2 : score <= 5 ? 3 : 4
  if (exam === 'TOEFL iBT (0–30 legacy)') {
    const threshold = skill === 'listening' ? [12, 18, 23] : [16, 21, 25]
    return score <= threshold[0] ? 1 : score <= threshold[1] ? 2 : score <= threshold[2] ? 3 : 4
  }
  return score <= 5 ? 1 : score <= 6 ? 2 : score <= 7 ? 3 : 4
}

const languageGuideByBand: Record<LanguageBand, string> = {
  1: 'Use one short main clause, usually 7–13 words. Use high-frequency campus and collaboration words. Avoid idioms, nested clauses, and unexplained specialist terms.',
  2: 'Use one or two concise sentences, usually 12–22 words. Use common campus collaboration vocabulary and at most one reason with because, so, or but.',
  3: 'Use one or two natural spoken sentences, usually 18–32 words. Limited hedging, a conditional relationship, and common course vocabulary are allowed.',
  4: 'Use concise natural university collaboration talk: at most two or three sentences, usually 20–40 words. Nuanced disagreement and prioritisation are allowed; avoid slang-heavy or lecture-like language.',
}

function languageSettings(profile: ScenarioProfile) {
  const listeningBand = scoreBand(profile.listening || profile.overall, profile.exam, 'listening')
  const speakingBand = scoreBand(profile.speaking || profile.overall, profile.exam, 'speaking')
  return {
    listeningBand,
    speakingBand,
    teammateLanguageGuide: languageGuideByBand[listeningBand],
    skillSupportGuide: languageGuideByBand[speakingBand],
    skillPatternCount: 4,
    ttsRate: ([0, 0.85, 0.95, 1, 1.05] as const)[listeningBand],
  }
}

export function patternsForSkill(card: SkillCard, _speakingBand: number) {
  // Speaking level changes the wording of future personalised scaffolds, not
  // how many options a learner is allowed to see or practise.
  return card.patterns || []
}

function projectForMajor(major: string, domain: Domain, fallback: { project: string; brief: string }) {
  const suppliedMajor = major.trim()
  const displayMajor = suppliedMajor || 'your discipline'
  const value = displayMajor.toLowerCase()
  if (domain === 'computing') {
    if (/(data science|data analytics|machine learning)/.test(value)) return { project: 'Late-night support demand dashboard', brief: 'Use anonymised check-in records, 240 student survey responses, and help-desk logs to identify when and where students cannot find support after 6 PM.' }
    return { project: 'Late-night campus support finder', brief: 'Use 12 student interviews and an audit of existing university webpages to design and demo a low-fidelity tool that helps a student find the right support service after 6 PM.' }
  }
  if (domain === 'business') {
    if (/(finance|accounting)/.test(value)) return { project: 'Orientation week society budget', brief: 'Compare three event-budget options using ticket estimates, venue quotes, and sponsorship offers, then recommend a financially responsible plan for a 300-student orientation event.' }
    if (/(economics)/.test(value)) return { project: 'Affordable campus meal policy', brief: 'Use two weeks of meal-sales data and a student price survey to recommend a pricing change that protects affordability without increasing the café’s operating loss.' }
    if (/(marketing|management)/.test(value)) return { project: 'Campus café evening growth plan', brief: 'Use weekday sales data, 120 student survey responses, and competitor observations to recommend one practical way to increase café visits between 4 PM and 7 PM.' }
    return { project: 'Evening campus shuttle reliability plan', brief: 'Use 180 student survey responses, two weeks of shuttle tap-on data, and driver schedules to identify the main cause of late-evening delays and recommend one feasible change for next term.' }
  }
  if (domain === 'social_science') return { project: 'Library late-night study experience mini-study', brief: `Use a short ${displayMajor} survey, six student interviews, and observation notes from the library’s 24-hour floor to recommend one change that reduces late-night study stress.` }
  if (domain === 'education') return { project: 'First-year academic writing clinic', brief: `Use tutor feedback and a short learner-needs survey to design a ${displayMajor} workshop that helps first-year international students plan and revise their first essay.` }
  if (domain === 'creative_media') return { project: 'International student arrival campaign', brief: `Use interviews with new international students and orientation-week feedback to create a ${displayMajor} campaign that makes airport-to-campus arrival steps easier to understand.` }
  if (domain === 'data_science') return { project: 'Late-night study stress insights dashboard', brief: `Use anonymised library check-ins, wellbeing survey data, and counselling-service demand data to identify one actionable pattern in late-night student stress.` }
  if (domain === 'natural_science') return { project: 'Library indoor-air-quality study', brief: `Design a feasible ${displayMajor} study that compares carbon-dioxide levels, occupancy, and student comfort across three library study zones.` }
  if (domain === 'engineering') return { project: 'Quiet study-space energy prototype', brief: `Design and justify a ${displayMajor} prototype that reduces wasted lighting and cooling in an underused library study zone without making it less comfortable.` }
  if (domain === 'health') return { project: 'Peer mental-health help-seeking intervention', brief: `Use campus wellbeing data and student interviews to develop a safe ${displayMajor} intervention that makes it easier for first-year students to seek support early.` }
  if (domain === 'environment') return { project: 'Reusable cup return-system proposal', brief: `Use café waste-audit data, queue observations, and student interviews to design a ${displayMajor} plan that increases reusable-cup returns without slowing service.` }
  if (domain === 'services') return { project: 'International arrival help-desk improvement plan', brief: `Use arrival-day queue data, service tickets, and student feedback to create a ${displayMajor} plan that reduces wait times at the international student help desk.` }
  if (domain === 'law_policy') return { project: 'International student housing guest policy', brief: `Use the current residence policy, student feedback, and two comparable university policies to develop an evidence-based ${displayMajor} recommendation about overnight guests.` }
  if (domain === 'humanities') return { project: 'Bilingual campus signage and belonging', brief: `Use library signage, service-desk observations, and interviews with international students to develop a comparative ${displayMajor} argument about how bilingual signs shape belonging and access.` }
  return { project: `Applied ${displayMajor} campus project`, brief: `Work as a ${displayMajor} group to develop an evidence-informed response to a real campus need.` }
}

function boardForLevel(board: BoardItem[], level: GroupLevel): BoardItem[] {
  const items = board.map((item) => ({ ...item, dependency: undefined }))
  if (level === 1) return items
  if (level === 2) {
    return items.map((item, index) => {
      if (index === 0) return { ...item, owner: 'Alex', status: 'done' }
      if (index === 1) return { ...item, owner: 'Sophie', status: 'blocked', dependency: `Needs the completed ${items[0].label.toLowerCase()} to be checked and handed over` }
      if (index === 2) return { ...item, owner: 'Ryan', status: 'claimed', dependency: `Cannot start until ${items[1].label.toLowerCase()} is unblocked` }
      return { ...item, status: 'open' }
    })
  }
  return items.map((item, index) => {
    if (index === 0) return { ...item, owner: 'Alex', status: 'done' }
    if (index === 1) return { ...item, owner: 'Sophie', status: 'done' }
    if (index === 2) return { ...item, owner: 'Ryan', status: 'blocked', dependency: 'A key promised contribution is missing and the evidence needs a fair repair plan' }
    return { ...item, owner: 'Unassigned', status: 'open', dependency: `Final delivery depends on resolving ${items[2].label.toLowerCase()}` }
  })
}

const levelOneFrictionPools: Record<TeamId, MicroFriction[]> = {
  A: [
  {
    id: 'rushed_direction',
    nodeId: 'clarify_direction',
    cue: 'The group is moving toward tasks before the shared direction is settled.',
    directorRule: 'Alex creates gentle momentum by suggesting task division before the group has agreed the main question. He is efficient, not hostile.',
    entryLine: 'We could split the work now and choose the details as we go.',
  },
  {
    id: 'vague_handoff',
    nodeId: 'clarify_scope',
    cue: 'A helpful offer still needs a specific task and time.',
    directorRule: 'Ryan makes a warm offer that does not yet specify the output or handoff time.',
    entryLine: 'I can do the research part, maybe by the end of the week.',
  },
  {
    id: 'held_evidence',
    nodeId: 'invite_evidence',
    cue: 'One useful piece of information has not entered the decision yet.',
    directorRule: 'Sophie gives one concrete fact, but Alex begins to move on before it shapes the plan.',
    entryLine: 'One interview said students cannot find support after 6 PM.',
  },
  {
    id: 'pace_evidence',
    nodeId: 'integrate_views',
    cue: 'Two useful concerns are pulling the group in different directions.',
    directorRule: 'Alex wants a decision today and Sophie wants the interview finding checked first. Both concerns are reasonable.',
    entryLine: 'We need to decide today, but Sophie wants us to check the interview point first.',
  },
  ],
  B: [
    { id: 'premature_plan', nodeId: 'clarify_direction', cue: 'A detailed plan is forming before the group has chosen one direction.', directorRule: 'Maya begins planning work for several unresolved ideas while Noah offers another option.', entryLine: 'I can make a task plan for all three ideas. We can choose one later.' },
    { id: 'scope_expansion', nodeId: 'clarify_scope', cue: 'The possible output is growing faster than the team can complete it.', directorRule: 'Noah adds several useful outputs; Maya starts planning all of them.', entryLine: 'We could make a map, a guide, a poster, and a short video.' },
    { id: 'opaque_challenge', nodeId: 'invite_evidence', cue: 'A concern is present, but the evidence behind it has not entered the plan.', directorRule: 'Leila questions a source without explaining the concern; Noah is ready to move on.', entryLine: 'I’m not sure one source really supports that idea.' },
    { id: 'output_tradeoff', nodeId: 'integrate_views', cue: 'Usefulness and a realistic scope are both important, but not yet connected.', directorRule: 'Noah wants multiple useful outputs; Leila worries the team cannot finish them in four days.', entryLine: 'A map and a guide would be useful, but two outputs may be too much for four days.' },
  ],
  C: [
    { id: 'rush_before_input', nodeId: 'clarify_direction', cue: 'The group is ready to assign sections before all useful input has entered.', directorRule: 'Jordan treats the early discussion as sufficient while Hannah gives only a small signal of a useful note.', entryLine: 'We have enough to start. Let’s choose sections now.' },
    { id: 'quality_scope', nodeId: 'clarify_scope', cue: 'Quality expectations are broader than a first workable task.', directorRule: 'Daniel wants full coverage while Jordan wants a decision today.', entryLine: 'The final guide should cover every possible service in detail.' },
    { id: 'quiet_evidence', nodeId: 'invite_evidence', cue: 'A useful interview pattern has not entered the plan.', directorRule: 'Hannah signals a useful observation but waits for a specific invitation.', entryLine: 'I wrote down one useful pattern from the interviews.' },
    { id: 'quality_tradeoff', nodeId: 'integrate_views', cue: 'A quick first version and basic accuracy are both needed.', directorRule: 'Jordan wants a simple working version; Daniel wants it to remain accurate and usable.', entryLine: 'A simple version is enough if it works, but it still needs to be accurate.' },
  ],
  D: [
    { id: 'premature_plan', nodeId: 'clarify_direction', cue: 'A task list is being assigned before scope is agreed.', directorRule: 'Priya begins allocating a whole list while Olivia keeps adding output ideas.', entryLine: 'Good, I’ll assign owners for this whole list. We can add ideas as we go.' },
    { id: 'vague_help', nodeId: 'clarify_scope', cue: 'A positive offer still needs a clear boundary.', directorRule: 'Ethan offers broad help and Priya is ready to add him wherever needed.', entryLine: 'I can help with the presentation, the research, or anything else.' },
    { id: 'scope_widening', nodeId: 'invite_evidence', cue: 'Useful information is present, but the group has not decided which detail matters.', directorRule: 'Olivia has two relevant notes but cannot see which should guide the plan.', entryLine: 'I have two notes about what students need at night, but I’m not sure which one matters.' },
    { id: 'plan_without_date', nodeId: 'confirm_commitments', cue: 'The task list exists, but an owner or date is still too vague to act on.', directorRule: 'Ethan offers to help later and Priya treats the list as complete.', entryLine: 'I’ll help with the slides at some point this weekend.' },
  ],
}

function shuffled<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5)
}

export function selectLevelOneMicroFrictions(teamId: TeamId = 'A'): MicroFriction[] {
  // The first visible issue always establishes the shared-direction risk.
  // The director then selects only one or two additional role-compatible
  // micro-frictions for the entire meeting.
  const pool = levelOneFrictionPools[teamId]
  const first = pool.find((friction) => friction.nodeId === 'clarify_direction')
  const remaining = pool.filter((friction) => friction !== first)
  const extraCount = Math.random() < 0.5 ? 1 : 2
  return [first, ...shuffled(remaining).slice(0, extraCount)].filter(Boolean) as MicroFriction[]
}

const quickPracticeNodeIds = ['clarify_direction', 'clarify_scope', 'confirm_commitments'] as const

function quickPracticeNodes(team: TeamDefinition): SceneNode[] {
  const allNodes = levelOneNodesForTeam(team)
  const selected = allNodes.filter((node) => quickPracticeNodeIds.includes(node.id as typeof quickPracticeNodeIds[number]))
  return selected.map((node) => {
    // The full route normally bridges direction → contribution and task scope
    // → evidence. In the quick route those anchors are deliberately omitted,
    // not silently treated as completed, so its final handoff must address the
    // next active task instead.
    const interactionPlan = node.interactionPlan
    let quickNode: SceneNode = node
    if (node.id === 'clarify_direction' && interactionPlan) {
      quickNode = {
        ...node,
        interactionPlan: {
          ...interactionPlan,
          resolved: interactionPlan.resolved.map((beat, index) => index === interactionPlan.resolved.length - 1
            ? { ...beat, target: 'team', dialogueAct: 'acknowledge', refersTo: 'the chosen direction', reasonToSpeak: 'The direction is settled. Close this decision cleanly; the next task will open as a separate scene.' }
            : beat),
        },
      }
    }
    if (node.id === 'clarify_scope' && interactionPlan) {
      quickNode = {
        ...node,
        interactionPlan: {
          ...interactionPlan,
          resolved: interactionPlan.resolved.map((beat, index) => index === interactionPlan.resolved.length - 1
            ? { ...beat, target: 'team', dialogueAct: 'acknowledge', refersTo: 'the bounded task and handoff', reasonToSpeak: 'The task is settled. Close this decision cleanly; commitments will open as a separate scene.' }
            : beat),
        },
      }
    }
    // Node 1 enters through the small-talk opening. Nodes 2 and 3 begin only
    // after their own task card appears, so they cannot blur into the prior
    // decision. The first person exposes the problem; the second names the
    // missing facts and hands the decision back to the learner.
    if (quickNode.id === 'clarify_scope') {
      return {
        ...quickNode,
        quickEntry: [
          { speaker: quickNode.primaryResponder, text: 'I can do the research part, but I am not sure what I should send or when.' },
          { speaker: quickNode.supportingResponder || team.members[0].id, text: 'Then the plan is still unclear. We need one owner, one clear output, and one time. What should this task be?' },
        ],
      }
    }
    if (quickNode.id === 'confirm_commitments') {
      return {
        ...quickNode,
        quickEntry: [
          { speaker: quickNode.primaryResponder, text: 'I can send my part later this week, but I cannot give an exact time yet.' },
          { speaker: quickNode.supportingResponder || team.members[0].id, text: 'Then we cannot check the work. We need owners, handoff times, and one check-in. What can we agree now?' },
        ],
      }
    }
    return quickNode
  })
}

function selectQuickPracticeMicroFrictions(teamId: TeamId = 'A'): MicroFriction[] {
  const pool = levelOneFrictionPools[teamId]
  const direction = pool.find((friction) => friction.nodeId === 'clarify_direction')
  const taskBoundary = pool.find((friction) => friction.nodeId === 'clarify_scope')
    || pool.find((friction) => friction.nodeId === 'confirm_commitments')
  return [direction, taskBoundary].filter(Boolean) as MicroFriction[]
}

export function createScenarioForProfile(profile: ScenarioProfile, domain: Domain, level: GroupLevel = 1, _teamId: TeamId = 'A', practiceMode: PracticeMode = 'full') {
  const base = domains[domain]
  const personalisedProject = projectForMajor(profile.major || base.label, domain, base)
  const language = languageSettings(profile)
  const teamId: TeamId = 'A'
  const team = groupProjectTeam(teamId)
  const allTeamNodes = levelOneNodesForTeam(team)
  const teamNodes = level === 1 && practiceMode === 'quick' ? quickPracticeNodes(team) : allTeamNodes
  const activeCards = levelOneCardsForTeam(team, teamNodes).filter((card) => teamNodes.some((node) => node.skillId === card.id))
  const isQuickLevelOne = level === 1 && practiceMode === 'quick'
  const selectedContract: LevelContract = level === 1
    ? {
        ...levelContracts[1],
        team,
        roles: team.members,
        nodes: teamNodes,
        cards: activeCards,
        initialTeamState: initialTeamState(team),
        microFrictionPlan: isQuickLevelOne ? selectQuickPracticeMicroFrictions(teamId) : selectLevelOneMicroFrictions(teamId),
        microFrictionLimit: isQuickLevelOne ? { min: 2, max: 2 } : levelContracts[1].microFrictionLimit,
        practiceMode,
        estimatedMinutes: isQuickLevelOne ? '6–8 min' : '15–20 min',
        unpractisedNodeIds: isQuickLevelOne ? allTeamNodes.filter((node) => !quickPracticeNodeIds.includes(node.id as typeof quickPracticeNodeIds[number])).map((node) => node.id) : [],
        objective: isQuickLevelOne
          ? 'In three key decisions, turn a first meeting into a shared direction, one workable task, and clear next commitments.'
          : levelContracts[1].objective,
        openingDirection: isQuickLevelOne
          ? 'This is the Quick Practice route. Run only three teaching anchors in order: establish direction, make one first task and handoff workable, then close with owners, times, and a check-in. The contribution-preference, evidence-invitation, and trade-off anchors are not happening in this run; never imply they were completed. Keep two visible, repairable micro-frictions only. Use concise natural turns and do not add extra problems.'
          : levelContracts[1].openingDirection,
        successCriteria: isQuickLevelOne
          ? ['One shared direction is named with a supporting fact', 'One task has a named owner, deliverable, and time', 'The group confirms owners, handoff time, and a check-in']
          : levelContracts[1].successCriteria,
        eventChain: isQuickLevelOne ? [...teamNodes.map((node) => node.event), 'CLOSING_WINDOW'] : levelContracts[1].eventChain,
        skillSequence: isQuickLevelOne ? teamNodes.map((node) => node.skillId) : levelContracts[1].skillSequence,
      }
    : levelContracts[level]
  const contract = studentFriendlyContract(selectedContract, level)
  const levelBrief = contract.objective
  const kickoffObjectives: Record<Domain, string[]> = {
    business: ['Choose the main service problem', 'Choose who does each task', 'Set first deadlines'],
    computing: ['Choose the main tool idea', 'Choose build, test, and guide tasks', 'Set first deadlines'],
    humanities: ['Choose the main point and evidence', 'Choose reading, writing, and editing tasks', 'Set first deadlines'],
    law_policy: ['Choose the policy question', 'Choose research and recommendation tasks', 'Set first deadlines'],
    social_science: ['Choose the study question', 'Choose evidence and analysis tasks', 'Set first deadlines'],
    education: ['Choose the student need', 'Choose plan and evidence tasks', 'Set first deadlines'],
    creative_media: ['Choose the audience and main idea', 'Choose research, story, and making tasks', 'Set first deadlines'],
    data_science: ['Choose the data question', 'Choose data, analysis, and explanation tasks', 'Set first deadlines'],
    natural_science: ['Choose the research question', 'Choose safety, data, and results tasks', 'Set first deadlines'],
    engineering: ['Choose the main need', 'Choose design, build, and test tasks', 'Set first deadlines'],
    health: ['Choose the student need', 'Choose evidence, plan, and handover tasks', 'Set first deadlines'],
    environment: ['Choose the main problem', 'Choose research, change, and impact tasks', 'Set first deadlines'],
    services: ['Choose the service problem', 'Choose journey, operations, and risk tasks', 'Set first deadlines'],
  }
  const objectives = level === 1
    ? kickoffObjectives[domain]
    : level === 2
      ? ['Clarify what is blocked', 'Update task owners and dependencies', 'Confirm a realistic recovery plan']
      : ['Choose what to cut or repair', 'Redistribute work fairly by capacity', 'Confirm commitments and a prevention check-in']
  const course = courseContext[domain]
  const studentTask = studentFacingTask[domain]
  const taskNarrative = isQuickLevelOne
    ? `In this short version of your ${course.course} kickoff, your four-person group is beginning ${studentTask.project}. ${studentTask.brief} You will practise three decisive moments only: agree on one direction, make one first task workable, and leave with named owners and a check-in. Other kickoff skills are saved for the full simulation.`
    : level === 1
    ? `In your ${course.course} class, your teacher has given your four-person group a project called ${studentTask.project}. ${studentTask.brief} Your group will make a ${studentTask.output}. Today, agree on the main idea, choose tasks, decide who does each task, and set a first deadline.`
    : level === 2
      ? `In your ${course.course} project, your group is about halfway through ${personalisedProject.project}. You are producing a ${course.output}, and one early piece is complete, but a second task is blocked because its evidence has not been handed over. That delay now holds up the next task. In this check-in, the team must decide what to unblock first, bring the missing information into the room, and leave with named owners, dependencies, and a realistic new time.`
      : `In your ${course.course} project, the group is close to submitting ${personalisedProject.project}, a ${course.output}. A key promised contribution is missing, so the current plan cannot all be completed on time. The gap has started a tense discussion about what happened and who should absorb the extra work. Your group needs to make a fair decision: reduce or repair the scope, redistribute the remaining work by capacity, record concrete commitments, and add one check-in that prevents another hidden handoff.`
  return {
    ...base,
    ...personalisedProject,
    ...studentTask,
    board: boardForLevel(base.board, level),
    level,
    practiceMode: level === 1 ? practiceMode : 'full' as PracticeMode,
    contract,
    language,
    context: levelBrief,
    taskNarrative,
    objectives,
    memberCount: 4,
    currentProgress: level === 1 ? '0% · Kickoff' : level === 2 ? '55% · Delivery check-in' : '82% · Deadline pressure',
    deadlineLabel: level === 1 ? '6 days' : level === 2 ? '2 days' : 'Tomorrow · 10 AM',
    estimatedMinutes: level === 1 ? (isQuickLevelOne ? '6–8 min' : '15–20 min') : undefined,
    unpractisedNodes: isQuickLevelOne ? allTeamNodes.filter((node) => !quickPracticeNodeIds.includes(node.id as typeof quickPracticeNodeIds[number])) : [],
  }
}

export function nextTurn(move: Move, board: BoardItem[], input: string): { messages: Message[]; board: BoardItem[]; event: string; skill: string } {
  const base = Date.now()
  const userText = userMoveText(move, board, input)
  const card = Object.values(levelContracts).flatMap((contract) => contract.cards).find((item) => item.id === move)
  return {
    event: card?.events[0] || 'TEAM_RESPONSE',
    skill: card?.label || 'Direct contribution',
    board,
    messages: [
      { id: base, speaker: 'You', time: 'now', text: userText },
      { id: base + 1, speaker: 'Alex', time: 'now', text: 'That gives us something specific to work with. Let’s make the next decision clear.' },
    ],
  }
}
