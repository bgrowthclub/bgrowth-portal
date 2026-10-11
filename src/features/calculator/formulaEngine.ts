import type { CalculatorConfig, CalculatorFormula, CalculatorResults, CalculatorValues } from './types'

// The Studio Calculator Engine's formula rules (bgrowth-studio
// src/modules/calculator-engine/formulaEngine.ts, Sprint 77), so a
// calculator gives the same numbers here as in the Studio. Formulas are
// plain arithmetic over field ids; only numbers, operators, parentheses,
// quoted words and a few Math functions may run — anything else gives 0.

// A field's value as a formula sees it: numbers (numeric text too) stay
// numbers, other text (a select choice like "roundtrip") stays text.
function toArg(val: unknown): number | string {
  if (typeof val === 'number') return val
  if (typeof val === 'boolean') return val ? 1 : 0
  const text = String(val ?? '').trim()
  if (text === '') return 0
  return /^-?\d+(\.\d+)?$/.test(text) ? parseFloat(text) : text
}

export function evaluateFormula(formula: CalculatorFormula, values: CalculatorValues): number {
  try {
    const vars = formula.variables
    const args = vars.map((v) => toArg(values[v]))
    const strings: string[] = []
    let expr = formula.expression.replace(/"([A-Za-z0-9 _-]*)"|'([A-Za-z0-9 _-]*)'/g, (_m, dq?: string, sq?: string) => {
      strings.push(dq ?? sq ?? '')
      return `__s${strings.length - 1}`
    })
    vars.forEach((name, i) => {
      expr = expr.replace(new RegExp(`\\b${name}\\b`, 'g'), `__v${i}`)
    })
    const leftover = expr
      .replace(/__v\d+/g, '')
      .replace(/__s\d+/g, '')
      .replace(/Math\.(pow|min|max|round|abs|floor|ceil|sqrt)\b/g, '')
    if (!/^[0-9+\-*/%().,?:<>=!&|\s]*$/.test(leftover)) return 0
    const finalExpr = expr.replace(/__s(\d+)/g, (_m, i: string) => JSON.stringify(strings[Number(i)]))
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const fn = new Function(...vars.map((_, i) => `__v${i}`), `'use strict'; return (${finalExpr});`)
    const result = fn(...args)
    if (typeof result === 'boolean') return result ? 1 : 0
    if (typeof result !== 'number' || !Number.isFinite(result)) return 0
    return result
  } catch {
    return 0
  }
}

// Every formula in order; later formulas see earlier results at full
// precision, the returned results are rounded to 2 decimals.
export function computeAll(config: CalculatorConfig, values: CalculatorValues): CalculatorResults {
  const results: CalculatorResults = {}
  const namespace: CalculatorValues = { ...values }
  for (const formula of config.formulas) {
    const val = evaluateFormula(formula, namespace)
    results[formula.id] = Math.round(val * 100) / 100
    namespace[formula.id] = val
  }
  return results
}

export function buildDefaultValues(config: CalculatorConfig): CalculatorValues {
  const values: CalculatorValues = {}
  for (const section of config.sections) {
    for (const field of section.fields) {
      const numeric = ['number', 'currency', 'percentage', 'slider'].includes(field.type)
      values[field.id] = field.defaultValue ?? (numeric ? 0 : '')
    }
  }
  return values
}

// Share of required fields filled in (0–100).
export function calcCompletion(config: CalculatorConfig, values: CalculatorValues): number {
  const required = config.sections.flatMap((s) => s.fields.filter((f) => f.required))
  if (required.length === 0) return 100
  const filled = required.filter((f) => {
    const v = values[f.id]
    return v !== undefined && v !== '' && v !== 0 && v !== '0'
  })
  return Math.round((filled.length / required.length) * 100)
}

export function formatResult(val: number, type: string, prefix?: string, suffix?: string): string {
  let base: string
  if (type === 'currency') base = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(val)
  else if (type === 'percentage') base = `${val.toFixed(1)}%`
  else base = val.toLocaleString('en-US', { maximumFractionDigits: 2 })
  return `${type === 'currency' ? '' : prefix ?? ''}${base}${suffix ?? ''}`
}
