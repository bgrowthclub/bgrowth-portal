import { Link } from "react-router-dom";
import logo from "@/assets/logo.png";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link to="/" className={`flex items-center gap-2 font-bold tracking-tight ${className}`}>
      <img src={logo} alt="BGrowth" className="h-8 w-8 shrink-0 object-contain" />
      <span className="text-lg text-navy-900 dark:text-white">
        BGrowth <span className="font-medium text-primary">Portal</span>
      </span>
    </Link>
  );
}
