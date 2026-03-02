import {Skeleton} from '~/components/ui/skeleton';
import {
  useWindowWidth,
  NavbarSkeleton,
} from '~/components/skeletons/shared';

/**
 * Search page structure:
 *  - Search header image (h-[95px], centered)
 *  - Search form (input w-40 + button)
 */

export default function SearchPageSkeleton() {
  const windowWidth = useWindowWidth();

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <NavbarSkeleton windowWidth={windowWidth} />
      <div className="search">
        {/* Search header image */}
        <div className="flex justify-center pt-5">
          <Skeleton className="h-[95px] w-[250px] rounded-md" />
        </div>
        {/* Search form */}
        <div className="flex justify-center mt-5">
          <Skeleton className="h-10 w-40 rounded-md" />
          <span>&nbsp;</span>
          <Skeleton className="h-10 w-[80px] rounded-md" />
        </div>
      </div>
    </div>
  );
}
