import assert from 'node:assert/strict'
import test from 'node:test'
import { actionIsReadyForResolution, createDirectorState, eventAfterAssessment, validateActionAssessment, validateNodeResolution } from '../server/scenario-engine.mjs'

const contract = {
  nodes: [
    { id: 'observe', skillId: 'read_risk', event: 'TASK_AMBIGUITY', objective: 'Name the risk.', completionEvidence: 'Say why direction is needed.', primaryResponder: 'Alex', supportingResponder: 'Sophie' },
    { id: 'enter', skillId: 'enter', event: 'ROLE_AMBIGUITY', objective: 'State a preference.', completionEvidence: 'State one contribution.', primaryResponder: 'Alex' },
  ],
}

test('starts at the first node and assigns its responders', () => {
  const state = createDirectorState(contract, [])
  assert.equal(state.currentNode.id, 'observe')
  assert.equal(state.currentEvent, 'TASK_AMBIGUITY')
  assert.equal(state.nextNode.id, 'enter')
  assert.equal(state.currentNode.primaryResponder, 'Alex')
})

test('does not accept generic agreement even with the correct node identifier', () => {
  const state = createDirectorState(contract, [])
  const result = validateActionAssessment({ directorState: state, userText: 'Okay, I agree.', assessment: { nodeId: 'observe', skillId: 'read_risk', status: 'met', evidence: 'the direction is unclear' } })
  assert.equal(result.accepted, false)
  assert.equal(eventAfterAssessment(state, result.accepted), 'TASK_AMBIGUITY')
})

test('accepts learner evidence without a selected card', () => {
  const state = createDirectorState(contract, [])
  const result = validateActionAssessment({ directorState: state, userText: 'I think the direction is still unclear before we divide the sections.', assessment: { nodeId: 'observe', skillId: 'read_risk', status: 'met', evidence: 'direction is still unclear', feedback: 'You named the risk.' } })
  assert.equal(result.accepted, true)
  assert.equal(result.assessment.skillId, 'read_risk')
  assert.equal(eventAfterAssessment(state, result.accepted), 'ROLE_AMBIGUITY')
})

test('rejects an out-of-node action even when the learner quoted evidence', () => {
  const state = createDirectorState(contract, [])
  const result = validateActionAssessment({ directorState: state, userText: 'I would like to take the research section.', assessment: { nodeId: 'enter', skillId: 'enter', status: 'met', evidence: 'take the research section' } })
  assert.equal(result.accepted, false)
})

test('moves to the second node only after the first is complete', () => {
  const state = createDirectorState(contract, ['observe'])
  assert.equal(state.currentNode.id, 'enter')
  assert.equal(state.currentEvent, 'ROLE_AMBIGUITY')
})

test('keeps only conclusions from completed nodes', () => {
  const state = createDirectorState(contract, ['observe'], {
    observe: 'Agree on one main direction before splitting work.',
    enter: 'This must not be visible yet.',
  })
  assert.deepEqual(state.nodeConclusions, {
    observe: 'Agree on one main direction before splitting work.',
  })
})

test('does not advance a node until its project facts and all confirmations exist', () => {
  const resolutionContract = {
    nodes: [{
      id: 'direction',
      skillId: 'read_risk',
      event: 'TASK_AMBIGUITY',
      objective: 'Choose a direction.',
      resolutionRequirements: {
        facts: ['mainDirection', 'projectFocus', 'evidenceLink'],
        minTeamConfirmations: 3,
        requireAllTeammates: true,
      },
    }],
  }
  const state = createDirectorState(resolutionContract)
  const messages = [
    { speaker: 'Alex', text: 'I agree with the direction.' },
    { speaker: 'Sophie', text: 'That focus works for the evidence.' },
    { speaker: 'Ryan', text: 'I can support that choice.' },
  ]
  const incomplete = validateNodeResolution({
    directorState: state,
    allowedNames: ['Alex', 'Sophie', 'Ryan'],
    messages,
    resolution: {
      nodeId: 'direction',
      status: 'complete',
      summary: 'The team chose one clear direction.',
      facts: { mainDirection: 'Campus support access', projectFocus: 'Finding services after six pm' },
      confirmedBy: ['Alex', 'Sophie', 'Ryan'],
    },
  })
  assert.equal(incomplete.completed, false)

  const complete = validateNodeResolution({
    directorState: state,
    allowedNames: ['Alex', 'Sophie', 'Ryan'],
    messages,
    resolution: {
      nodeId: 'direction',
      status: 'complete',
      summary: 'The group will focus on helping students find campus support after six pm, because that is where the interviews show the clearest gap.',
      facts: {
        mainDirection: 'Campus support access after six pm',
        projectFocus: 'A finder for late-night support services',
        evidenceLink: 'Interview notes show students cannot locate the right service at night',
      },
      confirmedBy: ['Alex', 'Sophie', 'Ryan'],
    },
  })
  assert.equal(complete.completed, true)
})

test('keeps task-resolution checking available after the skill action happened in an earlier turn', () => {
  assert.equal(actionIsReadyForResolution({ actionAccepted: true }), true)
  assert.equal(actionIsReadyForResolution({ actionPreviouslyRecognized: true }), true)
  assert.equal(actionIsReadyForResolution({}), false)
})
