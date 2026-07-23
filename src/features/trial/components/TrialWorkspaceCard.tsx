import type { ProductRow } from "@/types/database";
import { Button } from "@/components/ui/Button";

interface TrialWorkspaceCardProps {
  product: ProductRow;
  isSelected: boolean;
  onSelect: (product: ProductRow) => void;
}

export function TrialWorkspaceCard({ product, isSelected, onSelect }: TrialWorkspaceCardProps) {
  return (
    <div
      className={`card overflow-hidden transition-shadow ${isSelected ? "ring-2 ring-primary" : ""}`}
    >
      <div className="aspect-[16/10] w-full overflow-hidden bg-navy-100 dark:bg-navy-700">
        {product.cover_image_url ? (
          <img src={product.cover_image_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-primary/40">
            <span className="text-4xl font-bold">{product.name.charAt(0)}</span>
          </div>
        )}
      </div>
      <div className="p-6">
        <h3 className="text-lg font-semibold text-navy-900 dark:text-white">{product.name}</h3>
        <p className="mt-2 line-clamp-2 text-sm text-navy-500 dark:text-white/60">
          {product.short_description}
        </p>
        <div className="mt-5 flex items-center gap-3">
          <Button
            variant={isSelected ? "primary" : "secondary"}
            size="sm"
            className="flex-1"
            onClick={() => onSelect(product)}
          >
            {isSelected ? "Selected" : "Select for Trial"}
          </Button>
        </div>
      </div>
    </div>
  );
}
