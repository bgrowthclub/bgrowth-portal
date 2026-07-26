import { useState, type FormEvent } from "react";
import { Button } from "./Button";
import { TextField } from "./TextField";

interface PromptDialogProps {
  isOpen: boolean;
  title: string;
  label: string;
  placeholder?: string;
  confirmLabel: string;
  isSubmitting?: boolean;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

/** Sibling of ConfirmDialog for the one case it doesn't cover: collecting a short text value before proceeding. */
export function PromptDialog({
  isOpen,
  title,
  label,
  placeholder,
  confirmLabel,
  isSubmitting,
  onSubmit,
  onCancel,
}: PromptDialogProps) {
  const [value, setValue] = useState("");

  if (!isOpen) return null;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="prompt-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/50 px-4 animate-fade-in"
      onClick={onCancel}
    >
      <form
        className="card w-full max-w-sm p-6"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h2 id="prompt-dialog-title" className="text-lg font-bold text-navy-900 dark:text-white">
          {title}
        </h2>
        <div className="mt-4">
          <TextField
            label={label}
            value={value}
            placeholder={placeholder}
            autoFocus
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <div className="mt-6 flex gap-3">
          <Button type="button" variant="secondary" className="flex-1" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" isLoading={isSubmitting} disabled={!value.trim()}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </div>
  );
}
