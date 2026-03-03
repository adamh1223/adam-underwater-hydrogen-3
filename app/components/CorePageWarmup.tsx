import {PrefetchPageLinks, useLocation, useNavigate} from '@remix-run/react';
import {startTransition, useEffect, useMemo, useState} from 'react';
import {
  getCorePagePrefetchPaths,
  isCorePageWarm,
  normalizeCorePagePath,
  warmCorePageAssets,
} from '~/lib/corePageWarmup';

type IdleWindow = Window &
  typeof globalThis & {
    requestIdleCallback?: (
      callback: () => void,
      options?: {timeout: number},
    ) => number;
    cancelIdleCallback?: (handle: number) => void;
  };

function scheduleIdleWarmup(callback: () => void) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const idleWindow = window as IdleWindow;
  if (typeof idleWindow.requestIdleCallback === 'function') {
    const idleHandle = idleWindow.requestIdleCallback(callback, {
      timeout: 1200,
    });
    return () => idleWindow.cancelIdleCallback?.(idleHandle);
  }

  const timeoutHandle = window.setTimeout(callback, 250);
  return () => window.clearTimeout(timeoutHandle);
}

function shouldConserveMobileBandwidth() {
  if (typeof window === 'undefined') return false;

  const coarsePointer =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(hover: none) and (pointer: coarse)').matches;

  const nav = navigator as Navigator & {
    connection?: {
      saveData?: boolean;
      effectiveType?: string;
    };
  };
  const connection = nav.connection;
  const saveData = connection?.saveData === true;
  const constrainedNetwork = ['slow-2g', '2g', '3g'].includes(
    connection?.effectiveType ?? '',
  );

  return coarsePointer || saveData || constrainedNetwork;
}

export function CorePageWarmup() {
  const location = useLocation();
  const navigate = useNavigate();
  const [shouldWarmPages, setShouldWarmPages] = useState(false);
  const shouldConserveWarmupBandwidth = useMemo(
    () => shouldConserveMobileBandwidth(),
    [],
  );

  const prefetchPaths = useMemo(
    () => getCorePagePrefetchPaths(location.pathname),
    [location.pathname],
  );

  useEffect(() => {
    if (shouldConserveWarmupBandwidth) return;
    return scheduleIdleWarmup(() => {
      setShouldWarmPages(true);
    });
  }, [shouldConserveWarmupBandwidth]);

  useEffect(() => {
    if (!shouldWarmPages) return;

    prefetchPaths.forEach((path) => {
      void warmCorePageAssets(path);
    });
  }, [prefetchPaths, shouldWarmPages]);

  useEffect(() => {
    if (shouldConserveWarmupBandwidth) return;

    const handleCorePageClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;

      let nextUrl: URL;
      try {
        nextUrl = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (nextUrl.origin !== window.location.origin) return;
      if (!normalizeCorePagePath(nextUrl.pathname)) return;

      const nextHref = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
      const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;

      if (nextHref === currentHref) return;
      if (isCorePageWarm(nextUrl.pathname)) return;

      event.preventDefault();
      event.stopPropagation();

      void warmCorePageAssets(nextUrl.pathname).finally(() => {
        startTransition(() => {
          navigate(nextHref);
        });
      });
    };

    document.addEventListener('click', handleCorePageClick, true);
    return () => {
      document.removeEventListener('click', handleCorePageClick, true);
    };
  }, [navigate, shouldConserveWarmupBandwidth]);

  if (shouldConserveWarmupBandwidth || !shouldWarmPages) return null;

  return (
    <>
      {prefetchPaths.map((path) => (
        <PrefetchPageLinks key={path} page={path} />
      ))}
    </>
  );
}
