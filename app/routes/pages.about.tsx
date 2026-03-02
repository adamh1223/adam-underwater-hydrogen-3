import {Suspense, useCallback, useEffect, useRef, useState} from 'react';
import {Await, useLoaderData, useLocation} from '@remix-run/react';
import {Button} from '~/components/ui/button';
import {Card} from '~/components/ui/card';
import {Separator} from '~/components/ui/separator';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '~/components/ui/accordion';
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '~/components/ui/carousel';
import '../styles/routeStyles/about.css';

import {LoaderFunctionArgs} from '@remix-run/server-runtime';
import RotatingCarousel from '~/components/global/ThreeDViewModal';
import {
  FEATURED_COLLECTION_QUERY,
  RECOMMENDED_PRODUCTS_QUERY,
} from '~/lib/homeQueries';
import RecommendedProducts from '~/components/products/recommendedProducts';
import {CUSTOMER_WISHLIST} from '~/lib/customerQueries';
import {useTouchCardHighlight} from '~/lib/touchCardHighlight';
import AboutPageSkeleton from '~/components/skeletons/AboutPageSkeleton';
import {SkeletonGate} from '~/components/skeletons/shared';

const ABOUT_GEAR_CATEGORY_STORAGE_KEY = 'about-gear-category';
const GEAR_CATEGORY_OPTIONS = [
  'Underwater Camera',
  'Camera',
  'Diving',
  'Drone',
] as const;
type GearCategory = (typeof GEAR_CATEGORY_OPTIONS)[number];
type GearSlide = {src: string; alt: string};
type GearCardDefinition = {
  id: string;
  category: GearCategory;
  title: string;
  titleClassName?: string;
  slides: GearSlide[];
  description: React.ReactNode;
  linkURL: string;
};

const gearImageDimensionCache = new Map<
  string,
  {width: number; height: number}
>();
const gearImageReadyCache = new Set<string>();
const gearImageReadyPromiseCache = new Map<string, Promise<void>>();

function ensureGearImageReady(src: string): Promise<void> {
  if (!src) return Promise.resolve();
  if (gearImageReadyCache.has(src)) return Promise.resolve();

  const existingPromise = gearImageReadyPromiseCache.get(src);
  if (existingPromise) return existingPromise;

  if (typeof Image === 'undefined') return Promise.resolve();

  const preloadPromise = new Promise<void>((resolve) => {
    const img = new Image();
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      const width = img.naturalWidth || img.width || 0;
      const height = img.naturalHeight || img.height || 0;
      if (width > 0 && height > 0) {
        gearImageDimensionCache.set(src, {width, height});
      }
      gearImageReadyCache.add(src);
      resolve();
    };

    img.onload = () => {
      if (typeof img.decode === 'function') {
        void img.decode().then(finish).catch(finish);
        return;
      }
      finish();
    };

    img.onerror = finish;
    img.decoding = 'async';
    img.src = src;

    if (img.complete && img.naturalWidth > 0) {
      if (typeof img.decode === 'function') {
        void img.decode().then(finish).catch(finish);
      } else {
        finish();
      }
    }
  });

  gearImageReadyPromiseCache.set(src, preloadPromise);
  return preloadPromise;
}

function isGearCategory(value: string): value is GearCategory {
  return (GEAR_CATEGORY_OPTIONS as readonly string[]).includes(value);
}

const ABOUT_GEAR_CARDS: GearCardDefinition[] = [
  {
    id: 'canon-r5c',
    category: 'Underwater Camera',
    title: 'Canon EOS R5C + Nauticam NA-R5C Underwater Housing',
    titleClassName: 'px-3',
    slides: [
      {src: 'https://downloads.adamunderwater.com/store-1-au/public/gear1.png', alt: 'Gear 1'},
      {src: 'https://downloads.adamunderwater.com/store-1-au/public/gear2.png', alt: 'Gear 2'},
      {src: 'https://downloads.adamunderwater.com/store-1-au/public/gear3.png', alt: 'Gear 3'},
    ],
    linkURL: 'https://amazon.com',
    description:
      'The Canon EOS R5C is a hybrid powerhouse, capable of 8K video recording and excellent still photography, making it perfect for underwater shooting.',
  },
  {
    id: 'red-komodo-x-rig',
    category: 'Camera',
    title: 'RED Komodo X Cinema Rig with Tilta Ring',
    titleClassName: 'px-3',
    slides: [
      {src: 'https://downloads.adamunderwater.com/store-1-au/public/gear1.png', alt: 'Gear 1'},
      {src: 'https://downloads.adamunderwater.com/store-1-au/public/gear2.png', alt: 'Gear 2'},
      {src: 'https://downloads.adamunderwater.com/store-1-au/public/gear3.png', alt: 'Gear 3'},
    ],
    linkURL: 'https://amazon.com',
    description:
      'The Canon EOS R5C is a hybrid powerhouse, capable of 8K video recording and excellent still photography, making it perfect for underwater shooting.',
  },
  {
    id: 'odyssey-fins',
    category: 'Diving',
    title: 'Odyssey Freediving Fins',
    slides: [
      {src: 'https://downloads.adamunderwater.com/store-1-au/public/neptune.png', alt: 'Keldan Light 1'},
      {src: 'https://downloads.adamunderwater.com/store-1-au/public/keldan1.png', alt: 'Keldan Light 2'},
    ],
    linkURL: 'https://amazon.com',
    description: (
      <>
        I use{' '}
        <a
          href="https://odysseyfreediving.com/products/neptune-long-blade-fins"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline"
        >
          Neptune Long Blade Freediving Fins
        </a>{' '}
        from Odyssey Freediving
      </>
    ),
  },
  {
    id: 'keldan-video-lights',
    category: 'Drone',
    title: 'Keldan Video Lights',
    slides: [
      {src: 'https://downloads.adamunderwater.com/store-1-au/public/keldan2.jpg', alt: 'Keldan Light 1'},
      {src: 'https://downloads.adamunderwater.com/store-1-au/public/keldan1.png', alt: 'Keldan Light 2'},
    ],
    linkURL: 'https://amazon.com',
    description:
      'Keldan video lights provide high-output, natural-looking illumination underwater, essential for capturing vibrant colors at depth.',
  },
];

export async function loader(args: LoaderFunctionArgs) {
  const deferredData = loadDeferredData(args);
  const criticalData = await loadCriticalData(args);
  //   need the customer variable, add these lines for other instances of recommended products
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
      wishlistProducts: [],
      isLoggedIn: undefined,
    };
  }

  const isLoggedIn = args.context.customerAccount.isLoggedIn();

  let wishlistProducts: string[] = [];
  const wishlistValue = customer.data.customer.metafield?.value;
  if (typeof wishlistValue === 'string' && wishlistValue.length) {
    try {
      const parsed = JSON.parse(wishlistValue);
      if (Array.isArray(parsed)) {
        wishlistProducts = parsed.filter(
          (value): value is string => typeof value === 'string',
        );
      }
    } catch {
      wishlistProducts = [];
    }
  }

  return {...deferredData, ...criticalData, wishlistProducts, isLoggedIn};
}

async function loadCriticalData({context}: LoaderFunctionArgs) {
  const [{collections}] = await Promise.all([
    context.storefront.query(FEATURED_COLLECTION_QUERY),
  ]);

  return {
    featuredCollection: collections.nodes[0],
  };
}

function loadDeferredData({context}: LoaderFunctionArgs) {
  const recommendedProducts = context.storefront
    .query(RECOMMENDED_PRODUCTS_QUERY)
    .catch((error) => {
      // Log query errors, but don't throw them so the page can still render
      console.error(error, '00000000000000000000000000000000000000000000000');
      return null;
    });

  return {
    recommendedProducts,
  };
}

function GearImageCarousel({
  slides,
  viewportWidth,
}: {
  slides: GearSlide[];
  viewportWidth?: number;
}) {
  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalItems, setTotalItems] = useState(slides.length);
  const [isCarouselVisualReady, setIsCarouselVisualReady] = useState(false);
  const [slideDimensions, setSlideDimensions] = useState<
    Record<number, {width: number; height: number}>
  >(() =>
    slides.reduce<Record<number, {width: number; height: number}>>(
      (acc, slide, index) => {
        const cached = gearImageDimensionCache.get(slide.src);
        if (cached) acc[index] = cached;
        return acc;
      },
      {},
    ),
  );
  const previewPointerStateRef = useRef<{
    active: boolean;
    pointerId: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const suppressPreviewTapUntilRef = useRef(0);
  const hasMarkedVisualReadyRef = useRef(false);

  const isVerticalLike = (slideIndex: number) => {
    const dimensions = slideDimensions[slideIndex];
    if (!dimensions || dimensions.height <= 0) return false;
    return dimensions.width / dimensions.height <= 1.15;
  };

  const getVerticalGridCarouselWidth = (width: number) => {
    if (width <= 700) return 'w-64';

    if (width <= 1400) {
      const cycleOffset = (width - 701) % 700;
      if (cycleOffset <= 49) return 'w-56';
      if (cycleOffset <= 199) return 'w-56';
      if (cycleOffset <= 399) return 'w-56';
      if (cycleOffset <= 599) return 'w-64';
      return 'w-72';
    }

    // Gear cards have less vertical room when the grid adds the 3rd column.
    // Bump portrait-like images one step up in this band so they don't look short.
    if (width >= 1401 && width <= 1600) {
      return 'w-64';
    }

    const bandStart = 1401;
    const bandSize = 700;
    const bandIndex = Math.floor((width - bandStart) / bandSize);
    const offsetInBand = (width - bandStart) % bandSize;
    const columnsInRange = bandIndex + 3;

    const widthSteps = ['w-48', 'w-56', 'w-64', 'w-72'] as const;
    const baselineBandEndOffsets = [50, 200, 400, 700] as const;
    const startStepIndex = Math.min(bandIndex, widthSteps.length - 1);

    const roundToNearest50 = (value: number) => Math.round(value / 50) * 50;
    const scaledBandEnds = baselineBandEndOffsets
      .slice(startStepIndex)
      .map((offset) =>
        Math.min(bandSize, roundToNearest50((offset * columnsInRange) / 3)),
      );

    for (let i = 0; i < scaledBandEnds.length; i++) {
      if (offsetInBand < scaledBandEnds[i]) {
        return widthSteps[startStepIndex + i];
      }
    }

    return 'w-72';
  };

  useEffect(() => {
    if (!carouselApi) return;

    const updateCarouselState = () => {
      setCurrentIndex(carouselApi.selectedScrollSnap());
      setTotalItems(carouselApi.scrollSnapList().length);
    };

    updateCarouselState();
    carouselApi.on('select', updateCarouselState);
    carouselApi.on('reInit', updateCarouselState);

    return () => {
      carouselApi.off('select', updateCarouselState);
      carouselApi.off('reInit', updateCarouselState);
    };
  }, [carouselApi]);

  const handleDotSelect = (
    event:
      | React.PointerEvent<HTMLButtonElement>
      | React.MouseEvent<HTMLButtonElement>,
    index: number,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    carouselApi?.scrollTo(index);
  };

  const activeSlide = slides[currentIndex] ?? slides[0];
  const activeSlideIsVertical = activeSlide
    ? isVerticalLike(currentIndex)
    : false;
  const leftGearArrowClass = activeSlideIsVertical
    ? 'left-arrow-carousel-grid-vertical-gear'
    : 'left-arrow-carousel-grid-horizontal-gear';
  const rightGearArrowClass = activeSlideIsVertical
    ? 'right-arrow-carousel-grid-vertical-gear'
    : 'right-arrow-carousel-grid-horizontal-gear';

  const viewport = viewportWidth ?? 1200;
  const firstSlide = slides[0];
  const firstSlideIsVertical = firstSlide ? isVerticalLike(0) : false;

  const markCarouselVisualReady = () => {
    if (hasMarkedVisualReadyRef.current) return;
    hasMarkedVisualReadyRef.current = true;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsCarouselVisualReady(true);
      });
    });
  };

  useEffect(() => {
    hasMarkedVisualReadyRef.current = false;
    setIsCarouselVisualReady(false);
  }, [slides]);

  const handleImageLoad = (
    event: React.SyntheticEvent<HTMLImageElement>,
    index: number,
  ) => {
    const img = event.currentTarget;
    const width = img.naturalWidth || img.width || 0;
    const height = img.naturalHeight || img.height || 0;
    if (!width || !height) return;
    const slideSrc = slides[index]?.src ?? img.currentSrc ?? '';
    gearImageDimensionCache.set(slideSrc, {width, height});
    if (slideSrc) gearImageReadyCache.add(slideSrc);
    setSlideDimensions((prev) => {
      const existing = prev[index];
      if (existing && existing.width === width && existing.height === height) {
        return prev;
      }
      return {...prev, [index]: {width, height}};
    });
    if (index === 0) {
      markCarouselVisualReady();
    }
  };

  const handleCarouselPointerDownCapture = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, a, [role="button"]')) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    previewPointerStateRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
  };

  const handleCarouselPointerMoveCapture = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    const pointerState = previewPointerStateRef.current;
    if (
      !pointerState ||
      !pointerState.active ||
      pointerState.pointerId !== event.pointerId
    ) {
      return;
    }

    const movedDistance = Math.hypot(
      event.clientX - pointerState.startX,
      event.clientY - pointerState.startY,
    );
    if (movedDistance > 8 && !pointerState.moved) {
      pointerState.moved = true;
      suppressPreviewTapUntilRef.current = performance.now() + 350;
    }
  };

  const endCarouselPointerTracking = (pointerId?: number) => {
    const pointerState = previewPointerStateRef.current;
    if (!pointerState) return;
    if (
      typeof pointerId === 'number' &&
      pointerState.pointerId !== pointerId &&
      pointerState.active
    ) {
      return;
    }
    if (pointerState.moved) {
      suppressPreviewTapUntilRef.current = performance.now() + 350;
    }
    previewPointerStateRef.current = null;
  };

  const handleCarouselClickCapture = (
    event: React.MouseEvent<HTMLDivElement>,
  ) => {
    const target = event.target as Element | null;
    if (target?.closest('button,a,input,textarea,select,[role="button"]')) {
      return;
    }

    if (performance.now() < suppressPreviewTapUntilRef.current) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  return (
    <div
      className="gear-image-carousel-shell relative w-full max-w-sm"
      onPointerDownCapture={handleCarouselPointerDownCapture}
      onPointerMoveCapture={handleCarouselPointerMoveCapture}
      onPointerUpCapture={(event) =>
        endCarouselPointerTracking(event.pointerId)
      }
      onPointerCancelCapture={(event) =>
        endCarouselPointerTracking(event.pointerId)
      }
      onClickCapture={handleCarouselClickCapture}
    >
      {!isCarouselVisualReady && firstSlide ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10">
          <div className="gear-image-carousel-stage flex items-center justify-center w-[92%] mx-auto rounded">
            <img
              src={firstSlide.src}
              alt=""
              aria-hidden="true"
              className={`rounded max-w-full ${
                firstSlideIsVertical
                  ? getVerticalGridCarouselWidth(viewport)
                  : 'w-120'
              } object-cover`}
            />
          </div>
        </div>
      ) : null}
      <Carousel
        setApi={setCarouselApi}
        className="w-full transform-none carousel-hover-safe"
      >
        <CarouselContent>
          {slides.map((slide, index) => (
            <CarouselItem key={`${slide.src}-${index}`}>
              <div className="gear-image-carousel-stage flex items-center justify-center w-[92%] mx-auto rounded">
                <img
                  src={slide.src}
                  alt={slide.alt}
                  loading="eager"
                  decoding="sync"
                  onLoad={(event) => handleImageLoad(event, index)}
                  className={`rounded max-w-full ${
                    isVerticalLike(index)
                      ? getVerticalGridCarouselWidth(viewport)
                      : 'w-120'
                  } object-cover transform group-hover:scale-105 transition-transform duration-500`}
                />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        {totalItems > 1 && (
          <>
            <CarouselPrevious
              inTheBox
              variant="secondary"
              className={`${leftGearArrowClass} pointer-events-auto shadow-none cursor-pointer`}
            />
            <CarouselNext
              inTheBox
              variant="secondary"
              className={`${rightGearArrowClass} pointer-events-auto shadow-none cursor-pointer`}
            />
          </>
        )}
      </Carousel>

      {totalItems > 1 && (
        <div
          className={`carousel-preview-dots-grid relative z-0 pointer-events-none flex justify-center gap-3 pb-1 ${
            activeSlideIsVertical ? 'pt-3' : 'pt-1'
          }`}
        >
          {Array.from({length: totalItems}).map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={(event) => handleDotSelect(event, idx)}
              onPointerDown={(event) => handleDotSelect(event, idx)}
              className={`h-2 w-2 pointer-events-auto rounded-full border border-white/60 ${idx === currentIndex ? 'bg-white' : 'bg-white/30'}`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function GearDescriptionCard({
  children,
  linkURL = 'https://amazon.com',
}: {
  children: React.ReactNode;
  linkURL?: string;
}) {
  return (
    <Card className="description-card gear-description-card p-2">
      <div className="gear-description-card-stack">
        <div className="gear-description-card-text">{children}</div>
        <div className="gear-description-card-cta">
          <Button
            asChild
            className="gear-description-card-cta-button text-center whitespace-normal leading-tight px-5"
          >
            <a
              href={linkURL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View Product"
            >
              View Product
            </a>
          </Button>
        </div>
      </div>
    </Card>
  );
}

function GearCardItem({
  card,
  viewportWidth,
  gearHoverCardEffects,
  gearTouchCardEffects,
  onGearCardPointerDownCapture,
  onGearCardPointerMoveCapture,
  onGearCardPointerUpCapture,
  onGearCardPointerCancelCapture,
  onGearCardClick,
  onGearCardKeyDown,
}: {
  card: GearCardDefinition;
  viewportWidth?: number;
  gearHoverCardEffects: string;
  gearTouchCardEffects: string;
  onGearCardPointerDownCapture: React.PointerEventHandler<HTMLElement>;
  onGearCardPointerMoveCapture: React.PointerEventHandler<HTMLElement>;
  onGearCardPointerUpCapture: React.PointerEventHandler<HTMLElement>;
  onGearCardPointerCancelCapture: React.PointerEventHandler<HTMLElement>;
  onGearCardClick: (
    event: React.MouseEvent<HTMLElement>,
    linkURL: string,
  ) => void;
  onGearCardKeyDown: (
    event: React.KeyboardEvent<HTMLElement>,
    linkURL: string,
  ) => void;
}) {
  const touchHighlightId = `about-gear-card:${card.id}`;
  const {isTouchHighlighted, touchHighlightHandlers} =
    useTouchCardHighlight(touchHighlightId);

  return (
    <Card
      className={`gear-card group relative cursor-pointer ${gearHoverCardEffects} ${isTouchHighlighted ? gearTouchCardEffects : ''}`}
      style={{touchAction: 'pan-y'}}
      role="link"
      tabIndex={0}
      aria-label="Open product link in new tab"
      data-touch-highlight-card-id={touchHighlightId}
      {...touchHighlightHandlers}
      onPointerDownCapture={onGearCardPointerDownCapture}
      onPointerMoveCapture={onGearCardPointerMoveCapture}
      onPointerUpCapture={onGearCardPointerUpCapture}
      onPointerCancelCapture={onGearCardPointerCancelCapture}
      onClick={(event) => onGearCardClick(event, card.linkURL)}
      onKeyDown={(event) => onGearCardKeyDown(event, card.linkURL)}
    >
      <h1 className={`subheader ${card.titleClassName ?? ''}`.trim()}>
        {card.title}
      </h1>

      <div className="gear-container">
        <GearImageCarousel slides={card.slides} viewportWidth={viewportWidth} />
      </div>

      <GearDescriptionCard linkURL={card.linkURL}>
        {card.description}
      </GearDescriptionCard>
    </Card>
  );
}

export default function AboutPage() {
  const data = useLoaderData<typeof loader>();

  const location = useLocation();
  const [windowWidth, setWindowWidth] = useState<number | undefined>(undefined);
  const [selectedGearCategory, setSelectedGearCategory] =
    useState<GearCategory>('Underwater Camera');
  const [isPageReady, setIsPageReady] = useState(false);
  const hasCalledPageReady = useRef(false);
  const headshotRef = useRef<HTMLImageElement>(null);
  const retryTimerRef = useRef<number | null>(null);
  const gearCategorySwitchRequestRef = useRef(0);
  const gearCategorySwitchDelayTimerRef = useRef<number | null>(null);

  const handleHeadshotLoad = useCallback(() => {
    if (hasCalledPageReady.current) return;
    hasCalledPageReady.current = true;
    setIsPageReady(true);
  }, []);

  // Catch cached images whose onLoad fired before React hydrated
  useEffect(() => {
    const img = headshotRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      handleHeadshotLoad();
    }
  }, [handleHeadshotLoad]);

  // Track window width
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    try {
      const savedCategory = window.localStorage.getItem(
        ABOUT_GEAR_CATEGORY_STORAGE_KEY,
      );
      if (savedCategory && isGearCategory(savedCategory)) {
        setSelectedGearCategory(savedCategory);
      }
    } catch {
      // Ignore storage errors and keep default category.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        ABOUT_GEAR_CATEGORY_STORAGE_KEY,
        selectedGearCategory,
      );
    } catch {
      // Ignore storage errors.
    }
  }, [selectedGearCategory]);

  useEffect(() => {
    return () => {
      if (gearCategorySwitchDelayTimerRef.current != null) {
        window.clearTimeout(gearCategorySwitchDelayTimerRef.current);
        gearCategorySwitchDelayTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const uniqueImageSources = Array.from(
      new Set(
        ABOUT_GEAR_CARDS.flatMap((card) =>
          card.slides.map((slide) => slide.src),
        ),
      ),
    );
    uniqueImageSources.forEach((src) => {
      void ensureGearImageReady(src);
    });
  }, []);

  const handleGearCategoryToggleClick = (category: GearCategory) => {
    if (category === selectedGearCategory) return;

    const requestId = ++gearCategorySwitchRequestRef.current;
    if (gearCategorySwitchDelayTimerRef.current != null) {
      window.clearTimeout(gearCategorySwitchDelayTimerRef.current);
      gearCategorySwitchDelayTimerRef.current = null;
    }
    const firstSlideSources = ABOUT_GEAR_CARDS.filter(
      (card) => card.category === category,
    )
      .map((card) => card.slides[0]?.src)
      .filter((src): src is string => Boolean(src));

    void Promise.all(firstSlideSources.map((src) => ensureGearImageReady(src)))
      .catch(() => {
        // Allow switching even if preload fails.
      })
      .finally(() => {
        if (gearCategorySwitchRequestRef.current !== requestId) return;
        gearCategorySwitchDelayTimerRef.current = window.setTimeout(() => {
          if (gearCategorySwitchRequestRef.current !== requestId) return;
          setSelectedGearCategory(category);
          gearCategorySwitchDelayTimerRef.current = null;
        }, 0);
      });
  };

  const getYOffset = () => {
    if (windowWidth == null) return -180;
    if (windowWidth < 1024) return -110;
    if (windowWidth >= 1024) return -70;
  };

  const gearGridColumnCount =
    windowWidth != undefined
      ? Math.max(1, Math.floor((windowWidth - 1) / 700) + 1)
      : 1;
  const visibleGearCards = ABOUT_GEAR_CARDS.filter(
    (card) => card.category === selectedGearCategory,
  );
  const gearGridStyle = {
    gridTemplateColumns: `repeat(${Math.max(1, gearGridColumnCount)}, minmax(0, 1fr))`,
  };

  const gearFocusWithinCardEffects =
    ' focus-visible:border-primary focus-visible:shadow-[0_0_0_1px_hsl(var(--primary)/0.5),0_0_20px_hsl(var(--primary)/0.35)]';
  const gearHoverCardEffects = `transition-[border-color,box-shadow] duration-300 hover:border-primary hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.5),0_0_20px_hsl(var(--primary)/0.35)] active:border-primary active:shadow-[0_0_0_1px_hsl(var(--primary)/0.5),0_0_20px_hsl(var(--primary)/0.35)]${gearFocusWithinCardEffects}`;
  const gearTouchCardEffects =
    'border-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.5),0_0_20px_hsl(var(--primary)/0.35)]';
  const gearCardPointerStateRef = useRef<{
    active: boolean;
    pointerId: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const suppressGearCardTapUntilRef = useRef(0);

  const openGearLinkInNewTab = (linkURL: string) => {
    const normalizedLink = /^https?:\/\//i.test(linkURL)
      ? linkURL
      : `https://${linkURL}`;
    window.open(normalizedLink, '_blank', 'noopener,noreferrer');
  };

  const handleGearCardPointerDownCapture = (
    event: React.PointerEvent<HTMLElement>,
  ) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    gearCardPointerStateRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
  };

  const handleGearCardPointerMoveCapture = (
    event: React.PointerEvent<HTMLElement>,
  ) => {
    const pointerState = gearCardPointerStateRef.current;
    if (
      !pointerState ||
      !pointerState.active ||
      pointerState.pointerId !== event.pointerId
    ) {
      return;
    }

    const movedDistance = Math.hypot(
      event.clientX - pointerState.startX,
      event.clientY - pointerState.startY,
    );
    if (movedDistance > 8 && !pointerState.moved) {
      pointerState.moved = true;
      suppressGearCardTapUntilRef.current = performance.now() + 350;
    }
  };

  const endGearCardPointerTracking = (pointerId?: number) => {
    const pointerState = gearCardPointerStateRef.current;
    if (!pointerState) return;
    if (
      typeof pointerId === 'number' &&
      pointerState.pointerId !== pointerId &&
      pointerState.active
    ) {
      return;
    }
    if (pointerState.moved) {
      suppressGearCardTapUntilRef.current = performance.now() + 350;
    }
    gearCardPointerStateRef.current = null;
  };

  const handleGearCardClick = (
    event: React.MouseEvent<HTMLElement>,
    linkURL: string,
  ) => {
    if (performance.now() < suppressGearCardTapUntilRef.current) {
      event.preventDefault();
      return;
    }
    const target = event.target as HTMLElement | null;
    if (
      target?.closest(
        '.description-card, a, button, input, select, textarea, [role="button"], [data-slot="carousel"] button',
      )
    ) {
      return;
    }
    openGearLinkInNewTab(linkURL);
  };

  const handleGearCardKeyDown = (
    event: React.KeyboardEvent<HTMLElement>,
    linkURL: string,
  ) => {
    const target = event.target as HTMLElement | null;
    if (
      target?.closest(
        '.description-card, a, button, input, select, textarea, [role="button"]',
      )
    ) {
      return;
    }
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openGearLinkInNewTab(linkURL);
  };

  const scrollToSection = (sectionId: string) => {
    const section = document.getElementById(sectionId);
    if (!section) return false;
    const y =
      section.getBoundingClientRect().top + window.scrollY + getYOffset();
    window.scrollTo({top: y, behavior: 'smooth'});
    return true;
  };

  const handleClick = (
    sectionId: string,
    event: React.MouseEvent<HTMLAnchorElement>,
  ) => {
    event.preventDefault();
    scrollToSection(sectionId);
  };

  useEffect(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    const saved = (() => {
      try {
        return sessionStorage.getItem('about-scroll-target');
      } catch {
        return null;
      }
    })();

    const hashTarget = location.hash ? location.hash.replace('#', '') : null;
    const target = hashTarget || saved;
    if (!target) return;

    let attempts = 0;
    const maxAttempts = 20;
    const delayMs = 100;

    const tryScroll = () => {
      attempts++;
      const ok = scrollToSection(target);
      if (ok) {
        try {
          sessionStorage.removeItem('about-scroll-target');
        } catch {}
        return;
      }
      if (attempts >= maxAttempts) {
        try {
          sessionStorage.removeItem('about-scroll-target');
        } catch {}
        return;
      }
      retryTimerRef.current = window.setTimeout(tryScroll, delayMs);
    };

    retryTimerRef.current = window.setTimeout(tryScroll, 50);

    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [location, windowWidth]);

  return (
    <SkeletonGate isReady={isPageReady} skeleton={<AboutPageSkeleton />}>
      <section id="about">
        <div className="header-container">
          <img
            src={
              'https://fpoxvfuxgtlyphowqdgf.supabase.co/storage/v1/object/public/main-bucket/headers/icon.png'
            }
            className="icon-header"
          />

          <img
            src={
              'https://fpoxvfuxgtlyphowqdgf.supabase.co/storage/v1/object/public/main-bucket/headers/about.png'
            }
            className="about-header"
          />
        </div>
        <div
          className="anchors"
          style={{
            gridTemplateColumns: '1fr 1fr 1fr',
          }}
        >
          <Button variant="outline" className="anchor class-name px-3">
            <a onClick={(evt) => handleClick('about', evt)}>About Me</a>
          </Button>
          <Button variant="outline" className="anchor">
            <a onClick={(evt) => handleClick('gear', evt)}>My Gear</a>
          </Button>
        </div>

        <div className="about-container">
          <img ref={headshotRef} src={'https://downloads.adamunderwater.com/store-1-au/public/headshot3.png'} className="mt-5 headshot" onLoad={handleHeadshotLoad} />

          <div className="about-icon-wrapper">
            <div className="about-icon-container">
              <img src={'https://downloads.adamunderwater.com/store-1-au/public/padi-logo2.png'} className="padi-icon" />
              <p className="padi-description text-lg">
                PADI Open Water Scuba Instructor
              </p>
            </div>

            <div className="about-icon-container">
              <img src={'https://downloads.adamunderwater.com/store-1-au/public/aaus-logo.png'} className="about-icon" />
              <p className="text-lg description sci-description">
                AAUS Scientific Diver
              </p>
            </div>
            <div className="about-icon-container">
              <img src={'https://downloads.adamunderwater.com/store-1-au/public/faa-logo.png'} className="about-icon" />
              <p className="text-lg description faa-description">
                FAA Part 107 Drone Operator
              </p>
            </div>
          </div>
        </div>
        <Card className="about-paragraphs-container about-paragraphs-accordion-card overflow-hidden">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem
              value="about-me"
              className="about-paragraphs-accordion-item border-b-0 "
            >
              <AccordionTrigger className="about-paragraphs-trigger relative w-full items-center justify-center px-4 sm:px-6 py-4 text-base sm:text-lg text-center hover:no-underline [&>svg]:absolute [&>svg]:right-4 [&>svg]:top-1/2 [&>svg]:-translate-y-1/2 cursor-pointer">
                <span className="about-paragraphs-trigger-label">About Me</span>
              </AccordionTrigger>
              <AccordionContent className="about-paragraphs-accordion-content pb-0">
                <div className="text-lg tracking-wide leading-8 about-paragraphs">
                  <div>
                    My career as a camera operator and Director of Photography
                    took me into the water. From my first experience earning my
                    PADI Open Water Scuba certification, my relationship with
                    the ocean changed, and my path toward underwater
                    cinematography began.
                    <br />
                    <br />
                    While I continued working as a camera operator, I found more
                    and more opportunities to film underwater. I am fortunate to
                    have worked with{' '}
                    <a
                      href="https://gifts.worldwildlife.org/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      The World Wildlife Fund
                    </a>
                    ,{' '}
                    <a
                      href="https://www.urchinomics.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      Urchinomics
                    </a>
                    ,{' '}
                    <a
                      href="https://www.santamonicabay.org/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      The Bay Foundation
                    </a>
                    ,{' '}
                    <a
                      href="https://www.paradeigm.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      Paradeigm Films
                    </a>
                    ,{' '}
                    <a
                      href="https://odysseyfreediving.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      Odyssey Freediving
                    </a>{' '}
                    among other commercial video productions and feature films
                    as an underwater cinematographer and director.
                    <br />
                    <br />
                    As I filmed underwater professionally, I continued my diving
                    education and became a PADI Open Water Scuba Instructor,
                    Emergency First Response Instructor, and PADI advanced
                    freediver.
                    <br />
                    <br />
                    Through my experience filming and photographing wildlife
                    underwater I began large format printing my high resolution
                    underwater images. Over the years, I have refined the
                    printing process to maximize quality from the canvas paper
                    to the ink to the printer itself to bring the magic of the
                    ocean into people's homes. Navigate to the{' '}
                    <a
                      href="/products"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      Products
                    </a>{' '}
                    page to browse my prints.
                    <br />
                    <br />I am directing my first feature documentary
                    "Seaforestation" about the decline of kelp forests
                    worldwide. For this project I have filmed in California,
                    British Columbia, South Africa, and Australia to document
                    kelp forest declines. For more information on Seaforestation
                    head to the film website at{' '}
                    <a
                      href="https://seaforestfilm.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      seaforestfilm.com
                    </a>{' '}
                    <br />
                    <br />I am available for hire as a cinematographer and
                    director in underwater video production and photography.
                    Based in San Diego, CA.
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Card>
      </section>
      <section id="gear">
        <div>
          <h2 className="text-3xl font-medium tracking-wider capitalize p-3 flex justify-center">
            {'My Gear'}
          </h2>
          <Separator />
          <div className="flex justify-center px-3 py-3">
            <div
              className="toggle-container"
              style={{
                width: 'min(95vw, 720px)',
                height: '48px',
              }}
            >
              {GEAR_CATEGORY_OPTIONS.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={`toggle-option ${selectedGearCategory === category ? 'selected' : ''}`}
                  onClick={() => handleGearCategoryToggleClick(category)}
                  aria-pressed={selectedGearCategory === category}
                  style={{
                    fontSize:
                      windowWidth != undefined && windowWidth < 500
                        ? '12px'
                        : '13px',
                    lineHeight: 1.1,
                    padding: '4px 6px',
                    whiteSpace: 'normal',
                    textAlign: 'center',
                  }}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="gear-layout px-3 py-3" style={gearGridStyle}>
          {visibleGearCards.map((card) => (
            <GearCardItem
              key={card.id}
              card={card}
              viewportWidth={windowWidth}
              gearHoverCardEffects={gearHoverCardEffects}
              gearTouchCardEffects={gearTouchCardEffects}
              onGearCardPointerDownCapture={handleGearCardPointerDownCapture}
              onGearCardPointerMoveCapture={handleGearCardPointerMoveCapture}
              onGearCardPointerUpCapture={(event) =>
                endGearCardPointerTracking(event.pointerId)
              }
              onGearCardPointerCancelCapture={(event) =>
                endGearCardPointerTracking(event.pointerId)
              }
              onGearCardClick={handleGearCardClick}
              onGearCardKeyDown={handleGearCardKeyDown}
            />
          ))}
        </div>
      </section>
      <section>
        <div className="flex justify-center pt-5 me-4">
          <img
            src={
              'https://fpoxvfuxgtlyphowqdgf.supabase.co/storage/v1/object/public/main-bucket/featured6.png'
            }
            className="featured-img"
          />
        </div>
        <div className="flex justify-center font-bold text-xl pb-2">
          <p>Framed Canvas Wall Art</p>
        </div>
      </section>
      <RecommendedProducts
        products={data?.recommendedProducts}
        wishlistProducts={data?.wishlistProducts}
        isLoggedIn={data?.isLoggedIn}
      />
    </SkeletonGate>
  );
}

// export default AboutPage;
