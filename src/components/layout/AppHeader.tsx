import { Link, useNavigate } from "react-router-dom";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "@/components/ui/Button";
import { authService } from "@/features/auth/services/authService";

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
          <Link to="/library" className="transition-colors hover:text-primary">
            My Library
          </Link>
          <Link to="/profile" className="transition-colors hover:text-primary">
            Profile
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            Sign Out
          </Button>
        </div>
      </div>
    </header>
  );
}
