interface WorkspaceNotesFieldProps {
  value: string;
  onChange: (value: string) => void;
}

export function WorkspaceNotesField({ value, onChange }: WorkspaceNotesFieldProps) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Add any notes about this session…"
      rows={6}
      className="w-full rounded-xl border border-navy-100 bg-white px-3.5 py-2.5 text-sm text-navy-900 placeholder:text-navy-300 outline-none transition-colors focus:border-workspace-500 focus:ring-2 focus:ring-workspace-500/20 dark:border-white/10 dark:bg-navy-700 dark:text-white dark:placeholder:text-white/30"
    />
  );
}
