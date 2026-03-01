import {Skeleton} from '~/components/ui/skeleton';
import {Card, CardContent} from '~/components/ui/card';
import {Separator} from '~/components/ui/separator';
import {useEffect, useState} from 'react';

/**
 * CTA icons skeleton (4 items matching real header-ctas):
 *  1. Notifications — bell icon + chevron (h-9 px-[6px], icon+chevron ~40px)
 *  2. Account — user icon + chevron (h-9 px-[6px], icon+chevron ~40px)
 *  3. Cart — icon only (h-9 px-2 ~34px)
 *  4. Search — icon only (h-9 px-2 ~34px)
 *
 * Real CSS: .header-ctas { grid-gap: 0.5rem } at ≤500px, 1rem at >500px
 *           margin-right: 4px at ≤500px, 20px at ≥501px
 */
function CtasSkeleton({gap, mr}: {gap: string; mr: string}) {
  return (
    <div className={`flex items-center ${gap} ${mr}`}>
      <Skeleton className="h-9 w-[40px] rounded-md" />
      <Skeleton className="h-9 w-[40px] rounded-md" />
      <Skeleton className="h-9 w-[34px] rounded-md" />
      <Skeleton className="h-9 w-[34px] rounded-md" />
    </div>
  );
}

/**
 * Navbar skeleton — mirrors Header.tsx exactly:
 *
 * Real breakpoints (from windowWidth checks in Header.tsx):
 *   < 500   → two rows  (top: logo + CTAs)  (bottom: all 6 links)
 *   500–756 → two rows  (top: logo + CTAs)  (bottom: all 6 links)
 *   757–949 → two rows  (top: logo + first 3 links + CTAs)  (bottom: last 3 links)
 *   950–1024 → one row  (logo + all 6 links in 2 halves + CTAs)
 *   > 1024  → one row   (same, wider gaps)
 */
function NavbarSkeleton({windowWidth}: {windowWidth: number | undefined}) {
  if (windowWidth == undefined) {
    // SSR fallback — two-row mobile (most common first paint)
    return (
      <div className="border-b border-border/40">
        <div className="flex justify-between">
          <div className="mt-4 ps-1">
            <Skeleton className="h-[2.1rem] w-[175px] rounded-md" />
          </div>
          <div className="flex items-center mt-4">
            <CtasSkeleton gap="gap-2" mr="mr-1" />
          </div>
        </div>
        <div className="flex justify-center mb-3 mt-2">
          <div className="flex items-center justify-center w-full px-1">
            <div className="flex justify-center gap-[2px] w-full">
              <Skeleton className="h-8 w-[38px] rounded-md" />
              <Skeleton className="h-8 w-[60px] rounded-md" />
              <Skeleton className="h-8 w-[76px] rounded-md" />
            </div>
            <div className="flex justify-center gap-[2px] w-full ps-[2px]">
              <Skeleton className="h-8 w-[40px] rounded-md" />
              <Skeleton className="h-8 w-[76px] rounded-md" />
              <Skeleton className="h-8 w-[54px] rounded-md" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  /*
   * Logo image — real CSS sets height only, width auto from aspect ratio.
   * Logo aspect ratio (wave icon + "ADAM UNDERWATER" text) ≈ 5.5:1
   *   ≤420px: height 1.8rem → width ≈ 155px
   *   421–538: height 2.1rem → width ≈ 180px
   *   ≥539:   height 2.5rem → width ≈ 215px
   */
  const logoH =
    windowWidth <= 420
      ? 'h-[1.8rem]'
      : windowWidth <= 538
        ? 'h-[2.1rem]'
        : 'h-[2.5rem]';
  const logoW =
    windowWidth <= 420
      ? 'w-[155px]'
      : windowWidth <= 538
        ? 'w-[180px]'
        : 'w-[215px]';

  // CTA gap: .header-ctas { grid-gap: 0.5rem } at ≤500, 1rem at >500
  const ctaGap = windowWidth <= 500 ? 'gap-2' : 'gap-4';
  // CTA margin-right: 4px at ≤500, 20px at ≥501
  const ctaMr = windowWidth <= 500 ? 'mr-1' : 'mr-5';

  /*
   * Nav-link button widths — real buttons have text-sm (14px) or 0.8rem (≤420px)
   * with py-2 px-[4px]. About & Services include a dropdown chevron icon.
   */
  const lw =
    windowWidth <= 420
      ? // font-size: 0.8rem — compact
        ['w-[36px]', 'w-[58px]', 'w-[74px]', 'w-[38px]', 'w-[74px]', 'w-[48px]']
      : windowWidth < 757
        ? // text-sm on mobile
          ['w-[42px]', 'w-[68px]', 'w-[84px]', 'w-[44px]', 'w-[86px]', 'w-[56px]']
        : // text-sm on tablet/desktop
          ['w-[48px]', 'w-[78px]', 'w-[98px]', 'w-[50px]', 'w-[100px]', 'w-[62px]'];

  // ── < 757px: Two-row mobile ──
  // Real structure:
  //   main-navbar-small-top-row (flex, justify-between)
  //     → logo-container (h-9 py-2 mt-4) + ctas-container (flex gap-4 items-center mt-4)
  //   main-navbar-small-bottom-row (flex, justify-center, mb-3 mt-2)
  //     → nav-links-container (flex items-center justify-center)
  //       → first half (flex justify-center gap-[2px] w-full)
  //       → second half (flex justify-center w-full gap-[2px] ps-[2px])
  if (windowWidth < 757) {
    return (
      <div className="border-b border-border/40">
        {/* main-navbar-small-top-row */}
        <div className="flex justify-between">
          <div className="mt-4 ps-1">
            <Skeleton className={`${logoH} ${logoW} rounded-md`} />
          </div>
          <div className="flex items-center mt-4">
            <CtasSkeleton gap={ctaGap} mr={ctaMr} />
          </div>
        </div>
        {/* main-navbar-small-bottom-row */}
        <div className="flex justify-center mb-3 mt-2">
          <div className="flex items-center justify-center w-full px-1">
            <div className="flex justify-center gap-[2px] w-full">
              <Skeleton className={`h-8 ${lw[0]} rounded-md`} />
              <Skeleton className={`h-8 ${lw[1]} rounded-md`} />
              <Skeleton className={`h-8 ${lw[2]} rounded-md`} />
            </div>
            <div className="flex justify-center w-full gap-[2px] ps-[2px]">
              <Skeleton className={`h-8 ${lw[3]} rounded-md`} />
              <Skeleton className={`h-8 ${lw[4]} rounded-md`} />
              <Skeleton className={`h-8 ${lw[5]} rounded-md`} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── 757–949: Two-row tablet ──
  // Real structure:
  //   nav (flex w-full flex-col gap-2)
  //     → top row (flex w-full items-center justify-between gap-4)
  //       → logo (shrink-0, mt-[15.5px])
  //       → first-half links (flex-1 flex justify-center mt-[16px] gap-[2px])
  //       → CTAs (flex gap-4 items-center mt-[16px])
  //     → bottom row (flex justify-center mb-3 gap-[2px] ps-[6px])
  //       → second-half links
  if (windowWidth < 950) {
    return (
      <nav className="flex w-full flex-col gap-2 border-b border-border/40">
        {/* Top row */}
        <div className="flex w-full items-center justify-between gap-4">
          <div className="mt-[15.5px] ps-2 shrink-0">
            <Skeleton className={`${logoH} ${logoW} rounded-md`} />
          </div>
          <div className="flex-1 flex justify-center mt-[16px] gap-[2px]">
            <Skeleton className={`h-8 ${lw[0]} rounded-md`} />
            <Skeleton className={`h-8 ${lw[1]} rounded-md`} />
            <Skeleton className={`h-8 ${lw[2]} rounded-md`} />
          </div>
          <div className="mt-[16px]">
            <CtasSkeleton gap={ctaGap} mr={ctaMr} />
          </div>
        </div>
        {/* Bottom row */}
        <div className="flex justify-center mb-3 gap-[2px] ps-[6px]">
          <Skeleton className={`h-8 ${lw[3]} rounded-md`} />
          <Skeleton className={`h-8 ${lw[4]} rounded-md`} />
          <Skeleton className={`h-8 ${lw[5]} rounded-md`} />
        </div>
      </nav>
    );
  }

  // ── ≥ 950: Single-row desktop ──
  // Real structure:
  //   nav (flex justify-between items-center)
  //     → logo (ps-2 pt-[15px] pb-4)
  //     → links container (flex items-center py-4)
  //       → first half (flex justify-center w-full gap-[2px] or gap-[10px])
  //       → second half (flex justify-center w-full gap-[2px/10px] ps-[2px/10px])
  //     → CTAs (flex gap-3 items-center py-4)
  const linkGap = windowWidth > 1024 ? 'gap-[10px]' : 'gap-[2px]';
  const linkPs = windowWidth > 1024 ? 'ps-[10px]' : 'ps-[2px]';

  return (
    <div className="flex items-center justify-between border-b border-border/40">
      <div className="ps-2 pt-[15px] pb-4 shrink-0">
        <Skeleton className={`${logoH} ${logoW} rounded-md`} />
      </div>
      <div className="flex items-center py-4">
        <div className={`flex justify-center w-full ${linkGap}`}>
          <Skeleton className={`h-8 ${lw[0]} rounded-md`} />
          <Skeleton className={`h-8 ${lw[1]} rounded-md`} />
          <Skeleton className={`h-8 ${lw[2]} rounded-md`} />
        </div>
        <div className={`flex justify-center w-full ${linkGap} ${linkPs}`}>
          <Skeleton className={`h-8 ${lw[3]} rounded-md`} />
          <Skeleton className={`h-8 ${lw[4]} rounded-md`} />
          <Skeleton className={`h-8 ${lw[5]} rounded-md`} />
        </div>
      </div>
      <div className="py-4">
        <CtasSkeleton gap="gap-3" mr={ctaMr} />
      </div>
    </div>
  );
}

/**
 * Hero skeleton — matches Hero.tsx structure:
 *   .main { height: 400px; overflow: hidden; flex center }
 *   img { p-3, hero-img (height: 65px ≤700 / 80px ≥701, border-radius:25px) }
 *   buttons: pt-5, first button w-48 h-10, second mt-5 w-48 h-10
 *   content wrapper: pb-[40px]
 *
 * Hero-img aspect ratio ≈ 4.3:1 based on real screenshots
 */
function HeroSkeleton({windowWidth}: {windowWidth: number | undefined}) {
  const w = windowWidth ?? 0;
  const imgH = w <= 700 ? 'h-[65px]' : 'h-[80px]';
  const imgW = w <= 700 ? 'w-[280px]' : 'w-[360px]';

  return (
    <div className="relative h-[400px] flex flex-col items-center justify-center overflow-hidden">
      {/* Background shimmer */}
      <Skeleton className="absolute inset-0 rounded-none" />

      {/* Content — mirrors real Hero structure */}
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

/**
 * Featured section skeleton — matches _index.tsx section:
 *   <div className="flex justify-center pt-5 me-4">
 *     <img className="featured-img" />   (same responsive heights as hero-img)
 *   </div>
 *   <div className="flex justify-center font-bold text-xl pb-2">
 *     <p>Framed Canvas Wall Art</p>
 *   </div>
 */
function FeaturedSectionSkeleton({
  windowWidth,
}: {
  windowWidth: number | undefined;
}) {
  const w = windowWidth ?? 0;
  const imgH = w <= 700 ? 'h-[65px]' : 'h-[80px]';
  const imgW = w <= 700 ? 'w-[280px]' : 'w-[360px]';

  return (
    <section>
      <div className="flex justify-center pt-5 me-4">
        <Skeleton className={`${imgH} ${imgW} rounded-[25px]`} />
      </div>
      <div className="flex justify-center font-bold text-xl pb-2">
        <Skeleton className="h-6 w-[250px] mt-1" />
      </div>
    </section>
  );
}

function ProductCardSkeleton() {
  return (
    <Card className="h-full overflow-hidden">
      <CardContent className="flex flex-col h-full p-0">
        {/* Image area */}
        <Skeleton className="w-full aspect-[4/5] rounded-b-none rounded-t-xl" />

        {/* Info area */}
        <div className="flex flex-col items-center gap-2.5 px-4 py-4">
          <Skeleton className="h-5 w-3/5" />
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-9 w-[120px] rounded-md mt-1" />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Product grid skeleton — uses the same dynamic column calculation
 * as recommendedProducts.tsx:
 *   Math.max(1, Math.floor((windowWidth - 1) / 700) + 1)
 */
function ProductGridSkeleton({
  windowWidth,
}: {
  windowWidth: number | undefined;
}) {
  const gridColumnCount =
    windowWidth != undefined
      ? Math.max(1, Math.floor((windowWidth - 1) / 700) + 1)
      : 1;

  return (
    <div>
      <Separator />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${gridColumnCount}, minmax(0, 1fr))`,
          columnGap: '8px',
          rowGap: '8px',
          padding: '10px',
        }}
      >
        {Array.from({length: Math.max(4, gridColumnCount * 2)}).map((_, i) => (
          <ProductCardSkeleton key={`prod-skel-${i}`} />
        ))}
      </div>
    </div>
  );
}

export default function HomePageSkeleton() {
  const [windowWidth, setWindowWidth] = useState<number | undefined>(undefined);

  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <NavbarSkeleton windowWidth={windowWidth} />
      <HeroSkeleton windowWidth={windowWidth} />
      <FeaturedSectionSkeleton windowWidth={windowWidth} />
      <ProductGridSkeleton windowWidth={windowWidth} />
    </div>
  );
}
