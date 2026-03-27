import {Skeleton} from '~/components/ui/skeleton';
import {Separator} from '~/components/ui/separator';
import {
  NavbarSkeleton,
  ProductCardSkeleton,
} from '~/components/skeletons/shared';

type ProductPageSkeletonProps = {
  isVideo?: boolean;
  orientation?: string | null;
};

function ProductBreadcrumbsSkeleton() {
  return (
    <div className="px-[30px] mb-3 flex flex-wrap items-center gap-2">
      <Skeleton className="h-7 w-16 rounded-md" />
      <Skeleton className="h-4 w-4 rounded-full" />
      <Skeleton className="h-7 w-16 rounded-md" />
      <Skeleton className="h-4 w-4 rounded-full" />
      <Skeleton className="h-7 w-[180px] rounded-md" />
    </div>
  );
}

function ProductHeaderSkeleton() {
  return (
    <>
      <div className="title-button-wrapper flex items-start justify-between gap-3">
        <Skeleton className="h-14 w-[min(85%,28rem)] rounded-md" />
        <Skeleton className="h-11 w-11 shrink-0 rounded-md" />
      </div>
      <Skeleton className="mt-3 h-6 w-[170px] rounded-md" />
      <Skeleton className="mt-3 h-10 w-[170px] rounded-md" />
      <div className="mt-3 flex items-center gap-2">
        {Array.from({length: 5}, (_, index) => (
          <Skeleton key={`prod-rating-${index}`} className="h-5 w-5 rounded-full" />
        ))}
        <Skeleton className="h-5 w-[120px] rounded-md" />
      </div>
      <Skeleton className="mt-3 h-9 w-[260px] rounded-md" />
    </>
  );
}

function ProductMediaSkeleton({isLandscape}: {isLandscape: boolean}) {
  const maxWidth = isLandscape
    ? 'min(100%, clamp(18rem, 84vw, 54rem))'
    : 'min(100%, clamp(16rem, 64vw, 25rem))';
  const aspectRatio = isLandscape ? '4 / 3' : '3 / 4';
  const thumbnailAspectRatio = isLandscape ? '130 / 75' : '90 / 120';
  const thumbnailColumns = isLandscape
    ? 'grid-cols-4 sm:grid-cols-5 lg:grid-cols-3 xl:grid-cols-4'
    : 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4';

  return (
    <div className="grid grid-cols-1 px-2 product-carousel-container relative w-full max-w-full mx-auto">
      <div className="mx-auto w-full max-w-full">
        <div className="relative mx-auto flex items-center justify-center" style={{maxWidth}}>
          <Skeleton className="absolute left-0 top-1/2 h-12 w-12 -translate-x-3 -translate-y-1/2 rounded-full" />
          <Skeleton
            className="w-full rounded-lg"
            style={{aspectRatio}}
          />
          <Skeleton className="absolute right-0 top-1/2 h-12 w-12 translate-x-3 -translate-y-1/2 rounded-full" />
        </div>

        <div className="mx-auto mt-4 w-full px-[16px]" style={{maxWidth}}>
          <div className={`grid ${thumbnailColumns} gap-3`}>
            {Array.from({length: 7}, (_, index) => (
              <Skeleton
                key={`prod-thumb-${index}`}
                className="w-full rounded-sm"
                style={{aspectRatio: thumbnailAspectRatio}}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductDescriptionAndFormSkeleton({isPrint}: {isPrint: boolean}) {
  return (
    <div className="product-main px-[35px]">
      <div className="mt-4 space-y-3">
        <Skeleton className="h-4 w-full rounded-md" />
        <Skeleton className="h-4 w-[92%] rounded-md" />
        <Skeleton className="h-4 w-[74%] rounded-md" />
      </div>

      <div className="mt-6 space-y-5">
        <div>
          <Skeleton className="mb-2 h-6 w-[100px] rounded-md" />
          <div className="flex flex-wrap gap-3">
            {Array.from({length: 3}, (_, index) => (
              <Skeleton
                key={`prod-layout-${index}`}
                className="h-12 w-[150px] rounded-md"
              />
            ))}
          </div>
        </div>

        <div>
          <Skeleton className="mb-2 h-6 w-[70px] rounded-md" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {Array.from({length: 3}, (_, index) => (
              <Skeleton
                key={`prod-size-${index}`}
                className="h-[120px] w-full rounded-md"
              />
            ))}
          </div>
        </div>

        {isPrint && (
          <>
            <div className="space-y-2 pt-2">
              <Skeleton className="mx-auto h-7 w-[260px] rounded-md" />
              <Skeleton className="mx-auto h-5 w-[340px] max-w-full rounded-md" />
            </div>
            <Skeleton className="h-[120px] w-full rounded-xl" />
            <div className="flex justify-center">
              <Skeleton className="h-6 w-[280px] rounded-md" />
            </div>
          </>
        )}

        {!isPrint && <Skeleton className="h-[120px] w-full rounded-xl" />}
      </div>
    </div>
  );
}

function ManufacturingAndSpecsSkeleton() {
  return (
    <>
      <Separator className="mt-4" />
      <div className="manufacturing-info-container grid grid-cols-3 h-[100px] py-3">
        {Array.from({length: 3}, (_, index) => (
          <div key={`manufacturing-${index}`} className="grid grid-cols-1">
            <div className="flex justify-center items-center">
              <Skeleton className="h-10 w-10 rounded-md" />
            </div>
            <div className="flex justify-center mt-3">
              <Skeleton className="h-5 w-[100px] rounded-md" />
            </div>
          </div>
        ))}
      </div>

      <div className="card-accordion-container mt-2">
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({length: 2}, (_, index) => (
            <div
              key={`spec-card-${index}`}
              className="rounded-xl border border-border px-4 py-4"
            >
              <div className="flex items-center justify-between">
                <Skeleton className="h-6 w-[130px] rounded-md" />
                <Skeleton className="h-5 w-5 rounded-full" />
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {Array.from({length: 4}, (_, cardIndex) => (
                  <div key={`spec-entry-${index}-${cardIndex}`} className="space-y-3">
                    <Skeleton className="mx-auto h-10 w-10 rounded-md" />
                    <Skeleton className="mx-auto h-5 w-[120px] rounded-md" />
                    <Skeleton className="h-[120px] w-full rounded-xl" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function ReviewsSkeleton() {
  return (
    <>
      <section className="reviews mt-6">
        <div className="section-title-container">
          <div className="flex items-center justify-center w-full">
            <div className="flex-1 h-px bg-muted" />
            <span className="px-4">
              <Skeleton className="h-7 w-[220px] rounded-md" />
            </span>
            <div className="flex-1 h-px bg-muted" />
          </div>
        </div>
        <div className="flex justify-center pt-3">
          <div className="flex items-center gap-2">
            {Array.from({length: 5}, (_, index) => (
              <Skeleton key={`review-star-${index}`} className="h-5 w-5 rounded-full" />
            ))}
            <Skeleton className="h-5 w-[120px] rounded-md" />
          </div>
        </div>
        <div className="mx-auto mt-6 grid max-w-[1280px] gap-4 px-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({length: 3}, (_, index) => (
            <div
              key={`review-card-${index}`}
              className="rounded-xl border border-border p-4"
            >
              <div className="flex justify-center gap-1">
                {Array.from({length: 5}, (_, starIndex) => (
                  <Skeleton
                    key={`review-card-star-${index}-${starIndex}`}
                    className="h-4 w-4 rounded-full"
                  />
                ))}
              </div>
              <Skeleton className="mx-auto mt-4 h-6 w-[140px] rounded-md" />
              <Skeleton className="mx-auto mt-2 h-5 w-[90px] rounded-md" />
              <Skeleton className="mt-4 h-[220px] w-full rounded-lg" />
              <Skeleton className="mt-4 h-4 w-full rounded-md" />
              <Skeleton className="mt-2 h-4 w-[75%] rounded-md" />
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 px-4">
        <div className="mx-auto max-w-[800px] rounded-xl border border-border p-6">
          <Skeleton className="mx-auto h-8 w-[240px] rounded-md" />
          <div className="mt-6 flex justify-center gap-2">
            {Array.from({length: 5}, (_, index) => (
              <Skeleton key={`leave-review-star-${index}`} className="h-6 w-6 rounded-full" />
            ))}
          </div>
          <div className="mt-6 space-y-4">
            <Skeleton className="h-11 w-full rounded-md" />
            <Skeleton className="h-[140px] w-full rounded-md" />
            <Skeleton className="h-11 w-[180px] rounded-md" />
          </div>
        </div>
      </section>
    </>
  );
}

function RecommendedProductsSkeleton() {
  return (
    <div className="px-4 py-6">
      <div className="flex justify-center mb-4">
        <Skeleton className="h-7 w-[220px] rounded-md" />
      </div>
      <div className="flex gap-3 overflow-hidden">
        {Array.from({length: 3}, (_, index) => (
          <div key={`recommended-skeleton-${index}`} className="min-w-[250px] flex-shrink-0">
            <ProductCardSkeleton />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ProductPageSkeleton({
  isVideo = false,
  orientation,
}: ProductPageSkeletonProps) {
  const isLandscape = orientation !== 'Vertical';
  const isPrint = !isVideo;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <NavbarSkeleton />

      <section className="product pt-[20px]">
        <ProductBreadcrumbsSkeleton />

        <div className="px-[35px] lg:hidden">
          <ProductHeaderSkeleton />
        </div>

        <div className="lg:grid lg:grid-cols-[60%_40%] min-[1600px]:grid-cols-2 lg:gap-x-2">
          <ProductMediaSkeleton isLandscape={isLandscape} />

          <div className="hidden lg:block">
            <div className="px-[35px]">
              <ProductHeaderSkeleton />
            </div>
            <ProductDescriptionAndFormSkeleton isPrint={isPrint} />
          </div>
        </div>

        <div className="lg:hidden">
          <ProductDescriptionAndFormSkeleton isPrint={isPrint} />
        </div>

        {isPrint && (
          <>
            <div className="px-[20px] lg:px-[35px]">
              <ManufacturingAndSpecsSkeleton />
            </div>
            <Separator className="mt-6" />
            <div className="px-4 py-6">
              <div className="flex justify-center mb-4">
                <Skeleton className="h-7 w-[140px] rounded-md" />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {Array.from({length: 3}, (_, index) => (
                  <Skeleton
                    key={`in-box-${index}`}
                    className="h-[220px] w-full rounded-xl"
                  />
                ))}
              </div>
            </div>
            <ReviewsSkeleton />
          </>
        )}

        <Separator className="mt-6" />
        <RecommendedProductsSkeleton />
      </section>
    </div>
  );
}
