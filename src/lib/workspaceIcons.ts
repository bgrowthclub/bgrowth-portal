import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { HelpCircle } from "lucide-react";

/**
 * Resolves a Studio icon name (kebab-case, e.g. "calendar-days") to a
 * lucide-react component by converting to the library's PascalCase export
 * name and looking it up directly — deliberately not a hand-maintained
 * name -> component map. Studio can introduce any new lucide icon name in a
 * future Workspace and it renders correctly with zero Portal code changes.
 * An unrecognized name falls back to HelpCircle rather than throwing.
 */
export function getWorkspaceIcon(name: string): LucideIcon {
  const pascalCase = name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

  const icons = LucideIcons as unknown as Record<string, LucideIcon>;
  return icons[pascalCase] ?? HelpCircle;
}
