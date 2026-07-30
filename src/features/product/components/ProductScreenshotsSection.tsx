import type { ProductRow } from "@/types/database";
import { getProductScreenshots } from "@/lib/productMarketing";
import { Carousel, CarouselItem } from "@/components/ui/Carousel";

interface ProductScreenshotsSectionProps {
  product: Pick<ProductRow, "metadata" | "name">;
}

/** Omitted entirely until Studio publishes metadata.screenshots — no fallback, same "omit if absent" convention as ProductIncluded/ProductLongDescription. */
export function ProductScreenshotsSection({ product }: ProductScreenshotsSectionProps) {
  const screenshots = getProductScreenshots(product);
  if (!screenshots) return null;

  return (
    <section className="py-16">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <span className="text-sm font-semibold uppercase tracking-wider text-primary">Preview</span>
          <h2 className="mt-3 text-3xl font-bold text-navy-900 dark:text-white sm:text-4xl">
            See it in action
          </h2>
        </div>
        <div className="mt-10">
          <Carousel ariaLabel={`${product.name} screenshots`}>
            {screenshots.map((url, index) => (
              <CarouselItem key={url} className="w-[420px] sm:w-[560px]">
                <div className="aspect-[16/10] w-full overflow-hidden rounded-2xl border border-navy-100/60 shadow-soft dark:border-white/10">
                  <img src={url} alt={`${product.name} screenshot ${index + 1}`} className="h-full w-full object-cover" />
                </div>
              </CarouselItem>
            ))}
          </Carousel>
        </div>
      </div>
    </section>
  );
}
