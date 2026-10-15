import type { ReactNode, HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react'
export function Table(p: { children?: ReactNode; dense?: boolean; sticky?: boolean; className?: string }): JSX.Element
export function Th(p: ThHTMLAttributes<HTMLTableCellElement> & { num?: boolean }): JSX.Element
export function Tr(p: HTMLAttributes<HTMLTableRowElement> & { selected?: boolean; muted?: boolean }): JSX.Element
export function Td(p: TdHTMLAttributes<HTMLTableCellElement> & { num?: boolean; mono?: boolean }): JSX.Element
export function TGroup(p: { children?: ReactNode; colSpan?: number; right?: ReactNode }): JSX.Element
