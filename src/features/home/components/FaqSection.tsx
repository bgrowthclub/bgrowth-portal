import { AccordionItem } from "@/components/ui/Accordion";

const FAQS = [
  {
    question: "Is the free trial really free?",
    answer: "Yes — no card required. You get full access to one Workspace of your choice for 14 days.",
  },
  {
    question: "Can I switch to a different Workspace during my trial?",
    answer:
      "No — once you activate a trial Workspace, that choice is locked in for the trial period. You can purchase additional Workspaces at any time.",
  },
  {
    question: "What happens when my trial ends?",
    answer:
      "Your Workspace moves to a locked state. You can purchase it to keep full access, or explore other BGrowth Workspaces.",
  },
  {
    question: "Can I use BGrowth on mobile?",
    answer: "Yes — the BGrowth Portal and every Workspace are fully responsive across desktop, tablet, and mobile.",
  },
];

export function FaqSection() {
  return (
    <section id="faq" className="bg-navy-50/50 py-24 dark:bg-white/[0.02]">
      <div className="mx-auto max-w-3xl px-6">
        <div className="text-center">
          <span className="text-sm font-semibold uppercase tracking-wider text-primary">FAQ</span>
          <h2 className="mt-3 text-3xl font-bold text-navy-900 dark:text-white sm:text-4xl">
            Questions, answered
          </h2>
        </div>
        <div className="mt-10 flex flex-col gap-3">
          {FAQS.map((faq) => (
            <AccordionItem key={faq.question} question={faq.question}>
              {faq.answer}
            </AccordionItem>
          ))}
        </div>
      </div>
    </section>
  );
}
