import {Skeleton} from '~/components/ui/skeleton';
import {
  NavbarSkeleton,
  FeaturedSectionSkeleton,
  ProductGridSkeleton,
} from '~/components/skeletons/shared';

/**
 * Hero skeleton — matches Hero.tsx structure:
 *   .main { height: 400px; overflow: hidden; flex center }
 *   img { p-3, hero-img (height: 65px ≤700 / 80px ≥701, border-radius:25px) }
 *   buttons: pt-5, first button w-48 h-10, second mt-5 w-48 h-10
 *   content wrapper: pb-[40px]
 *
 *   Uses CSS responsive classes so it renders correctly during SSR.
 */
function HeroSkeleton() {
  return (
    <div className="relative h-[400px] flex flex-col items-center justify-center overflow-hidden">
      <Skeleton className="absolute inset-0 rounded-none" />
      <div className="relative z-10">
        <div className="pb-[40px]">
          <div className="p-3 flex justify-center">
            <Skeleton className="h-[65px] min-[701px]:h-[80px] w-[280px] min-[701px]:w-[360px] rounded-[25px]" />
          </div>
          <div className="flex flex-col justify-center pt-5">
            <div className="flex justify-center">
              <Skeleton className="h-10 w-48 rounded-md" />
            </div>
            <div className="flex justify-center">
              <Skeleton className="h-10 w-48 rounded-md mt-5" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomePageSkeleton() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <NavbarSkeleton />
      <HeroSkeleton />
      <FeaturedSectionSkeleton />
      <ProductGridSkeleton />
    </div>
  );
}
