import { Fragment } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

/** Generic, business-agnostic breadcrumb trail — the last item (no `to`) renders as the current page, not a link. */
export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mx-auto max-w-6xl px-6 pt-6 text-sm">
      <ol className="flex flex-wrap items-center gap-1.5 text-navy-500 dark:text-white/50">
        {items.map((item, index) => (
          <Fragment key={item.label}>
            {index > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
            <li>
              {item.to ? (
                <Link to={item.to} className="hover:text-primary hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span aria-current="page" className="text-navy-700 dark:text-white/80">
                  {item.label}
                </span>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}
