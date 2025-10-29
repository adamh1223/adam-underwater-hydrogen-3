import {type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {
  useLoaderData,
  type MetaFunction,
  Link,
  useRouteLoaderData,
} from '@remix-run/react';
import {
  getSelectedProductOptions,
  Analytics,
  useOptimisticVariant,
  getProductOptions,
  getAdjacentAndFirstAvailableVariants,
  useSelectedOptionInUrlParam,
} from '@shopify/hydrogen';
import {ProductPrice} from '~/components/ProductPrice';
import {ProductImage} from '~/components/ProductImage';
import {ProductForm} from '~/components/ProductForm';
import IndividualProduct from '~/components/products/individualProduct';
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeftIcon,
  ChevronRightIcon,
} from 'lucide-react';
import {Card, CardContent, CardHeader} from '~/components/ui/card';
import IndividualVideoProduct from '~/components/eproducts/IndividualVideoProduct';
import {ProductImages, SimpleProductImages} from '~/lib/types';
import {useEffect, useState} from 'react';
import {RootLoader} from '~/root';
import {useIsVideoInCart} from '~/lib/hooks';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '~/components/ui/accordion';
import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '~/components/ui/carousel';
import {ThreeUpCarousel} from '~/components/global/ThreeUpCarousel';
import {ThreeUpEProductCarousel} from '~/components/global/ThreeUpEProductCarousel';
import {Button} from '~/components/ui/button';
import {RECOMMENDED_PRODUCTS_QUERY} from '~/lib/homeQueries';
import SimpleRecommendedProducts from '~/components/products/simpleRecommendedProducts';

export const meta: MetaFunction<typeof loader> = ({data}) => {
  return [
    {title: `Hydrogen | ${data?.product.title ?? ''}`},
    {
      rel: 'canonical',
      href: `/products/${data?.product.handle}`,
    },
  ];
};

export async function loader(args: LoaderFunctionArgs) {
  // Start fetching non-critical data without blocking time to first byte
  const deferredData = loadDeferredData(args);

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  return {...deferredData, ...criticalData};
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

  if (!handle) {
    throw new Error('Expected product handle to be defined');
  }

  const [{product}] = await Promise.all([
    storefront.query(PRODUCT_QUERY, {
      variables: {handle, selectedOptions: getSelectedProductOptions(request)},
    }),
    storefront.query(RECOMMENDED_PRODUCTS_QUERY),
    // Add other queries here, so that they are loaded in parallel
  ]);

  if (!product?.id) {
    throw new Response(null, {status: 404});
  }

  return {
    product,
    cart: cart.get(),
  };
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData({context, params}: LoaderFunctionArgs) {
  // Put any API calls that is not critical to be available on first page render
  // For example: product reviews, product recommendations, social feeds.

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
// Use the same fix for about page recommended products
export default function Product() {
  const {product, recommendedProducts, cart} = useLoaderData<typeof loader>();
  console.log(recommendedProducts, 'product456');

  // Optimistically selects a variant with given available variant information
  const selectedVariant = useOptimisticVariant(
    product.selectedOrFirstAvailableVariant,
    getAdjacentAndFirstAvailableVariants(product),
  );

  // Sets the search param to the selected variant without navigation
  // only when no search params are set in the url
  useSelectedOptionInUrlParam(selectedVariant.selectedOptions);

  // Get the product options array
  const productOptions = getProductOptions({
    ...product,
    selectedOrFirstAvailableVariant: selectedVariant,
  });

  const {
    title,
    descriptionHtml,
    collections,
    images,
    featuredImage,
    selectedOrFirstAvailableVariant,
    tags,
  } = product;
  console.log(images, 'imgimg');

  const WMLink = tags.filter((tag: string) => tag.includes('wmlink'))?.[0];
  const parsedWMLink = WMLink?.split('_')[1];

  const productSizeMetafields = collections?.edges?.[2]?.node?.metafield;
  console.log(productSizeMetafields, 'pmf');

  const {references} = productSizeMetafields || {};
  // THREE COLUMN SIZES
  const threeColumnSizes = images?.nodes?.filter((item: any) => {
    if (item.altText?.includes('horizontal-3')) {
      return {
        url: item.url,
        altText: item.altText,
      };
    }
  });
  // TWO COLUMN SIZES
  const twoColumnSizes = images?.nodes?.filter((item: any) => {
    if (item.altText?.includes('horizontal-2')) {
      return {
        url: item.url,
        altText: item.altText,
      };
    }
  });
  // STANDARD HORIZONTAL SIZES
  const standardHorizontalSizes = images?.nodes?.filter((item: any) => {
    if (item.altText?.includes('horizontal-1')) {
      return {
        url: item.url,
        altText: item.altText,
      };
    }
  });
  // VERTICAL SIZES
  const verticalSizes = images?.nodes?.filter((item: any) => {
    if (item.altText?.includes('vertical-1')) {
      return {
        url: item.url,
        altText: item.altText,
      };
    }
  });

  const determineLayoutImages = (variant: any) => {
    const orientation = variant.title.split(' / ')[0];
    const layout = variant.title.split(' / ')[1];

    // We DO get orientation 'Vertical' or 'Landscape' this works.

    if (layout === 'Standard' && orientation === 'Landscape') {
      return standardHorizontalSizes;
    } else if (layout === 'Two Columns' && orientation === 'Landscape') {
      return twoColumnSizes;
    } else if (layout === 'Three Columns' && orientation === 'Landscape') {
      return threeColumnSizes;
    } else if (layout === 'Standard' && orientation === 'Vertical') {
      console.log(verticalSizes, 'vtimg');

      return verticalSizes;
    }
  };

  let layoutImagesToUse = determineLayoutImages(selectedVariant);

  // const imageURLs = images.nodes.map((item: {url: string}) => item.url);
  // console.log(product, '12121212');
  // const imagesToUse = images.nodes.map(
  //   (item: {url: string; altText: string}) => {
  //     if (selectedVariant.title.toLowerCase() === item.altText.split('_')[0]) {
  //       return item.url;
  //     }
  //   },
  // );
  console.log(images, '10img');

  const standardCarouselImages = images.nodes
    .map((image: any) => {
      if (image.url?.includes('hr-car')) {
        return image;
      }
    })
    .filter(Boolean);

  // horizontal sm
  const threeSixtyCarouselHorizontalSmallImages = images.nodes
    .map((image: any) => {
      if (image.url?.includes('360-hz-small-')) {
        return image;
      }
    })
    .filter(Boolean);

  // horizontal md
  const threeSixtyCarouselHorizontalMediumImages = images.nodes
    .map((image: any) => {
      if (image.url?.includes('360-hz-medium-')) {
        return image;
      }
    })
    .filter(Boolean);

  // horizontal lg
  const threeSixtyCarouselHorizontalLargeImages = images.nodes
    .map((image: any) => {
      if (image.url?.includes('360-hz-large-')) {
        return image;
      }
    })
    .filter(Boolean);

  // horizontal xl
  const threeSixtyCarouselHorizontalXLImages = images.nodes
    .map((image: any) => {
      if (image.url?.includes('360-hz-xl-')) {
        return image;
      }
    })
    .filter(Boolean);

  // vertical sm
  const threeSixtyCarouselVerticalSmallImages = images.nodes
    .map((image: any) => {
      if (image.url?.includes('360-vt-small-')) {
        return image;
      }
    })
    .filter(Boolean);

  // vertical md
  const threeSixtyCarouselVerticalMediumImages = images.nodes
    .map((image: any) => {
      if (image.url?.includes('360-vt-medium-')) {
        return image;
      }
    })
    .filter(Boolean);

  // vertical lg
  const threeSixtyCarouselVerticalLargeImages = images.nodes
    .map((image: any) => {
      if (image.url?.includes('360-vt-large-')) {
        return image;
      }
    })
    .filter(Boolean);

  // vertical xl
  const threeSixtyCarouselVerticalXLImages = images.nodes
    .map((image: any) => {
      if (image.url?.includes('360-vt-xl-')) {
        return image;
      }
    })
    .filter(Boolean);

  // const threeDImagesToUse =
  const determineThreeDImages = (variant: any) => {
    const orientation = variant.title.split(' / ')[0];
    const layout = variant.title.split(' / ')[1];
    const size = variant.title.split(' / ')[2];
    console.log(size, '1122334455');
    console.log(layout, '112233');
    console.log(orientation, '11223344');
    console.log(variant, '112233445566');

    // Standard Only, Horizontal and vertical all sizes
    // no two columns, no three columns any size

    // Standard, Landscape, small
    if (
      layout === 'Standard' &&
      orientation === 'Landscape' &&
      size === 'Small'
    ) {
      return threeSixtyCarouselHorizontalSmallImages;
    } else if (
      layout === 'Standard' &&
      orientation === 'Landscape' &&
      size === 'Medium'
    ) {
      // Standard, Landscape, medium
      return threeSixtyCarouselHorizontalMediumImages;
    } else if (
      layout === 'Standard' &&
      orientation === 'Landscape' &&
      size === 'Large'
    ) {
      // Standard, Landscape, large
      return threeSixtyCarouselHorizontalLargeImages;
    } else if (
      layout === 'Standard' &&
      orientation === 'Landscape' &&
      size === 'XL (Pickup Only)'
    ) {
      // Standard, Landscape, xl
      return threeSixtyCarouselHorizontalXLImages;
    } else if (
      layout === 'Standard' &&
      orientation === 'Vertical' &&
      size === 'Small'
    ) {
      // Standard, Vertical, small
      return threeSixtyCarouselVerticalSmallImages;
    } else if (
      layout === 'Standard' &&
      orientation === 'Vertical' &&
      size === 'Medium'
    ) {
      // Standard, Vertical, medium
      return threeSixtyCarouselVerticalMediumImages;
    } else if (
      layout === 'Standard' &&
      orientation === 'Vertical' &&
      size === 'Large'
    ) {
      // Standard, Vertical, large
      return threeSixtyCarouselVerticalLargeImages;
    } else if (
      layout === 'Standard' &&
      orientation === 'Vertical' &&
      size === 'XL (Pickup Only)'
    ) {
      // Standard, Vertical, xl
      return threeSixtyCarouselVerticalXLImages;
    } else if (layout === 'Two Columns') {
      return {};
    } else if (layout === 'Three Columns') {
      return {};
    } else {
      return {};
    }
  };

  let threeDImagesToUse = determineThreeDImages(selectedVariant);
  console.log(threeDImagesToUse, '3dimgs');

  const standardVerticalCarouselImages = images.nodes
    .map((image: any) => {
      if (image.url.includes('vt-car')) {
        return image;
      }
    })
    .filter(Boolean);
  // SECOND IMAGE
  const horizontalStandardSecondImg = images.nodes
    .map((image: any) => {
      if (image.url.includes('hz-1-second-img')) {
        return image;
      }
    })
    .filter(Boolean);
  const horizontalTwoColsSecondImg = images.nodes
    .map((image: any) => {
      if (image.url.includes('hz-2-second-img')) {
        return image;
      }
    })
    .filter(Boolean);
  const horizontalThreeColsSecondImg = images.nodes
    .map((image: any) => {
      if (image.url.includes('hz-3-second-img')) {
        return image;
      }
    })
    .filter(Boolean);
  const verticalSecondImg = images.nodes
    .map((image: any) => {
      if (image.url.includes('vt-second-img')) {
        return image;
      }
    })
    .filter(Boolean);
  console.log(verticalSecondImg, 'vvv');

  // WE ARE NOT GETTING VT SECOND IMG EVEN THO IT MATCHES. BUT IT DOES WORK ON HORPRIMARY. NOT VERTPRIMARY

  const orientation = selectedVariant.title.split(' / ')[0];
  const layout = selectedVariant.title.split(' / ')[1];

  // this adds the second image based on the layout and orientation
  if (layout === 'Standard' && orientation === 'Landscape') {
    standardCarouselImages.unshift(horizontalStandardSecondImg.pop());
  } else if (layout === 'Two Columns' && orientation === 'Landscape') {
    standardCarouselImages.unshift(horizontalTwoColsSecondImg.pop());
  } else if (layout === 'Three Columns' && orientation === 'Landscape') {
    standardCarouselImages.unshift(horizontalThreeColsSecondImg.pop());
  } else if (layout === 'Standard' && orientation === 'Vertical') {
    console.log(verticalSizes, 'vtimg');
    standardVerticalCarouselImages.unshift(verticalSecondImg.pop());
  }
  // add the main image first to each orientation
  standardVerticalCarouselImages.unshift(selectedVariant?.image);
  //
  standardCarouselImages.unshift(selectedVariant?.image);

  const isVideo = product.tags.includes('Video');
  // .includes((word: string) => {
  //   console.log(word, '3000');

  //   return word === 'Video';
  // });
  console.log(selectedVariant, '2000');
  let isHorOnly = product.tags
    .map((tag: any) => {
      if (tag.includes('horOnly')) {
        return tag;
      }
    })
    .filter(Boolean);

  let isHorPrimary = product.tags
    .map((tag: any) => {
      if (tag.includes('horPrimary')) {
        return tag;
      }
    })
    .filter(Boolean);
  let isVertOnly = product.tags
    .map((tag: any) => {
      if (tag.includes('vertOnly')) {
        return tag;
      }
    })
    .filter(Boolean);
  let isVertPrimary = product.tags
    .map((tag: any) => {
      if (tag.includes('vertPrimary')) {
        return tag;
      }
    })
    .filter(Boolean);
  console.log(isHorOnly, '7788isHorOnly');
  console.log(isHorPrimary, '7788isHorPrimary');
  console.log(isVertOnly, '7788isVertOnly');
  console.log(isVertPrimary, '7788isVertPrimary');

  // const standardCarouselImages = images.nodes
  //   .map((image: any) => {
  //     if (image.altText?.includes('horizontalCarousel')) {
  //       return image;
  //     }
  //   })
  //   .filter(Boolean);

  const locationTag = product.tags.find((t: string) => t?.startsWith?.('loc_'));
  let locationName: string | undefined;
  let locationState: string | undefined;
  let locationCountry: string | undefined;

  const titleCase = (w: string) =>
    w.length === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();

  if (locationTag) {
    const parts = locationTag.split('_');

    const extract = (base: 'locname' | 'locstate' | 'loccountry') => {
      const capsKey = `${base}caps`;
      const capsIdx = parts.indexOf(capsKey);
      const baseIdx = parts.indexOf(base);
      const idx = capsIdx !== -1 ? capsIdx : baseIdx;
      if (idx === -1) return undefined;

      // collect tokens after the key until next loc* signifier or end
      const valueParts: string[] = [];
      for (let i = idx + 1; i < parts.length; i++) {
        if (parts[i].startsWith('loc')) break;
        valueParts.push(parts[i]);
      }
      if (valueParts.length === 0) return undefined;

      const raw = valueParts.join(' ').trim();
      if (raw.toLowerCase() === 'null') return undefined;

      // caps key present -> force ALL CAPS
      if (capsIdx !== -1) return raw.toUpperCase();

      // locname -> always title-case each token (no short-token uppercasing)
      if (base === 'locname') {
        return valueParts.map(titleCase).join(' ');
      }

      // locstate / loccountry -> uppercase tokens <= 3 chars (CA, USA), otherwise title-case
      return valueParts
        .map((w) => (w.length <= 3 ? w.toUpperCase() : titleCase(w)))
        .join(' ');
    };

    locationName = extract('locname');
    locationState = extract('locstate');
    locationCountry = extract('loccountry');
  }

  const formattedLocation = [locationName, locationState, locationCountry]
    .filter(Boolean)
    .join(', ');

  // Example:
  // tag: loc_locname_san_miguel_island_locstatecaps_ca_loccountrycaps_usa
  // formattedLocation -> "San Miguel Island, CA, USA"

  Example: console.log(formattedLocation, 'qqq');

  const [windowWidth, setWindowWidth] = useState<number | undefined>(undefined);
  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  });

  const data = useRouteLoaderData<RootLoader>('root');

  const disableButton = useIsVideoInCart(
    selectedOrFirstAvailableVariant?.id,
    cart,
  );

  console.log(disableButton, '5511');
  const [carouselApi, setCarouselApi] = useState<CarouselApi | undefined>(
    undefined,
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  useEffect(() => {
    if (!carouselApi) return;

    const updateCarouselState = () => {
      setCurrentIndex(carouselApi.selectedScrollSnap());
      setTotalItems(carouselApi.scrollSnapList().length);
    };

    updateCarouselState();

    carouselApi.on('select', updateCarouselState);

    // Cleanup function
    return () => void carouselApi.off('select', updateCarouselState);
  }, [carouselApi]);

  const scrollToIndex = (index: number) => carouselApi?.scrollTo(index);

  const increaseIndex = (evt: React.MouseEvent<HTMLButtonElement>) => {
    evt.stopPropagation();

    scrollToIndex(currentIndex + 1);
  };

  console.log(currentIndex, 'index after');
  const decreaseIndex = (evt: React.MouseEvent<HTMLButtonElement>) => {
    evt.stopPropagation();
    scrollToIndex(currentIndex - 1);
  };
  console.log(standardVerticalCarouselImages, '999standardvertical');
  console.log(verticalSecondImg, '999vertical2nd');
  console.log(standardVerticalCarouselImages, '999standardvertical');
  console.log(standardVerticalCarouselImages, '999standardvertical');
  return (
    <>
      <section className="product px-[40px] pt-[20px]">
        {/* Link tree */}
        <ol className="flex flex-wrap items-center gap-1.5 break-words text-lg text-muted-foreground sm:gap-2.5">
          <li className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground">
            <Link to="/">Home</Link>
          </li>
          <li
            role="presentation"
            aria-hidden="true"
            className="[&>svg]:size-3.5"
          >
            {<ChevronRightIcon />}
          </li>
          {!isVideo && (
            <li className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground">
              <Link to="/collections/prints">Prints</Link>
            </li>
          )}
          {isVideo && (
            <li className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground">
              <Link to="/collections/stock">Stock Footage</Link>
            </li>
          )}
          <li
            role="presentation"
            aria-hidden="true"
            className="[&>svg]:size-3.5"
          >
            {<ChevronRightIcon />}
          </li>
          <li className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground">
            {title}
          </li>
        </ol>
        {windowWidth && windowWidth < 1024 && (
          <>
            <br />
            <h1 className="capitalize text-3xl font-bold">{title}</h1>
            {!isVideo && (
              <p className="text-muted-foreground">Framed Canvas Print</p>
            )}
            {isVideo && (
              <p className="text-muted-foreground">Stock Footage Video</p>
            )}
            <ProductPrice
              price={selectedVariant?.price}
              compareAtPrice={selectedVariant?.compareAtPrice}
            />
            <h4 className="text-xl mt-1 pb-4">{`${formattedLocation}`}</h4>
          </>
        )}
        {/* We are not getting a carousel when product only has vertical product images. We might need to conditionally render the individual product with and without giving it standardcarouselimages so it can still render in the absence of these. this means we have to make these optional, not mandatory, to pass into Individualproduct. */}
        <div className="lg:grid lg:grid-cols-2 lg:gap-x-12">
          {standardCarouselImages && standardCarouselImages?.length > 1 && (
            <IndividualProduct
              productName={title}
              productImages={standardCarouselImages}
              verticalProductImages={standardVerticalCarouselImages}
              orientation={orientation}
              threeDViewImages={threeDImagesToUse}
            ></IndividualProduct>
          )}
          {isVideo && (
            <IndividualVideoProduct
              productName={title}
              featuredImage={featuredImage?.url}
              WMLink={parsedWMLink}
            ></IndividualVideoProduct>
          )}
          {/* <ProductImage image={selectedVariant?.image} /> */}
          <div className="product-main">
            {windowWidth && windowWidth >= 1024 && (
              <>
                <h1 className="capitalize text-3xl font-bold">{title}</h1>
                {!isVideo && (
                  <p className="text-muted-foreground">Framed Canvas Print</p>
                )}
                {isVideo && (
                  <p className="text-muted-foreground">Stock Footage Video</p>
                )}
                <ProductPrice
                  price={selectedVariant?.price}
                  compareAtPrice={selectedVariant?.compareAtPrice}
                />
                <br />
                <h4 className="text-xl mt-1 pb-4">{`${formattedLocation}`}</h4>
              </>
            )}

            <div dangerouslySetInnerHTML={{__html: descriptionHtml}} />
            <br />

            <ProductForm
              VideoAlreadyInCart={disableButton}
              productOptions={productOptions}
              selectedVariant={selectedVariant}
              imagesToShow={layoutImagesToUse as SimpleProductImages[]}
            />
          </div>
        </div>
        {windowWidth && windowWidth < 1024 && !isVideo && (
          <>
            <hr />
            <div className="manufacturing-info-container grid grid-cols-3 h-[100px] py-3">
              <div className="grid grid-cols-1">
                <div className="flex justify-center items-center">
                  <img src={'/usaflag3.png'} style={{height: '2.2rem'}} />
                </div>
                <div className="flex justify-center mt-3">
                  <p>Made in USA</p>
                </div>
              </div>
              <div className="grid grid-cols-1">
                <div className="flex justify-center items-center">
                  <img src={'/diamond.png'} style={{height: '2.4rem'}} />
                </div>
                <div className="flex justify-center mt-2">
                  <p>Premium Quality</p>
                </div>
              </div>
              <div className="grid grid-cols-1">
                <div className="flex justify-center items-center">
                  <img src={'/returnarrow2.png'} style={{height: '2.7rem'}} />
                </div>
                <div className="flex justify-center">
                  <p>14-day returns</p>
                </div>
              </div>
            </div>
          </>
        )}
        {windowWidth && windowWidth < 1024 && !isVideo && (
          <div className="items-top ">
            <div className="flex justify-end card-accordion-container">
              <Card className="py-2 px-4 w-full">
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="item-1">
                    <AccordionTrigger>Print Specs</AccordionTrigger>
                    <AccordionContent>
                      <div className="print-specs">
                        {/* section body */}
                        <div className="print-specs-container-1">
                          <div className="column-1">
                            <div className="flex justify-center">
                              <img
                                src={'/printingprocess.png'}
                                style={{height: '2.7rem'}}
                              />
                            </div>
                            <div className="flex justify-center">
                              Printing Process
                            </div>
                            <div className="flex justify-center">
                              <Card className="w-[180px] md:w-[300px] lg:w-[190px] xl:w-[250px] my-2">
                                <CardContent>
                                  <div>
                                    Images are printed on the Canon
                                    ImagePro-Graf 4600 Pro and stretched over
                                    thick wooden frames using stretcher plyers.
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          </div>
                          <div className="column-2">
                            <div className="flex justify-center">
                              <img
                                src={'/antiglare.png'}
                                style={{height: '2.7rem'}}
                              />
                            </div>
                            <div className="flex justify-center">
                              Anti-glare
                            </div>
                            <div className="flex justify-center">
                              <Card className="w-[180px] md:w-[300px] lg:w-[190px] xl:w-[250px] my-2">
                                <CardContent>
                                  <div>
                                    The professional matte canvas that we use
                                    does not reflect light - the print will be
                                    viewable in any room and any wall.
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          </div>
                        </div>
                        <div className="print-specs-container-2">
                          <div className="column-1">
                            <div className="flex justify-center">
                              <img
                                src={'/paperquality2.png'}
                                style={{height: '2.7rem'}}
                              />
                            </div>
                            <div className="flex justify-center">
                              Paper Quality
                            </div>
                            <div className="flex justify-center">
                              <Card className="w-[180px] md:w-[300px] lg:w-[190px] xl:w-[250px] mt-2">
                                <CardContent>
                                  <div>
                                    Printed on 200 GSM, polyester inkjet matte
                                    canvas on the Canon ImagePro-graf 4600 on a
                                    44 inch roll.
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          </div>
                          <div className="column-2">
                            <div className="flex justify-center">
                              <img
                                src={'/durable.png'}
                                style={{height: '2.7rem'}}
                              />
                            </div>
                            <div className="flex justify-center">Durable</div>
                            <div className="flex justify-center">
                              <Card className="w-[180px] md:w-[300px] lg:w-[190px] xl:w-[250px] mt-2">
                                <CardContent>
                                  <div>
                                    Prints are professionally stretched over
                                    heavy duty wooden frames. Staples are
                                    methodically placed to allow even tension of
                                    the canvas.
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          </div>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-2">
                    <AccordionTrigger>Frame Specs</AccordionTrigger>
                    <AccordionContent>
                      <div className="frame-specs">
                        {/* section body */}
                        <div className="frame-specs-container-1">
                          <div className="column-1">
                            <div className="flex justify-center">
                              <img
                                src={'/handcrafted.png'}
                                style={{height: '2.7rem'}}
                              />
                            </div>
                            <div className="flex justify-center">
                              Handcrafted
                            </div>
                            <div className="flex justify-center">
                              <Card className="w-[180px] md:w-[300px] lg:w-[190px] xl:w-[250px] my-2">
                                <CardContent>
                                  <div>
                                    Each frame is assembled by hand. Canvas is
                                    stretched over frames using stretcher
                                    plyers, and stapled onto the back frame.
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          </div>
                          <div className="column-2">
                            <div className="flex justify-center">
                              <img
                                src={'/lightweight.png'}
                                style={{height: '2.7rem'}}
                              />
                            </div>
                            <div className="flex justify-center">
                              Light Weight
                            </div>
                            <div className="flex justify-center">
                              <Card className="w-[180px] md:w-[300px] lg:w-[190px] xl:w-[250px] my-2">
                                <CardContent>
                                  <div>
                                    Heavy duty and high quality canvas stretcher
                                    bars remove the need for extra wooden
                                    braces, reducing weight.
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          </div>
                        </div>
                        <div className="frame-specs-container-2">
                          <div className="column-1">
                            <div className="flex justify-center">
                              <img
                                src={'/phonetap.png'}
                                style={{height: '2.7rem'}}
                              />
                            </div>
                            <div className="flex justify-center">
                              Interactive
                            </div>
                            <div className="flex justify-center">
                              <Card className="w-[180px] md:w-[300px] lg:w-[190px] xl:w-[250px] mt-2">
                                <CardContent>
                                  <div>
                                    Tap your phone on the bottom right corner of
                                    the canvas to see the latest products at
                                    Adam Underwater.
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          </div>
                          <div className="column-2">
                            <div className="flex justify-center">
                              <img
                                src={'/readytohang.png'}
                                style={{height: '2.7rem'}}
                              />
                            </div>
                            <div className="flex justify-center">
                              Ready to Hang
                            </div>
                            <div className="flex justify-center">
                              <Card className="w-[180px] md:w-[300px] lg:w-[190px] xl:w-[250px] mt-2">
                                <CardContent>
                                  <div>
                                    Wire is installed on the back of each frame,
                                    and hanging materials are included. We
                                    recommend using 2 hangers for large prints.
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          </div>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </Card>
            </div>
          </div>
        )}
        {!isVideo && (
          <>
            <div className="lg:grid lg:grid-cols-2 lg:gap-x-12 extra-info">
              <div className="grid grid-cols-1">
                <div className="how-its-made">
                  {/* section title */}
                  <div className="section-title-container">
                    <div className="flex items-center justify-center w-full">
                      <div className="flex-1 h-px bg-muted" />
                      <span className="px-4">
                        <div>How it's Made</div>
                      </span>
                      <div className="flex-1 h-px bg-muted" />
                    </div>
                  </div>
                  {/* section body */}
                  <div className="how-its-made-container">
                    <div className="how-its-made-clip-wrapper flex justify-center position-relative">
                      <iframe
                        className="how-its-made-clip"
                        src="https://player.vimeo.com/video/814128392?badge=0&amp;autopause=0&amp;player_id=0&amp;app_id=58479"
                        allow="autoplay; fullscreen; picture-in-picture;"
                        title="Seaforestation Trailer"
                      ></iframe>
                    </div>
                    <div className="flex justify-center ">
                      <div className="how-its-made-description-container justify-start xl:mt-2">
                        <Card>
                          <CardContent>
                            Quality matters - In this video, I break down how I
                            make each framed canvas print by hand, using premium
                            materials.
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1">
                <div className="pt-[10px]">
                  {windowWidth && windowWidth >= 1024 && !isVideo && (
                    <>
                      <hr />
                      <div className="manufacturing-info-container grid grid-cols-3 h-[100px] py-3">
                        <div className="grid grid-cols-1">
                          <div className="flex justify-center items-center">
                            <img
                              src={'/usaflag3.png'}
                              style={{height: '2.2rem'}}
                            />
                          </div>
                          <div className="flex justify-center mt-3">
                            <p>Made in USA</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-1">
                          <div className="flex justify-center items-center">
                            <img
                              src={'/diamond.png'}
                              style={{height: '2.4rem'}}
                            />
                          </div>
                          <div className="flex justify-center mt-2">
                            <p>Premium Quality</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-1">
                          <div className="flex justify-center items-center">
                            <img
                              src={'/returnarrow2.png'}
                              style={{height: '2.7rem'}}
                            />
                          </div>
                          <div className="flex justify-center">
                            <p>14-day returns</p>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                {windowWidth && windowWidth >= 1024 && !isVideo && (
                  <div className="items-top ">
                    <div className="flex justify-end card-accordion-container">
                      <Card className="py-2 px-4 w-full">
                        <Accordion type="single" collapsible className="w-full">
                          <AccordionItem value="item-1">
                            <AccordionTrigger>Print Specs</AccordionTrigger>
                            <AccordionContent>
                              <div className="print-specs">
                                {/* section body */}
                                <div className="print-specs-container-1">
                                  <div className="column-1">
                                    <div className="flex justify-center">
                                      <img
                                        src={'/printingprocess.png'}
                                        style={{height: '2.7rem'}}
                                      />
                                    </div>
                                    <div className="flex justify-center">
                                      Printing Process
                                    </div>
                                    <div className="flex justify-center">
                                      <Card className="w-[180px] md:w-[300px] lg:w-[190px] xl:w-[250px] my-2">
                                        <CardContent>
                                          <div>
                                            Images are printed on the Canon
                                            ImagePro-Graf 4600 Pro and stretched
                                            over thick wooden frames using
                                            stretcher plyers.
                                          </div>
                                        </CardContent>
                                      </Card>
                                    </div>
                                  </div>
                                  <div className="column-2">
                                    <div className="flex justify-center">
                                      <img
                                        src={'/antiglare.png'}
                                        style={{height: '2.7rem'}}
                                      />
                                    </div>
                                    <div className="flex justify-center">
                                      Anti-glare
                                    </div>
                                    <div className="flex justify-center">
                                      <Card className="w-[180px] md:w-[300px] lg:w-[190px] xl:w-[250px] my-2">
                                        <CardContent>
                                          <div>
                                            The professional matte canvas that
                                            we use does not reflect light - the
                                            print will be viewable in any room
                                            and any wall.
                                          </div>
                                        </CardContent>
                                      </Card>
                                    </div>
                                  </div>
                                </div>
                                <div className="print-specs-container-2">
                                  <div className="column-1">
                                    <div className="flex justify-center">
                                      <img
                                        src={'/paperquality2.png'}
                                        style={{height: '2.7rem'}}
                                      />
                                    </div>
                                    <div className="flex justify-center">
                                      Paper Quality
                                    </div>
                                    <div className="flex justify-center">
                                      <Card className="w-[180px] md:w-[300px] lg:w-[190px] xl:w-[250px] mt-2">
                                        <CardContent>
                                          <div>
                                            Printed on 200 GSM, polyester inkjet
                                            matte canvas on the Canon
                                            ImagePro-graf 4600 on a 44 inch
                                            roll.
                                          </div>
                                        </CardContent>
                                      </Card>
                                    </div>
                                  </div>
                                  <div className="column-2">
                                    <div className="flex justify-center">
                                      <img
                                        src={'/durable.png'}
                                        style={{height: '2.7rem'}}
                                      />
                                    </div>
                                    <div className="flex justify-center">
                                      Durable
                                    </div>
                                    <div className="flex justify-center">
                                      <Card className="w-[180px] md:w-[300px] lg:w-[190px] xl:w-[250px] mt-2">
                                        <CardContent>
                                          <div>
                                            Prints are professionally stretched
                                            over heavy duty wooden frames.
                                            Staples are methodically placed to
                                            allow even tension of the canvas.
                                          </div>
                                        </CardContent>
                                      </Card>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                          <AccordionItem value="item-2">
                            <AccordionTrigger>Frame Specs</AccordionTrigger>
                            <AccordionContent>
                              <div className="frame-specs">
                                {/* section body */}
                                <div className="frame-specs-container-1">
                                  <div className="column-1">
                                    <div className="flex justify-center">
                                      <img
                                        src={'/handcrafted.png'}
                                        style={{height: '2.7rem'}}
                                      />
                                    </div>
                                    <div className="flex justify-center">
                                      Handcrafted
                                    </div>
                                    <div className="flex justify-center">
                                      <Card className="w-[180px] md:w-[300px] lg:w-[190px] xl:w-[250px] my-2">
                                        <CardContent>
                                          <div>
                                            Each frame is assembled by hand.
                                            Canvas is stretched over frames
                                            using stretcher plyers, and stapled
                                            onto the back frame.
                                          </div>
                                        </CardContent>
                                      </Card>
                                    </div>
                                  </div>
                                  <div className="column-2">
                                    <div className="flex justify-center">
                                      <img
                                        src={'/lightweight.png'}
                                        style={{height: '2.7rem'}}
                                      />
                                    </div>
                                    <div className="flex justify-center">
                                      Light Weight
                                    </div>
                                    <div className="flex justify-center">
                                      <Card className="w-[180px] md:w-[300px] lg:w-[190px] xl:w-[250px] my-2">
                                        <CardContent>
                                          <div>
                                            Heavy duty and high quality canvas
                                            stretcher bars remove the need for
                                            extra wooden braces, reducing
                                            weight.
                                          </div>
                                        </CardContent>
                                      </Card>
                                    </div>
                                  </div>
                                </div>
                                <div className="frame-specs-container-2">
                                  <div className="column-1">
                                    <div className="flex justify-center">
                                      <img
                                        src={'/phonetap.png'}
                                        style={{height: '2.7rem'}}
                                      />
                                    </div>
                                    <div className="flex justify-center">
                                      Interactive
                                    </div>
                                    <div className="flex justify-center">
                                      <Card className="w-[180px] md:w-[300px] lg:w-[190px] xl:w-[250px] mt-2">
                                        <CardContent>
                                          <div>
                                            Tap your phone on the bottom right
                                            corner of the canvas to see the
                                            latest products at Adam Underwater.
                                          </div>
                                        </CardContent>
                                      </Card>
                                    </div>
                                  </div>
                                  <div className="column-2">
                                    <div className="flex justify-center">
                                      <img
                                        src={'/readytohang.png'}
                                        style={{height: '2.7rem'}}
                                      />
                                    </div>
                                    <div className="flex justify-center">
                                      Ready to Hang
                                    </div>
                                    <div className="flex justify-center">
                                      <Card className="w-[180px] md:w-[300px] lg:w-[190px] xl:w-[250px] mt-2">
                                        <CardContent>
                                          <div>
                                            Wire is installed on the back of
                                            each frame, and hanging materials
                                            are included. We recommend using 2
                                            hangers for large prints.
                                          </div>
                                        </CardContent>
                                      </Card>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      </Card>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
        {!isVideo && (
          <section className="in-the-box-section mt-3">
            {/* section title */}
            <div className="section-title-container">
              <div className="flex items-center justify-center w-full">
                <div className="flex-1 h-px bg-muted" />
                <span className="px-4">
                  <p className="text-xl">In the Box</p>
                </span>
                <div className="flex-1 h-px bg-muted" />
              </div>
            </div>
            <div className="my-5 grid sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 sm:gap-x-0 md:gap-x-5 lg:gap-x-5 sm:mx-[40px] md:mx-[40px] lg:mx-[50px] xl:mx-[120px]">
              <div className="in-the-box in-the-box-1 flex justify-center">
                <Card>
                  <CardHeader>
                    <div className="flex justify-start">
                      <img src={'/1x-icon-2.png'} style={{height: '2rem'}} />
                    </div>
                    <div className="flex justify-center">
                      <strong>Canvas Print</strong>
                    </div>
                    <hr />
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-center">
                      <Carousel className="w-full max-w-sm px-[25px]">
                        <CarouselContent>
                          <CarouselItem>
                            <div className="p-4 flex items-center justify-center">
                              <img src={'/gear1.png'} alt="Gear 1" />
                            </div>
                          </CarouselItem>
                          <CarouselItem>
                            <div className="p-4 flex items-center justify-center">
                              <img src={'/gear2.png'} alt="Gear 2" />
                            </div>
                          </CarouselItem>
                          <CarouselItem>
                            <div className="p-4 flex items-center justify-center">
                              <img src={'/gear3.png'} alt="Gear 3" />
                            </div>
                          </CarouselItem>
                        </CarouselContent>

                        <CarouselPrevious inTheBox />
                        <CarouselNext inTheBox />
                      </Carousel>
                    </div>
                    <div className="in-the-box-description flex justify-center pb-2">
                      <div className="max-w-[85%]">
                        Each framed print comes with heavy duty hanging wire
                        attached
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              <div className="in-the-box in-the-box-2 flex justify-center">
                <Card>
                  <CardHeader>
                    <div className="flex justify-start">
                      <img src={'/1x-icon-2.png'} style={{height: '2rem'}} />
                    </div>
                    <div className="flex justify-center">
                      <strong>NFC Tag in bottom right corner</strong>
                    </div>
                    <hr />
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-center">
                      <Carousel className="w-full max-w-sm px-[25px]">
                        <CarouselContent>
                          <CarouselItem>
                            <div className="p-4 flex items-center justify-center">
                              <img src={'/gear1.png'} alt="Gear 1" />
                            </div>
                          </CarouselItem>
                          <CarouselItem>
                            <div className="p-4 flex items-center justify-center">
                              <img src={'/gear2.png'} alt="Gear 2" />
                            </div>
                          </CarouselItem>
                          <CarouselItem>
                            <div className="p-4 flex items-center justify-center">
                              <img src={'/gear3.png'} alt="Gear 3" />
                            </div>
                          </CarouselItem>
                        </CarouselContent>
                        <CarouselPrevious inTheBox />
                        <CarouselNext inTheBox />
                      </Carousel>
                    </div>
                    <div className="in-the-box-description flex justify-center pb-2">
                      <div className="max-w-[85%]">
                        Try tapping your phone to the bottom right corner of the
                        frame
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              <div className="in-the-box in-the-box-3 flex justify-center">
                <Card>
                  <CardHeader>
                    <div className="flex justify-start">
                      <img src={'/2x-icon.png'} style={{height: '2rem'}} />
                    </div>
                    <div className="flex justify-center">
                      <strong>Picture hangers and nails</strong>
                    </div>
                    <hr />
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-center">
                      <Carousel className="w-full max-w-sm px-[25px]">
                        <CarouselContent>
                          <CarouselItem>
                            <div className="p-4 flex items-center justify-center">
                              <img src={'/gear1.png'} alt="Gear 1" />
                            </div>
                          </CarouselItem>
                          <CarouselItem>
                            <div className="p-4 flex items-center justify-center">
                              <img src={'/gear2.png'} alt="Gear 2" />
                            </div>
                          </CarouselItem>
                          <CarouselItem>
                            <div className="p-4 flex items-center justify-center">
                              <img src={'/gear3.png'} alt="Gear 3" />
                            </div>
                          </CarouselItem>
                        </CarouselContent>

                        <CarouselPrevious inTheBox />
                        <CarouselNext inTheBox />
                      </Carousel>
                    </div>
                    <div className="in-the-box-description flex justify-center pb-2">
                      <div className="max-w-[85%]">
                        Each print comes with 2 sets of picture hangers and
                        nails
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </section>
        )}
        <section className="reviews mt-3">
          {/* section title */}
          <div className="section-title-container">
            <div className="flex items-center justify-center w-full">
              <div className="flex-1 h-px bg-muted" />
              <span className="px-4">
                <p className="text-xl">Reviews</p>
              </span>
              <div className="flex-1 h-px bg-muted" />
            </div>
          </div>
          <div className="my-5">This is where reviews will go</div>
        </section>
        <section className="you-may-also-like mt-3">
          {/* section title */}
          <div className="section-title-container">
            <div className="flex items-center justify-center w-full">
              <div className="flex-1 h-px bg-muted" />
              <span className="px-4">
                <p className="text-xl">You may also like</p>
              </span>
              <div className="flex-1 h-px bg-muted" />
            </div>
          </div>
          <div className="you-may-also-like-container flex justify-center mt-3">
            {/* {!isVideo && (
              <SimpleRecommendedProducts
                products={recommendedProducts}
                isVideo={!isVideo}
              />
            )} */}

            <SimpleRecommendedProducts
              products={recommendedProducts}
              isVideo={isVideo}
              currentProductID={product.id}
            />
          </div>
        </section>

        <Analytics.ProductView
          data={{
            products: [
              {
                id: product.id,
                title: product.title,
                price: selectedVariant?.price.amount || '0',
                vendor: product.vendor,
                variantId: selectedVariant?.id || '',
                variantTitle: selectedVariant?.title || '',
                quantity: 1,
              },
            ],
          }}
        />
      </section>
    </>
  );
}

const PRODUCT_VARIANT_FRAGMENT = `#graphql
  fragment ProductVariant on ProductVariant {
    availableForSale
    compareAtPrice {
      amount
      currencyCode
    }
    id
    image {
      __typename
      id
      url
      altText
      width
      height
    }
    price {
      amount
      currencyCode
    }
    product {
      title
      handle
    }
    selectedOptions {
      name
      value
    }
    sku
    title
    unitPrice {
      amount
      currencyCode
    }
  }
` as const;
// changing the first first: number changes how many images get snet back
const PRODUCT_FRAGMENT = `#graphql
  fragment Product on Product {
    id
    title
    tags
    vendor
    handle
    descriptionHtml
    description
    featuredImage{
      url
    }
    encodedVariantExistence
    encodedVariantAvailability
    images(first: 250) {
      nodes {
        url
        altText
      }
    }
    options {
      name
      optionValues {
        name
        firstSelectableVariant {
          ...ProductVariant
        }
        swatch {
          color
          image {
            previewImage {
              url
              altText
            }
          }
        }
      }
    }
    selectedOrFirstAvailableVariant(selectedOptions: $selectedOptions, ignoreUnknownOptions: true, caseInsensitiveMatch: true) {
      ...ProductVariant
    }
    adjacentVariants (selectedOptions: $selectedOptions) {
      ...ProductVariant
    }
    seo {
      description
      title
    }
  }
  ${PRODUCT_VARIANT_FRAGMENT}
` as const;

export const PRODUCT_QUERY = `#graphql
  query Product(
    $country: CountryCode
    $handle: String!
    $language: LanguageCode
    $selectedOptions: [SelectedOptionInput!]!
  ) @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      ...Product
      collections(first: 250) {
        edges {
          node {
            title
            metafield(namespace: "custom", key: "multiple_images") {
              namespace
              key
              value
              references(first: 250) {
                nodes {
                  ... on MediaImage {
                    id
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
      }
    }
  }
  ${PRODUCT_FRAGMENT}
` as const;
