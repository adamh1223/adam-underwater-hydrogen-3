import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

const STOCK_SWIPE_ASSET_BASE_URL =
  'https://downloads.adamunderwater.com/shared/stock-swipe';

const STOCK_SWIPE_IMAGE_EXTENSIONS = [
  'jpg',
  'png',
  'jpeg',
  'webp',
  'JPG',
  'PNG',
  'JPEG',
  'WEBP',
];

function buildSwipeImageCandidates(resolutionLabel: string, vidKey: string) {
  const normalizedResolution = resolutionLabel.toLowerCase();

  return STOCK_SWIPE_IMAGE_EXTENSIONS.map(
    (extension) =>
      `${STOCK_SWIPE_ASSET_BASE_URL}/swipe${normalizedResolution}-${vidKey}.${extension}`,
  );
}

function preloadFirstAvailableImage(candidates: string[]) {
  return new Promise<string | null>((resolve) => {
    if (typeof window === 'undefined') {
      resolve(candidates[0] ?? null);
      return;
    }

    let nextIndex = 0;

    const tryNext = () => {
      const nextUrl = candidates[nextIndex++];
      if (!nextUrl) {
        resolve(null);
        return;
      }

      const image = new window.Image();
      image.decoding = 'async';
      image.onload = () => resolve(nextUrl);
      image.onerror = () => tryNext();
      image.src = nextUrl;
    };

    tryNext();
  });
}

function clampSwipePosition(value: number) {
  return Math.min(96, Math.max(4, value));
}

function toPercentage(clientX: number, rect: DOMRect) {
  return clampSwipePosition(((clientX - rect.left) / rect.width) * 100);
}

export default function VideoResolutionSwipeSection({
  vidKey,
  higherResolutionLabel,
}: {
  vidKey: string;
  higherResolutionLabel: string;
}) {
  const [leftImageUrl, setLeftImageUrl] = useState<string | null>(null);
  const [rightImageUrl, setRightImageUrl] = useState<string | null>(null);
  const [dividerPercentage, setDividerPercentage] = useState(50);
  const compareRef = useRef<HTMLDivElement | null>(null);

  const leftCandidates = useMemo(
    () => buildSwipeImageCandidates('4k', vidKey),
    [vidKey],
  );
  const rightCandidates = useMemo(
    () => buildSwipeImageCandidates(higherResolutionLabel, vidKey),
    [higherResolutionLabel, vidKey],
  );

  useEffect(() => {
    let cancelled = false;

    setLeftImageUrl(null);
    setRightImageUrl(null);

    Promise.all([
      preloadFirstAvailableImage(leftCandidates),
      preloadFirstAvailableImage(rightCandidates),
    ]).then(([resolvedLeftUrl, resolvedRightUrl]) => {
      if (cancelled) return;
      if (!resolvedLeftUrl || !resolvedRightUrl) return;

      setLeftImageUrl(resolvedLeftUrl);
      setRightImageUrl(resolvedRightUrl);
    });

    return () => {
      cancelled = true;
    };
  }, [leftCandidates, rightCandidates]);

  const updateDividerFromClientX = useCallback((clientX: number) => {
    const container = compareRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    if (rect.width <= 0) return;

    setDividerPercentage(toPercentage(clientX, rect));
  }, []);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      updateDividerFromClientX(event.clientX);

      const handlePointerMove = (moveEvent: PointerEvent) => {
        updateDividerFromClientX(moveEvent.clientX);
      };

      const handlePointerUp = () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('pointercancel', handlePointerUp);
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('pointercancel', handlePointerUp);
    },
    [updateDividerFromClientX],
  );

  if (!leftImageUrl || !rightImageUrl) return null;

  return (
    <section className="mt-6">
      <div className="section-title-container">
        <div className="flex items-center justify-center w-full">
          <div className="flex-1 h-px bg-muted" />
          <span className="px-4 text-center">
            <p className="text-xl">
              4K or {higherResolutionLabel}? Swipe to see the difference
            </p>
          </span>
          <div className="flex-1 h-px bg-muted" />
        </div>
      </div>

      <div className="mx-auto mt-5 w-full max-w-6xl px-[20px] lg:px-[35px]">
        <div
          ref={compareRef}
          className="relative mx-auto aspect-[16/9] w-full max-w-[52rem] overflow-hidden rounded-xl border border-border bg-black/20 shadow-sm select-none touch-none cursor-col-resize"
          onPointerDown={handlePointerDown}
        >
          <div className="absolute inset-0 overflow-hidden">
            <img
              src={leftImageUrl}
              alt="4K comparison preview"
              className="pointer-events-none absolute inset-0 h-full w-full object-cover"
              draggable={false}
              style={{
                transform: 'scale(1.5)',
                transformOrigin: 'center center',
              }}
            />
          </div>
          <div
            className="absolute inset-0 overflow-hidden"
            style={{clipPath: `inset(0 0 0 ${dividerPercentage}%)`}}
          >
            <img
              src={rightImageUrl}
              alt={`${higherResolutionLabel} comparison preview`}
              className="pointer-events-none absolute inset-0 h-full w-full object-cover"
              draggable={false}
              style={{
                transform: 'scale(1.5)',
                transformOrigin: 'center center',
              }}
            />
          </div>

          <div className="absolute inset-x-0 top-4 z-20 flex items-center justify-between px-4 sm:px-5 text-white">
            <span className="rounded-full bg-black/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em]">
              4K
            </span>
            <span className="rounded-full bg-black/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em]">
              {higherResolutionLabel}
            </span>
          </div>

          <div
            className="absolute inset-y-0 z-20 w-[3px] bg-white shadow-[0_0_0_1px_rgba(255,255,255,0.25)]"
            style={{
              left: `${dividerPercentage}%`,
              transform: 'translateX(-50%)',
            }}
          />
          <div
            className="absolute top-4 z-30 -translate-x-1/2"
            style={{left: `${dividerPercentage}%`}}
          >
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-black">
              Swipe
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
