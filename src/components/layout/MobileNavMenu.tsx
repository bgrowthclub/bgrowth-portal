import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";

interface MobileNavMenuProps {
  items: { to: string; label: string }[];
}

/**
 * AppHeader's authenticated nav links are `hidden md:flex` with no mobile
 * fallback today — this is that fallback, reusing the same manual
 * open-state + outside-click/Escape-to-close pattern already used by
 * SavedChecklistCard's ⋮ menu, rather than introducing a new dropdown
 * primitive. `md:hidden` mirrors the desktop nav's own breakpoint exactly.
 */
export function MobileNavMenu({ items }: MobileNavMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handlePointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setIsOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={menuRef} className="relative md:hidden">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={isOpen ? "Close menu" : "Open menu"}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-navy-100 text-navy-600 transition-colors hover:border-primary/40 hover:text-primary dark:border-white/10 dark:text-white/70 dark:hover:border-primary/40 dark:hover:text-primary"
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-2 w-48 overflow-hidden rounded-xl border border-navy-100 bg-white py-1 shadow-soft-lg dark:border-white/10 dark:bg-navy-800"
        >
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              role="menuitem"
              onClick={() => setIsOpen(false)}
              className="block px-4 py-2.5 text-sm font-medium text-navy-600 transition hover:bg-navy-50 hover:text-primary dark:text-white/70 dark:hover:bg-white/5"
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
