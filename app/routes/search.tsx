import {
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from '@shopify/remix-oxygen';
import {
  useFetcher,
  useLoaderData,
  useNavigate,
  type MetaFunction,
} from '@remix-run/react';
import {getPaginationVariables, Analytics} from '@shopify/hydrogen';
import {SearchResultsPredictive} from '~/components/SearchResultsPredictive';
import {
  type RegularSearchReturn,
  type PredictiveSearchReturn,
  getEmptyPredictiveSearchResult,
} from '~/lib/search';
import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import {CUSTOMER_WISHLIST} from '~/lib/customerQueries';
import SearchPageSkeleton from '~/components/skeletons/SearchPageSkeleton';
import {SkeletonGate} from '~/components/skeletons/shared';
import {
  applyHighestResolutionVariantToProducts,
  parseResolutionValue,
} from '~/lib/resolution';
import {EnhancedPartialSearchResult} from '~/lib/types';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '~/components/ui/input-group';
import {LuSearch, LuZoomIn, LuZoomOut} from 'react-icons/lu';
import {FilterDropdown} from '~/components/ui/popover';
import {ToggleGroup, ToggleGroupItem} from '~/components/ui/toggle-group';
import {Checkbox} from '~/components/ui/checkbox';
import {Tooltip, TooltipContent, TooltipTrigger} from '~/components/ui/tooltip';
import {Kbd} from '~/components/ui/kbd';
import {getHighestResolutionLabelFromTags} from '~/lib/downloads';
import {
  parseDurationSecondsFromTags,
  parseDurationSecondsValue,
} from '~/lib/durationTags';
import {
  COMBINED_SEARCH_HINT_WORDS,
  RandomizedSearchHint,
} from '~/components/RandomizedSearchHint';
import {hasVideoTag} from '~/lib/productTags';

export const meta: MetaFunction = () => {
  return [{title: `Adam Underwater | Search`}];
};

export async function loader({request, context}: LoaderFunctionArgs) {
  const {storefront, cart} = context;

  const url = new URL(request.url);
  const isPredictive = url.searchParams.has('predictive');
  const searchPromise: Promise<PredictiveSearchReturn | RegularSearchReturn> =
    isPredictive
      ? predictiveSearch({request, context})
      : regularSearch({request, context});

  searchPromise.catch((error: Error) => {
    console.error(error);
    return {term: '', result: null, error: error.message};
  });
  const promiseResult = await searchPromise;
  let customer = null;
  try {
    customer = await context.customerAccount.query(CUSTOMER_WISHLIST);
  } catch (error) {
    console.warn('Not logged in');
    customer = null;
  }
  if (!customer) {
    return {
      ...promiseResult,
      cart: cart.get(),
      wishlistProducts: undefined,
      isLoggedIn: undefined,
    };
  }
  const isLoggedIn = context.customerAccount.isLoggedIn();

  let wishlistProducts: string[];
  const customerMetafieldValue =
    customer.data.customer.metafield?.value ?? undefined;
  if (customerMetafieldValue) {
    wishlistProducts = JSON.parse(customerMetafieldValue) as string[];
  } else {
    wishlistProducts = [];
  }

  return {...promiseResult, cart: cart.get(), wishlistProducts, isLoggedIn};
}

type SearchLayoutMode = 'grid' | 'list';
type SearchProductFilter = 'all' | 'prints' | 'stock';
type PrintsFilterState = 'All' | 'Horizontal' | 'Vertical';
type PrintsMostPopularFilterState = 'All' | 'Most Popular Only';
type StockArtistPickFilterState = 'All' | "Artist's Pick Only";
type FrameRateFilter = 'all' | '24fps' | '30fps' | '50fps' | '60fps';
type DurationNotch = {
  value: number;
  label: string;
};

const DURATION_NOTCHES: DurationNotch[] = [
  {value: 0, label: '0'},
  {value: 30, label: '30'},
  {value: 60, label: '60'},
  {value: 120, label: '120'},
  {value: 180, label: '180'},
  {value: 600, label: '600'},
];

const RESOLUTION_NOTCHES = [
  {value: 4, label: '4K+'},
  {value: 5, label: '5K+'},
  {value: 6, label: '6K+'},
  {value: 8, label: '8K+'},
];

const DEFAULT_DURATION_MIN_FILTER_INDEX = 0;
const DEFAULT_DURATION_MAX_FILTER_INDEX = DURATION_NOTCHES.length - 1;
const DEFAULT_DURATION_ALL_FILTER = true;
const DEFAULT_RESOLUTION_FILTER_INDEX = 0;
const DEFAULT_FRAME_RATE_FILTER: FrameRateFilter = 'all';
const PRICE_FILTER_MIN = 0;
const STOCK_PRICE_FILTER_MAX = 400;
const DEFAULT_STOCK_PRICE_FILTER_MAX = STOCK_PRICE_FILTER_MAX;
const LEGACY_STOCK_PRICE_FILTER_MAX = 200;
const PRINTS_PRICE_FILTER_MAX = 400;
const DEFAULT_PRINTS_PRICE_FILTER_MAX = PRINTS_PRICE_FILTER_MAX;
const bundleDurationRegex = /^d(\d+)-(.+)$/i;
const bundleResolutionRegex = /^res(\d+)-(.+)$/i;
const bundleFrameRegex = /^frame(\d+)-(.+)$/i;
const SEARCH_LAYOUT_STORAGE_KEY = 'collection-layout-mode';
const SEARCH_PRODUCT_FILTER_STORAGE_KEY = 'search-product-filter-mode';
const SEARCH_PRINTS_FILTER_STORAGE_KEY = 'search-prints-filter-mode';
const SEARCH_PRINTS_MOST_POPULAR_FILTER_STORAGE_KEY =
  'search-prints-most-popular-filter-mode';
const SEARCH_PRINTS_PRICE_FILTER_STORAGE_KEY = 'search-prints-price-filter-mode';
const SEARCH_STOCK_DURATION_MIN_FILTER_KEY = 'search-stock-duration-min-filter';
const SEARCH_STOCK_DURATION_MAX_FILTER_KEY = 'search-stock-duration-max-filter';
const SEARCH_STOCK_DURATION_ALL_FILTER_KEY = 'search-stock-duration-all-filter';
const SEARCH_STOCK_RESOLUTION_FILTER_KEY = 'search-stock-resolution-filter';
const SEARCH_STOCK_FRAME_RATE_FILTER_KEY = 'search-stock-frame-rate-filter';
const SEARCH_STOCK_ARTIST_PICK_FILTER_KEY = 'search-stock-artist-pick-filter';
const SEARCH_STOCK_PRICE_FILTER_KEY = 'search-stock-price-filter';

const FILTER_ICON_BUTTON_CLASS_NAME =
  'relative inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md border border-input bg-background text-sm font-medium shadow-sm outline-none transition-all hover:bg-accent hover:text-accent-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-default disabled:opacity-50';

const isPrintProduct = (product: EnhancedPartialSearchResult) =>
  product.tags.includes('Prints') ||
  product.tags.includes('horOnly') ||
  product.tags.includes('horPrimary') ||
  product.tags.includes('vertOnly') ||
  product.tags.includes('vertPrimary');

const isStockProduct = (product: EnhancedPartialSearchResult) =>
  hasVideoTag(product.tags);

function parseDurationSeconds(product: {tags: string[]}): number | null {
  return parseDurationSecondsFromTags(product.tags);
}

function getBundleClipDurations(tags: string[]): number[] {
  return tags.flatMap((tag) => {
    const match = tag.match(bundleDurationRegex);
    if (!match?.[2]) return [];
    const seconds = parseDurationSecondsValue(match[2]);
    return seconds === null ? [] : [seconds];
  });
}

function getBundleClipResolutions(tags: string[]): number[] {
  return tags.flatMap((tag) => {
    const match = tag.match(bundleResolutionRegex);
    if (!match?.[2]) return [];
    const resolution = parseResolutionValue(match[2]);
    return resolution === null ? [] : [resolution];
  });
}

function normalizeBundleFrameFilterValue(
  value: string,
): FrameRateFilter | string {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '');
  const shorthandMatch = normalized.match(/^f(24|30|50|60)$/);
  if (shorthandMatch?.[1]) {
    return `${shorthandMatch[1]}fps`;
  }

  const legacyMatch = normalized.match(/^(\d+)(fps)?$/i);
  if (legacyMatch?.[1]) {
    const parsedFps = Number.parseInt(legacyMatch[1], 10);
    if (
      parsedFps === 24 ||
      parsedFps === 30 ||
      parsedFps === 50 ||
      parsedFps === 60
    ) {
      return `${parsedFps}fps`;
    }
  }

  return normalized;
}

function isFrameRateFilterValue(
  value: string,
): value is Exclude<FrameRateFilter, 'all'> {
  return (
    value === '24fps' ||
    value === '30fps' ||
    value === '50fps' ||
    value === '60fps'
  );
}

function getTopLevelFrameTagValue(
  tags: string[],
): Exclude<FrameRateFilter, 'all'> | null {
  for (const rawTag of tags) {
    const normalizedTag = normalizeBundleFrameFilterValue(rawTag);
    if (typeof normalizedTag !== 'string') continue;
    if (isFrameRateFilterValue(normalizedTag)) return normalizedTag;
  }

  return null;
}

function getBundleClipFrameRates(
  tags: string[],
): Array<Exclude<FrameRateFilter, 'all'>> {
  return tags.flatMap((tag) => {
    const match = tag.match(bundleFrameRegex);
    if (!match?.[2]) return [];
    const normalizedFrameRate = normalizeBundleFrameFilterValue(match[2]);
    if (
      typeof normalizedFrameRate === 'string' &&
      isFrameRateFilterValue(normalizedFrameRate)
    ) {
      return [normalizedFrameRate];
    }
    return [];
  });
}

function matchesDurationRange(
  seconds: number,
  minDurationSeconds: number,
  maxDurationSeconds: number,
): boolean {
  return seconds >= minDurationSeconds && seconds <= maxDurationSeconds;
}

function getHighestResolutionNumber(product: {
  tags: string[];
  options?: {name?: string; optionValues?: {name?: string}[]}[];
}): number {
  const resolutionOption = product.options?.find(
    (option) =>
      typeof option.name === 'string' &&
      option.name.trim().toLowerCase() === 'resolution',
  );
  if (resolutionOption?.optionValues) {
    let highest = 0;
    for (const optionValue of resolutionOption.optionValues) {
      const value = parseResolutionValue(optionValue.name);
      if (value !== null && value > highest) highest = value;
    }
    if (highest > 0) return highest;
  }

  const label = getHighestResolutionLabelFromTags(product.tags);
  if (label) {
    const value = parseResolutionValue(label);
    if (value !== null) return value;
  }

  return 4;
}

function bundleMatchesResolution(
  product: {
    tags: string[];
    options?: {name?: string; optionValues?: {name?: string}[]}[];
  },
  minResolution: number,
): boolean {
  const resolutions = getBundleClipResolutions(product.tags);
  if (resolutions.length === 0) {
    return getHighestResolutionNumber(product) >= minResolution;
  }
  return resolutions.some((resolution) => resolution >= minResolution);
}

function bundleMatchesFrameRate(
  tags: string[],
  frameRateFilter: FrameRateFilter,
): boolean {
  const frames = getBundleClipFrameRates(tags);
  if (frames.length === 0) {
    return getTopLevelFrameTagValue(tags) === frameRateFilter;
  }

  return frames.some((frame) => frame === frameRateFilter);
}

function getProductPriceAmount(product: {
  selectedOrFirstAvailableVariant?: {price?: {amount?: string | null} | null} | null;
  priceRange?: {minVariantPrice?: {amount?: string | null} | null} | null;
}): number | null {
  const rawAmount =
    product.selectedOrFirstAvailableVariant?.price?.amount ??
    product.priceRange?.minVariantPrice?.amount;
  if (typeof rawAmount !== 'string') return null;
  const parsedAmount = Number.parseFloat(rawAmount);
  return Number.isFinite(parsedAmount) ? parsedAmount : null;
}

function chainMouseHandler<EventType>(
  originalHandler: ((event: EventType) => void) | undefined,
  nextHandler: (event: EventType) => void,
) {
  return (event: EventType) => {
    originalHandler?.(event);
    nextHandler(event);
  };
}

function HoverOnlyTooltip({
  content,
  children,
  side = 'top',
}: {
  content: React.ReactNode;
  children: React.ReactElement<{
    onMouseEnter?: (event: React.MouseEvent) => void;
    onMouseLeave?: (event: React.MouseEvent) => void;
    onPointerDown?: (event: React.PointerEvent) => void;
    onClick?: (event: React.MouseEvent) => void;
    onBlur?: (event: React.FocusEvent) => void;
  }>;
  side?: 'top' | 'right' | 'bottom' | 'left';
}) {
  const [open, setOpen] = useState(false);

  return (
    <Tooltip open={open}>
      <TooltipTrigger asChild>
        {React.cloneElement(children, {
          onMouseEnter: chainMouseHandler(children.props.onMouseEnter, () =>
            setOpen(true),
          ),
          onMouseLeave: chainMouseHandler(children.props.onMouseLeave, () =>
            setOpen(false),
          ),
          onPointerDown: chainMouseHandler(children.props.onPointerDown, () =>
            setOpen(false),
          ),
          onClick: chainMouseHandler(children.props.onClick, () =>
            setOpen(false),
          ),
          onBlur: chainMouseHandler(children.props.onBlur, () => setOpen(false)),
        })}
      </TooltipTrigger>
      <TooltipContent side={side} className="z-[1001]">
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

const SearchFilterIconButton = React.forwardRef<
  HTMLButtonElement,
  {
    isFiltered: boolean;
  } & React.ButtonHTMLAttributes<HTMLButtonElement>
>(function SearchFilterIconButton({isFiltered, ...props}, ref) {
  return (
    <button
      ref={ref}
      type="button"
      className={FILTER_ICON_BUTTON_CLASS_NAME}
      aria-label="Filter search products"
      {...props}
    >
      <img
        src="https://downloads.adamunderwater.com/store-1-au/public/filter.png"
        alt=""
        className="h-5 w-5"
      />
      {isFiltered && (
        <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary" />
      )}
    </button>
  );
});

function NotchedSlider({
  label,
  notches,
  value,
  onChange,
}: {
  label: string;
  notches: {value: number; label: string}[];
  value: number;
  onChange: (index: number) => void;
}) {
  const max = notches.length - 1;
  const sliderTrackRef = useRef<HTMLDivElement | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [draftValue, setDraftValue] = useState<number | null>(null);
  const activeSliderValue = draftValue ?? value;
  const activeIndex =
    draftValue === null ? value : Math.round(activeSliderValue);
  const previewIndex =
    draftValue === null && hoveredIndex !== null && hoveredIndex > value
      ? hoveredIndex
      : null;

  const getContinuousValueFromClientX = (clientX: number) => {
    const trackElement = sliderTrackRef.current;
    if (!trackElement || max <= 0) return 0;

    const {left, width} = trackElement.getBoundingClientRect();
    if (width <= 0) return 0;

    const progress = Math.min(1, Math.max(0, (clientX - left) / width));
    return progress * max;
  };

  const getNearestNotchIndex = (clientX: number) => {
    return Math.round(getContinuousValueFromClientX(clientX));
  };

  const getNotchPosition = (index: number) => {
    if (max <= 0) return '0%';
    return `${(index / max) * 100}%`;
  };

  const handleRailHover = (event: React.MouseEvent<HTMLDivElement>) => {
    setHoveredIndex(getNearestNotchIndex(event.clientX));
  };

  const handleTrackPointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (event.button !== 0) return;

    const nextValue = getContinuousValueFromClientX(event.clientX);
    const nextIndex = Math.round(nextValue);

    setDraftValue(nextValue);
    setHoveredIndex(nextIndex);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const movedValue = getContinuousValueFromClientX(moveEvent.clientX);
      setDraftValue(movedValue);
      setHoveredIndex(Math.round(movedValue));
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      const finalValue = getContinuousValueFromClientX(upEvent.clientX);
      const snappedIndex = Math.round(finalValue);
      setDraftValue(null);
      setHoveredIndex(null);
      onChange(snappedIndex);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  return (
    <div className="notched-slider-section">
      <p className="mb-2 text-sm font-medium text-foreground">{label}</p>
      <div className="notched-slider-container">
        <div className="notched-slider-labels">
          {notches.map((notch, index) => (
            <button
              key={`${label}-${notch.label}-${String(notch.value)}`}
              type="button"
              className={`notched-slider-label ${index === value ? 'active' : ''}`}
              style={{left: getNotchPosition(index)}}
              onClick={() => onChange(index)}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              onFocus={() => setHoveredIndex(index)}
              onBlur={() => setHoveredIndex(null)}
            >
              {notch.label}
            </button>
          ))}
        </div>

        <div className="notched-slider-rail">
          <div className="notched-slider-markers">
            {notches.map((notch, index) => (
              <button
                key={`${label}-marker-${notch.label}-${String(notch.value)}`}
                type="button"
                className="notched-slider-marker-slot"
                style={{left: getNotchPosition(index)}}
                onClick={() => onChange(index)}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                onFocus={() => setHoveredIndex(index)}
                onBlur={() => setHoveredIndex(null)}
                aria-label={`Set ${label} to ${notch.label}`}
              >
                <span
                  className={`notched-slider-tick ${index <= activeIndex ? 'active' : ''} ${
                    previewIndex === index ? 'preview' : ''
                  }`.trim()}
                />
              </button>
            ))}
          </div>
          <div
            ref={sliderTrackRef}
            className="notched-slider-track"
            role="slider"
            tabIndex={0}
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={max}
            aria-valuenow={value}
            onPointerDown={handleTrackPointerDown}
            onMouseMove={handleRailHover}
            onMouseLeave={() => {
              if (draftValue === null) setHoveredIndex(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
                event.preventDefault();
                onChange(Math.max(0, value - 1));
              }
              if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
                event.preventDefault();
                onChange(Math.min(max, value + 1));
              }
            }}
          >
            <div
              className="notched-slider-track-fill"
              style={{width: getNotchPosition(activeSliderValue)}}
            />
            <div
              className="notched-slider-thumb"
              style={{left: getNotchPosition(activeSliderValue)}}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function DurationRangeSlider({
  notches,
  minIndex,
  maxIndex,
  onRangeChange,
  onInteract,
}: {
  notches: DurationNotch[];
  minIndex: number;
  maxIndex: number;
  onRangeChange: (nextMinIndex: number, nextMaxIndex: number) => void;
  onInteract?: () => void;
}) {
  const max = notches.length - 1;
  const sliderTrackRef = useRef<HTMLDivElement | null>(null);
  const [draftRange, setDraftRange] = useState<{min: number; max: number} | null>(
    null,
  );
  const activeMinIndex = draftRange?.min ?? minIndex;
  const activeMaxIndex = draftRange?.max ?? maxIndex;

  const clampIndex = useCallback(
    (rawIndex: number) => Math.min(max, Math.max(0, rawIndex)),
    [max],
  );

  const enforceRangeGap = useCallback(
    (candidateMin: number, candidateMax: number) => {
      let safeMin = clampIndex(candidateMin);
      let safeMax = clampIndex(candidateMax);
      if (safeMin >= safeMax) {
        if (safeMin >= max) {
          safeMin = max - 1;
          safeMax = max;
        } else {
          safeMax = safeMin + 1;
        }
      }
      return {min: safeMin, max: safeMax};
    },
    [clampIndex, max],
  );

  const getContinuousValueFromClientX = useCallback(
    (clientX: number) => {
      const trackElement = sliderTrackRef.current;
      if (!trackElement || max <= 0) return 0;

      const {left, width} = trackElement.getBoundingClientRect();
      if (width <= 0) return 0;

      const progress = Math.min(1, Math.max(0, (clientX - left) / width));
      return progress * max;
    },
    [max],
  );

  const getNearestNotchIndex = useCallback(
    (clientX: number) =>
      clampIndex(Math.round(getContinuousValueFromClientX(clientX))),
    [clampIndex, getContinuousValueFromClientX],
  );

  const getNotchPosition = useCallback(
    (index: number) => {
      if (max <= 0) return '0%';
      return `${(index / max) * 100}%`;
    },
    [max],
  );

  const resolveHandle = useCallback(
    (targetIndex: number, currentMin: number, currentMax: number) => {
      if (targetIndex <= currentMin) return 'min' as const;
      if (targetIndex >= currentMax) return 'max' as const;
      const minDistance = Math.abs(targetIndex - currentMin);
      const maxDistance = Math.abs(targetIndex - currentMax);
      return minDistance <= maxDistance ? ('min' as const) : ('max' as const);
    },
    [],
  );

  const applyHandleMove = useCallback(
    (
      handle: 'min' | 'max',
      targetIndex: number,
      currentMin: number,
      currentMax: number,
    ) => {
      if (handle === 'min') {
        return enforceRangeGap(targetIndex, currentMax);
      }
      return enforceRangeGap(currentMin, targetIndex);
    },
    [enforceRangeGap],
  );

  const commitRange = useCallback(
    (nextMin: number, nextMax: number) => {
      const safeRange = enforceRangeGap(nextMin, nextMax);
      onInteract?.();
      onRangeChange(safeRange.min, safeRange.max);
    },
    [enforceRangeGap, onInteract, onRangeChange],
  );

  const handleTrackPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;

    onInteract?.();
    const pointerIndex = getNearestNotchIndex(event.clientX);
    const initialHandle = resolveHandle(pointerIndex, minIndex, maxIndex);
    const initialDraft = applyHandleMove(
      initialHandle,
      pointerIndex,
      minIndex,
      maxIndex,
    );
    setDraftRange(initialDraft);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const movedIndex = getNearestNotchIndex(moveEvent.clientX);
      setDraftRange((currentDraft) => {
        const baseRange = currentDraft ?? initialDraft;
        return applyHandleMove(
          initialHandle,
          movedIndex,
          baseRange.min,
          baseRange.max,
        );
      });
    };

    const handlePointerUp = () => {
      setDraftRange((currentDraft) => {
        const finalRange = currentDraft ?? initialDraft;
        commitRange(finalRange.min, finalRange.max);
        return null;
      });
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  return (
    <div className="notched-slider-container">
      <div className="notched-slider-labels">
        {notches.map((notch, index) => (
          <button
            key={`duration-range-${notch.label}-${String(notch.value)}`}
            type="button"
            className={`notched-slider-label ${
              index >= activeMinIndex && index <= activeMaxIndex ? 'active' : ''
            }`}
            style={{left: getNotchPosition(index)}}
            onClick={() => {
              onInteract?.();
              const handle = resolveHandle(index, minIndex, maxIndex);
              const nextRange = applyHandleMove(
                handle,
                index,
                minIndex,
                maxIndex,
              );
              commitRange(nextRange.min, nextRange.max);
            }}
          >
            {notch.label}
          </button>
        ))}
      </div>
      <div className="notched-slider-rail">
        <div className="notched-slider-markers">
          {notches.map((notch, index) => (
            <button
              key={`duration-range-marker-${notch.label}-${String(notch.value)}`}
              type="button"
              className="notched-slider-marker-slot"
              style={{left: getNotchPosition(index)}}
              onClick={() => {
                onInteract?.();
                const handle = resolveHandle(index, minIndex, maxIndex);
                const nextRange = applyHandleMove(
                  handle,
                  index,
                  minIndex,
                  maxIndex,
                );
                commitRange(nextRange.min, nextRange.max);
              }}
              aria-label={`Set duration to ${notch.label} seconds`}
            >
              <span
                className={`notched-slider-tick ${
                  index >= activeMinIndex && index <= activeMaxIndex
                    ? 'active'
                    : ''
                }`}
              />
            </button>
          ))}
        </div>
        <div
          ref={sliderTrackRef}
          className="notched-slider-track"
          role="slider"
          tabIndex={0}
          aria-label="Duration range"
          aria-valuemin={notches[activeMinIndex]?.value ?? 0}
          aria-valuemax={notches[activeMaxIndex]?.value ?? 0}
          aria-valuenow={notches[activeMaxIndex]?.value ?? 0}
          aria-valuetext={`${notches[activeMinIndex]?.value ?? 0} to ${
            notches[activeMaxIndex]?.value ?? 0
          } seconds`}
          onPointerDown={handleTrackPointerDown}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
              event.preventDefault();
              commitRange(minIndex - 1, maxIndex);
            }
            if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
              event.preventDefault();
              commitRange(minIndex, maxIndex + 1);
            }
          }}
        >
          <div
            className="notched-slider-track-fill"
            style={{
              left: getNotchPosition(activeMinIndex),
              width: `calc(${getNotchPosition(activeMaxIndex)} - ${getNotchPosition(
                activeMinIndex,
              )})`,
            }}
          />
          <div
            className="notched-slider-thumb"
            style={{left: getNotchPosition(activeMinIndex)}}
          />
          <div
            className="notched-slider-thumb"
            style={{left: getNotchPosition(activeMaxIndex)}}
          />
        </div>
      </div>
    </div>
  );
}

function PriceSlider({
  value,
  onChange,
  minValue = PRICE_FILTER_MIN,
  maxValue = STOCK_PRICE_FILTER_MAX,
}: {
  value: number;
  onChange: (value: number) => void;
  minValue?: number;
  maxValue?: number;
}) {
  const sliderTrackRef = useRef<HTMLDivElement | null>(null);
  const [draftValue, setDraftValue] = useState<number | null>(null);
  const activeValue = draftValue ?? value;

  const clampValue = useCallback((rawValue: number) => {
    return Math.min(maxValue, Math.max(minValue, rawValue));
  }, [maxValue, minValue]);

  const valueToPositionPercent = useCallback(
    (rawValue: number) =>
      ((clampValue(rawValue) - minValue) / (maxValue - minValue)) *
      100,
    [clampValue, maxValue, minValue],
  );

  const getValueFromClientX = useCallback(
    (clientX: number) => {
      const trackElement = sliderTrackRef.current;
      if (!trackElement) return value;

      const {left, width} = trackElement.getBoundingClientRect();
      if (width <= 0) return value;

      const progress = Math.min(1, Math.max(0, (clientX - left) / width));
      return clampValue(
        Math.round(minValue + progress * (maxValue - minValue)),
      );
    },
    [clampValue, maxValue, minValue, value],
  );

  const handleTrackPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;

    const nextValue = getValueFromClientX(event.clientX);
    setDraftValue(nextValue);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      setDraftValue(getValueFromClientX(moveEvent.clientX));
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      const finalValue = getValueFromClientX(upEvent.clientX);
      setDraftValue(null);
      onChange(finalValue);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  return (
    <div className="border-t border-border pt-2 pb-2">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">Price</p>
        <p className="text-sm text-muted-foreground">
          {`$${minValue}-$${Math.round(activeValue)}`}
        </p>
      </div>
      <div className="notched-slider-rail">
        <div
          ref={sliderTrackRef}
          className="notched-slider-track notched-slider-track--price"
          role="slider"
          tabIndex={0}
          aria-label="Price"
          aria-valuemin={minValue}
          aria-valuemax={maxValue}
          aria-valuenow={Math.round(value)}
          onPointerDown={handleTrackPointerDown}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
              event.preventDefault();
              onChange(clampValue(value - 1));
            }
            if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
              event.preventDefault();
              onChange(clampValue(value + 1));
            }
          }}
        >
          <div
            className="notched-slider-track-fill"
            style={{width: `${valueToPositionPercent(activeValue)}%`}}
          />
          <div
            className="notched-slider-thumb"
            style={{left: `${valueToPositionPercent(activeValue)}%`}}
          />
        </div>
      </div>
    </div>
  );
}

function SearchFiltersPopover({
  productFilter,
  setProductFilter,
  printsFilterState,
  setPrintsFilterState,
  printsMostPopularFilterState,
  setPrintsMostPopularFilterState,
  printsPriceFilterMax,
  setPrintsPriceFilterMax,
  durationMinFilterIndex,
  setDurationMinFilterIndex,
  durationMaxFilterIndex,
  setDurationMaxFilterIndex,
  durationAllSelected,
  setDurationAllSelected,
  resolutionFilterIndex,
  setResolutionFilterIndex,
  frameRateFilter,
  setFrameRateFilter,
  stockArtistPickFilterState,
  setStockArtistPickFilterState,
  stockPriceFilterMax,
  setStockPriceFilterMax,
  open,
  onOpenChange,
}: {
  productFilter: SearchProductFilter;
  setProductFilter: (value: SearchProductFilter) => void;
  printsFilterState: PrintsFilterState;
  setPrintsFilterState: (value: PrintsFilterState) => void;
  printsMostPopularFilterState: PrintsMostPopularFilterState;
  setPrintsMostPopularFilterState: (value: PrintsMostPopularFilterState) => void;
  printsPriceFilterMax: number;
  setPrintsPriceFilterMax: (value: number) => void;
  durationMinFilterIndex: number;
  setDurationMinFilterIndex: (value: number) => void;
  durationMaxFilterIndex: number;
  setDurationMaxFilterIndex: (value: number) => void;
  durationAllSelected: boolean;
  setDurationAllSelected: (value: boolean) => void;
  resolutionFilterIndex: number;
  setResolutionFilterIndex: (value: number) => void;
  frameRateFilter: FrameRateFilter;
  setFrameRateFilter: (value: FrameRateFilter) => void;
  stockArtistPickFilterState: StockArtistPickFilterState;
  setStockArtistPickFilterState: (value: StockArtistPickFilterState) => void;
  stockPriceFilterMax: number;
  setStockPriceFilterMax: (value: number) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isFiltered =
    productFilter !== 'all' ||
    printsFilterState !== 'All' ||
    printsMostPopularFilterState !== 'All' ||
    printsPriceFilterMax !== DEFAULT_PRINTS_PRICE_FILTER_MAX ||
    !durationAllSelected ||
    durationMinFilterIndex !== DEFAULT_DURATION_MIN_FILTER_INDEX ||
    durationMaxFilterIndex !== DEFAULT_DURATION_MAX_FILTER_INDEX ||
    resolutionFilterIndex !== DEFAULT_RESOLUTION_FILTER_INDEX ||
    frameRateFilter !== DEFAULT_FRAME_RATE_FILTER ||
    stockArtistPickFilterState !== 'All' ||
    stockPriceFilterMax !== DEFAULT_STOCK_PRICE_FILTER_MAX;

  const handleReset = () => {
    setProductFilter('all');
    setPrintsFilterState('All');
    setPrintsMostPopularFilterState('All');
    setPrintsPriceFilterMax(DEFAULT_PRINTS_PRICE_FILTER_MAX);
    setDurationMinFilterIndex(DEFAULT_DURATION_MIN_FILTER_INDEX);
    setDurationMaxFilterIndex(DEFAULT_DURATION_MAX_FILTER_INDEX);
    setDurationAllSelected(DEFAULT_DURATION_ALL_FILTER);
    setResolutionFilterIndex(DEFAULT_RESOLUTION_FILTER_INDEX);
    setFrameRateFilter(DEFAULT_FRAME_RATE_FILTER);
    setStockArtistPickFilterState('All');
    setStockPriceFilterMax(DEFAULT_STOCK_PRICE_FILTER_MAX);
  };

  return (
    <div className="relative inline-flex">
        <div className="inline-flex">
          <HoverOnlyTooltip
            content={
              <>
                Keyboard shortcut: <Kbd>f</Kbd>
              </>
            }
          >
            <SearchFilterIconButton
              isFiltered={isFiltered}
              onClick={() => onOpenChange(!open)}
              aria-expanded={open}
              aria-haspopup="dialog"
            />
          </HoverOnlyTooltip>
        </div>
        <FilterDropdown
          open={open}
          onOpenChange={onOpenChange}
          sideOffset={8}
          className="w-90 px-2 py-2"
        >
        <div className="space-y-4">
          <div className="border-b border-border pb-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-foreground">Product</p>
              <button
                type="button"
                className={FILTER_ICON_BUTTON_CLASS_NAME}
                aria-label="Reset search filters"
                onClick={handleReset}
              >
                <img
                  src="https://downloads.adamunderwater.com/store-1-au/public/reset.png"
                  alt=""
                  className="h-5 w-5"
                />
              </button>
            </div>
            <ToggleGroup
              type="single"
              variant="outline"
              value={productFilter}
              onValueChange={(value) => {
                if (value) setProductFilter(value as SearchProductFilter);
              }}
              className="w-full cursor-pointer"
            >
              <ToggleGroupItem
                value="all"
                className="flex-1 cursor-pointer data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                All
              </ToggleGroupItem>
              <ToggleGroupItem
                value="prints"
                className="flex-1 cursor-pointer data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                Prints
              </ToggleGroupItem>
              <ToggleGroupItem
                value="stock"
                className="flex-1 cursor-pointer data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                Stock Footage
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {productFilter === 'prints' && (
            <div className="space-y-4">
              <div>
                <p className="mb-3 text-sm font-medium text-foreground">
                  Orientation
                </p>
                <InputGroup className="overflow-hidden">
                  {(['All', 'Horizontal', 'Vertical'] as const).map(
                    (value, index) => (
                      <button
                        key={value}
                        type="button"
                        className={`h-9 flex-1 cursor-pointer px-3 text-sm transition-colors ${
                          index > 0 ? 'border-l border-input' : ''
                        } ${
                          printsFilterState === value
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground'
                        }`}
                        onClick={() => setPrintsFilterState(value)}
                      >
                        {value}
                      </button>
                    ),
                  )}
                </InputGroup>
              </div>
              <p className="text-sm text-muted-foreground">
                Many horizontal prints <strong>are also available</strong> in
                vertical on the product page
              </p>
              <div className="border-t border-border pt-2">
                <p className="mb-3 text-sm font-medium text-foreground">
                  Most Popular
                </p>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  value={printsMostPopularFilterState}
                  onValueChange={(value) => {
                    if (value) {
                      setPrintsMostPopularFilterState(
                        value as PrintsMostPopularFilterState,
                      );
                    }
                  }}
                  className="w-full cursor-pointer"
                >
                  <ToggleGroupItem
                    value="All"
                    className="flex-1 cursor-pointer data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                  >
                    All
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="Most Popular Only"
                    className="flex-1 cursor-pointer data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                  >
                    Most Popular Only
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
              <PriceSlider
                value={printsPriceFilterMax}
                onChange={setPrintsPriceFilterMax}
                minValue={PRICE_FILTER_MIN}
                maxValue={PRINTS_PRICE_FILTER_MAX}
              />
            </div>
          )}

          {productFilter === 'stock' && (
            <div className="space-y-4">
              <div className="notched-slider-section">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">
                    Duration (seconds)
                  </p>
                </div>
                <div className="flex items-end gap-3">
                  <div className="min-w-0 flex-1">
                    <DurationRangeSlider
                      notches={DURATION_NOTCHES}
                      minIndex={durationMinFilterIndex}
                      maxIndex={durationMaxFilterIndex}
                      onRangeChange={(nextMinIndex, nextMaxIndex) => {
                        setDurationMinFilterIndex(nextMinIndex);
                        setDurationMaxFilterIndex(nextMaxIndex);
                        setDurationAllSelected(
                          nextMinIndex === DEFAULT_DURATION_MIN_FILTER_INDEX &&
                            nextMaxIndex ===
                              DEFAULT_DURATION_MAX_FILTER_INDEX,
                        );
                      }}
                      onInteract={() => {
                        if (durationAllSelected) setDurationAllSelected(false);
                      }}
                    />
                  </div>
                  <div className="inline-flex shrink-0 flex-col items-center gap-1 pb-1 text-xs text-muted-foreground">
                    <span>All</span>
                    <Checkbox
                      checked={durationAllSelected}
                      onCheckedChange={(checked) => {
                        const isChecked = checked === true;
                        setDurationAllSelected(isChecked);
                        if (isChecked) {
                          setDurationMinFilterIndex(
                            DEFAULT_DURATION_MIN_FILTER_INDEX,
                          );
                          setDurationMaxFilterIndex(
                            DEFAULT_DURATION_MAX_FILTER_INDEX,
                          );
                        }
                      }}
                      className="border-primary data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      aria-label="Show all durations"
                    />
                  </div>
                </div>
              </div>
              <NotchedSlider
                label="Resolution"
                notches={RESOLUTION_NOTCHES}
                value={resolutionFilterIndex}
                onChange={setResolutionFilterIndex}
              />
              <div className="border-t border-border pt-2">
                <p className="mb-3 text-sm font-medium text-foreground">
                  Frame Rate
                </p>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  value={frameRateFilter}
                  onValueChange={(value) => {
                    if (value) setFrameRateFilter(value as FrameRateFilter);
                  }}
                  className="w-full cursor-pointer"
                >
                  <ToggleGroupItem
                    value="all"
                    className="flex-1 cursor-pointer data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                  >
                    All
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="24fps"
                    className="flex-1 cursor-pointer data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                  >
                    24fps
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="30fps"
                    className="flex-1 cursor-pointer data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                  >
                    30fps
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="50fps"
                    className="flex-1 cursor-pointer data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                  >
                    50fps
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="60fps"
                    className="flex-1 cursor-pointer data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                  >
                    60fps
                  </ToggleGroupItem>
                  </ToggleGroup>
              </div>
              <div className="border-t border-border pt-2">
                <p className="mb-3 text-sm font-medium text-foreground">
                  Artist&apos;s Pick
                </p>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  value={stockArtistPickFilterState}
                  onValueChange={(value) => {
                    if (value) {
                      setStockArtistPickFilterState(
                        value as StockArtistPickFilterState,
                      );
                    }
                  }}
                  className="w-full cursor-pointer"
                >
                  <ToggleGroupItem
                    value="All"
                    className="flex-1 cursor-pointer data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                  >
                    All
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="Artist's Pick Only"
                    className="flex-1 cursor-pointer data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                  >
                    Artist&apos;s Pick Only
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
              <PriceSlider
                value={stockPriceFilterMax}
                onChange={setStockPriceFilterMax}
                minValue={PRICE_FILTER_MIN}
                maxValue={STOCK_PRICE_FILTER_MAX}
              />
            </div>
          )}
        </div>
        </FilterDropdown>
    </div>
  );
}

/**
 * Renders the /search route
 */
export default function SearchPage() {
  const data = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const {type, term, result, error, cart, isLoggedIn, wishlistProducts} = data;
  const queriesDatalistId = useId();
  const predictiveFetcher = useFetcher<PredictiveSearchReturn>({
    key: 'search-page',
  });
  const [isPageReady, setIsPageReady] = useState(false);
  const hasCalledLoad = useRef(false);
  const searchImgRef = useRef<HTMLImageElement>(null);
  const [searchText, setSearchText] = useState(term);
  const [isPredictiveMode, setIsPredictiveMode] = useState(false);
  const [committedPredictiveResult, setCommittedPredictiveResult] = useState(
    getEmptyPredictiveSearchResult(),
  );
  const [layout, setLayout] = useState<SearchLayoutMode>('grid');
  const [productFilter, setProductFilter] =
    useState<SearchProductFilter>('all');
  const [printsFilterState, setPrintsFilterState] =
    useState<PrintsFilterState>('All');
  const [printsMostPopularFilterState, setPrintsMostPopularFilterState] =
    useState<PrintsMostPopularFilterState>('All');
  const [printsPriceFilterMax, setPrintsPriceFilterMax] = useState<number>(
    DEFAULT_PRINTS_PRICE_FILTER_MAX,
  );
  const [durationMinFilterIndex, setDurationMinFilterIndex] = useState(
    DEFAULT_DURATION_MIN_FILTER_INDEX,
  );
  const [durationMaxFilterIndex, setDurationMaxFilterIndex] = useState(
    DEFAULT_DURATION_MAX_FILTER_INDEX,
  );
  const [durationAllSelected, setDurationAllSelected] = useState(
    DEFAULT_DURATION_ALL_FILTER,
  );
  const [resolutionFilterIndex, setResolutionFilterIndex] = useState(
    DEFAULT_RESOLUTION_FILTER_INDEX,
  );
  const [frameRateFilter, setFrameRateFilter] = useState<FrameRateFilter>(
    DEFAULT_FRAME_RATE_FILTER,
  );
  const [stockArtistPickFilterState, setStockArtistPickFilterState] =
    useState<StockArtistPickFilterState>('All');

  useEffect(() => {
    const shouldSelectAllDurations =
      durationMinFilterIndex === DEFAULT_DURATION_MIN_FILTER_INDEX &&
      durationMaxFilterIndex === DEFAULT_DURATION_MAX_FILTER_INDEX;

    if (durationAllSelected !== shouldSelectAllDurations) {
      setDurationAllSelected(shouldSelectAllDurations);
    }
  }, [
    durationAllSelected,
    durationMinFilterIndex,
    durationMaxFilterIndex,
  ]);
  const [stockPriceFilterMax, setStockPriceFilterMax] =
    useState<number>(DEFAULT_STOCK_PRICE_FILTER_MAX);
  const [hasHydratedControls, setHasHydratedControls] = useState(false);
  const [isSearchFiltersPopoverOpen, setIsSearchFiltersPopoverOpen] =
    useState(false);
  const [windowWidth, setWindowWidth] = useState<number | undefined>(undefined);

  const handleSearchImgLoad = useCallback(() => {
    if (hasCalledLoad.current) return;
    hasCalledLoad.current = true;
    setIsPageReady(true);
  }, []);

  useEffect(() => {
    const img = searchImgRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      handleSearchImgLoad();
    }
  }, [handleSearchImgLoad]);
  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleFilterShortcut = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT'
      ) {
        return;
      }

      if (event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setIsSearchFiltersPopoverOpen((isOpen) => !isOpen);
      }
    };

    window.addEventListener('keydown', handleFilterShortcut);
    return () => window.removeEventListener('keydown', handleFilterShortcut);
  }, []);

  useEffect(() => {
    // When URL q changes (including from aside submit), sync the page input.
    setSearchText(term);
    setIsPredictiveMode(false);
    setCommittedPredictiveResult(getEmptyPredictiveSearchResult());
  }, [term]);

  useEffect(() => {
    try {
      const savedLayout = window.localStorage.getItem(
        SEARCH_LAYOUT_STORAGE_KEY,
      );
      if (savedLayout === 'grid' || savedLayout === 'list') {
        setLayout(savedLayout);
      }

      const savedProductFilter = window.localStorage.getItem(
        SEARCH_PRODUCT_FILTER_STORAGE_KEY,
      );
      if (
        savedProductFilter === 'all' ||
        savedProductFilter === 'prints' ||
        savedProductFilter === 'stock'
      ) {
        setProductFilter(savedProductFilter);
      }

      const savedPrintsFilter = window.localStorage.getItem(
        SEARCH_PRINTS_FILTER_STORAGE_KEY,
      );
      if (
        savedPrintsFilter === 'All' ||
        savedPrintsFilter === 'Horizontal' ||
        savedPrintsFilter === 'Vertical'
      ) {
        setPrintsFilterState(savedPrintsFilter);
      }

      const savedPrintsMostPopularFilter = window.localStorage.getItem(
        SEARCH_PRINTS_MOST_POPULAR_FILTER_STORAGE_KEY,
      );
      if (
        savedPrintsMostPopularFilter === 'All' ||
        savedPrintsMostPopularFilter === 'Most Popular Only'
      ) {
        setPrintsMostPopularFilterState(savedPrintsMostPopularFilter);
      }

      const savedPrintsPriceFilter = window.localStorage.getItem(
        SEARCH_PRINTS_PRICE_FILTER_STORAGE_KEY,
      );
      if (savedPrintsPriceFilter !== null) {
        const parsedPrintsPriceFilter = Number.parseInt(savedPrintsPriceFilter, 10);
        if (Number.isFinite(parsedPrintsPriceFilter)) {
          setPrintsPriceFilterMax(
            Math.min(
              PRINTS_PRICE_FILTER_MAX,
              Math.max(PRICE_FILTER_MIN, parsedPrintsPriceFilter),
            ),
          );
        }
      }

      const savedDurationAll = window.localStorage.getItem(
        SEARCH_STOCK_DURATION_ALL_FILTER_KEY,
      );
      if (savedDurationAll === 'true' || savedDurationAll === 'false') {
        setDurationAllSelected(savedDurationAll === 'true');
      }

      const savedDurationMin = window.localStorage.getItem(
        SEARCH_STOCK_DURATION_MIN_FILTER_KEY,
      );
      const savedDurationMax = window.localStorage.getItem(
        SEARCH_STOCK_DURATION_MAX_FILTER_KEY,
      );
      if (savedDurationMin !== null && savedDurationMax !== null) {
        const parsedMin = Number.parseInt(savedDurationMin, 10);
        const parsedMax = Number.parseInt(savedDurationMax, 10);
        if (Number.isFinite(parsedMin) && Number.isFinite(parsedMax)) {
          const clampedMin = Math.min(
            DURATION_NOTCHES.length - 2,
            Math.max(0, parsedMin),
          );
          const clampedMax = Math.min(
            DURATION_NOTCHES.length - 1,
            Math.max(clampedMin + 1, parsedMax),
          );
          setDurationMinFilterIndex(clampedMin);
          setDurationMaxFilterIndex(clampedMax);
        }
      }

      const savedResolution = window.localStorage.getItem(
        SEARCH_STOCK_RESOLUTION_FILTER_KEY,
      );
      if (savedResolution !== null) {
        const value = Number(savedResolution);
        if (value >= 0 && value < RESOLUTION_NOTCHES.length) {
          setResolutionFilterIndex(value);
        }
      }

      const savedFrameRate = window.localStorage.getItem(
        SEARCH_STOCK_FRAME_RATE_FILTER_KEY,
      );
      if (
        savedFrameRate === 'all' ||
        savedFrameRate === '24fps' ||
        savedFrameRate === '30fps' ||
        savedFrameRate === '50fps' ||
        savedFrameRate === '60fps'
      ) {
        setFrameRateFilter(savedFrameRate);
      }

      const savedStockArtistPickFilter = window.localStorage.getItem(
        SEARCH_STOCK_ARTIST_PICK_FILTER_KEY,
      );
      if (
        savedStockArtistPickFilter === 'All' ||
        savedStockArtistPickFilter === "Artist's Pick Only"
      ) {
        setStockArtistPickFilterState(savedStockArtistPickFilter);
      }
      const savedStockPriceFilter = window.localStorage.getItem(
        SEARCH_STOCK_PRICE_FILTER_KEY,
      );
      if (savedStockPriceFilter !== null) {
        const parsedStockPriceFilter = Number.parseInt(savedStockPriceFilter, 10);
        if (Number.isFinite(parsedStockPriceFilter)) {
          const migratedStockPriceFilter =
            parsedStockPriceFilter === LEGACY_STOCK_PRICE_FILTER_MAX
              ? DEFAULT_STOCK_PRICE_FILTER_MAX
              : parsedStockPriceFilter;
          setStockPriceFilterMax(
            Math.min(
              STOCK_PRICE_FILTER_MAX,
              Math.max(PRICE_FILTER_MIN, migratedStockPriceFilter),
            ),
          );
        }
      }
    } catch {
      // Ignore storage access errors.
    } finally {
      setHasHydratedControls(true);
    }
  }, []);

  useEffect(() => {
    if (!hasHydratedControls) return;
    try {
      window.localStorage.setItem(SEARCH_LAYOUT_STORAGE_KEY, layout);
      window.localStorage.setItem(
        SEARCH_PRODUCT_FILTER_STORAGE_KEY,
        productFilter,
      );
      window.localStorage.setItem(
        SEARCH_PRINTS_FILTER_STORAGE_KEY,
        printsFilterState,
      );
      window.localStorage.setItem(
        SEARCH_PRINTS_MOST_POPULAR_FILTER_STORAGE_KEY,
        printsMostPopularFilterState,
      );
      window.localStorage.setItem(
        SEARCH_PRINTS_PRICE_FILTER_STORAGE_KEY,
        String(printsPriceFilterMax),
      );
      window.localStorage.setItem(
        SEARCH_STOCK_DURATION_MIN_FILTER_KEY,
        String(durationMinFilterIndex),
      );
      window.localStorage.setItem(
        SEARCH_STOCK_DURATION_MAX_FILTER_KEY,
        String(durationMaxFilterIndex),
      );
      window.localStorage.setItem(
        SEARCH_STOCK_DURATION_ALL_FILTER_KEY,
        String(durationAllSelected),
      );
      window.localStorage.setItem(
        SEARCH_STOCK_RESOLUTION_FILTER_KEY,
        String(resolutionFilterIndex),
      );
      window.localStorage.setItem(
        SEARCH_STOCK_FRAME_RATE_FILTER_KEY,
        frameRateFilter,
      );
      window.localStorage.setItem(
        SEARCH_STOCK_ARTIST_PICK_FILTER_KEY,
        stockArtistPickFilterState,
      );
      window.localStorage.setItem(
        SEARCH_STOCK_PRICE_FILTER_KEY,
        String(stockPriceFilterMax),
      );
    } catch {
      // Ignore storage access errors.
    }
  }, [
    durationMinFilterIndex,
    durationMaxFilterIndex,
    durationAllSelected,
    frameRateFilter,
    hasHydratedControls,
    layout,
    printsFilterState,
    printsMostPopularFilterState,
    printsPriceFilterMax,
    productFilter,
    resolutionFilterIndex,
    stockArtistPickFilterState,
    stockPriceFilterMax,
  ]);

  useEffect(() => {
    return () => {
      try {
        window.localStorage.removeItem(SEARCH_PRODUCT_FILTER_STORAGE_KEY);
        window.localStorage.removeItem(SEARCH_PRINTS_FILTER_STORAGE_KEY);
        window.localStorage.removeItem(
          SEARCH_PRINTS_MOST_POPULAR_FILTER_STORAGE_KEY,
        );
        window.localStorage.removeItem(SEARCH_PRINTS_PRICE_FILTER_STORAGE_KEY);
        window.localStorage.removeItem(SEARCH_STOCK_DURATION_MIN_FILTER_KEY);
        window.localStorage.removeItem(SEARCH_STOCK_DURATION_MAX_FILTER_KEY);
        window.localStorage.removeItem(SEARCH_STOCK_DURATION_ALL_FILTER_KEY);
        window.localStorage.removeItem(SEARCH_STOCK_RESOLUTION_FILTER_KEY);
        window.localStorage.removeItem(SEARCH_STOCK_FRAME_RATE_FILTER_KEY);
        window.localStorage.removeItem(SEARCH_STOCK_ARTIST_PICK_FILTER_KEY);
        window.localStorage.removeItem(SEARCH_STOCK_PRICE_FILTER_KEY);
      } catch {
        // Ignore storage access errors.
      }
    };
  }, []);

  const gridColumnCount =
    windowWidth != undefined
      ? Math.max(1, Math.floor((windowWidth - 1) / 700) + 1)
      : 1;

  const runPredictiveSearch = useCallback(
    (value: string) => {
      predictiveFetcher.submit(
        {
          q: value,
          predictive: true,
        },
        {method: 'GET', action: '/search'},
      );
    },
    [predictiveFetcher],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = e.target.value;
    setSearchText(nextValue);
    if (nextValue.trim().length === 0) {
      setIsPredictiveMode(false);
      setCommittedPredictiveResult(getEmptyPredictiveSearchResult());
      return;
    }
    setIsPredictiveMode(true);
    runPredictiveSearch(nextValue);
  };

  const handleInputFocus = () => {
    if (!searchText?.trim()) return;
    setIsPredictiveMode(true);
    runPredictiveSearch(searchText.trim());
  };

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedValue = searchText?.trim() ?? '';
    setIsPredictiveMode(false);
    navigate(
      `/search${trimmedValue ? `?q=${encodeURIComponent(trimmedValue)}` : ''}`,
    );
  };

  const activePredictiveTerm =
    predictiveFetcher.state === 'loading' ||
    predictiveFetcher.state === 'submitting'
      ? String(predictiveFetcher.formData?.get('q') ?? '').trim()
      : searchText.trim();
  const hasPredictiveResponseForInput =
    predictiveFetcher.data?.type === 'predictive' &&
    predictiveFetcher.data.term === activePredictiveTerm;
  const latestPredictiveResult =
    hasPredictiveResponseForInput && predictiveFetcher.data?.result
      ? predictiveFetcher.data.result
      : getEmptyPredictiveSearchResult();
  const hasPredictiveTerm = searchText.trim().length > 0;

  useEffect(() => {
    if (!isPredictiveMode || !hasPredictiveTerm) {
      setCommittedPredictiveResult(getEmptyPredictiveSearchResult());
      return;
    }
    if (predictiveFetcher.state !== 'idle') return;
    if (predictiveFetcher.data?.type !== 'predictive') return;
    if (predictiveFetcher.data.term !== searchText.trim()) return;

    setCommittedPredictiveResult(predictiveFetcher.data.result);
  }, [
    isPredictiveMode,
    hasPredictiveTerm,
    predictiveFetcher.state,
    predictiveFetcher.data,
    searchText,
  ]);

  const predictiveResult =
    predictiveFetcher.state === 'idle' && hasPredictiveResponseForInput
      ? latestPredictiveResult
      : committedPredictiveResult;
  const predictiveProducts = (predictiveResult.items.products ??
    []) as unknown as EnhancedPartialSearchResult[];
  const regularProducts =
    data.type === 'regular'
      ? ((data.result?.items?.products?.nodes ??
          []) as unknown as EnhancedPartialSearchResult[])
      : [];
  const showPredictiveResults =
    isPredictiveMode && searchText.trim().length > 0;
  const baseProducts = showPredictiveResults
    ? predictiveProducts
    : regularProducts;

  const filteredDisplayedProducts = useMemo(() => {
    let filteredProducts = baseProducts.slice();

    if (productFilter === 'prints') {
      filteredProducts = filteredProducts.filter(isPrintProduct);
      if (printsMostPopularFilterState === 'Most Popular Only') {
        filteredProducts = filteredProducts.filter((product) =>
          product.tags.includes('most-popular'),
        );
      }
      if (printsFilterState === 'Horizontal') {
        filteredProducts = filteredProducts.filter(
          (product) =>
            product.tags.includes('horOnly') ||
            product.tags.includes('horPrimary'),
        );
      } else if (printsFilterState === 'Vertical') {
        filteredProducts = filteredProducts.filter(
          (product) =>
            product.tags.includes('vertOnly') ||
            product.tags.includes('vertPrimary'),
        );
      }
      filteredProducts = filteredProducts.filter((product) => {
        const productPrice = getProductPriceAmount(product);
        return (
          productPrice === null || productPrice <= printsPriceFilterMax
        );
      });
      return filteredProducts;
    }

    if (productFilter === 'stock') {
      const durationMinNotch =
        DURATION_NOTCHES[durationMinFilterIndex] ??
        DURATION_NOTCHES[DEFAULT_DURATION_MIN_FILTER_INDEX];
      const durationMaxNotch =
        DURATION_NOTCHES[durationMaxFilterIndex] ??
        DURATION_NOTCHES[DEFAULT_DURATION_MAX_FILTER_INDEX];
      const minResolution =
        RESOLUTION_NOTCHES[resolutionFilterIndex]?.value ?? 4;

      return filteredProducts.filter((product) => {
        if (!isStockProduct(product)) return false;

        const isBundleProduct = product.tags.includes('Bundle');
        const matchesArtistPickFilter =
          stockArtistPickFilterState === 'All' ||
          product.tags.includes('a');

        if (!matchesArtistPickFilter) return false;

        if (!durationAllSelected) {
          if (isBundleProduct) {
            const clipDurations = getBundleClipDurations(product.tags);
            if (
              clipDurations.length > 0 &&
              !clipDurations.some((seconds) =>
                matchesDurationRange(
                  seconds,
                  durationMinNotch.value,
                  durationMaxNotch.value,
                ),
              )
            ) {
              return false;
            }
          } else {
            const seconds = parseDurationSeconds(product);
            if (
              seconds !== null &&
              !matchesDurationRange(
                seconds,
                durationMinNotch.value,
                durationMaxNotch.value,
              )
            ) {
              return false;
            }
          }
        }

        if (minResolution > 4) {
          if (isBundleProduct) {
            if (!bundleMatchesResolution(product, minResolution)) return false;
          } else {
            const highest = getHighestResolutionNumber(product);
            if (highest < minResolution) return false;
          }
        }

        if (frameRateFilter !== 'all') {
          if (isBundleProduct) {
            if (!bundleMatchesFrameRate(product.tags, frameRateFilter))
              return false;
          } else if (getTopLevelFrameTagValue(product.tags) !== frameRateFilter) {
            return false;
          }
        }

        const productPrice = getProductPriceAmount(product);
        if (productPrice !== null && productPrice > stockPriceFilterMax) {
          return false;
        }

        return true;
      });
    }

    return filteredProducts;
  }, [
    baseProducts,
    durationMinFilterIndex,
    durationMaxFilterIndex,
    durationAllSelected,
    frameRateFilter,
    printsFilterState,
    printsMostPopularFilterState,
    printsPriceFilterMax,
    productFilter,
    resolutionFilterIndex,
    stockArtistPickFilterState,
    stockPriceFilterMax,
  ]);

  const predictiveQueries = predictiveResult.items.queries ?? [];
  const showPredictiveEmpty =
    showPredictiveResults &&
    hasPredictiveTerm &&
    predictiveFetcher.state === 'idle' &&
    hasPredictiveResponseForInput &&
    filteredDisplayedProducts.length === 0;
  const showPredictiveLoading =
    showPredictiveResults &&
    hasPredictiveTerm &&
    predictiveFetcher.state !== 'idle' &&
    predictiveProducts.length === 0;
  const hasRegularSearchResults =
    Boolean(term?.trim()) && Boolean(result?.total);
  const displayedProductCount = showPredictiveResults
    ? filteredDisplayedProducts.length
    : hasRegularSearchResults
      ? filteredDisplayedProducts.length
      : 0;
  const hasPrintProducts = filteredDisplayedProducts.some(isPrintProduct);
  const hasVideoProducts = filteredDisplayedProducts.some(isStockProduct);
  const listGridClassName =
    hasPrintProducts && !hasVideoProducts
      ? 'print-list-grid'
      : hasVideoProducts && !hasPrintProducts
        ? 'eproduct-list-grid'
        : 'print-list-grid';
  const layoutClassName =
    layout === 'grid'
      ? [
          'prods-grid',
          'gap-x-2',
          hasPrintProducts && hasVideoProducts ? 'mixed-product-grid' : '',
        ]
          .filter(Boolean)
          .join(' ')
      : `mt-[10px] mx-[10px] grid ${listGridClassName} gap-2`;
  const productsContainerStyle =
    layout === 'grid' && windowWidth != undefined
      ? {gridTemplateColumns: `repeat(${gridColumnCount}, minmax(0, 1fr))`}
      : undefined;

  if (type === 'predictive') {
    return null;
  }

  return (
    <SkeletonGate isReady={isPageReady} skeleton={<SearchPageSkeleton />}>
      <div className="search overflow-x-hidden">
        <div className="flex justify-center pt-5">
          <img
            ref={searchImgRef}
            src="https://downloads.adamunderwater.com/store-1-au/public/searchstore.png"
            style={{height: '95px'}}
            onLoad={handleSearchImgLoad}
            alt="Search Store"
          />
        </div>

        <form onSubmit={handleSearchSubmit}>
          {windowWidth != undefined && windowWidth > 600 && (
            <div className="counter-search-toggle-container">
              <div className="product-counter-filter-group">
                <div className="product-counter-container">
                  <div className="flex flex-col items-end">
                    <h4 className="text-md font-medium">
                      {displayedProductCount} product
                      {displayedProductCount !== 1 && 's'}
                    </h4>
                  </div>
                </div>
                <SearchFiltersPopover
                  productFilter={productFilter}
                  setProductFilter={setProductFilter}
                  printsFilterState={printsFilterState}
                  setPrintsFilterState={setPrintsFilterState}
                  printsMostPopularFilterState={printsMostPopularFilterState}
                  setPrintsMostPopularFilterState={
                    setPrintsMostPopularFilterState
                  }
                  printsPriceFilterMax={printsPriceFilterMax}
                  setPrintsPriceFilterMax={setPrintsPriceFilterMax}
                  durationMinFilterIndex={durationMinFilterIndex}
                  setDurationMinFilterIndex={setDurationMinFilterIndex}
                  durationMaxFilterIndex={durationMaxFilterIndex}
                  setDurationMaxFilterIndex={setDurationMaxFilterIndex}
                  durationAllSelected={durationAllSelected}
                  setDurationAllSelected={setDurationAllSelected}
                  resolutionFilterIndex={resolutionFilterIndex}
                  setResolutionFilterIndex={setResolutionFilterIndex}
                  frameRateFilter={frameRateFilter}
                  setFrameRateFilter={setFrameRateFilter}
                  stockArtistPickFilterState={stockArtistPickFilterState}
                  setStockArtistPickFilterState={setStockArtistPickFilterState}
                  stockPriceFilterMax={stockPriceFilterMax}
                  setStockPriceFilterMax={setStockPriceFilterMax}
                  open={isSearchFiltersPopoverOpen}
                  onOpenChange={setIsSearchFiltersPopoverOpen}
                />
              </div>

              <div className="search-product-container">
                <div className="desktop-search-stack flex flex-col items-center mb-2">
                  <InputGroup className="w-[284px] has-[[data-slot=input-group-control]:focus-visible]:border-primary has-[[data-slot=input-group-control]:focus-visible]:ring-primary/50">
                    <InputGroupAddon align="inline-start">
                      <LuSearch className="text-muted-foreground" />
                    </InputGroupAddon>
                    <InputGroupInput
                      name="q"
                      onChange={handleInputChange}
                      onFocus={handleInputFocus}
                      placeholder="Search..."
                      type="search"
                      value={searchText}
                      list={queriesDatalistId}
                    />
                  </InputGroup>
                  <RandomizedSearchHint
                    words={COMBINED_SEARCH_HINT_WORDS}
                    storageKey="search-hint-combined-page"
                    className="desktop-search-hint w-[284px] pl-9 text-left text-[11px] text-muted-foreground"
                  />
                </div>
              </div>

              <div className="grid-list-toggle-container flex gap-x-4">
                <button
                  type="button"
                  className={
                    layout === 'list'
                      ? 'h-9 rounded-md bg-primary px-4 py-2 text-primary-foreground shadow hover:bg-primary/90'
                      : 'h-9 cursor-pointer rounded-md px-4 py-2 hover:bg-accent hover:text-accent-foreground'
                  }
                  onClick={() => {
                    if (layout !== 'list') setLayout('list');
                  }}
                >
                  <LuZoomOut />
                </button>

                <button
                  type="button"
                  className={
                    layout === 'grid'
                      ? 'h-9 rounded-md bg-primary px-4 py-2 text-primary-foreground shadow hover:bg-primary/90'
                      : 'h-9 cursor-pointer rounded-md px-4 py-2 hover:bg-accent hover:text-accent-foreground'
                  }
                  onClick={() => {
                    if (layout !== 'grid') setLayout('grid');
                  }}
                >
                  <LuZoomIn />
                </button>
              </div>
            </div>
          )}

          {windowWidth != undefined && windowWidth <= 600 && (
            <div className="counter-search-toggle-container">
              <div className="top-row mb-2">
                <div className="search-center">
                  <div className="search-product-container">
                    <div className="mt-[8px] flex flex-col items-center">
                      <InputGroup className="w-[300px] max-w-[calc(100vw-80px)] has-[[data-slot=input-group-control]:focus-visible]:border-primary has-[[data-slot=input-group-control]:focus-visible]:ring-primary/50">
                        <InputGroupAddon align="inline-start">
                          <LuSearch className="text-muted-foreground" />
                        </InputGroupAddon>
                        <InputGroupInput
                          name="q"
                          onChange={handleInputChange}
                          onFocus={handleInputFocus}
                          placeholder="Search..."
                          type="search"
                          value={searchText}
                          list={queriesDatalistId}
                        />
                      </InputGroup>
                      <RandomizedSearchHint
                        words={COMBINED_SEARCH_HINT_WORDS}
                        storageKey="search-hint-combined-page"
                        className="mt-1.5 w-[300px] max-w-[calc(100vw-80px)] pl-9 text-left text-[11px] text-muted-foreground"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bottom-row">
                <div className="product-count flex items-center gap-2">
                  <div className="product-counter-container">
                    <div className="flex flex-col items-end">
                      <h4 className="text-md font-medium">
                        {displayedProductCount} product
                        {displayedProductCount !== 1 && 's'}
                      </h4>
                    </div>
                  </div>
                  <SearchFiltersPopover
                    productFilter={productFilter}
                    setProductFilter={setProductFilter}
                    printsFilterState={printsFilterState}
                    setPrintsFilterState={setPrintsFilterState}
                    printsMostPopularFilterState={printsMostPopularFilterState}
                    setPrintsMostPopularFilterState={
                      setPrintsMostPopularFilterState
                    }
                    printsPriceFilterMax={printsPriceFilterMax}
                    setPrintsPriceFilterMax={setPrintsPriceFilterMax}
                    durationMinFilterIndex={durationMinFilterIndex}
                    setDurationMinFilterIndex={setDurationMinFilterIndex}
                    durationMaxFilterIndex={durationMaxFilterIndex}
                    setDurationMaxFilterIndex={setDurationMaxFilterIndex}
                    durationAllSelected={durationAllSelected}
                    setDurationAllSelected={setDurationAllSelected}
                    resolutionFilterIndex={resolutionFilterIndex}
                    setResolutionFilterIndex={setResolutionFilterIndex}
                    frameRateFilter={frameRateFilter}
                    setFrameRateFilter={setFrameRateFilter}
                    stockArtistPickFilterState={stockArtistPickFilterState}
                    setStockArtistPickFilterState={setStockArtistPickFilterState}
                    stockPriceFilterMax={stockPriceFilterMax}
                    setStockPriceFilterMax={setStockPriceFilterMax}
                    open={isSearchFiltersPopoverOpen}
                    onOpenChange={setIsSearchFiltersPopoverOpen}
                  />
                </div>

                <div className="layout-toggle">
                  <div className="grid-list-toggle-container flex gap-x-4">
                    <button
                      type="button"
                      className={
                        layout === 'list'
                          ? 'h-9 rounded-md bg-primary px-4 py-2 text-primary-foreground shadow hover:bg-primary/90'
                          : 'h-9 cursor-pointer rounded-md px-4 py-2 hover:bg-accent hover:text-accent-foreground'
                      }
                      onClick={() => {
                        if (layout !== 'list') setLayout('list');
                      }}
                    >
                      <LuZoomOut />
                    </button>

                    <button
                      type="button"
                      className={
                        layout === 'grid'
                          ? 'h-9 rounded-md bg-primary px-4 py-2 text-primary-foreground shadow hover:bg-primary/90'
                          : 'h-9 cursor-pointer rounded-md px-4 py-2 hover:bg-accent hover:text-accent-foreground'
                      }
                      onClick={() => {
                        if (layout !== 'grid') setLayout('grid');
                      }}
                    >
                      <LuZoomIn />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <SearchResultsPredictive.Queries
            queries={predictiveQueries}
            queriesDatalistId={queriesDatalistId}
          />
        </form>

        {showPredictiveResults ? (
          showPredictiveLoading ? (
            <div className="flex justify-center px-4 py-6 text-center text-muted-foreground">
              Searching...
            </div>
          ) : showPredictiveEmpty ? (
            <SearchResultsPredictive.Empty
              term={{current: searchText.trim()}}
            />
          ) : (
            <div
              className={`${layoutClassName} collection-results-surface`.trim()}
              style={productsContainerStyle}
            >
              <SearchResultsPredictive.Products
                products={filteredDisplayedProducts}
                layout={layout}
                term={{current: searchText.trim()}}
                cart={cart}
                wishlistProducts={wishlistProducts ?? []}
                isLoggedIn={isLoggedIn}
                surface="search-page"
                searchPageAllSelectionMode={productFilter === 'all'}
              />
            </div>
          )
        ) : (
          <>
            {error && <p style={{color: 'red'}}>{error}</p>}
            {!hasRegularSearchResults ? (
              <div className="flex justify-center pt-[30px]">
                No results, try a different search.
              </div>
            ) : filteredDisplayedProducts.length === 0 ? (
              <SearchResultsPredictive.Empty term={{current: term.trim()}} />
            ) : (
              <div
                className={`${layoutClassName} collection-results-surface`.trim()}
                style={productsContainerStyle}
              >
                <SearchResultsPredictive.Products
                  products={filteredDisplayedProducts}
                  layout={layout}
                  term={{current: term.trim()}}
                  cart={cart}
                  wishlistProducts={wishlistProducts ?? []}
                  isLoggedIn={isLoggedIn}
                  surface="search-page"
                  searchPageAllSelectionMode={productFilter === 'all'}
                />
              </div>
            )}
          </>
        )}
        <Analytics.SearchView
          data={{searchTerm: term, searchResults: result}}
        />
      </div>
    </SkeletonGate>
  );
}

/**
 * Regular search query and fragments
 * (adjust as needed)
 */
const SEARCH_PRODUCT_FRAGMENT = `#graphql
fragment MoneyProductItem on MoneyV2 {
    amount
    currencyCode
  }
  fragment SearchProduct on Product {
    __typename
    id
    title
    handle
    tags
    descriptionHtml
    featuredImage {
      altText
      url
    }
    trackingParameters
    images(first: 20) {
      nodes {
        url
        altText
      }
    }
    priceRange {
      minVariantPrice {
        ...MoneyProductItem
      }
      maxVariantPrice {
        ...MoneyProductItem
      }
    }
    selectedOrFirstAvailableVariant(
      selectedOptions: []
      ignoreUnknownOptions: false
      caseInsensitiveMatch: true
    ) {
      id
      image {
        url
        altText
        width
        height
      }
      price {
        amount
        currencyCode
      }
      compareAtPrice {
        amount
        currencyCode
      }
    }
    options {
      name
      optionValues {
        name
        firstSelectableVariant {
          id
          availableForSale
          image {
            url
            altText
            width
            height
          }
          price {
            amount
            currencyCode
          }
          compareAtPrice {
            amount
            currencyCode
          }
        }
      }
    }
  }
` as const;

const SEARCH_PAGE_FRAGMENT = `#graphql
  fragment SearchPage on Page {
     __typename
     handle
    id
    title
    trackingParameters
  }
` as const;

const SEARCH_ARTICLE_FRAGMENT = `#graphql
  fragment SearchArticle on Article {
    __typename
    handle
    id
    title
    trackingParameters
  }
` as const;

const PAGE_INFO_FRAGMENT = `#graphql
  fragment PageInfoFragment on PageInfo {
    hasNextPage
    hasPreviousPage
    startCursor
    endCursor
  }
` as const;

// NOTE: https://shopify.dev/docs/api/storefront/latest/queries/search
export const SEARCH_QUERY = `#graphql
  query RegularSearch(
    $country: CountryCode
    $endCursor: String
    $first: Int
    $language: LanguageCode
    $last: Int
    $term: String!
    $startCursor: String
    $filters: [ProductFilter!]
  ) @inContext(country: $country, language: $language) {
    articles: search(
      query: $term,
      types: [ARTICLE],
      first: $first,
    ) {
      nodes {
        ...on Article {
          ...SearchArticle
        }
      }
    }
    pages: search(
      query: $term,
      types: [PAGE],
      first: $first,
    ) {
      nodes {
        ...on Page {
          ...SearchPage
        }
      }
    }
    products: search(
      after: $endCursor,
      before: $startCursor,
      first: $first,
      last: $last,
      query: $term,
      productFilters: $filters,
      sortKey: RELEVANCE,
      types: [PRODUCT],
      unavailableProducts: HIDE,
    ) {
      nodes {
        ...on Product {
          ...SearchProduct
          tags
        }
      }
      pageInfo {
        ...PageInfoFragment
      }
    }
  }
  ${SEARCH_PRODUCT_FRAGMENT}
  ${SEARCH_PAGE_FRAGMENT}
  ${SEARCH_ARTICLE_FRAGMENT}
  ${PAGE_INFO_FRAGMENT}
` as const;

/**
 * Regular search fetcher
 */
async function regularSearch({
  request,
  context,
}: Pick<
  LoaderFunctionArgs,
  'request' | 'context'
>): Promise<RegularSearchReturn> {
  const {storefront} = context;
  const url = new URL(request.url);
  const variables = getPaginationVariables(request, {pageBy: 8});
  const term = String(url.searchParams.get('q') || '');

  // Search articles, pages, and products for the `q` term
  const {errors, ...items} = await storefront.query(SEARCH_QUERY, {
    variables: {...variables, term},
  });

  if (!items) {
    throw new Error('No search data returned from Shopify API');
  }

  if (Array.isArray(items?.products?.nodes)) {
    items.products.nodes = applyHighestResolutionVariantToProducts(
      items.products.nodes as any[],
    );
  }

  const total = Object.values(
    items as Record<string, {nodes?: unknown[]}>,
  ).reduce((acc, item) => {
    const nodesLength = Array.isArray(item?.nodes) ? item.nodes.length : 0;
    return acc + nodesLength;
  }, 0);

  const error = Array.isArray(errors)
    ? (errors as Array<{message?: string}>)
        .map((errorItem) => errorItem.message ?? '')
        .filter(Boolean)
        .join(', ') || undefined
    : undefined;

  return {type: 'regular', term, error, result: {total, items}};
}

/**
 * Predictive search query and fragments
 * (adjust as needed)
 */
const PREDICTIVE_SEARCH_ARTICLE_FRAGMENT = `#graphql
  fragment PredictiveArticle on Article {
    __typename
    id
    title
    handle
    blog {
      handle
    }
    image {
      url
      altText
      width
      height
    }
    trackingParameters
  }
` as const;

const PREDICTIVE_SEARCH_COLLECTION_FRAGMENT = `#graphql
  fragment PredictiveCollection on Collection {
    __typename
    id
    title
    handle
    image {
      url
      altText
      width
      height
    }
    trackingParameters
  }
` as const;

const PREDICTIVE_SEARCH_PAGE_FRAGMENT = `#graphql
  fragment PredictivePage on Page {
    __typename
    id
    title
    handle
    trackingParameters
  }
` as const;

const PREDICTIVE_SEARCH_PRODUCT_FRAGMENT = `#graphql
fragment MoneyProductItem on MoneyV2 {
    amount
    currencyCode
  }
  fragment PredictiveProduct on Product {
    __typename
    id
    title
    handle
    tags
    descriptionHtml
    featuredImage {
      altText
      url
    }
    trackingParameters
    images(first: 20) {
      nodes {
        url
        altText
      }
    }
    priceRange {
      minVariantPrice {
        ...MoneyProductItem
      }
      maxVariantPrice {
        ...MoneyProductItem
      }
    }
    selectedOrFirstAvailableVariant(
      selectedOptions: []
      ignoreUnknownOptions: false
      caseInsensitiveMatch: true
    ) {
      id
      image {
        url
        altText
        width
        height
      }
      price {
        amount
        currencyCode
      }
    }
    options {
      name
      optionValues {
        name
        firstSelectableVariant {
          id
          availableForSale
          image {
            url
            altText
            width
            height
          }
          price {
            amount
            currencyCode
          }
          compareAtPrice {
            amount
            currencyCode
          }
        }
      }
    }
  }
` as const;

const PREDICTIVE_SEARCH_QUERY_FRAGMENT = `#graphql
  fragment PredictiveQuery on SearchQuerySuggestion {
    __typename
    text
    styledText
    trackingParameters
  }
` as const;

// NOTE: https://shopify.dev/docs/api/storefront/latest/queries/predictiveSearch
const PREDICTIVE_SEARCH_QUERY = `#graphql
  query PredictiveSearch(
    $country: CountryCode
    $language: LanguageCode
    $limit: Int!
    $limitScope: PredictiveSearchLimitScope!
    $term: String!
    $types: [PredictiveSearchType!]
  ) @inContext(country: $country, language: $language) {
    predictiveSearch(
      limit: $limit,
      limitScope: $limitScope,
      query: $term,
      types: $types,
    ) {
      articles {
        ...PredictiveArticle
      }
      collections {
        ...PredictiveCollection
      }
      pages {
        ...PredictivePage
      }
      products {
        ...PredictiveProduct
      }
      queries {
        ...PredictiveQuery
      }
    }
  }
  ${PREDICTIVE_SEARCH_ARTICLE_FRAGMENT}
  ${PREDICTIVE_SEARCH_COLLECTION_FRAGMENT}
  ${PREDICTIVE_SEARCH_PAGE_FRAGMENT}
  ${PREDICTIVE_SEARCH_PRODUCT_FRAGMENT}
  ${PREDICTIVE_SEARCH_QUERY_FRAGMENT}
` as const;

/**
 * Predictive search fetcher
 */
async function predictiveSearch({
  request,
  context,
}: Pick<
  ActionFunctionArgs,
  'request' | 'context'
>): Promise<PredictiveSearchReturn> {
  const {storefront} = context;
  const url = new URL(request.url);
  const term = String(url.searchParams.get('q') || '').trim();
  const limit = Number(url.searchParams.get('limit') || 10);
  const type = 'predictive';
  const hasSearchableCharacters = /[\p{L}\p{N}]/u.test(term);

  if (!term || !hasSearchableCharacters) {
    return {type, term, result: getEmptyPredictiveSearchResult()};
  }

  // Predictively search articles, collections, pages, products, and queries (suggestions)
  const {predictiveSearch: items, errors} = await storefront.query(
    PREDICTIVE_SEARCH_QUERY,
    {
      variables: {
        // customize search options as needed
        limit,
        limitScope: 'EACH',
        term,
      },
    },
  );

  if (errors) {
    throw new Error(
      `Shopify API errors: ${errors.map(({message}: any) => message).join(', ')}`,
    );
  }

  if (!items) {
    throw new Error('No predictive search data returned from Shopify API');
  }

  if (Array.isArray(items?.products)) {
    items.products = applyHighestResolutionVariantToProducts(
      items.products as any[],
    );
  }

  const total = Object.values(items).reduce(
    (acc: any, item: any) => acc + item.length,
    0,
  ) as unknown as number;

  return {type, term, result: {items, total}};
}
