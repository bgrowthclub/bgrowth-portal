import { Link, useNavigate } from "react-router-dom";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { MobileNavMenu } from "./MobileNavMenu";
import { Button } from "@/components/ui/Button";
import { authService } from "@/features/auth/services/authService";

// Single source for the authenticated destinations — shared by the desktop
// nav and MobileNavMenu's fallback below, so the two can never drift.
const NAV_ITEMS = [
  { to: "/library", label: "My Library" },
  { to: "/documents", label: "My Documents" },
  { to: "/browse", label: "Browse Workspaces" },
  { to: "/profile", label: "Profile" },
];

export function AppHeader() {
  const navigate = useNavigate();

  async function handleSignOut() {
    await authService.signOut();
    navigate("/sign-in", { replace: true });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-navy-100/60 bg-white/80 backdrop-blur-md dark:border-white/10 dark:bg-navy-900/80">
      <div className="mx-auto flex h-18 max-w-6xl items-center justify-between px-6 py-4">
        <Logo />
        <nav className="hidden items-center gap-6 text-sm font-medium text-navy-600 dark:text-white/70 md:flex">
          {NAV_ITEMS.map((item) => (
            <Link key={item.to} to={item.to} className="transition-colors hover:text-primary">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <MobileNavMenu items={NAV_ITEMS} />
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            Sign Out
          </Button>
        </div>
      </div>
    </header>
  );
}
