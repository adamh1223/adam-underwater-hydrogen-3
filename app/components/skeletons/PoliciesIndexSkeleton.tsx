import {Skeleton} from '~/components/ui/skeleton';
import {
  NavbarSkeleton,
} from '~/components/skeletons/shared';

/**
 * Policies index page skeleton — navbar + header image + policy button grid.
 */
export default function PoliciesIndexSkeleton() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <NavbarSkeleton />
      <div className="policies">
        {/* Header image */}
        <div className="flex justify-center mt-5">
          <Skeleton className="h-[85px] w-[220px] rounded-md" />
        </div>
        {/* Policy buttons */}
        <div className="flex justify-center flex-wrap px-5 mt-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex justify-center mx-3 my-3">
              <Skeleton className="h-9 w-36 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
