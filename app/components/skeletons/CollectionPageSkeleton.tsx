import {Skeleton} from '~/components/ui/skeleton';
import {Separator} from '~/components/ui/separator';
import {
  useWindowWidth,
  NavbarSkeleton,
  ProductCardSkeleton,
  FeaturedSectionSkeleton,
  ProductGridSkeleton,
} from '~/components/skeletons/shared';

/**
 * Collection page (Prints / Stock Footage) structure:
 *  - ProductsHeader or EProductsHeader (header image + collection title)
 *  - Search/filter bar (InputGroup search + filter popover trigger + toggle)
 *  - Product grid (dynamic columns)
 *  - Featured section + recommended products
 */

function CollectionHeaderSkeleton() {
  return (
    <div className="flex justify-center items-center gap-4 mt-3 mb-3">
      <Skeleton className="h-[50px] w-[50px] rounded-md" />
      <Skeleton className="h-[40px] w-[140px] rounded-md" />
    </div>
  );
}

function FilterBarSkeleton({windowWidth}: {windowWidth: number | undefined}) {
  const w = windowWidth ?? 800;

  return (
    <div className="flex justify-center items-center gap-3 px-4 py-3 flex-wrap">
      {/* Search InputGroup */}
      <Skeleton className="h-10 w-[200px] rounded-md" />
      {/* Filter button */}
      <Skeleton className="h-10 w-[40px] rounded-md" />
      {/* Toggle switch (for stock footage resolution) */}
      {w >= 500 && <Skeleton className="h-8 w-[100px] rounded-md" />}
    </div>
  );
}

export default function CollectionPageSkeleton() {
  const windowWidth = useWindowWidth();
  const gridColumnCount =
    windowWidth != undefined
      ? Math.max(1, Math.floor((windowWidth - 1) / 700) + 1)
      : 1;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <NavbarSkeleton windowWidth={windowWidth} />
      <CollectionHeaderSkeleton />
      <Separator />
      <FilterBarSkeleton windowWidth={windowWidth} />
      {/* Product grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${gridColumnCount}, minmax(0, 1fr))`,
          columnGap: '8px',
          rowGap: '8px',
          padding: '10px',
        }}
      >
        {Array.from({length: Math.max(4, gridColumnCount * 2)}).map((_, i) => (
          <ProductCardSkeleton key={`coll-skel-${i}`} />
        ))}
      </div>
      <FeaturedSectionSkeleton windowWidth={windowWidth} />
      <ProductGridSkeleton windowWidth={windowWidth} />
    </div>
  );
}
