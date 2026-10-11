import 'dotenv/config'
import express from 'express'
import { fetch as upstreamFetch, ProxyAgent } from 'undici'
import { actionIsReadyForResolution, createDirectorState, eventAfterAssessment, validateActionAssessment, validateNodeResolution } from './scenario-engine.mjs'

const app = express()
const port = Number(process.env.PORT || 8787)
// Prefer Group Project-specific credentials, but reuse the existing
// PerspeakAI OpenAI-compatible server configuration when it is already set.
// Secrets stay server-side in either case.
const provider = {
  baseUrl: process.env.AGGREGATOR_API_BASE_URL || process.env.UNIFIED_BASE_URL || '',
  apiKey: process.env.AGGREGATOR_API_KEY || process.env.UNIFIED_API_KEY || '',
  // The Flask application uses gpt-4o as its existing text-model default.
  // Keep the Group Project service aligned when the host has only the shared
  // endpoint/key configured. A deployment can still override it explicitly.
  model: process.env.AGGREGATOR_MODEL || process.env.TEXT_MODEL || 'gpt-4o',
}
const proxyUrl = process.env.OUTBOUND_PROXY_URL?.trim()
const dispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : undefined

app.use(express.json({ limit: '1mb' }))

const configured = () => Boolean(provider.baseUrl.trim() && provider.apiKey.trim() && provider.model.trim())
const endpoint = () => {
  const base = provider.baseUrl.replace(/\/$/, '')
  return base.endsWith('/chat/completions') ? base : `${base}/chat/completions`
}
const requestProvider = (url, options) => upstreamFetch(url, {
  ...options,
  signal: AbortSignal.timeout(45000),
  ...(dispatcher ? { dispatcher } : {}),
})

function cleanJson(text) {
  return JSON.parse(text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, ''))
}

function providerFailure(error, action) {
  if (error?.cause?.code === 'UND_ERR_CONNECT_TIMEOUT') return 'The configured AI provider could not be reached before the connection timed out. Check the API base URL, provider availability, and your network or VPN, then try again.'
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError') return 'The configured AI provider did not respond within 45 seconds. Check your network or VPN and try again.'
  return error instanceof Error ? `${action}: ${error.message}` : action
}

function languagePolicy(language = {}) {
  return `LANGUAGE POLICY\nLanguage scores never change task stakes, role behaviour, event order, action choices, task complexity, skill cards, or evaluation standards. The task brief, task board, meeting cues, Team Signal, and all four sentence patterns on every skill card are fixed, plain English for every learner.\nAll live teammate dialogue must stay around IELTS 6.0–6.5: one or two short spoken sentences, normally 8–22 words each; common campus words such as project, task, plan, question, research, evidence, support, time, and deadline; direct subject–verb sentences. Prefer “clear task” to “bounded deliverable”, “what it means” to “implication”, and “choose” to “determine”. Do not use idioms, rare academic vocabulary, long noun phrases, or more than one idea per sentence.\nDo not use the learner's speaking score to shorten, remove, or simplify skill-card patterns. Replay is always high quality: give a polished university expression plus grammar, vocabulary, and pragmatics guidance. Never rate an accent as good or bad. Write spoken English; do not treat minor grammar slips or hesitation as a communication failure.`
}

function contractPolicy(contract = {}, level) {
  const microFrictionPlan = Array.isArray(contract.microFrictionPlan) ? contract.microFrictionPlan : []
  const microFrictionGuide = microFrictionPlan.length
    ? microFrictionPlan.map((friction) => `${friction.id}: ${friction.directorRule}`).join(' | ')
    : 'No preselected micro-friction plan.'
  const formatPolicy = contract.practiceMode === 'quick'
    ? 'Quick Practice uses only the active three-node route. Do not mention, test, or imply completion of omitted anchors. Each active node is a separate mini-scene: once one decision is settled, close it cleanly. The client presents the next task before its two-person problem setup begins. Do not blend the next decision into the current node’s confirmation turn. Keep turns concise, but do not lower any node-resolution facts or teammate-confirmation requirements.'
    : 'Full Simulation uses every active node in order. Do not skip a node or imply that an unresolved project decision has already been made.'
  return `LEVEL CONTRACT\nLevel ${level}. Format: ${contract.practiceMode === 'quick' ? 'Quick Practice' : 'Full Simulation'}. Objective: ${contract.objective || 'Move the group project forward.'}\nProject state: ${contract.projectState || 'Not specified'}. Time pressure: ${contract.timePressure || 'Not specified'}. Relationship state: ${contract.relationshipState || 'Not specified'}.\nAllowed events: ${(contract.allowedEvents || []).join(', ') || 'TEAM_RESPONSE'}.\nSuccess criteria: ${(contract.successCriteria || []).join(' | ') || 'make a clear next step'}.\nOpening direction: ${contract.openingDirection || 'Create a realistic meeting opening.'}\nSelected visible micro-frictions (${microFrictionPlan.length}, never add another): ${microFrictionGuide}\n${formatPolicy}\nLevel 1 is a first kickoff at 0%. It uses exactly the selected two or three visible micro-frictions across the whole meeting; other learning anchors surface through ordinary ambiguity, short pauses, or incomplete responses. Keep one public and repairable pressure active at a time. Do not introduce blame, missed commitments, emotional outbursts, identity threats, attacks, or a second independent problem.\nLevel 2 includes both a task and interaction pressure; no teammate is malicious.\nLevel 3 requires fair redistribution, explicit commitments, and a prevention measure; never make the learner silently absorb all remaining work.`
}

function teamNames(contract = {}) {
  const names = Array.isArray(contract.roles) ? contract.roles.map((role) => role?.id).filter((name) => typeof name === 'string' && name.trim()) : []
  return names.length ? names : ['Alex', 'Sophie', 'Ryan']
}

function openingOrder(contract = {}, firstNode = {}) {
  const names = teamNames(contract)
  const planned = Array.isArray(firstNode?.speakerPlan?.opening) ? firstNode.speakerPlan.opening : []
  if (planned.length >= 3 && planned.every((speaker) => names.includes(speaker))) return planned
  const lead = firstNode.primaryResponder || names[0]
  const support = firstNode.supportingResponder || names.find((name) => name !== lead) || lead
  const third = names.find((name) => name !== lead && name !== support) || support
  return [lead, third, support, lead]
}

function openingMessagesFromResult(result, language, allowedNames, order) {
  const messages = Array.isArray(result?.messages)
    ? result.messages.filter((message) => allowedNames.includes(message.speaker) && typeof message.text === 'string')
    : []
  if (messages.length !== 4 || messages.some((message, index) => message.speaker !== order[index])) return null
  if (!/[?？]\s*$/.test(messages[3]?.text?.trim() || '')) return null
  return teammateLanguageFits(messages, language) ? messages : null
}

async function requestOpening(prompt, language, allowedNames, order, correction = '') {
  const response = await requestProvider(endpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.apiKey}` },
    body: JSON.stringify({
      model: provider.model,
      messages: [
        { role: 'system', content: 'You write concise university group-project dialogue. Follow JSON schema and speaker order exactly.' },
        { role: 'user', content: `${prompt}${correction}` },
      ],
    }),
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(body?.error?.message || `Provider returned ${response.status}.`)
  return openingMessagesFromResult(cleanJson(body?.choices?.[0]?.message?.content || ''), language, allowedNames, order)
}

function normaliseTurnResult(result, allowedNames) {
  if (!result || !Array.isArray(result.messages)) return null
  const messages = result.messages
    .filter((message) => allowedNames.includes(message.speaker) && typeof message.text === 'string' && message.text.trim())
    .slice(0, 3)
  if (!messages.length) return null
  return { ...result, messages }
}

function plannedSpeakers(node, state, allowedNames) {
  const plan = node?.speakerPlan?.[state]
  return Array.isArray(plan) && plan.length && plan.every((speaker) => allowedNames.includes(speaker)) ? plan : null
}

function followsSpeakerPlan(messages, expectedSpeakers) {
  return Boolean(expectedSpeakers)
    && messages.length === expectedSpeakers.length
    && messages.every((message, index) => message.speaker === expectedSpeakers[index])
}

function activeFriction(contract = {}, node) {
  if (!node) return null
  const frictions = Array.isArray(contract.microFrictionPlan) ? contract.microFrictionPlan : []
  return frictions.find((friction) => friction.nodeId === node.id) || null
}

function teammateLanguageFits(messages, language = {}) {
  // Spoken teammates use one shared, approachable language ceiling. The
  // learner's listening score can later affect TTS pace, but not the clarity
  // or academic stakes of what the group says.
  const limit = { words: 24, sentences: 2 }
  return messages.every((message) => {
    const words = message.text.trim().split(/\s+/).filter(Boolean).length
    const sentences = message.text.split(/[.!?]+/).filter((part) => part.trim()).length
    return words <= limit.words && sentences <= limit.sentences
  })
}

// A short acceptance can be a real collaboration move when a teammate has
// just made a concrete proposal. Treat it differently from a bare keyword:
// the director still has to surface the project facts and obtain the planned
// confirmations before the node can close.
function isContextualAgreementTurn(userText, transcript = []) {
  const learnerTurn = typeof userText === 'string' ? userText.trim() : ''
  if (!learnerTurn) return false
  const agreement = /\b(?:i\s*(?:do\s*)?agree|that(?:'s|\s+is)\s+(?:a\s+)?(?:good|clear|useful)\s+(?:focus|idea|plan)|sounds?\s+good|yes[,.!\s]+(?:that|let'?s|this)|exactly|right,?\s+(?:that|let'?s|this))/i
  if (!agreement.test(learnerTurn)) return false

  // Only the immediately preceding teammate contribution may supply the
  // proposal being accepted. This stops a detached "I agree" from advancing
  // a later, unrelated task.
  const prior = [...transcript]
    .slice(0, -1)
    .reverse()
    .find((message) => message?.speaker && message.speaker !== 'You' && typeof message.text === 'string' && message.text.trim())
  if (!prior) return false
  const wordCount = prior.text.trim().split(/\s+/).filter(Boolean).length
  return wordCount >= 4
}

function factualNodeRecord(nodeId, facts = {}) {
  const value = (key) => typeof facts[key] === 'string' ? facts[key].trim().replace(/\s+/g, ' ') : ''
  if (nodeId === 'clarify_direction') {
    const direction = value('mainDirection')
    const focus = value('projectFocus')
    const evidence = value('evidenceLink')
    return direction && focus && evidence ? `Direction: ${direction}. Focus: ${focus}. Evidence: ${evidence}.` : ''
  }
  if (nodeId === 'state_preference') return value('learnerContribution') ? `Your contribution: ${value('learnerContribution')}${value('teamNeed') ? ` — supports ${value('teamNeed')}.` : '.'}` : ''
  if (nodeId === 'clarify_scope') return value('owner') && value('deliverable') && value('deadline') ? `${value('owner')} will deliver ${value('deliverable')} by ${value('deadline')}.` : ''
  if (nodeId === 'invite_evidence') return value('evidence') ? `Evidence added: ${value('evidence')}${value('projectImpact') ? ` — impact: ${value('projectImpact')}.` : '.'}` : ''
  if (nodeId === 'integrate_views') return value('decisionRule') ? `Decision rule: ${value('decisionRule')}.` : ''
  if (nodeId === 'confirm_commitments') return value('owners') && value('handoffTime') && value('nextCheckIn') ? `Owners: ${value('owners')}. Handoff: ${value('handoffTime')}. Check-in: ${value('nextCheckIn')}.` : ''
  return ''
}

function safeConclusion(result, directorState, userText, accepted) {
  if (!accepted || !directorState.currentNode) return null
  const factualRecord = factualNodeRecord(directorState.currentNode.id, result.nodeResolution?.facts)
  if (factualRecord) return { nodeId: directorState.currentNode.id, conclusion: factualRecord }
  const supplied = typeof result.nodeResolution?.summary === 'string'
    ? result.nodeResolution.summary.trim().replace(/\s+/g, ' ')
    : typeof result.nodeMemory?.conclusion === 'string' ? result.nodeMemory.conclusion.trim().replace(/\s+/g, ' ') : ''
  const conclusion = supplied && supplied.length <= 160 ? supplied : `The team confirmed this step after: “${userText.trim().slice(0, 96)}”`
  return { nodeId: directorState.currentNode.id, conclusion }
}

function applyRoleState(current = {}, changes = {}) {
  const next = { ...(current || {}) }
  for (const [member, change] of Object.entries(changes || {})) {
    next[member] = { ...(next[member] || {}), ...(change || {}) }
  }
  return next
}

function nodeDirectorSummary(node = {}) {
  const director = node.director || {}
  return {
    issue: director.issue || node.objective || '',
    visibleEvidence: director.visibleEvidence || [],
    errorLine: director.errorLine || node.entryLine || '',
    proofLine: director.proofLine || '',
    consequenceLine: director.consequenceLine || '',
    handoffQuestion: director.handoffQuestion || '',
    leadRule: director.leadRule || '',
    supportRule: director.supportRule || '',
    thirdRoleRule: director.thirdRoleRule || '',
    ignoreEscalation: director.ignoreEscalation || '',
    resolutionEffect: director.resolutionEffect || '',
    conclusionSchema: director.conclusionSchema || '',
    lead: node.primaryResponder || '',
    support: node.supportingResponder || '',
    third: node.thirdResponder || '',
    entryLine: node.entryLine || '',
    speakerPlan: node.speakerPlan || null,
    interactionPlan: node.interactionPlan || null,
  }
}

function baseSystemPrompt({ profile, level, scenario, board, directorState, teamStates = {} }) {
  const node = directorState.currentNode
  const nextNode = directorState.nextNode
  const names = teamNames(scenario.contract)
  const separateQuickScenes = scenario.contract?.practiceMode === 'quick'
  const boardUpdateInstruction = `TASK-BOARD RULE: When the learner or team explicitly agrees that ${names.join(', ')}, or the learner owns a listed task, return the matching boardUpdates entry in that same turn. Use an existing item id, a real owner name, and status claimed or done. Do not wait until the closing node. Do not invent an owner or task that was not agreed aloud.`
  const currentContract = nodeDirectorSummary(node)
  const nextContract = nodeDirectorSummary(nextNode)
  currentContract.interactionPolicy = 'Use exactly one interactionPlan: unresolved until the project facts are settled, resolved only after they are settled. Each message must make its target, dialogueAct, referred-to fact, and reasonToSpeak audible. Teammates not in that plan stay silent for silenceReason. Never add a speaker for balance or give generic agreement.'
  const resolvedTransitionRule = separateQuickScenes
    ? 'If the learner HAS created the required effect: let the planned current-node teammates acknowledge the settled facts, then stop. Do not introduce, hint at, or ask the next node’s question; it will begin separately after the task card.'
    : 'If the learner HAS created the required effect: first let the affected current-node teammate explicitly acknowledge what changed; then add one short, role-consistent follow-up from a relevant teammate. If a next node exists, the next node\'s lead may introduce its specified issue naturally as a final short message. Preserve the meeting\'s logic: the next issue must grow from the confirmed conclusion, not appear as a generic transition.'
  return `You are the scenario director for PerspeakAI, a university group-project communication simulator. Generate realistic text-only replies from these three teammates only: ${names.join(', ')}.\n\nUser profile: major=${profile.major || 'not provided'}.\n${languagePolicy(scenario.language)}\n${boardUpdateInstruction}\n\nScenario: Level ${level}; project=${scenario.project}; brief=${scenario.brief}; goals=${scenario.objectives.join(' | ')}.\nShared board: ${JSON.stringify(board)}\n\n${contractPolicy(scenario.contract, level)}\n\nDIRECTOR STATE\nCurrent node: ${node?.id || 'complete'}. Objective: ${node?.objective || 'Close the meeting.'}. Completion evidence: ${node?.completionEvidence || 'All required actions are complete.'}. Current event: ${directorState.currentEvent}. Next event after valid evidence: ${directorState.nextEvent}.\n\nCURRENT NODE EXECUTION CONTRACT (this is mandatory, not background flavour): ${JSON.stringify(currentContract)}\nNEXT NODE EXECUTION CONTRACT (use only after the current action is genuinely met): ${JSON.stringify(nextContract)}\nTEAM ROLE PROFILES: ${JSON.stringify(scenario.contract?.roles || [])}\nOBSERVABLE ROLE STATE: ${JSON.stringify(teamStates)}\n\nRole state is not a label. It must change how a teammate speaks: for example, a rushed teammate tries to move on, holding-back means a short cue then silence, expansive means adding one option, and an acknowledged teammate makes room or responds with relief. In this node, the lead must show the lead rule, the support must create the second visible piece of evidence, and the third teammate must follow the third-role rule. Do not flatten the team into generic agreement.\n\nThe selected card is private support only; it never speaks for the learner and never controls whether their own wording works. Keep this node unresolved until the learner independently creates the stated resolution effect. A learner may make that move either by proposing the needed decision themselves OR by clearly accepting a concrete proposal that is already audible in the immediately preceding teammate turns—for example, “I agree” or “that’s a good focus.” Accept short agreement only when the existing conversation already contains the relevant project facts; then teammates must restate those facts in plain language and naturally confirm them. Never force the learner to repeat Alex’s exact conclusion word for word. Do not skip nodes, solve later issues early, or announce skill labels. Each teammate speaks at most once per turn. Keep every message short and leave the learner room to act.\n\nIf the learner has NOT created the required effect: keep the current node active. Speak in this exact learner-facing shape: (1) the first planned speaker states the current mistake, gap, or risk in plain language; (2) the second planned speaker gives one concrete fact, missing detail, or consequence and ends with the current handoffQuestion. The second line must make it clear that the learner, not the AI, needs to decide or clarify the next move. Do not repair the issue for the learner. If the learner has already tried once without solving it, use at most the single ignoreEscalation described in the current contract; never add a new independent problem.\n${resolvedTransitionRule}\n\nReturn only valid JSON: {"event":"ONE_ALLOWED_UPPERCASE_EVENT_TAG","messages":[{"speaker":"one of ${names.join('|')}","text":"one natural response"}],"boardUpdates":[{"id":"optional existing board item id","owner":"optional owner name","status":"open|claimed|blocked|done","dependency":"optional short handoff note"}],"nodeMemory":{"nodeId":"current node id only if met","conclusion":"short confirmed conclusion following the current contract schema"}}. Return one to three messages total. Include board updates only when the conversation explicitly establishes them. For Level 1, do not mark a role, task, or deadline resolved until the learner has actually said it or explicitly accepted a concrete, already-stated plan, and the team confirms it. Do not narrate the user, use no markdown, and do not mention being AI.`
}

function systemPrompt({ profile, level, scenario, board, directorState, selectedSkill, teamStates }) {
  const node = directorState.currentNode
  return `${baseSystemPrompt({ profile, level, scenario, board, directorState, teamStates })}\n\nASSESSMENT\nCurrent node: ${node?.id || 'complete'}. Required communication action: ${node?.skillId || 'none'}. Current event: ${directorState.currentEvent}. Next event after a valid action: ${directorState.nextEvent}. Selected card: ${selectedSkill?.id || 'none'}.\nAssess the learner's actual utterance, not their card choice. Use status "met" when they independently perform the required action, even with no card selected, a different card selected, or minor grammar errors. A short agreement such as “I agree” or “that’s a good focus” is valid only if the immediately preceding teammate turns already gave a concrete, task-relevant proposal and the learner is clearly accepting that proposal; treat the prior proposal plus the learner’s acceptance as the action. Do not accept agreement that has no concrete proposal in context, a card name, or a phrase that does not perform the action. Evidence must be an exact meaningful 4+ character excerpt from the learner utterance. If incomplete, use "needs_work" and one short concrete suggestion. For a met action, teamEffect says what changed in the group and must match the current node resolution effect. Replay is high quality for every learner: strategy, polished spoken version, language note, pragmatics note, and next move.\nAdd: "skillAssessment":{"nodeId":"${node?.id || ''}","skillId":"${node?.skillId || ''}","status":"met|needs_work","evidence":"exact learner excerpt or empty string","feedback":"one short coaching sentence","teamEffect":"short team effect when met","replay":{"strategy":"recognized communication action","polishedVersion":"more natural spoken English version","languageNote":"specific grammar or vocabulary improvement","pragmaticsNote":"clarity, politeness, or assertiveness explanation","nextMove":"how to reuse this move"}}. Keep the team on ${directorState.currentEvent} if status is needs_work; move to ${directorState.nextEvent} only when status is met.`
}

async function requestTurn({ system, user, allowedNames, correction = '' }) {
  const response = await requestProvider(endpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.apiKey}` },
    body: JSON.stringify({ model: provider.model, messages: [{ role: 'system', content: system }, { role: 'user', content: `${user}${correction}` }] }),
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(body?.error?.message || `Provider returned ${response.status}.`)
  return normaliseTurnResult(cleanJson(body?.choices?.[0]?.message?.content || ''), allowedNames)
}

app.get('/api/health', (_request, response) => {
  response.json({ configured: configured(), model: provider.model ? 'configured' : 'missing', outboundProxy: proxyUrl ? 'configured' : 'not configured' })
})

app.post('/api/group-project/opening', async (request, response) => {
  if (!configured()) return response.status(503).json({ error: 'Server API configuration is incomplete. Check .env.' })
  const { profile, level, scenario, board } = request.body ?? {}
  if (!profile || !scenario || !Array.isArray(board)) return response.status(400).json({ error: 'Invalid opening-scene payload.' })
  const firstNode = scenario.contract?.nodes?.[0]
  const names = teamNames(scenario.contract)
  const order = openingOrder(scenario.contract, firstNode)
  const firstFriction = activeFriction(scenario.contract, firstNode)
  const firstDirector = nodeDirectorSummary(firstNode)
  const openingBeat = `OPENING BEAT CONTRACT: Keep this exact speaker sequence: ${order.join(' → ')}. This is the group's first minute together: every message must sound like a short, friendly project-centred introduction or first impression, not a scripted diagnosis. Include a natural greeting, acknowledgement, or “good to meet you” moment across the exchange. At the same time, each message must mention one concrete part of the project brief, its users, evidence, or likely output, so the learner understands what the project is about. The first speaker makes the premature, overly broad, or incomplete move audible within that natural small talk. The next two make one concrete consequence and one useful evidence point audible without repairing the problem. The final message ends with handoffQuestion in the same sense and with a question mark. Do not solve the direction, assign owners, or turn this into a quiz.`
  const openingRule = firstFriction
    ? `The visible opening issue is: ${firstFriction.directorRule}. ${openingBeat}`
    : `The opening issue is that the group has not agreed on its main direction. ${openingBeat}`
  const prompt = `Create the first 30–45 seconds of a PerspeakAI Group Project meeting. Return only JSON: {"messages":[{"speaker":"one of ${names.join('|')}","text":"..."}]}. Return exactly ${order.length} short messages in this order: ${order.join(', ')}.\n\n${languagePolicy(scenario.language)}\nProject: ${scenario.project}. Brief: ${scenario.brief}. Major: ${profile.major || 'not provided'}. Board: ${JSON.stringify(board)}.\n${contractPolicy(scenario.contract, level)}\nFIRST-NODE DIRECTOR CONTRACT: ${JSON.stringify(firstDirector)}\n${openingRule}\nUse the selected speakers only; do not add a teammate merely to make the dialogue feel balanced. This must be genuine project-centred small talk: friendly, brief, and already grounded in the task. Do not create any extra pressure that is not selected. At Level 1 do not decide owners or advance the project. Do not label personalities or hidden goals.`
  try {
    let messages = await requestOpening(prompt, scenario.language, names, order)
    if (!messages) messages = await requestOpening(prompt, scenario.language, names, order, `\n\nAUTOMATIC FORMAT AND LANGUAGE CORRECTION: Return exactly four messages in the literal order ${order.join(', ')}. The third speaker uses 15 words or fewer. Follow the listening-band word and sentence limits. JSON only.`)
    if (!messages) throw new Error('Provider returned two opening drafts that did not match the required speaker sequence.')
    response.json({ messages })
  } catch (error) {
    response.status(502).json({ error: providerFailure(error, 'AI opening could not be used') })
  }
})

app.post('/api/group-project/turn', async (request, response) => {
  if (!configured()) return response.status(503).json({ error: 'Server API configuration is incomplete. Check .env.' })
  const { profile, level, scenario, board, transcript, userText, selectedSkill, completedNodeIds, actionReadyNodeIds, nodeConclusions, teamStates, ineffectiveAttempts } = request.body ?? {}
  if (!profile || !scenario || !Array.isArray(board) || !Array.isArray(transcript) || !userText) return response.status(400).json({ error: 'Invalid Group Project turn payload.' })
  const history = transcript.slice(-16).map((message) => `${message.speaker}: ${message.text}`).join('\n')
  const directorState = createDirectorState(scenario.contract, Array.isArray(completedNodeIds) ? completedNodeIds : [], nodeConclusions)
  try {
    const currentFriction = activeFriction(scenario.contract, directorState.currentNode)
    const currentDirector = nodeDirectorSummary(directorState.currentNode)
    const nextDirector = nodeDirectorSummary(directorState.nextNode)
    const currentAttemptCount = Number(ineffectiveAttempts?.[directorState.currentNode?.id]) || 0
    const requirements = directorState.currentNode?.resolutionRequirements || { facts: [], minTeamConfirmations: 0 }
    const separateQuickScenes = scenario.contract?.practiceMode === 'quick'
    const directionClosureRule = directorState.currentNode?.id === 'clarify_direction'
      ? ` DIRECTION CLOSURE RULE: This is a kickoff choice, not a debate or defence. The two decision facts are mainDirection and projectFocus. evidenceLink means one concrete, relevant detail from the brief, board, opening conversation, or this turn that supports the choice; it may be briefly referenced and does not need a new explanation. Once the direction and focus are named, one evidence link is visible, and two planned teammates confirm, mark the node complete immediately. Do not ask “why this focus?” again, or reopen the choice, unless a genuinely new contradictory fact enters the conversation.`
      : ''
    const directorBeat = `NODE-BEAT CONTRACT: errorLine=${currentDirector.errorLine}; proofLine=${currentDirector.proofLine}; consequenceLine=${currentDirector.consequenceLine}; handoffQuestion=${currentDirector.handoffQuestion}. Keep those meanings explicit. A learner must be able to hear the error, why it matters, and an open question. Do not soften the error into generic agreement. ACTOR BOUNDARY: teammates never coach the learner. Never say “you should”, “please ask”, “try saying”, “use this skill”, or tell the learner what to say. Speak only as your own teammate: state your own incomplete choice, concern, evidence, or question to the group. If the learner has not solved it, the lead restates the error in plain language; the support gives one concrete detail or consequence and ends with handoffQuestion, making it clear that the learner now needs to decide. This node already has ${currentAttemptCount} unsuccessful attempts; only when this number is at least one may you use the single permitted escalation. A recognised skill action is not the same as completing the node. The node may complete only when every required fact is clear: ${JSON.stringify(requirements.facts)}; it needs at least ${requirements.minTeamConfirmations} teammate confirmations${requirements.requireAllTeammates ? ', including all three teammates' : ''}. Return a nodeResolution object with nodeId, status “complete” or “in_progress”, summary, facts, and confirmedBy. Use status “complete” only when the current project task is settled and the required teammate confirmations appear in this turn.${directionClosureRule} ${separateQuickScenes ? 'When the learner solves the full node, use the planned confirmation sequence only to close the settled task. Do not start the next node; the client will present it separately.' : `If the learner solves the full node and a next node exists, use the planned confirmation sequence: first confirm the settled task, then connect naturally to the next issue, with the final planned message ending in the next group question: ${nextDirector.handoffQuestion}.`}`
    const speakerPlanBeat = `SPEAKER-PLAN CONTRACT — this overrides generic turn-taking instructions. When the task is still unresolved, use exactly this sequence and no other teammate: ${JSON.stringify(directorState.currentNode?.speakerPlan?.unresolved || [])}. The first speaker exposes the current problem. The second speaker names the concrete missing detail or consequence and asks handoffQuestion, then stops for the learner. When the task is fully resolved, use exactly this confirmation sequence and no other teammate: ${JSON.stringify(directorState.currentNode?.speakerPlan?.resolved || [])}. A repeated name is intentional. Do not add a third person for balance. ${separateQuickScenes ? 'In this Quick Practice route, close the current task only; do not introduce the next decision.' : `In a resolved sequence, confirm the actual facts first; only the planned final message may introduce the next node’s unresolved question: ${nextDirector.handoffQuestion || 'close the current meeting naturally'}.`}`
    const interactionPlanBeat = `INTERACTION-ROUND CONTRACT — unresolved beats: ${JSON.stringify(directorState.currentNode?.interactionPlan?.unresolved || [])}. Resolved beats: ${JSON.stringify(directorState.currentNode?.interactionPlan?.resolved || [])}. Silence rule: ${directorState.currentNode?.interactionPlan?.silenceReason || 'Only the planned speakers have a reason to speak.'}. Choose the matching set before writing dialogue. Every line must respond to its named target and referred-to fact; do not state the contract labels aloud.`
    const systemScenario = { ...scenario, contract: { ...scenario.contract, microFrictionPlan: currentFriction ? [currentFriction] : [], openingDirection: `${scenario.contract?.openingDirection || ''} ${directorBeat} ${speakerPlanBeat} ${interactionPlanBeat}` } }
    const effectiveTeamStates = applyRoleState(teamStates, directorState.currentNode?.stateBefore)
    const system = `${systemPrompt({ profile, level, scenario: systemScenario, board, directorState, selectedSkill, teamStates: effectiveTeamStates })}\n\nREQUIRED NODE-RESOLUTION JSON: Always include "nodeResolution" in the returned top-level JSON: {"nodeId":"${directorState.currentNode?.id || ''}","status":"in_progress|complete","summary":"short factual conclusion","facts":{"requiredFact":"value"},"confirmedBy":["teammate names who confirm aloud"]}. A skillAssessment of met may coexist with nodeResolution status in_progress. Use complete only after every required fact and the required natural teammate confirmations appear in this turn.`
    const nextEntry = directorState.nextNode ? nodeDirectorSummary(directorState.nextNode) : null
    const user = `Conversation so far:\n${history}\n\nThe user has just said: ${userText}\nSelected skill card: ${selectedSkill ? `${selectedSkill.label} — ${selectedSkill.description}` : 'No card; assess the learner’s own wording.'}\n\nDIRECTOR ROUTE\nConfirmed conclusions from earlier steps: ${JSON.stringify(directorState.nodeConclusions)}\nCurrent role state after applying this node’s entry state: ${JSON.stringify(effectiveTeamStates)}\nThere are two separate outcomes: (1) skillAssessment may be met when the learner makes the communication action; (2) nodeResolution may be complete only when the team has actually settled every required project fact and the planned teammates naturally confirm it. A met skill is not permission to move on. If the task is still open, keep it open and use the planned unresolved speakers only. If the task is genuinely settled, use the planned resolved speakers only; ${separateQuickScenes ? 'close this task only. The next task will be presented as its own scene, so do not mention it now.' : `their last message may introduce this next issue naturally: ${JSON.stringify(nextEntry)}.`} If the learner brings up a later task early, acknowledge at most one useful idea, leave it open, and return to the current node’s problem. Do not settle a later node early. Return nodeMemory only when nodeResolution is complete.\nRespond as the teammates.`
    const allowedNames = teamNames(scenario.contract)
    let result = await requestTurn({ system, user, allowedNames })
    if (!result || !teammateLanguageFits(result.messages, scenario.language)) result = await requestTurn({ system, user, allowedNames, correction: `\n\nAUTOMATIC FORMAT AND LANGUAGE CORRECTION: Return valid JSON only. Include one to three non-empty teammate messages. Each speaker must be one of ${allowedNames.join(', ')}. Follow the listening-band sentence and word limits exactly.` })
    if (!result) throw new Error('Provider returned two unusable teammate response formats.')

    const allowedEvents = Array.isArray(scenario.contract?.allowedEvents) ? scenario.contract.allowedEvents : []
    const eventChain = Array.isArray(scenario.contract?.eventChain) ? scenario.contract.eventChain : []
    const contextualAgreement = isContextualAgreementTurn(userText, transcript)
    let skillResult = validateActionAssessment({ assessment: result.skillAssessment, directorState, userText })
    if (contextualAgreement && !skillResult.accepted) {
      const contextualRetry = await requestTurn({
        system,
        user,
        allowedNames,
        correction: `\n\nCONTEXTUAL-ACCEPTANCE CORRECTION: The learner has clearly accepted the immediately preceding teammate proposal. Do not ask them to repeat, justify, or restate that proposal word for word. Mark skillAssessment.status as "met" with an exact excerpt from the learner's acceptance. Use the prior teammate proposal plus this acceptance as the learner's action. If the proposal already contains the current node's necessary project facts, have the planned teammates state those facts plainly and confirm them; mark nodeResolution complete only when the required facts and confirmations are actually present. If one factual detail is genuinely absent, keep nodeResolution in_progress and ask only for that missing detail. JSON only.`,
      })
      if (contextualRetry && teammateLanguageFits(contextualRetry.messages, scenario.language)) {
        result = contextualRetry
        skillResult = validateActionAssessment({ assessment: result.skillAssessment, directorState, userText })
      }
    }
    // A learner can first make the required communication move, then use a
    // following turn to add the missing project facts. Do not force them to
    // repeat the same skill wording just to let the project task close.
    const actionWasAlreadyRecognised = Array.isArray(actionReadyNodeIds) && actionReadyNodeIds.includes(directorState.currentNode?.id)
  let actionIsReady = actionIsReadyForResolution({
    actionAccepted: skillResult.accepted,
    actionPreviouslyRecognized: actionWasAlreadyRecognised,
  })
    let nodeResolutionResult = actionIsReady
      ? validateNodeResolution({ resolution: result.nodeResolution, directorState, allowedNames, messages: result.messages })
      : { completed: false, resolution: null }
    let nodeCompleted = actionIsReady && nodeResolutionResult.completed
    const expectedSpeakers = plannedSpeakers(directorState.currentNode, nodeCompleted ? 'resolved' : 'unresolved', allowedNames)
    const needsQuestion = nodeCompleted && Boolean(directorState.nextNode) && !separateQuickScenes
    const needsSpeakerPlanRetry = Boolean(expectedSpeakers)
      && (!followsSpeakerPlan(result.messages, expectedSpeakers)
        || (needsQuestion && !/[?？]\s*$/.test(result.messages[result.messages.length - 1]?.text?.trim() || '')))
    if (needsSpeakerPlanRetry) {
      const mode = nodeCompleted ? 'fully resolved' : 'still unresolved'
      const sequence = expectedSpeakers.join(' → ')
      const finalInstruction = nodeCompleted && directorState.nextNode && !separateQuickScenes
        ? `The final planned speaker must naturally ask the next node question: ${nextDirector.handoffQuestion}`
        : nodeCompleted
          ? 'Use the final planned speaker to close the current meeting commitment naturally. Do not introduce a later task.'
          : `The final planned speaker must keep the current problem open with this group question: ${currentDirector.handoffQuestion}`
      result = await requestTurn({ system, user, allowedNames, correction: `\n\nAUTOMATIC SPEAKER-PLAN CORRECTION: The current task is ${mode}. Return exactly ${expectedSpeakers.length} messages in this literal sequence: ${sequence}. Use no other teammate. Preserve a valid skillAssessment and nodeResolution object. ${finalInstruction} JSON only.` })
      if (!result) throw new Error('Provider did not return the required node-transition structure.')
      const retrySkillResult = validateActionAssessment({ assessment: result.skillAssessment, directorState, userText })
      if (retrySkillResult.accepted) skillResult = retrySkillResult
      else result.skillAssessment = skillResult.assessment
      actionIsReady = actionIsReadyForResolution({
        actionAccepted: skillResult.accepted,
        actionPreviouslyRecognized: actionWasAlreadyRecognised,
      })
      nodeResolutionResult = actionIsReady
        ? validateNodeResolution({ resolution: result.nodeResolution, directorState, allowedNames, messages: result.messages })
        : { completed: false, resolution: null }
      nodeCompleted = actionIsReady && nodeResolutionResult.completed
      const retryExpectedSpeakers = plannedSpeakers(directorState.currentNode, nodeCompleted ? 'resolved' : 'unresolved', allowedNames)
      if (retryExpectedSpeakers && !followsSpeakerPlan(result.messages, retryExpectedSpeakers)) throw new Error('Provider did not follow the required teammate sequence.')
    }
    const expectedEvent = eventAfterAssessment(directorState, nodeCompleted)
    if (!allowedEvents.includes(result.event)) result.event = eventChain.find((tag) => allowedEvents.includes(tag)) || allowedEvents[0] || 'TEAM_RESPONSE'
    if (expectedEvent && allowedEvents.includes(expectedEvent)) result.event = expectedEvent
    const levelOneBoardNodes = ['state_preference', 'clarify_scope', 'invite_evidence', 'integrate_views', 'confirm_commitments']
    const mayUpdateBoard = level !== 1 || levelOneBoardNodes.includes(directorState.currentNode?.id)
    result.boardUpdates = Array.isArray(result.boardUpdates) && mayUpdateBoard
      ? result.boardUpdates.filter((update) => board.some((item) => item.id === update.id) && [...allowedNames, 'You'].includes(update.owner) && ['claimed', 'done'].includes(update.status)).slice(0, 2)
      : []
    result.skillAccepted = skillResult.accepted
    result.actionPreviouslyRecognized = actionWasAlreadyRecognised
    result.actionReady = actionIsReady
    result.skillAssessment = skillResult.assessment
    result.currentNodeId = directorState.currentNode?.id || null
    result.nodeCompleted = nodeCompleted
    result.nodeResolution = nodeResolutionResult.resolution || result.nodeResolution || null
    result.nextNodeId = nodeCompleted ? directorState.nextNode?.id || null : directorState.currentNode?.id || null
    result.recognizedSkillId = skillResult.accepted ? directorState.currentNode?.skillId || null : null
    result.allRequiredSkillsComplete = nodeCompleted && !directorState.nextNode
    result.nodeMemory = safeConclusion(result, directorState, userText, nodeCompleted)
    result.roleStateUpdates = nodeCompleted ? (directorState.currentNode?.stateAfter || {}) : {}
    response.json(result)
  } catch (error) {
    response.status(502).json({ error: providerFailure(error, 'AI response could not be used') })
  }
})

app.listen(port, '127.0.0.1', () => console.log(`PerspeakAI API server listening on http://127.0.0.1:${port}`))
