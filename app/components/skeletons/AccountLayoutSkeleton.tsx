import {Skeleton} from '~/components/ui/skeleton';
import {
  useWindowWidth,
  NavbarSkeleton,
  AccountHeaderSkeleton,
  SectionTitleSkeleton,
} from '~/components/skeletons/shared';

/**
 * Account layout skeleton — shows navbar + account header + nav tabs
 * + a generic content placeholder. Used by account.tsx as the
 * loading gate while the account header image loads.
 */
export default function AccountLayoutSkeleton() {
  const windowWidth = useWindowWidth();

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <NavbarSkeleton windowWidth={windowWidth} />
      <AccountHeaderSkeleton />
      {/* Generic content placeholder for the sub-page area */}
      <SectionTitleSkeleton width="w-[120px]" />
      <div className="flex justify-center">
        <div className="w-[95%] space-y-4 px-4">
          <Skeleton className="h-6 w-[200px] rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-3/4 rounded-md" />
        </div>
      </div>
    </div>
  );
}
