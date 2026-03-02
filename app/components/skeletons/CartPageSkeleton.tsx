import {Skeleton} from '~/components/ui/skeleton';
import {Card} from '~/components/ui/card';
import {Separator} from '~/components/ui/separator';
import {
  useWindowWidth,
  NavbarSkeleton,
} from '~/components/skeletons/shared';

/**
 * Cart page structure:
 *  - Cart header image (h-[110px], centered)
 *  - CartMain: cart items (image + details + price + quantity) + summary
 */

function CartItemSkeleton() {
  return (
    <div className="flex gap-4 py-4 px-4">
      {/* Product image */}
      <Skeleton className="h-[120px] w-[100px] rounded-md shrink-0" />
      {/* Details */}
      <div className="flex-1 flex flex-col gap-2">
        <Skeleton className="h-5 w-3/4 rounded-md" />
        <Skeleton className="h-4 w-1/2 rounded-md" />
        <Skeleton className="h-4 w-[80px] rounded-md" />
        <div className="flex items-center gap-2 mt-auto">
          <Skeleton className="h-8 w-[100px] rounded-md" />
          <Skeleton className="h-8 w-[70px] rounded-md" />
        </div>
      </div>
    </div>
  );
}

export default function CartPageSkeleton() {
  const windowWidth = useWindowWidth();

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <NavbarSkeleton windowWidth={windowWidth} />
      <div className="cart">
        {/* Cart header image */}
        <div className="flex justify-center">
          <Skeleton className="h-[110px] w-[220px] rounded-md mt-5" />
        </div>
        {/* Cart items */}
        <div className="px-4 py-4">
          <CartItemSkeleton />
          <Separator />
          <CartItemSkeleton />
          <Separator />
          <CartItemSkeleton />
        </div>
        {/* Cart summary */}
        <div className="flex flex-col items-end px-6 py-4 gap-2">
          <Skeleton className="h-5 w-[200px] rounded-md" />
          <Skeleton className="h-4 w-[160px] rounded-md" />
          <Skeleton className="h-10 w-[180px] rounded-md mt-2" />
        </div>
      </div>
    </div>
  );
}
