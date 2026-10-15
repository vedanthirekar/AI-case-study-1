// Recompute a line from its inputs or sources without trusting the engine.
// Works for sums (the engine does not store signs, so every sign pattern is
// tried), carries and source totals. Anything else is left to the engine rule.
import type { Model } from '../packet/model'
import { num } from '../packet/model'

export interface Recompute { ok: boolean | null; detail: string; expected?: number }

const TOL = 1.5 // engine rounds each line to whole dollars

export function recompute(m: Model, key: string): Recompute {
  const l = m.current.lines.get(key)
  if (!l || typeof l.value !== 'number') return { ok: null, detail: 'Text line: nothing to recompute.' }
  const inputs = l.inputs.map((k) => m.current.lines.get(k)).filter(Boolean)
  const nums = inputs.map((x) => num(x))

  if (l.rule === 'R-CARRY' && inputs.length >= 1) {
    const ok = nums.some((n) => Math.abs(n - (l.value as number)) <= TOL)
    return { ok, expected: nums[0], detail: ok ? `Carried from ${l.inputs[0]} and matches.` : `Should carry ${l.inputs[0]} (${nums[0].toLocaleString('en-US')}).` }
  }

  if (l.rule === 'R-SUM' && inputs.length && inputs.length <= 14) {
    for (let mask = 0; mask < 1 << nums.length; mask++) {
      let s = 0
      for (let i = 0; i < nums.length; i++) s += mask & (1 << i) ? -nums[i] : nums[i]
      if (Math.abs(s - (l.value as number)) <= TOL) {
        const minus = nums.map((_, i) => mask & (1 << i)).filter(Boolean).length
        return { ok: true, expected: s, detail: `Recomputed from ${inputs.length} input${inputs.length > 1 ? 's' : ''}${minus ? ` (${minus} subtracted)` : ''}: ties.` }
      }
    }
    return { ok: false, detail: `No combination of the ${inputs.length} inputs adds to ${(l.value as number).toLocaleString('en-US')}.` }
  }

  const evs = l.sources.map((s) => m.evs.get(s)).filter((e) => e && typeof e.value === 'number')
  if (/SUM$/.test(l.rule) && evs.length && !inputs.length) {
    const s = evs.reduce((a, e) => a + (e!.value as number), 0)
    const ok = Math.abs(s - (l.value as number)) <= TOL
    return { ok, expected: s, detail: ok ? `Sum of ${evs.length} source values: ties.` : `Sources add to ${s.toLocaleString('en-US')}.` }
  }
  return { ok: null, detail: 'Computed by an engine rule; see the rule text.' }
}
