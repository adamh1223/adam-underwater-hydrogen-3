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
import {Popover, PopoverTrigger, PopoverContent} from '~/components/ui/popover';
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '~/components/ui/tooltip';
import {CUSTOMER_WISHLIST} from '~/lib/customerQueries';
import RecommendedProducts from '~/components/products/recommendedProducts';
import CollectionPageSkeleton from '~/components/skeletons/CollectionPageSkeleton';
import {SkeletonGate} from '~/components/skeletons/shared';
import {ToggleGroup, ToggleGroupItem} from '~/components/ui/toggle-group';
import {DEFAULT_LINK_PREVIEW_ICON} from '~/lib/linkPreview';

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
    collection?.description?.trim() ||
    'Explore Adam Underwater collections.';
  const canonicalUrl =
    data?.currentShareUrl ??
    data?.canonicalCollectionUrl ??
    'https://adamunderwater.com/collections';

  return [
    {title},
    {name: 'title', content: title},
    {name: 'description', content: description},
    {
      tagName: 'link',
      rel: 'canonical',
      href: canonicalUrl,
    },
    {property: 'og:type', content: 'website'},
    {property: 'og:title', content: title},
    {property: 'og:description', content: description},
    {property: 'og:url', content: canonicalUrl},
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
  const {handle} = params;
  const {storefront, cart} = context;

  const url = new URL(request.url);
  const searchTerm = url.searchParams.get('q')?.trim() || '';
  const paginationVariables = getPaginationVariables(request, {
    pageBy: 250,
  });

  if (!handle) {
    throw redirect('/collections');
  }
  const filters: {tag?: string; query?: string}[] = [];
  if (searchTerm) {
    filters.push({tag: searchTerm});
  }

  const [{collection}] = await Promise.all([
    storefront.query(COLLECTION_QUERY, {
      variables: {
        handle,
        ...paginationVariables,
        filter: filters.length ? filters : undefined,
      },
      // Add other queries here, so that they are loaded in parallel
    }),
  ]);

  if (!collection) {
    throw new Response(`Collection ${handle} not found`, {
      status: 404,
    });
  }

  if (Array.isArray(collection?.products?.nodes)) {
    collection.products.nodes = applyHighestResolutionVariantToProducts(
      collection.products.nodes as any[],
    );
  }

  return {
    collection,
    searchTerm,
    cart: cart.get(),
    canonicalCollectionUrl: `${url.origin}/collections/${handle}`,
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

const DURATION_NOTCHES = [
  {value: 10, label: '10'},
  {value: 20, label: '20'},
  {value: 30, label: '30'},
  {value: 40, label: '40'},
  {value: 50, label: '50'},
  {value: Infinity, label: 'All'},
];

const RESOLUTION_NOTCHES = [
  {value: 4, label: '4K+'},
  {value: 5, label: '5K+'},
  {value: 6, label: '6K+'},
  {value: 8, label: '8K+'},
];

const DEFAULT_DURATION_FILTER_INDEX = DURATION_NOTCHES.length - 1;
const DEFAULT_RESOLUTION_FILTER_INDEX = 0;
const bundleDurationRegex = /^d(\d+)-(.+)$/i;
const bundleResolutionRegex = /^res(\d+)-(.+)$/i;
const bundleFrameRegex = /^frame(\d+)-(.+)$/i;

type FrameRateFilter = 'all' | '24fps' | 'slowmo';
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
          onMouseEnter: chainMouseHandler(
            children.props.onMouseEnter,
            () => setOpen(true),
          ),
          onMouseLeave: chainMouseHandler(
            children.props.onMouseLeave,
            () => setOpen(false),
          ),
          onPointerDown: chainMouseHandler(
            children.props.onPointerDown,
            () => setOpen(false),
          ),
          onClick: chainMouseHandler(children.props.onClick, () => setOpen(false)),
          onBlur: chainMouseHandler(children.props.onBlur, () => setOpen(false)),
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
        src={'https://downloads.adamunderwater.com/store-1-au/public/filter.png'}
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

function PrintsFiltersPopover({
  filterState,
  setFilterState,
}: {
  filterState: 'All' | 'Horizontal' | 'Vertical';
  setFilterState: (value: 'All' | 'Horizontal' | 'Vertical') => void;
}) {
  const isFiltered = filterState !== 'All';
  const handleReset = () => setFilterState('All');

  return (
    <Tooltip>
      <Popover>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <CollectionFilterIconButton
              isFiltered={isFiltered}
              ariaLabel="Filter print products"
            />
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" className="z-[1001]">
          Filter Products
        </TooltipContent>
        <PopoverContent
          align="start"
          sideOffset={8}
          className="z-[1000] w-80 p-4"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <div className="space-y-4">
            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-foreground">
                  Orientation
                </p>
                <HoverOnlyTooltip content="Reset Filters - shortcut: r">
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
                      content={`Keyboard shortcut: ${value === 'All' ? 'a' : value === 'Horizontal' ? 'h' : 'v'}`}
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
          </div>
        </PopoverContent>
      </Popover>
    </Tooltip>
  );
}

function StockFiltersPopover({
  durationFilterIndex,
  setDurationFilterIndex,
  resolutionFilterIndex,
  setResolutionFilterIndex,
  frameRateFilter,
  setFrameRateFilter,
}: {
  durationFilterIndex: number;
  setDurationFilterIndex: (v: number) => void;
  resolutionFilterIndex: number;
  setResolutionFilterIndex: (v: number) => void;
  frameRateFilter: FrameRateFilter;
  setFrameRateFilter: (v: FrameRateFilter) => void;
}) {
  const isFiltered =
    durationFilterIndex !== DEFAULT_DURATION_FILTER_INDEX ||
    resolutionFilterIndex !== DEFAULT_RESOLUTION_FILTER_INDEX ||
    frameRateFilter !== DEFAULT_FRAME_RATE_FILTER;

  const handleReset = () => {
    setDurationFilterIndex(DEFAULT_DURATION_FILTER_INDEX);
    setResolutionFilterIndex(DEFAULT_RESOLUTION_FILTER_INDEX);
    setFrameRateFilter(DEFAULT_FRAME_RATE_FILTER);
  };

  return (
    <Tooltip>
      <Popover>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <CollectionFilterIconButton
              isFiltered={isFiltered}
              ariaLabel="Filter stock footage"
            />
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" className="z-[1001]">
          Filter Products
        </TooltipContent>
        <PopoverContent
          align="start"
          sideOffset={8}
          className="z-[1000] w-80 pt-2.5 px-3.5 pb-3.5"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <div className="space-y-4">
          <NotchedSlider
            label="Duration (seconds)"
            notches={DURATION_NOTCHES}
            value={durationFilterIndex}
            onChange={setDurationFilterIndex}
            headerContent={
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-foreground">
                  Duration (seconds)
                </p>
                <HoverOnlyTooltip content="Reset Filters - shortcut: r">
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
            }
          />
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
                value="slowmo"
                className="flex-1 cursor-pointer data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                Slowmo
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          </div>
        </PopoverContent>
      </Popover>
    </Tooltip>
  );
}

/** Parse the numeric seconds from a product's duration tag (e.g. "10s" → 10). */
function parseDurationSecondsValue(rawValue: string): number | null {
  const trimmedValue = rawValue.trim();
  if (!trimmedValue) return null;

  // Supports formats like "9", "9s", "0:09", or "1:02:03".
  const colonParts = trimmedValue.split(':').map((part) => part.trim());
  if (
    colonParts.length > 1 &&
    colonParts.every((part) => /^\d+(?:\.\d+)?$/.test(part))
  ) {
    const totalSeconds = colonParts.reduce((accumulator, part) => {
      return accumulator * 60 + Number(part);
    }, 0);
    return Number.isFinite(totalSeconds) ? totalSeconds : null;
  }

  const normalizedValue = trimmedValue
    .replace(/\b(seconds?|secs?)\b/gi, '')
    .replace(/s$/i, '')
    .trim();
  if (!/^\d+(?:\.\d+)?$/.test(normalizedValue)) return null;

  const parsed = Number(normalizedValue);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDurationSeconds(product: {tags: string[]}): number | null {
  const tag = product.tags.find((t) => t?.startsWith?.('duration-'));
  if (!tag) return null;
  const rawValue = tag.slice('duration-'.length).trim();
  return parseDurationSecondsValue(rawValue);
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
  const normalized = value.trim().toLowerCase();
  if (normalized.includes('slow')) return 'slowmo';
  if (normalized === '24' || normalized === '24fps') return '24fps';
  return normalized;
}

function getBundleClipFrameRates(tags: string[]): string[] {
  return tags.flatMap((tag) => {
    const match = tag.match(bundleFrameRegex);
    if (!match?.[2]) return [];
    return [normalizeBundleFrameFilterValue(match[2])];
  });
}

function bundleMatchesDuration(tags: string[], maxDuration: number): boolean {
  const durations = getBundleClipDurations(tags);
  if (durations.length === 0) return true;
  return durations.some((seconds) => seconds <= maxDuration);
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
    if (frameRateFilter === '24fps') {
      return !tags.includes('slowmo');
    }
    if (frameRateFilter === 'slowmo') {
      return tags.includes('slowmo');
    }
    return true;
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

function getFilteredCollectionSearchProducts({
  products,
  collectionHandle,
  collectionTitle,
  stockFilterState,
}: {
  products: EnhancedPartialSearchResult[];
  collectionHandle?: string;
  collectionTitle?: string | null;
  stockFilterState: 'All Clips' | 'Discounted Bundles';
}) {
  const extraTags: string[] = [];
  const collectionName = capitalizeFirstLetter(collectionTitle ?? '');

  if (collectionName === 'Stock') {
    extraTags.push('Video');
  }

  const filteredProducts = products.filter((product) =>
    product?.tags?.includes(collectionName),
  );
  const extraFilteredProducts =
    extraTags.length > 0
      ? products.filter((product) =>
          product?.tags?.some((tag) => extraTags.includes(tag)),
        )
      : [];
  const combinedProductSearches = [
    ...filteredProducts,
    ...extraFilteredProducts,
  ];

  if (collectionHandle !== 'stock') {
    return combinedProductSearches;
  }

  return combinedProductSearches.filter((product) => {
    if (stockFilterState === 'All Clips') {
      return product.tags.includes('Video') && !product.tags.includes('Bundle');
    }

    if (stockFilterState === 'Discounted Bundles') {
      return product.tags.includes('Bundle');
    }

    return true;
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
  type StockFilterState = 'All Clips' | 'Discounted Bundles';

  const LAYOUT_STORAGE_KEY = 'collection-layout-mode';
  const PRINTS_FILTER_STORAGE_KEY = 'collection-prints-filter-mode';
  const STOCK_FILTER_STORAGE_KEY = 'collection-stock-filter-mode';
  const STOCK_DURATION_FILTER_KEY = 'collection-stock-duration-filter';
  const STOCK_RESOLUTION_FILTER_KEY = 'collection-stock-resolution-filter';
  const STOCK_FRAME_RATE_FILTER_KEY = 'collection-stock-frame-rate-filter';
  const [layout, setLayout] = useState('grid');
  const [durationFilterIndex, setDurationFilterIndex] = useState(
    DEFAULT_DURATION_FILTER_INDEX,
  ); // default: "All Durations"
  const [resolutionFilterIndex, setResolutionFilterIndex] = useState(
    DEFAULT_RESOLUTION_FILTER_INDEX,
  ); // default: "Has 4K+"
  const [frameRateFilter, setFrameRateFilter] = useState<FrameRateFilter>(
    DEFAULT_FRAME_RATE_FILTER,
  ); // default: "all"
  const [hasInitializedLayout, setHasInitializedLayout] = useState(false);
  const [hasInitializedPrintsFilter, setHasInitializedPrintsFilter] =
    useState(false);
  const [hasInitializedStockFilter, setHasInitializedStockFilter] =
    useState(false);
  const setGridLayout = () => setLayout('grid');
  const setListLayout = () => setLayout('list');
  const gridViewTooltip = 'Keyboard shortcut: =';
  const listViewTooltip = 'Keyboard shortcut: -';

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
        stockFilterState,
      }),
    [
      searchFetcher.data,
      collection?.handle,
      collection?.title,
      stockFilterState,
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
    } catch {
      setFilterState('All');
    } finally {
      setHasInitializedPrintsFilter(true);
    }
  }, [collection?.handle]);

  useEffect(() => {
    if (collection?.handle !== 'prints' || !hasInitializedPrintsFilter) return;
    try {
      window.localStorage.setItem(PRINTS_FILTER_STORAGE_KEY, filterState);
    } catch {
      // Ignore storage access errors (private mode, etc.)
    }
  }, [collection?.handle, filterState, hasInitializedPrintsFilter]);

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
      const savedDuration = window.localStorage.getItem(
        STOCK_DURATION_FILTER_KEY,
      );
      if (savedDuration !== null) {
        const idx = Number(savedDuration);
        if (idx >= 0 && idx < DURATION_NOTCHES.length) {
          setDurationFilterIndex(idx);
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
        savedFrameRate === 'slowmo'
      ) {
        setFrameRateFilter(savedFrameRate);
      }
    } catch {
      // Ignore storage access errors
    }
  }, [collection?.handle]);

  // Persist duration/resolution/frame-rate filter to localStorage
  useEffect(() => {
    if (collection?.handle !== 'stock') return;
    try {
      window.localStorage.setItem(
        STOCK_DURATION_FILTER_KEY,
        String(durationFilterIndex),
      );
      window.localStorage.setItem(
        STOCK_RESOLUTION_FILTER_KEY,
        String(resolutionFilterIndex),
      );
      window.localStorage.setItem(
        STOCK_FRAME_RATE_FILTER_KEY,
        frameRateFilter,
      );
    } catch {
      // Ignore storage access errors
    }
  }, [collection?.handle, durationFilterIndex, resolutionFilterIndex, frameRateFilter]);

  useEffect(() => {
    const baseConnection = collection?.products;
    if (!baseConnection) return;

    let filteredCollection = baseConnection.nodes;

    if (collection?.handle === 'prints') {
      filteredCollection = baseConnection.nodes?.filter((p: any) => {
        if (filterState === 'All') {
          return (
            p.tags.includes('horOnly') ||
            p.tags.includes('horPrimary') ||
            p.tags.includes('vertOnly') ||
            p.tags.includes('vertPrimary')
          );
        }
        if (filterState === 'Horizontal') {
          return p.tags.includes('horOnly') || p.tags.includes('horPrimary');
        }
        if (filterState === 'Vertical') {
          return p.tags.includes('vertOnly') || p.tags.includes('vertPrimary');
        }
      });
    }

    if (collection?.handle === 'stock') {
      const maxDuration =
        DURATION_NOTCHES[durationFilterIndex]?.value ?? Infinity;
      const minResolution =
        RESOLUTION_NOTCHES[resolutionFilterIndex]?.value ?? 4;

      filteredCollection = baseConnection.nodes?.filter((p: any) => {
        const isBundleProduct = p.tags.includes('Bundle');

        // Existing clip-type filter
        if (stockFilterState === 'All Clips') {
          if (!(p.tags.includes('Video') && !isBundleProduct))
            return false;
        } else if (stockFilterState === 'Discounted Bundles') {
          if (!isBundleProduct) return false;
        }

        // Duration filter
        if (maxDuration !== Infinity) {
          if (isBundleProduct) {
            if (!bundleMatchesDuration(p.tags, maxDuration)) return false;
          } else {
            const seconds = parseDurationSeconds(p);
            // If no duration tag, include the product (don't exclude unknown durations)
            if (seconds !== null && seconds > maxDuration) return false;
          }
        }

        // Resolution filter
        if (minResolution > 4) {
          if (isBundleProduct) {
            if (!bundleMatchesResolution(p, minResolution)) return false;
          } else {
            const highest = getHighestResolutionNumber(p);
            if (highest < minResolution) return false;
          }
        }

        // Frame rate filter
        if (frameRateFilter !== 'all') {
          if (isBundleProduct) {
            if (!bundleMatchesFrameRate(p.tags, frameRateFilter)) return false;
          } else if (frameRateFilter === '24fps') {
            if (p.tags.includes('slowmo')) return false;
          } else if (frameRateFilter === 'slowmo') {
            if (!p.tags.includes('slowmo')) return false;
          }
        }

        return true;
      });
    }

    setProductState({
      ...baseConnection,
      nodes: filteredCollection,
    });
  }, [
    collection?.handle,
    collection?.products,
    filterState,
    stockFilterState,
    durationFilterIndex,
    resolutionFilterIndex,
    frameRateFilter,
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
          setDurationFilterIndex(DEFAULT_DURATION_FILTER_INDEX);
          setResolutionFilterIndex(DEFAULT_RESOLUTION_FILTER_INDEX);
          setFrameRateFilter(DEFAULT_FRAME_RATE_FILTER);
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
        }
      }
    };

    window.addEventListener('keydown', handleViewShortcut);
    return () => window.removeEventListener('keydown', handleViewShortcut);
  }, [collection?.handle]);

  return (
    <SkeletonGate isReady={isPageReady} skeleton={<CollectionPageSkeleton />}>
      <div className="overflow-x-hidden">
        {collection?.handle === 'prints' && (
          <ProductsHeader onLoad={handleHeaderLoad} imgRef={headerImgRef} />
        )}
        {collection?.handle === 'stock' && (
          <EProductsHeader onLoad={handleHeaderLoad} imgRef={headerImgRef} />
        )}

        {collection?.handle === 'stock' && (
          <div className="flex justify-center pt-2 pb-1">
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
                  Keyboard shortcut: a
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
                  Keyboard shortcut: d
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
                  durationFilterIndex={durationFilterIndex}
                  setDurationFilterIndex={setDurationFilterIndex}
                  resolutionFilterIndex={resolutionFilterIndex}
                  setResolutionFilterIndex={setResolutionFilterIndex}
                  frameRateFilter={frameRateFilter}
                  setFrameRateFilter={setFrameRateFilter}
                />
              )}
              {collection?.handle === 'prints' && (
                <PrintsFiltersPopover
                  filterState={filterState}
                  setFilterState={setFilterState}
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
                        <InputGroup className="w-[284px]">
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
                        <p className="desktop-search-hint text-muted-foreground text-[11px] w-[284px] text-left pl-9">
                          Try &ldquo;Sea Lion&rdquo; or &ldquo;Fish&rdquo;
                        </p>
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
                              <InputGroup className="w-[300px]">
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
                              <p className="text-muted-foreground text-[11px] mt-1.5 w-[300px] text-left pl-9">
                                Try &ldquo;Sea Lion&rdquo; or &ldquo;Fish&rdquo;
                              </p>
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
                      durationFilterIndex={durationFilterIndex}
                      setDurationFilterIndex={setDurationFilterIndex}
                      resolutionFilterIndex={resolutionFilterIndex}
                      setResolutionFilterIndex={setResolutionFilterIndex}
                      frameRateFilter={frameRateFilter}
                      setFrameRateFilter={setFrameRateFilter}
                    />
                  )}
                  {collection?.handle === 'prints' && (
                    <PrintsFiltersPopover
                      filterState={filterState}
                      setFilterState={setFilterState}
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
                className={`${layoutClassName} collection-results-surface`.trim()}
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
            className={`${layoutClassName} collection-results-surface`.trim()}
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
// tack on selectedvariants even if theres none
