/**
 * The director owns progression; the language model only judges whether the
 * learner's own words created the required collaboration effect. A selected
 * skill card is useful support, never a permission gate.
 */
function legacyNodes(contract = {}) {
  const sequence = Array.isArray(contract.skillSequence) ? contract.skillSequence : []
  const triggers = contract.skillTriggers && typeof contract.skillTriggers === 'object' ? contract.skillTriggers : {}
  return sequence.map((skillId, index) => ({
    id: `legacy_${index + 1}_${skillId}`,
    skillId,
    event: triggers[skillId] || 'TEAM_RESPONSE',
    objective: `Use ${skillId} to move the team forward.`,
    completionEvidence: `The learner performs the ${skillId} communication action.`,
    primaryResponder: 'Alex',
  }))
}

export function createDirectorState(contract = {}, completedNodeIds = [], nodeConclusions = {}) {
  const nodes = Array.isArray(contract.nodes) && contract.nodes.length ? contract.nodes : legacyNodes(contract)
  const completed = nodes.filter((node) => completedNodeIds.includes(node.id)).map((node) => node.id)
  const conclusions = Object.fromEntries(Object.entries(nodeConclusions || {}).filter(([nodeId, value]) => completed.includes(nodeId) && typeof value === 'string' && value.trim()))
  const currentNode = nodes.find((node) => !completed.includes(node.id)) || null
  const currentIndex = currentNode ? nodes.findIndex((node) => node.id === currentNode.id) : -1
  const nextNode = currentIndex >= 0 ? nodes.slice(currentIndex + 1).find((node) => !completed.includes(node.id)) || null : null
  return {
    nodes,
    completedNodeIds: completed,
    nodeConclusions: conclusions,
    currentNode,
    nextNode,
    currentEvent: currentNode?.event || 'CLOSING_WINDOW',
    nextEvent: nextNode?.event || 'CLOSING_WINDOW',
  }
}

export function validateActionAssessment({ assessment, directorState, userText }) {
  const node = directorState.currentNode
  const defaultAssessment = {
    nodeId: node?.id || null,
    skillId: node?.skillId || null,
    status: 'needs_work',
    evidence: '',
    feedback: 'Make one clear move that helps the team solve the situation, then try again.',
  }
  if (!node || !assessment || assessment.nodeId !== node.id || assessment.skillId !== node.skillId || assessment.status !== 'met') {
    return { accepted: false, assessment: { ...defaultAssessment, feedback: assessment?.feedback || defaultAssessment.feedback } }
  }
  const evidence = typeof assessment.evidence === 'string' ? assessment.evidence.trim() : ''
  const appearsInUserTurn = evidence.length >= 4 && userText.toLocaleLowerCase().includes(evidence.toLocaleLowerCase())
  if (!appearsInUserTurn) return { accepted: false, assessment: { ...defaultAssessment, feedback: 'Make that action explicit in your own words, then try again.' } }
  return {
    accepted: true,
    assessment: {
      nodeId: node.id,
      skillId: node.skillId,
      status: 'met',
      evidence,
      feedback: typeof assessment.feedback === 'string' && assessment.feedback.trim() ? assessment.feedback.trim() : 'That gave the team a clearer next move.',
      teamEffect: typeof assessment.teamEffect === 'string' && assessment.teamEffect.trim() ? assessment.teamEffect.trim() : 'The team now has a clearer way to move forward.',
      replay: assessment.replay && typeof assessment.replay === 'object' ? assessment.replay : {},
    },
  }
}

function meaningfulFact(value) {
  return typeof value === 'string' && value.trim().replace(/\s+/g, ' ').length >= 4
}

/**
 * A skill action and a resolved project task are intentionally different.
 * The model may recognise a useful learner move, but it may not advance the
 * meeting until the node's project facts and teammate confirmations exist.
 */
export function validateNodeResolution({ resolution, directorState, allowedNames = [], messages = [] }) {
  const node = directorState.currentNode
  const requirements = node?.resolutionRequirements
  const fallback = { completed: false, resolution: null }
  if (!node) return fallback
  // Earlier scenarios use the legacy action-only progression. Keep that
  // behaviour until they receive explicit task-resolution contracts.
  if (!requirements) return { completed: true, resolution: null }
  if (!resolution || resolution.nodeId !== node.id || resolution.status !== 'complete') return fallback

  const facts = resolution.facts && typeof resolution.facts === 'object' ? resolution.facts : {}
  if (!(requirements.facts || []).every((fact) => meaningfulFact(facts[fact]))) return fallback

  const visibleSpeakers = new Set((messages || []).map((message) => message?.speaker).filter(Boolean))
  const confirmedBy = [...new Set(Array.isArray(resolution.confirmedBy) ? resolution.confirmedBy.filter((name) => allowedNames.includes(name)) : [])]
  if (confirmedBy.length < (requirements.minTeamConfirmations || 0)) return fallback
  if (confirmedBy.some((name) => !visibleSpeakers.has(name))) return fallback
  if (requirements.requireAllTeammates && !allowedNames.every((name) => confirmedBy.includes(name))) return fallback

  const summary = typeof resolution.summary === 'string' ? resolution.summary.trim().replace(/\s+/g, ' ') : ''
  if (summary.length < 8 || summary.length > 220) return fallback
  return { completed: true, resolution: { nodeId: node.id, summary, facts, confirmedBy } }
}

/**
 * The learner may make the required communication move in one turn and add
 * the missing project detail in a later turn. Keep those two checks separate:
 * recognition unlocks resolution checking; it does not by itself advance a
 * node.
 */
export function actionIsReadyForResolution({ actionAccepted = false, actionPreviouslyRecognized = false } = {}) {
  return Boolean(actionAccepted || actionPreviouslyRecognized)
}

export function eventAfterAssessment(directorState, accepted) {
  return accepted ? directorState.nextEvent : directorState.currentEvent
}

// Compatibility exports while clients migrate from the old skill-sequence API.
export function createProgression(contract = {}, completedSkillIds = []) {
  const sequence = contract.skillSequence || []
  const completedNodeIds = completedSkillIds.map((id) => `legacy_${sequence.indexOf(id) + 1}_${id}`)
  const state = createDirectorState(contract, completedNodeIds)
  return { ...state, sequence, completed: completedSkillIds, requiredSkillId: state.currentNode?.skillId || null, nextRequiredSkillId: state.nextNode?.skillId || null }
}

export function validateSkillAssessment({ assessment, progression, userText }) {
  return validateActionAssessment({ assessment: { ...assessment, nodeId: assessment?.nodeId || progression.currentNode?.id }, directorState: progression, userText })
}
