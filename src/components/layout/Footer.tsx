export function Footer() {
  return (
    <footer className="border-t border-navy-100/60 bg-white py-10 dark:border-white/10 dark:bg-navy-900">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm text-navy-400 dark:text-white/40 sm:flex-row">
        <p>&copy; {new Date().getFullYear()} BGrowth. All rights reserved.</p>
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
