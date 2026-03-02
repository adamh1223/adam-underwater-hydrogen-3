import {Skeleton} from '~/components/ui/skeleton';
import {Card} from '~/components/ui/card';
import {Separator} from '~/components/ui/separator';
import {
  useWindowWidth,
  NavbarSkeleton,
  PageHeaderSkeleton,
  FeaturedSectionSkeleton,
  ProductGridSkeleton,
} from '~/components/skeletons/shared';

/**
 * About page has complex responsive breakpoints:
 *   <623px: stacked vertical (headshot full width, icons below)
 *   623–940px: headshot + icons side-by-side
 *   ≥941px: larger layout
 *
 * Headshot: responsive height 350-430px
 * Icons: PADI, AAUS, FAA logos with text
 * Accordion card: "About Me" expandable
 * Gear section: 4 category toggles + gear card grid
 */

function AnchorButtonsSkeleton() {
  return (
    <div className="flex justify-center gap-2 px-3 mb-2">
      <Skeleton className="h-9 w-[90px] rounded-md" />
      <Skeleton className="h-9 w-[80px] rounded-md" />
    </div>
  );
}

function AboutSectionSkeleton({
  windowWidth,
}: {
  windowWidth: number | undefined;
}) {
  const w = windowWidth ?? 600;
  const isStacked = w < 623;

  return (
    <div className={`px-3 ${isStacked ? '' : 'flex gap-4 justify-center'}`}>
      {/* Headshot */}
      <div className={`flex justify-center ${isStacked ? 'mb-4' : ''}`}>
        <Skeleton
          className="rounded-md mt-5"
          style={{
            width: isStacked ? '280px' : w < 941 ? '260px' : '300px',
            height: isStacked ? '350px' : w < 941 ? '380px' : '430px',
          }}
        />
      </div>
      {/* Icon credentials */}
      <div className="flex flex-col gap-4 justify-center items-center">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-[50px] w-[50px] rounded-full" />
            <Skeleton className="h-5 w-[200px] rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

function AccordionCardSkeleton() {
  return (
    <div className="mx-[15px] mt-3">
      <Card className="overflow-hidden">
        <div className="flex justify-center items-center px-4 py-4">
          <Skeleton className="h-6 w-[100px] rounded-md" />
        </div>
      </Card>
    </div>
  );
}

function GearSectionSkeleton({
  windowWidth,
}: {
  windowWidth: number | undefined;
}) {
  const w = windowWidth ?? 700;
  const gearGridColumnCount =
    w != undefined ? Math.max(1, Math.floor((w - 1) / 700) + 1) : 1;

  return (
    <section>
      <div className="flex justify-center p-3">
        <Skeleton className="h-9 w-[280px] rounded-md" />
      </div>
      <Separator />
      {/* Toggle buttons */}
      <div className="flex justify-center px-3 py-3">
        <div
          className="flex rounded-md overflow-hidden"
          style={{width: 'min(95vw, 720px)', height: '48px'}}
        >
          {['w-[140px]', 'w-[80px]', 'w-[70px]', 'w-[70px]'].map(
            (width, i) => (
              <Skeleton
                key={i}
                className={`h-full ${width} rounded-none ${i === 0 ? 'rounded-l-md' : ''} ${i === 3 ? 'rounded-r-md' : ''}`}
              />
            ),
          )}
        </div>
      </div>
      {/* Gear cards grid */}
      <div
        className="px-3 py-3"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${gearGridColumnCount}, minmax(0, 1fr))`,
          gap: '12px',
        }}
      >
        {Array.from({length: Math.max(1, gearGridColumnCount)}).map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <div className="px-3 py-3">
              <Skeleton className="h-5 w-full rounded-md mb-2" />
            </div>
            <div className="flex justify-center px-3">
              <Skeleton className="w-full aspect-[4/3] rounded-md" />
            </div>
            <div className="p-3">
              <Card className="p-2">
                <Skeleton className="h-4 w-full rounded-md mb-1" />
                <Skeleton className="h-4 w-3/4 rounded-md mb-2" />
                <div className="flex justify-center">
                  <Skeleton className="h-9 w-[120px] rounded-md" />
                </div>
              </Card>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

export default function AboutPageSkeleton() {
  const windowWidth = useWindowWidth();

  // "About" title — slightly wider than "Work"
  const titleW =
    (windowWidth ?? 800) <= 669
      ? 'w-[110px]'
      : (windowWidth ?? 800) <= 1024
        ? 'w-[125px]'
        : 'w-[140px]';

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <NavbarSkeleton windowWidth={windowWidth} />
      <PageHeaderSkeleton windowWidth={windowWidth} titleWidth={titleW} />
      <AnchorButtonsSkeleton />
      <AboutSectionSkeleton windowWidth={windowWidth} />
      <AccordionCardSkeleton />
      <GearSectionSkeleton windowWidth={windowWidth} />
      <FeaturedSectionSkeleton windowWidth={windowWidth} />
      <ProductGridSkeleton windowWidth={windowWidth} />
    </div>
  );
}
