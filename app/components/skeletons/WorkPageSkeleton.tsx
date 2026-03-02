import {Skeleton} from '~/components/ui/skeleton';
import {
  useWindowWidth,
  NavbarSkeleton,
  PageHeaderSkeleton,
  SectionTitleSkeleton,
  FeaturedSectionSkeleton,
  ProductGridSkeleton,
} from '~/components/skeletons/shared';

/**
 * Clip/iframe skeleton — matches .clip CSS breakpoints:
 *   ≤499px: width 100%, aspect-ratio 16/9 (padding 16px 24px)
 *   500–599: width 85vw
 *   600–699: width 85vw, aspect-ratio 16/9
 *   700–828: width 80vw, height 35vh
 *   ≥829:    width 80vw, height 45vh
 *
 * Outer wrapper: clip-wrapper px-[40px] (overridden ≤699px to px-[24px])
 */
function ClipSkeleton({windowWidth}: {windowWidth: number | undefined}) {
  const w = windowWidth ?? 500;

  let clipStyle: React.CSSProperties;
  if (w <= 499) {
    clipStyle = {width: '100%', aspectRatio: '16/9'};
  } else if (w <= 699) {
    clipStyle = {width: '85vw', aspectRatio: '16/9'};
  } else if (w <= 828) {
    clipStyle = {width: '80vw', height: '35vh'};
  } else {
    clipStyle = {width: '80vw', height: '45vh'};
  }

  const wrapperPx = w <= 699 ? 'px-[24px]' : 'px-[40px]';

  return (
    <div
      className={`flex justify-center ${wrapperPx} pt-[20px] pb-[10px]`}
    >
      <Skeleton className="rounded-md" style={clipStyle} />
    </div>
  );
}

export default function WorkPageSkeleton() {
  const windowWidth = useWindowWidth();

  // Title width for "Work" header — aspect ratio ~3:1 from height
  // ≤669: h=32 → w≈96, 670-1024: h=36 → w≈108, ≥1025: h=40 → w≈120
  const titleW =
    (windowWidth ?? 800) <= 669
      ? 'w-[96px]'
      : (windowWidth ?? 800) <= 1024
        ? 'w-[108px]'
        : 'w-[120px]';

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <NavbarSkeleton />
      <PageHeaderSkeleton titleWidth={titleW} />
      <SectionTitleSkeleton width="w-[260px]" />
      <ClipSkeleton windowWidth={windowWidth} />
      <SectionTitleSkeleton width="w-[280px]" />
      <ClipSkeleton windowWidth={windowWidth} />
      <FeaturedSectionSkeleton />
      <ProductGridSkeleton />
    </div>
  );
}
