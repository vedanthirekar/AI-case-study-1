// Sensitive data is masked by default. Revealing it is an action: it passes the
// rules (clearance) and is logged as an event the Firm screen lists.
import { useState } from 'react'
import { Tooltip, Icon, cx } from '../components/ui'
import { useApp, useCan } from '../state/app'
import { useToast } from '../components/Toast'

/** Patterns treated as sensitive anywhere they are printed. */
const PATTERNS: RegExp[] = [
  /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
  /\bSE\d{2}(?: \d{4}){5}\b/g, // Swedish IBAN
  /\b(?:4483019276|990000017)\b/g, // household bank account and routing number
]

export function maskText(s: string): string {
  let out = s
  for (const p of PATTERNS) out = out.replace(p, (x) => x.replace(/[0-9](?=(?:[^0-9]*[0-9]){4})/g, '•'))
  return out
}

export function hasSensitive(s: string) {
  return PATTERNS.some((p) => { p.lastIndex = 0; return p.test(s) })
}

/** A masked value with a logged reveal control. */
export function Sensitive({ value, field, label, className = '' }: { value: string; field: string; label: string; className?: string }) {
  const [shown, setShown] = useState(false)
  const can = useCan()
  const dispatch = useApp((s) => s.dispatch)
  const toast = useToast()
  const action = { type: 'sensitive.revealed' as const, refs: [field], payload: { field, label } }
  const verdict = can(action)
  const reveal = async () => {
    const r = await dispatch(action)
    if (r.ok) { setShown(true); toast({ title: 'Revealed and logged', body: label, tone: 'default' }) }
  }
  return (
    <span className={cx('inline-flex items-center gap-1 font-mono', className)}>
      {shown ? value : maskText(value)}
      {!shown && (
        <Tooltip label={verdict.ok ? 'Reveal (logged)' : verdict.reason}>
          <button onClick={reveal} disabled={!verdict.ok} aria-label="Reveal" className="text-faint transition hover:text-accent disabled:cursor-not-allowed disabled:opacity-50">
            <Icon name={verdict.ok ? 'eye' : 'lock'} size={13} />
          </button>
        </Tooltip>
      )}
    </span>
  )
}
