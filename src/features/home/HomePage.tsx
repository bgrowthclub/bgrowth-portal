import { HeroSection } from "./components/HeroSection";
import { BenefitsSection } from "./components/BenefitsSection";
import { HowItWorksSection } from "./components/HowItWorksSection";
import { AvailableWorkspacesSection } from "./components/AvailableWorkspacesSection";
import { FaqSection } from "./components/FaqSection";
import { useScrollToHash } from "@/hooks/useScrollToHash";

export function HomePage() {
  // Lands the visitor on the right section when Navbar's Benefits/How It
  // Works/FAQ links bring them here from another route (Link to="/#faq"
  // etc.) — client-side navigation doesn't trigger the browser's native
  // hash-scroll, so this page (the one that actually owns those ids) does
  // it itself.
  useScrollToHash();

  return (
    <>
      <HeroSection />
      <BenefitsSection />
      <HowItWorksSection />
      <AvailableWorkspacesSection />
      <FaqSection />
    </>
  );
}
