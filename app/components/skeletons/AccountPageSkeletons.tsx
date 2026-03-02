import {Skeleton} from '~/components/ui/skeleton';
import {Card, CardContent} from '~/components/ui/card';
import {Separator} from '~/components/ui/separator';
import {
  useWindowWidth,
  NavbarSkeleton,
  AccountHeaderSkeleton,
  SectionTitleSkeleton,
  ProductGridSkeleton,
} from '~/components/skeletons/shared';

// ─── Profile Page Skeleton ─────────────────────────────────────────────

export function ProfilePageSkeleton() {
  const windowWidth = useWindowWidth();

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <NavbarSkeleton windowWidth={windowWidth} />
      <AccountHeaderSkeleton />
      <SectionTitleSkeleton width="w-[120px]" />
      <div className="flex justify-center">
        <Card className="mx-2 mt-3 w-[95%]">
          <div className="p-4">
            <Skeleton className="h-6 w-[100px] rounded-md" />
          </div>
          <div className="ps-4">
            <Skeleton className="h-4 w-[140px] rounded-md" />
          </div>
          <CardContent className="ps-4 pt-3">
            {/* 4 input fields */}
            {['First name', 'Last name', 'Email', 'Phone'].map((label) => (
              <div key={label} className="mb-3">
                <Skeleton className="h-4 w-[80px] rounded-md mb-2" />
                <Skeleton className="h-10 w-[250px] rounded-md" />
              </div>
            ))}
            {/* Marketing checkboxes */}
            <div className="pt-3">
              <Skeleton className="h-5 w-[80px] rounded-md mb-3" />
              <div className="flex items-center gap-2 mb-2">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-[300px] rounded-md" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-[260px] rounded-md" />
              </div>
            </div>
          </CardContent>
          <div className="m-5">
            <Skeleton className="h-9 w-[80px] rounded-md" />
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── Orders Page Skeleton ──────────────────────────────────────────────

function OrderCardSkeleton() {
  return (
    <fieldset>
      <Card className="mx-5">
        <div className="p-4">
          <Skeleton className="h-5 w-[180px] rounded-md mb-2" />
          <Skeleton className="h-4 w-[140px] rounded-md" />
        </div>
        <CardContent className="ms-3">
          <Skeleton className="h-4 w-[100px] rounded-md mb-1" />
          <Skeleton className="h-4 w-[80px] rounded-md mb-1" />
          <Skeleton className="h-5 w-[60px] rounded-md" />
        </CardContent>
        <div className="m-5">
          <Skeleton className="h-9 w-[120px] rounded-md" />
        </div>
      </Card>
      <br />
    </fieldset>
  );
}

export function OrdersPageSkeleton() {
  const windowWidth = useWindowWidth();

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <NavbarSkeleton windowWidth={windowWidth} />
      <AccountHeaderSkeleton />
      <SectionTitleSkeleton width="w-[130px]" />
      <section className="flex justify-center pt-3">
        <div className="w-full">
          <OrderCardSkeleton />
          <OrderCardSkeleton />
          <OrderCardSkeleton />
        </div>
      </section>
    </div>
  );
}

// ─── Order Detail Page Skeleton ────────────────────────────────────────

export function OrderDetailPageSkeleton() {
  const windowWidth = useWindowWidth();

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <NavbarSkeleton windowWidth={windowWidth} />
      <AccountHeaderSkeleton />
      <SectionTitleSkeleton width="w-[160px]" />
      <div className="px-4 py-3">
        {/* Order header */}
        <div className="flex justify-between items-center mb-4">
          <Skeleton className="h-6 w-[200px] rounded-md" />
          <Skeleton className="h-4 w-[120px] rounded-md" />
        </div>
        <Separator />
        {/* Order line items */}
        {[1, 2].map((i) => (
          <div key={i} className="flex gap-4 py-4">
            <Skeleton className="h-[100px] w-[80px] rounded-md shrink-0" />
            <div className="flex-1 flex flex-col gap-2">
              <Skeleton className="h-5 w-3/4 rounded-md" />
              <Skeleton className="h-4 w-1/2 rounded-md" />
              <Skeleton className="h-4 w-[60px] rounded-md" />
            </div>
          </div>
        ))}
        <Separator />
        {/* Summary */}
        <div className="flex flex-col items-end gap-2 py-4">
          <Skeleton className="h-4 w-[180px] rounded-md" />
          <Skeleton className="h-4 w-[140px] rounded-md" />
          <Skeleton className="h-5 w-[160px] rounded-md" />
        </div>
      </div>
    </div>
  );
}

// ─── Favorites Page Skeleton ───────────────────────────────────────────

export function FavoritesPageSkeleton() {
  const windowWidth = useWindowWidth();

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <NavbarSkeleton windowWidth={windowWidth} />
      <AccountHeaderSkeleton />
      <SectionTitleSkeleton width="w-[110px]" />
      <ProductGridSkeleton windowWidth={windowWidth} count={4} />
    </div>
  );
}

// ─── Reviews Page Skeleton ─────────────────────────────────────────────

function ReviewCardSkeleton() {
  return (
    <Card className="mx-4 mb-3 p-4">
      <div className="flex gap-3">
        <Skeleton className="h-[60px] w-[60px] rounded-md shrink-0" />
        <div className="flex-1 flex flex-col gap-2">
          <Skeleton className="h-5 w-3/4 rounded-md" />
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-4 w-4 rounded-full" />
            ))}
          </div>
          <Skeleton className="h-4 w-full rounded-md" />
          <Skeleton className="h-4 w-2/3 rounded-md" />
        </div>
      </div>
    </Card>
  );
}

export function ReviewsPageSkeleton() {
  const windowWidth = useWindowWidth();

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <NavbarSkeleton windowWidth={windowWidth} />
      <AccountHeaderSkeleton />
      <SectionTitleSkeleton width="w-[130px]" />
      <ReviewCardSkeleton />
      <ReviewCardSkeleton />
      <ReviewCardSkeleton />
    </div>
  );
}

// ─── Addresses Page Skeleton ───────────────────────────────────────────

export function AddressesPageSkeleton() {
  const windowWidth = useWindowWidth();

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <NavbarSkeleton windowWidth={windowWidth} />
      <AccountHeaderSkeleton />
      <SectionTitleSkeleton width="w-[120px]" />
      <div className="px-4 py-3">
        <Card className="p-4 mb-4">
          <Skeleton className="h-5 w-[160px] rounded-md mb-3" />
          {/* Address form fields */}
          {['Address', 'City', 'State', 'Zip', 'Country'].map((label) => (
            <div key={label} className="mb-3">
              <Skeleton className="h-4 w-[60px] rounded-md mb-1" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          ))}
          <Skeleton className="h-9 w-[100px] rounded-md mt-2" />
        </Card>
      </div>
    </div>
  );
}

// ─── Notifications Page Skeleton ───────────────────────────────────────

function NotificationGroupSkeleton() {
  return (
    <div className="border-b border-border py-4 px-4">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <Skeleton className="h-5 w-3/4 rounded-md mb-1" />
          <Skeleton className="h-3 w-[120px] rounded-md" />
        </div>
        <Skeleton className="h-4 w-4 rounded-full" />
      </div>
    </div>
  );
}

export function NotificationsPageSkeleton() {
  const windowWidth = useWindowWidth();

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <NavbarSkeleton windowWidth={windowWidth} />
      <AccountHeaderSkeleton />
      <SectionTitleSkeleton width="w-[150px]" />
      <div className="px-4">
        <Card>
          <NotificationGroupSkeleton />
          <NotificationGroupSkeleton />
          <NotificationGroupSkeleton />
          <NotificationGroupSkeleton />
        </Card>
      </div>
    </div>
  );
}
