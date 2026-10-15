// Dense table primitives. The header row, row padding and dividers are the
// previous project's matrix and list styles; the previous project built them
// from CSS grid, these use a real <table> so columns size themselves and
// screen readers get headers.
//
// For hundreds of rows, keep this markup and virtualize the <tbody> rows
// (e.g. @tanstack/react-virtual) rather than switching to a grid.
//
//   <Table dense>
//     <thead><tr><Th>Line</Th><Th>Label</Th><Th num>Amount</Th></tr></thead>
//     <tbody>
//       <Tr onClick={...} selected={sel === id}><Td mono>F1040.1a</Td><Td>Wages</Td><Td num>212,400</Td></Tr>
//     </tbody>
//   </Table>
import { cx } from './ui'

export function Table({ children, dense = false, sticky = true, className = '' }) {
  return (
    <div className={cx('pane overflow-auto rounded-xl2 border border-line bg-surface', className)}>
      <table className={cx('w-full border-collapse text-left', dense ? 'text-meta' : 'text-body',
        sticky && '[&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10',
        dense ? '[&_td]:px-3 [&_td]:py-1.5 [&_th]:px-3 [&_th]:py-2' : '[&_td]:px-4 [&_td]:py-2.5 [&_th]:px-4 [&_th]:py-2.5')}>
        {children}
      </table>
    </div>
  )
}

export function Th({ children, num = false, className = '', ...rest }) {
  return (
    <th className={cx('whitespace-nowrap border-b border-line2 bg-bgtint text-micro font-bold uppercase tracking-wider text-faint',
      num && 'text-right', className)} {...rest}>
      {children}
    </th>
  )
}

// A clickable row says so: pointer, hover tint, and an accent rule when selected
// (the same rule the side nav uses for the active item).
export function Tr({ children, onClick, selected = false, muted = false, className = '', ...rest }) {
  return (
    <tr onClick={onClick}
      className={cx('border-b border-line2 last:border-0 transition-colors',
        onClick && 'cursor-pointer hover:bg-slateSoft',
        selected && 'bg-accent-soft/60 shadow-[inset_2px_0_0_rgb(var(--c-accent))]',
        muted && 'text-faint', className)} {...rest}>
      {children}
    </tr>
  )
}

// `num` right-aligns with tabular figures; `mono` is for ids and keys.
export function Td({ children, num = false, mono = false, className = '', ...rest }) {
  return (
    <td className={cx('align-middle', num && 'tnum whitespace-nowrap text-right', mono && 'font-mono text-micro text-muted', className)} {...rest}>
      {children}
    </td>
  )
}

// Group heading row inside a long table (e.g. per form or per area).
export function TGroup({ children, colSpan = 99, right }) {
  return (
    <tr className="border-b border-line2 bg-bgtint/50">
      <td colSpan={colSpan} className="text-micro font-bold uppercase tracking-wider text-faint">
        <span className="flex items-center justify-between gap-2">{children}{right && <span className="tnum normal-case tracking-normal">{right}</span>}</span>
      </td>
    </tr>
  )
}
