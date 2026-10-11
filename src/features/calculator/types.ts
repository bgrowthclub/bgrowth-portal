// A calculator published from BGrowth Studio's Calculator Engine (Portal
// products.content when content_type is 'calculator'). Same shape as
// Studio's CalculatorConfig (bgrowth-studio src/modules/calculator-engine/
// types.ts) — the parts the Portal runs (same file as the Website's src/modules/calculator/types.ts). Read only; built
// in the Studio.

export type CalculatorFieldType =
  | 'number'
  | 'currency'
  | 'percentage'
  | 'text'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'toggle'
  | 'slider'
  | 'date'

export interface CalculatorField {
  id: string
  label: string
  type: CalculatorFieldType
  defaultValue?: string | number
  placeholder?: string
  tooltip?: string
  required?: boolean
  prefix?: string
  suffix?: string
  min?: number
  max?: number
  step?: number
  options?: { label: string; value: string }[]
}

export interface CalculatorSection {
  id: string
  number: number
  title: string
  description?: string
  icon?: string
  fields: CalculatorField[]
}

export interface CalculatorFormula {
  id: string
  name: string
  expression: string
  variables: string[]
}

export type CalculatorResultType = 'currency' | 'percentage' | 'number' | 'text' | 'status' | 'recommendation'

export interface CalculatorResultItem {
  id: string
  label: string
  formulaId: string
  type: CalculatorResultType
  highlight?: boolean
  prefix?: string
  suffix?: string
  description?: string
}

export interface CalculatorQuickCalc {
  label: string
  formulaId: string
  type: CalculatorResultType
  prefix?: string
  suffix?: string
}

export interface CalculatorScenarios {
  id: string
  title: string
  description?: string
  rows: { label: string; isRecommended?: boolean; fieldOverrides: Record<string, number | string>; resultIds: string[] }[]
}

export interface CalculatorConfig {
  productId: string
  name: string
  subtitle?: string
  category?: string
  primaryColor?: string
  sections: CalculatorSection[]
  formulas: CalculatorFormula[]
  results: CalculatorResultItem[]
  quickCalcs?: CalculatorQuickCalc[]
  scenarios?: CalculatorScenarios
  notesEnabled?: boolean
  footer?: string
}

export type CalculatorValues = Record<string, string | number>
export type CalculatorResults = Record<string, number>

// What a saved calculation keeps (workspace_instances.data).
export interface CalculatorSavedData {
  kind: 'calculator'
  values: CalculatorValues
  notes?: string
}

export function isCalculatorConfig(content: unknown): content is CalculatorConfig {
  const c = content as Partial<CalculatorConfig> | null
  return Boolean(c && Array.isArray(c.sections) && Array.isArray(c.formulas) && Array.isArray(c.results))
}
