import { useMemo, useState } from "react";
import { Printer, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CalculatorFieldInput } from "./CalculatorFieldInput";
import { buildDefaultValues, calcCompletion, computeAll, formatResult } from "../formulaEngine";
import type { CalculatorConfig, CalculatorSavedData, CalculatorValues } from "../types";

interface Props {
  config: CalculatorConfig;
  initialData?: Partial<CalculatorSavedData>;
  /** Present for a saved calculation (a document); absent on the blank copy, which isn't saved. */
  onSave?: (data: CalculatorSavedData) => Promise<void>;
}

/**
 * Runs a calculator published from BGrowth Studio — the same screen as the
 * Website's CalculatorRunner: inputs by section, results updating as the
 * member types, quick figures, the scenario table and notes. Same formulas
 * and rounding as the Studio.
 */
export function CalculatorRunner({ config, initialData, onSave }: Props) {
  const defaults = useMemo(() => buildDefaultValues(config), [config]);
  const [values, setValues] = useState<CalculatorValues>(() => ({ ...defaults, ...(initialData?.values ?? {}) }));
  const [notes, setNotes] = useState(initialData?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const results = computeAll(config, values);
  const completion = calcCompletion(config, values);
  const highlight = config.results.filter((r) => r.highlight);
  const others = config.results.filter((r) => !r.highlight);
  const show = (formulaId: string, type: string, prefix?: string, suffix?: string) =>
    formatResult(results[formulaId] ?? 0, type, prefix, suffix);

  async function save() {
    if (!onSave) return;
    setSaving(true);
    setError(null);
    setJustSaved(false);
    try {
      await onSave({ kind: "calculator", values, notes });
      setJustSaved(true);
      window.setTimeout(() => setJustSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-5">
        {config.sections.map((section) => (
          <section key={section.id} className="card p-6">
            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-wide text-workspace-600 dark:text-workspace-300">
                Step {section.number}
              </p>
              <h2 className="text-lg font-bold text-navy-900 dark:text-white">{section.title}</h2>
              {section.description && (
                <p className="mt-0.5 text-[13.5px] text-navy-500 dark:text-white/50">{section.description}</p>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {section.fields.map((field) => (
                <CalculatorFieldInput
                  key={field.id}
                  field={field}
                  value={values[field.id]}
                  onChange={(v) => setValues((current) => ({ ...current, [field.id]: v }))}
                />
              ))}
            </div>
          </section>
        ))}

        {config.scenarios && config.scenarios.rows.length > 0 && (
          <section className="card overflow-x-auto p-6">
            <h2 className="text-lg font-bold text-navy-900 dark:text-white">{config.scenarios.title}</h2>
            {config.scenarios.description && (
              <p className="mt-0.5 text-[13.5px] text-navy-500 dark:text-white/50">{config.scenarios.description}</p>
            )}
            <table className="mt-4 w-full min-w-[420px] text-left text-[13.5px]">
              <tbody>
                {config.scenarios.rows.map((row) => {
                  const r = computeAll(config, { ...values, ...row.fieldOverrides });
                  return (
                    <tr
                      key={row.label}
                      className={`border-t border-navy-100/60 dark:border-white/10 ${row.isRecommended ? "bg-workspace-500/[0.06]" : ""}`}
                    >
                      <td className="py-2.5 pr-3 font-semibold text-navy-900 dark:text-white">
                        {row.label}
                        {row.isRecommended && (
                          <span className="ml-2 text-[11px] font-bold text-workspace-600 dark:text-workspace-300">Recommended</span>
                        )}
                      </td>
                      {row.resultIds.map((id) => {
                        const item = config.results.find((x) => x.id === id || x.formulaId === id);
                        const formulaId = item?.formulaId ?? id;
                        return (
                          <td key={id} className="py-2.5 pr-3 text-navy-600 dark:text-white/70">
                            <span className="block text-[11px] text-navy-400 dark:text-white/40">{item?.label ?? id}</span>
                            {formatResult(r[formulaId] ?? 0, item?.type ?? "number", item?.prefix, item?.suffix)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}

        {config.notesEnabled && (
          <section className="card p-6">
            <label htmlFor="calc-notes" className="text-lg font-bold text-navy-900 dark:text-white">
              Notes
            </label>
            <textarea
              id="calc-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="input-field mt-3"
            />
          </section>
        )}

        {config.footer && <p className="text-[12.5px] text-navy-400 dark:text-white/40">{config.footer}</p>}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
        <div className="card p-6">
          {highlight.map((r) => (
            <div key={r.id} className="mb-4">
              <p className="text-[13px] font-semibold text-navy-500 dark:text-white/50">{r.label}</p>
              <p className="text-4xl font-bold text-navy-900 dark:text-white">{show(r.formulaId, r.type, r.prefix, r.suffix)}</p>
              {r.description && <p className="mt-0.5 text-xs text-navy-400 dark:text-white/40">{r.description}</p>}
            </div>
          ))}
          <dl className="space-y-2.5">
            {others.map((r) => (
              <div key={r.id} className="flex items-baseline justify-between gap-3 border-t border-navy-100/60 pt-2.5 dark:border-white/10">
                <dt className="text-[13.5px] text-navy-500 dark:text-white/60">{r.label}</dt>
                <dd className="text-[15px] font-semibold text-navy-900 dark:text-white">{show(r.formulaId, r.type, r.prefix, r.suffix)}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-5">
            <div className="flex justify-between text-xs text-navy-400 dark:text-white/40">
              <span>Required fields</span>
              <span>{completion}%</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-navy-50 dark:bg-white/10">
              <div className="h-full rounded-full bg-workspace-500" style={{ width: `${completion}%` }} />
            </div>
          </div>
        </div>

        {config.quickCalcs && config.quickCalcs.length > 0 && (
          <div className="card p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-navy-400 dark:text-white/40">Quick figures</p>
            <dl className="mt-3 space-y-2">
              {config.quickCalcs.map((q) => (
                <div key={q.label} className="flex items-baseline justify-between gap-3">
                  <dt className="text-[13px] text-navy-500 dark:text-white/60">{q.label}</dt>
                  <dd className="text-sm font-semibold text-navy-900 dark:text-white">{show(q.formulaId, q.type, q.prefix, q.suffix)}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <div className="no-print flex flex-wrap items-center gap-2">
          {onSave && (
            <Button type="button" size="sm" onClick={() => void save()} isLoading={saving}>
              <Save className="h-4 w-4" />
              {saving ? "Saving…" : "Save"}
            </Button>
          )}
          <Button type="button" size="sm" variant="secondary" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Print / PDF
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              setValues(defaults);
              setNotes("");
            }}
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
          {justSaved && <span className="text-xs font-medium text-emerald-600">Saved ✓</span>}
        </div>
        {error && <p className="text-[13px] text-red-500">{error}</p>}
      </aside>
    </div>
  );
}
