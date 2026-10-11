import type { CalculatorField } from "../types";

interface Props {
  field: CalculatorField;
  value: string | number | undefined;
  onChange: (value: string | number) => void;
}

const NUMERIC = ["number", "currency", "percentage", "slider"];

/** One calculator input, by its Studio field type (same as the Website's CalculatorFieldInput). */
export function CalculatorFieldInput({ field, value, onChange }: Props) {
  const id = `calc-${field.id}`;
  const label = (
    <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold text-navy-900 dark:text-white">
      {field.label}
      {field.required && <span className="text-red-500"> *</span>}
    </label>
  );
  const help = field.tooltip ? <p className="mt-1 text-xs text-navy-400 dark:text-white/40">{field.tooltip}</p> : null;

  if (field.type === "select" || field.type === "radio") {
    const options = field.options ?? [];
    return (
      <div>
        {label}
        {field.type === "select" ? (
          <select id={id} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} className="input-field">
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <div id={id} role="radiogroup" className="flex flex-wrap gap-2">
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={String(value) === o.value}
                onClick={() => onChange(o.value)}
                className={`rounded-xl border px-3 py-2 text-[13px] font-semibold transition-colors ${
                  String(value) === o.value
                    ? "border-workspace-500 bg-workspace-500/10 text-navy-900 dark:text-white"
                    : "border-navy-100 text-navy-500 hover:border-navy-200 dark:border-white/10 dark:text-white/60"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
        {help}
      </div>
    );
  }

  if (field.type === "checkbox" || field.type === "toggle") {
    const on = Number(value) === 1 || value === "true";
    return (
      <div>
        <label className="flex items-center gap-2.5 text-[13.5px] font-semibold text-navy-900 dark:text-white">
          <input
            id={id}
            type="checkbox"
            checked={on}
            onChange={(e) => onChange(e.target.checked ? 1 : 0)}
            className="h-4 w-4 accent-workspace-500"
          />
          {field.label}
        </label>
        {help}
      </div>
    );
  }

  if (NUMERIC.includes(field.type)) {
    const prefix = field.prefix ?? (field.type === "currency" ? "$" : "");
    const suffix = field.suffix ?? (field.type === "percentage" ? "%" : "");
    return (
      <div>
        {label}
        <div className="flex items-center gap-2">
          {field.type === "slider" && (
            <input
              type="range"
              min={field.min ?? 0}
              max={field.max ?? 100}
              step={field.step ?? 1}
              value={Number(value) || 0}
              onChange={(e) => onChange(Number(e.target.value))}
              className="flex-1 accent-workspace-500"
              aria-label={field.label}
            />
          )}
          <div
            className={`flex items-center rounded-xl border border-navy-100 bg-white px-3 focus-within:border-primary dark:border-white/10 dark:bg-navy-700 ${
              field.type === "slider" ? "w-32" : "w-full"
            }`}
          >
            {prefix && <span className="text-sm text-navy-400 dark:text-white/40">{prefix}</span>}
            <input
              id={id}
              type="number"
              inputMode="decimal"
              min={field.min}
              max={field.max}
              step={field.step ?? "any"}
              value={value === "" || value === undefined ? "" : value}
              placeholder={field.placeholder}
              onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full bg-transparent px-1.5 py-3 text-sm text-navy-900 outline-none dark:text-white"
            />
            {suffix && <span className="text-sm text-navy-400 dark:text-white/40">{suffix}</span>}
          </div>
        </div>
        {help}
      </div>
    );
  }

  return (
    <div>
      {label}
      <input
        id={id}
        type={field.type === "date" ? "date" : "text"}
        value={String(value ?? "")}
        placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="input-field"
      />
      {help}
    </div>
  );
}
