import { Link } from "react-router-dom";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link to="/" className={`flex items-center gap-2 font-bold tracking-tight ${className}`}>
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm text-white">
        B
      </span>
      <span className="text-lg text-navy-900 dark:text-white">
        BGrowth <span className="font-medium text-primary">Portal</span>
      </span>
    </Link>
  );
}
