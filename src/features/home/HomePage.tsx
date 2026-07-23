import { HeroSection } from "./components/HeroSection";
import { BenefitsSection } from "./components/BenefitsSection";
import { HowItWorksSection } from "./components/HowItWorksSection";
import { AvailableWorkspacesSection } from "./components/AvailableWorkspacesSection";
import { FaqSection } from "./components/FaqSection";

export function HomePage() {
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
