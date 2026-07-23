import { Outlet } from "react-router-dom";
import { AppHeader } from "@/components/layout/AppHeader";

export function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-navy-50/40 dark:bg-navy-900">
      <AppHeader />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
