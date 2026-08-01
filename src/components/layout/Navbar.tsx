import { Link } from "react-router-dom";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/features/auth/AuthContext";

export function Navbar() {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-navy-100/60 bg-white/80 backdrop-blur-md dark:border-white/10 dark:bg-navy-900/80">
      <div className="mx-auto flex h-18 max-w-6xl items-center justify-between px-6 py-4">
        <Logo />
        <nav className="hidden items-center gap-8 text-sm font-medium text-navy-600 dark:text-white/70 md:flex">
          {/*
            Benefits/How It Works/FAQ are Home-page sections, not routes —
            "/#id" navigates to Home (from anywhere) and sets the hash;
            HomePage's useScrollToHash then scrolls to it, whether that's a
            fresh navigation or an in-place hash change while already on Home.
            Workspaces is a real route (the existing public Browse
            experience) and was never a Home-only anchor, so it's a plain Link.
          */}
          <Link to="/#benefits" className="transition-colors hover:text-primary">
            Benefits
          </Link>
          <Link to="/#how-it-works" className="transition-colors hover:text-primary">
            How It Works
          </Link>
          <Link to="/browse" className="transition-colors hover:text-primary">
            Workspaces
          </Link>
          <Link to="/#faq" className="transition-colors hover:text-primary">
            FAQ
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {user ? (
            <Link to="/library">
              <Button size="sm">My Library</Button>
            </Link>
          ) : (
            <>
              <Link to="/sign-in">
                <Button variant="ghost" size="sm">
                  Sign In
                </Button>
              </Link>
              <Link to="/sign-up">
                <Button size="sm">Create Account</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
