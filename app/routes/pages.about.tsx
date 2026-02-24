import {Suspense, useEffect, useRef, useState} from 'react';
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
import {ChevronLeftIcon, ChevronRightIcon} from 'lucide-react';
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
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
  slides: Array<{src: string; alt: string; width: number; height: number}>;
  viewportWidth?: number;
}) {
  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalItems, setTotalItems] = useState(slides.length);

  const isVerticalLike = (slide: {width: number; height: number}) =>
    slide.height > 0 ? slide.width / slide.height <= 1.15 : false;

  const getVerticalGridCarouselWidth = (width: number) => {
    if (width <= 700) return 'w-64';

    if (width <= 1400) {
      const cycleOffset = (width - 701) % 700;
      if (cycleOffset <= 49) return 'w-40';
      if (cycleOffset <= 199) return 'w-48';
      if (cycleOffset <= 399) return 'w-56';
      if (cycleOffset <= 599) return 'w-64';
      return 'w-72';
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

  const getPrintGridArrowInsetPx = (width: number, vertical: boolean) => {
    if (!vertical) {
      if (width <= 600) return 6;
      if (width <= 700) return 10;
      if (width <= 849) return 3;
      if (width <= 957) return 6;
      if (width <= 1149) return 8;
      if (width <= 1249) return 9;
      if (width <= 1320) return 12;
      return 20;
    }

    if (width <= 499) return 15;
    if (width <= 600) return 40;
    if (width <= 700) return 90;
    if (width <= 768) return 30;
    if (width <= 849) return 40;
    if (width <= 957) return 50;
    if (width <= 1049) return 53;
    if (width <= 1149) return 75;
    if (width <= 1249) return 98;
    if (width <= 1320) return 125;
    return 140;
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
    ? isVerticalLike(activeSlide)
    : false;
  const viewport = viewportWidth ?? 1200;
  const gridArrowInsetPx = getPrintGridArrowInsetPx(
    viewport,
    activeSlideIsVertical,
  );

  return (
    <div className="relative w-full max-w-sm">
      <Carousel setApi={setCarouselApi} className="w-full transform-none">
        <CarouselContent>
          {slides.map((slide, index) => (
            <CarouselItem key={`${slide.src}-${index}`}>
              <div className="flex items-center justify-center w-[85%] pt-2 mx-auto">
                <img
                  src={slide.src}
                  alt={slide.alt}
                  className={`rounded max-w-full ${
                    isVerticalLike(slide)
                      ? getVerticalGridCarouselWidth(viewport)
                      : 'w-120'
                  } object-cover`}
                />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      {totalItems > 1 && (
        <div
          className="absolute z-40 flex items-center justify-between pointer-events-none inset-0"
          style={{
            paddingLeft: `${gridArrowInsetPx}px`,
            paddingRight: `${gridArrowInsetPx}px`,
          }}
        >
          <Button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              carouselApi?.scrollPrev();
            }}
            className="pointer-events-auto rounded-full w-8 h-8 p-0 shadow-none cursor-pointer"
            variant="secondary"
          >
            <ChevronLeftIcon className="h-6 w-6 text-white" />
          </Button>
          <Button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              carouselApi?.scrollNext();
            }}
            className="pointer-events-auto rounded-full w-8 h-8 p-0 shadow-none cursor-pointer"
            variant="secondary"
          >
            <ChevronRightIcon className="h-6 w-6 text-white" />
          </Button>
        </div>
      )}

      {totalItems > 1 && (
        <div className="carousel-preview-dots-grid absolute bottom-[-15px] left-0 right-0 z-40 pointer-events-none flex items-end justify-center gap-3 h-32 pt-[28px]">
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

export default function AboutPage() {
  const data = useLoaderData<typeof loader>();

  const location = useLocation();
  const [windowWidth, setWindowWidth] = useState<number | undefined>(undefined);
  const retryTimerRef = useRef<number | null>(null);

  // Track window width
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getYOffset = () => {
    if (windowWidth == null) return -180;
    if (windowWidth < 1024) return -110;
    if (windowWidth >= 1024) return -70;
  };

  const gearGridColumnCount =
    windowWidth != undefined
      ? Math.max(1, Math.floor((windowWidth - 1) / 700) + 1)
      : 1;
  const gearGridStyle = {
    gridTemplateColumns: `repeat(${gearGridColumnCount}, minmax(0, 1fr))`,
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
    <>
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
          <img src={'/headshot3.png'} className="pt-5 headshot" />

          <div className="about-icon-wrapper">
            <div className="about-icon-container">
              <img src={'/padi-logo2.png'} className="padi-icon" />
              <p className="padi-description text-lg">
                PADI Open Water Scuba Instructor
              </p>
            </div>

            <div className="about-icon-container">
              <img src={'/aaus-logo.png'} className="about-icon" />
              <p className="text-lg description sci-description">
                AAUS Scientific Diver
              </p>
            </div>
            <div className="about-icon-container">
              <img src={'/faa-logo.png'} className="about-icon" />
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
        </div>
        <div className="gear-layout px-8 py-8" style={gearGridStyle}>
          <Card className="gear-card">
            <h1 className="subheader">
              Canon EOS R5C + Nauticam NA-R5C Underwater Housing
            </h1>

            <div className="gear-container">
              <GearImageCarousel
                slides={[
                  {src: '/gear1.png', alt: 'Gear 1', width: 2456, height: 1636},
                  {src: '/gear2.png', alt: 'Gear 2', width: 1460, height: 1096},
                  {src: '/gear3.png', alt: 'Gear 3', width: 800, height: 600},
                ]}
                viewportWidth={windowWidth}
              />
            </div>

            <Card className="description-card p-4">
              <p>
                The Canon EOS R5C is a hybrid powerhouse, capable of 8K video
                recording and excellent still photography, making it perfect for
                underwater shooting.
              </p>
            </Card>
          </Card>

          <Card className="gear-card">
            <h1 className="subheader">Keldan Video Lights</h1>

            <div className="gear-container">
              <GearImageCarousel
                slides={[
                  {
                    src: '/keldan2.jpg',
                    alt: 'Keldan Light 1',
                    width: 500,
                    height: 500,
                  },
                  {
                    src: '/keldan1.png',
                    alt: 'Keldan Light 2',
                    width: 1020,
                    height: 902,
                  },
                ]}
                viewportWidth={windowWidth}
              />
            </div>

            <Card className="description-card p-4">
              <p>
                Keldan video lights provide high-output, natural-looking
                illumination underwater, essential for capturing vibrant colors
                at depth.
              </p>
            </Card>
          </Card>
          <Card className="gear-card">
            <h1 className="subheader">
              RED Komodo X Cinema Rig with Tilta Ring
            </h1>

            <div className="gear-container">
              <GearImageCarousel
                slides={[
                  {src: '/gear1.png', alt: 'Gear 1', width: 2456, height: 1636},
                  {src: '/gear2.png', alt: 'Gear 2', width: 1460, height: 1096},
                  {src: '/gear3.png', alt: 'Gear 3', width: 800, height: 600},
                ]}
                viewportWidth={windowWidth}
              />
            </div>

            <Card className="description-card p-4">
              <p>
                The Canon EOS R5C is a hybrid powerhouse, capable of 8K video
                recording and excellent still photography, making it perfect for
                underwater shooting.
              </p>
            </Card>
          </Card>

          <Card className="gear-card">
            <h1 className="subheader">Odyssey Freediving Fins</h1>

            <div className="gear-container">
              <GearImageCarousel
                slides={[
                  {
                    src: '/neptune.png',
                    alt: 'Keldan Light 1',
                    width: 1600,
                    height: 1598,
                  },
                  {
                    src: '/keldan1.png',
                    alt: 'Keldan Light 2',
                    width: 1020,
                    height: 902,
                  },
                ]}
                viewportWidth={windowWidth}
              />
            </div>

            <Card className="description-card p-4">
              <p>
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
              </p>
            </Card>
          </Card>
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
    </>
  );
}

// export default AboutPage;
