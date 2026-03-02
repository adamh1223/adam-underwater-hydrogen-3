import {Skeleton} from '~/components/ui/skeleton';
import {Card, CardContent} from '~/components/ui/card';
import {Separator} from '~/components/ui/separator';
import {useEffect, useRef, useState} from 'react';

// ─── Shared hook ───────────────────────────────────────────────────────

export function useWindowWidth() {
  const [windowWidth, setWindowWidth] = useState<number | undefined>(undefined);

  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return windowWidth;
}

// ─── CTA icons skeleton ────────────────────────────────────────────────
// 4 items: notifications (40px), account (40px), cart (34px), search (34px)

export function CtasSkeleton({gap, mr}: {gap: string; mr: string}) {
  return (
    <div className={`flex items-center ${gap} ${mr}`}>
      <Skeleton className="h-9 w-[40px] rounded-md" />
      <Skeleton className="h-9 w-[40px] rounded-md" />
      <Skeleton className="h-9 w-[34px] rounded-md" />
      <Skeleton className="h-9 w-[34px] rounded-md" />
    </div>
  );
}

// ─── Navbar skeleton ───────────────────────────────────────────────────
// Mirrors Header.tsx exactly with 5 breakpoints:
//   < 500   → two rows
//   500–756 → two rows
//   757–949 → two rows (tablet)
//   950–1024 → one row
//   > 1024  → one row (wider gaps)

export function NavbarSkeleton({
  windowWidth,
}: {
  windowWidth: number | undefined;
}) {
  if (windowWidth == undefined) {
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
  const ctaGap = windowWidth <= 500 ? 'gap-2' : 'gap-4';
  const ctaMr = windowWidth <= 500 ? 'mr-1' : 'mr-5';
  const lw =
    windowWidth <= 420
      ? [
          'w-[36px]',
          'w-[58px]',
          'w-[74px]',
          'w-[38px]',
          'w-[74px]',
          'w-[48px]',
        ]
      : windowWidth < 757
        ? [
            'w-[42px]',
            'w-[68px]',
            'w-[84px]',
            'w-[44px]',
            'w-[86px]',
            'w-[56px]',
          ]
        : [
            'w-[48px]',
            'w-[78px]',
            'w-[98px]',
            'w-[50px]',
            'w-[100px]',
            'w-[62px]',
          ];

  // < 757: Two-row mobile
  if (windowWidth < 757) {
    return (
      <div className="border-b border-border/40">
        <div className="flex justify-between">
          <div className="mt-4 ps-1">
            <Skeleton className={`${logoH} ${logoW} rounded-md`} />
          </div>
          <div className="flex items-center mt-4">
            <CtasSkeleton gap={ctaGap} mr={ctaMr} />
          </div>
        </div>
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

  // 757–949: Two-row tablet
  if (windowWidth < 950) {
    return (
      <nav className="flex w-full flex-col gap-2 border-b border-border/40">
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
        <div className="flex justify-center mb-3 gap-[2px] ps-[6px]">
          <Skeleton className={`h-8 ${lw[3]} rounded-md`} />
          <Skeleton className={`h-8 ${lw[4]} rounded-md`} />
          <Skeleton className={`h-8 ${lw[5]} rounded-md`} />
        </div>
      </nav>
    );
  }

  // ≥ 950: Single-row desktop
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

// ─── Page header skeleton (icon + title image) ────────────────────────
// CSS breakpoints:
//   ≤669px: icon 44px, title 32px
//   670–1024px: icon 48px, title 36px
//   ≥1025px: icon 52px, title 40px
// Title widths differ by page but all are ~3-6x height (aspect ratio)

export function PageHeaderSkeleton({
  windowWidth,
  titleWidth,
}: {
  windowWidth: number | undefined;
  /** Width of the page title skeleton — varies per page */
  titleWidth: string;
}) {
  const w = windowWidth ?? 800;
  const iconH = w <= 669 ? 'h-[44px]' : w <= 1024 ? 'h-[48px]' : 'h-[52px]';
  const iconW = w <= 669 ? 'w-[44px]' : w <= 1024 ? 'w-[48px]' : 'w-[52px]';
  const titleH =
    w <= 669 ? 'h-[32px]' : w <= 1024 ? 'h-[36px]' : 'h-[40px]';
  const gap = w <= 669 ? 'gap-[5px]' : w <= 1024 ? 'gap-[7px]' : 'gap-[5px]';

  return (
    <div
      className={`flex justify-center items-center ${gap} mt-3 mb-3`}
    >
      <Skeleton className={`${iconH} ${iconW} rounded-md`} />
      <Skeleton className={`${titleH} ${titleWidth} rounded-md`} />
    </div>
  );
}

// ─── Section title skeleton ────────────────────────────────────────────
// Matches Sectiontitle component: h2 text-3xl + Separator

export function SectionTitleSkeleton({width = 'w-[220px]'}: {width?: string}) {
  return (
    <div>
      <div className="flex justify-center px-3 pb-3">
        <Skeleton className={`h-8 ${width} rounded-md`} />
      </div>
      <Separator />
    </div>
  );
}

// ─── Featured section skeleton ─────────────────────────────────────────
// featured-img + "Framed Canvas Wall Art" title

export function FeaturedSectionSkeleton({
  windowWidth,
}: {
  windowWidth: number | undefined;
}) {
  const w = windowWidth ?? 0;
  const imgH = w <= 700 ? 'h-[70px]' : 'h-[80px]';
  const imgW = w <= 700 ? 'w-[300px]' : 'w-[360px]';

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

// ─── Product card skeleton ─────────────────────────────────────────────

export function ProductCardSkeleton() {
  return (
    <Card className="h-full overflow-hidden">
      <CardContent className="flex flex-col h-full p-0">
        <Skeleton className="w-full aspect-[4/5] rounded-b-none rounded-t-xl" />
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

// ─── Product grid skeleton ─────────────────────────────────────────────
// Dynamic columns: Math.max(1, Math.floor((windowWidth - 1) / 700) + 1)

export function ProductGridSkeleton({
  windowWidth,
  count,
}: {
  windowWidth: number | undefined;
  count?: number;
}) {
  const gridColumnCount =
    windowWidth != undefined
      ? Math.max(1, Math.floor((windowWidth - 1) / 700) + 1)
      : 1;
  const cardCount = count ?? Math.max(4, gridColumnCount * 2);

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
        {Array.from({length: cardCount}).map((_, i) => (
          <ProductCardSkeleton key={`prod-skel-${i}`} />
        ))}
      </div>
    </div>
  );
}

// ─── Account header skeleton ───────────────────────────────────────────
// account image (h-[80px]) + welcome text + nav tabs (2 rows)

export function AccountHeaderSkeleton() {
  return (
    <div className="account">
      <h1>
        <div className="flex justify-center">
          <Skeleton className="h-[80px] w-[200px] rounded-md" />
        </div>
        <div className="flex justify-center mt-2">
          <Skeleton className="h-6 w-[180px] rounded-md" />
        </div>
      </h1>
      <br />
      {/* Account nav tabs — 2 rows mirroring AccountMenu */}
      <nav role="navigation">
        <div className="flex justify-center ms-2">
          <div className="flex justify-center">
            <div className="flex items-center">
              <Skeleton className="h-9 w-[70px] rounded-md" />
              <span className="mx-1 text-muted-foreground">&nbsp;|&nbsp;</span>
            </div>
            <div className="flex items-center">
              <Skeleton className="h-9 w-[65px] rounded-md" />
              <span className="mx-1 text-muted-foreground">&nbsp;|&nbsp;</span>
            </div>
            <div className="flex items-center">
              <Skeleton className="h-9 w-[80px] rounded-md" />
              <span className="mx-1 text-muted-foreground">&nbsp;|&nbsp;</span>
            </div>
          </div>
          <div className="flex justify-center">
            <div className="flex items-center">
              <Skeleton className="h-9 w-[72px] rounded-md" />
              <span className="mx-1 text-muted-foreground">&nbsp;|&nbsp;</span>
            </div>
            <div className="flex items-center">
              <Skeleton className="h-9 w-[88px] rounded-md" />
              <span className="mx-1 text-muted-foreground">&nbsp;|&nbsp;</span>
            </div>
            <div className="flex items-center">
              <Skeleton className="h-9 w-[75px] rounded-md" />
            </div>
          </div>
        </div>
      </nav>
      <br />
    </div>
  );
}

// ─── Skeleton loading gate wrapper ─────────────────────────────────────
// Reusable wrapper for the loading gate pattern
// Includes a safety timeout so pages never get stuck on the skeleton
// if an onLoad signal is missed (e.g. cached images during SSR hydration).

export function SkeletonGate({
  isReady,
  skeleton,
  children,
  maxWait = 5000,
}: {
  isReady: boolean;
  skeleton: React.ReactNode;
  children: React.ReactNode;
  /** Safety timeout (ms) — auto-reveal content if isReady never fires. */
  maxWait?: number;
}) {
  const [timedOut, setTimedOut] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isReady) {
      // Already ready — clear any pending timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    // Start safety timer
    timerRef.current = setTimeout(() => setTimedOut(true), maxWait);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isReady, maxWait]);

  const ready = isReady || timedOut;

  return (
    <>
      {!ready && (
        <div className="fixed inset-0 z-[999] bg-background">{skeleton}</div>
      )}
      <div className={ready ? '' : 'invisible'}>{children}</div>
    </>
  );
}
