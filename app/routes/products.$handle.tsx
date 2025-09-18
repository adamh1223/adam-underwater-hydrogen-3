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
import {ChevronRightIcon} from 'lucide-react';
import {Card, CardContent} from '~/components/ui/card';
import IndividualVideoProduct from '~/components/eproducts/IndividualVideoProduct';
import {ProductImages} from '~/lib/types';
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
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '~/components/ui/carousel';
import {ThreeUpCarousel} from '~/components/global/ThreeUpCarousel';
import {ThreeUpEProductCarousel} from '~/components/global/ThreeUpEProductCarousel';

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

  return {};
}

export default function Product() {
  const {product, cart} = useLoaderData<typeof loader>();

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

  const WMLink = tags.filter((tag) => tag.includes('wmlink'))?.[0];
  const parsedWMLink = WMLink?.split('_')[1];

  const productSizeMetafields = collections?.edges?.[2]?.node?.metafield;
  const {references} = productSizeMetafields || {};
  const threeColumnImages = references?.nodes?.filter((item: any) => {
    if (item.image.altText?.includes('3')) {
      return {
        image: {
          url: item.image.url,
          altText: item.image.altText,
        },
      };
    }
  });
  const twoColumnImages = references?.nodes?.filter((item: any) => {
    if (item.image.altText?.includes('2')) {
      return {
        image: {
          url: item.image.url,
          altText: item.image.altText,
        },
      };
    }
  });
  const standardImages = references?.nodes?.filter((item: any) => {
    if (item.image.altText?.includes('1')) {
      return {
        image: {
          url: item.image.url,
          altText: item.image.altText,
        },
      };
    }
  });

  const determineLayoutImages = (variant: any) => {
    const layout = variant.title.split(' / ')[0];
    if (layout === 'Standard') {
      return standardImages;
    } else if (layout === 'two columns') {
      return twoColumnImages;
    } else if (layout === 'three columns') {
      return threeColumnImages;
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

  const standardCarouselImages = images.nodes
    .map((image: any) => {
      if (image.altText?.includes('carousel')) {
        return image;
      }
    })
    .filter(Boolean);

  standardCarouselImages.unshift(selectedVariant?.image);
  const isVideo = product.tags[0] === 'EProduct';
  // .includes((word: string) => {
  //   console.log(word, '3000');

  //   return word === 'Video';
  // });
  console.log(standardCarouselImages, '2000');

  const locationTag = product.tags
    .find((word: string) => word.includes('loc'))
    ?.split('_');
  const locationName = locationTag
    ?.slice(1, locationTag.length - 2)
    .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  const locationState = locationTag
    ?.slice(locationTag.length - 2, locationTag.length - 1)
    .map((word: string) => word.toUpperCase());
  const locationCountry = locationTag
    ?.slice(locationTag.length - 1, locationTag.length)
    .map((word: string) => word.toUpperCase());

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
  // const [disableButton, setDisableButton] = useState(false);
  // console.log(cart, 'rrrr');

  // useEffect(() => {
  //   cart
  //     .then((cartData) => {
  //       if (!cartData) {
  //         setDisableButton(false);
  //       }
  //       const IDs = cartData?.lines.nodes
  //         .map((node) => {
  //           if (node.merchandise.product.tags?.includes('Video')) {
  //             return node.merchandise.id;
  //           }
  //         })
  //         .filter(Boolean);
  //       const matches = IDs?.includes(
  //         selectedOrFirstAvailableVariant?.id ?? '',
  //       );
  //       setDisableButton(!!matches);
  //       console.log(matches, 'tttt');
  //     })

  //     .catch(() => setDisableButton(false));
  // }, [cart]);
  const disableButton = useIsVideoInCart(
    cart,
    selectedOrFirstAvailableVariant?.id,
  );

  console.log(disableButton, '5511');

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
              <Link to="/collections/prints">Products</Link>
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
            <ProductPrice
              price={selectedVariant?.price}
              compareAtPrice={selectedVariant?.compareAtPrice}
            />
            <h4 className="text-xl mt-1 pb-4">
              {`${locationName}, ${locationState}, ${locationCountry}`}
            </h4>
          </>
        )}
        <div className="lg:grid lg:grid-cols-2 lg:gap-x-12">
          {standardCarouselImages && standardCarouselImages?.length > 1 && (
            <IndividualProduct
              productName={title}
              productImages={standardCarouselImages}
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
                <ProductPrice
                  price={selectedVariant?.price}
                  compareAtPrice={selectedVariant?.compareAtPrice}
                />
                <br />
                <h4 className="text-xl mt-1 pb-4">
                  {`${locationName}, ${locationState}, ${locationCountry}`}
                </h4>
              </>
            )}

            <div dangerouslySetInnerHTML={{__html: descriptionHtml}} />
            <br />

            <ProductForm
              VideoAlreadyInCart={disableButton}
              productOptions={productOptions}
              selectedVariant={selectedVariant}
              imagesToShow={layoutImagesToUse as ProductImages[]}
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
                                    Lorem ipsum dolor sit amet consectetur
                                    adipisicing elit. Asperiores, aliquid
                                    aperiam blanditiis laboriosam sint velit
                                    consequuntur.
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
                                    Lorem ipsum dolor sit amet consectetur
                                    adipisicing elit. Asperiores, aliquid
                                    aperiam blanditiis laboriosam sint velit
                                    consequuntur.
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
                                    Lorem ipsum dolor sit amet consectetur
                                    adipisicing elit. Asperiores, aliquid
                                    aperiam blanditiis laboriosam sint velit
                                    consequuntur.
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
                                    Lorem ipsum dolor sit amet consectetur
                                    adipisicing elit. Asperiores, aliquid
                                    aperiam blanditiis laboriosam sint velit
                                    consequuntur.
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
                                    Lorem ipsum dolor sit amet consectetur
                                    adipisicing elit. Asperiores, aliquid
                                    aperiam blanditiis laboriosam sint velit
                                    consequuntur.
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
                                    Lorem ipsum dolor sit amet consectetur
                                    adipisicing elit. Asperiores, aliquid
                                    aperiam blanditiis laboriosam sint velit
                                    consequuntur.
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
                                    Lorem ipsum dolor sit amet consectetur
                                    adipisicing elit. Asperiores, aliquid
                                    aperiam blanditiis laboriosam sint velit
                                    consequuntur.
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
                                    Lorem ipsum dolor sit amet consectetur
                                    adipisicing elit. Asperiores, aliquid
                                    aperiam blanditiis laboriosam sint velit
                                    consequuntur.
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
                            Lorem ipsum dolor, sit amet consectetur adipisicing
                            elit. Numquam laborum odit, quo blanditiis ea
                            dolores dolorum accusantium
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
                                            Lorem ipsum dolor sit amet
                                            consectetur adipisicing elit.
                                            Asperiores, aliquid aperiam
                                            blanditiis laboriosam sint velit
                                            consequuntur.
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
                                            Lorem ipsum dolor sit amet
                                            consectetur adipisicing elit.
                                            Asperiores, aliquid aperiam
                                            blanditiis laboriosam sint velit
                                            consequuntur.
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
                                            Lorem ipsum dolor sit amet
                                            consectetur adipisicing elit.
                                            Asperiores, aliquid aperiam
                                            blanditiis laboriosam sint velit
                                            consequuntur.
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
                                            Lorem ipsum dolor sit amet
                                            consectetur adipisicing elit.
                                            Asperiores, aliquid aperiam
                                            blanditiis laboriosam sint velit
                                            consequuntur.
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
                                            Lorem ipsum dolor sit amet
                                            consectetur adipisicing elit.
                                            Asperiores, aliquid aperiam
                                            blanditiis laboriosam sint velit
                                            consequuntur.
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
                                            Lorem ipsum dolor sit amet
                                            consectetur adipisicing elit.
                                            Asperiores, aliquid aperiam
                                            blanditiis laboriosam sint velit
                                            consequuntur.
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
                                            Lorem ipsum dolor sit amet
                                            consectetur adipisicing elit.
                                            Asperiores, aliquid aperiam
                                            blanditiis laboriosam sint velit
                                            consequuntur.
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
                                            Lorem ipsum dolor sit amet
                                            consectetur adipisicing elit.
                                            Asperiores, aliquid aperiam
                                            blanditiis laboriosam sint velit
                                            consequuntur.
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
            {!isVideo && (
              <ThreeUpCarousel
                images={[
                  '/print3.jpg',
                  '/print3.jpg',
                  '/print3.jpg',
                  '/print3.jpg',
                  '/print3.jpg',
                  '/print3.jpg',
                ]}
              />
            )}
            {isVideo && (
              <ThreeUpEProductCarousel
                images={[
                  '/print3.jpg',
                  '/print3.jpg',
                  '/print3.jpg',
                  '/print3.jpg',
                  '/print3.jpg',
                  '/print3.jpg',
                ]}
              />
            )}
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
    images(first: 10) {
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

const PRODUCT_QUERY = `#graphql
  query Product(
    $country: CountryCode
    $handle: String!
    $language: LanguageCode
    $selectedOptions: [SelectedOptionInput!]!
  ) @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      ...Product
      collections(first: 10) {
        edges {
          node {
            title
            metafield(namespace: "custom", key: "multiple_images") {
              namespace
              key
              value
              references(first: 10) {
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
