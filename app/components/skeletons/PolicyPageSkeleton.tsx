import {Skeleton} from '~/components/ui/skeleton';
import {Card, CardContent} from '~/components/ui/card';
import {
  NavbarSkeleton,
} from '~/components/skeletons/shared';

/**
 * Individual policy page skeleton — navbar + back button + card with title + text lines.
 */
export default function PolicyPageSkeleton() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <NavbarSkeleton />
      <section>
        {/* Back button */}
        <div className="pt-5 ps-[60px]">
          <Skeleton className="h-8 w-[140px] rounded-md" />
        </div>
        {/* Policy card */}
        <div className="flex justify-center">
          <div className="w-full max-w-[800px] px-4">
            <Card className="mt-5">
              <div className="p-6">
                {/* Title */}
                <div className="flex justify-center pb-3">
                  <Skeleton className="h-6 w-[200px] rounded-md" />
                </div>
                <Skeleton className="h-[1px] w-full rounded-md mb-4" />
              </div>
              <CardContent>
                <div className="flex justify-center px-7">
                  <div className="w-full space-y-3">
                    <Skeleton className="h-4 w-full rounded-md" />
                    <Skeleton className="h-4 w-full rounded-md" />
                    <Skeleton className="h-4 w-5/6 rounded-md" />
                    <Skeleton className="h-4 w-full rounded-md" />
                    <Skeleton className="h-4 w-4/5 rounded-md" />
                    <Skeleton className="h-4 w-full rounded-md" />
                    <Skeleton className="h-4 w-3/4 rounded-md" />
                    <Skeleton className="h-4 w-full rounded-md" />
                    <Skeleton className="h-4 w-full rounded-md" />
                    <Skeleton className="h-4 w-2/3 rounded-md" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
