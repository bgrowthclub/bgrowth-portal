import { forwardRef, type TextareaHTMLAttributes } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
}

/** Sibling of TextField for the one case it doesn't cover: a multi-line value. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, id, className = "", ...props }, ref) => {
    const fieldId = id ?? props.name;
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={fieldId} className="text-sm font-medium text-navy-700 dark:text-white/80">
          {label}
        </label>
        <textarea
          ref={ref}
          id={fieldId}
          className={`input-field resize-none ${error ? "border-red-400 focus:border-red-400 focus:ring-red-100" : ""} ${className}`}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${fieldId}-error` : undefined}
          {...props}
        />
        {error && (
          <p id={`${fieldId}-error`} className="text-xs font-medium text-red-500">
            {error}
          </p>
        )}
      </div>
    );
  },
);
Textarea.displayName = "Textarea";
