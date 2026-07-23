import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-navy-900 py-28 text-white">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,97,236,0.35),transparent_45%),radial-gradient(circle_at_80%_60%,rgba(16,97,236,0.2),transparent_50%)]"
        aria-hidden="true"
      />
      <div className="relative mx-auto max-w-4xl px-6 text-center">
        <span className="eyebrow inline-block rounded-full border border-white/15 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary-200 animate-fade-in">
          Free 14-Day Trial
        </span>
        <h1 className="mt-6 animate-fade-up text-4xl font-bold leading-tight sm:text-6xl">
          Try a BGrowth Workspace,{" "}
          <span className="bg-gradient-to-r from-primary-200 to-primary bg-clip-text text-transparent">
            free
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl animate-fade-up text-lg text-white/70 [animation-delay:100ms]">
          Pick one premium Business System, activate it in seconds, and see exactly how BGrowth helps
          you get organized, look professional, and grow with confidence.
        </p>
        <div className="mt-10 flex animate-fade-up flex-col items-center justify-center gap-4 [animation-delay:200ms] sm:flex-row">
          <Link to="/sign-up">
            <Button size="lg">Create Free Account</Button>
          </Link>
          <Link
            to="/sign-in"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/30 px-8 py-4 text-base font-semibold text-white transition-colors hover:border-white/60 hover:bg-white/10 active:scale-[0.98]"
          >
            Sign In
          </Link>
        </div>
      </div>
    </section>
  );
}
