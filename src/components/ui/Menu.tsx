import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export interface MenuItem {
  label: string;
  description?: string;
  onSelect: () => void;
}

interface MenuProps {
  /** Trigger button's visible label/icon content. */
  trigger: ReactNode;
  items: MenuItem[];
  className?: string;
}

/**
 * Generic anchored dropdown menu — business-agnostic, no PDF/workspace
 * awareness, so it's reusable anywhere a toolbar needs a "trigger -> list
 * of labeled actions" pattern. No existing ui/ primitive covered this
 * (ConfirmDialog/PromptDialog are centered modals, a different pattern) —
 * see the Document V1 toolbar migration report for why this was added
 * rather than reusing one of those.
 *
 * Positioning is deliberately simple rather than a full viewport-aware
 * popover: the panel is `right-0`-anchored under its trigger and matches
 * the trigger's own width (`w-full sm:w-auto` on the trigger already makes
 * it full-width on mobile, so the panel inherits that and can't overflow
 * the viewport there; on desktop the trigger is auto-width inside a
 * right-aligned toolbar, so right-anchoring keeps the panel on-screen
 * without measuring DOM at runtime).
 */
export function Menu({ trigger, items, className = "" }: MenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className={`relative w-full sm:w-auto ${className}`}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => setIsOpen((open) => !open)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-navy-100 bg-white px-4 py-2 text-xs font-semibold text-navy-900 shadow-soft transition-all duration-200 hover:border-primary/40 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.98] dark:border-white/10 dark:bg-navy-800 dark:text-white sm:w-auto"
      >
        {trigger}
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 z-40 mt-1.5 w-full min-w-[220px] overflow-hidden rounded-xl border border-navy-100 bg-white py-1.5 shadow-soft-lg dark:border-white/10 dark:bg-navy-800 sm:w-64"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                item.onSelect();
              }}
              className="flex w-full flex-col items-start gap-0.5 px-4 py-2.5 text-left text-sm font-medium text-navy-900 transition-colors hover:bg-navy-50 focus-visible:bg-navy-50 focus-visible:outline-none dark:text-white dark:hover:bg-white/5 dark:focus-visible:bg-white/5"
            >
              <span>{item.label}</span>
              {item.description && (
                <span className="text-xs font-normal text-navy-400 dark:text-white/40">{item.description}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
