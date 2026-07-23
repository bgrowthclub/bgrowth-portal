const BENEFITS = [
  {
    title: "Zero commitment",
    description: "Explore a full Workspace for 14 days — no card required, cancel anytime.",
    icon: "M5 13l4 4L19 7",
  },
  {
    title: "One choice, full access",
    description: "Your trial Workspace unlocks completely — every module, every feature.",
    icon: "M12 4v16m8-8H4",
  },
  {
    title: "See real value fast",
    description: "Get organized in your first session — most members see results within days.",
    icon: "M13 10V3L4 14h7v7l9-11h-7z",
  },
];

export function BenefitsSection() {
  return (
    <section id="benefits" className="section-py mx-auto max-w-6xl px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <span className="text-sm font-semibold uppercase tracking-wider text-primary">Why BGrowth</span>
        <h2 className="mt-3 text-3xl font-bold text-navy-900 dark:text-white sm:text-4xl">
          Built to earn your trust in 14 days
        </h2>
      </div>
      <div className="mt-14 grid gap-6 sm:grid-cols-3">
        {BENEFITS.map((benefit) => (
          <div key={benefit.title} className="card p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
                <path d={benefit.icon} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 className="mt-5 text-lg font-semibold text-navy-900 dark:text-white">{benefit.title}</h3>
            <p className="mt-2 text-sm text-navy-500 dark:text-white/60">{benefit.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
