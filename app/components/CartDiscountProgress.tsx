import {Progress} from './ui/progress';

type DiscountProgressConfig = {
  currentCount: number;
  requiredCount: number;
  itemLabelSingular: string;
  itemLabelPlural: string;
  discountPercent: number;
};

function DiscountProgressBar({
  currentCount,
  requiredCount,
  itemLabelSingular,
  itemLabelPlural,
  discountPercent,
}: DiscountProgressConfig) {
  const remaining = Math.max(0, requiredCount - currentCount);
  const progressPercent = Math.min(
    100,
    Math.round((currentCount / requiredCount) * 100),
  );
  const isFull = currentCount >= requiredCount;
  const itemLabel = remaining === 1 ? itemLabelSingular : itemLabelPlural;

  return (
    <div className="space-y-1">
      <div
        className={`relative${isFull ? ' discount-progress-bar-full' : ''}`}
      >
        <Progress value={progressPercent} className="h-5 rounded-md" />
        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">
          {currentCount}/{requiredCount}
        </span>
      </div>
      {isFull ? (
        <p className="text-xs text-center font-semibold text-primary">
          {discountPercent}% off {itemLabelPlural} applied!
        </p>
      ) : (
        <p className="text-xs text-center text-primary/80">
          Add {remaining} more {itemLabel} for a {discountPercent}% discount!
        </p>
      )}
    </div>
  );
}

type CartDiscountProgressProps = {
  printQuantity: number;
  stockClipQuantity: number;
  stockBundleQuantity: number;
  qualifiesForPrintDiscount: boolean;
  qualifiesForStockClipDiscount: boolean;
};

export function CartDiscountProgress({
  printQuantity,
  stockClipQuantity,
  stockBundleQuantity,
  qualifiesForPrintDiscount,
  qualifiesForStockClipDiscount,
}: CartDiscountProgressProps) {
  const progressBars: DiscountProgressConfig[] = [];
  const combinedStockQuantity = stockClipQuantity + stockBundleQuantity;

  if (printQuantity >= 1) {
    progressBars.push({
      currentCount: Math.min(printQuantity, 3),
      requiredCount: 3,
      itemLabelSingular: 'print',
      itemLabelPlural: 'prints',
      discountPercent: 15,
    });
  }

  if (combinedStockQuantity >= 1) {
    progressBars.push({
      currentCount: Math.min(combinedStockQuantity, 4),
      requiredCount: 4,
      itemLabelSingular: 'stock footage clip',
      itemLabelPlural: 'stock footage clips',
      discountPercent: 15,
    });
  }

  if (progressBars.length === 0) return null;

  return (
    <div className="mt-3 space-y-3">
      {progressBars.map((config) => (
        <DiscountProgressBar key={config.itemLabelPlural} {...config} />
      ))}
    </div>
  );
}
