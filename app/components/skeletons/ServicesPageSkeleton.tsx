import {Skeleton} from '~/components/ui/skeleton';
import {Card, CardContent} from '~/components/ui/card';
import {
  useWindowWidth,
  NavbarSkeleton,
  PageHeaderSkeleton,
  SectionTitleSkeleton,
  FeaturedSectionSkeleton,
  ProductGridSkeleton,
} from '~/components/skeletons/shared';

/**
 * Services page structure:
 *  - PageHeader (icon + "Services" title)
 *  - 3 anchor buttons
 *  - HeroServices (large video area)
 *  - "Underwater 45mp Photo" section title + photo carousel
 *  - "Drone Video & Photo" section title + 2 drone cards
 *  - Featured section + product grid
 */

function AnchorButtonsSkeleton() {
  return (
    <div className="flex justify-center gap-2 px-3 mb-2">
      <Skeleton className="h-9 w-[130px] rounded-md" />
      <Skeleton className="h-9 w-[130px] rounded-md" />
      <Skeleton className="h-9 w-[150px] rounded-md" />
    </div>
  );
}

function HeroServicesSkeleton({
  windowWidth,
}: {
  windowWidth: number | undefined;
}) {
  const w = windowWidth ?? 800;
  // HeroServices is a large video section — approximate with aspect-ratio 16:9
  return (
    <div className="flex justify-center px-4 py-3">
      <Skeleton
        className="rounded-md"
        style={{
          width: w <= 699 ? '100%' : '80vw',
          aspectRatio: '16/9',
          maxWidth: '960px',
        }}
      />
    </div>
  );
}

function PhotoCarouselSkeleton({
  windowWidth,
}: {
  windowWidth: number | undefined;
}) {
  const w = windowWidth ?? 800;
  const cols = w >= 768 ? (w >= 1024 ? 3 : 2) : 1;

  return (
    <div className="flex justify-center py-3">
      <div style={{width: '85%'}}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            gap: '16px',
            padding: '16px',
          }}
        >
          {Array.from({length: cols * 2}).map((_, i) => (
            <Card key={i} className="overflow-hidden aspect-[4/3]">
              <CardContent className="p-0 h-full w-full">
                <Skeleton className="w-full h-full rounded-none" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function DroneSectionSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-3 py-3 md:flex-row">
      {[1, 2].map((i) => (
        <Card key={i} className="flex-1 overflow-hidden">
          <div className="text-center py-3 px-3">
            <Skeleton className="h-6 w-[160px] mx-auto rounded-md mb-2" />
            <Skeleton className="h-4 w-[280px] mx-auto rounded-md" />
          </div>
          <CardContent className="p-0">
            <Skeleton className="w-full aspect-[16/9] rounded-none" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function ServicesPageSkeleton() {
  const windowWidth = useWindowWidth();

  // "Services" title
  const titleW =
    (windowWidth ?? 800) <= 669
      ? 'w-[130px]'
      : (windowWidth ?? 800) <= 1024
        ? 'w-[150px]'
        : 'w-[170px]';

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <NavbarSkeleton windowWidth={windowWidth} />
      <PageHeaderSkeleton windowWidth={windowWidth} titleWidth={titleW} />
      <AnchorButtonsSkeleton />
      <HeroServicesSkeleton windowWidth={windowWidth} />
      <SectionTitleSkeleton width="w-[280px]" />
      <PhotoCarouselSkeleton windowWidth={windowWidth} />
      <SectionTitleSkeleton width="w-[250px]" />
      <DroneSectionSkeleton />
      <FeaturedSectionSkeleton windowWidth={windowWidth} />
      <ProductGridSkeleton windowWidth={windowWidth} />
    </div>
  );
}
