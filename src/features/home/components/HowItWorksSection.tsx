const STEPS = [
  { title: "Create your account", description: "Sign up in under a minute — just your name, email, and a password." },
  { title: "Choose one Workspace", description: "Browse every BGrowth Workspace and pick the one that fits you best." },
  { title: "Activate your trial", description: "Confirm your choice and get instant, full access for 14 days." },
  { title: "Decide with confidence", description: "Love it? Upgrade any time. Your data and progress carry over." },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="bg-navy-50/50 py-24 dark:bg-white/[0.02]">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-semibold uppercase tracking-wider text-primary">How It Works</span>
          <h2 className="mt-3 text-3xl font-bold text-navy-900 dark:text-white sm:text-4xl">
            From sign-up to your first win
          </h2>
        </div>
        <ol className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="card relative p-6">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                {index + 1}
              </span>
              <h3 className="mt-4 text-base font-semibold text-navy-900 dark:text-white">{step.title}</h3>
              <p className="mt-2 text-sm text-navy-500 dark:text-white/60">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
