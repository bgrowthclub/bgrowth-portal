import { useRef, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CarouselProps {
  children: ReactNode;
  /** Announces the row's contents to assistive tech (e.g. "Featured Workspaces"). */
  ariaLabel: string;
}

const SCROLL_AMOUNT = 640;

/** Horizontal snap-scroll row with prev/next controls — the shared primitive every curated rail (Home, Collection pages) scrolls through. No existing equivalent in src/components/ui/. */
export function Carousel({ children, ariaLabel }: CarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  function scrollBy(delta: number) {
    trackRef.current?.scrollBy({ left: delta, behavior: "smooth" });
  }

  return (
    <div className="relative">
      <div
        ref={trackRef}
        role="group"
        aria-label={ariaLabel}
        className="flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>

      <button
        type="button"
        aria-label="Scroll left"
        onClick={() => scrollBy(-SCROLL_AMOUNT)}
        className="absolute -left-4 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full border border-navy-100 bg-white p-2 shadow-soft transition hover:text-primary sm:flex dark:border-white/10 dark:bg-navy-800"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label="Scroll right"
        onClick={() => scrollBy(SCROLL_AMOUNT)}
        className="absolute -right-4 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full border border-navy-100 bg-white p-2 shadow-soft transition hover:text-primary sm:flex dark:border-white/10 dark:bg-navy-800"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

/** One rail item's fixed-width wrapper — snaps to the row's scroll-start, sized so ~2.5 cards preview at desktop widths. */
export function CarouselItem({ children }: { children: ReactNode }) {
  return <div className="w-[280px] flex-none snap-start sm:w-[320px]">{children}</div>;
}
