import logo from "@/assets/logo.png";

export function Footer() {
  return (
    <footer className="border-t border-navy-100/60 bg-white py-10 dark:border-white/10 dark:bg-navy-900">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm text-navy-400 dark:text-white/40 sm:flex-row">
        <div className="flex items-center gap-2.5">
          <img src={logo} alt="" aria-hidden="true" className="h-6 w-6 shrink-0 rounded object-contain" />
          <div className="flex flex-col leading-tight">
            <span className="font-semibold text-navy-600 dark:text-white/70">BGrowth</span>
            <p>&copy; {new Date().getFullYear()} BGrowth. All rights reserved.</p>
          </div>
        </div>
        <div className="flex gap-6">
          <a href="/privacy" className="transition-colors hover:text-primary">
            Privacy
          </a>
          <a href="/terms" className="transition-colors hover:text-primary">
            Terms
          </a>
        </div>
      </div>
    </footer>
  );
}
