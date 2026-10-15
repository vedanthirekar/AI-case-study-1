// Tabs in the two forms the previous project used.
//   variant="underline" - page-level tabs under a header (accent rule under the active tab)
//   variant="fill"      - equal-width tabs filling a panel (drawer, side rail)
// Controlled: the parent owns `value`, ideally from the URL so tabs are deep-linkable.
//
//   <Tabs value={tab} onChange={setTab} items={[
//     { key: 'trace', label: 'Trace', icon: 'link' },
//     { key: 'notes', label: 'Notes', icon: 'note', count: 3 },
//   ]} />
import { Icon, cx } from './ui'

export default function Tabs({ items, value, onChange, variant = 'underline', className = '' }) {
  const fill = variant === 'fill'
  return (
    <div role="tablist" className={cx('flex', fill ? 'border-b border-line' : 'gap-1', className)}>
      {items.map((t) => {
        const active = t.key === value
        return (
          <button key={t.key} role="tab" aria-selected={active} onClick={() => onChange?.(t.key)}
            className={cx('flex items-center gap-1.5 border-b-2 font-semibold transition',
              fill ? 'flex-1 justify-center px-3 py-2.5 text-meta' : 'rounded-t-lg px-3 py-2 text-body',
              active ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-ink')}>
            {t.icon && <Icon name={t.icon} size={fill ? 13 : 14} />}
            {t.label}
            {t.count > 0 && (
              <span className={cx('tnum grid h-4 min-w-4 place-items-center rounded-full px-1 text-micro font-bold',
                t.countTone === 'warn' ? 'bg-warn-soft text-warn' : 'bg-accent-soft text-accent')}>
                {t.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
