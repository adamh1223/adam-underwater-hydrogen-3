import {Skeleton} from '~/components/ui/skeleton';
import {
  useWindowWidth,
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
 */
function HeroSkeleton({windowWidth}: {windowWidth: number | undefined}) {
  const w = windowWidth ?? 0;
  const imgH = w <= 700 ? 'h-[65px]' : 'h-[80px]';
  const imgW = w <= 700 ? 'w-[280px]' : 'w-[360px]';

  return (
    <div className="relative h-[400px] flex flex-col items-center justify-center overflow-hidden">
      <Skeleton className="absolute inset-0 rounded-none" />
      <div className="relative z-10">
        <div className="pb-[40px]">
          <div className="p-3 flex justify-center">
            <Skeleton className={`${imgH} ${imgW} rounded-[25px]`} />
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
  const windowWidth = useWindowWidth();

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <NavbarSkeleton windowWidth={windowWidth} />
      <HeroSkeleton windowWidth={windowWidth} />
      <FeaturedSectionSkeleton windowWidth={windowWidth} />
      <ProductGridSkeleton windowWidth={windowWidth} />
    </div>
  );
}
