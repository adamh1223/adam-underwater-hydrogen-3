import Sectiontitle from '~/components/global/Sectiontitle';
import '../styles/routeStyles/services.css';
import {Button} from '~/components/ui/button';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {type MetaFunction} from '@remix-run/react';
import {redirect} from '@shopify/remix-oxygen';
import {getRedirectPathFromLegacyPagePath} from '~/lib/pagePaths';

export const meta: MetaFunction = () => {
  const title = 'Underwater Video & Photo Services | Adam Underwater — San Diego, CA';
  const description =
    'Professional underwater photography and videography services in San Diego. 45MP underwater photo, 4K underwater video, and drone video and photo. Book Adam Underwater for your next shoot.';

  return [
    {title},
    {name: 'title', content: title},
    {name: 'description', content: description},
    {
      tagName: 'link',
      rel: 'canonical',
      href: 'https://adamunderwater.com/services',
    },
    {property: 'og:type', content: 'website'},
    {property: 'og:title', content: title},
    {property: 'og:description', content: description},
    {property: 'og:url', content: 'https://adamunderwater.com/services'},
    {name: 'twitter:card', content: 'summary_large_image'},
    {name: 'twitter:title', content: title},
    {name: 'twitter:description', content: description},
  ];
};
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '~/components/ui/carousel';
import {
  servicesImages1,
  servicesImages2,
  servicesImages11,
  servicesImages12,
  servicesImages13,
  servicesImages21,
  servicesImages22,
  servicesImages23,
} from '~/utils/constants';
import {useLoaderData, useLocation} from '@remix-run/react';
import {LoaderFunctionArgs} from '@remix-run/server-runtime';
import RecommendedProducts from '~/components/products/recommendedProducts';
import {
  FEATURED_COLLECTION_QUERY,
  RECOMMENDED_PRODUCTS_QUERY,
} from '~/lib/homeQueries';
import HeroServices from '~/components/hero/HeroServices';
import VideoPreview from '~/components/global/VideoPreview';
import {CUSTOMER_WISHLIST} from '~/lib/customerQueries';
import {CarouselZoom} from 'components/ui/shadcn-io/carousel-zoom';
import {useTouchCardHighlight} from '~/lib/touchCardHighlight';
import ServicesPageSkeleton from '~/components/skeletons/ServicesPageSkeleton';
import {SkeletonGate} from '~/components/skeletons/shared';
import {warmImageUrls} from '~/lib/imageWarmup';

// export async function loader({context}: LoaderFunctionArgs) {
//   const {storefront} = context;
//   const {collection} = await storefront.query(COLLECTION_QUERY, {
//     variables: {handle: 'photography_images'},
//   });
//   const images = collection.metafield.references.edges;
//   return {collection};
// }
// same issue as recommended products
export async function loader(args: LoaderFunctionArgs) {
  const url = new URL(args.request.url);
  const redirectPath = getRedirectPathFromLegacyPagePath(url.pathname);
  if (redirectPath) {
    throw redirect(`${redirectPath}${url.search}`, 301);
  }

  const deferredData = loadDeferredData(args);
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
function ServicesPage() {
  const collection = useLoaderData<typeof loader>() || {};

  const location = useLocation();

  const [isFeaturedImageReady, setIsFeaturedImageReady] = useState(false);
  const [isHeroPosterReady, setIsHeroPosterReady] = useState(false);
  const [isPhotoCarouselReady, setIsPhotoCarouselReady] = useState(false);
  const featuredImgRef = useRef<HTMLImageElement>(null);
  const [windowWidth, setWindowWidth] = useState<number | undefined>(() =>
    typeof window !== 'undefined' ? window.innerWidth : undefined,
  );
  const retryTimerRef = useRef<number | null>(null);
  const isPageReady =
    isFeaturedImageReady &&
    isHeroPosterReady &&
    isPhotoCarouselReady &&
    windowWidth !== undefined;

  const handleFeaturedImgLoad = useCallback(() => {
    setIsFeaturedImageReady(true);
  }, []);

  // Catch cached images whose onLoad fired before React hydrated
  useEffect(() => {
    const img = featuredImgRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      handleFeaturedImgLoad();
    }
  }, [handleFeaturedImgLoad]);
  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const getYOffset = () => {
    if (windowWidth == null) return -180;
    if (windowWidth < 1024) return -110;
    if (windowWidth >= 1024) return -70;
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
    // clear any pending retry timer if effect re-runs
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    const saved = (() => {
      try {
        return sessionStorage.getItem('services-scroll-target');
      } catch {
        return null;
      }
    })();

    const hashTarget = location.hash ? location.hash.replace('#', '') : null;
    const target = hashTarget || saved;
    if (!target) return;

    // Try to scroll; if target not found yet in DOM, retry a few times
    let attempts = 0;
    const maxAttempts = 20;
    const delayMs = 100;

    const tryScroll = () => {
      attempts++;
      const ok = scrollToSection(target);
      if (ok) {
        try {
          sessionStorage.removeItem('services-scroll-target');
        } catch {}
        return;
      }
      if (attempts >= maxAttempts) {
        // give up
        try {
          sessionStorage.removeItem('services-scroll-target');
        } catch {}
        return;
      }
      retryTimerRef.current = window.setTimeout(tryScroll, delayMs);
    };

    // small initial delay to let layout happen
    retryTimerRef.current = window.setTimeout(tryScroll, 50);

    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [location, windowWidth]);

  const servicesPhotoImages = useMemo(
    () =>
      Array.from(
        new Set([
          ...servicesImages1,
          ...servicesImages2,
          ...servicesImages11,
          ...servicesImages12,
          ...servicesImages13,
          ...servicesImages21,
          ...servicesImages22,
          ...servicesImages23,
        ]),
      ),
    [],
  );

  const initialServicesPhotoImages = useMemo(() => {
    if (windowWidth === undefined) return [];
    return windowWidth < 768 ? servicesImages11 : servicesImages1;
  }, [windowWidth]);

  useEffect(() => {
    if (!initialServicesPhotoImages.length) return;

    let cancelled = false;

    void warmImageUrls(initialServicesPhotoImages).then(() => {
      if (!cancelled) {
        setIsPhotoCarouselReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [initialServicesPhotoImages]);

  const servicesPhotoZoomItems = useMemo(
    () => servicesPhotoImages.map((url) => ({url, type: 'image'})),
    [servicesPhotoImages],
  );

  const servicesPhotoIndexByUrl = useMemo(
    () =>
      new Map(servicesPhotoImages.map((url, index) => [url, index] as const)),
    [servicesPhotoImages],
  );

  const droneFocusWithinCardEffects =
    ' focus-within:border-primary focus-within:shadow-[0_0_0_1px_hsl(var(--primary)/0.5),0_0_20px_hsl(var(--primary)/0.35)]';
  const droneHoverCardEffects = `transition-[border-color,box-shadow] duration-300 hover:border-primary hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.5),0_0_20px_hsl(var(--primary)/0.35)] active:border-primary active:shadow-[0_0_0_1px_hsl(var(--primary)/0.5),0_0_20px_hsl(var(--primary)/0.35)]${droneFocusWithinCardEffects}`;
  const droneTouchCardEffects =
    'border-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.5),0_0_20px_hsl(var(--primary)/0.35)]';

  const djiDroneTouchCardId = 'services-drone-card:dji-inspire-3';
  const fpvDroneTouchCardId = 'services-drone-card:fpv-red-komodo-x';
  const [activeDronePreview, setActiveDronePreview] = useState<
    'dji' | 'fpv' | null
  >(null);
  const droneWebsiteUrl = 'https://flywithadam.com';

  const {
    isTouchHighlighted: isDjiDroneTouchHighlighted,
    touchHighlightHandlers: djiDroneTouchHighlightHandlers,
  } = useTouchCardHighlight(djiDroneTouchCardId);
  const {
    isTouchHighlighted: isFpvDroneTouchHighlighted,
    touchHighlightHandlers: fpvDroneTouchHighlightHandlers,
  } = useTouchCardHighlight(fpvDroneTouchCardId);

  const renderServicesPhotoCard = (
    imageURL: string,
    key: string | number,
    openServicesPhotoAtIndex: (
      index: number,
      options?: {autoplay?: boolean},
    ) => void,
  ) => (
    <Card key={key} className="group overflow-hidden aspect-[4/3]">
      <CardContent className="p-0 cursor-pointer h-full w-full">
        <div className="h-full w-full overflow-hidden">
          <button
            type="button"
            onClick={() =>
              openServicesPhotoAtIndex(
                servicesPhotoIndexByUrl.get(imageURL) ?? 0,
              )
            }
            className="block h-full w-full cursor-zoom-in"
            aria-label="Open photo gallery"
          >
            <img
              src={imageURL}
              alt=""
              className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500 cursor-zoom-in"
            />
          </button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <SkeletonGate isReady={isPageReady} skeleton={<ServicesPageSkeleton />}>
      <div className="services-header-container">
        <img
          src={
            'https://downloads.adamunderwater.com/store-1-au/public/icon.png'
          }
          alt="Adam Underwater logo"
          className="icon-header"
        />

        <img
          src={
            'https://downloads.adamunderwater.com/store-1-au/public/services.png'
          }
          alt="Underwater video and photo services by Adam Underwater"
          className="services-header"
        />
      </div>

      <div className="anchors mb-2">
        <Button variant="outline" className="anchor">
          <a onClick={(evt) => handleClick('video', evt)}>Underwater Video</a>
        </Button>
        <Button variant="outline" className="anchor">
          <a onClick={(evt) => handleClick('photo', evt)}>Underwater Photo</a>
        </Button>
        <Button variant="outline" className="anchor">
          <a onClick={(evt) => handleClick('drone', evt)}>
            Drone Video & Photo
          </a>
        </Button>
        {/* <Button variant="outline" className="anchor">
          <a onClick={(evt) => handleClick('dives', evt)}>Guided Dives</a>
        </Button> */}
        {/* <Button variant="outline" className="anchor">
          <a onClick={(evt) => handleClick('coaching', evt)}>1 on 1 Coaching</a>
        </Button> */}
      </div>
      <HeroServices onPosterLoad={() => setIsHeroPosterReady(true)} />
      <section id="photo" className="pt-3">
        <Sectiontitle text="Underwater 45mp Photo" />
        <div className="flex justify-center">
          <CarouselZoom items={servicesPhotoZoomItems}>
            {(openServicesPhotoAtIndex) => (
              <Carousel className="w-[85%] photography-carousel">
                <CarouselContent>
                  {/* large and medium viewport */}
                  {windowWidth != undefined && windowWidth >= 768 && (
                    <>
                      <CarouselItem>
                        <div className="flex items-center justify-center h-full">
                          <div className="grid lg:grid-cols-3 md:grid-cols-2 sm:grid-cols-1 gap-4 p-4">
                            {servicesImages1.map((imageURL, index) =>
                              renderServicesPhotoCard(
                                imageURL,
                                `servicesImages1-${index}`,
                                openServicesPhotoAtIndex,
                              ),
                            )}
                          </div>
                        </div>
                      </CarouselItem>

                      <CarouselItem>
                        <div className="flex items-center justify-center h-full">
                          <div className="grid lg:grid-cols-3 grid-cols-2 gap-4 p-4">
                            {servicesImages2.map((imageURL, index) =>
                              renderServicesPhotoCard(
                                imageURL,
                                `servicesImages2-${index}`,
                                openServicesPhotoAtIndex,
                              ),
                            )}
                          </div>
                        </div>
                      </CarouselItem>
                    </>
                  )}
                  {/* small viewport */}
                  {windowWidth != undefined && windowWidth < 768 && (
                    <>
                      <CarouselItem>
                        <div className="flex items-center justify-center h-full">
                          <div className="grid lg:grid-cols-3 md:grid-cols-2 sm:grid-cols-1 gap-4 p-4">
                            {servicesImages11.map((imageURL, index) =>
                              renderServicesPhotoCard(
                                imageURL,
                                `servicesImages11-${index}`,
                                openServicesPhotoAtIndex,
                              ),
                            )}
                          </div>
                        </div>
                      </CarouselItem>
                      <CarouselItem>
                        <div className="flex items-center justify-center h-full">
                          <div className="grid lg:grid-cols-3 md:grid-cols-2 sm:grid-cols-1 gap-4 p-4">
                            {servicesImages12.map((imageURL, index) =>
                              renderServicesPhotoCard(
                                imageURL,
                                `servicesImages12-${index}`,
                                openServicesPhotoAtIndex,
                              ),
                            )}
                          </div>
                        </div>
                      </CarouselItem>
                      <CarouselItem>
                        <div className="flex items-center justify-center h-full">
                          <div className="grid lg:grid-cols-3 md:grid-cols-2 sm:grid-cols-1 gap-4 p-4">
                            {servicesImages13.map((imageURL, index) =>
                              renderServicesPhotoCard(
                                imageURL,
                                `servicesImages13-${index}`,
                                openServicesPhotoAtIndex,
                              ),
                            )}
                          </div>
                        </div>
                      </CarouselItem>
                      <CarouselItem>
                        <div className="flex items-center justify-center h-full">
                          <div className="grid lg:grid-cols-3 md:grid-cols-2 sm:grid-cols-1 gap-4 p-4">
                            {servicesImages21.map((imageURL, index) =>
                              renderServicesPhotoCard(
                                imageURL,
                                `servicesImages21-${index}`,
                                openServicesPhotoAtIndex,
                              ),
                            )}
                          </div>
                        </div>
                      </CarouselItem>
                      <CarouselItem>
                        <div className="flex items-center justify-center h-full">
                          <div className="grid lg:grid-cols-3 md:grid-cols-2 sm:grid-cols-1 gap-4 p-4">
                            {servicesImages22.map((imageURL, index) =>
                              renderServicesPhotoCard(
                                imageURL,
                                `servicesImages22-${index}`,
                                openServicesPhotoAtIndex,
                              ),
                            )}
                          </div>
                        </div>
                      </CarouselItem>
                      <CarouselItem>
                        <div className="flex items-center justify-center h-full">
                          <div className="grid lg:grid-cols-3 md:grid-cols-2 sm:grid-cols-1 gap-4 p-4">
                            {servicesImages23.map((imageURL, index) =>
                              renderServicesPhotoCard(
                                imageURL,
                                `servicesImages23-${index}`,
                                openServicesPhotoAtIndex,
                              ),
                            )}
                          </div>
                        </div>
                      </CarouselItem>
                    </>
                  )}
                </CarouselContent>
                <CarouselPrevious inTheBox style={{left: '-24px'}} />
                <CarouselNext inTheBox style={{right: '-24px'}} />
              </Carousel>
            )}
          </CarouselZoom>
        </div>
      </section>

      {/* <section id="dives">
        <Sectiontitle text="Guided Dives" />
        <ul className="subheader">
          <h1>San Diego, CA</h1>
        </ul>
        <div className="cards-container">
          <div className="card">
            <Card>
              <CardHeader>
                <CardTitle>Guided Scuba Dive</CardTitle>
                <CardDescription>Scuba Certification required</CardDescription>
              </CardHeader>
              <CardContent>
                <p>hi</p>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="anchor">
                  Book Now
                </Button>
              </CardFooter>
            </Card>
          </div>
          <div className="card">
            <Card>
              <CardHeader>
                <CardTitle>Guided Snorkel Tour</CardTitle>
                <CardDescription>Card Description</CardDescription>
              </CardHeader>
              <CardContent>
                <p>Card Content</p>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="anchor">
                  Book Now
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </section> */}
      <section id="drone">
        <Sectiontitle text="Drone Video & Photo" />

        <div className="subheader-services flex justify-center">
          Commercial FAA drone operator with 7 years of experience in aerial
          cinematography.
        </div>

        <div className="drone-titles">
          <Card
            className={`group relative flex flex-col overflow-hidden px-3 pb-3 h-full min-w-0 w-full ${droneHoverCardEffects} ${isDjiDroneTouchHighlighted ? droneTouchCardEffects : ''}`.trim()}
            style={{touchAction: 'pan-y'}}
            data-touch-highlight-card-id={djiDroneTouchCardId}
            onMouseEnter={() => setActiveDronePreview('dji')}
            onMouseLeave={() =>
              setActiveDronePreview((current) =>
                current === 'dji' ? null : current,
              )
            }
            onPointerDownCapture={(event) => {
              djiDroneTouchHighlightHandlers.onPointerDownCapture(event);
              setActiveDronePreview('dji');
            }}
            onTouchStartCapture={(event) => {
              djiDroneTouchHighlightHandlers.onTouchStartCapture(event);
              setActiveDronePreview('dji');
            }}
          >
            <a
              href={droneWebsiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open flywithadam.com for DJI Inspire 3"
              className="absolute inset-0 z-10 rounded-xl"
            />
            <CardHeader className="text-center drone-title">
              <CardTitle>DJI Inspire 3</CardTitle>
            </CardHeader>
            <p className="flex justify-center pb-3 mt-[-15px] font-3xl">
              8.1K Full Frame, Pro Res Raw up to 60fps
            </p>
            <CardContent className="p-0 mt-auto">
              {/* <img
                src={'https://downloads.adamunderwater.com/store-1-au/public/inspire3.jpg'}
                alt="DJI Inspire 3"
                className="h-auto object-cover transform group-hover:scale-105 transition-transform duration-500"
              /> */}
              <VideoPreview
                src="529029170"
                posterSrc="https://downloads.adamunderwater.com/store-1-au/public/dji-inspire-3.jpg"
                mobilePosterSrc="https://downloads.adamunderwater.com/store-1-au/public/services-drone.JPG"
                isActive={activeDronePreview === 'dji'}
                extraClassName="services-drone-preview"
                revealDelayMs={1400}
                loadFallbackDelayMs={2800}
              />
            </CardContent>
          </Card>
          {/* /627592883 */}

          <Card
            className={`group relative flex flex-col overflow-hidden px-3 pb-3 h-full min-w-0 w-full ${droneHoverCardEffects} ${isFpvDroneTouchHighlighted ? droneTouchCardEffects : ''}`.trim()}
            style={{touchAction: 'pan-y'}}
            data-touch-highlight-card-id={fpvDroneTouchCardId}
            onMouseEnter={() => setActiveDronePreview('fpv')}
            onMouseLeave={() =>
              setActiveDronePreview((current) =>
                current === 'fpv' ? null : current,
              )
            }
            onPointerDownCapture={(event) => {
              fpvDroneTouchHighlightHandlers.onPointerDownCapture(event);
              setActiveDronePreview('fpv');
            }}
            onTouchStartCapture={(event) => {
              fpvDroneTouchHighlightHandlers.onTouchStartCapture(event);
              setActiveDronePreview('fpv');
            }}
          >
            <a
              href={droneWebsiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open flywithadam.com for FPV RED Komodo X"
              className="absolute inset-0 z-10 rounded-xl"
            />
            <CardHeader className="text-center drone-title">
              <CardTitle>FPV RED Komodo X</CardTitle>
            </CardHeader>
            <p className="flex justify-center pb-3 mt-[-15px]">
              6K Global Shutter, R3D Raw up to 75fps
            </p>
            <CardContent className="p-0 mt-auto">
              {/* <img
                src={'https://downloads.adamunderwater.com/store-1-au/public/inspire3.jpg'}
                alt="DJI Inspire 3"
                className="h-auto object-cover transform group-hover:scale-105 transition-transform duration-500"
              /> */}
              <VideoPreview
                src="627592883"
                posterSrc="https://downloads.adamunderwater.com/store-1-au/public/fpv-red.jpg"
                mobilePosterSrc="https://downloads.adamunderwater.com/store-1-au/public/services-drone.JPG"
                isActive={activeDronePreview === 'fpv'}
                extraClassName="services-drone-preview"
              />
            </CardContent>
          </Card>
          {/* /522510112 */}
        </div>

        <div className="subheader-services flex justify-center text-lg">
          For drone shoot inquiries and drone rentals, visit:{' '}
        </div>
        <div className="flex justify-center">
          <a
            href={droneWebsiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className=""
          >
            <Button size="lg">flywithadam.com</Button>
          </a>
        </div>
      </section>
      <section>
        <div className="flex justify-center me-4">
          <img
            ref={featuredImgRef}
            src={
              'https://downloads.adamunderwater.com/store-1-au/public/featured6.png'
            }
            alt="Featured framed canvas wall art — underwater photography prints by Adam Underwater"
            className="featured-img"
            onLoad={handleFeaturedImgLoad}
          />
        </div>
        <div className="flex justify-center font-bold text-xl pb-2">
          <p>Framed Canvas Wall Art</p>
        </div>
      </section>

      <RecommendedProducts
        products={collection?.recommendedProducts}
        wishlistProducts={collection.wishlistProducts}
        isLoggedIn={collection.isLoggedIn}
      />
      {/* <section id="coaching">
        <Sectiontitle text="1 on 1 Coaching" />
        <ul className="subheader">
          <h1>Zoom coaching sessions</h1>
        </ul>
        <ul>
          <li>
            I am happy to provide coaching sessions for anyone interested in
            Underwater videography or photography.
          </li>
          <li>
            Topics include: underwater camera gear questions and
            recommendations, composing cinematic shots underwater, landing
            paying clients as an underwater cinematographer, building a brand,
            feature film advice, and creative direction
          </li>
          <li>The first coaching session is 50% off.</li>
        </ul>
      </section> */}
    </SkeletonGate>
  );
}
const COLLECTION_QUERY = `#graphql
query photographyImagesCollection ($handle: String!) {
  collection (handle: $handle) {
    id
    title
    metafield(namespace: "custom", key: "photography_images") {
      value
      type
      reference {
        ... on MediaImage {
          image {
            url
            altText
            }
          }
        }
      references(first: 20) {
        edges {
          node {
            ... on MediaImage {
              image {
                url
                altText
                }
              }
            }
          }
        }
      }
    }
}`;
export default ServicesPage;
