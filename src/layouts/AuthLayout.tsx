import { Outlet } from "react-router-dom";
import { Logo } from "@/components/layout/Logo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

export function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-navy-50/40 dark:bg-navy-900">
      <div className="flex items-center justify-between px-6 py-6">
        <Logo />
        <ThemeToggle />
      </div>
      <div className="flex flex-1 items-center justify-center px-6 pb-16">
        <div className="w-full max-w-md animate-fade-up">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
