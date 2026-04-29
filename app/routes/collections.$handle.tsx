import {redirect, type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {
  useLoaderData,
  Link,
  type MetaFunction,
  useSearchParams,
  useFetcher,
} from '@remix-run/react';
import {
  getPaginationVariables,
  Image,
  Money,
  Analytics,
  getProductOptions,
  useOptimisticVariant,
  getAdjacentAndFirstAvailableVariants,
  useSelectedOptionInUrlParam,
  getSelectedProductOptions,
} from '@shopify/hydrogen';
import type {ProductItemFragment} from 'storefrontapi.generated';
import {useVariantUrl} from '~/lib/variants';
import {PaginatedResourceSection} from '~/components/PaginatedResourceSection';
import ProductsHeader from '~/components/products/productsHeader';
import EProductsHeader from '~/components/eproducts/EProductsHeader';
import ProductCarousel from '~/components/products/productCarousel';
import {Separator} from '~/components/ui/separator';
import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import {LuSearch, LuZoomIn, LuZoomOut} from 'react-icons/lu';
import {FilterDropdown} from '~/components/ui/popover';
import {
  applyHighestResolutionVariantToProducts,
  parseResolutionValue,
} from '~/lib/resolution';
import {getHighestResolutionLabelFromTags} from '~/lib/downloads';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '~/components/ui/input-group';
import {SearchFormPredictive} from '~/components/SearchFormPredictive';
import {SearchResultsPredictive} from '~/components/SearchResultsPredictive';
import EProductsContainer from '~/components/eproducts/EProductsContainer';
import {capitalizeFirstLetter} from '~/utils/grammer';
import {EnhancedPartialSearchResult} from '~/lib/types';
import {type PredictiveSearchReturn} from '~/lib/search';
import Product from './products.$handle';
import Collections from './collections._index';
import {Tooltip, TooltipContent, TooltipTrigger} from '~/components/ui/tooltip';
import {Kbd} from '~/components/ui/kbd';
import {CUSTOMER_WISHLIST} from '~/lib/customerQueries';
import RecommendedProducts from '~/components/products/recommendedProducts';
import CollectionPageSkeleton from '~/components/skeletons/CollectionPageSkeleton';
import {SkeletonGate} from '~/components/skeletons/shared';
import {ToggleGroup, ToggleGroupItem} from '~/components/ui/toggle-group';
import {Checkbox} from '~/components/ui/checkbox';
import {DEFAULT_LINK_PREVIEW_ICON} from '~/lib/linkPreview';
import MarqueeBanner from '~/components/global/MarqueeBanner';
import {
  EPRODUCT_SEARCH_HINT_WORDS,
  PRINT_SEARCH_HINT_WORDS,
  RandomizedSearchHint,
} from '~/components/RandomizedSearchHint';
import {
  getCollectionPathByHandle,
  getHandleFromCollectionPath,
  getRedirectPathFromLegacyCollectionPath,
} from '~/lib/collectionPaths';
import {
  parseDurationSecondsFromTags,
  parseDurationSecondsValue,
} from '~/lib/durationTags';
import {hasVideoTag} from '~/lib/productTags';

export const meta: MetaFunction<typeof loader> = ({data}) => {
  const collection = data?.collection as
    | {
        handle?: string | null;
        title?: string | null;
        description?: string | null;
        image?: {url?: string | null} | null;
        products?: {nodes?: Array<Record<string, any>>} | null;
      }
    | undefined;
  const collectionHandle = collection?.handle?.toLowerCase() ?? '';
  const collectionProducts = Array.isArray(collection?.products?.nodes)
    ? collection.products.nodes
    : [];

  const productPreviewImage = (product: Record<string, any> | undefined) =>
    product?.selectedOrFirstAvailableVariant?.image?.url ??
    product?.featuredImage?.url ??
    product?.images?.nodes?.[0]?.url ??
    '';

  const printOneProduct =
    collectionHandle === 'prints'
      ? collectionProducts.find((product) =>
          Array.isArray(product?.tags)
            ? product.tags.some(
                (tag: unknown) =>
                  typeof tag === 'string' && /^print[-_]1$/i.test(tag.trim()),
              )
            : false,
        )
      : undefined;

  const shareImage =
    (collectionHandle === 'prints'
      ? productPreviewImage(printOneProduct as Record<string, any> | undefined)
      : '') ||
    collection?.image?.url ||
    productPreviewImage(collectionProducts[0]) ||
    DEFAULT_LINK_PREVIEW_ICON;

  const title =
    collectionHandle === 'stock'
      ? 'Adam Underwater | Stock Footage'
      : collectionHandle === 'prints'
        ? 'Adam Underwater | Prints'
        : `Adam Underwater | ${collection?.title ?? ''} Collection`;
  const description =
    collection?.description?.trim() || 'Explore Adam Underwater collections.';
  const canonicalUrl =
    data?.canonicalCollectionUrl ??
    data?.currentShareUrl ??
    'https://adamunderwater.com/collections';
  const ogUrl = data?.currentShareUrl ?? canonicalUrl;

  const hiddenCollections = ['product-sizes'];
  const shouldNoindex = hiddenCollections.includes(collectionHandle);

  return [
    {title},
    {name: 'title', content: title},
    {name: 'description', content: description},
    ...(shouldNoindex
      ? [{name: 'robots', content: 'noindex, nofollow'}]
      : []),
    {
      tagName: 'link',
      rel: 'canonical',
      href: canonicalUrl,
    },
    {property: 'og:type', content: 'website'},
    {property: 'og:title', content: title},
    {property: 'og:description', content: description},
    {property: 'og:url', content: ogUrl},
    {property: 'og:image', content: shareImage},
    {property: 'og:image:secure_url', content: shareImage},
    {
      property: 'og:image:alt',
      content: `${collection?.title ?? 'Collection'} preview image`,
    },
    {name: 'twitter:card', content: 'summary_large_image'},
    {name: 'twitter:title', content: title},
    {name: 'twitter:description', content: description},
    {name: 'twitter:image', content: shareImage},
    {
      name: 'twitter:image:alt',
      content: `${collection?.title ?? 'Collection'} preview image`,
    },
  ];
};

export async function loader(args: LoaderFunctionArgs) {
  // Start fetching non-critical data without blocking time to first byte

  const deferredData = loadDeferredData(args);

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);
  let customer = null;
  try {
    customer = await args.context.customerAccount.query(CUSTOMER_WISHLIST);
  } catch (error) {
    console.warn('Not logged in');
    customer = null;
  }
  if (!customer) {
    return {
      ...deferredData,
      ...criticalData,
      wishlistProducts: undefined,
      isLoggedIn: undefined,
    };
  }

  const isLoggedIn = args.context.customerAccount.isLoggedIn();

  // if (!customer.data.customer.metafield?.value) {
  //   return [];
  // }
  let wishlistProducts: string[];
  const customerMetafieldValue =
    customer.data.customer.metafield?.value ?? undefined;
  if (customerMetafieldValue) {
    wishlistProducts = JSON.parse(customerMetafieldValue) as string[];
  } else {
    wishlistProducts = [];
  }

  return {...deferredData, ...criticalData, wishlistProducts, isLoggedIn};
}

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 */
async function loadCriticalData({
  context,
  params,
  request,
}: LoaderFunctionArgs) {
  const {storefront, cart} = context;

  const url = new URL(request.url);
  const handle =
    params.handle?.toLowerCase() ?? getHandleFromCollectionPath(url.pathname);
  const searchTerm = url.searchParams.get('q')?.trim() || '';
  const paginationVariables = getPaginationVariables(request, {
    pageBy: 250,
  });

  if (!handle) {
    throw redirect('/prints', 301);
  }

  const legacyRedirectPath = getRedirectPathFromLegacyCollectionPath(
    url.pathname,
  );
  if (legacyRedirectPath) {
    throw redirect(`${legacyRedirectPath}${url.search}`, 301);
  }
  const filters: {tag?: string; query?: string}[] = [];
  if (searchTerm) {
    filters.push({tag: searchTerm});
  }

  const [{collection}, stockFallbackResponse] = await Promise.all([
    storefront.query(COLLECTION_QUERY, {
      variables: {
        handle,
        ...paginationVariables,
        filter: filters.length ? filters : undefined,
      },
      // Add other queries here, so that they are loaded in parallel
    }),
    handle === 'stock'
      ? storefront.query(STOCK_PRODUCTS_FALLBACK_QUERY, {
          variables: {first: 250},
        })
      : Promise.resolve(null),
  ]);

  if (!collection) {
    throw new Response(`Collection ${handle} not found`, {
      status: 404,
    });
  }

  if (Array.isArray(collection?.products?.nodes)) {
    let mergedNodes = [...(collection.products.nodes as any[])];

    if (handle === 'stock') {
      const fallbackNodes = Array.isArray(
        stockFallbackResponse?.products?.nodes,
      )
        ? (stockFallbackResponse.products.nodes as any[]).filter((product) =>
            hasVideoTag(product?.tags),
          )
        : [];

      if (fallbackNodes.length > 0) {
        const byId = new Map<string, any>();
        for (const product of [...mergedNodes, ...fallbackNodes]) {
          const id = typeof product?.id === 'string' ? product.id : '';
          if (!id) continue;
          if (!byId.has(id)) byId.set(id, product);
        }
        mergedNodes = Array.from(byId.values());
      }
    }

    collection.products.nodes = applyHighestResolutionVariantToProducts(
      mergedNodes,
    );
  }

  return {
    collection,
    searchTerm,
    cart: cart.get(),
    canonicalCollectionUrl: `${url.origin}${getCollectionPathByHandle(handle)}`,
    currentShareUrl: `${url.origin}${url.pathname}${url.search}`,
  };
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData({context}: LoaderFunctionArgs) {
  return {};
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Stock Footage Filters                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

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
const PRICE_FILTER_MIN = 0;
const STOCK_PRICE_FILTER_MAX = 200;
const DEFAULT_STOCK_PRICE_FILTER_MAX = STOCK_PRICE_FILTER_MAX;
const PRINTS_PRICE_FILTER_MAX = 400;
const DEFAULT_PRINTS_PRICE_FILTER_MAX = PRINTS_PRICE_FILTER_MAX;
const bundleDurationRegex = /^d(\d+)-(.+)$/i;
const bundleResolutionRegex = /^res(\d+)-(.+)$/i;
const bundleFrameRegex = /^frame(\d+)-(.+)$/i;

type FrameRateFilter = 'all' | '24fps' | '30fps' | '50fps' | '60fps';
const DEFAULT_FRAME_RATE_FILTER: FrameRateFilter = 'all';

const STOCK_FILTER_ICON_BUTTON_CLASS_NAME =
  'relative inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md border border-input bg-background text-sm font-medium shadow-sm outline-none transition-all hover:bg-accent hover:text-accent-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-default disabled:opacity-50';

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
          onBlur: chainMouseHandler(children.props.onBlur, () =>
            setOpen(false),
          ),
        })}
      </TooltipTrigger>
      <TooltipContent side={side} className="z-[1001]">
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

const CollectionFilterIconButton = React.forwardRef<
  HTMLButtonElement,
  {
    isFiltered: boolean;
    ariaLabel: string;
  } & React.ButtonHTMLAttributes<HTMLButtonElement>
>(function CollectionFilterIconButton(
  {isFiltered, ariaLabel, className, type = 'button', ...props},
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`${STOCK_FILTER_ICON_BUTTON_CLASS_NAME} ${className ?? ''}`.trim()}
      aria-label={ariaLabel}
      {...props}
    >
      <img
        src={
          'https://downloads.adamunderwater.com/store-1-au/public/filter.png'
        }
        alt=""
        className="w-5 h-5"
      ></img>
      {isFiltered && (
        <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" />
      )}
    </button>
  );
});

function NotchedSlider({
  notches,
  value,
  onChange,
  label,
  headerContent,
}: {
  notches: {value: number; label: string}[];
  value: number;
  onChange: (index: number) => void;
  label: string;
  headerContent?: React.ReactNode;
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
      {headerContent ?? (
        <p className="text-sm font-medium mb-2 text-foreground">{label}</p>
      )}
      <div className="notched-slider-container">
        <div className="notched-slider-labels">
          {notches.map((notch, idx) => (
            <button
              key={`${label}-${notch.label}-${String(notch.value)}`}
              type="button"
              className={`notched-slider-label ${idx === value ? 'active' : ''}`}
              style={{left: getNotchPosition(idx)}}
              onClick={() => onChange(idx)}
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
              onFocus={() => setHoveredIndex(idx)}
              onBlur={() => setHoveredIndex(null)}
            >
              {notch.label}
            </button>
          ))}
        </div>
        <div className="notched-slider-rail">
          <div className="notched-slider-markers">
            {notches.map((notch, idx) => (
              <button
                key={`${label}-marker-${notch.label}-${String(notch.value)}`}
                type="button"
                className="notched-slider-marker-slot"
                style={{left: getNotchPosition(idx)}}
                onClick={() => onChange(idx)}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                onFocus={() => setHoveredIndex(idx)}
                onBlur={() => setHoveredIndex(null)}
                aria-label={`Set ${label} to ${notch.label}`}
              >
                <span
                  className={`notched-slider-tick ${idx <= activeIndex ? 'active' : ''} ${previewIndex === idx ? 'preview' : ''}`.trim()}
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
  const [draftRange, setDraftRange] = useState<{
    min: number;
    max: number;
  } | null>(null);
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

  const handleTrackPointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
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
    <div className="border-t border-border pt-2">
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

function PrintsFiltersPopover({
  filterState,
  setFilterState,
  mostPopularFilterState,
  setMostPopularFilterState,
  printsPriceFilterMax,
  setPrintsPriceFilterMax,
  open,
  onOpenChange,
}: {
  filterState: 'All' | 'Horizontal' | 'Vertical';
  setFilterState: (value: 'All' | 'Horizontal' | 'Vertical') => void;
  mostPopularFilterState: 'All' | 'Most Popular Only';
  setMostPopularFilterState: (value: 'All' | 'Most Popular Only') => void;
  printsPriceFilterMax: number;
  setPrintsPriceFilterMax: (value: number) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isFiltered =
    filterState !== 'All' ||
    mostPopularFilterState !== 'All' ||
    printsPriceFilterMax !== DEFAULT_PRINTS_PRICE_FILTER_MAX;
  const handleReset = () => {
    setFilterState('All');
    setMostPopularFilterState('All');
    setPrintsPriceFilterMax(DEFAULT_PRINTS_PRICE_FILTER_MAX);
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
            <CollectionFilterIconButton
              isFiltered={isFiltered}
              ariaLabel="Filter print products"
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
          className="w-80 p-2"
        >
          <div className="space-y-4">
            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-foreground">
                  Orientation
                </p>
                <HoverOnlyTooltip
                  content={
                    <>
                      Reset Filters - shortcut: <Kbd>r</Kbd>
                    </>
                  }
                >
                  <button
                    type="button"
                    className={STOCK_FILTER_ICON_BUTTON_CLASS_NAME}
                    aria-label="Reset print filters"
                    onClick={handleReset}
                  >
                    <img
                      src={
                        'https://downloads.adamunderwater.com/store-1-au/public/reset.png'
                      }
                      alt=""
                      className="w-5 h-5"
                    ></img>
                  </button>
                </HoverOnlyTooltip>
              </div>
              <InputGroup className="overflow-hidden">
                {(['All', 'Horizontal', 'Vertical'] as const).map(
                  (value, index) => (
                    <HoverOnlyTooltip
                      key={value}
                      content={
                        <>
                          Keyboard shortcut:{' '}
                          <Kbd>
                            {value === 'All'
                              ? 'a'
                              : value === 'Horizontal'
                                ? 'h'
                                : 'v'}
                          </Kbd>
                        </>
                      }
                    >
                      <button
                        type="button"
                        className={`h-9 flex-1 cursor-pointer px-3 text-sm transition-colors ${
                          index > 0 ? 'border-l border-input' : ''
                        } ${
                          filterState === value
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground'
                        }`}
                        onClick={() => setFilterState(value)}
                      >
                        {value}
                      </button>
                    </HoverOnlyTooltip>
                  ),
                )}
              </InputGroup>
            </div>
            <p className="text-sm text-muted-foreground">
              Many horizontal prints <strong>are also available</strong> in
              vertical on the product page
            </p>
            <div className="border-t border-border pt-2">
              <p className="text-sm font-medium text-foreground mb-3">
                Most Popular
              </p>
              <ToggleGroup
                type="single"
                variant="outline"
                value={mostPopularFilterState}
                onValueChange={(value) => {
                  if (value) {
                    setMostPopularFilterState(
                      value as 'All' | 'Most Popular Only',
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
        </FilterDropdown>
    </div>
  );
}

function StockFiltersPopover({
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
  artistPickFilterState,
  setArtistPickFilterState,
  priceFilterMax,
  setPriceFilterMax,
  open,
  onOpenChange,
}: {
  durationMinFilterIndex: number;
  setDurationMinFilterIndex: (v: number) => void;
  durationMaxFilterIndex: number;
  setDurationMaxFilterIndex: (v: number) => void;
  durationAllSelected: boolean;
  setDurationAllSelected: (value: boolean) => void;
  resolutionFilterIndex: number;
  setResolutionFilterIndex: (v: number) => void;
  frameRateFilter: FrameRateFilter;
  setFrameRateFilter: (v: FrameRateFilter) => void;
  artistPickFilterState: 'All' | "Artist's Pick Only";
  setArtistPickFilterState: (v: 'All' | "Artist's Pick Only") => void;
  priceFilterMax: number;
  setPriceFilterMax: (value: number) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isFiltered =
    !durationAllSelected ||
    durationMinFilterIndex !== DEFAULT_DURATION_MIN_FILTER_INDEX ||
    durationMaxFilterIndex !== DEFAULT_DURATION_MAX_FILTER_INDEX ||
    resolutionFilterIndex !== DEFAULT_RESOLUTION_FILTER_INDEX ||
    frameRateFilter !== DEFAULT_FRAME_RATE_FILTER ||
    artistPickFilterState !== 'All' ||
    priceFilterMax !== DEFAULT_STOCK_PRICE_FILTER_MAX;

  const handleReset = () => {
    setDurationMinFilterIndex(DEFAULT_DURATION_MIN_FILTER_INDEX);
    setDurationMaxFilterIndex(DEFAULT_DURATION_MAX_FILTER_INDEX);
    setDurationAllSelected(DEFAULT_DURATION_ALL_FILTER);
    setResolutionFilterIndex(DEFAULT_RESOLUTION_FILTER_INDEX);
    setFrameRateFilter(DEFAULT_FRAME_RATE_FILTER);
    setArtistPickFilterState('All');
    setPriceFilterMax(DEFAULT_STOCK_PRICE_FILTER_MAX);
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
            <CollectionFilterIconButton
              isFiltered={isFiltered}
              ariaLabel="Filter stock footage"
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
          className="w-80 p-3"
        >
          <div className="space-y-4">
            <div className="notched-slider-section">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-foreground">
                  Duration (seconds)
                </p>
                <HoverOnlyTooltip
                  content={
                    <>
                      Reset Filters - shortcut: <Kbd>r</Kbd>
                    </>
                  }
                >
                  <button
                    type="button"
                    className={STOCK_FILTER_ICON_BUTTON_CLASS_NAME}
                    aria-label="Reset stock filters"
                    onClick={handleReset}
                  >
                    <img
                      src={
                        'https://downloads.adamunderwater.com/store-1-au/public/reset.png'
                      }
                      alt=""
                      className="w-5 h-5"
                    ></img>
                  </button>
                </HoverOnlyTooltip>
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
              <p className="text-sm font-medium text-foreground mb-3">
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
              <p className="text-sm font-medium text-foreground mb-3">
                Artist&apos;s Pick
              </p>
              <ToggleGroup
                type="single"
                variant="outline"
                value={artistPickFilterState}
                onValueChange={(value) => {
                  if (value) {
                    setArtistPickFilterState(
                      value as 'All' | "Artist's Pick Only",
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
              value={priceFilterMax}
              onChange={setPriceFilterMax}
              minValue={PRICE_FILTER_MIN}
              maxValue={STOCK_PRICE_FILTER_MAX}
            />
          </div>
        </FilterDropdown>
    </div>
  );
}

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

/** Get the highest resolution number from a product's option values (e.g. 5 for "5K"). */
function getHighestResolutionNumber(product: {
  tags: string[];
  options?: {name?: string; optionValues?: {name?: string}[]}[];
}): number {
  // First try from variant options
  const resolutionOption = product.options?.find(
    (o) =>
      typeof o.name === 'string' &&
      o.name.trim().toLowerCase() === 'resolution',
  );
  if (resolutionOption?.optionValues) {
    let highest = 0;
    for (const ov of resolutionOption.optionValues) {
      const val = parseResolutionValue(ov.name);
      if (val !== null && val > highest) highest = val;
    }
    if (highest > 0) return highest;
  }

  // Fallback: parse from R2 tags
  const label = getHighestResolutionLabelFromTags(product.tags);
  if (label) {
    const val = parseResolutionValue(label);
    if (val !== null) return val;
  }

  return 4; // default — all products have at least 4K
}

function applyPrintCollectionFilters<
  TProduct extends {
    tags: string[];
    selectedOrFirstAvailableVariant?: {price?: {amount?: string | null} | null} | null;
    priceRange?: {minVariantPrice?: {amount?: string | null} | null} | null;
  },
>(
  products: TProduct[],
  filterState: 'All' | 'Horizontal' | 'Vertical',
  mostPopularFilterState: 'All' | 'Most Popular Only',
  printsPriceFilterMax: number,
) {
  return products.filter((product) => {
    const matchesMostPopularFilter =
      mostPopularFilterState === 'All' ||
      product.tags.includes('most-popular');

    if (!matchesMostPopularFilter) return false;

    const matchesOrientation =
      filterState === 'Horizontal'
        ? product.tags.includes('horOnly') || product.tags.includes('horPrimary')
        : filterState === 'Vertical'
          ? product.tags.includes('vertOnly') ||
            product.tags.includes('vertPrimary')
          : product.tags.includes('horOnly') ||
            product.tags.includes('horPrimary') ||
            product.tags.includes('vertOnly') ||
            product.tags.includes('vertPrimary');
    if (!matchesOrientation) return false;

    const productPrice = getProductPriceAmount(product);
    if (productPrice !== null && productPrice > printsPriceFilterMax)
      return false;

    return true;
  });
}

function applyStockCollectionFilters<
  TProduct extends {
    tags: string[];
    options?: {name?: string; optionValues?: {name?: string}[]}[];
    selectedOrFirstAvailableVariant?: {price?: {amount?: string | null} | null} | null;
    priceRange?: {minVariantPrice?: {amount?: string | null} | null} | null;
  },
>(
  products: TProduct[],
  {
    stockFilterState,
    durationMinFilterIndex,
    durationMaxFilterIndex,
    durationAllSelected,
    resolutionFilterIndex,
    frameRateFilter,
    artistPickFilterState,
    priceFilterMax,
  }: {
    stockFilterState: 'All Clips' | 'Discounted Bundles';
    durationMinFilterIndex: number;
    durationMaxFilterIndex: number;
    durationAllSelected: boolean;
    resolutionFilterIndex: number;
    frameRateFilter: FrameRateFilter;
    artistPickFilterState: 'All' | "Artist's Pick Only";
    priceFilterMax: number;
  },
) {
  const durationMinNotch =
    DURATION_NOTCHES[durationMinFilterIndex] ??
    DURATION_NOTCHES[DEFAULT_DURATION_MIN_FILTER_INDEX];
  const durationMaxNotch =
    DURATION_NOTCHES[durationMaxFilterIndex] ??
    DURATION_NOTCHES[DEFAULT_DURATION_MAX_FILTER_INDEX];
  const minResolution = RESOLUTION_NOTCHES[resolutionFilterIndex]?.value ?? 4;

  return products.filter((product) => {
    const isBundleProduct = product.tags.includes('Bundle');
    const matchesArtistPickFilter =
      artistPickFilterState === 'All' ||
      product.tags.includes('a');

    if (!matchesArtistPickFilter) return false;

    if (stockFilterState === 'All Clips') {
      if (!(hasVideoTag(product.tags) && !isBundleProduct)) return false;
    } else if (stockFilterState === 'Discounted Bundles') {
      if (!isBundleProduct) return false;
    }

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
      } else {
        if (getTopLevelFrameTagValue(product.tags) !== frameRateFilter) {
          return false;
        }
      }
    }

    const productPrice = getProductPriceAmount(product);
    if (productPrice !== null && productPrice > priceFilterMax) return false;

    return true;
  });
}

function getFilteredCollectionSearchProducts({
  products,
  collectionHandle,
  collectionTitle,
  filterState,
  mostPopularFilterState,
  stockFilterState,
  printsPriceFilterMax,
  durationMinFilterIndex,
  durationMaxFilterIndex,
  durationAllSelected,
  resolutionFilterIndex,
  frameRateFilter,
  artistPickFilterState,
  stockPriceFilterMax,
}: {
  products: EnhancedPartialSearchResult[];
  collectionHandle?: string;
  collectionTitle?: string | null;
  filterState: 'All' | 'Horizontal' | 'Vertical';
  mostPopularFilterState: 'All' | 'Most Popular Only';
  stockFilterState: 'All Clips' | 'Discounted Bundles';
  printsPriceFilterMax: number;
  durationMinFilterIndex: number;
  durationMaxFilterIndex: number;
  durationAllSelected: boolean;
  resolutionFilterIndex: number;
  frameRateFilter: FrameRateFilter;
  artistPickFilterState: 'All' | "Artist's Pick Only";
  stockPriceFilterMax: number;
}) {
  const collectionName = capitalizeFirstLetter(collectionTitle ?? '');

  const filteredProducts = products.filter((product) =>
    product?.tags?.includes(collectionName),
  );
  const extraFilteredProducts =
    collectionHandle === 'stock'
      ? products.filter((product) => hasVideoTag(product?.tags))
      : [];
  const combinedProductSearches = [
    ...filteredProducts,
    ...extraFilteredProducts,
  ];

  if (collectionHandle === 'prints') {
    return applyPrintCollectionFilters(
      combinedProductSearches,
      filterState,
      mostPopularFilterState,
      printsPriceFilterMax,
    );
  }

  if (collectionHandle !== 'stock') {
    return combinedProductSearches;
  }

  return applyStockCollectionFilters(combinedProductSearches, {
    stockFilterState,
    durationMinFilterIndex,
    durationMaxFilterIndex,
    durationAllSelected,
    resolutionFilterIndex,
    frameRateFilter,
    artistPickFilterState,
    priceFilterMax: stockPriceFilterMax,
  });
}

export default function Collection() {
  const {collection, searchTerm, cart, wishlistProducts, isLoggedIn} =
    useLoaderData<typeof loader>();

  const [isPageReady, setIsPageReady] = useState(false);
  const hasCalledLoad = useRef(false);
  const headerImgRef = useRef<HTMLImageElement>(null);

  const handleHeaderLoad = useCallback(() => {
    if (hasCalledLoad.current) return;
    hasCalledLoad.current = true;
    setIsPageReady(true);
  }, []);

  // Catch cached images whose onLoad fired before React hydrated
  useEffect(() => {
    const img = headerImgRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      handleHeaderLoad();
    }
  }, [handleHeaderLoad]);

  const [searchParams] = useSearchParams();
  const currentSearchTerm = searchParams.get('q') || '';
  const [searchText, setSearchText] = useState<string | undefined>();

  // const isHorOnly = collection?.nodes?.map((p: any) =>
  //   p.tags.includes('horOnly'),
  // );
  // const isHorPrimary = collection?.nodes?.map((p: any) =>
  //   p.tags.includes('horPrimary'),
  // );

  // collection.products.nodes = isHorPrimary;
  // const isVertOnly = collection?.nodes?.map((p: any) =>
  //   p.tags.includes('vertOnly'),
  // );
  // const isVertPrimary = collection?.nodes?.map((p: any) =>
  //   p.tags.includes('vertPrimary'),
  // );

  // Add other queries here, so that they are loaded in parallel

  useEffect(() => {
    setSearchText('');
  }, [collection?.handle]);
  type PrintsFilterState = 'All' | 'Horizontal' | 'Vertical';
  type PrintsMostPopularFilterState = 'All' | 'Most Popular Only';
  type StockArtistPickFilterState = 'All' | "Artist's Pick Only";
  type StockFilterState = 'All Clips' | 'Discounted Bundles';

  const LAYOUT_STORAGE_KEY = 'collection-layout-mode';
  const PRINTS_FILTER_STORAGE_KEY = 'collection-prints-filter-mode';
  const PRINTS_MOST_POPULAR_FILTER_STORAGE_KEY =
    'collection-prints-most-popular-filter-mode';
  const PRINTS_PRICE_FILTER_STORAGE_KEY = 'collection-prints-price-filter-mode';
  const STOCK_FILTER_STORAGE_KEY = 'collection-stock-filter-mode';
  const STOCK_DURATION_MIN_FILTER_KEY = 'collection-stock-duration-min-filter';
  const STOCK_DURATION_MAX_FILTER_KEY = 'collection-stock-duration-max-filter';
  const STOCK_DURATION_ALL_FILTER_KEY = 'collection-stock-duration-all-filter';
  const STOCK_RESOLUTION_FILTER_KEY = 'collection-stock-resolution-filter';
  const STOCK_FRAME_RATE_FILTER_KEY = 'collection-stock-frame-rate-filter';
  const STOCK_ARTIST_PICK_FILTER_KEY = 'collection-stock-artist-pick-filter';
  const STOCK_PRICE_FILTER_KEY = 'collection-stock-price-filter';
  const [layout, setLayout] = useState('grid');
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
  ); // default: "Has 4K+"
  const [frameRateFilter, setFrameRateFilter] = useState<FrameRateFilter>(
    DEFAULT_FRAME_RATE_FILTER,
  ); // default: "all"
  const [artistPickFilterState, setArtistPickFilterState] =
    useState<StockArtistPickFilterState>('All');
  const [stockPriceFilterMax, setStockPriceFilterMax] =
    useState<number>(DEFAULT_STOCK_PRICE_FILTER_MAX);
  const [printsPriceFilterMax, setPrintsPriceFilterMax] =
    useState<number>(DEFAULT_PRINTS_PRICE_FILTER_MAX);
  const [hasInitializedLayout, setHasInitializedLayout] = useState(false);
  const [hasInitializedPrintsFilter, setHasInitializedPrintsFilter] =
    useState(false);
  const [hasInitializedStockFilter, setHasInitializedStockFilter] =
    useState(false);
  const [isCollectionFiltersPopoverOpen, setIsCollectionFiltersPopoverOpen] =
    useState(false);
  const setGridLayout = () => setLayout('grid');
  const setListLayout = () => setLayout('list');
  const gridViewTooltip = (
    <>
      Keyboard shortcut: <Kbd>=</Kbd>
    </>
  );
  const listViewTooltip = (
    <>
      Keyboard shortcut: <Kbd>-</Kbd>
    </>
  );

  useEffect(() => {
    try {
      const savedLayout = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
      if (savedLayout === 'grid' || savedLayout === 'list') {
        setLayout(savedLayout);
      }
    } catch {
      // Ignore storage access errors (private mode, etc.)
    } finally {
      setHasInitializedLayout(true);
    }
  }, []);

  useEffect(() => {
    if (!hasInitializedLayout) return;
    try {
      window.localStorage.setItem(LAYOUT_STORAGE_KEY, layout);
    } catch {
      // Ignore storage access errors (private mode, etc.)
    }
  }, [hasInitializedLayout, layout]);

  const isPrintsListLayout =
    collection?.handle === 'prints' && layout === 'list';
  const isStockListLayout = collection?.handle === 'stock' && layout === 'list';
  const isPrintsGridLayout =
    collection?.handle === 'prints' && layout === 'grid';
  const isStockGridLayout = collection?.handle === 'stock' && layout === 'grid';
  const layoutClassName =
    layout === 'grid'
      ? 'prods-grid gap-x-2'
      : isPrintsListLayout
        ? 'mt-[10px] mx-[10px] grid print-list-grid gap-2'
        : isStockListLayout
          ? 'mt-[10px] mx-[10px] grid eproduct-list-grid gap-2'
          : 'mt-[12px] grid';

  type ShopifyImage = {url: string; altText: string};
  const queriesDatalistId = useId();
  const [filterState, setFilterState] = useState<PrintsFilterState>('All');
  const [mostPopularFilterState, setMostPopularFilterState] =
    useState<PrintsMostPopularFilterState>('All');
  const [stockFilterState, setStockFilterState] =
    useState<StockFilterState>('All Clips');
  const [productState, setProductState] = useState(collection?.products);
  const searchFetcher = useFetcher<PredictiveSearchReturn>({key: 'search'});
  const [committedSearchProducts, setCommittedSearchProducts] = useState<
    EnhancedPartialSearchResult[] | null
  >(null);
  const activeSearchText = searchText ?? '';
  const hasActiveSearchText = activeSearchText.length > 0;
  const predictiveProducts = useMemo(
    () =>
      getFilteredCollectionSearchProducts({
        products: (searchFetcher.data?.type === 'predictive'
          ? searchFetcher.data.result.items.products
          : []) as EnhancedPartialSearchResult[],
        collectionHandle: collection?.handle,
        collectionTitle: collection?.title,
        filterState,
        mostPopularFilterState,
        stockFilterState,
        printsPriceFilterMax,
        durationMinFilterIndex,
        durationMaxFilterIndex,
        durationAllSelected,
        resolutionFilterIndex,
        frameRateFilter,
        artistPickFilterState,
        stockPriceFilterMax,
      }),
    [
      searchFetcher.data,
      collection?.handle,
      collection?.title,
      filterState,
      mostPopularFilterState,
      stockFilterState,
      printsPriceFilterMax,
      durationMinFilterIndex,
      durationMaxFilterIndex,
      durationAllSelected,
      resolutionFilterIndex,
      frameRateFilter,
      artistPickFilterState,
      stockPriceFilterMax,
    ],
  );
  const predictiveQueries =
    searchFetcher.data?.type === 'predictive'
      ? searchFetcher.data.result.items.queries
      : [];
  const baseProductCount = productState?.nodes?.length ?? 0;
  const displayedSearchProducts =
    hasActiveSearchText && committedSearchProducts
      ? committedSearchProducts
      : ((productState?.nodes ??
          []) as unknown as EnhancedPartialSearchResult[]);
  const displayedProductCount = hasActiveSearchText
    ? (committedSearchProducts?.length ?? baseProductCount)
    : baseProductCount;
  const promoBannerItems =
    collection?.handle === 'prints'
      ? [
          'Get 15% off when you purchase 3 prints',
          'Free Shipping on orders over $300',
          'Sign up for email + SMS for a one time discount code',
        ]
      : collection?.handle === 'stock'
        ? [
            'Get 15% off when you purchase 4 stock footage clips',
            'Free Shipping on orders over $300',
            'Sign up for email + SMS for a one time discount code',
          ]
        : null;

  useEffect(() => {
    if (collection?.handle !== 'prints') {
      setHasInitializedPrintsFilter(false);
      return;
    }

    try {
      const savedPrintsFilter = window.localStorage.getItem(
        PRINTS_FILTER_STORAGE_KEY,
      );
      if (
        savedPrintsFilter === 'All' ||
        savedPrintsFilter === 'Horizontal' ||
        savedPrintsFilter === 'Vertical'
      ) {
        setFilterState(savedPrintsFilter);
      } else {
        setFilterState('All');
      }

      const savedMostPopularFilter = window.localStorage.getItem(
        PRINTS_MOST_POPULAR_FILTER_STORAGE_KEY,
      );
      if (
        savedMostPopularFilter === 'All' ||
        savedMostPopularFilter === 'Most Popular Only'
      ) {
        setMostPopularFilterState(savedMostPopularFilter);
      } else {
        setMostPopularFilterState('All');
      }

      const savedPrintsPriceFilter = window.localStorage.getItem(
        PRINTS_PRICE_FILTER_STORAGE_KEY,
      );
      if (savedPrintsPriceFilter !== null) {
        const parsedPrintsPriceFilter = Number.parseInt(
          savedPrintsPriceFilter,
          10,
        );
        if (Number.isFinite(parsedPrintsPriceFilter)) {
          setPrintsPriceFilterMax(
            Math.min(
              PRINTS_PRICE_FILTER_MAX,
              Math.max(PRICE_FILTER_MIN, parsedPrintsPriceFilter),
            ),
          );
        }
      }
    } catch {
      setFilterState('All');
      setMostPopularFilterState('All');
      setPrintsPriceFilterMax(DEFAULT_PRINTS_PRICE_FILTER_MAX);
    } finally {
      setHasInitializedPrintsFilter(true);
    }
  }, [collection?.handle]);

  useEffect(() => {
    if (collection?.handle !== 'prints' || !hasInitializedPrintsFilter) return;
    try {
      window.localStorage.setItem(PRINTS_FILTER_STORAGE_KEY, filterState);
      window.localStorage.setItem(
        PRINTS_MOST_POPULAR_FILTER_STORAGE_KEY,
        mostPopularFilterState,
      );
      window.localStorage.setItem(
        PRINTS_PRICE_FILTER_STORAGE_KEY,
        String(printsPriceFilterMax),
      );
    } catch {
      // Ignore storage access errors (private mode, etc.)
    }
  }, [
    collection?.handle,
    filterState,
    mostPopularFilterState,
    printsPriceFilterMax,
    hasInitializedPrintsFilter,
  ]);

  useEffect(() => {
    if (collection?.handle !== 'stock') {
      setHasInitializedStockFilter(false);
      return;
    }

    try {
      const savedStockFilter = window.localStorage.getItem(
        STOCK_FILTER_STORAGE_KEY,
      );
      if (
        savedStockFilter === 'All Clips' ||
        savedStockFilter === 'Discounted Bundles'
      ) {
        setStockFilterState(savedStockFilter);
      } else {
        setStockFilterState('All Clips');
      }
    } catch {
      setStockFilterState('All Clips');
    } finally {
      setHasInitializedStockFilter(true);
    }
  }, [collection?.handle]);

  useEffect(() => {
    if (collection?.handle !== 'stock' || !hasInitializedStockFilter) return;
    try {
      window.localStorage.setItem(STOCK_FILTER_STORAGE_KEY, stockFilterState);
    } catch {
      // Ignore storage access errors (private mode, etc.)
    }
  }, [collection?.handle, stockFilterState, hasInitializedStockFilter]);

  // Restore duration/resolution/frame-rate filter from localStorage on stock pages
  useEffect(() => {
    if (collection?.handle !== 'stock') return;
    try {
      const savedDurationAll = window.localStorage.getItem(
        STOCK_DURATION_ALL_FILTER_KEY,
      );
      if (savedDurationAll === 'true' || savedDurationAll === 'false') {
        setDurationAllSelected(savedDurationAll === 'true');
      }

      const savedDurationMin = window.localStorage.getItem(
        STOCK_DURATION_MIN_FILTER_KEY,
      );
      const savedDurationMax = window.localStorage.getItem(
        STOCK_DURATION_MAX_FILTER_KEY,
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
        STOCK_RESOLUTION_FILTER_KEY,
      );
      if (savedResolution !== null) {
        const idx = Number(savedResolution);
        if (idx >= 0 && idx < RESOLUTION_NOTCHES.length) {
          setResolutionFilterIndex(idx);
        }
      }
      const savedFrameRate = window.localStorage.getItem(
        STOCK_FRAME_RATE_FILTER_KEY,
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
      const savedArtistPickFilter = window.localStorage.getItem(
        STOCK_ARTIST_PICK_FILTER_KEY,
      );
      if (
        savedArtistPickFilter === 'All' ||
        savedArtistPickFilter === "Artist's Pick Only"
      ) {
        setArtistPickFilterState(savedArtistPickFilter);
      }
      const savedPriceFilter = window.localStorage.getItem(
        STOCK_PRICE_FILTER_KEY,
      );
      if (savedPriceFilter !== null) {
        const parsedPriceFilter = Number.parseInt(savedPriceFilter, 10);
        if (Number.isFinite(parsedPriceFilter)) {
          setStockPriceFilterMax(
            Math.min(
              STOCK_PRICE_FILTER_MAX,
              Math.max(PRICE_FILTER_MIN, parsedPriceFilter),
            ),
          );
        }
      }
    } catch {
      // Ignore storage access errors
    }
  }, [collection?.handle]);

  // Persist duration/resolution/frame-rate/artist-pick filters to localStorage
  useEffect(() => {
    if (collection?.handle !== 'stock') return;
    try {
      window.localStorage.setItem(
        STOCK_DURATION_MIN_FILTER_KEY,
        String(durationMinFilterIndex),
      );
      window.localStorage.setItem(
        STOCK_DURATION_MAX_FILTER_KEY,
        String(durationMaxFilterIndex),
      );
      window.localStorage.setItem(
        STOCK_DURATION_ALL_FILTER_KEY,
        String(durationAllSelected),
      );
      window.localStorage.setItem(
        STOCK_RESOLUTION_FILTER_KEY,
        String(resolutionFilterIndex),
      );
      window.localStorage.setItem(STOCK_FRAME_RATE_FILTER_KEY, frameRateFilter);
      window.localStorage.setItem(
        STOCK_ARTIST_PICK_FILTER_KEY,
        artistPickFilterState,
      );
      window.localStorage.setItem(
        STOCK_PRICE_FILTER_KEY,
        String(stockPriceFilterMax),
      );
    } catch {
      // Ignore storage access errors
    }
  }, [
    collection?.handle,
    durationMinFilterIndex,
    durationMaxFilterIndex,
    durationAllSelected,
    resolutionFilterIndex,
    frameRateFilter,
    artistPickFilterState,
    stockPriceFilterMax,
  ]);

  useEffect(() => {
    return () => {
      try {
        window.localStorage.removeItem(PRINTS_FILTER_STORAGE_KEY);
        window.localStorage.removeItem(
          PRINTS_MOST_POPULAR_FILTER_STORAGE_KEY,
        );
        window.localStorage.removeItem(PRINTS_PRICE_FILTER_STORAGE_KEY);
        window.localStorage.removeItem(STOCK_DURATION_MIN_FILTER_KEY);
        window.localStorage.removeItem(STOCK_DURATION_MAX_FILTER_KEY);
        window.localStorage.removeItem(STOCK_DURATION_ALL_FILTER_KEY);
        window.localStorage.removeItem(STOCK_RESOLUTION_FILTER_KEY);
        window.localStorage.removeItem(STOCK_FRAME_RATE_FILTER_KEY);
        window.localStorage.removeItem(STOCK_ARTIST_PICK_FILTER_KEY);
        window.localStorage.removeItem(STOCK_PRICE_FILTER_KEY);
      } catch {
        // Ignore storage access errors (private mode, etc.)
      }
    };
  }, []);

  useEffect(() => {
    const baseConnection = collection?.products;
    if (!baseConnection) return;

    let filteredCollection = baseConnection.nodes;

    if (collection?.handle === 'prints') {
      filteredCollection = applyPrintCollectionFilters(
        baseConnection.nodes as Array<{tags: string[]}>,
        filterState,
        mostPopularFilterState,
        printsPriceFilterMax,
      );
    }

    if (collection?.handle === 'stock') {
      filteredCollection = applyStockCollectionFilters(
        baseConnection.nodes as Array<{
          tags: string[];
          options?: {name?: string; optionValues?: {name?: string}[]}[];
        }>,
        {
          stockFilterState,
          durationMinFilterIndex,
          durationMaxFilterIndex,
          durationAllSelected,
          resolutionFilterIndex,
          frameRateFilter,
          artistPickFilterState,
          priceFilterMax: stockPriceFilterMax,
        },
      );
    }

    setProductState({
      ...baseConnection,
      nodes: filteredCollection,
    });
  }, [
    collection?.handle,
    collection?.products,
    filterState,
    mostPopularFilterState,
    printsPriceFilterMax,
    stockFilterState,
    durationMinFilterIndex,
    durationMaxFilterIndex,
    durationAllSelected,
    resolutionFilterIndex,
    frameRateFilter,
    artistPickFilterState,
    stockPriceFilterMax,
  ]);

  useEffect(() => {
    if (!hasActiveSearchText) {
      setCommittedSearchProducts(null);
      return;
    }

    if (searchFetcher.state !== 'idle') return;
    if (searchFetcher.data?.type !== 'predictive') return;
    if (searchFetcher.data.term !== activeSearchText) return;

    setCommittedSearchProducts(predictiveProducts);
  }, [
    hasActiveSearchText,
    activeSearchText,
    searchFetcher.state,
    searchFetcher.data,
    predictiveProducts,
  ]);

  const [windowWidth, setWindowWidth] = useState<number | undefined>(() =>
    typeof window === 'undefined' ? undefined : window.innerWidth,
  );
  const gridColumnCount =
    windowWidth != undefined
      ? Math.max(1, Math.floor((windowWidth - 1) / 700) + 1)
      : 1;
  const productsContainerStyle =
    (isPrintsGridLayout || isStockGridLayout) &&
    layout === 'grid' &&
    windowWidth != undefined
      ? {gridTemplateColumns: `repeat(${gridColumnCount}, minmax(0, 1fr))`}
      : undefined;
  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const isSupportedCollection =
      collection?.handle === 'prints' || collection?.handle === 'stock';
    if (!isSupportedCollection) return;

    const handleViewShortcut = (event: KeyboardEvent) => {
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

      if (
        event.key === '-' ||
        event.key === '_' ||
        event.code === 'NumpadSubtract'
      ) {
        event.preventDefault();
        setListLayout();
        return;
      }

      if (
        event.key === '=' ||
        event.key === '+' ||
        event.code === 'NumpadAdd'
      ) {
        event.preventDefault();
        setGridLayout();
        return;
      }

      const key = event.key.toLowerCase();

      if (key === 'f') {
        event.preventDefault();
        setIsCollectionFiltersPopoverOpen((isOpen) => !isOpen);
        return;
      }

      if (collection?.handle === 'stock') {
        if (key === 'a') {
          event.preventDefault();
          setStockFilterState('All Clips');
          return;
        }

        if (key === 'd') {
          event.preventDefault();
          setStockFilterState('Discounted Bundles');
          return;
        }

        if (key === 'r') {
          event.preventDefault();
          setDurationMinFilterIndex(DEFAULT_DURATION_MIN_FILTER_INDEX);
          setDurationMaxFilterIndex(DEFAULT_DURATION_MAX_FILTER_INDEX);
          setDurationAllSelected(DEFAULT_DURATION_ALL_FILTER);
          setResolutionFilterIndex(DEFAULT_RESOLUTION_FILTER_INDEX);
          setFrameRateFilter(DEFAULT_FRAME_RATE_FILTER);
          setArtistPickFilterState('All');
          setStockPriceFilterMax(DEFAULT_STOCK_PRICE_FILTER_MAX);
          return;
        }
      }

      if (collection?.handle === 'prints') {
        if (key === 'a') {
          event.preventDefault();
          setFilterState('All');
          return;
        }

        if (key === 'h') {
          event.preventDefault();
          setFilterState('Horizontal');
          return;
        }

        if (key === 'v') {
          event.preventDefault();
          setFilterState('Vertical');
          return;
        }

        if (key === 'r') {
          event.preventDefault();
          setFilterState('All');
          setMostPopularFilterState('All');
          setPrintsPriceFilterMax(DEFAULT_PRINTS_PRICE_FILTER_MAX);
        }
      }
    };

    window.addEventListener('keydown', handleViewShortcut);
    return () => window.removeEventListener('keydown', handleViewShortcut);
  }, [collection?.handle]);

  return (
    <SkeletonGate isReady={isPageReady} skeleton={<CollectionPageSkeleton />}>
      <div className="overflow-x-hidden">
        {promoBannerItems && <MarqueeBanner items={promoBannerItems} />}
        {collection?.handle === 'prints' && (
          <ProductsHeader onLoad={handleHeaderLoad} imgRef={headerImgRef} />
        )}
        {collection?.handle === 'stock' && (
          <EProductsHeader onLoad={handleHeaderLoad} imgRef={headerImgRef} />
        )}

        {collection?.handle === 'stock' && (
          <div className="flex justify-center pt-2">
            <div className="toggle-container">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={`toggle-option ${stockFilterState === 'All Clips' ? 'selected' : ''}`}
                    onClick={() => setStockFilterState('All Clips')}
                  >
                    All Clips
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Keyboard shortcut: <Kbd>a</Kbd>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={`toggle-option ${stockFilterState === 'Discounted Bundles' ? 'selected' : ''}`}
                    onClick={() => setStockFilterState('Discounted Bundles')}
                  >
                    Discounted Bundles
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Keyboard shortcut: <Kbd>d</Kbd>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        )}
        {windowWidth != undefined && windowWidth > 600 && (
          <div className="counter-search-toggle-container ">
            <div className="product-counter-filter-group">
              <div className="product-counter-container">
                <div className="flex flex-col items-end">
                  <h4 className="font-medium text-md">
                    {displayedProductCount} product
                    {displayedProductCount > 1 && 's'}
                  </h4>
                </div>
              </div>
              {collection?.handle === 'stock' && (
                <StockFiltersPopover
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
                  artistPickFilterState={artistPickFilterState}
                  setArtistPickFilterState={setArtistPickFilterState}
                  priceFilterMax={stockPriceFilterMax}
                  setPriceFilterMax={setStockPriceFilterMax}
                  open={isCollectionFiltersPopoverOpen}
                  onOpenChange={setIsCollectionFiltersPopoverOpen}
                />
              )}
              {collection?.handle === 'prints' && (
                <PrintsFiltersPopover
                  filterState={filterState}
                  setFilterState={setFilterState}
                  mostPopularFilterState={mostPopularFilterState}
                  setMostPopularFilterState={setMostPopularFilterState}
                  printsPriceFilterMax={printsPriceFilterMax}
                  setPrintsPriceFilterMax={setPrintsPriceFilterMax}
                  open={isCollectionFiltersPopoverOpen}
                  onOpenChange={setIsCollectionFiltersPopoverOpen}
                />
              )}
            </div>
            <div className="search-product-container">
              <div className="flex flex-col items-center">
                <SearchFormPredictive>
                  {({fetchResults, inputRef}) => {
                    const handleInput = (
                      e: React.ChangeEvent<HTMLInputElement>,
                    ) => {
                      setSearchText(e.target.value);
                      fetchResults(e);
                    };

                    return (
                      <div className="desktop-search-stack flex flex-col items-center">
                        <InputGroup className="w-[284px] has-[[data-slot=input-group-control]:focus-visible]:border-primary has-[[data-slot=input-group-control]:focus-visible]:ring-primary/50">
                          <InputGroupAddon align="inline-start">
                            <LuSearch className="text-muted-foreground" />
                          </InputGroupAddon>
                          <InputGroupInput
                            name="q"
                            onChange={handleInput}
                            onFocus={handleInput}
                            placeholder="Search..."
                            ref={inputRef}
                            type="search"
                            value={searchText ?? ''}
                            list={queriesDatalistId}
                          />
                          {searchText && (
                            <InputGroupAddon align="inline-end">
                              <span className="text-muted-foreground text-xs whitespace-nowrap">
                                {displayedProductCount} result
                                {displayedProductCount !== 1 ? 's' : ''}
                              </span>
                            </InputGroupAddon>
                          )}
                        </InputGroup>
                        {collection?.handle === 'stock' ? (
                          <RandomizedSearchHint
                            words={EPRODUCT_SEARCH_HINT_WORDS}
                            storageKey="search-hint-stock"
                            className="desktop-search-hint text-muted-foreground text-[11px] w-[284px] text-left pl-9"
                          />
                        ) : collection?.handle === 'prints' ? (
                          <RandomizedSearchHint
                            words={PRINT_SEARCH_HINT_WORDS}
                            storageKey="search-hint-prints"
                            className="desktop-search-hint text-muted-foreground text-[11px] w-[284px] text-left pl-9"
                          />
                        ) : (
                          <p className="desktop-search-hint text-muted-foreground text-[11px] w-[284px] text-left pl-9">
                            Try &ldquo;Sea Lion&rdquo; or &ldquo;Fish&rdquo;
                          </p>
                        )}
                      </div>
                    );
                  }}
                </SearchFormPredictive>
              </div>
            </div>

            <div className="grid-list-toggle-container flex gap-x-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={
                      layout === 'list'
                        ? 'bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2 rounded-md'
                        : 'hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 rounded-md cursor-pointer'
                    }
                    onClick={() => {
                      if (layout !== 'list') {
                        setListLayout();
                      }
                    }}
                  >
                    <LuZoomOut />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">{listViewTooltip}</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={
                      layout === 'grid'
                        ? 'bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2 rounded-md'
                        : 'hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 rounded-md cursor-pointer'
                    }
                    onClick={() => {
                      if (layout !== 'grid') {
                        setGridLayout();
                      }
                    }}
                  >
                    <LuZoomIn />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">{gridViewTooltip}</TooltipContent>
              </Tooltip>
            </div>
          </div>
        )}
        {windowWidth != undefined && windowWidth <= 600 && (
          <>
            <div className="counter-search-toggle-container">
              <div className="top-row mb-2">
                <div className="search-center">
                  <div className="search-product-container">
                    <div className="flex flex-col items-center mt-[8px]">
                      <SearchFormPredictive>
                        {({fetchResults, inputRef}) => {
                          const handleInput = (
                            e: React.ChangeEvent<HTMLInputElement>,
                          ) => {
                            setSearchText(e.target.value);
                            fetchResults(e);
                          };

                          return (
                            <div className="flex flex-col items-center">
                              <InputGroup className="w-[300px] has-[[data-slot=input-group-control]:focus-visible]:border-primary has-[[data-slot=input-group-control]:focus-visible]:ring-primary/50">
                                <InputGroupAddon align="inline-start">
                                  <LuSearch className="text-muted-foreground" />
                                </InputGroupAddon>
                                <InputGroupInput
                                  name="q"
                                  onChange={handleInput}
                                  onFocus={handleInput}
                                  placeholder="Search..."
                                  ref={inputRef}
                                  type="search"
                                  value={searchText ?? ''}
                                  list={queriesDatalistId}
                                />
                                {searchText && (
                                  <InputGroupAddon align="inline-end">
                                    <span className="text-muted-foreground text-xs whitespace-nowrap">
                                      {displayedProductCount} result
                                      {displayedProductCount !== 1 ? 's' : ''}
                                    </span>
                                  </InputGroupAddon>
                                )}
                              </InputGroup>
                              {collection?.handle === 'stock' ? (
                                <RandomizedSearchHint
                                  words={EPRODUCT_SEARCH_HINT_WORDS}
                                  storageKey="search-hint-stock"
                                  className="text-muted-foreground text-[11px] mt-1.5 w-[300px] text-left pl-9"
                                />
                              ) : collection?.handle === 'prints' ? (
                                <RandomizedSearchHint
                                  words={PRINT_SEARCH_HINT_WORDS}
                                  storageKey="search-hint-prints"
                                  className="text-muted-foreground text-[11px] mt-1.5 w-[300px] text-left pl-9"
                                />
                              ) : (
                                <p className="text-muted-foreground text-[11px] mt-1.5 w-[300px] text-left pl-9">
                                  Try &ldquo;Sea Lion&rdquo; or
                                  &ldquo;Fish&rdquo;
                                </p>
                              )}
                            </div>
                          );
                        }}
                      </SearchFormPredictive>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bottom-row">
                <div className="product-count flex items-center gap-2">
                  <div className="product-counter-container">
                    <div className="flex flex-col items-end">
                      <h4 className="font-medium text-md">
                        {displayedProductCount} product
                        {displayedProductCount > 1 && 's'}
                      </h4>
                    </div>
                  </div>
                  {collection?.handle === 'stock' && (
                    <StockFiltersPopover
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
                      artistPickFilterState={artistPickFilterState}
                      setArtistPickFilterState={setArtistPickFilterState}
                      priceFilterMax={stockPriceFilterMax}
                      setPriceFilterMax={setStockPriceFilterMax}
                      open={isCollectionFiltersPopoverOpen}
                      onOpenChange={setIsCollectionFiltersPopoverOpen}
                    />
                  )}
                  {collection?.handle === 'prints' && (
                    <PrintsFiltersPopover
                      filterState={filterState}
                      setFilterState={setFilterState}
                      mostPopularFilterState={mostPopularFilterState}
                      setMostPopularFilterState={setMostPopularFilterState}
                      printsPriceFilterMax={printsPriceFilterMax}
                      setPrintsPriceFilterMax={setPrintsPriceFilterMax}
                      open={isCollectionFiltersPopoverOpen}
                      onOpenChange={setIsCollectionFiltersPopoverOpen}
                    />
                  )}
                </div>
                <div className="layout-toggle">
                  <div className="grid-list-toggle-container flex gap-x-4">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className={
                            layout === 'list'
                              ? 'bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2 rounded-md'
                              : 'hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 rounded-md cursor-pointer'
                          }
                          onClick={() => {
                            if (layout !== 'list') {
                              setListLayout();
                            }
                          }}
                        >
                          <LuZoomOut />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        {listViewTooltip}
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className={
                            layout === 'grid'
                              ? 'bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2 rounded-md'
                              : 'hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 rounded-md cursor-pointer'
                          }
                          onClick={() => {
                            if (layout !== 'grid') {
                              setGridLayout();
                            }
                          }}
                        >
                          <LuZoomIn />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        {gridViewTooltip}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        <Separator className="mt-4" />
        {searchText && (
          <>
            <SearchResultsPredictive.Queries
              queries={predictiveQueries}
              queriesDatalistId={queriesDatalistId}
            />
            {committedSearchProducts && committedSearchProducts.length === 0 ? (
              <div className="flex justify-center px-4 py-6 text-center">
                <SearchResultsPredictive.Empty
                  term={{current: activeSearchText}}
                />
              </div>
            ) : (
              <div
                className={`${layoutClassName} collection-results-surface ${
                  collection?.handle === 'prints'
                    ? 'prints-collection-results-surface'
                    : ''
                }`.trim()}
                style={productsContainerStyle}
              >
                <SearchResultsPredictive.Products
                  products={displayedSearchProducts}
                  layout={layout}
                  term={{current: activeSearchText}}
                  collectionHandle={collection?.handle}
                  cart={cart}
                  wishlistProducts={wishlistProducts as string[]}
                  isLoggedIn={isLoggedIn}
                />
              </div>
            )}
          </>
        )}
        {!searchText && (
          <div
            className={`${layoutClassName} collection-results-surface ${
              collection?.handle === 'prints'
                ? 'prints-collection-results-surface'
                : ''
            }`.trim()}
            style={productsContainerStyle}
          >
            <PaginatedResourceSection
              connection={productState}
              resourcesClassName="products-grid"
            >
              {({
                node: product,
                index,
              }: {
                node: ProductItemFragment & {
                  images: {nodes: ShopifyImage[]};
                  descriptionHtml?: string;
                };
                index: number;
              }) => {
                const isInWishlist = wishlistProducts?.includes(
                  product?.id,
                ) as boolean;

                return (
                  <>
                    {collection?.handle === 'prints' && (
                      <ProductCarousel
                        key={product.id}
                        product={product}
                        layout={layout}
                        isInWishlist={isInWishlist}
                        isLoggedIn={isLoggedIn}
                      />
                    )}
                    {collection?.handle === 'stock' && (
                      <EProductsContainer
                        key={product.id}
                        product={product}
                        layout={layout}
                        cart={cart}
                        isInWishlist={isInWishlist}
                        isLoggedIn={isLoggedIn}
                      />
                    )}
                  </>
                );
              }}
            </PaginatedResourceSection>
          </div>
        )}
        <Analytics.CollectionView
          data={{
            collection: {
              id: collection?.id,
              handle: collection?.handle,
            },
          }}
        />
        {/* {collection?.handle === 'stock' && <RecommendedProducts
        products={data?.recommendedProducts}
        isLoggedIn={data.isLoggedIn}
      />} */}
        {/* add recommendedproducts to bottom of stock footage page */}
      </div>
    </SkeletonGate>
  );
}

const PRODUCT_ITEM_FRAGMENT = `#graphql
  fragment MoneyProductItem on MoneyV2 {
    amount
    currencyCode
  }
  fragment ProductItem on Product {
    id
    handle
    title
    tags
    descriptionHtml
    featuredImage {
      id
      altText
      url
      width
      height
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
  }
` as const;

// NOTE: https://shopify.dev/docs/api/storefront/2022-04/objects/collection
const COLLECTION_QUERY = `#graphql
  ${PRODUCT_ITEM_FRAGMENT}
  query Collection(
    $handle: String!
    $country: CountryCode
    $language: LanguageCode
    $first: Int
    $last: Int
    $startCursor: String
    $endCursor: String
    $filter: [ProductFilter!]
  ) @inContext(country: $country, language: $language) {
    collection(handle: $handle) {
      id
      handle
      title
      description
      image {
        url
        altText
        width
        height
      }
      products(
        first: $first,
        last: $last,
        before: $startCursor,
        after: $endCursor,
        filters: $filter
      ) {
        nodes {
          ...ProductItem
          descriptionHtml
        }
        pageInfo {
          hasPreviousPage
          hasNextPage
          endCursor
          startCursor
        }
      }
    }
  }

  
` as const;

const STOCK_PRODUCTS_FALLBACK_QUERY = `#graphql
  ${PRODUCT_ITEM_FRAGMENT}
  query StockProductsFallback(
    $country: CountryCode
    $language: LanguageCode
    $first: Int = 250
  ) @inContext(country: $country, language: $language) {
    products(first: $first, sortKey: UPDATED_AT, reverse: true) {
      nodes {
        ...ProductItem
        descriptionHtml
      }
    }
  }
` as const;
// tack on selectedvariants even if theres none
