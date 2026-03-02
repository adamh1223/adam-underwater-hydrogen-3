import {Skeleton} from '~/components/ui/skeleton';
import {Card} from '~/components/ui/card';
import {Separator} from '~/components/ui/separator';
import {
  useWindowWidth,
  NavbarSkeleton,
  ProductCardSkeleton,
} from '~/components/skeletons/shared';

/**
 * Individual product page structure:
 *  - Product price (centered)
 *  - Product image carousel (large image area)
 *  - Product form (variant selector + add to cart)
 *  - Description accordion
 *  - Reviews section
 *  - Recommended products carousel
 */

export default function ProductPageSkeleton() {
  const windowWidth = useWindowWidth();
  const w = windowWidth ?? 800;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <NavbarSkeleton windowWidth={windowWidth} />

      {/* Product price */}
      <div className="flex justify-center pt-4">
        <Skeleton className="h-8 w-[120px] rounded-md" />
      </div>

      {/* Product image carousel */}
      <div className="flex justify-center px-4 py-4">
        <Skeleton
          className="rounded-md"
          style={{
            width: w <= 700 ? '90vw' : '60vw',
            maxWidth: '600px',
            aspectRatio: '4/5',
          }}
        />
      </div>

      {/* Carousel dots */}
      <div className="flex justify-center gap-2 pb-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-2 w-2 rounded-full" />
        ))}
      </div>

      {/* Product form: variant selector + add to cart */}
      <div className="flex flex-col items-center gap-3 px-4 pb-4">
        <Skeleton className="h-10 w-[250px] rounded-md" />
        <Skeleton className="h-10 w-[200px] rounded-md" />
        <Skeleton className="h-4 w-[160px] rounded-md" />
      </div>

      {/* Description accordion */}
      <div className="px-4 pb-3">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-4 py-4">
            <Skeleton className="h-5 w-[120px] rounded-md" />
            <Skeleton className="h-4 w-4 rounded-full" />
          </div>
        </Card>
      </div>

      <Separator />

      {/* Reviews section */}
      <div className="px-4 py-4">
        <div className="flex justify-center mb-3">
          <Skeleton className="h-7 w-[160px] rounded-md" />
        </div>
        <div className="flex justify-center gap-1 mb-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-5 w-5 rounded-full" />
          ))}
        </div>
      </div>

      <Separator />

      {/* Recommended products */}
      <div className="px-4 py-4">
        <div className="flex justify-center mb-3">
          <Skeleton className="h-7 w-[220px] rounded-md" />
        </div>
        <div className="flex gap-3 overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div key={i} className="min-w-[250px] flex-shrink-0">
              <ProductCardSkeleton />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
