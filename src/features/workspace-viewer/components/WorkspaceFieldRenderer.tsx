import type { FieldConfig } from "@/types/workspaceContent";
import { getWorkspaceIcon } from "@/lib/workspaceIcons";

interface WorkspaceFieldRendererProps {
  field: FieldConfig;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

const inputClass =
  "w-full rounded-xl border border-navy-100 bg-white px-3.5 py-2.5 text-sm text-navy-900 placeholder:text-navy-300 outline-none transition-colors focus:border-workspace-500 focus:ring-2 focus:ring-workspace-500/20 dark:border-white/10 dark:bg-navy-700 dark:text-white dark:placeholder:text-white/30";

export function WorkspaceFieldRenderer({ field, value, onChange, error }: WorkspaceFieldRendererProps) {
  const Icon = getWorkspaceIcon(field.icon);
  const fieldId = `field-${field.id}`;

  if (field.type === "title") {
    return (
      <div className="border-b border-navy-50 pb-1 pt-4 first:pt-0 dark:border-white/10 sm:col-span-2">
        <h3 className="text-base font-bold tracking-tight text-navy-800 dark:text-white">{field.label}</h3>
      </div>
    );
  }

  if (field.type === "static_text") {
    return (
      <div className="pt-1 sm:col-span-2">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-navy-500 dark:text-white/60">{field.label}</p>
      </div>
    );
  }

  if (field.type === "image" || field.type === "static_image") {
    const src = field.staticImageUrl ?? field.placeholder;
    return (
      <div className={field.fullWidth !== false ? "sm:col-span-2" : undefined}>
        {src && <img src={src} alt={field.label} className="max-h-64 w-full rounded-lg border border-navy-100 object-cover dark:border-white/10" />}
        {field.label && <p className="mt-1 text-center text-xs text-navy-400 dark:text-white/40">{field.label}</p>}
      </div>
    );
  }

  if (field.type === "file") {
    return (
      <div className={field.fullWidth !== false ? "sm:col-span-2" : undefined}>
        {field.placeholder && (
          <a
            href={field.placeholder}
            download={field.label || "file"}
            className="inline-flex items-center gap-2 rounded-lg border border-navy-100 bg-navy-50 px-4 py-2.5 text-sm font-medium text-navy-700 hover:bg-navy-100 dark:border-white/10 dark:bg-white/5 dark:text-white/80"
          >
            <Icon className="h-4 w-4" />
            {field.label || "Download File"}
          </a>
        )}
      </div>
    );
  }

  if (field.type === "link") {
    const raw = field.placeholder ?? "";
    const href = raw && !raw.startsWith("http://") && !raw.startsWith("https://") && !raw.startsWith("#") ? `https://${raw}` : raw || "#";
    return (
      <div className={field.fullWidth ? "sm:col-span-2" : undefined}>
        <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-workspace-600 hover:underline dark:text-workspace-300">
          <Icon className="h-4 w-4" />
          {field.label || raw}
        </a>
      </div>
    );
  }

  return (
    <div className={field.fullWidth ? "flex flex-col gap-1.5 sm:col-span-2" : "flex flex-col gap-1.5"}>
      <label htmlFor={fieldId} className="flex items-center gap-1.5 text-sm font-medium text-navy-700 dark:text-white/80">
        <Icon className="h-3.5 w-3.5 text-workspace-500" />
        {field.label}
        {field.required && <span className="text-red-500">*</span>}
      </label>

      {field.type === "checkbox" ? (
        <label className="flex cursor-pointer items-center gap-2">
          <input
            id={fieldId}
            type="checkbox"
            checked={value === "true"}
            onChange={(event) => onChange(String(event.target.checked))}
            className="h-4 w-4 rounded accent-workspace-500"
          />
          <span className="text-sm text-navy-700 dark:text-white/70">{field.placeholder || field.label}</span>
        </label>
      ) : field.type === "select" ? (
        <select id={fieldId} value={value} onChange={(event) => onChange(event.target.value)} className={inputClass}>
          <option value="">Select…</option>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : field.type === "textarea" ? (
        <textarea
          id={fieldId}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
          rows={3}
          className={inputClass}
        />
      ) : (
        <input
          id={fieldId}
          type={field.type === "phone" ? "tel" : field.type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
          className={inputClass}
        />
      )}
      {error && <p className="text-xs font-medium text-red-500">{error}</p>}
    </div>
  );
}
