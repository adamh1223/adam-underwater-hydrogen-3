import {useEffect, useState} from 'react';
import {Skeleton} from '~/components/ui/skeleton';
import {Separator} from '~/components/ui/separator';
import {Card, CardContent} from '~/components/ui/card';
import {
  NavbarSkeleton,
  ProductCardSkeleton,
  FeaturedSectionSkeleton,
  ProductGridSkeleton,
} from '~/components/skeletons/shared';

/**
 * Collection page (Prints / Stock Footage) structure:
 *  - ProductsHeader or EProductsHeader (header image + collection title)
 *  - Search/filter bar (InputGroup search + filter popover trigger + toggle)
 *  - Product grid (dynamic columns) — supports grid AND list view
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

function FilterBarSkeleton() {
  return (
    <div className="flex justify-center items-center gap-3 px-4 py-3 flex-wrap">
      {/* Search InputGroup */}
      <Skeleton className="h-10 w-[200px] rounded-md" />
      {/* Filter button */}
      <Skeleton className="h-10 w-[40px] rounded-md" />
      {/* Toggle switch (for stock footage resolution) */}
      <Skeleton className="hidden min-[500px]:block h-8 w-[100px] rounded-md" />
    </div>
  );
}

/** List-view product card skeleton — 60/40 split matching list-view-large-row */
function ListProductCardSkeleton() {
  return (
    <Card className="h-full overflow-hidden">
      <CardContent className="h-full gap-y-4 grid p-0" style={{gridTemplateColumns: 'minmax(0, 60%) minmax(0, 40%)'}}>
        {/* Left: image area */}
        <Skeleton className="w-full h-full min-h-[180px] rounded-l-xl rounded-r-none" />
        {/* Right: product info */}
        <div className="flex flex-col items-center justify-center gap-2 px-4 py-3">
          <Skeleton className="h-5 w-4/5" />
          <Skeleton className="h-4 w-3/5" />
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-9 w-[120px] rounded-md mt-1" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function CollectionPageSkeleton() {
  // Read list/grid preference from localStorage (matches collection route logic)
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  useEffect(() => {
    try {
      const stored = localStorage.getItem('collection-layout-mode');
      if (stored === 'list') setLayout('list');
    } catch {
      // SSR or localStorage unavailable — keep default
    }
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <NavbarSkeleton />
      <CollectionHeaderSkeleton />
      <Separator />
      <FilterBarSkeleton />
      {/* Product grid — CSS responsive columns matching actual breakpoints */}
      {layout === 'grid' ? (
        <div className="grid grid-cols-1 min-[700px]:grid-cols-2 min-[1400px]:grid-cols-3 gap-2 p-[10px]">
          {Array.from({length: 6}).map((_, i) => (
            <ProductCardSkeleton key={`coll-skel-${i}`} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 p-[10px]" style={{gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 367.5px), 1fr))'}}>
          {Array.from({length: 4}).map((_, i) => (
            <ListProductCardSkeleton key={`coll-list-skel-${i}`} />
          ))}
        </div>
      )}
      <FeaturedSectionSkeleton />
      <ProductGridSkeleton />
    </div>
  );
}
