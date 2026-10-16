// Decisions the firm must be able to show later: judgment calls, elections, due
// diligence and penalty decisions. Each is an event with the authority relied on
// (the rules refuse one without it), so it travels with the file.
import { useState } from 'react'
import { Icon, Tag } from '../components/ui'
import { Table, Th, Tr, Td } from '../components/Table'
import { useDerived } from '../state/app'
import { fmtDate } from '../lib/format'
import type { Payloads } from '../lib/workpaper/events'
import { ActionButton } from './ActionButton'
import { usePeople } from './people'
import type { Finding } from '../lib/checks/types'

export type DecisionKind = Payloads['decision.recorded']['kind']

export const KIND_LABEL: Record<DecisionKind, string> = {
  judgment: 'Judgment call', election: 'Election', due_diligence: 'Due diligence', penalty: 'Penalty decision',
}

const CHOICES: Record<DecisionKind, string[]> = {
  judgment: ['Keep the engine treatment', 'Use the alternative', 'Raised with the client'],
  election: ['Make the election', 'Do not make the election', 'Raised with the client'],
  due_diligence: ['Completed: Form 8867 knowledge and documentation requirements met', 'Not completed: more information needed from the client'],
  penalty: ['Accept the penalty as computed', 'Request first-time abatement', 'Request a waiver (reasonable cause)', 'Use the annualized income method (Form 2210 Schedule AI)'],
}

/** The decision a finding asks for, by what it is about. */
export function decisionKindFor(f: Pick<Finding, 'id' | 'title' | 'severity'>): DecisionKind | null {
  if (/DUE_DILIGENCE/.test(f.id)) return 'due_diligence'
  if (/penalt/i.test(f.title)) return 'penalty'
  if (f.severity !== 'judgment') return null
  return /\belect|section 179|special depreciation/i.test(f.title) ? 'election' : 'judgment'
}

export function DecisionForm({ kind: initial, topic, refs, rationale, fixedTopic = false }: {
  kind: DecisionKind; topic: string; refs: string[]; rationale?: string; fixedTopic?: boolean
}) {
  const [kind, setKind] = useState<DecisionKind>(initial)
  const [choice, setChoice] = useState(CHOICES[initial][0])
  const [subject, setSubject] = useState(topic)
  const [authority, setAuthority] = useState('')
  const pickKind = (k: DecisionKind) => { setKind(k); setChoice(CHOICES[k][0]) }
  const cls = 'w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-body placeholder:text-faint'
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[auto_1fr] items-center gap-2">
        <select value={kind} onChange={(e) => pickKind(e.target.value as DecisionKind)} aria-label="Kind of decision" className="rounded-lg border border-line bg-surface px-2 py-1.5 text-body">
          {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {fixedTopic ? <span className="truncate text-meta text-muted">{rationale ?? topic}</span>
          : <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="What it is about (e.g. Form 2210 underpayment penalty)" className={cls} />}
      </div>
      <select value={choice} onChange={(e) => setChoice(e.target.value)} aria-label="Decision" className={cls}>
        {CHOICES[kind].map((c) => <option key={c}>{c}</option>)}
      </select>
      <input value={authority} onChange={(e) => setAuthority(e.target.value)} placeholder="Authority relied on (e.g. Treas. Reg. 1.263(a)-3, IRC 6695(g))" className={cls} />
      <ActionButton size="sm" variant="primary" done={`${KIND_LABEL[kind]} recorded`}
        disabledReason={!subject.trim() ? 'Say what the decision is about.' : null}
        actions={{ type: 'decision.recorded', refs, payload: { kind, topic: subject.trim(), choice, authority, rationale } }}
        onDone={() => { setAuthority(''); if (!fixedTopic) setSubject('') }}>
        <Icon name="scale" size={13} />Record decision
      </ActionButton>
    </div>
  )
}

/** Every decision on record, newest first. */
export function DecisionList() {
  const d = useDerived()
  const people = usePeople()
  const list = [...d.decisions].reverse()
  if (!list.length) return <p className="px-4 py-3 text-meta text-muted">No decisions recorded yet.</p>
  return (
    <Table dense className="rounded-none border-0">
      <thead><tr><Th>Kind</Th><Th>About</Th><Th>Decision</Th><Th>Authority</Th><Th>By</Th></tr></thead>
      <tbody>{list.map((e) => (
        <Tr key={e.id}>
          <Td><Tag tone={e.payload.kind === 'due_diligence' ? 'good' : e.payload.kind === 'penalty' ? 'warn' : 'accent'}>{KIND_LABEL[e.payload.kind]}</Tag></Td>
          <Td className="text-meta">{e.payload.rationale ?? e.payload.topic}</Td>
          <Td className="text-meta">{e.payload.choice}</Td>
          <Td className="text-micro text-muted">{e.payload.authority}</Td>
          <Td className="text-micro text-muted">{people(e.actor).name}<div className="text-faint">{fmtDate(e.simAt)}</div></Td>
        </Tr>
      ))}</tbody>
    </Table>
  )
}
