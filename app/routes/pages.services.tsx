import Sectiontitle from '~/components/global/Sectiontitle';
import '../styles/routeStyles/services.css';
import {Button} from '~/components/ui/button';
import {useEffect, useRef, useState} from 'react';
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
import {servicesImages1, servicesImages2} from '~/utils/constants';
import {useLoaderData, useLocation} from '@remix-run/react';
import {LoaderFunctionArgs, json} from '@remix-run/server-runtime';
import RecommendedProducts from '~/components/products/recommendedProducts';
import {
  FEATURED_COLLECTION_QUERY,
  RECOMMENDED_PRODUCTS_QUERY,
} from '~/lib/homeQueries';
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
  const deferredData = loadDeferredData(args);
  const criticalData = await loadCriticalData(args);

  return {...deferredData, ...criticalData};
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
  console.log(collection, 'collection');

  const location = useLocation();
  const [windowWidth, setWindowWidth] = useState<number | undefined>(undefined);
  const retryTimerRef = useRef<number | null>(null);
  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  });
  const getYOffset = () => {
    if (windowWidth == null) return -180; // sane default until measured
    if (windowWidth < 601) return -215;
    if (windowWidth >= 601 && windowWidth < 1280) return -180;
    return -75;
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

  const [isVideoReady, setIsVideoReady] = useState(false);

  const handleVideoLoad = () => {
    setTimeout(() => {
      setIsVideoReady(true); // Switch to video only when loaded
    }, 5000);
  };

  useEffect(() => {
    const iframe = document.querySelector('iframe');
    if (iframe) {
      iframe.addEventListener('load', handleVideoLoad);
    }
    return () => {
      if (iframe) {
        iframe.removeEventListener('load', handleVideoLoad);
      }
    };
  }, []);

  return (
    <>
      <div className="flex justify-center pb-5">
        <img
          src={'/services2.png'}
          style={{height: '110px'}}
          className="pt-3"
        />
      </div>

      <div
        className="anchors"
        style={{
          gridTemplateColumns: '1fr 1fr 1fr',
        }}
      >
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
      <section id="video">
        <Sectiontitle text="Underwater 8K Video" />
        <div className="flex flex-col items-center justify-center text-center main-services">
          <div className="media-container">
            <img
              src="/print3.jpg"
              className={`placeholder ${isVideoReady ? 'hidden' : ''}`}
            />
            <iframe
              src="https://player.vimeo.com/video/1018553050?autoplay=1&loop=1&muted=1&background=1"
              frameBorder="0"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              className={`video ${isVideoReady ? 'visible' : ''}`}
              title="Background Video"
            ></iframe>
          </div>
        </div>
      </section>
      <section id="photo" className="pt-3">
        <Sectiontitle text="Underwater 45mp Photo" />
        <div className="flex justify-center">
          <Carousel className="w-[85%]">
            <CarouselContent>
              {/* First item */}
              <CarouselItem>
                <div className="flex items-center justify-center h-full">
                  <div className="grid lg:grid-cols-3 grid-cols-2 gap-4 p-4">
                    {servicesImages1.map((imageURL, index) => (
                      <Card key={index} className="group overflow-hidden">
                        <CardContent className="p-0 cursor-pointer">
                          <img
                            src={imageURL}
                            className="h-auto object-cover transform group-hover:scale-105 transition-transform duration-500"
                          />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </CarouselItem>

              {/* Second item */}
              <CarouselItem>
                <div className="flex items-center justify-center h-full">
                  <div className="grid lg:grid-cols-3 grid-cols-2 gap-4 p-4">
                    {servicesImages2.map((imageURL, index) => (
                      <Card key={index} className="group overflow-hidden">
                        <CardContent className="p-0 cursor-pointer">
                          <img
                            src={imageURL}
                            className="h-auto object-cover transform group-hover:scale-105 transition-transform duration-500"
                          />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </CarouselItem>

              {/* Third item */}
              <CarouselItem>
                <div className="p-4 flex items-center justify-center">
                  <img src={'/images/gear3.png'} alt="" />
                </div>
              </CarouselItem>
            </CarouselContent>

            <CarouselPrevious className="" />
            <CarouselNext />
          </Carousel>
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
        <br />
        <div className="subheader-services flex justify-center">
          Commercial FAA drone operator with 5 years of experience in aerial
          cinematography.
        </div>
        <br />
        <div
          style={{
            gridTemplateColumns: '1fr 1fr',
          }}
          className="drone-titles"
        >
          <Card className=" group overflow-hidden px-8 pb-8 mx-5">
            <CardHeader className="text-center drone-title">
              <CardTitle>DJI Inspire 3</CardTitle>
            </CardHeader>
            <p className="flex justify-center pb-7 mt-[-15px] font-3xl">
              8.1K Full Frame, Pro Res Raw up to 60fps
            </p>
            <CardContent className="p-0">
              <img
                src={'/inspire3.jpg'}
                alt="DJI Inspire 3"
                className="h-auto object-cover transform group-hover:scale-105 transition-transform duration-500"
              />
            </CardContent>
          </Card>
          {/* /627592883 */}

          <Card className=" group overflow-hidden px-8 pb-8 mx-5">
            <CardHeader className="text-center drone-title">
              <CardTitle>FPV RED Komodo X</CardTitle>
            </CardHeader>
            <p className="flex justify-center pb-7 mt-[-15px]">
              6K Global Shutter, R3D Raw up to 75fps
            </p>
            <CardContent className="p-0">
              <img
                src={'/inspire3.jpg'}
                alt="DJI Inspire 3"
                className="h-auto object-cover transform group-hover:scale-105 transition-transform duration-500"
              />
            </CardContent>
          </Card>
          {/* /522510112 */}
        </div>
        <br />
        <div className="subheader-services flex justify-center">
          Check out my drone website at{' '}
        </div>
        <div className="subheader-services flex justify-center">
          <a
            href="https://gifts.worldwildlife.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 underline"
          >
            flywithadam.com
          </a>
        </div>
      </section>
      <section>
        <div className="flex justify-center pt-5">
          <img src={'/featured.png'} className="featured-img" />
        </div>
        <div className="flex justify-center font-bold text-xl pb-2">
          <p>Framed Canvas Wall Art</p>
        </div>
      </section>

      <RecommendedProducts products={collection?.recommendedProducts} />
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
    </>
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
