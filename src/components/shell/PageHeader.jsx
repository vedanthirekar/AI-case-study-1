// One page opening, used by every top-level screen. Copied unchanged from the
// previous project.
import { Icon, cx } from '../ui'

export default function PageHeader({ eyebrow, title, subtitle, icon, actions, className = '' }) {
  return (
    <div className={cx('flex flex-wrap items-end justify-between gap-3', className)}>
      <div className="min-w-0">
        {eyebrow && (
          <div className="flex items-center gap-1.5 text-meta font-semibold uppercase tracking-wide text-accent">
            {icon && <Icon name={icon} size={13} />} {eyebrow}
          </div>
        )}
        <h1 className="mt-0.5 font-display text-display font-bold">{title}</h1>
        {subtitle && <p className="mt-0.5 text-body text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
