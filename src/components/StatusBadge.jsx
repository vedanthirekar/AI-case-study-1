// One badge component per vocabulary, plus a legend that explains it.
// The previous project had this for its field states; this version takes the
// vocabulary as data so each one (verification state, severity, filing status)
// is defined once and rendered identically everywhere.
//
//   export const VERIFICATION = {
//     unverified: { label: 'Unverified', tone: 'muted', icon: 'eye', desc: 'Read by the pipeline; no person has checked it.' },
//     verified:   { label: 'Verified', tone: 'good', icon: 'check', desc: 'A person agreed it to its source.' },
//     open:       { label: 'Open', tone: 'warn', icon: 'alert', desc: 'Has an unresolved question or note.' },
//     blocking:   { label: 'Blocks filing', tone: 'danger', icon: 'lock', desc: 'Must be resolved before filing.' },
//   }
//   <StatusBadge vocab={VERIFICATION} value="verified" />
//   <StatusLegend vocab={VERIFICATION} />
//
// Tones: good | warn | danger | accent | ai | muted (the Tag tones in ui.jsx).
import { Tag, Tooltip, Icon } from './ui'

export default function StatusBadge({ vocab, value, withIcon = true, suffix, className = '' }) {
  const meta = vocab[value]
  if (!meta) return null
  const tag = (
    <Tag tone={meta.tone} className={className}>
      {withIcon && meta.icon && <Icon name={meta.icon} size={11} />}
      {meta.short || meta.label}
      {suffix != null && <span className="tnum opacity-70">· {suffix}</span>}
    </Tag>
  )
  return meta.desc ? <Tooltip label={meta.desc}><span className="cursor-help">{tag}</span></Tooltip> : tag
}

export function StatusLegend({ vocab, title, columns = 2 }) {
  return (
    <div>
      {title && <div className="mb-2 text-micro font-bold uppercase tracking-wider text-faint">{title}</div>}
      <div className={columns === 1 ? 'grid gap-2' : 'grid gap-2 sm:grid-cols-2'}>
        {Object.entries(vocab).map(([key, s]) => (
          <div key={key} className="flex items-start gap-3 rounded-lg border border-line2 bg-surface p-3">
            <StatusBadge vocab={vocab} value={key} />
            <div className="text-meta leading-snug">
              <div className="font-semibold text-ink">{s.label}</div>
              {s.desc && <div className="text-muted">{s.desc}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
