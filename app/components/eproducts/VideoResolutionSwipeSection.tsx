import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '~/components/ui/tooltip';
import {Kbd} from '~/components/ui/kbd';

const STOCK_SWIPE_ASSET_BASE_URL =
  'https://downloads.adamunderwater.com/shared/stock-swipe';
const HAND_TOGGLE_ICON_URL =
  'https://downloads.adamunderwater.com/store-1-au/public/hand-icon.png';

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
const DEFAULT_HIGHER_RESOLUTION_LABELS = ['8K', '6K', '5K', '10K', '12K'];

function buildLegacySwipeImageCandidates(
  resolutionLabel: string,
  vidKey: string,
) {
  const normalizedResolution = resolutionLabel.toLowerCase();

  return STOCK_SWIPE_IMAGE_EXTENSIONS.map(
    (extension) =>
      `${STOCK_SWIPE_ASSET_BASE_URL}/swipe${normalizedResolution}-${vidKey}.${extension}`,
  );
}

function parseResolutionNumber(label: string): number | null {
  const match = label.trim().toUpperCase().match(/^(\d+)\s*K$/);
  if (!match) return null;
  const parsed = Number.parseInt(match[1] ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function normalizeHigherResolutionLabel(label: string): string | null {
  const parsed = parseResolutionNumber(label);
  if (parsed === null || parsed <= 4) return null;
  return `${parsed}K`;
}

function extractProductNumberFromVidKey(vidKey: string): string | null {
  const match = vidKey.match(/(\d+)/);
  return match?.[1] ?? null;
}

function buildModernLeftImageCandidates(
  higherResolutionLabel: string,
  productNumber: string,
) {
  const parsedResolution = parseResolutionNumber(higherResolutionLabel);
  if (parsedResolution === null || parsedResolution <= 4) return [];

  const filenameStems = [
    `img-UM-${parsedResolution}-4K-${productNumber}`,
    `img-UM-4K-${productNumber}`,
  ];

  return filenameStems.flatMap((filenameStem) =>
    STOCK_SWIPE_IMAGE_EXTENSIONS.map(
      (extension) =>
        `${STOCK_SWIPE_ASSET_BASE_URL}/${filenameStem}.${extension}`,
    ),
  );
}

function buildModernRightImageCandidates(
  higherResolutionLabel: string,
  productNumber: string,
) {
  const normalizedHigherResolution =
    normalizeHigherResolutionLabel(higherResolutionLabel);
  if (!normalizedHigherResolution) return [];

  return STOCK_SWIPE_IMAGE_EXTENSIONS.map(
    (extension) =>
      `${STOCK_SWIPE_ASSET_BASE_URL}/img-UM-${normalizedHigherResolution}-${productNumber}.${extension}`,
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
  higherResolutionLabel?: string;
}) {
  const [leftImageUrl, setLeftImageUrl] = useState<string | null>(null);
  const [rightImageUrl, setRightImageUrl] = useState<string | null>(null);
  const [resolvedHigherResolutionLabel, setResolvedHigherResolutionLabel] =
    useState<string | null>(null);
  const [dividerPercentage, setDividerPercentage] = useState(50);
  const [zoomLevel, setZoomLevel] = useState(3);
  const [mode, setMode] = useState<'swipe' | 'pan'>('swipe');
  const [originX, setOriginX] = useState(50);
  const [originY, setOriginY] = useState(50);
  const [isPanning, setIsPanning] = useState(false);
  const compareRef = useRef<HTMLDivElement | null>(null);

  const ZOOM_MIN = 1;
  const ZOOM_MAX = 4;
  const ZOOM_STEP = 0.5;

  const handleZoomIn = useCallback((e: React.PointerEvent | React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setZoomLevel((prev) => Math.min(ZOOM_MAX, +(prev + ZOOM_STEP).toFixed(2)));
  }, []);

  const handleZoomOut = useCallback((e: React.PointerEvent | React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setZoomLevel((prev) => Math.max(ZOOM_MIN, +(prev - ZOOM_STEP).toFixed(2)));
  }, []);

  const handleToggleMode = useCallback((e: React.PointerEvent | React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setMode((prev) => (prev === 'swipe' ? 'pan' : 'swipe'));
  }, []);

  const handlePanPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsPanning(true);
      const startX = event.clientX;
      const startY = event.clientY;
      const startOriginX = originX;
      const startOriginY = originY;
      const container = compareRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();

      const handlePanMove = (moveEvent: PointerEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;
        const percentX = (deltaX / rect.width) * 100;
        const percentY = (deltaY / rect.height) * 100;
        const zoom = zoomLevel;
        const range = ((zoom - 1) / zoom) * 50;
        const clamp = (v: number) => Math.min(50 + range, Math.max(50 - range, v));
        setOriginX(clamp(startOriginX - percentX));
        setOriginY(clamp(startOriginY - percentY));
      };

      const handlePanUp = () => {
        setIsPanning(false);
        window.removeEventListener('pointermove', handlePanMove);
        window.removeEventListener('pointerup', handlePanUp);
        window.removeEventListener('pointercancel', handlePanUp);
      };

      window.addEventListener('pointermove', handlePanMove);
      window.addEventListener('pointerup', handlePanUp);
      window.addEventListener('pointercancel', handlePanUp);
    },
    [originX, originY, zoomLevel],
  );

  const productNumber = useMemo(
    () => extractProductNumberFromVidKey(vidKey),
    [vidKey],
  );
  const higherResolutionCandidates = useMemo(
    () =>
      Array.from(
        new Set(
          [
            higherResolutionLabel,
            ...DEFAULT_HIGHER_RESOLUTION_LABELS,
          ]
            .map((label) =>
              typeof label === 'string'
                ? normalizeHigherResolutionLabel(label)
                : null,
            )
            .filter((label): label is string => Boolean(label)),
        ),
      ),
    [higherResolutionLabel],
  );

  useEffect(() => {
    let cancelled = false;

    setLeftImageUrl(null);
    setRightImageUrl(null);
    setResolvedHigherResolutionLabel(null);

    const load = async () => {
      for (const resolutionLabel of higherResolutionCandidates) {
        const modernLeftCandidates =
          productNumber !== null
            ? buildModernLeftImageCandidates(resolutionLabel, productNumber)
            : [];
        const modernRightCandidates =
          productNumber !== null
            ? buildModernRightImageCandidates(resolutionLabel, productNumber)
            : [];
        const legacyLeftCandidates = buildLegacySwipeImageCandidates('4k', vidKey);
        const legacyRightCandidates = buildLegacySwipeImageCandidates(
          resolutionLabel,
          vidKey,
        );

        const resolvedLeftUrl = await preloadFirstAvailableImage([
          ...modernLeftCandidates,
          ...legacyLeftCandidates,
        ]);
        if (cancelled || !resolvedLeftUrl) continue;

        const resolvedRightUrl = await preloadFirstAvailableImage([
          ...modernRightCandidates,
          ...legacyRightCandidates,
        ]);
        if (cancelled) return;
        if (!resolvedRightUrl) continue;

        setLeftImageUrl(resolvedLeftUrl);
        setRightImageUrl(resolvedRightUrl);
        setResolvedHigherResolutionLabel(resolutionLabel);
        return;
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [higherResolutionCandidates, productNumber, vidKey]);

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
  const [windowWidth, setWindowWidth] = useState<number | undefined>(undefined);
  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === 'h') {
        setMode((prev) => (prev === 'swipe' ? 'pan' : 'swipe'));
      } else if (e.key === '=') {
        setZoomLevel((prev) => Math.min(ZOOM_MAX, +(prev + ZOOM_STEP).toFixed(2)));
      } else if (e.key === '-') {
        setZoomLevel((prev) => Math.max(ZOOM_MIN, +(prev - ZOOM_STEP).toFixed(2)));
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!leftImageUrl || !rightImageUrl || !resolvedHigherResolutionLabel)
    return null;

  return (
    <>
      <section className="mt-6">
        <div className="section-title-container">
          <div className="flex items-center justify-center w-full">
            <div className="flex-1 h-px bg-muted" />
            <span className="px-4 text-center">
              <p className="text-xl">
                4K or {resolvedHigherResolutionLabel}? Swipe to see the difference
              </p>
            </span>
            <div className="flex-1 h-px bg-muted" />
          </div>
        </div>

        {windowWidth != undefined && windowWidth <= 1250 && (
          <>
            <div className="mx-auto mt-5 w-full max-w-6xl px-[12px] lg:px-[35px]">
              <div
                ref={compareRef}
                className="relative mx-auto aspect-[16/9] w-full max-w-[52rem] overflow-hidden rounded-xl border border-border bg-black/20 shadow-sm select-none touch-none"
                style={{cursor: mode === 'pan' ? (isPanning ? 'grabbing' : 'grab') : 'col-resize'}}
                onPointerDown={mode === 'pan' ? handlePanPointerDown : handlePointerDown}
              >
                <div className="absolute inset-0 overflow-hidden">
                  <img
                    src={leftImageUrl}
                    alt="4K comparison preview"
                    className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                    draggable={false}
                    style={{
                      transform: `scale(${zoomLevel})`,
                      transformOrigin: `${originX}% ${originY}%`,
                      transition: 'transform 0.35s cubic-bezier(0.25, 0.1, 0.25, 1)',
                    }}
                  />
                </div>
                <div
                  className="absolute inset-0 overflow-hidden"
                  style={{clipPath: `inset(0 0 0 ${dividerPercentage}%)`}}
                >
                  <img
                    src={rightImageUrl}
                    alt={`${resolvedHigherResolutionLabel} comparison preview`}
                    className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                    draggable={false}
                    style={{
                      transform: `scale(${zoomLevel})`,
                      transformOrigin: `${originX}% ${originY}%`,
                      transition: 'transform 0.35s cubic-bezier(0.25, 0.1, 0.25, 1)',
                    }}
                  />
                </div>

                <div className="absolute inset-x-0 top-4 z-20 flex items-center justify-between px-4 sm:px-5 text-white">
                  <span className="rounded-full bg-black/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em]">
                    4K
                  </span>
                  <span className="rounded-full bg-black/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em]">
                    {resolvedHigherResolutionLabel}
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

                {/* Mode toggle + Zoom +/- control */}
                <div className="absolute bottom-4 right-4 z-30 flex flex-col items-center gap-2">
                  {/* Standalone toggle button */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="flex items-center justify-center rounded-full bg-[#444] hover:bg-[#555] active:bg-[#333] text-white transition-colors"
                        style={{width: 40, height: 40, boxShadow: '0 2px 8px rgba(0,0,0,0.4)', cursor: 'pointer'}}
                        onPointerDown={handleToggleMode}
                        aria-label={mode === 'swipe' ? 'Switch to pan mode' : 'Switch to swipe mode'}
                      >
                        {mode === 'swipe' ? (
                          <img
                            src={HAND_TOGGLE_ICON_URL}
                            alt=""
                            aria-hidden="true"
                            className="pointer-events-none h-6 w-6 -translate-x-0.249 object-contain"
                            draggable={false}
                          />
                        ) : (
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                            <path d="M8 12h8M8 12l2-2M8 12l2 2M16 12l-2-2M16 12l-2 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="text-sm z-[1001]">
                      Toggle Hand: <Kbd>h</Kbd>
                    </TooltipContent>
                  </Tooltip>
                  {/* Zoom +/- pill */}
                  <div
                    className="flex flex-col overflow-hidden rounded-full"
                    style={{boxShadow: '0 2px 8px rgba(0,0,0,0.4)', cursor: 'pointer'}}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="flex items-center justify-center bg-[#444] hover:bg-[#555] active:bg-[#333] text-white transition-colors"
                          style={{width: 40, height: 40, cursor: 'pointer'}}
                          onPointerDown={handleZoomIn}
                          aria-label="Zoom in"
                        >
                          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                            <path d="M9 3v12M3 9h12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                          </svg>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="text-sm z-[1001]">
                        Zoom in: <Kbd>=</Kbd>
                      </TooltipContent>
                    </Tooltip>
                    <div className="h-px bg-[#333]" />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="flex items-center justify-center bg-[#444] hover:bg-[#555] active:bg-[#333] text-white transition-colors"
                          style={{width: 40, height: 40, cursor: 'pointer'}}
                          onPointerDown={handleZoomOut}
                          aria-label="Zoom out"
                        >
                          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                            <path d="M3 9h12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                          </svg>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="text-sm z-[1001]">
                        Zoom out: <Kbd>-</Kbd>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 pt-3">
              <div className="flex justify-center">
                <div className="four-k-list-container">
                  <div className="flex justify-center k-title">4k is best for:</div>
                  <li>Quick edits</li>
                  <li>Smaller screens</li>
                  <li>Presentations</li>
                  <li>Smaller file size</li>
                  <li>Lower price</li>
                </div>
              </div>
              <div className="flex justify-center">
                <div className="nk-list-container">
                  <div className="flex justify-center k-title">
                    {resolvedHigherResolutionLabel} is best for:
                  </div>
                  <li>Editing flexibility</li>
                  <li>Maintain resolution at zoom</li>
                  <li>Professional Videos</li>
                  <li>Keyframing & Transitions</li>
                  <li>Elite quality</li>
                  <li>Large screens</li>
                  <li>Documentaries</li>
                  <li>Theatres</li>
                </div>
              </div>
            </div>
          </>
        )}
        {windowWidth != undefined && windowWidth > 1250 && (
          <>
            <div className="mx-auto mt-5 flex w-full max-w-7xl items-center justify-center gap-8 lg:px-[35px]">
              <div className="four-k-list-container shrink-0">
                <div className="flex justify-center k-title">4k is best for:</div>
                <li>Quick edits</li>
                <li>Smaller screens</li>
                <li>Presentations</li>
                <li>Smaller file size</li>
                <li>Lower price</li>
              </div>
              <div
                ref={compareRef}
                className="relative mx-auto aspect-[16/9] w-full max-w-[52rem] overflow-hidden rounded-xl border border-border bg-black/20 shadow-sm select-none touch-none"
                style={{cursor: mode === 'pan' ? (isPanning ? 'grabbing' : 'grab') : 'col-resize'}}
                onPointerDown={mode === 'pan' ? handlePanPointerDown : handlePointerDown}
              >
                <div className="absolute inset-0 overflow-hidden">
                  <img
                    src={leftImageUrl}
                    alt="4K comparison preview"
                    className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                    draggable={false}
                    style={{
                      transform: `scale(${zoomLevel})`,
                      transformOrigin: `${originX}% ${originY}%`,
                      transition: 'transform 0.35s cubic-bezier(0.25, 0.1, 0.25, 1)',
                    }}
                  />
                </div>
                <div
                  className="absolute inset-0 overflow-hidden"
                  style={{clipPath: `inset(0 0 0 ${dividerPercentage}%)`}}
                >
                  <img
                    src={rightImageUrl}
                    alt={`${resolvedHigherResolutionLabel} comparison preview`}
                    className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                    draggable={false}
                    style={{
                      transform: `scale(${zoomLevel})`,
                      transformOrigin: `${originX}% ${originY}%`,
                      transition: 'transform 0.35s cubic-bezier(0.25, 0.1, 0.25, 1)',
                    }}
                  />
                </div>

                <div className="absolute inset-x-0 top-4 z-20 flex items-center justify-between px-4 sm:px-5 text-white">
                  <span className="rounded-full bg-black/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em]">
                    4K
                  </span>
                  <span className="rounded-full bg-black/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em]">
                    {resolvedHigherResolutionLabel}
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

                {/* Mode toggle + Zoom +/- control */}
                <div className="absolute bottom-4 right-4 z-30 flex flex-col items-center gap-2">
                  {/* Standalone toggle button */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="flex items-center justify-center rounded-full bg-[#444] hover:bg-[#555] active:bg-[#333] text-white transition-colors"
                        style={{width: 40, height: 40, boxShadow: '0 2px 8px rgba(0,0,0,0.4)', cursor: 'pointer'}}
                        onPointerDown={handleToggleMode}
                        aria-label={mode === 'swipe' ? 'Switch to pan mode' : 'Switch to swipe mode'}
                      >
                        {mode === 'swipe' ? (
                          <img
                            src={HAND_TOGGLE_ICON_URL}
                            alt=""
                            aria-hidden="true"
                            className="pointer-events-none h-6 w-6 -translate-x-0.249 object-contain"
                            draggable={false}
                          />
                        ) : (
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                            <path d="M8 12h8M8 12l2-2M8 12l2 2M16 12l-2-2M16 12l-2 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="text-sm z-[1001]">
                      Toggle Hand: <Kbd>h</Kbd>
                    </TooltipContent>
                  </Tooltip>
                  {/* Zoom +/- pill */}
                  <div
                    className="flex flex-col overflow-hidden rounded-full"
                    style={{boxShadow: '0 2px 8px rgba(0,0,0,0.4)', cursor: 'pointer'}}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="flex items-center justify-center bg-[#444] hover:bg-[#555] active:bg-[#333] text-white transition-colors"
                          style={{width: 40, height: 40, cursor: 'pointer'}}
                          onPointerDown={handleZoomIn}
                          aria-label="Zoom in"
                        >
                          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                            <path d="M9 3v12M3 9h12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                          </svg>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="text-sm z-[1001]">
                        Zoom in: <Kbd>=</Kbd>
                      </TooltipContent>
                    </Tooltip>
                    <div className="h-px bg-[#333]" />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="flex items-center justify-center bg-[#444] hover:bg-[#555] active:bg-[#333] text-white transition-colors"
                          style={{width: 40, height: 40, cursor: 'pointer'}}
                          onPointerDown={handleZoomOut}
                          aria-label="Zoom out"
                        >
                          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                            <path d="M3 9h12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                          </svg>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="text-sm z-[1001]">
                        Zoom out: <Kbd>-</Kbd>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>
              <div className="nk-list-container shrink-0">
                <div className="flex justify-center k-title">
                  {resolvedHigherResolutionLabel} is best for:
                </div>
                <li>Editing flexibility</li>
                <li>Maintain resolution at zoom</li>
                <li>Professional Videos</li>
                <li>Keyframing & Transitions</li>
                <li>Elite quality</li>
                <li>Large screens</li>
                <li>Documentaries</li>
                <li>Theatres</li>
              </div>
            </div>
          </>
        )}
      </section>
    </>
  );
}
