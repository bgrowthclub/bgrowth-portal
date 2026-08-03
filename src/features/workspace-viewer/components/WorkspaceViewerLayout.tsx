import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { ProductRow } from "@/types/database";

interface WorkspaceViewerLayoutProps {
  product: ProductRow;
  children: ReactNode;
  /** The Workspace's own New Fill entry point (see WorkspaceViewerPage) — optional so this layout stays decoupled from any specific action/hook; omitted entirely when the visitor has no real access to render one for. */
  headerActions?: ReactNode;
}

/**
 * Reusable shell for any Workspace's content. Today `children` is a
 * placeholder — once BGrowth Studio's JSON product format is finalized, the
 * page that renders it slots in here without this layout changing.
 */
export function WorkspaceViewerLayout({ product, children, headerActions }: WorkspaceViewerLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-navy-900">
      <header className="sticky top-0 z-30 border-b border-navy-100/60 bg-white/90 backdrop-blur-md dark:border-white/10 dark:bg-navy-900/90">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="min-w-0">
            <Link to="/library" className="text-xs font-medium text-primary hover:underline">
              ← Back to My Library
            </Link>
            <h1 className="truncate text-lg font-bold text-navy-900 dark:text-white">{product.name}</h1>
          </div>
          {headerActions}
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">{children}</main>
    </div>
  );
}
