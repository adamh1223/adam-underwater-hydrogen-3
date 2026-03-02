import {Skeleton} from '~/components/ui/skeleton';
import {Card, CardContent} from '~/components/ui/card';
import {Separator} from '~/components/ui/separator';
import {useEffect, useRef, useState} from 'react';

// ─── Shared hook ───────────────────────────────────────────────────────
// Still exported for page-specific sizing needs, but no longer required
// by the shared skeleton building blocks (they all use CSS responsive now).

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
// Uses CSS responsive classes so it renders correctly during SSR.
//   < 950px  → two rows (mobile / tablet)
//   ≥ 950px  → single row (desktop)

export function NavbarSkeleton() {
  return (
    <>
      {/* ── Mobile / Tablet (< 950px) ── */}
      <div className="border-b border-border/40 min-[950px]:hidden">
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
              <Skeleton className="h-8 w-[42px] rounded-md" />
              <Skeleton className="h-8 w-[68px] rounded-md" />
              <Skeleton className="h-8 w-[84px] rounded-md" />
            </div>
            <div className="flex justify-center w-full gap-[2px] ps-[2px]">
              <Skeleton className="h-8 w-[44px] rounded-md" />
              <Skeleton className="h-8 w-[86px] rounded-md" />
              <Skeleton className="h-8 w-[56px] rounded-md" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Desktop (≥ 950px) ── */}
      <div className="hidden min-[950px]:flex items-center justify-between border-b border-border/40">
        <div className="ps-2 pt-[15px] pb-4 shrink-0">
          <Skeleton className="h-[2.5rem] w-[215px] rounded-md" />
        </div>
        <div className="flex items-center py-4 gap-[10px]">
          <Skeleton className="h-8 w-[48px] rounded-md" />
          <Skeleton className="h-8 w-[78px] rounded-md" />
          <Skeleton className="h-8 w-[98px] rounded-md" />
          <Skeleton className="h-8 w-[50px] rounded-md" />
          <Skeleton className="h-8 w-[100px] rounded-md" />
          <Skeleton className="h-8 w-[62px] rounded-md" />
        </div>
        <div className="py-4">
          <CtasSkeleton gap="gap-3" mr="mr-5" />
        </div>
      </div>
    </>
  );
}

// ─── Page header skeleton (icon + title image) ────────────────────────
// CSS responsive — no JS needed.

export function PageHeaderSkeleton({
  titleWidth,
}: {
  /** Width of the page title skeleton — varies per page */
  titleWidth: string;
}) {
  return (
    <div className="flex justify-center items-center gap-[5px] min-[670px]:gap-[7px] min-[1025px]:gap-[5px] mt-3 mb-3">
      <Skeleton className="h-[44px] w-[44px] min-[670px]:h-[48px] min-[670px]:w-[48px] min-[1025px]:h-[52px] min-[1025px]:w-[52px] rounded-md" />
      <Skeleton className={`h-[32px] min-[670px]:h-[36px] min-[1025px]:h-[40px] ${titleWidth} rounded-md`} />
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
// featured-img + "Framed Canvas Wall Art" title — CSS responsive

export function FeaturedSectionSkeleton() {
  return (
    <section>
      <div className="flex justify-center pt-5 me-4">
        <Skeleton className="h-[70px] min-[700px]:h-[80px] w-[300px] min-[700px]:w-[360px] rounded-[25px]" />
      </div>
      <div className="flex justify-center font-bold text-xl pb-2">
        <Skeleton className="h-6 w-[250px] mt-1" />
      </div>
    </section>
  );
}

// ─── Product card skeleton ─────────────────────────────────────────────
// aspect-[4/3] for image area to match actual carousel card height.

export function ProductCardSkeleton() {
  return (
    <Card className="h-full overflow-hidden">
      <CardContent className="flex flex-col h-full p-0">
        <Skeleton className="w-full aspect-[4/3] rounded-b-none rounded-t-xl" />
        <div className="flex flex-col items-center gap-2 px-4 py-3">
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
// CSS responsive grid — matches actual breakpoints:
//   < 700px → 1 col, 700–1399px → 2 cols, ≥ 1400px → 3 cols

export function ProductGridSkeleton({count}: {count?: number}) {
  const cardCount = count ?? 6;

  return (
    <div>
      <Separator />
      <div className="grid grid-cols-1 min-[700px]:grid-cols-2 min-[1400px]:grid-cols-3 gap-2 p-[10px]">
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
// Reusable wrapper for the loading gate pattern.
// Includes a safety timeout so pages never get stuck on the skeleton
// if an onLoad signal is missed (e.g. cached images during SSR hydration).

export function SkeletonGate({
  isReady,
  skeleton,
  children,
  maxWait = 2000,
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
